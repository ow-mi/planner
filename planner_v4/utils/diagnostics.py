"""
Diagnostic utilities for Test Planner V3.

Provides solver diagnostics and debugging utilities for troubleshooting.
"""

import json
import os
import pickle
from typing import Any, Dict, Optional
import logging
import pandas as pd

try:
    from ortools.sat.python import cp_model
    OR_TOOLS_AVAILABLE = True
except ImportError:
    OR_TOOLS_AVAILABLE = False

logger = logging.getLogger(__name__)


def log_solver_status(solver, model, status: int, name: str = "solver") -> None:
    """
    Log detailed information about a solver's status.
    
    Args:
        solver: OR-Tools solver
        model: CP model
        status: Solver status
        name: Name of the solver for logging
    """
    if not OR_TOOLS_AVAILABLE:
        logger.warning("OR-Tools not available for solver diagnostics")
        return
    
    status_name = cp_model.CpSolverStatus.Name(status)
    logger.info(f"{name} status: {status_name}")
    
    if status == cp_model.OPTIMAL:
        logger.info(f"{name} found optimal solution")
    elif status == cp_model.FEASIBLE:
        logger.info(f"{name} found a feasible solution")
    elif status == cp_model.INFEASIBLE:
        logger.error(f"{name} problem is infeasible")
    elif status == cp_model.MODEL_INVALID:
        logger.error(f"{name} model is invalid")
    elif status == cp_model.UNKNOWN:
        logger.warning(f"{name} could not determine solution status")
    
    # Log solver statistics
    stats = {
        "objective_value": solver.ObjectiveValue() if status in [cp_model.OPTIMAL, cp_model.FEASIBLE] else None,
        "best_objective_bound": solver.BestObjectiveBound() if status in [cp_model.OPTIMAL, cp_model.FEASIBLE] else None,
        "num_conflicts": solver.NumConflicts(),
        "num_branches": solver.NumBranches(),
        "wall_time": solver.WallTime(),
    }
    
    logger.info(f"{name} statistics", extra=stats)


def save_debug_data(
    data: Any, 
    filename: str, 
    output_dir: str = "debug_output",
    format: str = "auto"
) -> str:
    """
    Save data to a file for debugging purposes.
    
    Args:
        data: Data to save
        filename: Base filename (without extension)
        output_dir: Directory to save files
        format: Format to save in ('json', 'csv', 'pickle', 'auto')
        
    Returns:
        Path to saved file
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # Determine format if auto
    if format == "auto":
        if isinstance(data, pd.DataFrame):
            format = "csv"
        elif isinstance(data, (dict, list)):
            format = "json"
        else:
            format = "pickle"
    
    filepath = os.path.join(output_dir, f"{filename}.{format}")
    
    try:
        if format == "json":
            with open(filepath, 'w') as f:
                json.dump(data, f, default=str, indent=2)
        elif format == "csv" and isinstance(data, pd.DataFrame):
            data.to_csv(filepath, index=False)
        elif format == "pickle":
            with open(filepath, 'wb') as f:
                pickle.dump(data, f)
        else:
            raise ValueError(f"Unsupported format: {format}")
        
        logger.info(f"Saved debug data to {filepath}")
        return filepath
    except Exception as e:
        logger.error(f"Failed to save debug data: {str(e)}")
        raise


def analyze_model_size(model) -> Dict[str, int]:
    """
    Analyze the size and complexity of a CP model.
    
    Args:
        model: CP model to analyze
        
    Returns:
        Dictionary with model statistics
    """
    if not OR_TOOLS_AVAILABLE:
        return {"error": "OR-Tools not available"}
    
    try:
        stats = {
            "num_variables": model.NumVariables(),
            "num_constraints": model.NumConstraints(),
            "num_integer_variables": sum(1 for v in model.variables() if v.Integer()),
            "num_bool_variables": sum(1 for v in model.variables() if v.Bool()),
        }
        return stats
    except Exception as e:
        logger.error(f"Error analyzing model: {str(e)}")
        return {"error": str(e)}


def create_debug_package(
    data: Dict[str, Any],
    model_stats: Dict[str, Any],
    solution: Any,
    output_dir: str = "debug_package"
) -> str:
    """
    Create a comprehensive debug package with all relevant data.
    
    Args:
        data: Input data
        model_stats: Model statistics
        solution: Solution object
        output_dir: Directory for debug package
        
    Returns:
        Path to debug package directory
    """
    import shutil
    import zipfile
    from datetime import datetime
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    package_dir = os.path.join(output_dir, f"debug_{timestamp}")
    os.makedirs(package_dir, exist_ok=True)
    
    # Save input data
    save_debug_data(data, "input_data", package_dir, "json")
    
    # Save model statistics
    save_debug_data(model_stats, "model_stats", package_dir, "json")
    
    # Save solution
    if solution:
        save_debug_data(solution, "solution", package_dir, "json")
    
    # Create zip package
    zip_path = f"{package_dir}.zip"
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(package_dir):
            for file in files:
                filepath = os.path.join(root, file)
                arcname = os.path.relpath(filepath, package_dir)
                zipf.write(filepath, arcname)
    
    # Clean up directory
    shutil.rmtree(package_dir)
    
    logger.info(f"Created debug package: {zip_path}")
    return zip_path