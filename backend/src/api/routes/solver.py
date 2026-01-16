from fastapi import APIRouter, HTTPException, status
from backend.src.api.models.requests import SolverRequest
from backend.src.api.models.responses import (
    ExecutionResponse, ExecutionStatus, SolverResults, ErrorResponse
)
from backend.src.services.solver_service import solver_service

router = APIRouter()

@router.post("/execute", response_model=ExecutionResponse, status_code=status.HTTP_202_ACCEPTED)
async def execute_solver(request: SolverRequest):
    try:
        execution = solver_service.create_execution(request)
        return ExecutionResponse(
            execution_id=execution.execution_id,
            status=execution.status,
            queue_position=execution.queue_position or 0,
            message="Solver execution queued successfully"
        )
    except ValueError as e:
        # Validation error
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError as e:
        # Queue full or other runtime errors
        if "Queue is full" in str(e):
             raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/status/{execution_id}", response_model=ExecutionStatus)
async def get_execution_status(execution_id: str):
    execution = solver_service.get_execution_status(execution_id)
    if not execution:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Execution not found")
    
    return ExecutionStatus(
        execution_id=execution.execution_id,
        status=execution.status,
        progress_percentage=execution.progress_percentage,
        elapsed_time_seconds=execution.elapsed_time_seconds,
        current_phase=execution.current_phase,
        queue_position=execution.queue_position,
        error=execution.error
    )

@router.get("/results/{execution_id}", response_model=SolverResults)
async def get_execution_results(execution_id: str):
    results = solver_service.get_execution_results(execution_id)
    if results:
        return results
    
    # If no results, check why
    execution = solver_service.get_execution_status(execution_id)
    if not execution:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Execution not found")
    
    if execution.status != "COMPLETED":
         raise HTTPException(status_code=status.HTTP_202_ACCEPTED, detail="Execution still running")
    
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Results not found")

