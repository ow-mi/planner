# planner_v4/model_builder.py

"""
Builds the constraint programming model using Google OR-Tools CP-SAT solver.

This module constructs the mathematical optimization model for the test planning problem.
It translates planning constraints into CP-SAT variables and constraints, creating a
comprehensive model that captures all scheduling requirements, resource limitations,
and priority rules.

Model Components:
- Decision Variables: Test start/end times, resource assignments, makespan
- Temporal Constraints: Leg sequencing, test dependencies, deadline constraints
- Resource Constraints: FTE and equipment availability, capacity limits
- Priority Constraints: Weighted objective functions for priority optimization
- Precedence Constraints: Leg dependencies and test sequencing within legs

Key Functions:
    build_model: Main model construction function
    add_temporal_constraints: Time-based constraint modeling
    add_resource_nonoverlap_constraints: Resource non-overlap modeling
    add_resource_availability_constraints: Resource availability window modeling
    add_precedence_constraints: Dependency and sequencing constraints
    add_objective_function: Multi-objective optimization setup

Classes:
    ScheduleModel: Container for CP-SAT model and variables

Optimization Objectives:
- Minimize makespan (total project duration)
- Maximize priority-weighted completion
- Balance resource utilization
- Respect all hard constraints

Constraint Types:
- Hard Constraints: Must be satisfied (resource limits, dependencies)
- Soft Constraints: Preferential (priorities, deadlines)
- Global Constraints: Complex logical relationships
"""

import math
import logging
from datetime import date, timedelta
from typing import Dict, List, Tuple, Set, Optional
from ortools.sat.python import cp_model
from .data_loader import PlanningData, Test, Leg, ResourceWindow
from .config.priority_modes import (
    PriorityMode,
    BasePriorityConfig,
    LegPriorityConfig,
    EndDatePriorityConfig,
    EndDateStickyConfig,
    LegEndDatesConfig,
    ResourceBottleneckConfig,
    TestProximityConfig,
    create_priority_config,
)
from .config.settings import ForcedStartConflict
from .utils.profiling import timeit
from .utils.intervals import merge_intervals
from .utils.week_utils import parse_iso_week

logger = logging.getLogger(__name__)


class ScheduleModel:
    """
    Container for the CP-SAT model and associated decision variables.

    This class encapsulates the complete constraint programming model, including
    the CP-SAT model instance and all decision variables used in the optimization.
    It provides a structured interface for model construction and variable access.

    Attributes:
        model (cp_model.CpModel): The CP-SAT constraint programming model
        test_vars (Dict): Test scheduling variables {test_id -> (start_var, end_var, duration)}
        resource_assignments (Dict): Resource assignment variables
            {(test_id, resource_type, resource_id) -> bool_var}
        makespan_var (IntVar): Variable representing total project duration
        conflicts (List[ForcedStartConflict]): List of detected conflicts for tests with forced start times
        horizon (int): Maximum time horizon in days for the scheduling problem
        test_to_index (Dict): Mapping from test_id to array index for efficient access
        resource_to_tests (Dict): Mapping from resource_id to list of compatible test_ids

    Decision Variables:
        - Test start times: Integer variables representing start day offsets
        - Test end times: Integer variables representing end day offsets
        - Resource assignments: Boolean variables for resource-test assignments
        - Makespan: Single integer variable for total project duration

    Example:
        >>> model_container = ScheduleModel()
        >>> # Model gets populated during build_model() call
        >>> print(f"Horizon: {model_container.horizon} days")
        >>> print(f"Tests modeled: {len(model_container.test_vars)}")

    Note:
        All variables are created during the model building process. The container
        provides efficient lookup and access patterns for constraint construction.
    """

    def __init__(self):
        self.model = cp_model.CpModel()
        self.test_vars = {}  # test_id -> (start_var, end_var, duration)
        self.resource_assignments = {}  # (test_id, resource_type, resource_id) -> bool_var
        self.makespan_var = None
        self.conflicts: List[ForcedStartConflict] = []
        self.horizon = 0

        # Mappings for easy lookup
        self.test_to_index = {}
        self.resource_to_tests = {}  # resource_id -> list of test_ids that can use it


def get_time_horizon(data: PlanningData) -> int:
    """
    Calculate a reasonable time horizon for the scheduling problem in days.

    The time horizon determines the maximum possible scheduling window for the
    optimization problem. It must be large enough to accommodate all tests
    while remaining computationally feasible.

    Calculation Method:
    1. Find earliest leg start date as baseline
    2. Sum all test durations as upper bound estimate
    3. Apply 50% buffer for scheduling flexibility
    4. Ensure minimum horizon of 365 days for complex projects

    Args:
        data (PlanningData): Planning data with legs and tests

    Returns:
        int: Time horizon in days from project start date

    Example:
        >>> # For 10 tests averaging 5 days each = 50 days total
        >>> horizon = get_time_horizon(data)  # Returns 75 (50 * 1.5)
        >>> # Minimum horizon is 365 days
        >>> min_horizon = get_time_horizon(small_data)  # Returns 365

    Note:
        The 50% buffer accounts for resource conflicts, dependencies, and
        scheduling inefficiencies that may extend actual project duration.
    """
    # Start from earliest leg start date
    earliest_start = min(
        leg.start_monday for leg in data.legs.values() if leg.start_monday
    )

    # Sum all test durations as an upper bound
    total_duration = sum(test.duration_days for test in data.tests)

    # Add some buffer (50% more time)
    horizon_days = int(total_duration * 1.5)

    # Ensure minimum horizon of 365 days for flexibility
    return max(horizon_days, 365)


def date_to_day_offset(target_date: date, start_date: date) -> int:
    """Convert a date to day offset from start_date."""
    if target_date is None:
        return 0
    return (target_date - start_date).days


