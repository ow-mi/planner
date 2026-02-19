"""
Utilities module for shared functions and helpers.

This module provides common utilities used across the planner system:
- Logging configuration and management
- Data validation and inspection tools
- Diagnostic utilities for debugging and troubleshooting
- Model analysis and debug data saving

Usage:
    from planner_v4.utils import configure_logging, validate_dataframe
    configure_logging(level="INFO")
    validate_dataframe(df, "my_data")
"""

from .logging_config import configure_logging, get_logger
from .data_validation import (
    validate_dataframe,
    validate_input_files,
    validate_iso_week_format,
)
from .diagnostics import log_solver_status, save_debug_data, analyze_model_size
from .week_utils import WEEK_VALUE_RE, normalize_week_value, parse_iso_week

__all__ = [
    "configure_logging",
    "get_logger",
    "validate_dataframe",
    "validate_input_files",
    "validate_iso_week_format",
    "log_solver_status",
    "save_debug_data",
    "analyze_model_size",
    "WEEK_VALUE_RE",
    "normalize_week_value",
    "parse_iso_week",
]
