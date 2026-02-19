from enum import Enum
from typing import List, Optional

from pydantic import BaseModel


class SpreadsheetFileTypeEnum(str, Enum):
    CSV = "CSV"
    XLSX = "XLSX"
    XLS = "XLS"


class SpreadsheetFileInfo(BaseModel):
    filename: str
    file_type: SpreadsheetFileTypeEnum
    size_bytes: int
    modified_at: Optional[str] = None
    source: Optional[str] = None
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


__all__ = [
    "SpreadsheetFileTypeEnum",
    "SpreadsheetFileInfo",
    "SpreadsheetDiscoveryResponse",
    "ValidationErrorCategory",
    "ColumnValidationError",
    "HeaderValidationError",
    "SpreadsheetValidationResult",
    "ExtractedEntities",
    "SpreadsheetValidationResponse",
]
