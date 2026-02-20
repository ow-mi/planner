import json
import os
import uuid
from typing import Any, Callable, Dict, Optional

from backend.src.api.models.requests import (
    RunSessionCreateRequest,
    RunSolveRequest,
    SolverRequest,
)
from backend.src.api.models.responses import (
    RunSessionFolderImportResponse,
    RunSessionResponse,
    RunSessionState as APIRunSessionState,
    RunSessionStatusEnum,
    SolverExecution,
    SolverResults,
)
from backend.src.state import (
    InputSessionState,
    RunSessionState,
    RunSessionStatusEnum as StateRunSessionStatusEnum,
    StateStore,
)
from backend.src.utils.validation import ValidationUtils


class SessionManager:
    """Manages run sessions and input sessions."""

    def __init__(
        self,
        state_store: StateStore,
        create_execution: Callable[[SolverRequest], SolverExecution],
        get_execution_status: Callable[[str], Optional[SolverExecution]],
        get_execution_results: Callable[[str], Optional[SolverResults]],
    ):
        self._state = state_store
        self._create_execution = create_execution
        self._get_execution_status = get_execution_status
        self._get_execution_results = get_execution_results

    def create_run_session(self) -> APIRunSessionState:
        run_id = str(uuid.uuid4())
        run_session = RunSessionState(
            session_id=run_id,
            status=self._to_state_run_session_status(RunSessionStatusEnum.CREATED),
            has_inputs=False,
        )
        self._state.set_run_session(run_session)
        return APIRunSessionState(
            run_id=run_id,
            status=RunSessionStatusEnum.CREATED,
            has_inputs=False,
            execution_id=None,
            execution_status=None,
        )

    def start_run_session_execution(
        self,
        run_id: str,
        request: RunSolveRequest,
    ) -> SolverExecution:
        run_session = self._state.get_run_session(run_id)
        if not run_session:
            raise KeyError("Run session not found")
        if not run_session.csv_files or run_session.priority_config is None:
            raise ValueError(
                "Run session inputs are missing. Import folder inputs before solving"
            )

        execution = self._create_execution(
            SolverRequest(
                csv_files=run_session.csv_files,
                priority_config=run_session.priority_config,
                time_limit=request.time_limit,
                debug_level=request.debug_level,
                output_folder=request.output_folder,
                progress_interval_seconds=request.progress_interval_seconds,
            )
        )
        run_session.execution_id = execution.execution_id
        self._state.set_run_session(run_session)
        return execution

    def get_run_session_status(self, run_id: str) -> Optional[APIRunSessionState]:
        run_session = self._state.get_run_session(run_id)
        if not run_session:
            return None

        execution = (
            self._get_execution_status(run_session.execution_id)
            if run_session.execution_id
            else None
        )
        execution_status = execution.status if execution else None

        return APIRunSessionState(
            run_id=run_id,
            status=self._derive_run_session_status(run_session, execution),
            has_inputs=bool(run_session.csv_files and run_session.priority_config),
            execution_id=run_session.execution_id,
            execution_status=execution_status,
        )

    def get_run_session_results(self, run_id: str) -> Optional[SolverResults]:
        run_session = self._state.get_run_session(run_id)
        if not run_session or not run_session.execution_id:
            return None
        return self._get_execution_results(run_session.execution_id)

    def create_inputs_session(
        self,
        request: Optional[RunSessionCreateRequest] = None,
    ) -> RunSessionResponse:
        request = request or RunSessionCreateRequest()
        session_id = str(uuid.uuid4())
        input_session = InputSessionState(
            session_id=session_id,
            name=request.name,
            source=request.source,
            files={},
        )
        self._state.set_input_session(input_session)
        return RunSessionResponse(
            session_id=session_id,
            status=RunSessionStatusEnum.CREATED,
            name=request.name,
            source=request.source,
        )

    def import_session_inputs_from_folder(
        self,
        session_id: str,
        folder_path: str,
    ) -> RunSessionFolderImportResponse:
        input_session = self._state.get_input_session(session_id)
        if not input_session:
            raise KeyError("Run session not found")

        resolved_folder = self._resolve_folder_path(folder_path)
        csv_files = self._read_required_csv_bundle(resolved_folder)
        csv_errors = ValidationUtils.validate_csv_files(csv_files)
        if csv_errors:
            raise ValueError(f"CSV Validation Error: {'; '.join(csv_errors)}")

        priority_config = self._read_priority_config_if_present(resolved_folder)

        input_session.files = csv_files
        input_session.base_folder = resolved_folder
        input_session.priority_config = priority_config
        self._state.set_input_session(input_session)

        run_session = self._state.get_run_session(session_id)
        if run_session:
            run_session.csv_files = csv_files
            run_session.priority_config = priority_config
            run_session.has_inputs = True
            run_session.status = self._to_state_run_session_status(
                RunSessionStatusEnum.READY
            )
            self._state.set_run_session(run_session)

        return RunSessionFolderImportResponse(
            session_id=session_id,
            status=RunSessionStatusEnum.READY,
            has_inputs=len(csv_files) > 0,
            file_count=len(csv_files),
            folder_path=resolved_folder,
            csv_files=csv_files,
            priority_config=priority_config,
        )

    def get_inputs_session(self, session_id: str) -> Optional[RunSessionResponse]:
        input_session = self._state.get_input_session(session_id)
        if not input_session:
            return None
        status = (
            RunSessionStatusEnum.READY
            if input_session.files
            else RunSessionStatusEnum.CREATED
        )
        return RunSessionResponse(
            session_id=input_session.session_id,
            status=status,
            name=input_session.name,
            source=input_session.source,
        )

    def _derive_run_session_status(
        self,
        run_session: RunSessionState,
        execution: Optional[SolverExecution],
    ) -> RunSessionStatusEnum:
        if execution:
            return RunSessionStatusEnum(execution.status.value)
        if (
            run_session.csv_files is not None
            and run_session.priority_config is not None
        ):
            return RunSessionStatusEnum.READY
        return RunSessionStatusEnum.CREATED

    def _resolve_folder_path(self, folder_path: str) -> str:
        if not folder_path or not folder_path.strip():
            raise ValueError("Folder path is required")

        resolved = os.path.abspath(os.path.expanduser(folder_path.strip()))
        if not os.path.isdir(resolved):
            raise ValueError(f"Folder does not exist or is not a directory: {resolved}")
        if not os.access(resolved, os.R_OK):
            raise ValueError(f"Folder is not readable: {resolved}")
        if not os.access(resolved, os.W_OK):
            raise ValueError(f"Folder is not writable: {resolved}")
        return resolved

    def _read_required_csv_bundle(self, folder_path: str) -> Dict[str, str]:
        csv_files: Dict[str, str] = {}
        for file_name in ValidationUtils.REQUIRED_CSV_FILES:
            candidate_path = os.path.join(folder_path, file_name)
            if not os.path.isfile(candidate_path):
                continue
            with open(candidate_path, "r", encoding="utf-8") as file:
                csv_files[file_name] = (
                    file.read().removeprefix("\ufeff").replace("\r\n", "\n")
                )
        return csv_files

    def _read_priority_config_if_present(
        self,
        folder_path: str,
    ) -> Optional[Dict[str, Any]]:
        candidate_path = os.path.join(folder_path, "priority_config.json")
        if not os.path.isfile(candidate_path):
            return None
        try:
            with open(candidate_path, "r", encoding="utf-8") as file:
                payload = json.load(file)
        except Exception as exc:
            raise ValueError(f"Failed to read priority_config.json: {exc}")

        if not isinstance(payload, dict):
            raise ValueError("priority_config.json must contain a JSON object")
        priority_errors = ValidationUtils.validate_priority_config(payload)
        if priority_errors:
            raise ValueError(
                f"Priority Config Validation Error: {'; '.join(priority_errors)}"
            )
        return payload

    def _to_state_run_session_status(
        self,
        status: RunSessionStatusEnum,
    ) -> StateRunSessionStatusEnum:
        return StateRunSessionStatusEnum(status.value)
