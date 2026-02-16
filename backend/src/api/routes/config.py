"""Configuration consistency check routes."""
from fastapi import APIRouter, HTTPException, status

from backend.src.api.models.requests import ConfigConsistencyRequest
from backend.src.api.models.responses import ConsistencyCheckResponse
from backend.src.services.config_consistency_service import config_consistency_service

router = APIRouter()


@router.post(
    "/config/consistency",
    response_model=ConsistencyCheckResponse,
    status_code=status.HTTP_200_OK,
)
async def check_config_consistency(request: ConfigConsistencyRequest):
    """
    Validate imported JSON configuration against active spreadsheet entities.
    Returns warnings for out-of-scope references that will be ignored at runtime.
    """
    try:
        result = config_consistency_service.check_consistency(request)
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )
