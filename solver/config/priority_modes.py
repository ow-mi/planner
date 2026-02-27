"""
Priority mode configuration for Test Planner V4.

This module defines the priority modes and their configuration parameters
as specified in priority.md. Each mode has different optimization objectives
and constraint handling.
"""

from enum import Enum
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, field, fields
from datetime import date


class PriorityMode(Enum):
    """Enumeration of available priority modes."""

    LEG_PRIORITY = "leg_priority"  # Mode A: Higher priority legs first
    END_DATE_PRIORITY = "end_date_priority"  # Mode B: Pure makespan minimization
    END_DATE_STICKY = "end_date_sticky"  # Mode C: Target completion with gap filling
    LEG_END_DATES = "leg_end_dates"  # Mode D: Individual leg deadlines
    RESOURCE_BOTTLENECK = "resource_bottleneck"  # Mode E: Balance resource utilization


@dataclass
class BasePriorityConfig:
    """Base configuration for all priority modes."""

    mode: PriorityMode
    config_source: Optional[str] = None
    description: str = ""
    weights: Dict[str, float] = field(
        default_factory=lambda: {"makespan_weight": 0.5, "priority_weight": 0.5}
    )

    def validate(self) -> List[str]:
        """Validate configuration parameters."""
        errors = []

        # Validate makespan/priority split sums to 1.0
        makespan_weight = float(self.weights.get("makespan_weight", 0.0))
        priority_weight = float(self.weights.get("priority_weight", 0.0))
        total_weight = makespan_weight + priority_weight
        if abs(total_weight - 1.0) > 0.001:
            errors.append(f"Weights must sum to 1.0, got {total_weight}")

        return errors


@dataclass
class LegPriorityConfig(BasePriorityConfig):
    """Configuration for Leg Priority mode (Mode A)."""

    mode: PriorityMode = PriorityMode.LEG_PRIORITY
    description: str = "Higher priority legs get scheduled first. Lower priority legs can only start after higher priority legs complete."

    leg_weights: Dict[str, float] = field(default_factory=dict)
    priority_sequence: List[str] = field(
        default_factory=list
    )  # Ordered list of leg IDs by priority
    priority_penalty_per_day: float = (
        500.0  # Penalty applied when lower priority legs start too early
    )

    def validate(self) -> List[str]:
        """Validate leg priority configuration."""
        errors = super().validate()

        if not self.leg_weights and not self.priority_sequence:
            errors.append("Either leg_weights or priority_sequence must be specified")

        # Validate that priority_sequence contains unique leg IDs
        if len(self.priority_sequence) != len(set(self.priority_sequence)):
            errors.append("priority_sequence contains duplicate leg IDs")

        if self.priority_penalty_per_day < 0:
            errors.append("priority_penalty_per_day must be non-negative")

        return errors


@dataclass
class EndDatePriorityConfig(BasePriorityConfig):
    """Configuration for End Date Priority mode (Mode B)."""

    mode: PriorityMode = PriorityMode.END_DATE_PRIORITY
    description: str = "Minimize total project duration. No special handling for individual legs. Pure makespan minimization."

    # No additional parameters - pure makespan minimization


@dataclass
class EndDateStickyConfig(BasePriorityConfig):
    """Configuration for End Date Sticky mode (Mode C)."""

    mode: PriorityMode = PriorityMode.END_DATE_STICKY
    description: str = "Target completion date constraint. Fill resource gaps with work from other legs. Penalty for exceeding target date."

    target_completion_date: Optional[date] = None
    penalty_per_day_late: float = 100.0  # Penalty weight per day late
    parallel_execution_bonus: float = 50.0  # Bonus for parallel execution efficiency

    def validate(self) -> List[str]:
        """Validate sticky end date configuration."""
        errors = super().validate()

        if self.target_completion_date is None:
            errors.append("target_completion_date is required for sticky end date mode")

        if self.penalty_per_day_late < 0:
            errors.append("penalty_per_day_late must be non-negative")

        if self.parallel_execution_bonus < 0:
            errors.append("parallel_execution_bonus must be non-negative")

        return errors


