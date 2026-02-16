"""Scenario queue orchestration routes."""
from fastapi import APIRouter, HTTPException, status

from backend.src.api.models.requests import (
    AddScenarioToQueueRequest,
    RunSingleScenarioRequest,
    RunAllUnsolvedRequest,
    StopRenderRequest,
)
from backend.src.api.models.responses import (
    AddScenarioToQueueResponse,
    RunSingleScenarioResponse,
    RunAllUnsolvedResponse,
    StopRenderResponse,
    ScenarioQueueStatusResponse,
)
from backend.src.services.scenario_queue_service import scenario_queue_service

router = APIRouter()


@router.post(
    "/scenarios/queue/add",
    response_model=AddScenarioToQueueResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_scenario_to_queue(request: AddScenarioToQueueRequest):
    """
    Add a scenario to the queue for deferred execution.
    Scenario will not execute until explicitly run.
    """
    try:
        result = scenario_queue_service.add_to_queue(request)
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )


@router.post(
    "/scenarios/queue/run-one",
    response_model=RunSingleScenarioResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def run_single_scenario(request: RunSingleScenarioRequest):
    """
    Run a single scenario from the queue.
    The scenario is removed from pending and executed.
    """
    try:
        result = scenario_queue_service.run_single(request.scenario_id)
        return result
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )


@router.post(
    "/scenarios/queue/run-all-unsolved",
    response_model=RunAllUnsolvedResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def run_all_unsolved(request: RunAllUnsolvedRequest):
    """
    Run all unsolved (PENDING or FAILED) scenarios for a run name.
    Scenarios are executed sequentially, one at a time.
    """
    try:
        result = scenario_queue_service.run_all_unsolved(request.run_name)
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )


@router.get(
    "/scenarios/queue/status",
    response_model=ScenarioQueueStatusResponse,
    status_code=status.HTTP_200_OK,
)
async def get_queue_status(run_name: str):
    """
    Get the current status of the scenario queue for a run name.
    Returns counts and details for all scenarios in the queue.
    """
    try:
        result = scenario_queue_service.get_status(run_name)
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )


@router.post(
    "/scenarios/queue/stop-render",
    response_model=StopRenderResponse,
    status_code=status.HTTP_200_OK,
)
async def stop_render(request: StopRenderRequest):
    """
    Stop rendering progress for a scenario but preserve its state.
    This is distinct from stopping the solver - it only halts progress visualization.
    """
    try:
        result = scenario_queue_service.stop_render(request.scenario_id)
        return result
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )
