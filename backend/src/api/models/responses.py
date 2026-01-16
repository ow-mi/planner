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

class HealthResponse(BaseModel):
    status: str
    queue_size: int
    active_executions: int
    version: str
