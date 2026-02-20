# planner_v4/solver.py

"""
Handles solving the optimization model using Google OR-Tools CP-SAT solver.

This module manages the execution of the constraint programming optimization,
solution extraction, and result processing. It provides interfaces for
configuring solver parameters, monitoring solve progress, and extracting
comprehensive solution information.

Key Components:
- Solver Execution: CP-SAT solver configuration and execution
- Solution Extraction: Converting solver results to scheduling data
- Result Processing: Building comprehensive solution reports
- Error Handling: Managing solver failures and timeouts
- Performance Monitoring: Tracking solve time and solution quality

Main Functions:
    solve_model: Execute optimization and return solution
    extract_solution: Convert solver variables to scheduling results
    create_test_schedule: Build detailed test scheduling information
    validate_solution: Verify solution feasibility and completeness

Classes:
    TestSchedule: Individual test scheduling result
    SolutionResult: Complete optimization solution container
    SolverStats: Performance and solution quality metrics

Solution Status Types:
    OPTIMAL: Best possible solution found
    FEASIBLE: Good solution found (may not be optimal)
    INFEASIBLE: No solution exists with given constraints
    NO_SOLUTION: Solver failed to find any solution
    TIMEOUT: Time limit exceeded before finding solution

Solver Configuration:
    Time limits, worker threads, search strategies, solution callbacks
"""

from datetime import date, timedelta
from typing import Any, Callable, Dict, List, Optional, Tuple
import hashlib
from dataclasses import dataclass
from ortools.sat.python import cp_model
from .model_builder import ScheduleModel
from .data_loader import PlanningData
from .config import SOLVER_TIME_LIMIT_SECONDS, NUM_SOLVER_WORKERS


@dataclass
class TestSchedule:
    """
    Represents the scheduling result for a single test.

    This dataclass contains all scheduling information for an individual test,
    including timing, resource assignments, and metadata. It serves as the
    atomic unit of scheduling results that gets aggregated into complete
    project schedules.

    Attributes:
        test_id (str): Unique test identifier (primary key)
        project_leg_id (str): Parent leg identifier (foreign key)
        test_name (str): Human-readable test name
        start_day (int): Start day offset from project start (0-based)
        end_day (int): End day offset from project start (0-based)
        duration_days (int): Actual scheduled duration in days
        start_date (date): Absolute start date
        end_date (date): Absolute end date
        assigned_fte (List[str]): List of assigned FTE resource IDs
        assigned_equipment (List[str]): List of assigned equipment resource IDs

    Example:
        >>> schedule = TestSchedule(
        ...     test_id="TEST_001",
        ...     project_leg_id="LEG_001_1",
        ...     test_name="Power Output Test",
        ...     start_day=5,
        ...     end_day=8,
        ...     duration_days=4,
        ...     start_date=date(2024, 1, 5),
        ...     end_date=date(2024, 1, 9),
        ...     assigned_fte=["fte_sofia"],
        ...     assigned_equipment=["EQUIP_SOLAR_001"]
        ... )

    Note:
        Day offsets are relative to the project start date. Duration may differ
        from the original test duration due to scheduling constraints and weekends.
    """

    test_id: str
    project_leg_id: str
    test_name: str
    start_day: int
    end_day: int
    duration_days: int
    start_date: date
    end_date: date
    assigned_fte: List[str]
    assigned_equipment: List[str]


@dataclass
class SolutionResult:
    """Contains the complete solution from the solver."""

    status: str  # "OPTIMAL", "FEASIBLE", "INFEASIBLE", "UNKNOWN"
    makespan_days: int
    objective_value: int
    solve_time_seconds: float
    test_schedules: List[TestSchedule]
    resource_utilization: Dict[str, float]
    start_date: Optional[date] = None


