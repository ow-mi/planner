# planner_v2/model_builder.py

"""
Builds the constraint programming model using Google OR-Tools.
"""

from datetime import date, timedelta
from typing import Dict, List, Tuple, Set
from ortools.sat.python import cp_model
from .data_loader import PlanningData, Test, Leg, ResourceWindow


class ScheduleModel:
    """Container for the CP-SAT model and associated variables."""
    
    def __init__(self):
        self.model = cp_model.CpModel()
        self.test_vars = {}  # test_id -> (start_var, end_var, duration)
        self.resource_assignments = {}  # (test_id, resource_type, resource_id) -> bool_var
        self.makespan_var = None
        self.horizon = 0
        
        # Mappings for easy lookup
        self.test_to_index = {}
        self.resource_to_tests = {}  # resource_id -> list of test_ids that can use it


def get_time_horizon(data: PlanningData) -> int:
    """
    Calculate a reasonable time horizon for the scheduling problem in days.
    """
    # Start from earliest leg start date
    earliest_start = min(leg.start_monday for leg in data.legs.values() if leg.start_monday)
    
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


def build_resource_assignments(model: ScheduleModel, data: PlanningData, start_date: date):
    """
    Create resource assignment variables and constraints.
    """
    # Get all unique resource IDs
    fte_ids = set(w.resource_id for w in data.fte_windows)
    equipment_ids = set(w.resource_id for w in data.equipment_windows)
    
    # Create assignment variables for each test-resource combination
    for test in data.tests:
        test_id = test.test_id
        
        # FTE assignments
        if test.fte_assigned == "*":
            # Can be assigned to any FTE
            compatible_ftes = list(fte_ids)
        elif test.fte_assigned.startswith("fte_"):
            # Can be assigned to any FTE matching the type (e.g., fte_sofia matches fte_sofia_1, fte_sofia_2, etc.)
            prefix = test.fte_assigned
            if prefix in fte_ids:
                # Exact match
                compatible_ftes = [prefix]
            else:
                # Pattern match - find FTEs that start with the prefix + "_"
                compatible_ftes = [fid for fid in fte_ids if fid.startswith(prefix + "_")]
        else:
            # Specific FTE assignment
            compatible_ftes = [test.fte_assigned] if test.fte_assigned in fte_ids else []
        
        for fte_id in compatible_ftes:
            var_name = f"assign_fte_{test_id}_{fte_id}"
            assign_var = model.model.NewBoolVar(var_name)
            model.resource_assignments[(test_id, "fte", fte_id)] = assign_var
            
            # Track which tests can use this resource
            if fte_id not in model.resource_to_tests:
                model.resource_to_tests[fte_id] = []
            model.resource_to_tests[fte_id].append(test_id)
        
        # Equipment assignments  
        if test.equipment_assigned == "*":
            # Can be assigned to any equipment
            compatible_equipment = list(equipment_ids)
        elif test.equipment_assigned.startswith("setup_"):
            # Can be assigned to any equipment matching the type (e.g., setup_sofia matches setup_sofia_1, setup_sofia_2, etc.)
            prefix = test.equipment_assigned
            if prefix in equipment_ids:
                # Exact match
                compatible_equipment = [prefix]
            else:
                # Pattern match - find equipment that starts with the prefix + "_"
                compatible_equipment = [eid for eid in equipment_ids if eid.startswith(prefix + "_")]
        else:
            # Specific equipment assignment
            compatible_equipment = [test.equipment_assigned] if test.equipment_assigned in equipment_ids else []
        
        for eq_id in compatible_equipment:
            var_name = f"assign_equipment_{test_id}_{eq_id}"
            assign_var = model.model.NewBoolVar(var_name)
            model.resource_assignments[(test_id, "equipment", eq_id)] = assign_var
            
            # Track which tests can use this resource
            if eq_id not in model.resource_to_tests:
                model.resource_to_tests[eq_id] = []
            model.resource_to_tests[eq_id].append(test_id)
        
        # Constraint: Each test must be assigned exactly the required number of each resource type
        fte_assignments = [model.resource_assignments.get((test_id, "fte", fid)) 
                          for fid in compatible_ftes 
                          if (test_id, "fte", fid) in model.resource_assignments]
        if fte_assignments:
            model.model.Add(sum(fte_assignments) == test.fte_required)
        
        equipment_assignments = [model.resource_assignments.get((test_id, "equipment", eid)) 
                                for eid in compatible_equipment 
                                if (test_id, "equipment", eid) in model.resource_assignments]
        if equipment_assignments:
            model.model.Add(sum(equipment_assignments) == test.equipment_required)


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


