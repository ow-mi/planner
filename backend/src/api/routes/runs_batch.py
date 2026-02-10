from fastapi import APIRouter, HTTPException, status

from backend.src.api.models.requests import (
    RunSessionCreateRequest,
    RunSessionInputsRequest,
    BatchJobCreateRequest,
)
from backend.src.api.models.responses import (
    RunSessionResponse,
    RunSessionInputsResponse,
    BatchJobSubmissionResponse,
    BatchJobStatusResponse,
    BatchJobResultsResponse,
)
from backend.src.services.solver_service import solver_service


router = APIRouter()


@router.post(
    "/runs/sessions",
    response_model=RunSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_inputs_session(request: RunSessionCreateRequest):
    return solver_service.create_inputs_session(request)


@router.post(
    "/runs/sessions/{session_id}/inputs",
    response_model=RunSessionInputsResponse,
)
async def upload_session_inputs(session_id: str, request: RunSessionInputsRequest):
    try:
        return solver_service.upload_session_inputs(session_id, request)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.args[0])
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/batch/jobs",
    response_model=BatchJobSubmissionResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_batch_job(request: BatchJobCreateRequest):
    try:
        return solver_service.create_batch_job(request)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.args[0])
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/batch/jobs/{batch_id}/status", response_model=BatchJobStatusResponse)
async def get_batch_job_status(batch_id: str):
    response = solver_service.get_batch_job_status(batch_id)
    if not response:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Batch job not found"
        )
    return response


@router.get("/batch/jobs/{batch_id}/results", response_model=BatchJobResultsResponse)
async def get_batch_job_results(batch_id: str):
    response = solver_service.get_batch_job_results(batch_id)
    if not response:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Batch job not found"
        )
    return response
