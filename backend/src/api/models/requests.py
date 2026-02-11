from typing import Dict, Optional, List
from pydantic import BaseModel, Field
from enum import Enum


class DebugLevel(str, Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class SolverRequest(BaseModel):
    csv_files: Dict[str, str] = Field(
        ..., description="Map of CSV file names to file contents"
    )
    priority_config: Dict = Field(..., description="Priority configuration JSON")
    time_limit: Optional[float] = Field(
        500.0, gt=0, description="Solver time limit in seconds"
    )
    debug_level: Optional[DebugLevel] = Field(
        DebugLevel.INFO, description="Logging level"
    )
    output_folder: Optional[str] = Field(None, description="Output folder path")
    input_folder: Optional[str] = Field(None, description="Input folder path")


class RunSolveRequest(BaseModel):
    time_limit: Optional[float] = Field(
        500.0, gt=0, description="Solver time limit in seconds"
    )
    debug_level: Optional[DebugLevel] = Field(
        DebugLevel.INFO, description="Logging level"
    )
    output_folder: Optional[str] = Field(None, description="Output folder path")


class RunSessionCreateRequest(BaseModel):
    name: Optional[str] = Field(None, description="Human-readable session name")
    source: Optional[str] = Field(None, description="Client source identifier")


class RunSessionFolderImportRequest(BaseModel):
    folder_path: str = Field(..., min_length=1, description="Absolute folder path")


class BatchScenarioRequest(BaseModel):
    name: str = Field(..., min_length=1, description="Scenario name")
    time_limit: Optional[float] = Field(
        500.0, gt=0, description="Solver time limit in seconds"
    )
    debug_level: Optional[DebugLevel] = Field(
        DebugLevel.INFO, description="Logging level"
    )
    output_folder: Optional[str] = Field(None, description="Output folder path")


class BatchJobCreateRequest(BaseModel):
    session_id: str = Field(..., min_length=1, description="Session identifier")
    scenarios: List[BatchScenarioRequest] = Field(
        ..., min_length=1, description="Batch scenarios"
    )