def add_resource_constraints(model: ScheduleModel, data: PlanningData, start_date: date):
    """
    Add resource availability and non-overlap constraints.
    """
    # No-overlap constraint for each resource
    for resource_id, test_ids in model.resource_to_tests.items():
        intervals = []
        
        for test_id in test_ids:
            if test_id in model.test_vars:
                start_var, end_var, duration = model.test_vars[test_id]
                
                # Check if this test is actually assigned to this resource
                fte_assigned = (test_id, "fte", resource_id) in model.resource_assignments
                eq_assigned = (test_id, "equipment", resource_id) in model.resource_assignments
                
                if fte_assigned or eq_assigned:
                    # Create interval variable only if resource is assigned
                    fte_var = model.resource_assignments.get((test_id, "fte", resource_id))
                    eq_var = model.resource_assignments.get((test_id, "equipment", resource_id))
                    assignment_var = fte_var if fte_var is not None else eq_var
                    
                    interval_var = model.model.NewOptionalIntervalVar(
                        start_var, duration, end_var, assignment_var,
                        f"interval_{test_id}_{resource_id}"
                    )
                    intervals.append(interval_var)
        
        if intervals:
            model.model.AddNoOverlap(intervals)
    
    # Resource availability constraints - group windows by resource
    resource_windows = {}
    for window in data.fte_windows + data.equipment_windows:
        resource_id = window.resource_id
        if resource_id not in resource_windows:
            resource_windows[resource_id] = []
        window_start = date_to_day_offset(window.start_monday, start_date)
        window_end = date_to_day_offset(window.end_monday, start_date)
        resource_windows[resource_id].append((window_start, window_end))
    
    # For each resource, ensure assigned tests fit within at least one availability window
    for resource_id, windows in resource_windows.items():
        if resource_id in model.resource_to_tests:
            for test_id in model.resource_to_tests[resource_id]:
                if test_id in model.test_vars:
                    start_var, end_var, duration = model.test_vars[test_id]
                    
                    # Check if test is assigned to this resource
                    fte_assigned = model.resource_assignments.get((test_id, "fte", resource_id))
                    eq_assigned = model.resource_assignments.get((test_id, "equipment", resource_id))
                    assignment_var = fte_assigned if fte_assigned is not None else eq_assigned
                    
                    if assignment_var is not None:
                        # Test must fit within at least one availability window
                        window_constraints = []
                        for window_start, window_end in windows:
                            # Create boolean for this window
                            in_window = model.model.NewBoolVar(f"in_window_{test_id}_{resource_id}_{window_start}_{window_end}")
                            # If in this window, test must fit
                            model.model.Add(start_var >= window_start).OnlyEnforceIf(in_window)
                            model.model.Add(end_var <= window_end).OnlyEnforceIf(in_window)
                            window_constraints.append(in_window)
                        
                        # If assigned to resource, must be in at least one window
                        if window_constraints:
                            model.model.AddBoolOr(window_constraints).OnlyEnforceIf(assignment_var)


