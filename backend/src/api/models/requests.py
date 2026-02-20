from typing import Any, Dict, Optional, List
from pydantic import BaseModel, Field, model_validator
from enum import Enum

from backend.src.api.models.responses import ExtractedEntities


class DebugLevel(str, Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class JsonTableData(BaseModel):
    headers: List[str] = Field(
        ..., min_length=1, description="Ordered list of table column names"
    )
    rows: List[List[Any]] = Field(
        default_factory=list, description="Ordered row values aligned to headers"
    )


class SolverInputData(BaseModel):
    tables: Dict[str, JsonTableData] = Field(
        default_factory=dict,
        description=(
            "Map of logical table keys to JSON tabular payloads "
            "(e.g. legs/tests/fte/equipment/test_duts)"
        ),
    )
    schema_version: str = Field(
        "1.0",
        description="Input payload schema version for forward compatibility",
    )


class SolverRequest(BaseModel):
    csv_files: Optional[Dict[str, str]] = Field(
        None, description="Legacy map of CSV file names to file contents"
    )
    input_data: Optional[SolverInputData] = Field(
        None,
        description=(
            "JSON-first solver input payload. Preferred over csv_files for API clients."
        ),
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
    progress_interval_seconds: Optional[int] = Field(
        10,
        ge=1,
        le=60,
        description="Progress update interval for stream events",
    )

    @model_validator(mode="after")
    def validate_input_source(self):
        has_csv_files = bool(self.csv_files)
        has_input_data = bool(self.input_data and self.input_data.tables)
        has_input_folder = bool(self.input_folder and self.input_folder.strip())
        if not (has_csv_files or has_input_data or has_input_folder):
            raise ValueError(
                "Solver request must include one of: input_data.tables, csv_files, or input_folder"
            )
        return self


class RunSolveRequest(BaseModel):
    time_limit: Optional[float] = Field(
        500.0, gt=0, description="Solver time limit in seconds"
    )
    debug_level: Optional[DebugLevel] = Field(
        DebugLevel.INFO, description="Logging level"
    )
    output_folder: Optional[str] = Field(None, description="Output folder path")
    progress_interval_seconds: Optional[int] = Field(
        10,
        ge=1,
        le=60,
        description="Progress update interval for stream events",
    )


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


# ============================================================================
# Spreadsheet Discovery and Validation Models
# ============================================================================


class SpreadsheetDiscoveryRequest(BaseModel):
    config_paths: Optional[List[str]] = Field(
        None, description="List of configured paths to scan for spreadsheets"
    )
    session_id: Optional[str] = Field(
        None, description="Uploaded session ID to include"
    )


class SpreadsheetValidationRequest(BaseModel):
    spreadsheet_id: str = Field(..., min_length=1, description="Spreadsheet identifier")
    file_content: str = Field(..., description="CSV/XLSX/XLS file content")


class ConfigConsistencyRequest(BaseModel):
    config_json: str = Field(..., description="JSON configuration to validate")
    spreadsheet_entities: ExtractedEntities = Field(
        ..., description="Entities extracted from active spreadsheet"
    )
