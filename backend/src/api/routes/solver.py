import asyncio
import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from backend.src.api.main import get_solver_service
from backend.src.api.models.requests import RunSolveRequest, SolverRequest
from backend.src.api.models.responses import (
    ExecutionResponse,
    ExecutionStatus,
    ExecutionStatusEnum,
    RunSessionState,
    RunSolveResponse,
    SolverResults,
)
from backend.src.services.solver_service import SolverService

router = APIRouter()


@router.post(
    "/runs", response_model=RunSessionState, status_code=status.HTTP_201_CREATED
)
async def create_run_session(service: SolverService = Depends(get_solver_service)):
    return service.create_run_session()


@router.post(
    "/runs/{run_id}/solve",
    response_model=RunSolveResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def solve_run_session(
    run_id: str,
    request: RunSolveRequest,
    service: SolverService = Depends(get_solver_service),
):
    try:
        execution = service.start_run_session_execution(run_id, request)
        return RunSolveResponse(
            run_id=run_id,
            execution_id=execution.execution_id,
            status=execution.status,
            queue_position=execution.queue_position or 0,
            message="Solver execution queued successfully",
        )
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.args[0])
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError as e:
        if "Queue is full" in str(e):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(e)
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )


@router.get("/runs/{run_id}/status", response_model=RunSessionState)
async def get_run_session_status(
    run_id: str,
    service: SolverService = Depends(get_solver_service),
):
    run_session = service.get_run_session_status(run_id)
    if not run_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Run session not found"
        )
    return run_session


@router.get("/runs/{run_id}/results", response_model=SolverResults)
async def get_run_session_results(
    run_id: str,
    service: SolverService = Depends(get_solver_service),
):
    run_session = service.get_run_session_status(run_id)
    if not run_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Run session not found"
        )

    results = service.get_run_session_results(run_id)
    if results:
        return results

    if not run_session.execution_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Run session has not been solved yet",
        )

    if run_session.execution_status != ExecutionStatusEnum.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_202_ACCEPTED, detail="Execution still running"
        )

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail="Results not found"
    )


@router.post(
    "/execute", response_model=ExecutionResponse, status_code=status.HTTP_202_ACCEPTED
)
async def execute_solver(
    request: SolverRequest,
    service: SolverService = Depends(get_solver_service),
):
    try:
        execution = service.create_execution(request)
        return ExecutionResponse(
            execution_id=execution.execution_id,
            status=execution.status,
            queue_position=execution.queue_position or 0,
            message="Solver execution queued successfully",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError as e:
        if "Queue is full" in str(e):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(e)
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )


@router.get("/status/{execution_id}", response_model=ExecutionStatus)
async def get_execution_status(
    execution_id: str,
    service: SolverService = Depends(get_solver_service),
):
    execution = service.get_execution_status(execution_id)
    if not execution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Execution not found"
        )

    return ExecutionStatus(
        execution_id=execution.execution_id,
        status=execution.status,
        progress_percentage=execution.progress_percentage,
        elapsed_time_seconds=execution.elapsed_time_seconds,
        current_phase=execution.current_phase,
        queue_position=execution.queue_position,
        error=execution.error,
    )


@router.get("/results/{execution_id}", response_model=SolverResults)
async def get_execution_results(
    execution_id: str,
    service: SolverService = Depends(get_solver_service),
):
    results = service.get_execution_results(execution_id)
    if results:
        return results

    execution = service.get_execution_status(execution_id)
    if not execution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Execution not found"
        )

    if execution.status != "COMPLETED":
        raise HTTPException(
            status_code=status.HTTP_202_ACCEPTED, detail="Execution still running"
        )

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail="Results not found"
    )


