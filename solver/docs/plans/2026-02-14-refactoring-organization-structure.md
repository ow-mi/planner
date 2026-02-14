# Python Planning Solver Refactoring Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the planning solver for improved code organization, maintainability, and structure following SOLID principles and clean architecture patterns.

**Architecture:** Extract large monolithic files (model_builder.py at 973 lines) into focused single-responsibility modules. Create separate concern layers for objectives, constraints, and domain models. Strengthen test coverage and documentation.

**Tech Stack:** Python 3.8+, Google OR-Tools CP-SAT solver, pandas, dataclasses, pytest

---

## Current State Analysis

### File Size Analysis (lines of code)

| File | Lines | Status | Issue |
|------|-------|--------|-------|
| `model_builder.py` | 973 | ⚠️ CRITICAL | Multiple responsibilities: constraints + objectives |
| `data_loader.py` | 846 | ⚠️ WARNING | Could split dataclasses to models/ |
| `main.py` | 594 | ⚠️ WARNING | Mixed CLI + orchestration + config loading |
| `solver.py` | 388 | ✅ OK | Good separation |
| `reports/csv_reports.py` | 339 | ✅ OK | Focused module |
| `config/priority_modes.py` | 314 | ✅ OK | Well organized |
| `config/settings.py` | 263 | ✅ OK | Good hierarchical structure |

### Key Issues Identified

1. **Large Monolithic Files**: `model_builder.py` (973 lines) contains constraint building AND 5 objective modes
2. **Mixed Responsibilities**: `main.py` handles CLI, orchestration, AND config loading
3. **Domain Models Embedded**: Dataclasses in `data_loader.py` should be in domain layer
4. **Hard-to-Test Objectives**: Objective functions deeply embedded in model builder
5. **Inconsistent Module Organization**: Some modules in `utils/` could be promoted

---

## Proposed Directory Structure

```
solver/
├── main.py                    # Entry point ONLY (~100 lines)
├── cli.py                     # NEW: CLI parsing (~80 lines)
├── orchestrator.py            # NEW: Pipeline orchestration (~150 lines)
│
├── domain/                    # NEW: Core domain models
│   ├── __init__.py
│   ├── leg.py                 # Leg dataclass + methods
│   ├── test.py                # Test dataclass + methods  
│   ├── resource.py            # ResourceWindow dataclass
│   ├── dependency.py          # LegDependency dataclass
│   └── planning_data.py       # PlanningData container
│
├── data/                      # RENAMED from loader
│   ├── __init__.py
│   ├── loader.py              # Main load_data() orchestrator
│   ├── csv_loader.py          # CSV-specific loading
│   ├── json_loader.py         # JSON-specific loading
│   └── validation.py          # Data validation logic
│
├── model/                     # RENAMED from model_builder logic
│   ├── __init__.py
│   ├── schedule_model.py      # ScheduleModel class only
│   ├── builder.py             # Model building orchestrator
│   ├── constraints/           # NEW: Constraint modules
│   │   ├── __init__.py
│   │   ├── resource.py        # Resource assignment constraints
│   │   ├── sequencing.py      # Task ordering constraints
│   │   ├── dependency.py      # Leg dependency constraints
│   │   ├── proximity.py       # Test proximity constraints
│   │   └── timing.py          # Start time constraints
│   └── objectives/            # NEW: Objective modules
│       ├── __init__.py
│       ├── base.py            # BaseObjective interface
│       ├── leg_priority.py    # LEG_PRIORITY mode
│       ├── end_date.py        # END_DATE_PRIORITY mode
│       ├── end_date_sticky.py # END_DATE_STICKY mode
│       ├── leg_end_dates.py   # LEG_END_DATES mode
│       └── resource_bottleneck.py  # RESOURCE_BOTTLENECK mode
│
├── solver/                    # Renamed for clarity
│   ├── __init__.py
│   ├── engine.py              # Core solver logic (renamed solver.py)
│   ├── callback.py            # SolutionCallback class
│   └── result.py              # SolutionResult, TestSchedule dataclasses
│
├── config/                    # Keep existing
│   ├── __init__.py
│   ├── settings.py
│   └── priority_modes.py
│
├── reports/                   # Keep existing
│   ├── __init__.py
│   └── csv_reports.py
│
└── utils/                     # Keep existing
    ├── __init__.py
    ├── intervals.py
    └── profiling.py
```

---

## Phase 1: Extract Domain Models

**Estimated time:** 45 minutes

### Task 1.1: Create domain directory and base structure

**Files:**
- Create: `domain/__init__.py`

**Step 1: Create domain package**

```python
"""
Domain models for the planning solver.

This module contains the core data structures that represent
the business domain: legs, tests, resources, and dependencies.
"""

from .leg import Leg
from .test import Test
from .resource import ResourceWindow
from .dependency import LegDependency
from .planning_data import PlanningData

__all__ = [
    "Leg",
    "Test",
    "ResourceWindow",
    "LegDependency",
    "PlanningData",
]
```

Run: `touch domain/__init__.py` (then add the content above)

---

### Task 1.2: Extract Leg dataclass

**Files:**
- Create: `domain/leg.py`
- Modify: `data_loader.py` (imports after extraction)

**Step 1: Create domain/leg.py**

```python
"""Leg domain model."""

from dataclasses import dataclass
from datetime import date
from typing import Optional, List


@dataclass
class Leg:
    """
    Represents a leg of testing work in a test campaign.

    Attributes:
        name: Unique identifier for the leg
        tests: List of test names belonging to this leg
        phase: Optional phase classification
        start_week: The ISO week this leg should start
        end_week: The ISO week this leg should end (if applicable)
        campaign: The test campaign this leg belongs to
        dut: The device under test for this leg
        resource_requirements: Dict mapping resource types to quantities needed
        estimated_duration_days: Expected duration in days
        predecessors: List of leg names that must complete before this leg
        end_date: Target end date for this leg (if any)
        priority: Numeric priority (lower = higher priority)
    """
    name: str
    tests: List[str]
    phase: Optional[str] = None
    start_week: Optional[str] = None
    end_week: Optional[str] = None
    campaign: Optional[str] = None
    dut: Optional[str] = None
    resource_requirements: Optional[dict] = None
    estimated_duration_days: Optional[int] = None
    predecessors: Optional[List[str]] = None
    end_date: Optional[date] = None
    priority: Optional[int] = None

    def __post_init__(self):
        """Validate leg data after initialization."""
        if not self.name:
            raise ValueError("Leg name cannot be empty")
        if not self.tests:
            raise ValueError(f"Leg {self.name} must have at least one test")
        if self.predecessors is None:
            self.predecessors = []
        if self.resource_requirements is None:
            self.resource_requirements = {}

    @property
    def test_count(self) -> int:
        """Return the number of tests in this leg."""
        return len(self.tests)

    def requires_resource(self, resource_type: str) -> bool:
        """Check if this leg requires a specific resource type."""
        return resource_type in self.resource_requirements
```

**Step 2: Update data_loader.py imports**

In `data_loader.py`, change:
```python
from .domain.leg import Leg  # At top of file
```

And remove the Leg dataclass definition from data_loader.py.

---

### Task 1.3: Extract Test dataclass

**Files:**
- Create: `domain/test.py`

