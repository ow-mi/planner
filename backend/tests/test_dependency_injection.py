from backend.src.api.main import get_solver_service
from backend.src.services.solver_service import SolverService


def test_fastapi_depends_resolves_solver_service():
    """Verify FastAPI dependency injection resolves correct service."""
    service = get_solver_service()

    assert service is not None
    assert isinstance(service, SolverService)
