import uuid
from datetime import datetime
from typing import Callable, Dict, Optional

from backend.src.api.models.requests import BatchJobCreateRequest, SolverRequest
from backend.src.api.models.responses import (
    BatchJobResultsResponse,
    BatchJobStatusEnum,
    BatchJobStatusResponse,
    BatchJobSubmissionResponse,
    BatchScenarioResultItem,
    BatchScenarioStatus,
    ExecutionStatusEnum,
    SolverExecution,
    SolverResults,
)
from backend.src.services.file_operations_service import FileOperationsService
from backend.src.state import (
    BatchJobState,
    BatchJobStatusEnum as StateBatchJobStatusEnum,
    BatchScenarioState,
    ExecutionStatusEnum as StateExecutionStatusEnum,
    StateStore,
)
from backend.src.state.mappers import batch_job_state_to_response


class BatchJobManager:
    """Manages batch job lifecycle."""

    def __init__(
        self,
        state_store: StateStore,
        create_execution: Callable[[SolverRequest], SolverExecution],
        get_execution_status: Callable[[str], Optional[SolverExecution]],
        get_execution_results: Callable[[str], Optional[SolverResults]],
        file_operations: Optional[FileOperationsService] = None,
    ):
        self._state = state_store
        self._create_execution = create_execution
        self._get_execution_status = get_execution_status
        self._get_execution_results = get_execution_results
        self._file_operations = file_operations or FileOperationsService()

    def create_batch_job(
        self,
        request: BatchJobCreateRequest,
    ) -> BatchJobSubmissionResponse:
        input_session = self._state.get_input_session(request.session_id)
        if not input_session:
            raise KeyError("Run session not found")
        if not input_session.files:
            raise ValueError(
                "Run session inputs are missing. Import folder inputs before batch run"
            )

        scenarios: Dict[str, BatchScenarioState] = {}
        for scenario in request.scenarios:
            scenario_output_folder = scenario.output_folder or input_session.base_folder
            execution = self._create_execution(
                SolverRequest(
                    csv_files=input_session.files,
                    priority_config=input_session.priority_config
                    or self._default_batch_priority_config(),
                    time_limit=scenario.time_limit,
                    debug_level=scenario.debug_level,
                    output_folder=scenario_output_folder,
                    input_folder=input_session.base_folder,
                )
            )
            scenario_id = str(uuid.uuid4())
            scenarios[scenario_id] = BatchScenarioState(
                scenario_id=scenario_id,
                scenario_name=scenario.name,
                execution_id=execution.execution_id,
                status=self._to_state_execution_status(execution.status),
            )

        batch_id = str(uuid.uuid4())
        batch_job = BatchJobState(
            job_id=batch_id,
            session_id=request.session_id,
            status=self._to_state_batch_status(BatchJobStatusEnum.PENDING),
            scenarios=scenarios,
        )
        self._state.set_batch_job(batch_job)
        return self._build_batch_submission_response(batch_job)

    def get_batch_job_status(self, batch_id: str) -> Optional[BatchJobStatusResponse]:
        batch_job = self._state.get_batch_job(batch_id)
        if not batch_job:
            return None

        refreshed = self._refresh_batch_job_status(batch_job)
        return batch_job_state_to_response(refreshed)

    def get_batch_job_results(self, batch_id: str) -> Optional[BatchJobResultsResponse]:
        batch_job = self._state.get_batch_job(batch_id)
        if not batch_job:
            return None

        refreshed = self._refresh_batch_job_status(batch_job)
        items = []
        for scenario in refreshed.scenarios.values():
            items.append(
                BatchScenarioResultItem(
                    scenario_id=scenario.scenario_id,
                    scenario_name=scenario.scenario_name,
                    status=ExecutionStatusEnum(scenario.status.value),
                    execution_id=scenario.execution_id,
                    results=self._get_execution_results(scenario.execution_id)
                    if scenario.execution_id
                    else None,
                )
            )

        input_session = self._state.get_input_session(refreshed.session_id)
        summary_artifacts = self._file_operations.write_batch_summary_artifacts(
            refreshed.job_id,
            items,
            output_root=input_session.base_folder if input_session else None,
        )
        refreshed.summary_artifacts = [
            artifact.model_dump() for artifact in summary_artifacts
        ]
        self._state.set_batch_job(refreshed)

        return BatchJobResultsResponse(
            batch_id=refreshed.job_id,
            status=BatchJobStatusEnum(refreshed.status.value),
            items=items,
            summary_artifacts=summary_artifacts,
        )

    def _refresh_batch_job_status(self, batch_job: BatchJobState) -> BatchJobState:
        has_running = False
        has_failure = False
        all_completed = True

        for scenario in batch_job.scenarios.values():
            execution = self._get_execution_status(scenario.execution_id)
            if execution:
                scenario.status = self._to_state_execution_status(execution.status)
                scenario.error = execution.error.message if execution.error else None
            elif scenario.status not in (
                StateExecutionStatusEnum.COMPLETED,
                StateExecutionStatusEnum.FAILED,
                StateExecutionStatusEnum.TIMEOUT,
            ):
                scenario.status = StateExecutionStatusEnum.PENDING
                scenario.error = None

            if scenario.status == StateExecutionStatusEnum.RUNNING:
                has_running = True
            elif scenario.status in (
                StateExecutionStatusEnum.FAILED,
                StateExecutionStatusEnum.TIMEOUT,
            ):
                has_failure = True

            if scenario.status != StateExecutionStatusEnum.COMPLETED:
                all_completed = False

        if has_failure:
            batch_job.status = self._to_state_batch_status(BatchJobStatusEnum.FAILED)
        elif all_completed and batch_job.scenarios:
            batch_job.status = self._to_state_batch_status(BatchJobStatusEnum.COMPLETED)
            batch_job.completed_at = datetime.utcnow()
        elif has_running:
            batch_job.status = self._to_state_batch_status(BatchJobStatusEnum.RUNNING)
        else:
            batch_job.status = self._to_state_batch_status(BatchJobStatusEnum.PENDING)

        self._state.set_batch_job(batch_job)
        return batch_job

    def _build_batch_submission_response(
        self,
        batch_job: BatchJobState,
    ) -> BatchJobSubmissionResponse:
        return BatchJobSubmissionResponse(
            batch_id=batch_job.job_id,
            status=BatchJobStatusEnum(batch_job.status.value),
            message=self._batch_status_message(
                BatchJobStatusEnum(batch_job.status.value)
            ),
            scenario_statuses=[
                BatchScenarioStatus(
                    scenario_id=scenario.scenario_id,
                    scenario_name=scenario.scenario_name,
                    status=ExecutionStatusEnum(scenario.status.value),
                    execution_id=scenario.execution_id,
                    error=scenario.error,
                )
                for scenario in batch_job.scenarios.values()
            ],
        )

    def _batch_status_message(self, status: BatchJobStatusEnum) -> str:
        if status == BatchJobStatusEnum.COMPLETED:
            return "Batch completed"
        if status == BatchJobStatusEnum.RUNNING:
            return "Batch running"
        if status == BatchJobStatusEnum.FAILED:
            return "Batch failed"
        return "Batch queued"

    def _default_batch_priority_config(self) -> Dict:
        return {
            "mode": "leg_end_dates",
            "description": "batch-default",
            "weights": {
                "makespan_weight": 0.2,
                "priority_weight": 0.8,
            },
        }

    def _to_state_execution_status(
        self,
        status: ExecutionStatusEnum,
    ) -> StateExecutionStatusEnum:
        return StateExecutionStatusEnum(status.value)

    def _to_state_batch_status(
        self,
        status: BatchJobStatusEnum,
    ) -> StateBatchJobStatusEnum:
        return StateBatchJobStatusEnum(status.value)