**Step 1: Create domain/test.py**

```python
"""Test domain model."""

from dataclasses import dataclass
from typing import Optional, Dict


@dataclass
class Test:
    """
    Represents a single test in a test campaign.

    Attributes:
        name: Unique identifier for the test
        leg: The leg this test belongs to
        dut: The device under test for this test
        estimated_duration_hours: Expected duration in hours
        resource_requirements: Dict mapping resource types to quantities
        predecessor_tests: List of tests that must complete before this one
        test_type: Classification of the test type
        phase: Optional phase classification
    """
    name: str
    leg: Optional[str] = None
    dut: Optional[str] = None
    estimated_duration_hours: Optional[float] = None
    resource_requirements: Optional[Dict[str, int]] = None
    predecessor_tests: Optional[list] = None
    test_type: Optional[str] = None
    phase: Optional[str] = None

    def __post_init__(self):
        """Validate test data after initialization."""
        if not self.name:
            raise ValueError("Test name cannot be empty")
        if self.predecessor_tests is None:
            self.predecessor_tests = []
        if self.resource_requirements is None:
            self.resource_requirements = {}

    @property
    def estimated_duration_days(self) -> float:
        """Return duration in days (assuming 8-hour workday)."""
        if self.estimated_duration_hours is None:
            return 1.0  # Default to 1 day
        return self.estimated_duration_hours / 8.0
```

---

### Task 1.4: Extract ResourceWindow dataclass

**Files:**
- Create: `domain/resource.py`

**Step 1: Create domain/resource.py**

```python
"""Resource domain model."""

from dataclasses import dataclass
from datetime import date
from typing import Optional


@dataclass
class ResourceWindow:
    """
    Represents a time window when a resource is available.

    Attributes:
        resource_name: Name/identifier of the resource
        resource_type: Category of resource (e.g., 'equipment', 'lab')
        available_start: Start date of availability window
        available_end: End date of availability window
        capacity: Maximum units available during this window
        hours_per_day: Operating hours per day (default 8)
    """
    resource_name: str
    resource_type: str
    available_start: date
    available_end: date
    capacity: int = 1
    hours_per_day: float = 8.0

    def __post_init__(self):
        """Validate resource window data."""
        if not self.resource_name:
            raise ValueError("Resource name cannot be empty")
        if self.capacity < 1:
            raise ValueError("Capacity must be at least 1")
        if self.available_start > self.available_end:
            raise ValueError(
                f"Start date {self.available_start} cannot be after "
                f"end date {self.available_end} for resource {self.resource_name}"
            )

    def is_available_on(self, check_date: date) -> bool:
        """Check if the resource is available on a given date."""
        return self.available_start <= check_date <= self.available_end

    @property
    def window_days(self) -> int:
        """Return the number of days in the availability window."""
        return (self.available_end - self.available_start).days + 1
```

---

### Task 1.5: Extract LegDependency dataclass

**Files:**
- Create: `domain/dependency.py`

**Step 1: Create domain/dependency.py**

```python
"""Dependency domain model."""

from dataclasses import dataclass
from typing import Optional


@dataclass
class LegDependency:
    """
    Represents a dependency between legs.

    Attributes:
        predecessor_leg: Name of the leg that must complete first
        successor_leg: Name of the leg that must wait
        dependency_type: Type of dependency (finish-to-start, etc.)
        lag_days: Optional delay in days after predecessor completes
    """
    predecessor_leg: str
    successor_leg: str
    dependency_type: str = "finish-to-start"
    lag_days: int = 0

    def __post_init__(self):
        """Validate dependency data."""
        if not self.predecessor_leg:
            raise ValueError("Predecessor leg cannot be empty")
        if not self.successor_leg:
            raise ValueError("Successor leg cannot be empty")
        if self.lag_days < 0:
            raise ValueError("Lag days cannot be negative")
        if self.predecessor_leg == self.successor_leg:
            raise ValueError("Leg cannot depend on itself")
```

---

### Task 1.6: Extract PlanningData container

**Files:**
- Create: `domain/planning_data.py`

**Step 1: Create domain/planning_data.py**

```python
"""Planning data container."""

from dataclasses import dataclass, field
from typing import Dict, List
from .leg import Leg
from .test import Test
from .resource import ResourceWindow
from .dependency import LegDependency


@dataclass
class PlanningData:
    """
    Container for all planning data loaded from input files.

    Attributes:
        legs: Dict mapping leg names to Leg objects
        tests: Dict mapping test names to Test objects
        resource_windows: List of ResourceWindow objects
        dependencies: List of LegDependency objects
        duts: Set of device-under-test identifiers
        resource_types: Set of resource type categories
        start_date: Earliest date in the planning horizon
        end_date: Latest date in the planning horizon
    """
    legs: Dict[str, Leg] = field(default_factory=dict)
    tests: Dict[str, Test] = field(default_factory=dict)
    resource_windows: List[ResourceWindow] = field(default_factory=list)
    dependencies: List[LegDependency] = field(default_factory=list)
    duts: set = field(default_factory=set)
    resource_types: set = field(default_factory=set)
    start_date: None = None
    end_date: None = None

    @property
    def leg_count(self) -> int:
        """Return the number of legs."""
        return len(self.legs)

    @property
    def test_count(self) -> int:
        """Return the number of tests."""
        return len(self.tests)

    def get_leg_tests(self, leg_name: str) -> List[Test]:
        """Return all tests belonging to a leg."""
        return [t for t in self.tests.values() if t.leg == leg_name]

    def get_leg_dependencies(self, leg_name: str) -> List[LegDependency]:
        """Return dependencies where leg_name is the successor."""
        return [d for d in self.dependencies if d.successor_leg == leg_name]
```

---

### Task 1.7: Update data_loader.py to use domain imports

**Files:**
- Modify: `data_loader.py`

**Step 1: Update imports at top of data_loader.py**

```python
# Change from local definitions to:
from .domain import Leg, Test, ResourceWindow, LegDependency, PlanningData
```

**Step 2: Remove dataclass definitions from data_loader.py**

Delete the inline dataclass definitions for:
- Leg
- Test
- ResourceWindow
- LegDependency
- PlanningData

**Step 3: Run tests to verify**

Run: `pytest tests/ -v`
Expected: All tests pass (adjust imports in test files if needed)

**Step 4: Commit**

```bash
git add domain/ data_loader.py
git commit -m "refactor: extract domain models to domain/ package

- Create domain/ package with Leg, Test, ResourceWindow, LegDependency, PlanningData
- Update data_loader.py to import from domain
- Improves separation of concerns and testability"
```

---

## Phase 2: Split model_builder.py into Focused Modules

**Estimated time:** 90 minutes

### Task 2.1: Create model/ directory structure

**Files:**
- Create: `model/__init__.py`
- Create: `model/constraints/__init__.py`
- Create: `model/objectives/__init__.py`

**Step 1: Create model package**

```bash
mkdir -p model/constraints model/objectives
touch model/__init__.py model/constraints/__init__.py model/objectives/__init__.py
```

---

### Task 2.2: Create base objective interface

**Files:**
- Create: `model/objectives/base.py`

**Step 1: Create base objective interface**

