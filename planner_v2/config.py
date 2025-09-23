# planner_v2/config.py

"""
Configuration settings for the Test Planner V2.
"""

import os
import logging

# Default settings
DEFAULT_DEBUG_LEVEL = "INFO"
SOLVER_TIME_LIMIT_SECONDS = 300.0  # 5 minutes default

# File paths
DEFAULT_INPUT_FOLDER = "input_data/gen3_pv/senario_1"
DEFAULT_OUTPUT_FOLDER = "output"

# Solver parameters
SOLVER_LOG_SEARCH_PROGRESS = True
SOLVER_NUM_WORKERS = 4  # Number of parallel workers for solver

# Debug settings
LOG_TO_FILE = True
LOG_TO_CONSOLE = True
LOG_FILE_NAME = "planner_debug.log"

# Validation settings
STRICT_VALIDATION = True

# Reporting settings
GENERATE_PLOTS = True
GENERATE_GANTT_CHARTS = True
PLOT_DPI = 300

# Output file names
SCHEDULE_CSV_NAME = "tests_schedule.csv"
UTILIZATION_CSV_NAME = "resource_utilization.csv"
VALIDATION_REPORT_NAME = "validation_report.csv"
SUMMARY_REPORT_NAME = "validation_summary.txt"

def get_debug_level(level_str: str) -> int:
    """Convert string debug level to logging level."""
    level_map = {
        "DEBUG": logging.DEBUG,
        "INFO": logging.INFO,
        "WARNING": logging.WARNING,
        "ERROR": logging.ERROR,
        "CRITICAL": logging.CRITICAL
    }
    return level_map.get(level_str.upper(), logging.INFO)
