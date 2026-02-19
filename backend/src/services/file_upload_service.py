"""
File Upload Service - Handles direct file uploads (drag-drop and browse)

Supports CSV, Excel (.xlsx, .xls), and JSON files.
Converts all formats to internal data structure.
"""

import os
import io
import uuid
import json
from typing import Dict, List, Tuple, Optional, Any
from pathlib import Path

import pandas as pd
from fastapi import UploadFile, HTTPException

from .spreadsheet_service import SpreadsheetService
from .config_validation_service import ConfigValidationService


class FileUploadService:
    """Service for handling direct file uploads from frontend."""
    
    # Supported file extensions
    SUPPORTED_EXTENSIONS = {'.csv', '.xlsx', '.xls', '.json'}
    
    # Maximum file size (10 MB)
    MAX_FILE_SIZE = 10 * 1024 * 1024
    
    def __init__(self):
        self.spreadsheet_service = SpreadsheetService()
        self.config_validation_service = ConfigValidationService()
    
    async def upload_file(
        self, 
        file: UploadFile,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process uploaded file and return parsed data.
        
        Args:
            file: FastAPI UploadFile object
            session_id: Optional session identifier
            
        Returns:
            Dictionary with file metadata and parsed data
            
        Raises:
            HTTPException: If file invalid or parsing fails
        """
        # Validate file exists
        if not file or not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")
        
        # Get file extension
        file_ext = Path(file.filename).suffix.lower()
        
        # Validate extension
        if file_ext not in self.SUPPORTED_EXTENSIONS:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported file type: {file_ext}. Supported: {', '.join(self.SUPPORTED_EXTENSIONS)}"
            )
        
        # Read file content
        try:
            content = await file.read()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")
        
        # Validate size
        if len(content) > self.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400, 
                detail=f"File too large: {len(content)} bytes. Max: {self.MAX_FILE_SIZE} bytes"
            )
        
        # Parse based on file type
        try:
            if file_ext == '.json':
                parsed_data = self._parse_json(content)
                file_type = 'config_json'
            elif file_ext in {'.xlsx', '.xls'}:
                parsed_data = self._parse_excel(content, file.filename)
                file_type = 'spreadsheet'
            else:  # .csv
                parsed_data = self._parse_csv(content, file.filename)
                file_type = 'spreadsheet'
            
            return {
                "file_id": str(uuid.uuid4()),
                "filename": file.filename,
                "file_type": file_type,
                "extension": file_ext,
                "size_bytes": len(content),
                "session_id": session_id,
                "parsed_data": parsed_data
            }
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")
    
    def _parse_json(self, content: bytes) -> Dict[str, Any]:
        """Parse JSON configuration file."""
        try:
            content_str = content.decode('utf-8')
            config = json.loads(content_str)
            
            # Validate against schema
            validation_result = self.config_validation_service.validate_config_structure(config)
            
            return {
                "type": "config",
                "content": config,
                "validation": validation_result,
                "entities": self._extract_config_entities(config)
            }
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON: {str(e)}")
    
    def _parse_csv(self, content: bytes, filename: str) -> Dict[str, Any]:
        """Parse CSV file using pandas."""
        try:
            # Try UTF-8 first, then latin-1 as fallback
            try:
                content_str = content.decode('utf-8')
            except UnicodeDecodeError:
                content_str = content.decode('latin-1')
            
            # Parse with pandas
            df = pd.read_csv(io.StringIO(content_str))
            
            # Normalize and validate
            return self._process_dataframe(df, filename)
            
        except Exception as e:
            raise ValueError(f"Failed to parse CSV: {str(e)}")
    
    def _parse_excel(self, content: bytes, filename: str) -> Dict[str, Any]:
        """Parse Excel file using pandas with enhanced processing."""
        try:
            # Use pandas ExcelFile with openpyxl engine for formula evaluation
            xl_file = pd.ExcelFile(io.BytesIO(content), engine='openpyxl')
            
            # Expected headers (case-insensitive)
            expected_headers = {'project', 'leg', 'branch', 'test', 'duration_days', 'description', 'next_leg'}
            required_headers = {'project', 'leg', 'test', 'duration_days', 'description'}
            
            best_sheet = None
            best_sheet_name = None
            best_header_row = 0
            best_score = -1
            
            # Scan all sheets to find the best one
            for sheet_name in xl_file.sheet_names:
                # Read raw to find header row
                df_raw = pd.read_excel(
                    io.BytesIO(content),
                    sheet_name=sheet_name,
                    header=None,
                    engine='openpyxl'
                )
                
                # Auto-detect header row
                header_row, score = self._detect_header_row(df_raw, expected_headers, required_headers)
                
                if score > best_score:
                    best_score = score
                    best_sheet_name = sheet_name
                    best_header_row = header_row
                    best_sheet = df_raw
            
            if best_sheet is None:
                raise ValueError("No valid sheet found in Excel file")
            
            # Re-read with detected header row
            df = pd.read_excel(
                io.BytesIO(content),
                sheet_name=best_sheet_name,
                header=best_header_row,
                engine='openpyxl'
            )
            
            # Process merged cells - forward fill from top-left value
            df = self._handle_merged_cells(df)
            
            # Convert to datetime columns first, then to ISO strings
            for col in df.columns:
                if df[col].dtype == 'datetime64[ns]':
                    df[col] = df[col].dt.strftime('%Y-%m-%dT%H:%M:%S')
            
            return self._process_dataframe(df, filename, sheet_name=best_sheet_name)
            
        except Exception as e:
            raise ValueError(f"Failed to parse Excel: {str(e)}")
    
    def _detect_header_row(
        self, 
        df: pd.DataFrame, 
        expected_headers: set,
        required_headers: set
    ) -> Tuple[int, int]:
        """
        Auto-detect header row by scanning first N rows.
        
        Returns:
            Tuple of (header_row_index, score)
            Score is number of matching expected headers
        """
        max_scan_rows = min(10, len(df))
        best_row = 0
        best_score = -1
        
        for row_idx in range(max_scan_rows):
            row_values = df.iloc[row_idx].astype(str)
            # Clean and normalize
            row_headers = set(
                str(val).lower().strip() 
                for val in row_values 
                if val and str(val).strip()
            )
            
            # Calculate score: required headers count more
            required_matches = len(required_headers & row_headers)
            optional_matches = len((expected_headers - required_headers) & row_headers)
            score = required_matches * 10 + optional_matches
            
            # Bonus for having branch and next_leg
            if required_matches == len(required_headers):
                score += 100  # Strong bonus for all required headers
            
            if score > best_score:
                best_score = score
                best_row = row_idx
        
        return best_row, best_score
    
    def _handle_merged_cells(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Handle merged cells by forward-filling values.
        When a merged cell is at the top-left, pandas reads the value
        and other cells in the merge are NaN. We forward-fill these.
        """
        df = df.copy()
        
        # Forward fill within each column group
        # This handles both vertically merged cells and simple NaN gaps
        for col in df.columns:
            # First, forward fill (handles vertical merges)
            df[col] = df[col].ffill()
        
        return df
    
    def _process_datetime_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """Convert datetime columns to ISO format strings."""
        df = df.copy()
        for col in df.columns:
            if pd.api.types.is_datetime64_any_dtype(df[col]):
                df[col] = df[col].dt.strftime('%Y-%m-%dT%H:%M:%S')
        return df
    
    def _has_expected_headers(self, df: pd.DataFrame) -> bool:
        """Check if DataFrame has expected CSV headers."""
        expected_headers = {'project', 'leg', 'test', 'duration_days', 'description'}
        actual_headers = set(df.columns.str.lower().str.strip())
        return expected_headers.issubset(actual_headers)
    
    def _process_dataframe(
        self, 
        df: pd.DataFrame, 
        filename: str,
        sheet_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Process DataFrame to extract entities and validate."""
        # Standardize column names (lowercase, trim)
        df.columns = df.columns.str.lower().str.strip()
        
        # Convert datetime columns to ISO format strings
        df = self._process_datetime_columns(df)
        
        # Convert duration_days to numeric (evaluates formulas)
        if 'duration_days' in df.columns:
            df['duration_days'] = pd.to_numeric(df['duration_days'], errors='coerce')
        
        # Remove empty rows
        df = df.dropna(subset=['project', 'leg', 'test'], how='all')
        
        # Extract entities
        entities = self._extract_entities(df)
        
        # Validate structure
        validation_errors = []
        
        required_columns = ['project', 'leg', 'test', 'duration_days', 'description']
        for col in required_columns:
            if col not in df.columns:
                validation_errors.append(f"Missing required column: {col}")
        
        # Check for empty values in required fields
        if not validation_errors:
            for col in required_columns:
                if col in df.columns:
                    # Handle both NaN and empty string
                    empty_mask = df[col].isna()
                    if df[col].dtype == object:
                        empty_mask = empty_mask | (df[col].astype(str).str.strip() == '')
                    empty_count = empty_mask.sum()
                    if empty_count > 0:
                        validation_errors.append(
                            f"Column '{col}' has {int(empty_count)} empty values"
                        )
        
        # Check duration_days are positive
        if 'duration_days' in df.columns:
            # Filter out NaN values first
            valid_durations = df['duration_days'].dropna()
            if len(valid_durations) > 0:
                invalid_durations = (valid_durations <= 0).sum()
                if invalid_durations > 0:
                    validation_errors.append(
                        f"Found {int(invalid_durations)} non-positive duration values"
                    )
        
        # Convert data to records (dates already converted to strings)
        data_records = df.fillna('').to_dict('records')
        
        # Convert any remaining datetime objects to strings in records
        for record in data_records:
            for key, value in record.items():
                if hasattr(value, 'isoformat'):
                    record[key] = value.isoformat()
        
        return {
            "type": "spreadsheet",
            "filename": filename,
            "sheet_name": sheet_name,
            "row_count": len(df),
            "columns": list(df.columns),
            "data": data_records,
            "entities": entities,
            "validation": {
                "valid": len(validation_errors) == 0,
                "errors": validation_errors
            }
        }
    
    def _extract_entities(self, df: pd.DataFrame) -> Dict[str, List[str]]:
        """Extract unique entities from DataFrame."""
        entities = {
            "projects": [],
            "leg_types": [],
            "legs": [],
            "test_types": [],
            "tests": []
        }
        
        # Projects
        if 'project' in df.columns:
            entities["projects"] = df['project'].dropna().astype(str).str.strip().unique().tolist()
        
        # Leg types (unique leg values)
        if 'leg' in df.columns:
            entities["leg_types"] = df['leg'].dropna().astype(str).str.strip().unique().tolist()
        
        # Legs (project__leg combinations)
        if 'project' in df.columns and 'leg' in df.columns:
            df_copy = df.copy()
            df_copy['leg_name'] = df_copy['project'].astype(str) + '__' + df_copy['leg'].astype(str)
            entities["legs"] = df_copy['leg_name'].dropna().unique().tolist()
        
        # Test types
        if 'test' in df.columns:
            entities["test_types"] = df['test'].dropna().astype(str).str.strip().unique().tolist()
        
        # Tests (project__leg__branch{sequence}__test)
        if all(col in df.columns for col in ['project', 'leg', 'test']):
            df_copy = df.copy()
            
            # Handle branch column (may not exist)
            if 'branch' in df_copy.columns:
                df_copy['branch'] = df_copy['branch'].fillna('')
            else:
                df_copy['branch'] = ''
            
            # Group by project, leg, branch to compute sequence
            df_copy['sequence'] = df_copy.groupby(['project', 'leg', 'branch']).cumcount() + 1
            
            # Build test names
            df_copy['branch_seq'] = df_copy.apply(
                lambda x: f"{x['branch']}{x['sequence']}" if x['branch'] else str(x['sequence']),
                axis=1
            )
            df_copy['test_name'] = (
                df_copy['project'].astype(str) + '__' +
                df_copy['leg'].astype(str) + '__' +
                df_copy['branch_seq'].astype(str) + '__' +
                df_copy['test'].astype(str)
            )
            entities["tests"] = df_copy['test_name'].dropna().unique().tolist()
        
        return entities
    
    def _extract_config_entities(self, config: Dict) -> Dict[str, List[str]]:
        """Extract entities referenced in config JSON."""
        entities = {
            "legs": [],
            "tests": [],
            "fte_resources": [],
            "equipment": []
        }
        
        # Extract legs from config
        if 'legs' in config:
            entities["legs"] = list(config['legs'].keys())
        
        # Extract tests
        if 'tests' in config:
            entities["tests"] = list(config['tests'].keys())
        
        # Extract FTE
        if 'fte' in config and 'resources' in config['fte']:
            entities["fte_resources"] = [r.get('id') for r in config['fte']['resources'] if r.get('id')]
        
        # Extract equipment
        if 'equipment' in config and 'resources' in config['equipment']:
            entities["equipment"] = [r.get('id') for r in config['equipment']['resources'] if r.get('id')]
        
        return entities


# Singleton instance
_file_upload_service = None


def get_file_upload_service() -> FileUploadService:
    """Get or create singleton service instance."""
    global _file_upload_service
    if _file_upload_service is None:
        _file_upload_service = FileUploadService()
    return _file_upload_service
