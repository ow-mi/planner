"""Service for scenario queue orchestration."""
import uuid
from datetime import datetime
from typing import Dict, List, Optional
from collections import defaultdict

from backend.src.api.models.responses import (
    ScenarioQueueStatusEnum,
    QueuedScenario,
    ScenarioQueueStatusResponse,
    AddScenarioToQueueResponse,
    RunSingleScenarioResponse,
    RunAllUnsolvedResponse,
    StopRenderResponse,
)


class ScenarioQueueService:
    """Service for managing scenario queue lifecycle."""

    def __init__(self):
        # Map of run_name to list of scenarios
        self._queues: Dict[str, List[QueuedScenario]] = defaultdict(list)
        # Track current running scenario per run
        self._running: Dict[str, str] = {}
        # Track stopped scenarios
        self._stopped: set = set()

    def add_to_queue(self, request) -> AddScenarioToQueueResponse:
        """Add a scenario to the queue without immediate execution."""
        scenario_id = str(uuid.uuid4())
        scenario_name = request.scenario_name or f"Scenario_{scenario_id[:8]}"
        
        scenario = QueuedScenario(
            scenario_id=scenario_id,
            scenario_name=scenario_name,
            run_name=request.run_name,
            status=ScenarioQueueStatusEnum.PENDING,
            created_at=datetime.utcnow().isoformat(),
            spreadsheet_id=request.spreadsheet_id,
            config_json=request.config_json,
        )

        self._queues[request.run_name].append(scenario)

        return AddScenarioToQueueResponse(
            scenario_id=scenario_id,
            scenario_name=scenario_name,
            run_name=request.run_name,
            queued_at=scenario.created_at,
        )

    def run_single(self, scenario_id: str) -> RunSingleScenarioResponse:
        """Run a single scenario from the queue."""
        scenario = self._find_scenario(scenario_id)
        if not scenario:
            raise KeyError(f"Scenario {scenario_id} not found")

        if scenario.status not in [ScenarioQueueStatusEnum.PENDING, ScenarioQueueStatusEnum.FAILED]:
            raise ValueError(f"Scenario {scenario_id} is not in a runnable state")

        # Check if another scenario is running for this run
        if self._running.get(scenario.run_name):
            raise ValueError(f"Another scenario is already running for run {scenario.run_name}")

        # Mark as running
        scenario.status = ScenarioQueueStatusEnum.RUNNING
        scenario.started_at = datetime.utcnow().isoformat()
        self._running[scenario.run_name] = scenario_id

        # TODO: Start actual solver execution
        # For now, we just mark it as running

        return RunSingleScenarioResponse(
            scenario_id=scenario_id,
            execution_id=scenario_id,  # For now, reuse scenario_id
            status=scenario.status,
        )

    def run_all_unsolved(self, run_name: str) -> RunAllUnsolvedResponse:
        """Run all unsolved scenarios sequentially."""
        if run_name not in self._queues:
            raise ValueError(f"Run {run_name} not found")

        # Count unsolved scenarios
        unsolved = [
            s for s in self._queues[run_name]
            if s.status in [ScenarioQueueStatusEnum.PENDING, ScenarioQueueStatusEnum.FAILED]
        ]

        # Mark first one as running, others stay pending
        if unsolved and not self._running.get(run_name):
            first = unsolved[0]
            first.status = ScenarioQueueStatusEnum.RUNNING
            first.started_at = datetime.utcnow().isoformat()
            self._running[run_name] = first.scenario_id

        return RunAllUnsolvedResponse(
            run_name=run_name,
            scenarios_executed=len(unsolved),
            started_at=datetime.utcnow().isoformat(),
        )

    def get_status(self, run_name: str) -> ScenarioQueueStatusResponse:
        """Get queue status for a run."""
        scenarios = self._queues.get(run_name, [])
        
        pending = [s for s in scenarios if s.status == ScenarioQueueStatusEnum.PENDING]
        running = [s for s in scenarios if s.status == ScenarioQueueStatusEnum.RUNNING]
        completed = [s for s in scenarios if s.status == ScenarioQueueStatusEnum.COMPLETED]
        failed = [s for s in scenarios if s.status == ScenarioQueueStatusEnum.FAILED]
        stopped = [s for s in scenarios if s.status == ScenarioQueueStatusEnum.STOPPED]

        return ScenarioQueueStatusResponse(
            run_name=run_name,
            total_queued=len(scenarios),
            pending_count=len(pending),
            running_count=len(running),
            completed_count=len(completed),
            failed_count=len(failed),
            stopped_count=len(stopped),
            scenarios=scenarios,
        )

    def stop_render(self, scenario_id: str) -> StopRenderResponse:
        """Stop rendering for a scenario but preserve state."""
        scenario = self._find_scenario(scenario_id)
        if not scenario:
            raise KeyError(f"Scenario {scenario_id} not found")

        if scenario.status != ScenarioQueueStatusEnum.RUNNING:
            raise ValueError(f"Scenario {scenario_id} is not running")

        scenario.status = ScenarioQueueStatusEnum.STOPPED
        scenario.completed_at = datetime.utcnow().isoformat()
        
        # Remove from running
        if self._running.get(scenario.run_name) == scenario_id:
            del self._running[scenario.run_name]

        # Add to stopped set for reference
        self._stopped.add(scenario_id)

        return StopRenderResponse(
            scenario_id=scenario_id,
            status=scenario.status,
            message="Rendering stopped. Latest progress state is preserved.",
        )

    def _find_scenario(self, scenario_id: str) -> Optional[QueuedScenario]:
        """Find a scenario by ID across all runs."""
        for scenarios in self._queues.values():
            for scenario in scenarios:
                if scenario.scenario_id == scenario_id:
                    return scenario
        return None


# Global instance
scenario_queue_service = ScenarioQueueService()
