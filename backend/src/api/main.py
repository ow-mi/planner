import logging
import time
from typing import Optional

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.src.api.models.responses import ErrorResponse, ErrorDetails, ErrorCategory
from backend.src.runtime_config import (
    get_allowed_origin_regex,
    get_allowed_origins,
)
from backend.src.services.factory import ServiceFactory
from backend.src.services.solver_service import SolverService
from backend.src.services.queue_service import ExecutionQueueService
from backend.src.state import StateStore

# Setup logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("api")

app = FastAPI(
    title="Solver UI Integration API",
    description="Backend API for executing planning solver from Alpine.js UI",
    version="1.0.0",
)

# Service factory for dependency injection
# This replaces global singletons with explicit, testable DI
_service_factory: Optional[ServiceFactory] = None


def get_service_factory() -> ServiceFactory:
    """Get the service factory singleton.

    Creates the factory on first access. Use this for all service
    dependency injection needs.
    """
    global _service_factory
    if _service_factory is None:
        _service_factory = ServiceFactory()
    return _service_factory


# Alias for convenience
get_factory = get_service_factory


def get_solver_service() -> SolverService:
    """Dependency provider for solver service."""
    return get_service_factory().solver_service


def get_queue_service() -> ExecutionQueueService:
    """Dependency provider for queue service."""
    return get_service_factory().queue_service


def get_state_store() -> StateStore:
    """Dependency provider for state store."""
    return get_service_factory().state_store


# Configure CORS
origins = get_allowed_origins()
allowed_origin_regex = get_allowed_origin_regex()

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = (time.time() - start_time) * 1000
    logger.info(
        f"{request.method} {request.url.path} - {response.status_code} - {process_time:.2f}ms"
    )
    return response


def _include_routers() -> None:
    from backend.src.api.routes import health, runs_batch, solver, validation
    from backend.src.api.routes.file_upload import router as file_upload_router
    from backend.src.api.routes.spreadsheets import router as spreadsheets_router

    app.include_router(health.router, prefix="/api", tags=["health"])
    app.include_router(solver.router, prefix="/api/solver", tags=["solver"])
    app.include_router(runs_batch.router, prefix="/api", tags=["runs", "batch"])
    app.include_router(spreadsheets_router, prefix="/api", tags=["spreadsheets"])
    app.include_router(validation.router, prefix="/api/v1", tags=["validation"])
    app.include_router(file_upload_router, prefix="/api/v1", tags=["file-upload"])


_include_routers()


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorResponse(
            error=ErrorDetails(
                category=ErrorCategory.SystemError,
                message="An unexpected error occurred",
                guidance="Check server logs for details",
                error_code="INTERNAL_SERVER_ERROR",
                details={"original_error": str(exc)},
            )
        ).dict(),
    )