```python
"""Base objective function interface."""

from abc import ABC, abstractmethod
from typing import Optional
from ortools.sat.python import cp_model

from ..schedule_model import ScheduleModel
from ...domain import PlanningData
from ...config import BasePriorityConfig


class BaseObjective(ABC):
    """
    Abstract base class for CP-SAT objective functions.

    All priority modes implement this interface, making objectives
    pluggable and testable independently.
    """

    def __init__(
        self,
        model: cp_model.CpModel,
        schedule_model: ScheduleModel,
        planning_data: PlanningData,
        config: BasePriorityConfig,
    ):
        """
        Initialize the objective function.

        Args:
            model: The CP-SAT model to add objectives to
            schedule_model: The schedule model containing decision variables
            planning_data: The planning data (legs, tests, resources)
            config: Configuration for this objective mode
        """
        self.model = model
        self.schedule_model = schedule_model
        self.planning_data = planning_data
        self.config = config

    @abstractmethod
    def add_to_model(self) -> Optional[cp_model.LinearExpr]:
        """
        Add this objective to the CP-SAT model.

        Returns:
            The objective expression to minimize/maximize, or None
            if the objective was directly set on the model.
        """
        pass

    @classmethod
    @abstractmethod
    def name(cls) -> str:
        """Return the name of this objective mode."""
        pass

    @classmethod
    @abstractmethod
    def config_class(cls):
        """Return the config dataclass type for this objective."""
        pass
```

---

### Task 2.3: Extract LEG_PRIORITY objective

**Files:**
- Create: `model/objectives/leg_priority.py`

**Step 1: Create leg_priority.py**

```python
"""LEG_PRIORITY objective implementation."""

from ortools.sat.python import cp_model
from typing import Optional

from .base import BaseObjective
from ..schedule_model import ScheduleModel
from ...domain import PlanningData
from ...config import LegPriorityConfig


class LegPriorityObjective(BaseObjective):
    """
    Objective that minimizes weighted sum of leg end times.

    Each leg is weighted by its priority value (lower priority number =
    higher importance). The solver will try to complete high-priority
    legs earlier in the schedule.
    """

    @classmethod
    def name(cls) -> str:
        return "LEG_PRIORITY"

    @classmethod
    def config_class(cls):
        return LegPriorityConfig

    def add_to_model(self) -> Optional[cp_model.LinearExpr]:
        """
        Add leg priority objective to model.

        Returns weighted sum expression to minimize.
        """
        config: LegPriorityConfig = self.config
        objective_terms = []

        for leg_name, leg in self.planning_data.legs.items():
            # Get the leg's end interval variable
            if leg_name not in self.schedule_model.leg_intervals:
                continue

            leg_interval = self.schedule_model.leg_intervals[leg_name]
            leg_end = leg_interval.EndExpr()

            # Weight by leg priority (inverted: lower priority = higher weight)
            weight = config.default_priority_weight
            if leg.priority is not None:
                # Lower priority number = higher importance
                weight = config.priority_multiplier * (100 - leg.priority)

            objective_terms.append(weight * leg_end)

        if objective_terms:
            objective = sum(objective_terms)
            self.model.Minimize(objective)
            return objective

        return None
```

---

### Task 2.4: Extract END_DATE_PRIORITY objective

**Files:**
- Create: `model/objectives/end_date.py`

**Step 1: Create end_date.py**

```python
"""END_DATE_PRIORITY objective implementation."""

from ortools.sat.python import cp_model
from typing import Optional

from .base import BaseObjective
from ..schedule_model import ScheduleModel
from ...domain import PlanningData
from ...config import EndDatePriorityConfig


class EndDatePriorityObjective(BaseObjective):
    """
    Objective that penalizes legs finishing after their target end dates.

    For each leg with an end_date, adds a linear penalty for each day
    the leg finishes after its target. Legs without end dates use a
    soft fallback priority.
    """

    @classmethod
    def name(cls) -> str:
        return "END_DATE_PRIORITY"

    @classmethod
    def config_class(cls):
        return EndDatePriorityConfig

    def add_to_model(self) -> Optional[cp_model.LinearExpr]:
        """Add end date penalty objective to model."""
        config: EndDatePriorityConfig = self.config
        objective_terms = []

        for leg_name, leg in self.planning_data.legs.items():
            if leg_name not in self.schedule_model.leg_intervals:
                continue

            leg_interval = self.schedule_model.leg_intervals[leg_name]
            leg_end = leg_interval.EndExpr()

            if leg.end_date is not None:
                # Convert end_date to day offset from planning start
                end_day = (leg.end_date - self.planning_data.start_date).days

                # Add penalty for days over target
                days_late = leg_end - end_day
                penalty = config.overdue_penalty_weight * days_late
                objective_terms.append(penalty)
            else:
                # Use priority-based fallback
                if leg.priority is not None:
                    weight = config.fallback_weight * leg.priority
                    objective_terms.append(weight * leg_end)

        if objective_terms:
            objective = sum(objective_terms)
            self.model.Minimize(objective)
            return objective

        return None
```

---

### Task 2.5: Extract END_DATE_STICKY objective

**Files:**
- Create: `model/objectives/end_date_sticky.py`

**Step 1: Create end_date_sticky.py**

```python
"""END_DATE_STICKY objective implementation."""

from ortools.sat.python import cp_model
from typing import Optional

from .base import BaseObjective
from ..schedule_model import ScheduleModel
from ...domain import PlanningData
from ...config import EndDateStickyConfig


class EndDateStickyObjective(BaseObjective):
    """
    Objective that tries to schedule legs as close to end dates as possible.

    Unlike END_DATE_PRIORITY which only penalizes being late, this mode
    penalizes both being early AND being late, encouraging schedules that
    "stick" to the target end dates.
    """

    @classmethod
    def name(cls) -> str:
        return "END_DATE_STICKY"

    @classmethod
    def config_class(cls):
        return EndDateStickyConfig

    def add_to_model(self) -> Optional[cp_model.LinearExpr]:
        """Add sticky end date objective to model."""
        config: EndDateStickyConfig = self.config
        objective_terms = []

        for leg_name, leg in self.planning_data.legs.items():
            if leg_name not in self.schedule_model.leg_intervals:
                continue

            leg_interval = self.schedule_model.leg_intervals[leg_name]
            leg_end = leg_interval.EndExpr()

            if leg.end_date is not None:
                end_day = (leg.end_date - self.planning_data.start_date).days

                # Create deviation variable (absolute value)
                deviation = self.model.NewIntVar(
                    0, self.schedule_model.horizon_days,
                    f"end_deviation_{leg_name}"
                )

                # deviation = abs(leg_end - end_day)
                diff = leg_end - end_day
                self.model.AddAbsEquality(deviation, diff)

                # Weight the deviation
                penalty = config.stickiness_weight * deviation
                objective_terms.append(penalty)
            elif leg.priority is not None:
                # Fallback for legs without end dates
                weight = config.fallback_weight * leg.priority
                objective_terms.append(weight * leg_end)

        if objective_terms:
            objective = sum(objective_terms)
            self.model.Minimize(objective)
            return objective

        return None
```

---

### Task 2.6: Extract remaining objectives (LEG_END_DATES, RESOURCE_BOTTLENECK)

**Files:**
- Create: `model/objectives/leg_end_dates.py`
- Create: `model/objectives/resource_bottleneck.py`

