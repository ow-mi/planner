"""
Unified configuration system for Test Planner V3.

Provides environment-specific configuration with validation and type safety.
"""

import os
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
import json
from .priority_modes import BasePriorityConfig, PriorityMode

# Required input files for the solver
REQUIRED_INPUT_FILES = [
    "data_legs.csv",
    "data_test.csv",
    "data_fte.csv",
    "data_equipment.csv",
    "data_test_duts.csv",
    "priority_config.json",
]


@dataclass
class SolverConfig:
    """Configuration for the CP-SAT solver."""

    time_limit_seconds: float = 300.0
    num_workers: int = 4
    log_search_progress: bool = True


@dataclass
class LoggingConfig:
    """Configuration for logging."""

    level: str = "INFO"
    log_to_file: bool = True
    log_to_console: bool = True
    log_dir: str = "logs"
    log_file: str = "planner.log"


@dataclass
class InputConfig:
    """Configuration for input data."""

    input_folder: str = "input_data/gen3_pv/senario_1"
    output_folder: str = "output"
    required_files: list = field(
        default_factory=lambda: [
            "data_legs.csv",
            "data_test.csv",
            "data_fte.csv",
            "data_equipment.csv",
            "data_test_duts.csv",
            "priority_config.json",
        ]
    )


@dataclass
class ValidationConfig:
    """Configuration for data validation."""

    strict_validation: bool = True
    validate_referential_integrity: bool = True
    validate_temporal_consistency: bool = True


@dataclass
class ReportingConfig:
    """Configuration for report generation."""

    generate_plots: bool = True
    generate_gantt_charts: bool = True
    plot_dpi: int = 300
    output_formats: list = field(default_factory=lambda: ["csv", "png", "txt"])


@dataclass
class PriorityConfig:
    """Configuration for priority modes."""

    mode: PriorityMode = PriorityMode.END_DATE_PRIORITY
    config_file: Optional[str] = None  # Path to priority config JSON file
    priority_config: Optional[BasePriorityConfig] = None  # Loaded config object


@dataclass
class ForcedStartConflict:
    """Represents a conflict between tests with forced start days."""

    day: int
    test_ids: List[str]
    message: str


@dataclass
class AppConfig:
    """Main application configuration."""

    solver: SolverConfig = field(default_factory=SolverConfig)
    logging: LoggingConfig = field(default_factory=LoggingConfig)
    input: InputConfig = field(default_factory=InputConfig)
    validation: ValidationConfig = field(default_factory=ValidationConfig)
    reporting: ReportingConfig = field(default_factory=ReportingConfig)
    priority: PriorityConfig = field(default_factory=PriorityConfig)

    @classmethod
    def from_file(cls, config_path: str) -> "AppConfig":
        """Load configuration from JSON file."""
        if not os.path.exists(config_path):
            return cls()

        with open(config_path, "r") as f:
            config_data = json.load(f)

        return cls.from_dict(config_data)

    @classmethod
    def from_dict(cls, config_dict: Dict[str, Any]) -> "AppConfig":
        """Create configuration from dictionary."""
        config = cls()

        if "solver" in config_dict:
            config.solver = SolverConfig(**config_dict["solver"])
        if "logging" in config_dict:
            config.logging = LoggingConfig(**config_dict["logging"])
        if "input" in config_dict:
            config.input = InputConfig(**config_dict["input"])
        if "validation" in config_dict:
            config.validation = ValidationConfig(**config_dict["validation"])
        if "reporting" in config_dict:
            config.reporting = ReportingConfig(**config_dict["reporting"])

        if "priority" in config_dict:
            priority_dict = config_dict["priority"]
            if "mode" in priority_dict:
                priority_dict["mode"] = PriorityMode(priority_dict["mode"])
            config.priority = PriorityConfig(**priority_dict)

        return config

    def to_file(self, config_path: str) -> None:
        """Save configuration to JSON file."""
        os.makedirs(os.path.dirname(config_path), exist_ok=True)

        with open(config_path, "w") as f:
            json.dump(self.to_dict(), f, indent=2)

    def to_dict(self) -> Dict[str, Any]:
        """Convert configuration to dictionary."""
        return {
            "solver": {
                "time_limit_seconds": self.solver.time_limit_seconds,
                "num_workers": self.solver.num_workers,
                "log_search_progress": self.solver.log_search_progress,
            },
            "logging": {
                "level": self.logging.level,
                "log_to_file": self.logging.log_to_file,
                "log_to_console": self.logging.log_to_console,
                "log_dir": self.logging.log_dir,
                "log_file": self.logging.log_file,
            },
            "input": {
                "input_folder": self.input.input_folder,
                "output_folder": self.input.output_folder,
                "required_files": self.input.required_files,
            },
            "validation": {
                "strict_validation": self.validation.strict_validation,
                "validate_referential_integrity": self.validation.validate_referential_integrity,
                "validate_temporal_consistency": self.validation.validate_temporal_consistency,
            },
            "reporting": {
                "generate_plots": self.reporting.generate_plots,
                "generate_gantt_charts": self.reporting.generate_gantt_charts,
                "plot_dpi": self.reporting.plot_dpi,
                "output_formats": self.reporting.output_formats,
            },
            "priority": {
                "mode": self.priority.mode.value,
                "config_file": self.priority.config_file,
            },
        }

    def validate(self) -> tuple[bool, list[str]]:
        """Validate configuration values."""
        errors = []

        # Validate solver config
        if self.solver.time_limit_seconds <= 0:
            errors.append("Solver time limit must be positive")
        if self.solver.num_workers <= 0:
            errors.append("Number of solver workers must be positive")

        # Validate logging config
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if self.logging.level not in valid_levels:
            errors.append(f"Invalid logging level: {self.logging.level}")

        # Validate input config
        if not os.path.exists(self.input.input_folder):
            errors.append(f"Input folder does not exist: {self.input.input_folder}")

        # Validate reporting config
        if self.reporting.plot_dpi <= 0:
            errors.append("Plot DPI must be positive")

        # Validate priority config
        if self.priority.config_file and not os.path.exists(self.priority.config_file):
            errors.append(
                f"Priority config file does not exist: {self.priority.config_file}"
            )

        return len(errors) == 0, errors


