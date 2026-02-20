"""CLI and thin entry point for the Test Planner V4."""

import argparse
import json
import logging
import os
import sys
from datetime import datetime
from types import SimpleNamespace
from typing import Optional

from .config import (
    DEFAULT_DEBUG_LEVEL,
    DEFAULT_INPUT_FOLDER,
    SOLVER_TIME_LIMIT_SECONDS,
    get_debug_level,
    LOG_TO_FILE,
    LOG_TO_CONSOLE,
)
from .config.priority_modes import (
    BasePriorityConfig,
    PriorityMode,
    create_priority_config,
    load_priority_config_from_dict,
)
from .data_loader import load_data
from .model_builder import build_model
from .orchestrator import run_planning_pipeline
from .reports.csv_reports import (
    generate_concurrency_timeseries_csv,
    generate_equipment_usage_csv,
    generate_fte_usage_csv,
    generate_resource_utilization_csv,
    generate_schedule_csv,
)
from .reports.plot_reports import generate_solution_artifacts
from .solver import solve_model


def setup_logging(debug_level: str, output_folder: str) -> None:
    """Configure global logging handlers."""
    log_level = get_debug_level(debug_level)

    # Create formatters
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
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
        log_file = os.path.join(
            log_dir, f"planner_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
        )

        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(log_level)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

        print(f"Logging to file: {log_file}")


def main(
    input_folder: str = None,
    debug_level: str = None,
    time_limit: float = None,
    output_folder: str = None,
    priority_config: BasePriorityConfig = None,
    progress_callback=None,
) -> object:
    """Backward-compatible planning entry point."""
    if input_folder is None:
        input_folder = DEFAULT_INPUT_FOLDER
    if debug_level is None:
        debug_level = DEFAULT_DEBUG_LEVEL
    if time_limit is None:
        time_limit = SOLVER_TIME_LIMIT_SECONDS
    if output_folder is None:
        output_folder = os.path.join(input_folder, "output")

    return run_planning_pipeline(
        input_folder=input_folder,
        output_folder=output_folder,
        time_limit=time_limit,
        priority_config=priority_config,
        setup_logging_fn=setup_logging,
        debug_level=debug_level,
        load_data_fn=load_data,
        build_model_fn=build_model,
        solve_model_fn=solve_model,
        generate_solution_artifacts_fn=generate_solution_artifacts,
        generate_schedule_csv_fn=generate_schedule_csv,
        generate_resource_utilization_csv_fn=generate_resource_utilization_csv,
        generate_fte_usage_csv_fn=generate_fte_usage_csv,
        generate_equipment_usage_csv_fn=generate_equipment_usage_csv,
        generate_concurrency_timeseries_csv_fn=generate_concurrency_timeseries_csv,
        progress_callback=progress_callback,
    )


def load_priority_config_from_file(
    config_path: str, config_source: Optional[str] = None
) -> BasePriorityConfig:
    """Load priority configuration from JSON or YAML file."""
    logger = logging.getLogger(__name__)
    logger.info(f"Attempting to load priority config from: {config_path}")

    # Determine file type from extension
    _, ext = os.path.splitext(config_path.lower())
    use_yaml = ext in [".yaml", ".yml"]

    try:
        with open(config_path, "r") as f:
            if use_yaml:
                try:
                    import yaml

                    config_dict = yaml.safe_load(f)
                    logger.info("Loaded priority config from YAML file")
                except ImportError:
                    raise ImportError(
                        "PyYAML is required to load YAML config files. Install with: pip install pyyaml"
                    )
            else:
                config_dict = json.load(f)
                logger.info("Loaded priority config from JSON file")

        config = load_priority_config_from_dict(
            config_dict, config_source=config_source
        )
        logger.info(f"Successfully loaded priority config: mode={config.mode.value}")

        # Log key parameters based on mode
        if hasattr(config, "bottleneck_threshold"):
            logger.info(f"  - Bottleneck threshold: {config.bottleneck_threshold}")
            logger.info(
                f"  - Resource balance weight: {config.resource_balance_weight}"
            )
            logger.info(f"  - Utilization target: {config.utilization_target}")
        elif hasattr(config, "target_completion_date"):
            logger.info(f"  - Target completion date: {config.target_completion_date}")
        elif hasattr(config, "leg_deadlines"):
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
    """Command line interface for the planner."""
    parser = _build_parser()
    args = parser.parse_args()

    priority_config = _resolve_priority_config(args)

    main(
        input_folder=args.input_folder,
        debug_level=args.debug_level,
        time_limit=args.time_limit,
        output_folder=args.output_folder,
        priority_config=priority_config,
    )


def _build_parser() -> argparse.ArgumentParser:
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
        """,
    )

    parser.add_argument(
        "--input-folder",
        "-i",
        type=str,
        default=DEFAULT_INPUT_FOLDER,
        help=f"Path to input data folder (default: {DEFAULT_INPUT_FOLDER})",
    )

    parser.add_argument(
        "--debug-level",
        "-d",
        type=str,
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        default=DEFAULT_DEBUG_LEVEL,
        help=f"Logging level (default: {DEFAULT_DEBUG_LEVEL})",
    )

    parser.add_argument(
        "--time-limit",
        "-t",
        type=float,
        default=SOLVER_TIME_LIMIT_SECONDS,
        help=f"Solver time limit in seconds (default: {SOLVER_TIME_LIMIT_SECONDS})",
    )

    parser.add_argument(
        "--output-folder",
        "-o",
        type=str,
        default=None,
        help="Output folder path (default: <input-folder>/output)",
    )

    parser.add_argument(
        "--priority-mode",
        "-p",
        type=str,
        choices=[mode.value for mode in PriorityMode],
        default=None,
        help="Priority optimization mode (default: end_date_priority)",
    )

    parser.add_argument(
        "--priority-config",
        "-c",
        type=str,
        default=None,
        help="Path to priority configuration JSON file",
    )

    return parser


def _resolve_priority_config(args: SimpleNamespace) -> Optional[BasePriorityConfig]:
    logger = logging.getLogger(__name__)
    priority_config = None
    config_source = "default"

    if args.priority_config:
        config_source = f"explicit file: {args.priority_config}"
        priority_config = load_priority_config_from_file(
            args.priority_config, config_source=config_source
        )
    elif args.priority_mode:
        mode_map = {mode.value: mode for mode in PriorityMode}
        mode = mode_map[args.priority_mode]
        config_source = f"CLI mode: {args.priority_mode}"
        priority_config = create_priority_config(mode, config_source=config_source)
    else:
        yaml_config_path = os.path.join(args.input_folder, "priority_config.yaml")
        json_config_path = os.path.join(args.input_folder, "priority_config.json")

        auto_config_path = None
        if os.path.exists(yaml_config_path):
            auto_config_path = yaml_config_path
        elif os.path.exists(json_config_path):
            auto_config_path = json_config_path

        if auto_config_path:
            try:
                config_source = f"auto-detected: {auto_config_path}"
                priority_config = load_priority_config_from_file(
                    auto_config_path, config_source=config_source
                )
            except Exception as exc:
                logger.warning(
                    f"Failed to load auto-detected config {auto_config_path}: {exc}"
                )
                logger.info("Falling back to default priority mode: end_date_priority")
        else:
            logger.info(
                "No priority_config.yaml or priority_config.json found in input folder: "
                f"{args.input_folder}"
            )
            logger.info("Using default priority mode: end_date_priority")

    return priority_config


if __name__ == "__main__":
    cli()