**Step 1: Create leg_end_dates.py**

```python
"""LEG_END_DATES objective implementation."""

from ortools.sat.python import cp_model
from typing import Optional

from .base import BaseObjective
from ..schedule_model import ScheduleModel
from ...domain import PlanningData
from ...config import LegEndDatesConfig


class LegEndDatesObjective(BaseObjective):
    """
    Objective that respects leg end dates as hard or soft constraints.

    This mode can enforce end dates strictly (hard constraint) or
    with flexibility through soft constraints with penalties.
    """

    @classmethod
    def name(cls) -> str:
        return "LEG_END_DATES"

    @classmethod
    def config_class(cls):
        return LegEndDatesConfig

    def add_to_model(self) -> Optional[cp_model.LinearExpr]:
        """Add leg end date constraints and objective."""
        config: LegEndDatesConfig = self.config
        objective_terms = []

        for leg_name, leg in self.planning_data.legs.items():
            if leg_name not in self.schedule_model.leg_intervals:
                continue

            leg_interval = self.schedule_model.leg_intervals[leg_name]
            leg_end = leg_interval.EndExpr()

            if leg.end_date is not None:
                end_day = (leg.end_date - self.planning_data.start_date).days

                if config.hard_deadlines:
                    # Hard constraint: must finish by end date
                    self.model.Add(leg_end <= end_day)
                else:
                    # Soft constraint with penalty
                    days_late = leg_end - end_day
                    penalty = config.soft_penalty_weight * days_late
                    objective_terms.append(penalty)

        if objective_terms:
            objective = sum(objective_terms)
            self.model.Minimize(objective)
            return objective

        return None
```

**Step 2: Create resource_bottleneck.py**

```python
"""RESOURCE_BOTTLENECK objective implementation."""

from ortools.sat.python import cp_model
from typing import Optional

from .base import BaseObjective
from ..schedule_model import ScheduleModel
from ...domain import PlanningData
from ...config import ResourceBottleneckConfig


class ResourceBottleneckObjective(BaseObjective):
    """
    Objective that balances resource utilization across the schedule.

    This mode tries to minimize peak resource usage and smooth out
    resource demand over time, reducing competition for bottleneck resources.
    """

    @classmethod
    def name(cls) -> str:
        return "RESOURCE_BOTTLENECK"

    @classmethod
    def config_class(cls):
        return ResourceBottleneckConfig

    def add_to_model(self) -> Optional[cp_model.LinearExpr]:
        """Add resource balancing objective to model."""
        config: ResourceBottleneckConfig = self.config
        objective_terms = []

        # Create cumulative usage variables for each resource type
        for resource_type in self.planning_data.resource_types:
            # Track peak usage for this resource type
            peak_usage = self.model.NewIntVar(
                0,
                sum(rw.capacity for rw in self.planning_data.resource_windows
                    if rw.resource_type == resource_type),
                f"peak_usage_{resource_type}"
            )

            # Add constraints to track peak usage (simplified version)
            # Full implementation would use interval variables and cumul constraints

            # Penalize high peak usage
            penalty = config.bottleneck_penalty_weight * peak_usage
            objective_terms.append(penalty)

        # Also include leg completion as secondary objective
        for leg_name, leg in self.planning_data.legs.items():
            if leg_name not in self.schedule_model.leg_intervals:
                continue

            leg_interval = self.schedule_model.leg_intervals[leg_name]
            leg_end = leg_interval.EndExpr()

            weight = config.completion_weight
            if leg.priority is not None:
                weight *= (100 - leg.priority) / 100

            objective_terms.append(weight * leg_end)

        if objective_terms:
            objective = sum(objective_terms)
            self.model.Minimize(objective)
            return objective

        return None
```

---

### Task 2.7: Create objective factory/registry

**Files:**
- Create: `model/objectives/__init__.py`

**Step 1: Create objective registry**

```python
"""Objective function implementations for CP-SAT model."""

from typing import Dict, Type, Optional
from .base import BaseObjective
from .leg_priority import LegPriorityObjective
from .end_date import EndDatePriorityObjective
from .end_date_sticky import EndDateStickyObjective
from .leg_end_dates import LegEndDatesObjective
from .resource_bottleneck import ResourceBottleneckObjective


# Registry of all available objectives
OBJECTIVE_REGISTRY: Dict[str, Type[BaseObjective]] = {
    "LEG_PRIORITY": LegPriorityObjective,
    "END_DATE_PRIORITY": EndDatePriorityObjective,
    "END_DATE_STICKY": EndDateStickyObjective,
    "LEG_END_DATES": LegEndDatesObjective,
    "RESOURCE_BOTTLENECK": ResourceBottleneckObjective,
}


def get_objective_class(mode: str) -> Optional[Type[BaseObjective]]:
    """
    Get the objective class for a given mode name.

    Args:
        mode: The priority mode name (e.g., "LEG_PRIORITY")

    Returns:
        The objective class, or None if not found
    """
    return OBJECTIVE_REGISTRY.get(mode)


def list_available_modes() -> list:
    """Return list of available objective mode names."""
    return list(OBJECTIVE_REGISTRY.keys())


__all__ = [
    "BaseObjective",
    "LegPriorityObjective",
    "EndDatePriorityObjective",
    "EndDateStickyObjective",
    "LegEndDatesObjective",
    "ResourceBottleneckObjective",
    "OBJECTIVE_REGISTRY",
    "get_objective_class",
    "list_available_modes",
]
```

---

### Task 2.8: Extract constraint modules

**Files:**
- Create: `model/constraints/resource.py`
- Create: `model/constraints/sequencing.py`
- Create: `model/constraints/dependency.py`
- Create: `model/constraints/proximity.py`
- Create: `model/constraints/timing.py`

**Step 1: Create resource.py**

```python
"""Resource assignment constraints."""

from ortools.sat.python import cp_model
from typing import Dict, List

from ..schedule_model import ScheduleModel
from ...domain import PlanningData


def add_resource_constraints(
    model: cp_model.CpModel,
    schedule_model: ScheduleModel,
    planning_data: PlanningData,
) -> None:
    """
    Add resource capacity constraints to the model.

    For each resource type, ensures that the total usage at any time
    does not exceed the available capacity.

    Args:
        model: The CP-SAT model
        schedule_model: The schedule model with decision variables
        planning_data: Planning data with resource windows
    """
    # Group resource windows by type
    resource_by_type: Dict[str, List] = {}
    for window in planning_data.resource_windows:
        if window.resource_type not in resource_by_type:
            resource_by_type[window.resource_type] = []
        resource_by_type[window.resource_type].append(window)

    # Add cumulative constraints for each resource type
    for resource_type, windows in resource_by_type.items():
        total_capacity = sum(w.capacity for w in windows)

        # Collect all intervals using this resource type
        intervals = []
        demands = []

        for leg_name, leg in planning_data.legs.items():
            if leg.requires_resource(resource_type):
                if leg_name in schedule_model.leg_intervals:
                    intervals.append(schedule_model.leg_intervals[leg_name])
                    demands.append(
                        leg.resource_requirements.get(resource_type, 1)
                    )

        if intervals:
            model.AddCumulative(
                intervals,
                demands,
                total_capacity
            )


__all__ = ["add_resource_constraints"]
```