@timeit
def build_resource_assignments(
    model: ScheduleModel, data: PlanningData, start_date: date
):
    """
    Create resource assignment variables and constraints.
    """
    # Get all unique resource IDs
    fte_ids = set(w.resource_id for w in data.fte_windows)
    equipment_ids = set(w.resource_id for w in data.equipment_windows)

    # Create assignment variables for each test-resource combination
    for test in data.tests:
        test_id = test.test_id

        def resolve_compatible_resources(
            assignment_value,
            available_ids,
            prefix,
        ):
            normalized_values = (
                assignment_value
                if isinstance(assignment_value, list)
                else [assignment_value]
            )
            compatible_ids = set()
            for value in normalized_values:
                token = str(value).strip()
                if not token:
                    continue
                if token == "*":
                    compatible_ids.update(available_ids)
                    continue
                if token.startswith(prefix):
                    if token in available_ids:
                        compatible_ids.add(token)
                        continue
                    compatible_ids.update(
                        rid for rid in available_ids if rid.startswith(token + "_")
                    )
                    continue
                if token in available_ids:
                    compatible_ids.add(token)
            return sorted(compatible_ids)

        # FTE assignments
        compatible_ftes = resolve_compatible_resources(
            test.fte_assigned, fte_ids, "fte_"
        )
        if test.fte_required > len(compatible_ftes):
            raise ValueError(
                f"Test {test_id} requires {test.fte_required} FTE resource(s) "
                f"but only {len(compatible_ftes)} compatible option(s) were found"
            )

        for fte_id in compatible_ftes:
            var_name = f"assign_fte_{test_id}_{fte_id}"
            assign_var = model.model.NewBoolVar(var_name)
            model.resource_assignments[(test_id, "fte", fte_id)] = assign_var

            # Track which tests can use this resource
            if fte_id not in model.resource_to_tests:
                model.resource_to_tests[fte_id] = []
            model.resource_to_tests[fte_id].append(test_id)

        # Equipment assignments
        compatible_equipment = resolve_compatible_resources(
            test.equipment_assigned, equipment_ids, "setup_"
        )
        if test.equipment_required > len(compatible_equipment):
            raise ValueError(
                f"Test {test_id} requires {test.equipment_required} equipment resource(s) "
                f"but only {len(compatible_equipment)} compatible option(s) were found"
            )

        for eq_id in compatible_equipment:
            var_name = f"assign_equipment_{test_id}_{eq_id}"
            assign_var = model.model.NewBoolVar(var_name)
            model.resource_assignments[(test_id, "equipment", eq_id)] = assign_var

            # Track which tests can use this resource
            if eq_id not in model.resource_to_tests:
                model.resource_to_tests[eq_id] = []
            model.resource_to_tests[eq_id].append(test_id)

        # Constraint: Each test must be assigned exactly the required number of each resource type
        fte_assignments = [
            model.resource_assignments.get((test_id, "fte", fid))
            for fid in compatible_ftes
            if (test_id, "fte", fid) in model.resource_assignments
        ]
        if fte_assignments:
            model.model.Add(sum(fte_assignments) == test.fte_required)

        equipment_assignments = [
            model.resource_assignments.get((test_id, "equipment", eid))
            for eid in compatible_equipment
            if (test_id, "equipment", eid) in model.resource_assignments
        ]
        if equipment_assignments:
            model.model.Add(sum(equipment_assignments) == test.equipment_required)


@timeit
def add_sequencing_constraints(model: ScheduleModel, data: PlanningData):
    """
    Add constraints to ensure tests within each leg are executed in sequence.
    """
    # Group tests by leg
    leg_tests = {}
    for test in data.tests:
        if test.project_leg_id not in leg_tests:
            leg_tests[test.project_leg_id] = []
        leg_tests[test.project_leg_id].append(test)

    # Sort tests within each leg by sequence index
    for leg_id, tests in leg_tests.items():
        tests.sort(key=lambda t: t.sequence_index)

        # Add precedence constraints
        for i in range(len(tests) - 1):
            current_test = tests[i]
            next_test = tests[i + 1]

            current_end = model.test_vars[current_test.test_id][1]
            next_start = model.test_vars[next_test.test_id][0]

            # Next test can only start after current test ends
            model.model.Add(next_start >= current_end)


@timeit
def add_resource_nonoverlap_constraints(model: ScheduleModel, data: PlanningData):
    """Prevent tests assigned to the same resource from overlapping."""
    # Pre-calculate test and resource lookups
    tests_by_id = {test.test_id: test for test in data.tests}

    # No-overlap constraint for each resource
    for resource_id, test_ids in model.resource_to_tests.items():
        if not test_ids:
            continue

        intervals = []
        for test_id in test_ids:
            if test_id in model.test_vars:
                start_var, _, duration = model.test_vars[test_id]
                test = tests_by_id[test_id]

                # Check both FTE and equipment assignments using .get() for safety
                # Do not use 'or' here, as it's not supported for ortools literals
                fte_var = model.resource_assignments.get((test_id, "fte", resource_id))
                eq_var = model.resource_assignments.get(
                    (test_id, "equipment", resource_id)
                )

                assignment_var = fte_var if fte_var is not None else eq_var

                if assignment_var is not None:
                    # Calculate resource-specific duration
                    resource_duration = duration
                    if fte_var is not None and test.fte_time_pct < 100.0:
                        # For FTE with < 100% time, calculate reduced duration
                        # Ensure at least 1 day if required
                        calc_duration = math.ceil(
                            test.duration_days * test.fte_time_pct / 100.0
                        )
                        resource_duration = int(max(1, calc_duration))

                    interval_var = model.model.NewOptionalIntervalVar(
                        start_var,
                        resource_duration,
                        start_var + resource_duration,
                        assignment_var,
                        f"interval_{test_id}_{resource_id}",
                    )
                    intervals.append(interval_var)

        if intervals:
            model.model.AddNoOverlap(intervals)


