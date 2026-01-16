# planner_v4/main.py

"""
Main entry point for the Test Planner V4.

This module provides the main orchestration functions for the Test Planner V4,
a constraint-based test scheduling optimizer using Google OR-Tools CP-SAT solver.

The planning process consists of four main phases:
1. Data Loading: Load and validate input data from CSV files
2. Model Building: Construct the CP-SAT optimization model with constraints
3. Solving: Execute the optimization to find optimal test scheduling
4. Reporting: Generate comprehensive CSV reports and statistics

Usage:
    # Programmatic usage
    from planner_v4 import main
    main(input_folder="input_data/gen3_pv/senario_1", debug_level="INFO")

    # Command line usage
    python -m planner_v4.main --input-folder input_data/gen3_pv/senario_1

Functions:
    main: Main orchestration function for the complete planning process
    cli: Command line interface with argument parsing
    setup_logging: Configure logging system for the application

Classes:
    None

Exceptions:
    FileNotFoundError: Raised when input files are missing
    ValueError: Raised when input data validation fails
    RuntimeError: Raised when solver fails or encounters errors
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
from .reports.csv_reports import generate_schedule_csv, generate_resource_utilization_csv, generate_fte_usage_csv, generate_equipment_usage_csv, generate_concurrency_timeseries_csv
from .config.priority_modes import BasePriorityConfig, PriorityMode, load_priority_config_from_dict


def setup_logging(debug_level: str, output_folder: str):
    """
    Configure logging system for the Test Planner.

    Sets up both console and file logging with appropriate formatting and levels.
    Creates timestamped log files in the output/logs directory for each run.

    Args:
        debug_level (str): Logging level string (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        output_folder (str): Base output folder path where logs directory will be created

    Returns:
        None

    Side Effects:
        - Creates logs directory if it doesn't exist
        - Configures global logging system
        - Prints log file path to stdout

    Example:
        setup_logging("DEBUG", "output/my_run")
        # Creates output/my_run/logs/ directory and configures logging
    """
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
         time_limit: float = None, output_folder: str = None,
         priority_config: BasePriorityConfig = None):
    """
    Main orchestration function for the Test Planner V4.

    Executes the complete test planning process from data loading through report generation.
    This function coordinates all components of the planner to produce optimized test schedules.

    The planning pipeline consists of:
    1. Logging setup and configuration validation
    2. Input data loading and validation
    3. CP-SAT optimization model construction
    4. Constraint solving with time limits
    5. Solution validation and report generation

    Args:
        input_folder (str, optional): Path to input data folder containing CSV files.
            Defaults to config.DEFAULT_INPUT_FOLDER if None.
        debug_level (str, optional): Logging verbosity level.
            Options: DEBUG, INFO, WARNING, ERROR, CRITICAL.
            Defaults to config.DEFAULT_DEBUG_LEVEL if None.
        time_limit (float, optional): Maximum solver time in seconds.
            Defaults to config.SOLVER_TIME_LIMIT_SECONDS if None.
        output_folder (str, optional): Custom output folder path.
            Defaults to <input_folder>/output if None.
        priority_config (BasePriorityConfig, optional): Priority mode configuration.
            Defaults to end date priority (pure makespan minimization) if None.

    Returns:
        dict: Solution result containing:
            - 'status': Solution status ('OPTIMAL', 'FEASIBLE', 'INFEASIBLE', 'NO_SOLUTION')
            - 'makespan': Total project duration in days (if solved)
            - 'test_schedule': List of TestSchedule objects
            - 'solver_stats': Solver performance statistics
            - 'resource_utilization': Resource usage data

    Raises:
        FileNotFoundError: When required input files are missing
        ValueError: When input data validation fails
        RuntimeError: When solver encounters critical errors
        Exception: For other unexpected errors during planning

    Example:
        Basic usage:
        >>> solution = main(input_folder="input_data/gen3_pv/senario_1")
        >>> print(f"Status: {solution['status']}")

        Advanced usage with custom settings:
        >>> solution = main(
        ...     input_folder="my_data",
        ...     debug_level="DEBUG",
        ...     time_limit=600.0,
        ...     output_folder="results/october_2024"
        ... )

    Note:
        This function is thread-safe and can be called multiple times with different
        parameters. Each call creates separate output directories and log files.
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
        if priority_config:
            logger.info(f"Using priority mode: {priority_config.mode.value}")
            logger.info(f"Priority config source: {getattr(priority_config, '_config_source', 'unknown')}")
            
            # Log key parameters based on mode
            if hasattr(priority_config, 'bottleneck_threshold'):
                logger.info(f"Resource bottleneck config:")
                logger.info(f"  - Bottleneck threshold: {priority_config.bottleneck_threshold}")
                logger.info(f"  - Resource balance weight: {priority_config.resource_balance_weight}")
                logger.info(f"  - Utilization target: {priority_config.utilization_target}")
            elif hasattr(priority_config, 'target_completion_date'):
                logger.info(f"Sticky end date config:")
                logger.info(f"  - Target completion date: {priority_config.target_completion_date}")
                logger.info(f"  - Penalty per day late: {priority_config.penalty_per_day_late}")
            elif hasattr(priority_config, 'leg_deadlines'):
                logger.info(f"Leg end dates config:")
                logger.info(f"  - Leg deadlines: {len(priority_config.leg_deadlines)} legs")
                logger.info(f"  - Deadline penalty per day: {priority_config.deadline_penalty_per_day}")
            
            logger.info(f"  - Weights: {priority_config.weights}")
        else:
            logger.info("Using default priority mode: end_date_priority")
        model = build_model(data, priority_config)
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
        if solution.status in ["OPTIMAL", "FEASIBLE"] and solution.test_schedules:
            # Generate CSV files
            generate_schedule_csv(solution, output_folder + "/data")
            generate_resource_utilization_csv(solution, output_folder + "/data")
            if start_date:
                generate_fte_usage_csv(solution, data, start_date, output_folder + "/data")
                generate_equipment_usage_csv(solution, data, start_date, output_folder + "/data")
                generate_concurrency_timeseries_csv(solution, data, start_date, output_folder + "/data")
            logger.info("All reports generated successfully!")
        else:
            logger.info(f"Generated summary for failed solution (status: {solution.status})")
        
        logger.info("=" * 60)
        logger.info("Test Planner V2 - Completed Successfully")
        logger.info("=" * 60)
        
        return solution
        
    except Exception as e:
        logger.error(f"Error during planning process: {str(e)}", exc_info=True)
        raise


def load_priority_config_from_file(config_path: str) -> BasePriorityConfig:
    """
    Load priority configuration from JSON or YAML file.

    Args:
        config_path: Path to priority configuration file (JSON or YAML)

    Returns:
        Priority configuration object

    Raises:
        FileNotFoundError: If config file doesn't exist
        ValueError: If config file is invalid
    """
    import json
    import logging
    import os
    
    logger = logging.getLogger(__name__)
    logger.info(f"Attempting to load priority config from: {config_path}")
    
    # Determine file type from extension
    _, ext = os.path.splitext(config_path.lower())
    use_yaml = ext in ['.yaml', '.yml']
    
    try:
        with open(config_path, 'r') as f:
            if use_yaml:
                try:
                    import yaml
                    config_dict = yaml.safe_load(f)
                    logger.info("Loaded priority config from YAML file")
                except ImportError:
                    raise ImportError("PyYAML is required to load YAML config files. Install with: pip install pyyaml")
            else:
                config_dict = json.load(f)
                logger.info("Loaded priority config from JSON file")
        
        config = load_priority_config_from_dict(config_dict)
        logger.info(f"Successfully loaded priority config: mode={config.mode.value}")
        
        # Log key parameters based on mode
        if hasattr(config, 'bottleneck_threshold'):
            logger.info(f"  - Bottleneck threshold: {config.bottleneck_threshold}")
            logger.info(f"  - Resource balance weight: {config.resource_balance_weight}")
            logger.info(f"  - Utilization target: {config.utilization_target}")
        elif hasattr(config, 'target_completion_date'):
            logger.info(f"  - Target completion date: {config.target_completion_date}")
        elif hasattr(config, 'leg_deadlines'):
            logger.info(f"  - Leg deadlines: {len(config.leg_deadlines)} legs")
        
        logger.info(f"  - Weights: {config.weights}")
        
        return config
    except FileNotFoundError:
        logger.warning(f"Priority config file not found: {config_path}")
        raise
    except Exception as e:
        logger.error(f"Failed to load priority config from {config_path}: {e}")
        raise ValueError(f"Failed to load priority config from {config_path}: {e}")


def cli():
    """
    Command line interface for the Test Planner V4.

    Provides a comprehensive CLI for running the test planning optimization
    with various configuration options. Supports both basic and advanced usage
    patterns with detailed help and examples.

    Usage:
        Basic usage:
            python -m planner_v4.main --input-folder input_data/gen3_pv/senario_1

        With custom settings:
            python -m planner_v4.main \
                --input-folder input_data/gen3_pv/senario_2 \
                --debug-level DEBUG \
                --time-limit 600 \
                --output-folder custom_results

        Show help:
            python -m planner_v4.main --help

    Command Line Arguments:
        --input-folder, -i (str): Path to input data folder containing CSV files
                                 Default: input_data/gen3_pv/senario_1

        --debug-level, -d (str): Logging verbosity level
                                Choices: DEBUG, INFO, WARNING, ERROR, CRITICAL
                                Default: INFO

        --time-limit, -t (float): Maximum solver time in seconds
                                 Default: 300.0

        --output-folder, -o (str): Custom output folder path
                                  Default: <input-folder>/output

    Examples:
        Standard usage:
            python -m planner_v4.main -i input_data/gen3_pv/senario_1

        Debug mode with extended time:
            python -m planner_v4.main -i my_data -d DEBUG -t 900

        Custom output location:
            python -m planner_v4.main -i input_data -o results/october_2024

    Exit Codes:
        0: Success - Planning completed successfully
        1: Error - Planning failed with error message

    Output:
        The CLI will display progress information to stdout and create detailed
        log files in the output/logs directory. All generated reports will be
        saved in the output/data directory.

    Returns:
        None: This function calls sys.exit() on completion or error

    Raises:
        SystemExit: Always called with appropriate exit code
    """
    parser = argparse.ArgumentParser(
        description="Test Planner V4 - Constraint-based test scheduling optimizer",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m planner_v4.main --input-folder input_data/gen3_pv/senario_1
  python -m planner_v4.main --input-folder input_data/gen3_pv/senario_2 --debug-level DEBUG
  python -m planner_v4.main --input-folder input_data/gen3_pv/senario_3 --time-limit 600
  python -m planner_v4.main --input-folder data/ --priority-mode leg_priority
  python -m planner_v4.main --input-folder data/ --priority-config priority_config.json
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

    parser.add_argument(
        "--priority-mode", "-p",
        type=str,
        choices=[mode.value for mode in PriorityMode],
        default=None,
        help="Priority optimization mode (default: end_date_priority)"
    )

    parser.add_argument(
        "--priority-config", "-c",
        type=str,
        default=None,
        help="Path to priority configuration JSON file"
    )
    
    args = parser.parse_args()

    # Handle priority configuration
    priority_config = None
    config_source = "default"
    
    if args.priority_config:
        # Load from explicitly specified file
        priority_config = load_priority_config_from_file(args.priority_config)
        config_source = f"explicit file: {args.priority_config}"
    elif args.priority_mode:
        # Create default config for specified mode
        mode_map = {mode.value: mode for mode in PriorityMode}
        mode = mode_map[args.priority_mode]
        from .config.priority_modes import create_priority_config
        priority_config = create_priority_config(mode)
        config_source = f"CLI mode: {args.priority_mode}"
    else:
        # Auto-detect priority_config.yaml or priority_config.json in input folder
        # Try YAML first, then JSON
        yaml_config_path = os.path.join(args.input_folder, "priority_config.yaml")
        json_config_path = os.path.join(args.input_folder, "priority_config.json")
        
        auto_config_path = None
        if os.path.exists(yaml_config_path):
            auto_config_path = yaml_config_path
        elif os.path.exists(json_config_path):
            auto_config_path = json_config_path
        
        if auto_config_path:
            try:
                priority_config = load_priority_config_from_file(auto_config_path)
                config_source = f"auto-detected: {auto_config_path}"
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Failed to load auto-detected config {auto_config_path}: {e}")
                logger.info("Falling back to default priority mode: end_date_priority")
        else:
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"No priority_config.yaml or priority_config.json found in input folder: {args.input_folder}")
            logger.info("Using default priority mode: end_date_priority")

    # Add config source to priority_config for logging
    if priority_config:
        priority_config._config_source = config_source
    
    # Run the main planning process
    main(
        input_folder=args.input_folder,
        debug_level=args.debug_level,
        time_limit=args.time_limit,
        output_folder=args.output_folder,
        priority_config=priority_config
    )


if __name__ == "__main__":
    cli()