**Step 2: Create sequencing.py**

```python
"""Task sequencing constraints."""

from ortools.sat.python import cp_model

from ..schedule_model import ScheduleModel
from ...domain import PlanningData


def add_sequencing_constraints(
    model: cp_model.CpModel,
    schedule_model: ScheduleModel,
    planning_data: PlanningData,
) -> None:
    """
    Add sequencing constraints for tasks within legs.

    Tasks within a leg are sequenced based on their predecessor
    relationships. This ensures tests run in the correct order.

    Args:
        model: The CP-SAT model
        schedule_model: The schedule model with decision variables
        planning_data: Planning data with test definitions
    """
    for test_name, test in planning_data.tests.items():
        if test_name not in schedule_model.test_intervals:
            continue

        test_interval = schedule_model.test_intervals[test_name]

        # Add precedence constraints for predecessor tests
        for pred_name in test.predecessor_tests:
            if pred_name in schedule_model.test_intervals:
                pred_interval = schedule_model.test_intervals[pred_name]
                # Predecessor must finish before this test starts
                model.Add(
                    pred_interval.EndExpr() <= test_interval.StartExpr()
                )


__all__ = ["add_sequencing_constraints"]
```

---

### Task 2.9: Create consolidated constraints module

**Files:**
- Create: `model/constraints/__init__.py`

**Step 1: Create constraints __init__.py**

```python
"""Constraint builders for CP-SAT model."""

from .resource import add_resource_constraints
from .sequencing import add_sequencing_constraints
from .dependency import add_dependency_constraints
from .proximity import add_proximity_constraints
from .timing import add_timing_constraints


def add_all_constraints(
    model,
    schedule_model,
    planning_data,
    config,
) -> None:
    """
    Add all constraints to the model in the correct order.

    This function applies constraints in dependency order:
    1. Timing constraints (start times, durations)
    2. Dependency constraints (leg predecessors)
    3. Sequencing constraints (test ordering)
    4. Resource constraints (capacity limits)
    5. Proximity constraints (test grouping)

    Args:
        model: The CP-SAT model
        schedule_model: The schedule model with variables
        planning_data: The planning data
        config: Configuration object
    """
    add_timing_constraints(model, schedule_model, planning_data, config)
    add_dependency_constraints(model, schedule_model, planning_data)
    add_sequencing_constraints(model, schedule_model, planning_data)
    add_resource_constraints(model, schedule_model, planning_data)
    add_proximity_constraints(model, schedule_model, planning_data, config)


__all__ = [
    "add_constraint_constraints",
    "add_sequencing_constraints",
    "add_dependency_constraints",
    "add_proximity_constraints",
    "add_timing_constraints",
    "add_all_constraints",
]
```

---

### Task 2.10: Create ScheduleModel class

**Files:**
- Create: `model/schedule_model.py`

**Step 1: Extract ScheduleModel class**

```python
"""Schedule model containing decision variables."""

from dataclasses import dataclass, field
from typing import Dict, Optional
from ortools.sat.python import cp_model

from ..domain import PlanningData


@dataclass
class ScheduleModel:
    """
    Container for all decision variables in the scheduling model.

    This class holds the CP-SAT interval variables and auxiliary
    variables created during model building.

    Attributes:
        model: The CP-SAT model
        planning_data: The input planning data
        horizon_days: The planning horizon in days
        leg_intervals: Dict of leg name -> interval variable
        test_intervals: Dict of test name -> interval variable
        resource_assignments: Dict of leg -> resource assignment variables
        auxiliary_vars: Dict of additional variables
    """
    model: cp_model.CpModel
    planning_data: PlanningData
    horizon_days: int = 365

    # Decision variables
    leg_intervals: Dict[str, cp_model.IntervalVar] = field(default_factory=dict)
    test_intervals: Dict[str, cp_model.IntervalVar] = field(default_factory=dict)
    resource_assignments: Dict[str, cp_model.IntVar] = field(default_factory=dict)
    auxiliary_vars: Dict[str, cp_model.IntVar] = field(default_factory=dict)

    def create_leg_interval(
        self,
        leg_name: str,
        min_start: int = 0,
        max_end: Optional[int] = None,
    ) -> cp_model.IntervalVar:
        """
        Create an interval variable for a leg.

        Args:
            leg_name: Name of the leg
            min_start: Minimum start day (default 0)
            max_end: Maximum end day (default horizon)

        Returns:
            The created interval variable
        """
        if max_end is None:
            max_end = self.horizon_days

        leg = self.planning_data.legs[leg_name]
        duration = leg.estimated_duration_days or 1

        interval = self.model.NewIntervalVar(
            min_start,  # start min
            max_end - duration,  # start max
            duration,  # size
            max_end,  # end max
            f"leg_{leg_name}"
        )

        self.leg_intervals[leg_name] = interval
        return interval

    def create_test_interval(
        self,
        test_name: str,
        min_start: int = 0,
        max_end: Optional[int] = None,
    ) -> cp_model.IntervalVar:
        """
        Create an interval variable for a test.

        Args:
            test_name: Name of the test
            min_start: Minimum start day
            max_end: Maximum end day

        Returns:
            The created interval variable
        """
        if max_end is None:
            max_end = self.horizon_days

        test = self.planning_data.tests[test_name]
        duration = int(test.estimated_duration_days)

        interval = self.model.NewIntervalVar(
            min_start,
            max_end - duration,
            duration,
            max_end,
            f"test_{test_name}"
        )

        self.test_intervals[test_name] = interval
        return interval


__all__ = ["ScheduleModel"]
```

---

### Task 2.11: Create model builder orchestrator

**Files:**
- Create: `model/builder.py`

**Step 1: Create builder.py**

```python
"""Model builder orchestrator."""

from ortools.sat.python import cp_model
from typing import Optional

from .schedule_model import ScheduleModel
from .constraints import add_all_constraints
from .objectives import get_objective_class
from ..domain import PlanningData
from ..config import BasePriorityConfig, PriorityMode
from ..utils.profiling import timeit


@timeit
def build_model(
    planning_data: PlanningData,
    priority_mode: PriorityMode,
    config: BasePriorityConfig,
) -> ScheduleModel:
    """
    Build the CP-SAT scheduling model.

    This function orchestrates the model building process:
    1. Create the CP-SAT model and schedule model container
    2. Create decision variables (intervals for legs and tests)
    3. Add constraints (timing, dependencies, resources, proximity)
    4. Add objective function based on priority mode

    Args:
        planning_data: The loaded planning data
        priority_mode: The selected priority mode
        config: Configuration for the objective

    Returns:
        A populated ScheduleModel ready for solving

    Raises:
        ValueError: If the priority mode is not supported
    """
    # Create model and container
    cp_model_instance = cp_model.CpModel()

    # Calculate horizon from data
    horizon_days = _calculate_horizon(planning_data)

    schedule_model = ScheduleModel(
        model=cp_model_instance,
        planning_data=planning_data,
        horizon_days=horizon_days,
    )

    # Create decision variables
    _create_variables(schedule_model, planning_data)

    # Add all constraints
    add_all_constraints(
        schedule_model.model,
        schedule_model,
        planning_data,
        config,
    )

    # Add objective function
    _add_objective(schedule_model, priority_mode, config)

    return schedule_model


def _calculate_horizon(planning_data: PlanningData) -> int:
    """Calculate the planning horizon in days."""
    if planning_data.end_date and planning_data.start_date:
        base_horizon = (planning_data.end_date - planning_data.start_date).days
    else:
        base_horizon = 365

    # Add buffer for scheduling flexibility
    return base_horizon + 90


def _create_variables(
    schedule_model: ScheduleModel,
    planning_data: PlanningData,
) -> None:
    """Create all interval variables."""
    # Create leg intervals
    for leg_name in planning_data.legs:
        schedule_model.create_leg_interval(leg_name)

    # Create test intervals
    for test_name in planning_data.tests:
        schedule_model.create_test_interval(test_name)


def _add_objective(
    schedule_model: ScheduleModel,
    priority_mode: PriorityMode,
    config: BasePriorityConfig,
) -> None:
    """Add the objective function to the model."""
    objective_class = get_objective_class(priority_mode.value)

    if objective_class is None:
        raise ValueError(
            f"Unsupported priority mode: {priority_mode.value}. "
            f"Available modes: {list(get_objective_class.__self__.keys())}"
        )

    objective = objective_class(
        model=schedule_model.model,
        schedule_model=schedule_model,
        planning_data=schedule_model.planning_data,
        config=config,
    )

    objective.add_to_model()


__all__ = ["build_model"]
```

