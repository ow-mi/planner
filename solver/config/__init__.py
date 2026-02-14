"""
Configuration module for managing settings and environment variables.

This module provides centralized configuration management with:
- Environment-specific settings
- Validation of configuration parameters
- Support for environment variables
- Type-safe configuration access

Usage:
    from planner_v4.config import load_config, AppConfig
    config = load_config(environment="development")
"""

from .settings import load_config, AppConfig
import logging

# Backward compatibility constants
DEFAULT_DEBUG_LEVEL = "INFO"
DEFAULT_INPUT_FOLDER = "input_data/gen3_pv/senario_1"
DEFAULT_OUTPUT_FOLDER = "output"
SOLVER_TIME_LIMIT_SECONDS = 300.0
NUM_SOLVER_WORKERS = 8 # Default number of parallel workers
LOG_TO_FILE = True
LOG_TO_CONSOLE = True

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

__all__ = [
    "load_config",
    "AppConfig",
    "DEFAULT_DEBUG_LEVEL",
    "DEFAULT_INPUT_FOLDER",
    "DEFAULT_OUTPUT_FOLDER",
    "SOLVER_TIME_LIMIT_SECONDS",
    "NUM_SOLVER_WORKERS",
    "LOG_TO_FILE",
    "LOG_TO_CONSOLE",
    "get_debug_level"
]
