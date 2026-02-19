from typing import Any, Dict, Optional

from backend.src.api.models.responses import (
    BatchJobStatusEnum as APIBatchJobStatusEnum,
    BatchJobStatusResponse,
    BatchScenarioStatus,
    ErrorCategory,
    ErrorDetails,
    ExecutionStatusEnum as APIExecutionStatusEnum,
    RunSessionResponse,
    RunSessionStatusEnum as APIRunSessionStatusEnum,
    SolverExecution,
    SolverResults,
)

from .models import BatchJobState, ExecutionState, RunSessionState


def _map_error_details(error: Optional[Dict[str, Any]]) -> Optional[ErrorDetails]:
    if not error:
        return None
    details = error.get("details")
    category_value = error.get("category", ErrorCategory.SystemError.value)
    try:
        category = ErrorCategory(category_value)
    except ValueError:
        category = ErrorCategory.SystemError
    return ErrorDetails(
        category=category,
        message=error.get("message", "Unknown error"),
        guidance=error.get("guidance", "Check input data and configuration."),
        error_code=error.get("error_code", "SYSTEMERROR"),
        details=details if isinstance(details, dict) else None,
    )


def _map_solver_results(results: Optional[Dict[str, Any]]) -> Optional[SolverResults]:
    if not results:
        return None
    return SolverResults(**results)


def execution_state_to_response(state: ExecutionState) -> SolverExecution:
    """Convert internal ExecutionState into API SolverExecution."""
    return SolverExecution(
        execution_id=state.execution_id,
        status=APIExecutionStatusEnum(state.status.value),
        created_at=state.created_at,
        started_at=state.started_at,
        completed_at=state.completed_at,
        progress_percentage=state.progress_percentage,
        elapsed_time_seconds=state.elapsed_time_seconds,
        current_phase=state.current_phase,
        error=_map_error_details(state.error),
        results=_map_solver_results(state.results),
        queue_position=state.queue_position,
        progress_data=state.progress_data,
    )


def run_session_state_to_response(state: RunSessionState) -> RunSessionResponse:
    """Convert internal RunSessionState into API RunSessionResponse."""
    return RunSessionResponse(
        session_id=state.session_id,
        status=APIRunSessionStatusEnum(state.status.value),
        name=None,
        source=None,
    )


def batch_job_state_to_response(state: BatchJobState) -> BatchJobStatusResponse:
    """Convert internal BatchJobState into API BatchJobStatusResponse."""
    scenario_statuses = [
        BatchScenarioStatus(
            scenario_id=scenario.scenario_id,
            scenario_name=scenario.scenario_name,
            status=APIExecutionStatusEnum(scenario.status.value),
            execution_id=scenario.execution_id,
            error=scenario.error,
        )
        for scenario in state.scenarios.values()
    ]
    total = len(scenario_statuses)
    completed = sum(
        1
        for scenario in scenario_statuses
        if scenario.status == APIExecutionStatusEnum.COMPLETED
    )
    progress = int((completed / total) * 100) if total else 0
    api_status = APIBatchJobStatusEnum(state.status.value)

    if api_status == APIBatchJobStatusEnum.COMPLETED:
        message = "Batch completed"
    elif api_status == APIBatchJobStatusEnum.RUNNING:
        message = "Batch running"
    elif api_status == APIBatchJobStatusEnum.FAILED:
        message = "Batch failed"
    else:
        message = "Batch queued"

    return BatchJobStatusResponse(
        batch_id=state.job_id,
        status=api_status,
        progress=progress,
        message=message,
        scenario_statuses=scenario_statuses,
    )
