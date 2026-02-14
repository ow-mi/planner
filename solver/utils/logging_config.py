"""
Logging configuration for Test Planner V3.

Provides centralized logging configuration with support for different environments
and configurable output levels.
"""

import logging
import os
import sys
from typing import Optional


def configure_logging(
    level: str = "INFO",
    log_to_file: bool = True,
    log_to_console: bool = True,
    log_dir: str = "logs",
    log_file: str = "planner.log"
) -> logging.Logger:
    """
    Configure logging for the planner application.
    
    Args:
        level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_to_file: Whether to log to file
        log_to_console: Whether to log to console
        log_dir: Directory for log files
        log_file: Name of log file
        
    Returns:
        Configured logger instance
    """
    # Create logger
    logger = logging.getLogger("planner_v3")
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))
    
    # Clear existing handlers
    logger.handlers.clear()
    
    # Create formatter
    formatter = logging.Formatter(
        '%(asctime)s [%(levelname)s] %(name)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Console handler
    if log_to_console:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)
    
    # File handler
    if log_to_file:
        os.makedirs(log_dir, exist_ok=True)
        file_handler = logging.FileHandler(os.path.join(log_dir, log_file))
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    return logger


def get_logger(name: str = "planner_v3") -> logging.Logger:
    """Get a logger instance with the specified name."""
    return logging.getLogger(name)