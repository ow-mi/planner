from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field

from .solver_responses import ExecutionStatusEnum, SolverResults


class BatchJobStatusEnum(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


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


__all__ = [
    "BatchJobStatusEnum",
    "BatchScenarioStatus",
    "BatchJobSubmissionResponse",
    "BatchJobStatusResponse",
    "BatchScenarioResultItem",
    "BatchSummaryArtifact",
    "BatchJobResultsResponse",
]
