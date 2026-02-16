from typing import Dict, Optional, List, Any
from pydantic import BaseModel, Field
from enum import Enum
from datetime import datetime


class ExecutionStatusEnum(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    TIMEOUT = "TIMEOUT"


class RunSessionStatusEnum(str, Enum):
    CREATED = "CREATED"
    READY = "READY"
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    TIMEOUT = "TIMEOUT"


class SolverStatusEnum(str, Enum):
    OPTIMAL = "OPTIMAL"
    FEASIBLE = "FEASIBLE"
    INFEASIBLE = "INFEASIBLE"
    NO_SOLUTION = "NO_SOLUTION"


class ErrorCategory(str, Enum):
    ValidationError = "ValidationError"
    SolverError = "SolverError"
    TimeoutError = "TimeoutError"
    SystemError = "SystemError"


class ErrorDetails(BaseModel):
    category: ErrorCategory
    message: str
    guidance: str
    error_code: str
    details: Optional[Dict[str, Any]] = None


class ErrorResponse(BaseModel):
    error: ErrorDetails


class SolverResults(BaseModel):
    execution_id: str
    status: SolverStatusEnum
    makespan: Optional[float] = None
    test_schedule: List[Dict[str, Any]]
    resource_utilization: Optional[Dict[str, Any]] = None
    output_files: Dict[str, str]
    output_root: Optional[str] = None
    written_output_paths: Dict[str, str] = Field(default_factory=dict)
    solver_stats: Optional[Dict[str, Any]] = None


class ExecutionStatus(BaseModel):
    execution_id: str
    status: ExecutionStatusEnum
    progress_percentage: int
    elapsed_time_seconds: float
    current_phase: Optional[str] = None
    queue_position: Optional[int] = None
    error: Optional[ErrorDetails] = None


class SolverExecution(BaseModel):
    execution_id: str
    status: ExecutionStatusEnum
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    progress_percentage: int = Field(0, ge=0, le=100)
    elapsed_time_seconds: float = 0.0
    current_phase: Optional[str] = None
    error: Optional[ErrorDetails] = None
    results: Optional[SolverResults] = None
    queue_position: Optional[int] = None


class ExecutionResponse(BaseModel):
    execution_id: str
    status: ExecutionStatusEnum
    queue_position: int
    message: str


class RunSessionState(BaseModel):
    run_id: str
    status: RunSessionStatusEnum
    has_inputs: bool
    execution_id: Optional[str] = None
    execution_status: Optional[ExecutionStatusEnum] = None


class RunSolveResponse(BaseModel):
    run_id: str
    execution_id: str
    status: ExecutionStatusEnum
    queue_position: int
    message: str


class HealthResponse(BaseModel):
    status: str
    queue_size: int
    active_executions: int
    version: str


class BatchJobStatusEnum(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


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


class BatchScenarioStatus(BaseModel):
    scenario_id: str
    scenario_name: str
    status: ExecutionStatusEnum
    execution_id: Optional[str] = None
    error: Optional[str] = None


class BatchJobSubmissionResponse(BaseModel):
    batch_id: str
    status: BatchJobStatusEnum
    message: str
    scenario_statuses: List[BatchScenarioStatus]


class BatchJobStatusResponse(BaseModel):
    batch_id: str
    status: BatchJobStatusEnum
    progress: int
    message: str
    scenario_statuses: List[BatchScenarioStatus]


class BatchScenarioResultItem(BaseModel):
    scenario_id: str
    scenario_name: str
    status: ExecutionStatusEnum
    execution_id: Optional[str] = None
    results: Optional[SolverResults] = None


class BatchSummaryArtifact(BaseModel):
    artifact_name: str
    artifact_path: str
    content_type: str


class BatchJobResultsResponse(BaseModel):
    batch_id: str
    status: BatchJobStatusEnum
    items: List[BatchScenarioResultItem]
    summary_artifacts: List[BatchSummaryArtifact] = Field(default_factory=list)


# ============================================================================
# Spreadsheet Discovery and Validation Models
# ============================================================================


class SpreadsheetFileTypeEnum(str, Enum):
    CSV = "CSV"
    XLSX = "XLSX"
    XLS = "XLS"


class SpreadsheetFileInfo(BaseModel):
    filename: str
    file_type: SpreadsheetFileTypeEnum
    size_bytes: int
    modified_at: Optional[str] = None
    source: Optional[str] = None  # "config_path" or "uploaded_session"
    session_id: Optional[str] = None


class SpreadsheetDiscoveryResponse(BaseModel):
    spreadsheets: List[SpreadsheetFileInfo]
    total_count: int


class ValidationErrorCategory(str, Enum):
    MissingRequiredColumn = "MissingRequiredColumn"
    InvalidColumnType = "InvalidColumnType"
    InvalidValue = "InvalidValue"
    FormatError = "FormatError"


class ColumnValidationError(BaseModel):
    row_index: int
    column_name: str
    value: Optional[str] = None
    expected_type: Optional[str] = None
    error_message: str
    category: ValidationErrorCategory


class HeaderValidationError(BaseModel):
    column_name: str
    error_message: str
    category: ValidationErrorCategory


class SpreadsheetValidationResult(BaseModel):
    is_valid: bool
    headers_valid: bool
    header_errors: List[HeaderValidationError]
    row_errors: List[ColumnValidationError]
    extracted_entities: Optional["ExtractedEntities"] = None


class ExtractedEntities(BaseModel):
    projects: List[str]
    leg_types: List[str]
    leg_names: List[str]
    test_types: List[str]
    computed_test_names: List[str]


class SpreadsheetValidationResponse(BaseModel):
    validation: SpreadsheetValidationResult
    spreadsheet_id: str


# ============================================================================
# Configuration Consistency Models
# ============================================================================


class ConfigReferenceType(str, Enum):
    Project = "Project"
    LegType = "LegType"
    LegName = "LegName"
    TestType = "TestType"
    TestName = "TestName"
    FTE = "FTE"
    Equipment = "Equipment"


class OutOfScopeReference(BaseModel):
    ref_type: ConfigReferenceType
    ref_name: str
    spreadsheet_entities: List[str]


class ConsistencyCheckResponse(BaseModel):
    is_consistent: bool
    warnings: List[OutOfScopeReference]


# ============================================================================
# Scenario Queue Orchestration Models
# ============================================================================


class ScenarioQueueStatusEnum(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    STOPPED = "STOPPED"


class QueuedScenario(BaseModel):
    scenario_id: str
    scenario_name: str
    run_name: str
    status: ScenarioQueueStatusEnum
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    progress_percentage: int = 0
    current_phase: Optional[str] = None


class ScenarioQueueStatusResponse(BaseModel):
    run_name: str
    total_queued: int
    pending_count: int
    running_count: int
    completed_count: int
    failed_count: int
    stopped_count: int
    scenarios: List[QueuedScenario]


class AddScenarioToQueueRequest(BaseModel):
    run_name: str = Field(..., min_length=1)
    spreadsheet_id: str = Field(..., min_length=1)
    config_json: Optional[str] = Field(None, description="JSON configuration string")


class AddScenarioToQueueResponse(BaseModel):
    scenario_id: str
    scenario_name: str
    run_name: str
    queued_at: str


class RunSingleScenarioRequest(BaseModel):
    scenario_id: str = Field(..., min_length=1)


class RunSingleScenarioResponse(BaseModel):
    scenario_id: str
    execution_id: str
    status: ScenarioQueueStatusEnum


class RunAllUnsolvedRequest(BaseModel):
    run_name: str = Field(..., min_length=1)


class RunAllUnsolvedResponse(BaseModel):
    run_name: str
    scenarios_executed: int
    started_at: str


class StopRenderRequest(BaseModel):
    scenario_id: str = Field(..., min_length=1)


class StopRenderResponse(BaseModel):
    scenario_id: str
    status: ScenarioQueueStatusEnum
    message: str


# ============================================================================
# Run Artifact Persistence Models
# ============================================================================


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
