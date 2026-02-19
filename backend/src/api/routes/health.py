from fastapi import APIRouter, Depends
from backend.src.api.main import get_queue_service
from backend.src.api.models.responses import HealthResponse
from backend.src.services.queue_service import ExecutionQueueService

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check(
    queue_service: ExecutionQueueService = Depends(get_queue_service),
):
    queue_status = queue_service.get_queue_status()
    return HealthResponse(
        status="healthy",
        queue_size=queue_status["queue_size"],
        active_executions=queue_status["active_executions"],
        version="1.0.0",
    )
