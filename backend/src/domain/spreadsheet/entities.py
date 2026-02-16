"""Domain models for spreadsheet entities and validation."""
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, List


class SpreadsheetFileType(Enum):
    """Supported spreadsheet file types."""
    CSV = "CSV"
    XLSX = "XLSX"
    XLS = "XLS"


class ValidationErrorCategory(Enum):
    """Categories of spreadsheet validation errors."""
    MISSING_REQUIRED_COLUMN = "MissingRequiredColumn"
    INVALID_COLUMN_TYPE = "InvalidColumnType"
    INVALID_VALUE = "InvalidValue"
    FORMAT_ERROR = "FormatError"


@dataclass
class SpreadsheetFileInfo:
    """Metadata about a discovered spreadsheet file."""
    filename: str
    file_type: SpreadsheetFileType
    size_bytes: int
    modified_at: Optional[str] = None
    source: Optional[str] = None  # "config_path" or "uploaded_session"
    session_id: Optional[str] = None


@dataclass
class HeaderValidationError:
    """Represents a header validation error."""
    column_name: str
    error_message: str
    category: ValidationErrorCategory


@dataclass
class ColumnValidationError:
    """Represents a row-level column validation error."""
    row_index: int
    column_name: str
    value: Optional[str]
    expected_type: Optional[str]
    error_message: str
    category: ValidationErrorCategory


@dataclass
class ExtractedEntities:
    """Entities extracted from a validated spreadsheet."""
    projects: List[str] = field(default_factory=list)
    leg_types: List[str] = field(default_factory=list)
    leg_names: List[str] = field(default_factory=list)
    test_types: List[str] = field(default_factory=list)
    computed_test_names: List[str] = field(default_factory=list)


@dataclass
class SpreadsheetValidationResult:
    """Result of spreadsheet validation."""
    is_valid: bool
    headers_valid: bool
    header_errors: List[HeaderValidationError] = field(default_factory=list)
    row_errors: List[ColumnValidationError] = field(default_factory=list)
    extracted_entities: Optional[ExtractedEntities] = None


# Alias for backward compatibility
SpreadsheetFile = SpreadsheetFileInfo