@dataclass
class LegEndDatesConfig(BasePriorityConfig):
    """Configuration for Leg End Dates mode (Mode D)."""

    mode: PriorityMode = PriorityMode.LEG_END_DATES
    description: str = "Each leg has a target completion date. Legs can be scheduled in parallel if they don't exceed their deadlines."

    leg_deadlines: Dict[str, date] = field(default_factory=dict)  # leg_id -> deadline
    leg_start_deadlines: Dict[str, date] = field(default_factory=dict)  # leg_id -> earliest allowed start
    deadline_penalty_per_day: float = 200.0  # Penalty for missing deadline
    leg_compactness_penalty_per_day: float = 0.0  # Penalty for stretching leg duration
    leg_deadline_penalties: Dict[str, float] = field(default_factory=dict)  # leg_id -> penalty override
    leg_compactness_penalties: Dict[str, float] = field(default_factory=dict)  # leg_id -> compactness override
    leg_ending_weight: float = 0.0  # Extra force to pull leg completion dates earlier
    allow_parallel_within_deadlines: bool = True

    def validate(self) -> List[str]:
        """Validate leg end dates configuration."""
        errors = super().validate()

        if not self.leg_deadlines:
            errors.append("leg_deadlines must be specified for leg end dates mode")

        if self.deadline_penalty_per_day < 0:
            errors.append("deadline_penalty_per_day must be non-negative")
        if self.leg_compactness_penalty_per_day < 0:
            errors.append("leg_compactness_penalty_per_day must be non-negative")
        if self.leg_ending_weight < 0:
            errors.append("leg_ending_weight must be non-negative")
        for leg_id, penalty in (self.leg_deadline_penalties or {}).items():
            if not isinstance(penalty, (int, float)) or penalty < 0:
                errors.append(f"leg_deadline_penalties[{leg_id}] must be non-negative")
        for leg_id, penalty in (self.leg_compactness_penalties or {}).items():
            if not isinstance(penalty, (int, float)) or penalty < 0:
                errors.append(f"leg_compactness_penalties[{leg_id}] must be non-negative")

        return errors


@dataclass
class ResourceBottleneckConfig(BasePriorityConfig):
    """Configuration for Resource Bottleneck Priority mode (Mode E)."""

    mode: PriorityMode = PriorityMode.RESOURCE_BOTTLENECK
    description: str = "Identify bottleneck resources (high utilization). Prioritize legs that use under-utilized resources."

    bottleneck_threshold: float = 0.8  # Utilization threshold for bottleneck detection
    resource_balance_weight: float = 0.3  # Weight for resource balancing in objective
    utilization_target: float = 0.7  # Target utilization level for each resource

    def validate(self) -> List[str]:
        """Validate resource bottleneck configuration."""
        errors = super().validate()

        if not 0 <= self.bottleneck_threshold <= 1:
            errors.append("bottleneck_threshold must be between 0 and 1")

        if not 0 <= self.utilization_target <= 1:
            errors.append("utilization_target must be between 0 and 1")

        if self.resource_balance_weight < 0:
            errors.append("resource_balance_weight must be non-negative")

        # Ensure resource_balance_weight + makespan_weight + priority_weight = 1
        total = (
            self.resource_balance_weight
            + self.weights["makespan_weight"]
            + self.weights["priority_weight"]
        )
        if abs(total - 1.0) > 0.001:
            errors.append(f"Total weights must sum to 1.0, got {total}")

        return errors


@dataclass
class TestProximityConfig(BasePriorityConfig):
    """Configuration for Test Proximity mode.

    Forces tests containing specific string patterns (like "p-02" or "p-03")
    to run within a specified time window of their preceding tests.

    This configuration can wrap another priority mode (via base_config) so that
    proximity rules can be combined with the underlying objective logic.
    """

    mode: PriorityMode = (
        PriorityMode.END_DATE_PRIORITY
    )  # Base mode for proximity constraints
    description: str = "Test proximity constraints: Tests with specified patterns must run close to their predecessors."
    test_proximity_rules: Dict[str, Any] = field(
        default_factory=lambda: {
            "patterns": ["p-02", "p-03"],
            "max_gap_days": 30,
            "proximity_penalty_per_day": 50.0,
            "enforce_sequence_order": True,
        }
    )
    base_config: Optional[BasePriorityConfig] = None

    def validate(self) -> List[str]:
        """Validate test proximity configuration."""
        errors = super().validate()

        rules = self.test_proximity_rules
        if not isinstance(rules, dict):
            errors.append("test_proximity_rules must be a dictionary")
            return errors

        # Validate patterns
        patterns = rules.get("patterns", [])
        if not isinstance(patterns, list):
            errors.append("test_proximity_rules.patterns must be a list")
        elif not patterns:
            errors.append("test_proximity_rules.patterns cannot be empty")

        # Validate max_gap_days
        max_gap = rules.get("max_gap_days", 30)
        if not isinstance(max_gap, (int, float)) or max_gap <= 0:
            errors.append("test_proximity_rules.max_gap_days must be a positive number")

        # Validate proximity_penalty_per_day
        penalty = rules.get("proximity_penalty_per_day", 50.0)
        if not isinstance(penalty, (int, float)) or penalty < 0:
            errors.append(
                "test_proximity_rules.proximity_penalty_per_day must be non-negative"
            )

        # Validate enforce_sequence_order
        enforce_order = rules.get("enforce_sequence_order", True)
        if not isinstance(enforce_order, bool):
            errors.append(
                "test_proximity_rules.enforce_sequence_order must be a boolean"
            )

        # Validate wrapped base configuration if present
        if self.base_config is None:
            errors.append("base_config must be provided for test proximity mode")
        else:
            errors.extend(self.base_config.validate())

        return errors