@router.get("/runs/{run_id}/stream")
async def stream_solver_progress(
    run_id: str,
    service: SolverService = Depends(get_solver_service),
):
    """Server-Sent Events for solver progress updates via run session."""

    async def event_generator():
        run_session = service.get_run_session_status(run_id)
        if not run_session:
            yield f"data: {json.dumps({'type': 'error', 'message': 'Run session not found'})}\n\n"
            return

        if not run_session.execution_id:
            yield f"data: {json.dumps({'type': 'error', 'message': 'No execution associated with this run'})}\n\n"
            return

        execution_id = run_session.execution_id
        last_progress = None

        while True:
            execution = service.get_execution_status(execution_id)

            if not execution:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Execution not found'})}\n\n"
                break

            progress_data = {
                "type": "progress",
                "run_id": run_id,
                "execution_id": execution_id,
                "status": execution.status.value
                if hasattr(execution.status, "value")
                else execution.status,
                "progress_percentage": execution.progress_percentage,
                "elapsed_time": execution.elapsed_time_seconds,
                "current_phase": execution.current_phase,
                "timestamp": datetime.now().isoformat(),
            }

            if hasattr(execution, "progress_data") and execution.progress_data:
                progress_data.update(
                    {
                        "iteration": execution.progress_data.get("iteration"),
                        "objective": execution.progress_data.get("objective_value"),
                        "gap": execution.progress_data.get("gap_percent"),
                        "best_bound": execution.progress_data.get("best_bound"),
                    }
                )

            current_progress_key = (
                f"{execution.progress_percentage}:{execution.current_phase}"
            )
            if current_progress_key != last_progress:
                last_progress = current_progress_key
                yield f"data: {json.dumps(progress_data)}\n\n"

            exec_status = (
                execution.status.value
                if hasattr(execution.status, "value")
                else execution.status
            )
            if exec_status in ["COMPLETED", "FAILED", "TIMEOUT"]:
                yield f"data: {json.dumps({'type': 'complete', 'state': exec_status, 'run_id': run_id, 'execution_id': execution_id})}\n\n"
                break

            await asyncio.sleep(1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/execute/{execution_id}/stream")
async def stream_execution_progress(
    execution_id: str,
    service: SolverService = Depends(get_solver_service),
):
    """Server-Sent Events for direct execution progress updates."""

    async def event_generator():
        last_progress = None

        while True:
            execution = service.get_execution_status(execution_id)

            if not execution:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Execution not found'})}\n\n"
                break

            progress_data = {
                "type": "progress",
                "execution_id": execution_id,
                "status": execution.status.value
                if hasattr(execution.status, "value")
                else execution.status,
                "progress_percentage": execution.progress_percentage,
                "elapsed_time": execution.elapsed_time_seconds,
                "current_phase": execution.current_phase,
                "timestamp": datetime.now().isoformat(),
            }

            if hasattr(execution, "progress_data") and execution.progress_data:
                progress_data.update(
                    {
                        "iteration": execution.progress_data.get("iteration"),
                        "objective": execution.progress_data.get("objective_value"),
                        "gap": execution.progress_data.get("gap_percent"),
                        "best_bound": execution.progress_data.get("best_bound"),
                    }
                )

            current_progress_key = (
                f"{execution.progress_percentage}:{execution.current_phase}"
            )
            if current_progress_key != last_progress:
                last_progress = current_progress_key
                yield f"data: {json.dumps(progress_data)}\n\n"

            exec_status = (
                execution.status.value
                if hasattr(execution.status, "value")
                else execution.status
            )
            if exec_status in ["COMPLETED", "FAILED", "TIMEOUT"]:
                yield f"data: {json.dumps({'type': 'complete', 'state': exec_status, 'execution_id': execution_id})}\n\n"
                break

            await asyncio.sleep(1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/runs/{run_id}/stop")
async def stop_solver_run(
    run_id: str,
    service: SolverService = Depends(get_solver_service),
):
    """Gracefully stop solver and save checkpoint."""
    try:
        success = await service.stop_run(run_id)
        if success:
            return {"success": True, "message": "Solver stopped, checkpoint saved"}
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run session not found or not running",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/execute/{execution_id}/stop")
async def stop_solver_execution(
    execution_id: str,
    service: SolverService = Depends(get_solver_service),
):
    """Gracefully stop execution and save checkpoint."""
    try:
        success = await service.stop_execution(execution_id)
        if success:
            return {"success": True, "message": "Solver stopped, checkpoint saved"}
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Execution not found or not running",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