def _build_resource_windows(
    data: PlanningData, start_date: date
) -> Dict[str, List[Tuple[int, int]]]:
    """Build merged day-offset windows for each resource."""
    resource_windows = {}
    all_windows = data.fte_windows + data.equipment_windows
    for window in all_windows:
        if window.start_monday and window.end_monday:
            start_day = date_to_day_offset(window.start_monday, start_date)
            end_day = date_to_day_offset(window.end_monday, start_date)
            if window.resource_id not in resource_windows:
                resource_windows[window.resource_id] = []
            resource_windows[window.resource_id].append((start_day, end_day))

    # Merge windows for efficiency
    for resource_id in resource_windows:
        resource_windows[resource_id] = merge_intervals(resource_windows[resource_id])

    return resource_windows


def _add_window_membership_constraint(
    model: ScheduleModel,
    start_var: cp_model.IntVar,
    duration_days: int,
    assignment_var: cp_model.IntVar,
    allowed_windows: List[Tuple[int, int]],
    window_name_prefix: str,
):
    """Require a scheduled interval to fit within one allowed window.

    Uses a single domain constraint on start_var (conditioned on assignment_var)
    rather than one BoolVar per window, which scales much better with many windows.
    """
    if assignment_var is None:
        return
    if not allowed_windows:
        # If no availability window exists for this resource, forbid assignment.
        model.model.Add(assignment_var == 0)
        return

    feasible_start_intervals = []
    for start, end in allowed_windows:
        latest_start = end - int(duration_days)
        if latest_start >= start:
            feasible_start_intervals.append([int(start), int(latest_start)])

    if not feasible_start_intervals:
        model.model.Add(assignment_var == 0)
        return

    domain = cp_model.Domain.FromIntervals(feasible_start_intervals)
    model.model.AddLinearExpressionInDomain(start_var, domain).OnlyEnforceIf(
        assignment_var
    )


@timeit
def add_resource_availability_constraints(
    model: ScheduleModel, data: PlanningData, start_date: date
):
    """Restrict assigned test execution to each resource's availability windows."""
    resource_windows = _build_resource_windows(data, start_date)
    tests_by_id = {test.test_id: test for test in data.tests}

    # Add availability constraints per assignment variable (avoids O(tests * resources)).
    for (test_id, resource_type, resource_id), assignment_var in (
        model.resource_assignments.items()
    ):
        test = tests_by_id.get(test_id)
        if not test:
            continue

        start_var, _end_var, duration = model.test_vars[test_id]
        resource_duration = int(duration)
        if resource_type == "fte" and test.fte_time_pct < 100.0:
            calc_duration = math.ceil(test.duration_days * test.fte_time_pct / 100.0)
            resource_duration = int(max(1, calc_duration))

        allowed_windows = resource_windows.get(resource_id, [])
        _add_window_membership_constraint(
            model,
            start_var,
            resource_duration,
            assignment_var,
            allowed_windows,
            f"{test_id}_in_{resource_type}_window_{resource_id}",
        )


@timeit
def add_leg_start_constraints(
    model: ScheduleModel,
    data: PlanningData,
    start_date: date,
    priority_config: Optional[BasePriorityConfig] = None,
):
    """
    Add constraints for leg start times and forced test start times.
    """
    # Group tests by leg for leg start constraints
    leg_tests = {}
    for test in data.tests:
        if test.project_leg_id not in leg_tests:
            leg_tests[test.project_leg_id] = []
        leg_tests[test.project_leg_id].append(test)

    configured_leg_starts: Dict[str, date] = {}
    if (
        priority_config
        and getattr(priority_config, "mode", None) == PriorityMode.LEG_END_DATES
    ):
        raw_leg_starts = getattr(priority_config, "leg_start_deadlines", {}) or {}
        configured_leg_starts, unmatched_leg_start_keys = resolve_leg_deadline_ids(
            raw_leg_starts,
            set(data.legs.keys()),
        )
        if unmatched_leg_start_keys:
            logger.warning(
                "LEG_END_DATES: %d start deadline key(s) did not match any loaded leg id: %s",
                len(unmatched_leg_start_keys),
                unmatched_leg_start_keys[:10],
            )
        logger.info(
            "LEG_END_DATES: resolved %d/%d configured start deadline key(s) to loaded legs",
            len(configured_leg_starts),
            len(raw_leg_starts),
        )

    # Leg start time constraints
    for leg_id, tests in leg_tests.items():
        leg = data.legs[leg_id]
        effective_leg_start = leg.start_monday
        configured_start = configured_leg_starts.get(leg_id)
        if configured_start and (
            effective_leg_start is None or configured_start > effective_leg_start
        ):
            effective_leg_start = configured_start

        if not effective_leg_start:
            continue

        leg_start_day = date_to_day_offset(effective_leg_start, start_date)
        for test in tests:
            if test.test_id in model.test_vars:
                test_start = model.test_vars[test.test_id][0]
                model.model.Add(test_start >= leg_start_day)

    # Forced start time constraints - FLEXIBLE CONSTRAINT (at or after)
    # Tests with force_start_week_iso MUST start at or after that week
    forced_tests: List[
        Tuple[str, int]
    ] = []  # Track (test_id, forced_day) for conflict detection

    for test in data.tests:
        if test.force_start_week_iso and test.test_id in model.test_vars:
            forced_start_date = parse_iso_week(test.force_start_week_iso)
            if forced_start_date:
                forced_start_day = date_to_day_offset(forced_start_date, start_date)
                test_start = model.test_vars[test.test_id][0]

                # CONSTRAINT: Test must start AT OR AFTER the forced week (flexible)
                model.model.Add(test_start >= forced_start_day)

                forced_tests.append((test.test_id, forced_start_day))
                print(
                    f"  FLEXIBLE: Forced test {test.test_id} to start at or after day {forced_start_day} (week {test.force_start_week_iso})"
                )

    # Detect potential conflicts: Multiple tests forced to same time with overlapping resources
    if len(forced_tests) >= 2:
        # Note: Full conflict detection happens during solve, but we can record conflicts here
        day_groups: Dict[int, List[str]] = {}
        for test_id, day in forced_tests:
            if day not in day_groups:
                day_groups[day] = []
            day_groups[day].append(test_id)

        for day, tests_at_day in day_groups.items():
            if len(tests_at_day) > 1:
                conflict = ForcedStartConflict(
                    day=day,
                    test_ids=tests_at_day.copy(),
                    message=f"{len(tests_at_day)} tests forced to same day {day}: {tests_at_day}. This may cause resource conflicts or infeasibility.",
                )
                model.conflicts.append(conflict)


