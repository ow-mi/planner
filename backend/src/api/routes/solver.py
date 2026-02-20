import asyncio
import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
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
from backend.src.api.routes.streaming_utils import (
    TERMINAL_STATES,
    build_progress_event,
    format_sse,
    get_replay_events,
    progress_interval_seconds,
    record_event,
    status_value,
)
from backend.src.services.solver_service import SolverService

router = APIRouter()
logger = logging.getLogger(__name__)


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
        progress_data=execution.progress_data,
    )


@router.get("/results/{execution_id}", response_model=SolverResults)
async def get_execution_results(
    execution_id: str,
    include_partial: bool = False,
    service: SolverService = Depends(get_solver_service),
):
    results = service.get_execution_results(execution_id, include_partial=include_partial)
    if results:
        return results

    execution = service.get_execution_status(execution_id)
    if not execution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Execution not found"
        )

    if status_value(execution.status) != "COMPLETED":
        raise HTTPException(
            status_code=status.HTTP_202_ACCEPTED, detail="Execution still running"
        )

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail="Results not found"
    )


@router.get("/runs/{run_id}/stream")
async def stream_solver_progress(
    run_id: str,
    request: Request,
    last_event_id: Optional[str] = None,
    service: SolverService = Depends(get_solver_service),
):
    """Server-Sent Events for solver progress updates via run session."""

    async def event_generator():
        logger.info(
            "[stream] Open run stream run_id=%s last_event_id=%s",
            run_id,
            request.headers.get("Last-Event-ID") or last_event_id,
        )
        run_session = service.get_run_session_status(run_id)
        if not run_session:
            logger.warning("[stream] Run stream missing run_id=%s", run_id)
            yield f"data: {json.dumps({'type': 'error', 'message': 'Run session not found'})}\n\n"
            return

        if not run_session.execution_id:
            logger.warning("[stream] Run stream has no execution run_id=%s", run_id)
            yield f"data: {json.dumps({'type': 'error', 'message': 'No execution associated with this run'})}\n\n"
            return

        execution_id = run_session.execution_id
        effective_last_event_id = request.headers.get("Last-Event-ID") or last_event_id
        replay_events, replay_gap = get_replay_events(
            execution_id, effective_last_event_id
        )
        if replay_gap:
            yield format_sse(
                record_event(
                    execution_id,
                    {
                        "type": "resync_required",
                        "execution_id": execution_id,
                        "run_id": run_id,
                        "timestamp": datetime.now().isoformat(),
                        "status": "UNKNOWN",
                        "message": "Replay gap detected, refresh status/results",
                    },
                )
            )
        for replay_event in replay_events:
            yield format_sse(replay_event)

        last_progress_key = None
        last_state = None

        while True:
            execution = service.get_execution_status(execution_id)

            if not execution:
                logger.warning(
                    "[stream] Run stream missing execution run_id=%s execution_id=%s",
                    run_id,
                    execution_id,
                )
                yield format_sse(
                    record_event(
                        execution_id,
                        {
                            "type": "error",
                            "execution_id": execution_id,
                            "run_id": run_id,
                            "timestamp": datetime.now().isoformat(),
                            "status": "UNKNOWN",
                            "message": "Execution not found",
                        },
                    )
                )
                break

            current_status = status_value(execution.status)
            current_progress_key = (
                f"{execution.progress_percentage}:{execution.current_phase}"
            )
            if current_status != last_state:
                last_state = current_status
                logger.info(
                    "[stream] state_changed run_id=%s execution_id=%s status=%s",
                    run_id,
                    execution_id,
                    current_status,
                )
                yield format_sse(
                    record_event(
                        execution_id,
                        {
                            "type": "state_changed",
                            "execution_id": execution_id,
                            "run_id": run_id,
                            "timestamp": datetime.now().isoformat(),
                            "status": current_status,
                        },
                    )
                )
            if current_progress_key != last_progress_key:
                last_progress_key = current_progress_key
                logger.info(
                    "[stream] progress run_id=%s execution_id=%s progress_key=%s",
                    run_id,
                    execution_id,
                    current_progress_key,
                )
                yield format_sse(
                    record_event(
                        execution_id,
                        build_progress_event(execution, execution_id, run_id=run_id),
                    )
                )
            else:
                yield format_sse(
                    record_event(
                        execution_id,
                        {
                            "type": "heartbeat",
                            "execution_id": execution_id,
                            "run_id": run_id,
                            "timestamp": datetime.now().isoformat(),
                            "status": current_status,
                        },
                    )
                )

            if current_status in TERMINAL_STATES:
                logger.info(
                    "[stream] completed run_id=%s execution_id=%s status=%s",
                    run_id,
                    execution_id,
                    current_status,
                )
                yield format_sse(
                    record_event(
                        execution_id,
                        {
                            "type": "completed",
                            "execution_id": execution_id,
                            "run_id": run_id,
                            "timestamp": datetime.now().isoformat(),
                            "status": current_status,
                        },
                    )
                )
                break

            await asyncio.sleep(progress_interval_seconds(execution))

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
    request: Request,
    last_event_id: Optional[str] = None,
    service: SolverService = Depends(get_solver_service),
):
    """Server-Sent Events for direct execution progress updates."""

    async def event_generator():
        logger.info(
            "[stream] Open execution stream execution_id=%s last_event_id=%s",
            execution_id,
            request.headers.get("Last-Event-ID") or last_event_id,
        )
        effective_last_event_id = request.headers.get("Last-Event-ID") or last_event_id
        replay_events, replay_gap = get_replay_events(
            execution_id, effective_last_event_id
        )
        if replay_gap:
            yield format_sse(
                record_event(
                    execution_id,
                    {
                        "type": "resync_required",
                        "execution_id": execution_id,
                        "timestamp": datetime.now().isoformat(),
                        "status": "UNKNOWN",
                        "message": "Replay gap detected, refresh status/results",
                    },
                )
            )
        for replay_event in replay_events:
            yield format_sse(replay_event)

        last_progress_key = None
        last_state = None

        while True:
            execution = service.get_execution_status(execution_id)

            if not execution:
                logger.warning(
                    "[stream] Execution stream missing execution_id=%s",
                    execution_id,
                )
                yield format_sse(
                    record_event(
                        execution_id,
                        {
                            "type": "error",
                            "execution_id": execution_id,
                            "timestamp": datetime.now().isoformat(),
                            "status": "UNKNOWN",
                            "message": "Execution not found",
                        },
                    )
                )
                break

            current_status = status_value(execution.status)
            current_progress_key = (
                f"{execution.progress_percentage}:{execution.current_phase}"
            )
            if current_status != last_state:
                last_state = current_status
                logger.info(
                    "[stream] state_changed execution_id=%s status=%s",
                    execution_id,
                    current_status,
                )
                yield format_sse(
                    record_event(
                        execution_id,
                        {
                            "type": "state_changed",
                            "execution_id": execution_id,
                            "timestamp": datetime.now().isoformat(),
                            "status": current_status,
                        },
                    )
                )
            if current_progress_key != last_progress_key:
                last_progress_key = current_progress_key
                logger.info(
                    "[stream] progress execution_id=%s progress_key=%s",
                    execution_id,
                    current_progress_key,
                )
                yield format_sse(
                    record_event(
                        execution_id,
                        build_progress_event(execution, execution_id),
                    )
                )
            else:
                yield format_sse(
                    record_event(
                        execution_id,
                        {
                            "type": "heartbeat",
                            "execution_id": execution_id,
                            "timestamp": datetime.now().isoformat(),
                            "status": current_status,
                        },
                    )
                )

            if current_status in TERMINAL_STATES:
                logger.info(
                    "[stream] completed execution_id=%s status=%s",
                    execution_id,
                    current_status,
                )
                yield format_sse(
                    record_event(
                        execution_id,
                        {
                            "type": "completed",
                            "execution_id": execution_id,
                            "timestamp": datetime.now().isoformat(),
                            "status": current_status,
                        },
                    )
                )
                break

            await asyncio.sleep(progress_interval_seconds(execution))

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
        run_session = service.get_run_session_status(run_id)
        if not run_session or not run_session.execution_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Run session not found or has no execution",
            )
        response = await service.stop_execution(run_session.execution_id)
        if response.get("accepted"):
            return response
        reason = response.get("reason", "unknown")
        error_status = (
            status.HTTP_404_NOT_FOUND
            if reason == "not_found"
            else status.HTTP_409_CONFLICT
        )
        raise HTTPException(status_code=error_status, detail=response.get("message"))
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
        response = await service.stop_execution(execution_id)
        if response.get("accepted"):
            return response
        reason = response.get("reason", "unknown")
        error_status = (
            status.HTTP_404_NOT_FOUND
            if reason == "not_found"
            else status.HTTP_409_CONFLICT
        )
        raise HTTPException(status_code=error_status, detail=response.get("message"))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
