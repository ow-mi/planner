from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


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


__all__ = [
    "ErrorCategory",
    "ErrorDetails",
    "ErrorResponse",
    "ConfigReferenceType",
    "OutOfScopeReference",
    "ConsistencyCheckResponse",
]
