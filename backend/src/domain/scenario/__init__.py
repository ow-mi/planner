"""Domain models for scenario queue entities."""
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, List
from datetime import datetime


class ScenarioQueueStatus(Enum):
    """Status of a queued scenario."""
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    STOPPED = "STOPPED"


@dataclass
class QueuedScenario:
    """A scenario in the execution queue."""
    scenario_id: str
    scenario_name: str
    run_name: str
    status: ScenarioQueueStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    progress_percentage: int = 0
    current_phase: Optional[str] = None
    spreadsheet_id: Optional[str] = None
    config_json: Optional[str] = None


@dataclass
class ScenarioQueueStatus:
    """Status of the scenario queue for a run."""
    run_name: str
    total_queued: int
    pending_count: int
    running_count: int
    completed_count: int
    failed_count: int
    stopped_count: int
    scenarios: List[QueuedScenario] = field(default_factory=list)


@dataclass
class AddScenarioToQueue:
    """Request to add a scenario to the queue."""
    run_name: str
    spreadsheet_id: str
    config_json: Optional[str] = None


@dataclass
class QueuedScenarioResponse:
    """Response after adding a scenario to the queue."""
    scenario_id: str
    scenario_name: str
    run_name: str
    queued_at: datetime


@dataclass
class RunScenarioResult:
    """Result of running a single scenario."""
    scenario_id: str
    execution_id: str
    status: ScenarioQueueStatus


@dataclass
class RunAllUnsolvedResult:
    """Result of running all unsolved scenarios."""
    run_name: str
    scenarios_executed: int
    started_at: datetime


@dataclass
class StopRenderResult:
    """Result of stopping render for a scenario."""
    scenario_id: str
    status: ScenarioQueueStatus
    message: str


@dataclass
class RunArtifact:
    """Artifact persisted for a run/scenario."""
    artifact_id: str
    run_name: str
    scenario_id: str
    artifact_type: str  # enum: spreadsheet_snapshot, config_json, solver_output, plot_artifact
    artifact_name: str
    artifact_path: str
    created_at: datetime
    content_type: Optional[str] = None


@dataclass
class RunArtifactType(Enum):
    """Types of run artifacts."""
    SPREADSHEET_SNAPSHOT = "spreadsheet_snapshot"
    CONFIG_JSON = "config_json"
    SOLVER_OUTPUT = "solver_output"
    PLOT_ARTIFACT = "plot_artifact"
