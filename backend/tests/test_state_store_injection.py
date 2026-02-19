from backend.src.services.queue_service import ExecutionQueueService
from backend.src.services.solver_service import SolverService
from backend.src.state import StateStore


def test_single_state_store_across_services():
    """Verify all services share the same StateStore instance."""
    state_store = StateStore()
    queue = ExecutionQueueService(state_store=state_store)
    solver = SolverService(state_store=state_store, queue_service=queue)

    assert queue._state_store is state_store
    assert solver._state_store is state_store
