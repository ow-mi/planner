from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from backend.src.api.routes import health, solver, runs_batch
from backend.src.api.models.responses import ErrorResponse, ErrorDetails, ErrorCategory
import logging
import time

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

# Configure CORS
origins = [
    "*",  # Allow all origins for development; restrict in production if needed
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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


# Include routers
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(solver.router, prefix="/api/solver", tags=["solver"])
app.include_router(runs_batch.router, prefix="/api", tags=["runs", "batch"])


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
