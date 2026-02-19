from typing import Optional

from backend.src.api.models.requests import (
    BatchJobCreateRequest,
    RunSessionCreateRequest,
    RunSolveRequest,
    SolverRequest,
)
from backend.src.api.models.responses import (
    BatchJobResultsResponse,
    BatchJobStatusResponse,
    BatchJobSubmissionResponse,
    RunSessionFolderImportResponse,
    RunSessionResponse,
    RunSessionState as APIRunSessionState,
    SolverExecution,
    SolverResults,
)
from backend.src.services.batch_job_manager import BatchJobManager
from backend.src.services.execution_orchestrator import ExecutionOrchestrator
from backend.src.services.file_operations_service import FileOperationsService
from backend.src.services.queue_service import ExecutionQueueService
from backend.src.services.session_manager import SessionManager
from backend.src.state import ExecutionStatusEnum as StateExecutionStatusEnum
from backend.src.state import StateStore


class SolverService:
    """Thin facade delegating to specialized services."""

    def __init__(
        self,
        state_store: StateStore,
        queue_service: ExecutionQueueService,
        session_manager: Optional[SessionManager] = None,
        batch_manager: Optional[BatchJobManager] = None,
        file_ops: Optional[FileOperationsService] = None,
        orchestrator: Optional[ExecutionOrchestrator] = None,
    ):
        if state_store is None:
            raise ValueError("state_store is required")
        if queue_service is None:
            raise ValueError("queue_service is required")

        self._queue = queue_service
        self._state_store = state_store
        self._files = file_ops or FileOperationsService()
        self._orchestrator = orchestrator or ExecutionOrchestrator(
            state_store=self._state_store,
            file_ops=self._files,
            queue_service=self._queue,
        )
        self._sessions = session_manager or SessionManager(
            state_store=self._state_store,
            create_execution=lambda request: self.create_execution(request),
            get_execution_status=lambda execution_id: self.get_execution_status(
                execution_id
            ),
            get_execution_results=lambda execution_id: self.get_execution_results(
                execution_id
            ),
        )
        self._batch = batch_manager or BatchJobManager(
            state_store=self._state_store,
            create_execution=lambda request: self.create_execution(request),
            get_execution_status=lambda execution_id: self.get_execution_status(
                execution_id
            ),
            get_execution_results=lambda execution_id: self.get_execution_results(
                execution_id
            ),
            file_operations=self._files,
        )
        self._stop_event = self._orchestrator._stop_event
        self._worker_thread = self._orchestrator._worker_thread
        self._orchestrator.start_worker()
        self._worker_thread = self._orchestrator._worker_thread

    def create_run_session(self) -> APIRunSessionState:
        return self._sessions.create_run_session()

    def start_run_session_execution(
        self, run_id: str, request: RunSolveRequest
    ) -> SolverExecution:
        return self._sessions.start_run_session_execution(run_id, request)

    def get_run_session_status(self, run_id: str) -> Optional[APIRunSessionState]:
        return self._sessions.get_run_session_status(run_id)

    def get_run_session_results(self, run_id: str) -> Optional[SolverResults]:
        return self._sessions.get_run_session_results(run_id)

    def create_inputs_session(
        self, request: Optional[RunSessionCreateRequest] = None
    ) -> RunSessionResponse:
        return self._sessions.create_inputs_session(request)

    def import_session_inputs_from_folder(
        self, session_id: str, folder_path: str
    ) -> RunSessionFolderImportResponse:
        return self._sessions.import_session_inputs_from_folder(session_id, folder_path)

    def get_inputs_session(self, session_id: str) -> Optional[RunSessionResponse]:
        return self._sessions.get_inputs_session(session_id)

    def create_batch_job(
        self, request: BatchJobCreateRequest
    ) -> BatchJobSubmissionResponse:
        return self._batch.create_batch_job(request)

    def get_batch_job_status(self, batch_id: str) -> Optional[BatchJobStatusResponse]:
        return self._batch.get_batch_job_status(batch_id)

    def get_batch_job_results(self, batch_id: str) -> Optional[BatchJobResultsResponse]:
        return self._batch.get_batch_job_results(batch_id)

    def create_execution(self, request: SolverRequest) -> SolverExecution:
        return self._orchestrator.create_execution(request)

    def get_execution_status(self, execution_id: str) -> Optional[SolverExecution]:
        return self._orchestrator.get_execution_status(execution_id)

    def get_execution_results(self, execution_id: str) -> Optional[SolverResults]:
        return self._orchestrator.get_execution_results(execution_id)

    def _process_queue(self):
        return self._orchestrator._process_queue()

    def _run_solver(self, execution_id: str) -> None:
        return self._orchestrator.run_solver(execution_id)

    async def stop_run(self, run_id: str) -> bool:
        """Stop a run session's execution and save checkpoint."""
        run_session = self.get_run_session_status(run_id)
        if not run_session or not run_session.execution_id:
            return False
        return await self.stop_execution(run_session.execution_id)

    async def stop_execution(self, execution_id: str) -> bool:
        """Stop an execution and save checkpoint."""
        execution = self.get_execution_status(execution_id)
        if not execution or execution.status.value not in ["RUNNING", "PENDING"]:
            return False

        # Set stop event to signal the worker
        self._stop_event.set()

        # Update execution status
        self._state_store.update_execution_status(
            execution_id,
            StateExecutionStatusEnum.FAILED,
            current_phase="Stopped by user",
        )

        # Save checkpoint
        import os

        checkpoint_dir = "/tmp/solver_checkpoints"
        os.makedirs(checkpoint_dir, exist_ok=True)
        checkpoint_path = os.path.join(checkpoint_dir, f"{execution_id}.json")

        checkpoint_data = {
            "execution_id": execution_id,
            "stopped_at": __import__("datetime").datetime.now().isoformat(),
            "status": "STOPPED",
            "phase": "Stopped by user",
        }

        execution_state = self._state_store.get_execution(execution_id)
        if execution_state and execution_state.progress_data:
            checkpoint_data["progress_data"] = execution_state.progress_data

        with open(checkpoint_path, "w") as f:
            __import__("json").dump(checkpoint_data, f)

        return True

    def update_execution_progress(self, execution_id: str, progress_data: dict) -> None:
        """Update execution with progress data from solver."""
        self._state_store.update_execution_status(
            execution_id,
            StateExecutionStatusEnum.RUNNING,  # Keep status as RUNNING
            progress_data=progress_data,
        )
