from fastapi import APIRouter, Depends, HTTPException, status

from backend.src.api.main import get_solver_service
from backend.src.api.models.requests import (
    BatchJobCreateRequest,
    RunSessionCreateRequest,
    RunSessionFolderImportRequest,
)
from backend.src.api.models.responses import (
    BatchJobResultsResponse,
    BatchJobStatusResponse,
    BatchJobSubmissionResponse,
    RunSessionFolderImportResponse,
    RunSessionResponse,
)
from backend.src.services.solver_service import SolverService


router = APIRouter()


@router.post(
    "/runs/sessions",
    response_model=RunSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_inputs_session(
    request: RunSessionCreateRequest,
    service: SolverService = Depends(get_solver_service),
):
    return service.create_inputs_session(request)


@router.post(
    "/runs/sessions/{session_id}/inputs/import-folder",
    response_model=RunSessionFolderImportResponse,
)
async def import_session_inputs_from_folder(
    session_id: str,
    request: RunSessionFolderImportRequest,
    service: SolverService = Depends(get_solver_service),
):
    try:
        return service.import_session_inputs_from_folder(
            session_id, request.folder_path
        )
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.args[0])
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/batch/jobs",
    response_model=BatchJobSubmissionResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_batch_job(
    request: BatchJobCreateRequest,
    service: SolverService = Depends(get_solver_service),
):
    try:
        return service.create_batch_job(request)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.args[0])
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/batch/jobs/{batch_id}/status", response_model=BatchJobStatusResponse)
async def get_batch_job_status(
    batch_id: str,
    service: SolverService = Depends(get_solver_service),
):
    response = service.get_batch_job_status(batch_id)
    if not response:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Batch job not found"
        )
    return response


@router.get("/batch/jobs/{batch_id}/results", response_model=BatchJobResultsResponse)
async def get_batch_job_results(
    batch_id: str,
    service: SolverService = Depends(get_solver_service),
):
    response = service.get_batch_job_results(batch_id)
    if not response:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Batch job not found"
        )
    return response