@timeit
def add_leg_dependency_constraints(model: ScheduleModel, data: PlanningData):
    """
    Add constraints for leg dependencies.

    Ensures that successor legs can only start after predecessor legs finish.

    Args:
        model: The model being built
        data: Planning data
    """
    print(f"Adding {len(data.leg_dependencies)} leg dependency constraints...")

    for dependency in data.leg_dependencies:
        predecessor_leg_id = dependency.predecessor_leg_id
        successor_leg_id = dependency.successor_leg_id

        # Find the last test in the predecessor leg
        predecessor_last_test = None
        predecessor_max_sequence = 0
        for test in data.tests:
            if test.project_leg_id == predecessor_leg_id:
                if test.sequence_index > predecessor_max_sequence:
                    predecessor_max_sequence = test.sequence_index
                    predecessor_last_test = test

        # Find the first test in the successor leg
        successor_first_test = None
        for test in data.tests:
            if test.project_leg_id == successor_leg_id and test.sequence_index == 1:
                successor_first_test = test
                break

        # Add constraint: successor leg can only start after predecessor leg finishes
        if (
            predecessor_last_test
            and successor_first_test
            and predecessor_last_test.test_id in model.test_vars
            and successor_first_test.test_id in model.test_vars
        ):
            # Get variables
            _, pred_end_var, _ = model.test_vars[predecessor_last_test.test_id]
            succ_start_var, _, _ = model.test_vars[successor_first_test.test_id]

            # Constraint: successor start >= predecessor end
            model.model.Add(succ_start_var >= pred_end_var)

            print(
                f"  Added dependency: {successor_leg_id} starts after {predecessor_leg_id} finishes"
            )


@timeit
def add_test_proximity_constraints(
    model: ScheduleModel, data: PlanningData, config: TestProximityConfig
) -> List:
    """
    Add test proximity constraints based on pattern matching.

    Forces tests containing specific string patterns to run within a specified
    time window of their immediately preceding tests in the sequence. Uses soft
    constraints with penalties for violations.

    Behavior:
    - For each test matching the patterns (e.g., P-02, P-03)
    - Creates constraint: pattern_test_start <= preceding_test_end + max_gap_days
    - This applies regardless of what the preceding test is
    - Penalty is applied for each day beyond the max_gap_days limit

    Args:
        model: The CP-SAT model container
        data: Planning data with tests
        config: Test proximity configuration

    Returns:
        List of gap violation variables for use in objective function
    """
    print(f"Adding test proximity constraints...")

    rules = config.test_proximity_rules
    patterns = rules.get("patterns", [])
    max_gap_days = int(rules.get("max_gap_days", 30))
    enforce_sequence_order = rules.get("enforce_sequence_order", True)

    gap_violation_vars = []  # Return these for objective function

    # Find tests that match any of the patterns
    pattern_tests = []
    for test in data.tests:
        test_name = test.test_name.lower() if test.test_name else ""
        test_id = test.test_id.lower()
        test_desc = test.test_description.lower() if test.test_description else ""

        # Check if test matches any pattern
        for pattern in patterns:
            pattern_lower = pattern.lower()
            if (
                pattern_lower in test_name
                or pattern_lower in test_id
                or pattern_lower in test_desc
            ):
                pattern_tests.append(test)
                break

    print(
        f"  Found {len(pattern_tests)} tests matching proximity patterns: {[t.test_id for t in pattern_tests]}"
    )

    if not pattern_tests:
        print("  No tests match proximity patterns - skipping proximity constraints")
        return gap_violation_vars

    # Group tests by leg and sort by sequence
    leg_tests = {}
    for test in data.tests:
        if test.project_leg_id not in leg_tests:
            leg_tests[test.project_leg_id] = []
        leg_tests[test.project_leg_id].append(test)

    # Sort tests within each leg by sequence index
    for leg_id in leg_tests:
        leg_tests[leg_id].sort(key=lambda t: t.sequence_index)

    # For each leg, find proximity relationships
    proximity_pairs = []
    for leg_id, tests_in_leg in leg_tests.items():
        # Sort all tests in this leg by sequence
        tests_in_leg.sort(key=lambda t: t.sequence_index)

        # Find pattern tests in this leg and their positions
        for i, test in enumerate(tests_in_leg):
            if test in pattern_tests and test.test_id in model.test_vars:
                # This is a pattern-matched test
                # Find the immediately preceding test (if any)
                if i > 0:  # Not the first test in the leg
                    preceding_test = tests_in_leg[i - 1]
                    if preceding_test.test_id in model.test_vars:
                        proximity_pairs.append((preceding_test, test))

    print(f"  Created {len(proximity_pairs)} proximity pairs")

    # Add proximity constraints for each pair
    for preceding_test, following_test in proximity_pairs:
        preceding_end = model.test_vars[preceding_test.test_id][1]
        following_start = model.test_vars[following_test.test_id][0]

        # Soft constraint: following test should start within max_gap_days of preceding test end
        # following_start <= preceding_end + max_gap_days
        gap_violation = model.model.NewIntVar(
            0, model.horizon, f"gap_{preceding_test.test_id}_{following_test.test_id}"
        )
        model.model.Add(
            gap_violation >= following_start - (preceding_end + max_gap_days)
        )
        model.model.Add(gap_violation >= 0)

        gap_violation_vars.append(gap_violation)

        print(
            f"  Proximity constraint: {following_test.test_id} should start within {max_gap_days} days of {preceding_test.test_id} end"
        )

    return gap_violation_vars


