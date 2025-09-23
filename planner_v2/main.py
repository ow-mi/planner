# planner_v2/main.py

"""
Main entry point for the Test Planner V2.
Orchestrates the complete planning process from data loading to report generation.
"""

import argparse
import os
import sys
import logging
from datetime import datetime

from .config import (
    DEFAULT_DEBUG_LEVEL, DEFAULT_INPUT_FOLDER, DEFAULT_OUTPUT_FOLDER,
    SOLVER_TIME_LIMIT_SECONDS, get_debug_level, LOG_TO_FILE, LOG_TO_CONSOLE
)
from .data_loader import load_data
from .model_builder import build_model
from .solver import solve_model
from .reporter import generate_reports


def setup_logging(debug_level: str, output_folder: str):
    """Configure logging for the planner."""
    log_level = get_debug_level(debug_level)
    
    # Create formatters
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Setup root logger
    logger = logging.getLogger()
    logger.setLevel(log_level)
    
    # Clear any existing handlers
    logger.handlers.clear()
    
    # Console handler
    if LOG_TO_CONSOLE:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(log_level)
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)
    
    # File handler
    if LOG_TO_FILE:
        log_dir = os.path.join(output_folder, "logs")
        os.makedirs(log_dir, exist_ok=True)
        log_file = os.path.join(log_dir, f"planner_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log")
        
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(log_level)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
        
        print(f"Logging to file: {log_file}")


def main(input_folder: str = None, debug_level: str = None, 
         time_limit: float = None, output_folder: str = None):
    """
    Main orchestration function for the Test Planner V2.
    
    Args:
        input_folder: Path to input data folder
        debug_level: Logging level (DEBUG, INFO, WARNING, ERROR)
        time_limit: Solver time limit in seconds
        output_folder: Path to output folder
    """
    # Set defaults
    if input_folder is None:
        input_folder = DEFAULT_INPUT_FOLDER
    if debug_level is None:
        debug_level = DEFAULT_DEBUG_LEVEL
    if time_limit is None:
        time_limit = SOLVER_TIME_LIMIT_SECONDS
    if output_folder is None:
        output_folder = os.path.join(input_folder, "output")
    
    # Create output directories
    os.makedirs(output_folder, exist_ok=True)
    data_dir = os.path.join(output_folder, "data")
    plots_dir = os.path.join(output_folder, "plots")
    os.makedirs(data_dir, exist_ok=True)
    os.makedirs(plots_dir, exist_ok=True)
    
    # Setup logging
    setup_logging(debug_level, output_folder)
    logger = logging.getLogger(__name__)
    
    logger.info("=" * 60)
    logger.info("Test Planner V2 - Starting")
    logger.info("=" * 60)
    logger.info(f"Input folder: {input_folder}")
    logger.info(f"Output folder: {output_folder}")
    logger.info(f"Debug level: {debug_level}")
    logger.info(f"Time limit: {time_limit} seconds")
    
    try:
        # Step 1: Load and validate data
        logger.info("Step 1: Loading and validating input data...")
        data = load_data(input_folder)
        logger.info(f"Successfully loaded:")
        logger.info(f"  - {len(data.legs)} project legs")
        logger.info(f"  - {len(data.tests)} tests")
        logger.info(f"  - {len(data.fte_windows)} FTE availability windows")
        logger.info(f"  - {len(data.equipment_windows)} equipment availability windows")
        
        # Step 2: Build optimization model
        logger.info("Step 2: Building constraint programming model...")
        model = build_model(data)
        logger.info(f"Model built with:")
        logger.info(f"  - {len(model.test_vars)} test variables")
        logger.info(f"  - {len(model.resource_assignments)} resource assignment variables")
        logger.info(f"  - Time horizon: {model.horizon} days")
        
        # Step 3: Solve the model
        logger.info("Step 3: Solving optimization problem...")
        solution, start_date = solve_model(model, data, time_limit)
        logger.info(f"Solver completed with status: {solution.status}")
        logger.info(f"Solve time: {solution.solve_time_seconds:.2f} seconds")
        
        if solution.status in ["OPTIMAL", "FEASIBLE"]:
            logger.info(f"Solution found:")
            logger.info(f"  - Makespan: {solution.makespan_days} days")
            logger.info(f"  - Tests scheduled: {len(solution.test_schedules)}")
            logger.info(f"  - Objective value: {solution.objective_value}")
        else:
            logger.warning(f"No solution found - status: {solution.status}")
        
        # Step 4: Generate reports
        logger.info("Step 4: Generating reports and visualizations...")
        generate_reports(solution, data, output_folder, start_date)
        
        logger.info("=" * 60)
        logger.info("Test Planner V2 - Completed Successfully")
        logger.info("=" * 60)
        
        return solution
        
    except Exception as e:
        logger.error(f"Error during planning process: {str(e)}", exc_info=True)
        raise


def cli():
    """Command line interface for the Test Planner V2."""
    parser = argparse.ArgumentParser(
        description="Test Planner V2 - Constraint-based test scheduling optimizer",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m planner_v2.main --input-folder input_data/gen3_pv/senario_1
  python -m planner_v2.main --input-folder input_data/gen3_pv/senario_2 --debug-level DEBUG
  python -m planner_v2.main --input-folder input_data/gen3_pv/senario_3 --time-limit 600
        """
    )
    
    parser.add_argument(
        "--input-folder", "-i",
        type=str,
        default=DEFAULT_INPUT_FOLDER,
        help=f"Path to input data folder (default: {DEFAULT_INPUT_FOLDER})"
    )
    
    parser.add_argument(
        "--debug-level", "-d",
        type=str,
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        default=DEFAULT_DEBUG_LEVEL,
        help=f"Logging level (default: {DEFAULT_DEBUG_LEVEL})"
    )
    
    parser.add_argument(
        "--time-limit", "-t",
        type=float,
        default=SOLVER_TIME_LIMIT_SECONDS,
        help=f"Solver time limit in seconds (default: {SOLVER_TIME_LIMIT_SECONDS})"
    )
    
    parser.add_argument(
        "--output-folder", "-o",
        type=str,
        default=None,
        help="Output folder path (default: <input-folder>/output)"
    )
    
    args = parser.parse_args()
    
    # Run the main planning process
    main(
        input_folder=args.input_folder,
        debug_level=args.debug_level,
        time_limit=args.time_limit,
        output_folder=args.output_folder
    )


if __name__ == "__main__":
    cli()
