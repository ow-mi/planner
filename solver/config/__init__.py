"""Configuration constants and helpers for solver runtime."""

import logging

# Backward compatibility constants
DEFAULT_DEBUG_LEVEL = "INFO"
DEFAULT_INPUT_FOLDER = "input_data/gen3_pv/senario_1"
DEFAULT_OUTPUT_FOLDER = "output"
SOLVER_TIME_LIMIT_SECONDS = 300.0
NUM_SOLVER_WORKERS = 8  # Default number of parallel workers
LOG_TO_FILE = True
LOG_TO_CONSOLE = True


def get_debug_level(level_str: str) -> int:
    """Convert string debug level to logging level."""
    level_map = {
        "DEBUG": logging.DEBUG,
        "INFO": logging.INFO,
        "WARNING": logging.WARNING,
        "ERROR": logging.ERROR,
        "CRITICAL": logging.CRITICAL,
    }
    return level_map.get(level_str.upper(), logging.INFO)


__all__ = [
    "DEFAULT_DEBUG_LEVEL",
    "DEFAULT_INPUT_FOLDER",
    "DEFAULT_OUTPUT_FOLDER",
    "SOLVER_TIME_LIMIT_SECONDS",
    "NUM_SOLVER_WORKERS",
    "LOG_TO_FILE",
    "LOG_TO_CONSOLE",
    "get_debug_level",
]
