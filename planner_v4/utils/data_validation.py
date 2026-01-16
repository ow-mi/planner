"""
Data validation utilities for Test Planner V3.

Provides comprehensive validation for input data and data structures.
"""

import os
import pandas as pd
from typing import List, Dict, Any, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


def validate_dataframe(
    df: pd.DataFrame,
    name: str,
    required_columns: List[str],
    column_types: Optional[Dict[str, type]] = None,
    non_empty: bool = True
) -> Tuple[bool, List[str]]:
    """
    Validate a DataFrame against requirements.
    
    Args:
        df: DataFrame to validate
        name: Name of the DataFrame for error messages
        required_columns: List of required columns
        column_types: Expected types for columns
        non_empty: Whether the DataFrame should be non-empty
        
    Returns:
        Tuple of (is_valid, error_messages)
    """
    errors = []
    
    if not isinstance(df, pd.DataFrame):
        errors.append(f"{name} is not a DataFrame")
        return False, errors
    
    if non_empty and df.empty:
        errors.append(f"{name} is empty")
        return False, errors
    
    # Check required columns
    missing_cols = [col for col in required_columns if col not in df.columns]
    if missing_cols:
        errors.append(f"{name} missing required columns: {missing_cols}")
    
    # Check column types
    if column_types and not df.empty:
        for col, expected_type in column_types.items():
            if col not in df.columns:
                continue
            
            actual_type = df[col].dtype
            type_ok = True
            
            if expected_type == int:
                type_ok = pd.api.types.is_integer_dtype(actual_type)
            elif expected_type == float:
                type_ok = pd.api.types.is_float_dtype(actual_type) or pd.api.types.is_integer_dtype(actual_type)
            elif expected_type == str:
                type_ok = pd.api.types.is_string_dtype(actual_type) or pd.api.types.is_object_dtype(actual_type)
            elif expected_type == bool:
                type_ok = pd.api.types.is_bool_dtype(actual_type)
            
            if not type_ok:
                errors.append(
                    f"{name} column '{col}' has wrong type: expected {expected_type.__name__}, got {actual_type}"
                )
    
    return len(errors) == 0, errors


def validate_input_files(input_folder: str) -> Tuple[bool, List[str]]:
    """
    Validate all required input files exist and have correct format.
    
    Args:
        input_folder: Path to input folder
        
    Returns:
        Tuple of (all_valid, error_messages)
    """
    errors = []
    required_files = [
        "data_legs.csv",
        "data_test.csv",
        "data_fte.csv",
        "data_equipment.csv",
        "data_test_duts.csv",
        "priority_config.json"
    ]
    
    # Check file existence
    for filename in required_files:
        filepath = os.path.join(input_folder, filename)
        if not os.path.exists(filepath):
            errors.append(f"Required file not found: {filepath}")
    
    if errors:
        return False, errors
    
    # Validate CSV files
    csv_files = {
        "data_legs.csv": {
            "columns": ["project_id", "project_name", "project_leg_id", "leg_number", 
                       "leg_name", "priority", "start_iso_week"],
            "types": {"priority": int}
        },
        "data_test.csv": {
            "columns": ["test_id", "project_leg_id", "sequence_index", "test", 
                       "test_description", "duration_days", "fte_required", 
                       "equipment_required", "fte_assigned", "equipment_assigned"],
            "types": {
                "sequence_index": int,
                "duration_days": float,
                "fte_required": int,
                "equipment_required": int
            }
        },
        "data_fte.csv": {
            "columns": ["fte_id", "available_start_week_iso", "available_end_week_iso"],
            "types": {}
        },
        "data_equipment.csv": {
            "columns": ["equipment_id", "available_start_week_iso", "available_end_week_iso"],
            "types": {}
        },
        "data_test_duts.csv": {
            "columns": ["test_id", "dut_id"],
            "types": {"dut_id": int}
        }
    }
    
    for filename, config in csv_files.items():
        filepath = os.path.join(input_folder, filename)
        try:
            df = pd.read_csv(filepath)
            valid, file_errors = validate_dataframe(
                df, filename, config["columns"], config["types"]
            )
            if not valid:
                errors.extend(file_errors)
        except Exception as e:
            errors.append(f"Error reading {filename}: {str(e)}")
    
    return len(errors) == 0, errors


def validate_iso_week_format(iso_week: str) -> bool:
    """Validate ISO week format (YYYY-W##)."""
    if not iso_week or iso_week == "*":
        return True
    
    try:
        parts = iso_week.split("-W")
        if len(parts) != 2:
            return False
        
        year = int(parts[0])
        week = int(parts[1])
        
        return 1900 <= year <= 2100 and 1 <= week <= 53
    except (ValueError, IndexError):
        return False


def validate_referential_integrity(data: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """
    Validate referential integrity between data structures.
    
    Args:
        data: PlanningData object with all loaded data
        
    Returns:
        Tuple of (is_valid, error_messages)
    """
    errors = []
    
    # Check that all tests reference valid legs
    leg_ids = set(data["legs"].keys())
    for test in data["tests"]:
        if test.project_leg_id not in leg_ids:
            errors.append(f"Test {test.test_id} references unknown leg {test.project_leg_id}")
    
    # Check test sequence indices are continuous within each leg
    leg_tests = {}
    for test in data["tests"]:
        if test.project_leg_id not in leg_tests:
            leg_tests[test.project_leg_id] = []
        leg_tests[test.project_leg_id].append(test)
    
    for leg_id, tests in leg_tests.items():
        sequences = sorted([t.sequence_index for t in tests])
        expected = list(range(1, len(sequences) + 1))
        if sequences != expected:
            errors.append(f"Leg {leg_id} has non-continuous sequence indices: {sequences}")
    
    return len(errors) == 0, errors