"""
Debug utilities for the planner system.

This module provides comprehensive debugging tools for the planner system, including:
- Configurable logging with multiple levels
- Data inspection utilities
- Performance monitoring
- Solver diagnostics
- Configuration management
"""

import os
import sys
import time
import json
import logging
import inspect
import functools
import traceback
from datetime import datetime
from typing import Any, Dict, List, Optional, Callable, Union, Tuple
import pandas as pd
import numpy as np
from contextlib import contextmanager

# Configure logging
DEFAULT_LOG_LEVEL = logging.INFO
LOG_FORMAT = '%(asctime)s [%(levelname)s] %(name)s - %(message)s'
DATE_FORMAT = '%Y-%m-%d %H:%M:%S'

# Global debug configuration
DEBUG_CONFIG = {
    'enabled': True,
    'log_level': DEFAULT_LOG_LEVEL,
    'log_to_file': True,
    'log_to_console': True,
    'log_dir': 'logs',
    'log_file': 'planner_debug.log',
    'performance_tracking': True,
    'data_validation': True,
    'solver_diagnostics': True,
    'visualization': False,
}

# Initialize logger
logger = logging.getLogger('planner')


def configure_logging(
    level: int = None,
    log_to_file: bool = None,
    log_to_console: bool = None,
    log_dir: str = None,
    log_file: str = None,
) -> None:
    """
    Configure the logging system.
    
    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_to_file: Whether to log to a file
        log_to_console: Whether to log to console
        log_dir: Directory for log files
        log_file: Name of the log file
    """
    # Update config with provided values
    if level is not None:
        DEBUG_CONFIG['log_level'] = level
    if log_to_file is not None:
        DEBUG_CONFIG['log_to_file'] = log_to_file
    if log_to_console is not None:
        DEBUG_CONFIG['log_to_console'] = log_to_console
    if log_dir is not None:
        DEBUG_CONFIG['log_dir'] = log_dir
    if log_file is not None:
        DEBUG_CONFIG['log_file'] = log_file
    
    # Clear existing handlers
    logger.handlers = []
    logger.setLevel(DEBUG_CONFIG['log_level'])
    
    formatter = logging.Formatter(LOG_FORMAT, DATE_FORMAT)
    
    # Console handler
    if DEBUG_CONFIG['log_to_console']:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)
    
    # File handler
    if DEBUG_CONFIG['log_to_file']:
        os.makedirs(DEBUG_CONFIG['log_dir'], exist_ok=True)
        log_path = os.path.join(DEBUG_CONFIG['log_dir'], DEBUG_CONFIG['log_file'])
        file_handler = logging.FileHandler(log_path)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    logger.info(f"Logging configured: level={logging.getLevelName(DEBUG_CONFIG['log_level'])}")


def set_debug_options(**kwargs) -> None:
    """
    Update debug configuration options.
    
    Args:
        **kwargs: Configuration options to update
    """
    for key, value in kwargs.items():
        if key in DEBUG_CONFIG:
            DEBUG_CONFIG[key] = value
            logger.debug(f"Updated debug config: {key}={value}")
        else:
            logger.warning(f"Unknown debug config option: {key}")
    
    # Reconfigure logging if related options changed
    if any(k in kwargs for k in ['log_level', 'log_to_file', 'log_to_console', 'log_dir', 'log_file']):
        configure_logging()


# Logging utilities with context
def log_with_context(level: int, message: str, context: Dict[str, Any] = None) -> None:
    """
    Log a message with additional context information.
    
    Args:
        level: Log level
        message: Log message
        context: Additional context information
    """
    if not logger.isEnabledFor(level):
        return
    
    # Get caller information
    frame = inspect.currentframe().f_back
    func_name = frame.f_code.co_name
    filename = os.path.basename(frame.f_code.co_filename)
    lineno = frame.f_lineno
    
    context_str = ""
    if context:
        context_str = " - " + ", ".join(f"{k}={v}" for k, v in context.items())
    
    logger.log(level, f"{filename}:{func_name}:{lineno} - {message}{context_str}")


def debug(message: str, context: Dict[str, Any] = None) -> None:
    """Log a debug message with context."""
    log_with_context(logging.DEBUG, message, context)


def info(message: str, context: Dict[str, Any] = None) -> None:
    """Log an info message with context."""
    log_with_context(logging.INFO, message, context)


def warning(message: str, context: Dict[str, Any] = None) -> None:
    """Log a warning message with context."""
    log_with_context(logging.WARNING, message, context)