@timeit
def setup_objective_function(
    model: ScheduleModel,
    data: PlanningData,
    priority_config: Optional[BasePriorityConfig],
):
    """
    Set up the objective function based on the specified priority mode.

    Args:
        model: The CP-SAT model container
        data: Planning data
        priority_config: Priority mode configuration (None = default makespan minimization)
    """
    # Create makespan variable
    model.makespan_var = model.model.NewIntVar(0, model.horizon, "makespan")

    # Makespan must be at least as large as the end time of every test
    for test_id, (start_var, end_var, duration) in model.test_vars.items():
        model.model.Add(model.makespan_var >= end_var)

    # Default to end date priority if no config specified
    if priority_config is None:
        priority_config = EndDatePriorityConfig()

    # Handle test proximity constraints if present
    proximity_penalty_terms = []
    if isinstance(priority_config, TestProximityConfig):
        # Add proximity constraints and get gap violation variables
        gap_violation_vars = add_test_proximity_constraints(
            model, data, priority_config
        )

        # Calculate penalty terms for objective function
        rules = priority_config.test_proximity_rules
        penalty_per_day = rules.get("proximity_penalty_per_day", 50.0)

        # Add penalty terms for each gap violation
        for gap_var in gap_violation_vars:
            proximity_penalty_terms.append(int(penalty_per_day) * gap_var)

    # Set up objective based on priority mode and collect objective terms
    base_config = priority_config
    if isinstance(priority_config, TestProximityConfig):
        # Use the wrapped base configuration when proximity rules are applied
        base_config = priority_config.base_config
        if base_config is None:
            base_config = create_priority_config(
                priority_config.mode, weights=priority_config.weights
            )

    # Get objective terms from the base mode
    objective_terms = []
    if base_config.mode == PriorityMode.END_DATE_PRIORITY:
        objective_terms = setup_end_date_priority_objective(model, data, base_config)
    elif base_config.mode == PriorityMode.LEG_PRIORITY:
        objective_terms = setup_leg_priority_objective(model, data, base_config)
    elif base_config.mode == PriorityMode.END_DATE_STICKY:
        objective_terms = setup_end_date_sticky_objective(model, data, base_config)
    elif base_config.mode == PriorityMode.LEG_END_DATES:
        objective_terms = setup_leg_end_dates_objective(model, data, base_config)
    elif base_config.mode == PriorityMode.RESOURCE_BOTTLENECK:
        objective_terms = setup_resource_bottleneck_objective(model, data, base_config)
    else:
        raise ValueError(f"Unknown priority mode: {base_config.mode}")

    # Ensure objective_terms is a list
    if objective_terms is None:
        objective_terms = []

    # Combine with proximity penalty terms
    all_objective_terms = objective_terms + proximity_penalty_terms

    # Set the final objective
    if all_objective_terms:
        model.model.Minimize(sum(all_objective_terms))
    else:
        # Fallback to makespan minimization
        model.model.Minimize(model.makespan_var)


def setup_end_date_priority_objective(
    model: ScheduleModel, data: PlanningData, config: EndDatePriorityConfig
) -> List:
    """Set up pure makespan minimization objective (Mode B)."""
    # Return makespan as the objective term
    return [model.makespan_var]


def setup_leg_priority_objective(
    model: ScheduleModel, data: PlanningData, config: LegPriorityConfig
) -> List:
    """Set up leg priority objective (Mode A)."""
    # Get leg priority weights
    leg_weights = config.leg_weights or {}

    # If priority_sequence is provided, create weights from it
    if config.priority_sequence and not leg_weights:
        for i, leg_id in enumerate(config.priority_sequence):
            # Higher priority (earlier in sequence) gets higher weight
            leg_weights[leg_id] = 1.0 / (i + 1)

    # Normalize weights to sum to 1
    total_weight = sum(leg_weights.values())
    if total_weight > 0:
        leg_weights = {
            leg_id: weight / total_weight for leg_id, weight in leg_weights.items()
        }

    # Create leg completion/start time variables for each leg
    leg_completion_vars = {}
    leg_start_time_vars = {}
    for leg_id in data.legs.keys():
        leg_completion_vars[leg_id] = model.model.NewIntVar(
            0, model.horizon, f"leg_completion_{leg_id}"
        )

        # Leg completion is the max end time of any test in the leg
        leg_test_end_vars = []
        leg_test_start_vars = []
        for test in data.tests:
            if test.project_leg_id == leg_id and test.test_id in model.test_vars:
                start_var, end_var, _ = model.test_vars[test.test_id]
                leg_test_end_vars.append(end_var)
                leg_test_start_vars.append(start_var)

        if leg_test_end_vars:
            model.model.AddMaxEquality(leg_completion_vars[leg_id], leg_test_end_vars)
            leg_start_var = model.model.NewIntVar(
                0, model.horizon, f"leg_start_{leg_id}"
            )
            model.model.AddMinEquality(leg_start_var, leg_test_start_vars)
            leg_start_time_vars[leg_id] = leg_start_var

    # Determine sequencing order based on priority configuration
    priority_order: List[str] = []
    if config.priority_sequence:
        priority_order = [
            leg_id
            for leg_id in config.priority_sequence
            if leg_id in leg_start_time_vars
        ]
    elif leg_weights:
        priority_order = [
            leg_id
            for leg_id, _ in sorted(
                leg_weights.items(), key=lambda item: (-item[1], item[0])
            )
            if leg_id in leg_start_time_vars
        ]

    priority_violation_terms = []

    # Enforce sequencing softly: add slack penalties if lower priority legs start too early
    for prev_leg, next_leg in zip(priority_order, priority_order[1:]):
        prev_completion = leg_completion_vars.get(prev_leg)
        next_start = leg_start_time_vars.get(next_leg)
        if prev_completion is None or next_start is None:
            continue

        violation_var = model.model.NewIntVar(
            0, model.horizon, f"priority_violation_{prev_leg}_{next_leg}"
        )
        model.model.Add(next_start + violation_var >= prev_completion)

        penalty_scale = (
            config.weights["priority_weight"] * config.priority_penalty_per_day
        )
        next_leg_weight = leg_weights.get(next_leg, 1.0)
        if penalty_scale > 0 and next_leg_weight > 0:
            priority_violation_terms.append(
                penalty_scale * next_leg_weight * violation_var
            )

    # Objective: weighted sum of leg completion times + makespan
    objective_terms = []

    # Add weighted leg completion terms
    for leg_id, weight in leg_weights.items():
        if leg_id in leg_completion_vars:
            priority_weight = config.weights["priority_weight"] * weight
            objective_terms.append(priority_weight * leg_completion_vars[leg_id])

    # Add sequencing penalty terms
    objective_terms.extend(priority_violation_terms)

    # Add makespan term
    makespan_weight = config.weights["makespan_weight"]
    objective_terms.append(makespan_weight * model.makespan_var)

    # Return the objective terms
    return objective_terms


