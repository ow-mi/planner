from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class ExecutionStatusEnum(Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    TIMEOUT = "TIMEOUT"


class RunSessionStatusEnum(Enum):
    CREATED = "CREATED"
    READY = "READY"
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    TIMEOUT = "TIMEOUT"


class BatchJobStatusEnum(Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


@dataclass
class ExecutionState:
    """Internal mutable execution state (not an API model)."""

    execution_id: str
    status: ExecutionStatusEnum
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    progress_percentage: int = 0
    elapsed_time_seconds: float = 0.0
    current_phase: Optional[str] = None
    error: Optional[Dict[str, Any]] = None
    results: Optional[Dict[str, Any]] = None
    queue_position: Optional[int] = None
    request_payload: Optional[Dict[str, Any]] = None
    progress_data: Optional[Dict[str, Any]] = None  # Real-time solver progress data


@dataclass
class RunSessionState:
    """Internal mutable run-session state."""

    session_id: str
    status: RunSessionStatusEnum
    has_inputs: bool
    execution_id: Optional[str] = None
    execution_status: Optional[ExecutionStatusEnum] = None
    csv_files: Optional[Dict[str, str]] = None
    priority_config: Optional[Dict[str, Any]] = None
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class InputSessionState:
    """Internal mutable input-session state."""

    session_id: str
    name: Optional[str] = None
    source: Optional[str] = None
    files: Dict[str, str] = field(default_factory=dict)
    base_folder: Optional[str] = None
    priority_config: Optional[Dict[str, Any]] = None
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class BatchScenarioState:
    """Internal mutable scenario status for a batch job."""

    scenario_id: str
    scenario_name: str
    status: ExecutionStatusEnum
    execution_id: Optional[str] = None
    error: Optional[str] = None
    results: Optional[Dict[str, Any]] = None


@dataclass
class BatchJobState:
    """Internal mutable batch-job state."""

    job_id: str
    session_id: str
    status: BatchJobStatusEnum
    scenarios: Dict[str, BatchScenarioState] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    summary_artifacts: List[Dict[str, str]] = field(default_factory=list)
