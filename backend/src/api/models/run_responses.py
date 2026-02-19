from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel

from .solver_responses import ExecutionStatusEnum


class RunSessionStatusEnum(str, Enum):
    CREATED = "CREATED"
    READY = "READY"
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    TIMEOUT = "TIMEOUT"


class RunSessionState(BaseModel):
    run_id: str
    status: RunSessionStatusEnum
    has_inputs: bool
    execution_id: Optional[str] = None
    execution_status: Optional[ExecutionStatusEnum] = None


class RunSessionResponse(BaseModel):
    session_id: str
    status: RunSessionStatusEnum
    name: Optional[str] = None
    source: Optional[str] = None


class RunSessionFolderImportResponse(BaseModel):
    session_id: str
    status: RunSessionStatusEnum
    has_inputs: bool
    file_count: int
    folder_path: str
    csv_files: Dict[str, str]
    priority_config: Optional[Dict[str, Any]] = None


class RunSolveResponse(BaseModel):
    run_id: str
    execution_id: str
    status: ExecutionStatusEnum
    queue_position: int
    message: str


class RunArtifactType(str, Enum):
    SPREADSHOT_SNAPSHOT = "spreadsheet_snapshot"
    CONFIG_JSON = "config_json"
    SOLVER_OUTPUT = "solver_output"
    PLOT_ARTIFACT = "plot_artifact"


class RunArtifact(BaseModel):
    artifact_id: str
    run_name: str
    scenario_id: str
    artifact_type: RunArtifactType
    artifact_name: str
    artifact_path: str
    created_at: str
    content_type: Optional[str] = None


__all__ = [
    "RunSessionStatusEnum",
    "RunSessionState",
    "RunSessionResponse",
    "RunSessionFolderImportResponse",
    "RunSolveResponse",
    "RunArtifactType",
    "RunArtifact",
]