def setup_end_date_sticky_objective(
    model: ScheduleModel, data: PlanningData, config: EndDateStickyConfig
) -> List:
    """Set up end date sticky objective (Mode C)."""
    start_date = min(leg.start_monday for leg in data.legs.values() if leg.start_monday)
    target_day = date_to_day_offset(config.target_completion_date, start_date)

    # Late penalty variable (0 if on time, positive if late)
    late_days = model.model.NewIntVar(0, model.horizon, "late_days")
    model.model.Add(late_days >= model.makespan_var - target_day)
    model.model.Add(late_days >= 0)

    # Parallel execution bonus (reward for efficient resource usage)
    # This is a simplified version - could be enhanced to measure actual parallel efficiency
    parallel_bonus = model.model.NewIntVar(0, model.horizon * 10, "parallel_bonus")

    # Simple parallel bonus based on total resource utilization
    # Higher utilization = more parallel work = higher bonus
    total_resource_slots = len(model.resource_assignments)
    utilized_slots = model.model.NewIntVar(0, total_resource_slots, "utilized_slots")

    # Count assigned resource slots
    assignment_vars = list(model.resource_assignments.values())
    model.model.Add(utilized_slots == sum(assignment_vars))

    # Parallel bonus proportional to utilization
    model.model.Add(
        parallel_bonus == config.parallel_execution_bonus * utilized_slots // 100
    )

    # Objective: makespan weight + penalty for being late - bonus for parallel execution
    makespan_term = config.weights["makespan_weight"] * model.makespan_var
    penalty_term = (
        config.weights["priority_weight"] * config.penalty_per_day_late * late_days
    )
    bonus_term = parallel_bonus  # Parallel bonus is separate from priority weights

    # Return the objective terms (note: bonus is subtracted, so it's negative)
    return [makespan_term, penalty_term, -bonus_term]


def setup_leg_end_dates_objective(
    model: ScheduleModel, data: PlanningData, config: LegEndDatesConfig
) -> List:
    """Set up leg end dates objective (Mode D)."""
    start_date = min(leg.start_monday for leg in data.legs.values() if leg.start_monday)

    # Create leg completion time variables and deadline constraints
    leg_completion_vars = {}
    deadline_penalties = []
    compactness_penalties = []
    tests_by_leg: Dict[str, List] = {}
    for test in data.tests:
        tests_by_leg.setdefault(test.project_leg_id, []).append(test)

    resolved_deadline_penalties, unmatched_deadline_penalty_keys = resolve_leg_numeric_ids(
        config.leg_deadline_penalties,
        set(data.legs.keys()),
    )
    resolved_compactness_penalties, unmatched_compactness_penalty_keys = resolve_leg_numeric_ids(
        config.leg_compactness_penalties,
        set(data.legs.keys()),
    )
    if unmatched_deadline_penalty_keys:
        logger.warning(
            "LEG_END_DATES: %d deadline penalty key(s) did not match any loaded leg id: %s",
            len(unmatched_deadline_penalty_keys),
            unmatched_deadline_penalty_keys[:10],
        )
    if unmatched_compactness_penalty_keys:
        logger.warning(
            "LEG_END_DATES: %d compactness penalty key(s) did not match any loaded leg id: %s",
            len(unmatched_compactness_penalty_keys),
            unmatched_compactness_penalty_keys[:10],
        )
    logger.info(
        "LEG_END_DATES: resolved penalty overrides deadline=%d compactness=%d",
        len(resolved_deadline_penalties),
        len(resolved_compactness_penalties),
    )

    # Build per-leg completion and compactness terms.
    for leg_id in data.legs.keys():
        leg_tests = tests_by_leg.get(leg_id) or []
        if not leg_tests:
            continue

        leg_completion_var = model.model.NewIntVar(
            0, model.horizon, f"leg_completion_{leg_id}"
        )
        leg_completion_vars[leg_id] = leg_completion_var

        leg_test_end_vars = []
        leg_test_start_vars = []
        for test in leg_tests:
            start_var, end_var, _ = model.test_vars[test.test_id]
            leg_test_end_vars.append(end_var)
            leg_test_start_vars.append(start_var)

        model.model.AddMaxEquality(leg_completion_var, leg_test_end_vars)
        leg_start_var = model.model.NewIntVar(0, model.horizon, f"leg_start_{leg_id}")
        model.model.AddMinEquality(leg_start_var, leg_test_start_vars)

        compactness_penalty_per_day = resolved_compactness_penalties.get(
            leg_id, config.leg_compactness_penalty_per_day
        )
        if compactness_penalty_per_day > 0:
            sorted_leg_tests = sorted(leg_tests, key=lambda item: item.sequence_index)
            for current_test, next_test in zip(sorted_leg_tests, sorted_leg_tests[1:]):
                current_end = model.test_vars[current_test.test_id][1]
                next_start = model.test_vars[next_test.test_id][0]
                gap_var = model.model.NewIntVar(
                    0,
                    model.horizon,
                    f"leg_gap_{leg_id}_{current_test.test_id}_{next_test.test_id}",
                )
                model.model.Add(gap_var == next_start - current_end)
                compactness_penalties.append(compactness_penalty_per_day * gap_var)

    resolved_deadlines, unmatched_deadline_keys = resolve_leg_deadline_ids(
        config.leg_deadlines,
        set(data.legs.keys()),
    )
    if unmatched_deadline_keys:
        logger.warning(
            "LEG_END_DATES: %d deadline key(s) did not match any loaded leg id: %s",
            len(unmatched_deadline_keys),
            unmatched_deadline_keys[:10],
        )
    logger.info(
        "LEG_END_DATES: resolved %d/%d configured deadline key(s) to loaded legs",
        len(resolved_deadlines),
        len(config.leg_deadlines),
    )

    for leg_id, deadline in resolved_deadlines.items():
        leg_completion_var = leg_completion_vars.get(leg_id)
        if leg_completion_var is None:
            continue

        deadline_penalty_per_day = resolved_deadline_penalties.get(
            leg_id, config.deadline_penalty_per_day
        )
        if deadline_penalty_per_day <= 0:
            continue
        deadline_day = date_to_day_offset(deadline, start_date)
        late_days = model.model.NewIntVar(0, model.horizon, f"late_days_{leg_id}")
        model.model.Add(late_days >= leg_completion_var - deadline_day)
        model.model.Add(late_days >= 0)
        deadline_penalties.append(deadline_penalty_per_day * late_days)

    # Objective:
    # - makespan term for overall finish
    # - priority term for deadline/compactness rules
    # - optional leg-ending force to pull leg completions earlier
    makespan_term = config.weights["makespan_weight"] * model.makespan_var
    penalty_term = config.weights["priority_weight"] * (
        sum(deadline_penalties) + sum(compactness_penalties)
    )
    leg_ending_force = float(getattr(config, "leg_ending_weight", 0.0) or 0.0)
    leg_ending_term = 0
    if leg_ending_force > 0 and leg_completion_vars:
        leg_ending_term = (
            config.weights["makespan_weight"]
            * leg_ending_force
            * sum(leg_completion_vars.values())
        )

    return [makespan_term, penalty_term, leg_ending_term]