def load_config(
    config_path: Optional[str] = None, environment: str = "development"
) -> AppConfig:
    """
    Load configuration with environment-specific overrides.

    Args:
        config_path: Path to configuration file
        environment: Environment name (development, testing, production)

    Returns:
        Loaded and validated configuration
    """
    # Load base configuration
    if config_path and os.path.exists(config_path):
        config = AppConfig.from_file(config_path)
    else:
        config = AppConfig()

    # Apply environment-specific overrides
    env_overrides = {
        "development": {
            "logging": {"level": "DEBUG", "log_to_console": True},
            "solver": {"time_limit_seconds": 60.0},
        },
        "testing": {
            "logging": {"level": "INFO", "log_to_file": False},
            "solver": {"time_limit_seconds": 30.0},
        },
        "production": {
            "logging": {"level": "WARNING", "log_to_console": False},
            "solver": {"time_limit_seconds": 600.0, "num_workers": 8},
        },
    }

    if environment in env_overrides:
        overrides = env_overrides[environment]
        for section, values in overrides.items():
            section_config = getattr(config, section)
            for key, value in values.items():
                setattr(section_config, key, value)

    # Load priority configuration if specified
    if config.priority.config_file:
        from .priority_modes import load_priority_config_from_dict
        import json
        import os

        try:
            # Determine file type from extension
            _, ext = os.path.splitext(config.priority.config_file.lower())
            use_yaml = ext in [".yaml", ".yml"]

            with open(config.priority.config_file, "r") as f:
                if use_yaml:
                    try:
                        import yaml

                        priority_dict = yaml.safe_load(f)
                    except ImportError:
                        raise ImportError(
                            "PyYAML is required to load YAML config files. Install with: pip install pyyaml"
                        )
                else:
                    priority_dict = json.load(f)
            config.priority.priority_config = load_priority_config_from_dict(
                priority_dict
            )
        except Exception as e:
            raise ValueError(f"Failed to load priority config: {e}")

    # Validate configuration
    valid, errors = config.validate()
    if not valid:
        raise ValueError(f"Configuration validation failed: {errors}")

    return config


__all__ = [
    "SolverConfig",
    "LoggingConfig",
    "InputConfig",
    "ValidationConfig",
    "ReportingConfig",
    "PriorityConfig",
    "AppConfig",
    "REQUIRED_INPUT_FILES",
    "load_config",
]