class SolutionCallback(cp_model.CpSolverSolutionCallback):
    """Callback to log intermediate solutions."""

    def __init__(
        self,
        model: ScheduleModel,
        data: PlanningData,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    ):
        super().__init__()
        self._model = model
        self._data = data
        self._solution_count = 0
        self._progress_callback = progress_callback
        self._test_preview_refs = [
            (test.test_id, test.project_leg_id, test.test_name)
            for test in data.tests
            if test.test_id in model.test_vars
        ]
        leg_starts = [
            leg.start_monday
            for leg in getattr(data, "legs", {}).values()
            if getattr(leg, "start_monday", None)
        ]
        self._project_start_date = min(leg_starts) if leg_starts else None

    def on_solution_callback(self):
        self._solution_count += 1
        makespan = self.Value(self._model.makespan_var)
        objective_value = None
        best_bound = None
        try:
            objective_value = float(self.ObjectiveValue())
        except Exception:
            objective_value = None
        try:
            best_bound = float(self.BestObjectiveBound())
        except Exception:
            best_bound = None

        print(f"Solution {self._solution_count}: makespan={makespan}")
        schedule_preview = []
        for test_id, project_leg_id, test_name in self._test_preview_refs:
            start_var, end_var, duration = self._model.test_vars[test_id]
            start_day = int(self.Value(start_var))
            end_day = int(self.Value(end_var))
            schedule_preview.append(
                {
                    "test_id": test_id,
                    "project_leg_id": project_leg_id,
                    "test_name": test_name,
                    "start_day": start_day,
                    "end_day": end_day,
                    "duration_days": int(duration),
                    "start_date": (
                        (self._project_start_date + timedelta(days=start_day)).isoformat()
                        if self._project_start_date is not None
                        else None
                    ),
                    "end_date": (
                        (self._project_start_date + timedelta(days=end_day)).isoformat()
                        if self._project_start_date is not None
                        else None
                    ),
                }
            )
        schedule_preview.sort(key=lambda row: (row["start_day"], row["test_id"]))
        schedule_hash = hashlib.sha1(
            "|".join(
                f'{row["test_id"]}:{row["start_day"]}:{row["end_day"]}'
                for row in schedule_preview
            ).encode("utf-8")
        ).hexdigest()

        if callable(self._progress_callback):
            self._progress_callback(
                {
                    "solution_count": self._solution_count,
                    "makespan": int(makespan),
                    "objective_value": objective_value,
                    "best_bound": best_bound,
                    "wall_time_seconds": float(self.WallTime()),
                    "schedule_preview": schedule_preview,
                    "schedule_hash": schedule_hash,
                }
            )

    def solution_count(self) -> int:
        return self._solution_count


def extract_solution(
    model: ScheduleModel,
    solver: cp_model.CpSolver,
    data: PlanningData,
    status: int,
) -> SolutionResult:
    """
    Extract the solution from the solved model.

    Args:
        model: The solved ScheduleModel
        solver: The CP-SAT solver with solution
        data: Original planning data
    Returns:
        SolutionResult with extracted schedule information
    """
    start_date = min(leg.start_monday for leg in data.legs.values() if leg.start_monday)
    test_schedules = []

    # Extract test schedules
    for test in data.tests:
        test_id = test.test_id
        if test_id in model.test_vars:
            start_var, end_var, duration = model.test_vars[test_id]

            start_day = solver.Value(start_var)
            end_day = solver.Value(end_var)

            # Convert to actual dates
            start_date_actual = start_date + timedelta(days=start_day)
            end_date_actual = start_date + timedelta(days=end_day)

            # Find assigned resources
            assigned_fte = []
            assigned_equipment = []

            for (
                tid,
                resource_type,
                resource_id,
            ), assignment_var in model.resource_assignments.items():
                if tid == test_id and solver.Value(assignment_var):
                    if resource_type == "fte":
                        assigned_fte.append(resource_id)
                    elif resource_type == "equipment":
                        assigned_equipment.append(resource_id)

            schedule = TestSchedule(
                test_id=test_id,
                project_leg_id=test.project_leg_id,
                test_name=test.test_name,
                start_day=start_day,
                end_day=end_day,
                duration_days=duration,
                start_date=start_date_actual,
                end_date=end_date_actual,
                assigned_fte=assigned_fte,
                assigned_equipment=assigned_equipment,
            )
            test_schedules.append(schedule)

    # Sort by start time
    test_schedules.sort(key=lambda t: t.start_day)

    # Calculate resource utilization
    resource_utilization = calculate_resource_utilization(test_schedules, data)

    # Get solver status
    status_map = {
        cp_model.OPTIMAL: "OPTIMAL",
        cp_model.FEASIBLE: "FEASIBLE",
        cp_model.INFEASIBLE: "INFEASIBLE",
        cp_model.UNKNOWN: "UNKNOWN",
    }

    solution = SolutionResult(
        status=status_map.get(status, "UNKNOWN"),
        makespan_days=solver.Value(model.makespan_var)
        if model.makespan_var is not None
        else 0,
        objective_value=solver.ObjectiveValue(),
        solve_time_seconds=solver.WallTime(),
        test_schedules=test_schedules,
        resource_utilization=resource_utilization,
        start_date=start_date,
    )

    return solution