def _normalize_leg_deadline_key(raw_key: str) -> str:
    normalized = "".join(
        char.lower() if char.isalnum() else "_" for char in str(raw_key or "").strip()
    )
    while "__" in normalized:
        normalized = normalized.replace("__", "_")
    return normalized.strip("_")


def resolve_leg_deadline_ids(
    configured_deadlines: Dict[str, date],
    available_leg_ids: Set[str],
) -> Tuple[Dict[str, date], List[str]]:
    resolved: Dict[str, date] = {}
    unmatched: List[str] = []
    normalized_lookup: Dict[str, str] = {
        _normalize_leg_deadline_key(leg_id): leg_id for leg_id in available_leg_ids
    }

    for configured_key, deadline in (configured_deadlines or {}).items():
        if configured_key in available_leg_ids:
            resolved[configured_key] = deadline
            continue

        mapped_leg_id = normalized_lookup.get(_normalize_leg_deadline_key(configured_key))
        if mapped_leg_id:
            resolved[mapped_leg_id] = deadline
        else:
            unmatched.append(str(configured_key))

    return resolved, unmatched


def resolve_leg_numeric_ids(
    configured_values: Dict[str, float],
    available_leg_ids: Set[str],
) -> Tuple[Dict[str, float], List[str]]:
    resolved: Dict[str, float] = {}
    unmatched: List[str] = []
    normalized_lookup: Dict[str, str] = {
        _normalize_leg_deadline_key(leg_id): leg_id for leg_id in available_leg_ids
    }

    for configured_key, raw_value in (configured_values or {}).items():
        try:
            numeric_value = float(raw_value)
        except (TypeError, ValueError):
            unmatched.append(str(configured_key))
            continue

        if numeric_value < 0:
            unmatched.append(str(configured_key))
            continue

        if configured_key in available_leg_ids:
            resolved[configured_key] = numeric_value
            continue

        mapped_leg_id = normalized_lookup.get(_normalize_leg_deadline_key(configured_key))
        if mapped_leg_id:
            resolved[mapped_leg_id] = numeric_value
        else:
            unmatched.append(str(configured_key))

    return resolved, unmatched


