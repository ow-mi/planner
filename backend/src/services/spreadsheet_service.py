"""Service for spreadsheet discovery and validation."""

import os
import tempfile
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import pandas as pd

from backend.src.api.models.responses import (
    ColumnValidationError,
    ExtractedEntities,
    HeaderValidationError,
    SpreadsheetFileInfo,
    SpreadsheetFileTypeEnum,
    SpreadsheetValidationResult,
    ValidationErrorCategory,
)


REQUIRED_COLUMNS = [
    "project",
    "leg",
    "branch",
    "test",
    "duration_days",
    "description",
    "next_leg",
]

REQUIRED_COLUMN_TYPES = {
    "project": str,
    "leg": str,
    "branch": str,
    "test": str,
    "duration_days": (int, float),
    "description": str,
    "next_leg": str,
}


class SpreadsheetService:
    """Service for discovering and validating spreadsheet files."""

    def __init__(self):
        self._file_registry: Dict[str, Dict] = {}

    def discover_spreadsheets(self, request) -> List["SpreadsheetFileInfo"]:
        """
        Discover available spreadsheet files from configured paths and uploaded sessions.
        Returns CSV/XLSX/XLS files with stable identifiers and metadata.
        """
        spreadsheets = []

        # Scan configured paths
        config_paths = request.config_paths or []
        for path in config_paths:
            spreadsheets.extend(self._scan_path(path, source="config_path"))

        # Scan uploaded sessions
        session_id = request.session_id
        if session_id:
            # For now, we'll assume session files are stored in a temp directory
            session_path = os.path.join(tempfile.gettempdir(), f"session_{session_id}")
            if os.path.isdir(session_path):
                spreadsheets.extend(
                    self._scan_path(session_path, source="uploaded_session")
                )

        return spreadsheets

    def _scan_path(self, path: str, source: str) -> List["SpreadsheetFileInfo"]:
        """Scan a path for spreadsheet files."""
        spreadsheets = []

        if not os.path.isdir(path):
            return spreadsheets

        for filename in os.listdir(path):
            filepath = os.path.join(path, filename)
            if not os.path.isfile(filepath):
                continue

            file_type = self._detect_file_type(filename)
            if file_type:
                spreadsheets.append(
                    SpreadsheetFileInfo(
                        filename=filename,
                        file_type=file_type,
                        size_bytes=os.path.getsize(filepath),
                        modified_at=datetime.fromtimestamp(
                            os.path.getmtime(filepath)
                        ).isoformat(),
                        source=source,
                    )
                )

        return spreadsheets

    def _detect_file_type(self, filename: str) -> Optional[SpreadsheetFileTypeEnum]:
        """Detect file type from extension."""
        ext = filename.lower().strip()
        if ext.endswith(".csv"):
            return SpreadsheetFileTypeEnum.CSV
        elif ext.endswith(".xlsx"):
            return SpreadsheetFileTypeEnum.XLSX
        elif ext.endswith(".xls"):
            return SpreadsheetFileTypeEnum.XLS
        return None

    def validate_spreadsheet(self, request) -> "SpreadsheetValidationResult":
        """
        Validate a selected spreadsheet against required schema.
        Returns header validation, row-level errors, and extracted entities.
        """
        # Parse the file content
        file_content = request.file_content
        df, parse_error = self._parse_file_content(file_content, request.spreadsheet_id)

        if parse_error:
            return SpreadsheetValidationResult(
                is_valid=False,
                headers_valid=False,
                header_errors=[parse_error],
                row_errors=[],
                extracted_entities=None,
            )

        # Validate headers
        header_errors = self._validate_headers(df.columns.tolist())
        headers_valid = len(header_errors) == 0

        # Validate rows and extract entities
        row_errors = []
        entities = ExtractedEntities(
            projects=[],
            leg_types=[],
            leg_names=[],
            test_types=[],
            computed_test_names=[],
        )

        if headers_valid:
            # Extract values from valid columns
            for col in ["project", "leg", "branch", "test", "next_leg"]:
                if col in df.columns:
                    values = df[col].dropna().astype(str).unique().tolist()
                    if col == "project":
                        entities.projects = sorted(values)
                    elif col == "leg":
                        entities.leg_names = sorted(values)
                    elif col == "branch":
                        # Branch is stored in leg_types for config purposes
                        entities.leg_types = sorted(values)
                    elif col == "test":
                        entities.test_types = sorted(values)
                    elif col == "next_leg":
                        entities.computed_test_names = sorted(values)

            # Validate row values
            row_errors = self._validate_row_values(df)

        is_valid = headers_valid and len(row_errors) == 0

        return SpreadsheetValidationResult(
            is_valid=is_valid,
            headers_valid=headers_valid,
            header_errors=header_errors,
            row_errors=row_errors,
            extracted_entities=entities if headers_valid else None,
        )

    def _parse_file_content(
        self, content: str, spreadsheet_id: str
    ) -> Tuple[pd.DataFrame, Optional["HeaderValidationError"]]:
        """Parse file content into DataFrame."""
        try:
            # Try CSV first
            df = pd.read_csv(pd.io.StringIO(content))
            return df, None
        except Exception:
            # Try Excel
            try:
                # Create a temp file for Excel
                with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
                    tmp.write(content.encode("utf-8"))
                    tmp.flush()
                    df = pd.read_excel(tmp.name)
                    os.unlink(tmp.name)
                    return df, None
            except Exception as excel_error:
                return (
                    None,
                    HeaderValidationError(
                        column_name="_file_",
                        error_message=str(excel_error),
                        category=ValidationErrorCategory.FormatError,
                    ),
                )

    def _validate_headers(self, columns: List[str]) -> List["HeaderValidationError"]:
        """Validate required headers are present."""
        errors = []
        # Normalize column names (lowercase, strip whitespace)
        normalized_cols = [c.lower().strip() for c in columns]

        for required in REQUIRED_COLUMNS:
            if required.lower() not in normalized_cols:
                errors.append(
                    HeaderValidationError(
                        column_name=required,
                        error_message=f"Missing required column: {required}",
                        category=ValidationErrorCategory.MissingRequiredColumn,
                    )
                )

        return errors

    def _validate_row_values(self, df: pd.DataFrame) -> List["ColumnValidationError"]:
        """Validate row-level values for type and format."""
        errors = []

        for idx, row in df.iterrows():
            # Validate duration_days is numeric
            if "duration_days" in df.columns:
                val = row["duration_days"]
                if pd.notna(val):
                    try:
                        num_val = float(val)
                        if num_val <= 0:
                            errors.append(
                                ColumnValidationError(
                                    row_index=idx + 2,  # +2 for 0-index + header row
                                    column_name="duration_days",
                                    value=str(val),
                                    expected_type="positive number",
                                    error_message="duration_days must be a positive number",
                                    category=ValidationErrorCategory.InvalidValue,
                                )
                            )
                    except (ValueError, TypeError):
                        errors.append(
                            ColumnValidationError(
                                row_index=idx + 2,
                                column_name="duration_days",
                                value=str(val),
                                expected_type="number",
                                error_message="duration_days must be a numeric value",
                                category=ValidationErrorCategory.InvalidColumnType,
                            )
                        )

        return errors


# Global instance
spreadsheet_service = SpreadsheetService()
