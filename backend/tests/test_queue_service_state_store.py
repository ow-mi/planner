from datetime import datetime, timezone

from backend.src.api.models.responses import ExecutionStatusEnum, SolverExecution
from backend.src.services.queue_service import ExecutionQueueService
from backend.src.state import ExecutionState, StateStore


def _make_execution(execution_id: str) -> SolverExecution:
    return SolverExecution(
        execution_id=execution_id,
        status=ExecutionStatusEnum.PENDING,
        created_at=datetime(2026, 2, 17, tzinfo=timezone.utc),
    )


def test_queue_service_uses_state_store_for_internal_state():
    state_store = StateStore()
    service = ExecutionQueueService(state_store=state_store)

    service.enqueue(_make_execution("exec-1"))

    stored = state_store.get_execution("exec-1")
    assert isinstance(stored, ExecutionState)
    assert stored is not None
    assert stored.execution_id == "exec-1"


def test_queue_service_returns_pydantic_execution_responses():
    service = ExecutionQueueService(state_store=StateStore())

    service.enqueue(_make_execution("exec-1"))
    service.enqueue(_make_execution("exec-2"))

    first = service.get_execution("exec-1")
    second = service.get_execution("exec-2")

    assert isinstance(first, SolverExecution)
    assert isinstance(second, SolverExecution)
    assert first.queue_position == 0
    assert second.queue_position == 1


def test_complete_then_get_next_promotes_queued_execution():
    service = ExecutionQueueService(state_store=StateStore())

    service.enqueue(_make_execution("exec-1"))
    service.enqueue(_make_execution("exec-2"))

    service.complete_execution("exec-1")
    next_execution = service.get_next_execution()

    assert next_execution is not None
    assert isinstance(next_execution, SolverExecution)
    assert next_execution.execution_id == "exec-2"
    assert next_execution.queue_position == 0
