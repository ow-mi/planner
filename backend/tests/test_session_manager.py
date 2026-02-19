from backend.src.api.models.responses import RunSessionStatusEnum
from backend.src.services.session_manager import SessionManager
from backend.src.state import StateStore


def test_session_manager_create_run_session_sets_created_defaults():
    manager = SessionManager(
        state_store=StateStore(),
        create_execution=lambda request: None,
        get_execution_status=lambda execution_id: None,
        get_execution_results=lambda execution_id: None,
    )

    response = manager.create_run_session()

    assert response.status == RunSessionStatusEnum.CREATED
    assert response.has_inputs is False
    assert response.execution_id is None
    assert response.execution_status is None
