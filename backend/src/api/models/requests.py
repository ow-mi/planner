from typing import Dict, Optional
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


class RunUploadRequest(BaseModel):
    csv_files: Dict[str, str] = Field(
        ..., description="Map of CSV file names to file contents"
    )
    priority_config: Dict = Field(..., description="Priority configuration JSON")


class RunSolveRequest(BaseModel):
    time_limit: Optional[float] = Field(
        500.0, gt=0, description="Solver time limit in seconds"
    )
    debug_level: Optional[DebugLevel] = Field(
        DebugLevel.INFO, description="Logging level"
    )
    output_folder: Optional[str] = Field(None, description="Output folder path")