---

### Task 2.12: Create model package exports

**Files:**
- Modify: `model/__init__.py`

**Step 1: Create __init__.py**

```python
"""
CP-SAT model building and solving.

This package contains:
- schedule_model: Decision variable container
- builder: Main model building orchestrator
- constraints: Constraint implementations
- objectives: Objective function implementations
"""

from .schedule_model import ScheduleModel
from .builder import build_model

__all__ = [
    "ScheduleModel",
    "build_model",
]
```

---

### Task 2.13: Run tests and fix imports

**Files:**
- Modify: `main.py`
- Modify: `solver.py`
- Modify: All test files as needed

**Step 1: Update main.py imports**

```python
# Change from:
from .model_builder import build_model

# To:
from .model import build_model, ScheduleModel
```

**Step 2: Run tests**

Run: `pytest tests/ -v`
Expected: May have import errors that need fixing

**Step 3: Fix import errors**

Update all files that imported from `model_builder.py` to use the new module structure.

**Step 4: Commit**

```bash
git add model/ main.py solver.py tests/
git commit -m "refactor: split model_builder into focused modules

- Create model/ package with constraints/ and objectives/ subpackages
- Extract each priority mode to its own objective class
- Extract constraint types to separate modules
- Create ScheduleModel class for decision variables
- Create builder.py orchestrator
- Reduces model_builder.py from 973 lines to multiple focused modules (~100 lines each)
- Improves testability and maintainability"
```

---

## Phase 3: Extract CLI and Orchestration from main.py

**Estimated time:** 30 minutes

### Task 3.1: Create CLI module

**Files:**
- Create: `cli.py`

**Step 1: Extract CLI to cli.py**

```python
"""Command-line interface for the planning solver."""

import argparse
from pathlib import Path
from typing import Optional

from .config import PriorityMode


def parse_args(args: Optional[list] = None) -> argparse.Namespace:
    """
    Parse command-line arguments.

    Args:
        args: Optional list of args (for testing). Uses sys.argv if None.

    Returns:
        Parsed arguments namespace
    """
    parser = argparse.ArgumentParser(
        description="Planning Solver - Generate optimized test schedules",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py --input-folder ./data/scenario_1
  python main.py --input-folder ./data --priority-mode END_DATE_PRIORITY
  python main.py --input-folder ./data --output-folder ./results --verbose
        """
    )

    parser.add_argument(
        "--input-folder",
        type=str,
        required=True,
        help="Path to folder containing input CSV/JSON files",
    )

    parser.add_argument(
        "--output-folder",
        type=str,
        default=None,
        help="Path to folder for output reports (default: input_folder/output)",
    )

    parser.add_argument(
        "--priority-mode",
        type=str,
        choices=[m.value for m in PriorityMode],
        default=PriorityMode.LEG_PRIORITY.value,
        help="Priority mode for scheduling optimization",
    )

    parser.add_argument(
        "--config",
        type=str,
        default=None,
        help="Path to YAML config file with priority settings",
    )

    parser.add_argument(
        "--time-limit",
        type=int,
        default=60,
        help="Solver time limit in seconds (default: 60)",
    )

    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose logging output",
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Load data and build model but don't solve",
    )

    return parser.parse_args(args)


def validate_args(args: argparse.Namespace) -> None:
    """
    Validate command-line arguments.

    Args:
        args: Parsed arguments

    Raises:
        FileNotFoundError: If input folder doesn't exist
        ValueError: If argument values are invalid
    """
    input_path = Path(args.input_folder)
    if not input_path.exists():
        raise FileNotFoundError(f"Input folder not found: {input_path}")

    if not input_path.is_dir():
        raise ValueError(f"Input path is not a directory: {input_path}")

    if args.config is not None:
        config_path = Path(args.config)
        if not config_path.exists():
            raise FileNotFoundError(f"Config file not found: {config_path}")


__all__ = ["parse_args", "validate_args"]
```

---

### Task 3.2: Create orchestrator module

**Files:**
- Create: `orchestrator.py`

**Step 1: Create orchestrator.py**

```python
"""Pipeline orchestration for the planning solver."""

import logging
from pathlib import Path
from typing import Optional

from .data.loader import load_data
from .model import build_model
from .solver.engine import solve_model, extract_solution
from .reports.csv_reports import generate_schedule_csv
from .config import (
    PriorityMode,
    create_priority_config,
    load_priority_config_from_dict,
)
from .domain import PlanningData
from .utils.profiling import timeit


logger = logging.getLogger(__name__)


@timeit
def run_planning_pipeline(
    input_folder: str,
    output_folder: Optional[str] = None,
    priority_mode: PriorityMode = PriorityMode.LEG_PRIORITY,
    priority_config_path: Optional[str] = None,
    time_limit: int = 60,
    dry_run: bool = False,
) -> dict:
    """
    Run the complete planning pipeline.

    Orchestrates the four phases:
    1. Load input data
    2. Build CP-SAT model
    3. Solve for optimal schedule
    4. Generate reports

    Args:
        input_folder: Path to input data folder
        output_folder: Path for output reports (default: input_folder/output)
        priority_mode: Scheduling priority mode
        priority_config_path: Optional path to priority config YAML
        time_limit: Solver time limit in seconds
        dry_run: If True, skip solving phase

    Returns:
        Dict with pipeline results (status, solution, stats)

    Raises:
        FileNotFoundError: If input files not found
        ValueError: If data validation fails
    """
    # Setup output path
    input_path = Path(input_folder)
    output_path = Path(output_folder) if output_folder else input_path / "output"
    output_path.mkdir(parents=True, exist_ok=True)

    logger.info(f"Starting planning pipeline: mode={priority_mode.value}")

    # Phase 1: Load data
    logger.info("Phase 1: Loading input data...")
    planning_data = load_data(input_folder)
    logger.info(f"Loaded {planning_data.leg_count} legs, {planning_data.test_count} tests")

    # Load priority configuration
    if priority_config_path:
        import yaml
        with open(priority_config_path) as f:
            config_dict = yaml.safe_load(f)
        priority_config = load_priority_config_from_dict(config_dict, priority_mode)
    else:
        priority_config = create_priority_config(priority_mode)

    # Phase 2: Build model
    logger.info("Phase 2: Building CP-SAT model...")
    schedule_model = build_model(planning_data, priority_mode, priority_config)
    logger.info(f"Model built with {len(schedule_model.leg_intervals)} leg variables")

    if dry_run:
        logger.info("Dry run mode - skipping solve phase")
        return {
            "status": "dry_run",
            "planning_data": planning_data,
            "schedule_model": schedule_model,
        }

    # Phase 3: Solve
    logger.info("Phase 3: Solving model...")
    solver = solve_model(schedule_model.model, time_limit=time_limit)
    logger.info(f"Solver status: {solver.StatusName()}")

    if solver.StatusName() != "OPTIMAL" and solver.StatusName() != "FEASIBLE":
        return {
            "status": "no_solution",
            "solver_status": solver.StatusName(),
        }

    # Phase 4: Extract and report
    logger.info("Phase 4: Extracting solution and generating reports...")
    solution = extract_solution(solver, schedule_model, planning_data)

    # Generate reports
    generate_schedule_csv(solution, output_path / "schedule.csv")
    logger.info(f"Reports written to {output_path}")

    return {
        "status": "success",
        "solution": solution,
        "solver_status": solver.StatusName(),
        "output_folder": str(output_path),
    }


__all__ = ["run_planning_pipeline"]
```

