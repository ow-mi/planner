"""
Test Planner V4 - A constraint-based test scheduling optimizer.

This package provides a complete solution for optimizing test scheduling
with resource constraints, leg dependencies, and priority management.

Main components:
- main: Entry point and orchestration
- data_loader: Input data loading and validation
- model_builder: CP-SAT model construction
- solver: Optimization problem solving
- reports: Report generation and visualization
- config: Configuration management
- utils: Shared utilities and helpers

Usage:
    from planner_v4 import main
    main(input_folder="path/to/data", debug_level="INFO")
"""

__version__ = "4.0.0"
__author__ = "Test Planning Team"

from .main import main, cli

__all__ = ["main", "cli"]