def calculate_resource_utilization(
    test_schedules: List[TestSchedule], data: PlanningData
) -> Dict[str, float]:
    """
    Calculate utilization percentage for each resource.

    Args:
        test_schedules: List of scheduled tests
        data: Original planning data

    Returns:
        Dictionary mapping resource_id to utilization percentage
    """
    utilization = {}

    # Get all resource IDs
    all_resources = set()
    for window in data.fte_windows + data.equipment_windows:
        all_resources.add(window.resource_id)

    # Calculate total available time for each resource
    resource_available_days = {}
    for window in data.fte_windows + data.equipment_windows:
        resource_id = window.resource_id
        if resource_id not in resource_available_days:
            resource_available_days[resource_id] = 0

        # Add days in this availability window
        days_available = (window.end_monday - window.start_monday).days + 1
        resource_available_days[resource_id] += days_available

    # Calculate used time for each resource
    resource_used_days = {rid: 0.0 for rid in all_resources}

    # Create lookup map for tests to access fte_time_pct
    tests_map = {t.test_id: t for t in data.tests}

    for schedule in test_schedules:
        test = tests_map.get(schedule.test_id)
        if not test:
            continue

        # Add used time for assigned FTEs
        for fte_id in schedule.assigned_fte:
            if fte_id in resource_used_days:
                fte_days = float(schedule.duration_days)
                if test.fte_time_pct < 100.0:
                    fte_days = fte_days * test.fte_time_pct / 100.0
                resource_used_days[fte_id] += fte_days

        # Add used time for assigned equipment
        for eq_id in schedule.assigned_equipment:
            if eq_id in resource_used_days:
                resource_used_days[eq_id] += float(schedule.duration_days)

    # Calculate utilization percentages
    for resource_id in all_resources:
        available = resource_available_days.get(
            resource_id, 1
        )  # Avoid division by zero
        used = resource_used_days.get(resource_id, 0)
        utilization[resource_id] = (used / available) * 100.0 if available > 0 else 0.0

    return utilization