def error(message: str, context: Dict[str, Any] = None) -> None:
    """Log an error message with context."""
    log_with_context(logging.ERROR, message, context)


def critical(message: str, context: Dict[str, Any] = None) -> None:
    """Log a critical message with context."""
    log_with_context(logging.CRITICAL, message, context)


def exception(message: str, context: Dict[str, Any] = None) -> None:
    """Log an exception with context."""
    if not logger.isEnabledFor(logging.ERROR):
        return
    
    # Get caller information
    frame = inspect.currentframe().f_back
    func_name = frame.f_code.co_name
    filename = os.path.basename(frame.f_code.co_filename)
    lineno = frame.f_lineno
    
    context_str = ""
    if context:
        context_str = " - " + ", ".join(f"{k}={v}" for k, v in context.items())
    
    logger.exception(f"{filename}:{func_name}:{lineno} - {message}{context_str}")


# Performance monitoring
@contextmanager
def timer(name: str = None, log_level: int = logging.DEBUG) -> None:
    """
    Context manager for timing code blocks.
    
    Args:
        name: Name of the operation being timed
        log_level: Log level for the timing information
    """
    if not DEBUG_CONFIG['performance_tracking']:
        yield
        return
    
    start_time = time.time()
    try:
        yield
    finally:
        elapsed = time.time() - start_time
        
        # Get caller information
        frame = inspect.currentframe().f_back
        func_name = frame.f_code.co_name
        filename = os.path.basename(frame.f_code.co_filename)
        lineno = frame.f_lineno
        
        operation = name or f"{func_name} at {filename}:{lineno}"
        logger.log(log_level, f"TIMER: {operation} completed in {elapsed:.4f} seconds")


def timeit(func: Callable) -> Callable:
    """
    Decorator to time function execution.
    
    Args:
        func: Function to time
    
    Returns:
        Wrapped function with timing
    """
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        if not DEBUG_CONFIG['performance_tracking']:
            return func(*args, **kwargs)
        
        start_time = time.time()
        try:
            result = func(*args, **kwargs)
            return result
        finally:
            elapsed = time.time() - start_time
            logger.debug(f"TIMER: {func.__name__} completed in {elapsed:.4f} seconds")
    
    return wrapper


# Data inspection utilities
def inspect_data(data: Any, name: str = "data", max_items: int = 5) -> None:
    """
    Inspect and log information about a data structure.
    
    Args:
        data: Data to inspect
        name: Name of the data structure
        max_items: Maximum number of items to show for collections
    """
    if isinstance(data, pd.DataFrame):
        info(f"{name} is a DataFrame: {data.shape[0]} rows x {data.shape[1]} columns")
        if not data.empty and data.shape[0] > 0:
            debug(f"{name} first {min(max_items, data.shape[0])} rows:\n{data.head(max_items)}")
            debug(f"{name} column types:\n{data.dtypes}")
            debug(f"{name} summary:\n{data.describe().to_string()}")
    elif isinstance(data, pd.Series):
        info(f"{name} is a Series: {len(data)} items")
        if not data.empty:
            debug(f"{name} first {min(max_items, len(data))} items:\n{data.head(max_items)}")
            debug(f"{name} summary:\n{data.describe().to_string()}")
    elif isinstance(data, (list, tuple)):
        info(f"{name} is a {type(data).__name__}: {len(data)} items")
        if data:
            sample = data[:max_items]
            debug(f"{name} first {len(sample)} items: {sample}")
    elif isinstance(data, dict):
        info(f"{name} is a dict: {len(data)} keys")
        if data:
            sample_keys = list(data.keys())[:max_items]
            sample = {k: data[k] for k in sample_keys}
            debug(f"{name} first {len(sample)} items: {sample}")
    elif isinstance(data, (int, float, str, bool)):
        info(f"{name} = {data} ({type(data).__name__})")
    else:
        info(f"{name} is a {type(data).__name__}")
        try:
            debug(f"{name} representation: {data}")
        except Exception:
            debug(f"{name} cannot be represented as string")