def setup_resource_bottleneck_objective(
    model: ScheduleModel, data: PlanningData, config: ResourceBottleneckConfig
) -> List:
    """Set up resource bottleneck objective (Mode E)."""
    # Calculate resource utilization variables
    resource_utilization = {}

    for resource_id in model.resource_to_tests.keys():
        # Count how many tests are assigned to this resource
        assigned_tests = []
        for test_id in model.resource_to_tests[resource_id]:
            if test_id in model.test_vars:
                # Check both FTE and equipment assignments
                fte_var = model.resource_assignments.get((test_id, "fte", resource_id))
                eq_var = model.resource_assignments.get(
                    (test_id, "equipment", resource_id)
                )

                if fte_var is not None:
                    assigned_tests.append(fte_var)
                if eq_var is not None:
                    assigned_tests.append(eq_var)

        if assigned_tests:
            # Resource utilization as percentage (0-100)
            utilization = model.model.NewIntVar(0, 100, f"utilization_{resource_id}")
            total_possible = len(assigned_tests) * 100  # Scale to percentage
            assigned_count = sum(assigned_tests) * 100

            # Calculate utilization percentage: (assigned_count / total_possible) * 100
            # Since total_possible = len(assigned_tests) * 100, this simplifies to:
            # utilization = assigned_count / len(assigned_tests)
            # We need to use integer division, so we'll use a constraint approach
            num_tests = len(assigned_tests)
            utilization_scaled = model.model.NewIntVar(
                0, num_tests * 100, f"utilization_scaled_{resource_id}"
            )
            model.model.Add(utilization_scaled == assigned_count)
            model.model.Add(utilization * num_tests == utilization_scaled)

            resource_utilization[resource_id] = utilization

    # Bottleneck penalty: penalize resources above threshold
    bottleneck_penalties = []
    for resource_id, utilization in resource_utilization.items():
        threshold = int(config.bottleneck_threshold * 100)
        over_threshold = model.model.NewIntVar(0, 100, f"over_threshold_{resource_id}")
        model.model.Add(over_threshold >= utilization - threshold)
        model.model.Add(over_threshold >= 0)
        bottleneck_penalties.append(over_threshold)

    # Resource balance objective: minimize variance in utilization
    if len(resource_utilization) > 1:
        utilizations = list(resource_utilization.values())
        avg_utilization = model.model.NewIntVar(0, 100, "avg_utilization")

        # Calculate average utilization using integer division
        # avg_utilization = sum(utilizations) / len(utilizations)
        # We need to use constraint approach for integer division
        num_resources = len(utilizations)
        total_utilization = model.model.NewIntVar(
            0, 100 * num_resources, "total_utilization"
        )
        model.model.Add(total_utilization == sum(utilizations))
        model.model.Add(avg_utilization * num_resources == total_utilization)

        # Sum of absolute deviations from average (balance objective)
        balance_penalty = model.model.NewIntVar(
            0, 100 * len(utilizations), "balance_penalty"
        )
        deviations = []
        for utilization in utilizations:
            deviation = model.model.NewIntVar(0, 100, f"deviation_{len(deviations)}")
            model.model.Add(deviation >= utilization - avg_utilization)
            model.model.Add(deviation >= avg_utilization - utilization)
            deviations.append(deviation)
        model.model.Add(balance_penalty == sum(deviations))
    else:
        balance_penalty = 0

    # Objective: makespan + bottleneck penalties + balance penalties
    makespan_term = config.weights["makespan_weight"] * model.makespan_var
    bottleneck_term = config.weights["priority_weight"] * sum(bottleneck_penalties)
    balance_term = config.resource_balance_weight * balance_penalty

    # Return objective terms
    objective_terms = [makespan_term, bottleneck_term]

    # Add balance term (works for both integer and variable cases)
    objective_terms.append(config.resource_balance_weight * balance_penalty)

    return objective_terms


@timeit
def build_model(
    data: PlanningData, priority_config: Optional[BasePriorityConfig] = None
) -> ScheduleModel:
    """
    Build the complete CP-SAT optimization model from planning data.

    This is the main model construction function that creates the mathematical
    formulation of the test planning problem. It systematically builds all
    decision variables and constraints required for the optimization.

    Model Building Process:
    1. Calculate time horizon based on project scope and constraints
    2. Create decision variables for test scheduling (start/end times)
    3. Add temporal constraints (leg sequencing, test dependencies, deadlines)
    4. Add resource constraints (FTE and equipment availability/capacity)
    5. Add precedence constraints (leg dependencies, test sequencing)
    6. Configure objective function (makespan minimization with priorities)
    7. Build mappings for efficient constraint construction

    Args:
        data (PlanningData): Complete planning data container with legs, tests,
            resources, and configuration. Must be pre-validated.
        priority_config (BasePriorityConfig, optional): Priority mode configuration.
            If None, defaults to pure makespan minimization (END_DATE_PRIORITY).

    Returns:
        ScheduleModel: Fully constructed model container with:
            - CP-SAT model instance with all constraints
            - Decision variables for test scheduling and resource assignments
            - Makespan variable for optimization objective
            - Helper mappings for constraint access
            - Time horizon and project start date information

    Raises:
        ValueError: When data contains invalid configurations or missing dependencies
        RuntimeError: When model construction fails due to constraint conflicts

    Example:
        >>> data = load_data("input_data/gen3_pv/senario_1")
        >>> model = build_model(data)
        >>> print(f"Model built with {len(model.test_vars)} tests")
        >>> print(f"Time horizon: {model.horizon} days")

    Note:
        The model construction is deterministic and repeatable for the same input data.
        All constraints are added as hard constraints that must be satisfied for
        any feasible solution.
    """
    model = ScheduleModel()

    # Calculate time horizon and start date
    model.horizon = get_time_horizon(data)
    start_date = min(leg.start_monday for leg in data.legs.values() if leg.start_monday)

    # Create test variables (start, end, duration)
    for test in data.tests:
        duration = int(test.duration_days)  # Convert to integer days

        start_var = model.model.NewIntVar(
            0, model.horizon - duration, f"start_{test.test_id}"
        )
        end_var = model.model.NewIntVar(duration, model.horizon, f"end_{test.test_id}")

        # Link start, duration, and end
        model.model.Add(end_var == start_var + duration)

        model.test_vars[test.test_id] = (start_var, end_var, duration)
        model.test_to_index[test.test_id] = len(model.test_to_index)

    # Build resource assignment variables and constraints
    build_resource_assignments(model, data, start_date)

    # Add sequencing constraints
    add_sequencing_constraints(model, data)

    # Add non-overlap constraints for shared resources
    add_resource_nonoverlap_constraints(model, data)

    # Add availability window constraints for assigned resources
    add_resource_availability_constraints(model, data, start_date)

    # Add leg start and forced start constraints
    add_leg_start_constraints(model, data, start_date, priority_config)

    # Add leg dependency constraints
    add_leg_dependency_constraints(model, data)

    # Set up objective function based on priority mode
    setup_objective_function(model, data, priority_config)

    return model