def solve_model(
    model: ScheduleModel,
    data: PlanningData,
    time_limit_seconds: float = None,
    progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
) -> Tuple[SolutionResult, date]:
    """
    Execute the CP-SAT optimization and return comprehensive solution results.

    This function manages the complete optimization process, from solver configuration
    through solution extraction and validation. It handles various solver outcomes
    including optimal solutions, feasible solutions, and failure cases.

    Solving Process:
    1. Configure CP-SAT solver with time limits and logging
    2. Execute optimization with progress monitoring
    3. Extract solution if found (optimal or feasible)
    4. Validate solution completeness and feasibility
    5. Build comprehensive result report with statistics

    Args:
        model (ScheduleModel): Complete CP-SAT model with all variables and constraints.
            Must be pre-built using build_model().
        data (PlanningData): Original planning data for context and validation.
            Used to extract meaningful solution information.
        time_limit_seconds (float, optional): Maximum solving time in seconds.
            Defaults to SOLVER_TIME_LIMIT_SECONDS from configuration.

    Returns:
        Tuple[SolutionResult, date]: A tuple containing:
            - Comprehensive solution container with:
            - Solution status (OPTIMAL, FEASIBLE, INFEASIBLE, NO_SOLUTION, TIMEOUT)
            - Makespan (total project duration) if solution found
            - Complete test schedule list with resource assignments
            - Solver performance statistics and timing information
            - Resource utilization data for reporting
            - Start date used for schedule conversion

    Raises:
        RuntimeError: When solver encounters critical internal errors
        ValueError: When input parameters are invalid

    Example:
        >>> model = build_model(data)
        >>> solution = solve_model(model, data, time_limit_seconds=300.0)
        >>> if solution.status == "OPTIMAL":
        ...     print(f"Optimal solution found in {solution.solve_time:.2f}s")
        ...     print(f"Total project duration: {solution.makespan} days")
        ...     print(f"Scheduled {len(solution.test_schedule)} tests")

    Note:
        The solver may return FEASIBLE solutions when optimal solutions cannot
        be proven within the time limit. Both OPTIMAL and FEASIBLE solutions
        are valid and usable.
    """
    if time_limit_seconds is None:
        time_limit_seconds = SOLVER_TIME_LIMIT_SECONDS

    # Create solver
    solver = cp_model.CpSolver()

    # Set solver parameters
    solver.parameters.max_time_in_seconds = time_limit_seconds
    solver.parameters.log_search_progress = True
    solver.parameters.num_search_workers = NUM_SOLVER_WORKERS

    print(f"Starting solver with time limit: {time_limit_seconds} seconds")
    print(f"Using {NUM_SOLVER_WORKERS} worker threads")
    print(f"Model has {len(model.test_vars)} test variables")
    print(f"Model has {len(model.resource_assignments)} resource assignment variables")

    # Create a solution callback to log intermediate solutions
    solution_callback = SolutionCallback(
        model, data, progress_callback=progress_callback
    )

    # Solve the model
    status = solver.Solve(model.model, solution_callback)

    # Print solver statistics
    print(f"Solver finished with status: {solver.StatusName(status)}")
    print(f"Solve time: {solver.WallTime():.2f} seconds")
    print(f"Branches explored: {solver.NumBranches()}")
    print(f"Conflicts: {solver.NumConflicts()}")

    if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
        print(f"Objective value (makespan): {solver.ObjectiveValue()} days")

        # Calculate start date for solution extraction
        start_date = min(
            leg.start_monday for leg in data.legs.values() if leg.start_monday
        )

        # Extract solution
        solution = extract_solution(model, solver, data, status)

        print(f"Successfully scheduled {len(solution.test_schedules)} tests")
        print(f"Final makespan: {solution.makespan_days} days")

        return solution, start_date

    else:
        # Handle infeasible or unknown status
        print("No solution found!")

        if status == cp_model.INFEASIBLE:
            print(
                "The problem is infeasible - no valid schedule exists with the given constraints"
            )
        else:
            print("Solver could not find a solution within the time limit")

        # Calculate start date even for failed solutions
        start_date = min(
            leg.start_monday for leg in data.legs.values() if leg.start_monday
        )

        # Return empty solution with status
        status_map = {
            cp_model.OPTIMAL: "OPTIMAL",
            cp_model.FEASIBLE: "FEASIBLE",
            cp_model.INFEASIBLE: "INFEASIBLE",
            cp_model.UNKNOWN: "UNKNOWN",
        }

        return SolutionResult(
            status=status_map.get(status, "UNKNOWN"),
            makespan_days=0,
            objective_value=0,
            solve_time_seconds=solver.WallTime(),
            test_schedules=[],
            resource_utilization={},
            start_date=start_date,
        ), start_date