def create_priority_config(
    mode: PriorityMode, config_source: Optional[str] = None, **kwargs
) -> BasePriorityConfig:
    """Factory function to create priority configuration objects."""

    config_classes = {
        PriorityMode.LEG_PRIORITY: LegPriorityConfig,
        PriorityMode.END_DATE_PRIORITY: EndDatePriorityConfig,
        PriorityMode.END_DATE_STICKY: EndDateStickyConfig,
        PriorityMode.LEG_END_DATES: LegEndDatesConfig,
        PriorityMode.RESOURCE_BOTTLENECK: ResourceBottleneckConfig,
    }

    config_class = config_classes.get(mode)
    if not config_class:
        raise ValueError(f"Unknown priority mode: {mode}")

    if config_source is not None:
        kwargs["config_source"] = config_source

    if kwargs:
        allowed_fields = {f.name for f in fields(config_class)}
        kwargs = {key: value for key, value in kwargs.items() if key in allowed_fields}

    return config_class(**kwargs)


def load_priority_config_from_dict(
    config_dict: Dict[str, Any], config_source: Optional[str] = None
) -> BasePriorityConfig:
    """Load priority configuration from dictionary (e.g., from JSON)."""

    if not isinstance(config_dict, dict):
        raise ValueError("config_dict must be a dictionary")

    config_data = config_dict.copy()

    mode_str = config_data.get("mode", "").lower()
    mode_map = {mode.value: mode for mode in PriorityMode}

    if mode_str not in mode_map:
        raise ValueError(f"Invalid priority mode: {mode_str}")

    mode = mode_map[mode_str]

    # Extract proximity rules (if any) before building the base configuration
    proximity_rules = config_data.pop("test_proximity_rules", None)

    # Handle date parsing for specific modes on the copied data
    if mode == PriorityMode.END_DATE_STICKY and "target_completion_date" in config_data:
        from datetime import datetime

        date_str = config_data["target_completion_date"]
        config_data["target_completion_date"] = datetime.fromisoformat(date_str).date()

    if mode == PriorityMode.LEG_END_DATES:
        from datetime import datetime

        if "leg_ending_weight" not in config_data:
            weights_dict = config_data.get("weights") or {}
            if isinstance(weights_dict, dict) and "leg_ending_weight" in weights_dict:
                config_data["leg_ending_weight"] = float(weights_dict["leg_ending_weight"])

        if "leg_deadlines" in config_data:
            deadlines = {}
            for leg_id, date_str in config_data["leg_deadlines"].items():
                deadlines[leg_id] = datetime.fromisoformat(date_str).date()
            config_data["leg_deadlines"] = deadlines
        if "leg_start_deadlines" in config_data:
            start_deadlines = {}
            for leg_id, date_str in (config_data.get("leg_start_deadlines") or {}).items():
                start_deadlines[leg_id] = datetime.fromisoformat(date_str).date()
            config_data["leg_start_deadlines"] = start_deadlines
        if "leg_deadline_penalties" in config_data:
            config_data["leg_deadline_penalties"] = {
                str(leg_id): float(value)
                for leg_id, value in (config_data.get("leg_deadline_penalties") or {}).items()
            }
        if "leg_compactness_penalties" in config_data:
            config_data["leg_compactness_penalties"] = {
                str(leg_id): float(value)
                for leg_id, value in (config_data.get("leg_compactness_penalties") or {}).items()
            }

    # Remove mode from kwargs before constructing configuration
    config_data.pop("mode", None)

    base_config = create_priority_config(
        mode, config_source=config_source, **config_data
    )

    # If proximity rules are provided, wrap the base configuration
    if proximity_rules is not None:
        proximity_config = TestProximityConfig(
            mode=mode,
            config_source=config_source,
            weights=dict(base_config.weights),
            test_proximity_rules=proximity_rules,
            base_config=base_config,
        )
        return proximity_config

    return base_config


def validate_priority_config(config: BasePriorityConfig) -> List[str]:
    """Validate a priority configuration object."""
    return config.validate()