---

### Task 3.3: Refactor main.py to minimal entry point

**Files:**
- Modify: `main.py`

**Step 1: Simplify main.py**

```python
#!/usr/bin/env python3
"""
Planning Solver Entry Point.

This script provides the CLI entry point for the planning solver.
For programmatic usage, see orchestrator.run_planning_pipeline().
"""

import sys
import logging

from .cli import parse_args, validate_args
from .orchestrator import run_planning_pipeline
from .config import PriorityMode


def setup_logging(verbose: bool = False) -> None:
    """Configure logging level based on verbosity."""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )


def main() -> int:
    """
    Main entry point for the planning solver.

    Returns:
        Exit code (0 for success, non-zero for errors)
    """
    args = parse_args()

    try:
        validate_args(args)
    except (FileNotFoundError, ValueError) as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

    setup_logging(verbose=args.verbose)

    try:
        priority_mode = PriorityMode(args.priority_mode)
    except ValueError:
        print(f"Invalid priority mode: {args.priority_mode}", file=sys.stderr)
        return 1

    result = run_planning_pipeline(
        input_folder=args.input_folder,
        output_folder=args.output_folder,
        priority_mode=priority_mode,
        priority_config_path=args.config,
        time_limit=args.time_limit,
        dry_run=args.dry_run,
    )

    if result["status"] == "success":
        print(f"Schedule generated: {result['output_folder']}")
        return 0
    elif result["status"] == "dry_run":
        print("Dry run completed successfully")
        return 0
    else:
        print(f"Solver failed: {result.get('solver_status', 'unknown')}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
```

---

### Task 3.4: Update test imports and run tests

**Step 1: Run tests**

Run: `pytest tests/ -v`
Expected: All tests pass

**Step 2: Commit**

```bash
git add cli.py orchestrator.py main.py tests/
git commit -m "refactor: extract CLI and orchestration from main.py

- Create cli.py for argument parsing (~100 lines)
- Create orchestrator.py for pipeline coordination (~150 lines)
- Reduce main.py to minimal entry point (~70 lines)
- Improves separation of concerns and testability"
```

---

## Phase 4: Reorganize data loading

**Estimated time:** 30 minutes

### Task 4.1: Create data/ package structure

**Files:**
- Create: `data/__init__.py`
- Create: `data/loader.py`
- Create: `data/validation.py`

**Step 1: Create data/__init__.py**

```python
"""
Data loading and validation for the planning solver.

This package handles loading input data (CSV, JSON files)
and validating data integrity and consistency.
"""

from .loader import load_data

__all__ = ["load_data"]
```

**Step 2: Refactor data_loader.py into data/loader.py**

Move the loading functions to `data/loader.py`, keeping the main `load_data()` function.

**Step 3: Create data/validation.py**

```python
"""Data validation functions."""

import re
from datetime import date
from typing import Dict, List, Set

from ..domain import PlanningData, Leg, Test


def validate_week_format(week_str: str) -> bool:
    """
    Validate ISO week format: YYYY-Www.f

    Args:
        week_str: Week string to validate

    Returns:
        True if format is valid
    """
    pattern = r"^\d{4}-W\d{2}\.\d$"
    return bool(re.match(pattern, week_str))


def validate_data(planning_data: PlanningData) -> List[str]:
    """
    Validate planning data for consistency.

    Args:
        planning_data: The planning data to validate

    Returns:
        List of validation errors (empty if valid)
    """
    errors = []

    # Check for orphan tests (tests with non-existent legs)
    for test_name, test in planning_data.tests.items():
        if test.leg and test.leg not in planning_data.legs:
            errors.append(f"Test '{test_name}' references unknown leg '{test.leg}'")

    # Check for missing predecessor legs
    for leg_name, leg in planning_data.legs.items():
        for pred in leg.predecessors or []:
            if pred not in planning_data.legs:
                errors.append(
                    f"Leg '{leg_name}' has unknown predecessor '{pred}'"
                )

    # Check for circular dependencies
    cycles = detect_cycles(planning_data.legs)
    for cycle in cycles:
        errors.append(f"Circular dependency detected: {' -> '.join(cycle)}")

    return errors


def detect_cycles(legs: Dict[str, Leg]) -> List[List[str]]:
    """
    Detect circular dependencies in leg predecessors.

    Args:
        legs: Dict of leg name to Leg objects

    Returns:
        List of cycles found (each cycle is a list of leg names)
    """
    cycles = []
    visited = set()
    rec_stack = set()

    def dfs(leg_name: str, path: List[str]) -> None:
        visited.add(leg_name)
        rec_stack.add(leg_name)
        path.append(leg_name)

        leg = legs.get(leg_name)
        if leg and leg.predecessors:
            for pred in leg.predecessors:
                if pred not in visited:
                    dfs(pred, path.copy())
                elif pred in rec_stack:
                    # Found cycle
                    cycle_start = path.index(pred)
                    cycle = path[cycle_start:] + [pred]
                    cycles.append(cycle)

        rec_stack.remove(leg_name)

    for leg_name in legs:
        if leg_name not in visited:
            dfs(leg_name, [])

    return cycles


__all__ = ["validate_week_format", "validate_data", "detect_cycles"]
```

---

### Task 4.2: Update imports and commit

**Files:**
- Modify: `orchestrator.py`
- Modify: All files importing from data_loader.py

**Step 1: Update imports**

```python
# Change from:
from .data_loader import load_data

# To:
from .data import load_data
```

**Step 2: Run tests**

Run: `pytest tests/ -v`
Expected: All tests pass

**Step 3: Commit**