def add_leg_start_constraints(model: ScheduleModel, data: PlanningData, start_date: date):
    """
    Add constraints for leg start times and forced test start times.
    """
    # Group tests by leg for leg start constraints
    leg_tests = {}
    for test in data.tests:
        if test.project_leg_id not in leg_tests:
            leg_tests[test.project_leg_id] = []
        leg_tests[test.project_leg_id].append(test)
    
    # Leg start time constraints
    for leg_id, tests in leg_tests.items():
        leg = data.legs[leg_id]
        if leg.start_monday:
            leg_start_day = date_to_day_offset(leg.start_monday, start_date)
            
            # Find first test in leg (sequence_index = 1)
            first_test = min(tests, key=lambda t: t.sequence_index)
            if first_test.test_id in model.test_vars:
                first_test_start = model.test_vars[first_test.test_id][0]
                model.model.Add(first_test_start >= leg_start_day)
    
    # Forced start time constraints
    for test in data.tests:
        if test.force_start_week_iso and test.test_id in model.test_vars:
            from .data_loader import parse_iso_week
            forced_start_date = parse_iso_week(test.force_start_week_iso)
            if forced_start_date:
                forced_start_day = date_to_day_offset(forced_start_date, start_date)
                test_start = model.test_vars[test.test_id][0]
                model.model.Add(test_start >= forced_start_day)


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
        if (predecessor_last_test and successor_first_test and
            predecessor_last_test.test_id in model.test_vars and
            successor_first_test.test_id in model.test_vars):
            
            # Get variables
            _, pred_end_var, _ = model.test_vars[predecessor_last_test.test_id]
            succ_start_var, _, _ = model.test_vars[successor_first_test.test_id]
            
            # Constraint: successor start >= predecessor end
            model.model.Add(succ_start_var >= pred_end_var)
            
            print(f"  Added dependency: {successor_leg_id} starts after {predecessor_leg_id} finishes")


def build_model(data: PlanningData) -> ScheduleModel:
    """
    Build the complete CP-SAT model from the loaded data.
    
    Args:
        data: Loaded and validated planning data
        
    Returns:
        ScheduleModel containing the built model and variables
    """
    model = ScheduleModel()
    
    # Calculate time horizon and start date
    model.horizon = get_time_horizon(data)
    start_date = min(leg.start_monday for leg in data.legs.values() if leg.start_monday)
    
    # Create test variables (start, end, duration)
    for test in data.tests:
        duration = int(test.duration_days)  # Convert to integer days
        
        start_var = model.model.NewIntVar(0, model.horizon - duration, f"start_{test.test_id}")
        end_var = model.model.NewIntVar(duration, model.horizon, f"end_{test.test_id}")
        
        # Link start, duration, and end
        model.model.Add(end_var == start_var + duration)
        
        model.test_vars[test.test_id] = (start_var, end_var, duration)
        model.test_to_index[test.test_id] = len(model.test_to_index)
    
    # Build resource assignment variables and constraints
    build_resource_assignments(model, data, start_date)
    
    # Add sequencing constraints
    add_sequencing_constraints(model, data)
    
    # Add resource constraints including availability windows
    add_resource_constraints(model, data, start_date)
    
    # Additional no-overlap constraints for resources
    for resource_id, test_ids in model.resource_to_tests.items():
        intervals = []
        
        for test_id in test_ids:
            if test_id in model.test_vars:
                start_var, end_var, duration = model.test_vars[test_id]
                
                # Check if this test is actually assigned to this resource
                fte_assigned = (test_id, "fte", resource_id) in model.resource_assignments
                eq_assigned = (test_id, "equipment", resource_id) in model.resource_assignments
                
                if fte_assigned or eq_assigned:
                    # Create interval variable only if resource is assigned
                    fte_var = model.resource_assignments.get((test_id, "fte", resource_id))
                    eq_var = model.resource_assignments.get((test_id, "equipment", resource_id))
                    assignment_var = fte_var if fte_var is not None else eq_var
                    
                    interval_var = model.model.NewOptionalIntervalVar(
                        start_var, duration, end_var, assignment_var,
                        f"interval_{test_id}_{resource_id}"
                    )
                    intervals.append(interval_var)
        
        if intervals:
            model.model.AddNoOverlap(intervals)
    
    # Add leg start and forced start constraints
    add_leg_start_constraints(model, data, start_date)
    
    # Add leg dependency constraints
    add_leg_dependency_constraints(model, data)
    
    # Create makespan variable and objective
    model.makespan_var = model.model.NewIntVar(0, model.horizon, "makespan")
    
    # Makespan must be at least as large as the end time of every test
    for test_id, (start_var, end_var, duration) in model.test_vars.items():
        model.model.Add(model.makespan_var >= end_var)
    
    # Objective: minimize makespan
    model.model.Minimize(model.makespan_var)
    
    return model