def validate_dataframe(
    df: pd.DataFrame,
    name: str,
    required_columns: List[str] = None,
    column_types: Dict[str, type] = None,
    non_empty: bool = True,
) -> bool:
    """
    Validate a DataFrame against requirements.
    
    Args:
        df: DataFrame to validate
        name: Name of the DataFrame for logging
        required_columns: List of required columns
        column_types: Expected types for columns
        non_empty: Whether the DataFrame should be non-empty
    
    Returns:
        True if validation passes, False otherwise
    """
    if not isinstance(df, pd.DataFrame):
        error(f"{name} is not a DataFrame", {"type": type(df).__name__})
        return False
    
    if non_empty and df.empty:
        error(f"{name} is empty")
        return False
    
    valid = True
    
    # Check required columns
    if required_columns:
        missing_cols = [col for col in required_columns if col not in df.columns]
        if missing_cols:
            error(f"{name} missing required columns", {"missing": missing_cols})
            valid = False
    
    # Check column types
    if column_types and not df.empty:
        for col, expected_type in column_types.items():
            if col not in df.columns:
                continue
            
            # Get actual type
            actual_type = df[col].dtype
            type_ok = True
            
            # Check if types are compatible
            if expected_type == int:
                type_ok = pd.api.types.is_integer_dtype(actual_type)
            elif expected_type == float:
                type_ok = pd.api.types.is_float_dtype(actual_type) or pd.api.types.is_integer_dtype(actual_type)
            elif expected_type == str:
                type_ok = pd.api.types.is_string_dtype(actual_type) or pd.api.types.is_object_dtype(actual_type)
            elif expected_type == bool:
                type_ok = pd.api.types.is_bool_dtype(actual_type)
            
            if not type_ok:
                error(f"{name} column '{col}' has wrong type", {"expected": expected_type.__name__, "actual": actual_type})
                valid = False
    
    return valid


# Solver diagnostics
def log_solver_status(solver, model, status, name: str = "solver") -> None:
    """
    Log detailed information about a solver's status.
    
    Args:
        solver: OR-Tools solver
        model: CP model
        status: Solver status
        name: Name of the solver for logging
    """
    from ortools.sat.python import cp_model
    
    status_name = cp_model.CpSolverStatus.Name(status)
    info(f"{name} status: {status_name}")
    
    if status == cp_model.OPTIMAL:
        info(f"{name} found optimal solution")
    elif status == cp_model.FEASIBLE:
        info(f"{name} found a feasible solution")
    elif status == cp_model.INFEASIBLE:
        error(f"{name} problem is infeasible")
    elif status == cp_model.MODEL_INVALID:
        error(f"{name} model is invalid")
    elif status == cp_model.UNKNOWN:
        warning(f"{name} could not determine solution status")
    
    # Log solver statistics
    stats = {
        "objective_value": solver.ObjectiveValue() if status in [cp_model.OPTIMAL, cp_model.FEASIBLE] else None,
        "best_objective_bound": solver.BestObjectiveBound() if status in [cp_model.OPTIMAL, cp_model.FEASIBLE] else None,
        "num_conflicts": solver.NumConflicts(),
        "num_branches": solver.NumBranches(),
        "wall_time": solver.WallTime(),
    }
    
    info(f"{name} statistics", stats)


def analyze_infeasibility(model, name: str = "model") -> None:
    """
    Attempt to analyze why a model is infeasible.
    
    Args:
        model: CP model
        name: Name of the model for logging
    """
    from ortools.sat.python import cp_model
    
    warning(f"Analyzing infeasibility for {name}")
    
    # Create a relaxed model to find which constraints are causing infeasibility
    relaxed_model = cp_model.CpModel()
    
    # TODO: Implement relaxation analysis
    # This would require detailed knowledge of the model structure
    # and is complex to implement generically
    
    warning(f"Infeasibility analysis for {name} not implemented")


# File and data utilities
def save_debug_data(data: Any, filename: str, format: str = "auto") -> None:
    """
    Save data to a file for debugging purposes.
    
    Args:
        data: Data to save
        filename: Base filename (without extension)
        format: Format to save in ('json', 'csv', 'pickle', 'auto')
    """
    os.makedirs(DEBUG_CONFIG['log_dir'], exist_ok=True)
    path = os.path.join(DEBUG_CONFIG['log_dir'], filename)
    
    # Determine format if auto
    if format == "auto":
        if isinstance(data, pd.DataFrame):
            format = "csv"
        elif isinstance(data, (dict, list)):
            format = "json"
        else:
            format = "pickle"
    
    try:
        if format == "json":
            with open(f"{path}.json", 'w') as f:
                json.dump(data, f, default=str, indent=2)
        elif format == "csv" and isinstance(data, pd.DataFrame):
            data.to_csv(f"{path}.csv", index=False)
        elif format == "pickle":
            import pickle
            with open(f"{path}.pickle", 'wb') as f:
                pickle.dump(data, f)
        
        info(f"Saved debug data to {path}.{format}")
    except Exception as e:
        error(f"Failed to save debug data", {"error": str(e)})


# Initialize logging with default configuration
configure_logging()