```bash
git add data/ orchestrator.py main.py tests/
git rm data_loader.py  # Remove old file
git commit -m "refactor: reorganize data loading into data/ package

- Create data/ package with loader.py and validation.py
- Extract validation logic to separate module
- Rename data_loader.py to data/loader.py
- Improves modularity and testability"
```

---

## Phase 5: Create Tests for New Structure

**Estimated time:** 45 minutes

### Task 5.1: Create objective tests

**Files:**
- Create: `tests/model/objectives/test_leg_priority.py`

**Step 1: Write tests for LegPriorityObjective**

```python
"""Tests for LEG_PRIORITY objective."""

import pytest
from unittest.mock import Mock, MagicMock
from datetime import date

from solver.model.objectives.leg_priority import LegPriorityObjective
from solver.model.schedule_model import ScheduleModel
from solver.domain import Leg, PlanningData
from solver.config import LegPriorityConfig


def test_leg_priority_objective_name():
    """Test objective name is correct."""
    assert LegPriorityObjective.name() == "LEG_PRIORITY"


def test_leg_priority_objective_weights_higher_priority_more():
    """Test that higher priority legs get more weight."""
    model = MagicMock()
    schedule_model = Mock(spec=ScheduleModel)
    schedule_model.leg_intervals = {}
    
    # Create mock interval
    mock_interval = MagicMock()
    mock_interval.EndExpr.return_value = MagicMock()
    schedule_model.leg_intervals["leg_a"] = mock_interval
    schedule_model.leg_intervals["leg_b"] = mock_interval
    
    planning_data = PlanningData(
        legs={
            "leg_a": Leg(name="leg_a", tests=["t1"], priority=10),
            "leg_b": Leg(name="leg_b", tests=["t2"], priority=90),
        },
        tests={},
    )
    
    config = LegPriorityConfig(
        default_priority_weight=1.0,
        priority_multiplier=1.0,
    )
    
    objective = LegPriorityObjective(
        model, schedule_model, planning_data, config
    )
    
    # Should add 2 terms to objective (for 2 legs)
    result = objective.add_to_model()
    assert result is not None
    model.Minimize.assert_called_once()


def test_leg_priority_skips_missing_intervals():
    """Test that legs without intervals are skipped."""
    model = MagicMock()
    schedule_model = Mock(spec=ScheduleModel)
    schedule_model.leg_intervals = {}  # Empty - no intervals
    
    planning_data = PlanningData(
        legs={"leg_a": Leg(name="leg_a", tests=["t1"])},
        tests={},
    )
    
    config = LegPriorityConfig()
    
    objective = LegPriorityObjective(
        model, schedule_model, planning_data, config
    )
    
    result = objective.add_to_model()
    assert result is None
    model.Minimize.assert_not_called()
```

---

### Task 5.2: Create constraint tests

**Files:**
- Create: `tests/model/constraints/test_sequencing.py`

**Step 1: Write tests for sequencing constraints**

```python
"""Tests for sequencing constraints."""

import pytest
from unittest.mock import Mock, MagicMock

from solver.model.constraints.sequencing import add_sequencing_constraints
from solver.model.schedule_model import ScheduleModel
from solver.domain import Test, PlanningData


def test_sequencing_adds_predecessor_constraint():
    """Test that predecessor tests must finish before successor starts."""
    model = MagicMock()
    schedule_model = Mock(spec=ScheduleModel)
    
    # Create mock intervals
    pred_interval = MagicMock()
    pred_interval.EndExpr.return_value = "pred_end"
    
    succ_interval = MagicMock()
    succ_interval.StartExpr.return_value = "succ_start"
    
    schedule_model.test_intervals = {
        "test_a": pred_interval,
        "test_b": succ_interval,
    }
    
    planning_data = PlanningData(
        legs={},
        tests={
            "test_a": Test(name="test_a"),
            "test_b": Test(name="test_b", predecessor_tests=["test_a"]),
        },
    )
    
    add_sequencing_constraints(model, schedule_model, planning_data)
    
    # Should add constraint: pred_end <= succ_start
    model.Add.assert_called_once()


def test_sequencing_handles_missing_predecessor():
    """Test that missing predecessors are gracefully handled."""
    model = MagicMock()
    schedule_model = Mock(spec=ScheduleModel)
    
    succ_interval = MagicMock()
    succ_interval.StartExpr.return_value = "succ_start"
    
    schedule_model.test_intervals = {
        "test_b": succ_interval,
    }
    
    planning_data = PlanningData(
        legs={},
        tests={
            "test_b": Test(name="test_b", predecessor_tests=["nonexistent"]),
        },
    )
    
    # Should not raise, just skip the constraint
    add_sequencing_constraints(model, schedule_model, planning_data)
    
    model.Add.assert_not_called()
```

---

### Task 5.3: Run all tests and verify coverage

**Step 1: Run tests**

Run: `pytest tests/ -v --cov=solver --cov-report=term-missing`
Expected: Improved coverage for new modules

**Step 2: Commit**

```bash
git add tests/
git commit -m "test: add tests for refactored objectives and constraints

- Add tests for LegPriorityObjective
- Add tests for sequencing constraints
- Verify objective weighting logic
- Verify constraint generation"
```

---

## Phase 6: Documentation and Final Cleanup

**Estimated time:** 20 minutes

### Task 6.1: Update AGENTS.md with new structure

**Files:**
- Modify: `AGENTS.md`

**Step 1: Add module documentation**

Ensure AGENTS.md documents the new package structure and design decisions.

---

### Task 6.2: Create package-level docstrings

**Files:**
- Modify: All `__init__.py` files

**Step 1: Ensure all packages have docstrings**

Each `__init__.py` should have a docstring explaining the package purpose.

---

### Task 6.3: Final verification

**Step 1: Run full test suite**

Run: `pytest tests/ -v`
Expected: All tests pass

**Step 2: Run the solver on example data**

Run: `python main.py --input-folder examples/data --dry-run`
Expected: Dry run completes successfully

**Step 3: Final commit**

```bash
git add .
git commit -m "docs: update documentation for refactored structure

- Update AGENTS.md with new module organization
- Add docstrings to all __init__.py files
- Document design decisions and SOLID principles applied"
```

---

## Summary of Changes

| Phase | Description | Files Modified | Lines Changed |
|-------|-------------|----------------|---------------|
| 1 | Extract domain models | domain/*.py, data_loader.py | ~500 extracted |
| 2 | Split model_builder.py | model/**/*.py | ~973 split |
| 3 | Extract CLI & orchestration | cli.py, orchestrator.py, main.py | ~500 extracted |
| 4 | Reorganize data loading | data/*.py | ~200 extracted |
| 5 | Add tests | tests/**/*.py | ~200 added |
| 6 | Documentation | AGENTS.md, __init__.py files | ~100 updated |

## Benefits of Refactoring

1. **Single Responsibility**: Each file has ~100-300 lines with one clear purpose
2. **Open/Closed**: New objective modes can be added by creating a new class
3. **Testability**: Objectives and constraints can be unit tested independently
4. **Discoverability**: Clear package structure makes navigation intuitive
5. **Maintainability**: Smaller files are easier to understand and modify

---

**Plan complete and saved to `docs/plans/2026-02-14-refactoring-organization-structure.md`.**

Two execution options:

1. **Subagent-Driven (this session)** - Fresh subagent per task, review between tasks, fast iteration
2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach would you like?