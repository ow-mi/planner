from __future__ import annotations

import os
import json
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Dict, List, Tuple, Optional

import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from ortools.sat.python import cp_model

from .debug import debug, info, warning, error, exception, timer, timeit, inspect_data, validate_dataframe, log_solver_status, save_debug_data

UNITS_PER_DAY = 2


@dataclass
class Leg:
    project_id: str
    project_name: str
    project_leg_id: str
    leg_number: str  # Changed from int to str to support alphanumeric (e.g., "2a", "2b")
    leg_name: str
    priority: int
    start_monday: date
    parent_leg_id: str = ""  # New field to track parent leg for hierarchical relationships


@dataclass
class Test:
    uid: str
    test_id: str
    project_leg_id: str
    test_name: str
    sequence_index: int
    duration_units: int
    completion_pct: int
    fte_required: int
    fte_time_units: int
    equipment_required: int
    fte_assigned: str
    equipment_assigned: str
    force_start_week_iso: str


@dataclass
class ResourceWindow:
    resource_id: str
    start_monday: date
    end_monday_inclusive: date


def parse_iso_week(iso_week: str) -> date:
    iso_week = iso_week.strip()
    year_str, week_str = iso_week.split("-W")
    return date.fromisocalendar(int(year_str), int(week_str), 1)


@timeit
def load_legs(path: str) -> Dict[str, Leg]:
    info(f"Loading legs from {path}")
    try:
        df = pd.read_csv(path)
        inspect_data(df, "legs_data")
        
        # Validate dataframe structure
        required_cols = ["project_id", "project_name", "project_leg_id", "leg_number", "leg_name", "priority", "start_iso_week"]
        validate_dataframe(df, "legs_data", required_cols, non_empty=True)
        
        legs: Dict[str, Leg] = {}

        # First pass: create all legs
        for idx, row in df.iterrows():
            try:
                project_leg_id = str(row["project_leg_id"]).strip()
                leg_number = str(row["leg_number"]).strip()
                
                # Parse ISO week with error handling
                try:
                    start_monday = parse_iso_week(str(row["start_iso_week"]))
                except Exception as e:
                    error(f"Failed to parse ISO week for leg {project_leg_id}", {
                        "row": idx + 2,  # +2 for header and 0-indexing
                        "value": str(row["start_iso_week"]),
                        "error": str(e)
                    })
                    raise
                
                # Parse priority with error handling
                try:
                    priority = int(row["priority"])
                except Exception as e:
                    error(f"Failed to parse priority for leg {project_leg_id}", {
                        "row": idx + 2,
                        "value": row["priority"],
                        "error": str(e)
                    })
                    raise
                
                legs[project_leg_id] = Leg(
                    project_id=str(row["project_id"]).strip(),
                    project_name=str(row["project_name"]).strip(),
                    project_leg_id=project_leg_id,
                    leg_number=leg_number,
                    leg_name=str(row["leg_name"]).strip(),
                    priority=priority,
                    start_monday=start_monday
                )
            except Exception as e:
                error(f"Error processing leg at row {idx + 2}", {"error": str(e)})
                # Continue processing other rows
        
        # Second pass: establish parent-child relationships
        for leg_id, leg in legs.items():
            # Check if this is a sub-leg by looking for pattern like "mwcu_b10_2.a" -> parent "mwcu_b10_2"
            if '.' in leg_id:
                # Extract potential parent ID (everything before the last dot)
                potential_parent = leg_id.rsplit('.', 1)[0]
                if potential_parent in legs:
                    leg.parent_leg_id = potential_parent
                    debug(f"Established parent-child relationship", {
                        "child": leg_id,
                        "parent": potential_parent
                    })

        info(f"Loaded {len(legs)} legs")
        return legs
    except Exception as e:
        exception(f"Failed to load legs from {path}", {"error": str(e)})
        # Return empty dict to allow processing to continue
        return {}


@timeit
def load_tests(path: str) -> List[Test]:
    info(f"Loading tests from {path}")
    try:
        df = pd.read_csv(path)
        inspect_data(df, "tests_data")
        
        # Validate dataframe structure
        required_cols = [
            "test_id", "project_leg_id", "test", "sequence_index", 
            "duration_days", "completion_pct", "fte_required", 
            "fte_time_pct", "equipment_required"
        ]
        validate_dataframe(df, "tests_data", required_cols, non_empty=True)
        
        tests: List[Test] = []
        for idx, row in df.iterrows():
            try:
                # Parse duration with error handling
                try:
                    duration_days = float(row["duration_days"]) if not pd.isna(row["duration_days"]) else 0.0
                    if duration_days < 0:
                        warning(f"Negative duration for test {row['test_id']}", {
                            "row": idx + 2,
                            "value": duration_days
                        })
                        duration_days = 0.0
                except Exception as e:
                    error(f"Failed to parse duration_days for test {row['test_id']}", {
                        "row": idx + 2,
                        "value": row["duration_days"],
                        "error": str(e)
                    })
                    duration_days = 0.0
                
                duration_units = int(round(duration_days * UNITS_PER_DAY))
                
                # Parse FTE percentage with error handling
                try:
                    fte_pct = float(row.get("fte_time_pct", 100))
                    if not (0 <= fte_pct <= 100):
                        warning(f"FTE percentage out of range for test {row['test_id']}", {
                            "row": idx + 2,
                            "value": fte_pct
                        })
                        fte_pct = min(100, max(0, fte_pct))
                except Exception as e:
                    error(f"Failed to parse fte_time_pct for test {row['test_id']}", {
                        "row": idx + 2,
                        "value": row.get("fte_time_pct"),
                        "error": str(e)
                    })
                    fte_pct = 100
                
                fte_time_units = int(round(duration_units * max(0.0, min(100.0, fte_pct)) / 100.0))
                
                # Parse sequence index with error handling
                try:
                    sequence_index = int(row["sequence_index"])
                except Exception as e:
                    error(f"Failed to parse sequence_index for test {row['test_id']}", {
                        "row": idx + 2,
                        "value": row["sequence_index"],
                        "error": str(e)
                    })
                    sequence_index = idx  # Use row index as fallback
                
                # Parse completion percentage with error handling
                try:
                    completion_pct = int(row["completion_pct"])
                    if not (0 <= completion_pct <= 100):
                        warning(f"Completion percentage out of range for test {row['test_id']}", {
                            "row": idx + 2,
                            "value": completion_pct
                        })
                        completion_pct = min(100, max(0, completion_pct))
                except Exception as e:
                    error(f"Failed to parse completion_pct for test {row['test_id']}", {
                        "row": idx + 2,
                        "value": row["completion_pct"],
                        "error": str(e)
                    })
                    completion_pct = 0
                
                # Parse required resources with error handling
                try:
                    fte_required = int(row["fte_required"])
                    if fte_required < 0:
                        warning(f"Negative fte_required for test {row['test_id']}", {
                            "row": idx + 2,
                            "value": fte_required
                        })
                        fte_required = 0
                except Exception as e:
                    error(f"Failed to parse fte_required for test {row['test_id']}", {
                        "row": idx + 2,
                        "value": row["fte_required"],
                        "error": str(e)
                    })
                    fte_required = 0
                
                try:
                    equipment_required = int(row["equipment_required"])
                    if equipment_required < 0:
                        warning(f"Negative equipment_required for test {row['test_id']}", {
                            "row": idx + 2,
                            "value": equipment_required
                        })
                        equipment_required = 0
                except Exception as e:
                    error(f"Failed to parse equipment_required for test {row['test_id']}", {
                        "row": idx + 2,
                        "value": row["equipment_required"],
                        "error": str(e)
                    })
                    equipment_required = 0
                
                # Get force start week with validation
                force_start_week_iso = str(row.get("force_start_week_iso", "*")).strip()
                if force_start_week_iso != "*" and not force_start_week_iso.startswith("20"):
                    warning(f"Potentially invalid force_start_week_iso for test {row['test_id']}", {
                        "row": idx + 2,
                        "value": force_start_week_iso
                    })
                
                test = Test(
                    uid=f"{str(row['test_id']).strip()}__{idx}",
                    test_id=str(row["test_id"]).strip(),
                    project_leg_id=str(row["project_leg_id"]).strip(),
                    test_name=str(row["test"]).strip(),
                    sequence_index=sequence_index,
                    duration_units=duration_units,
                    completion_pct=completion_pct,
                    fte_required=fte_required,
                    fte_time_units=fte_time_units,
                    equipment_required=equipment_required,
                    fte_assigned=str(row.get("fte_assigned", "*")).strip(),
                    equipment_assigned=str(row.get("equipment_assigned", "*")).strip(),
                    force_start_week_iso=force_start_week_iso,
                )
                tests.append(test)
                
            except Exception as e:
                error(f"Error processing test at row {idx + 2}", {"error": str(e)})
                # Continue processing other rows
        
        info(f"Loaded {len(tests)} tests")
        
        # Additional validation
        leg_ids = set(t.project_leg_id for t in tests)
        debug(f"Tests reference {len(leg_ids)} unique leg IDs")
        
        # Check for duplicate test IDs
        test_ids = [t.test_id for t in tests]
        duplicate_ids = set([x for x in test_ids if test_ids.count(x) > 1])
        if duplicate_ids:
            warning(f"Found duplicate test IDs", {"duplicates": list(duplicate_ids)})
        
        return tests
    except Exception as e:
        exception(f"Failed to load tests from {path}", {"error": str(e)})
        # Return empty list to allow processing to continue
        return []


@timeit
def load_resource_windows(path: str, id_col: str) -> List[ResourceWindow]:
    info(f"Loading resource windows from {path} with ID column '{id_col}'")
    try:
        df = pd.read_csv(path)
        inspect_data(df, f"resource_windows_{id_col}")
        
        # Validate dataframe structure
        required_cols = [id_col, "available_start_week_iso", "available_end_week_iso"]
        validate_dataframe(df, f"resource_windows_{id_col}", required_cols, non_empty=True)
        
        windows: List[ResourceWindow] = []
        for idx, row in df.iterrows():
            try:
                resource_id = str(row[id_col]).strip()
                
                # Parse ISO weeks with error handling
                try:
                    start_monday = parse_iso_week(str(row["available_start_week_iso"]))
                except Exception as e:
                    error(f"Failed to parse start ISO week for resource {resource_id}", {
                        "row": idx + 2,
                        "value": str(row["available_start_week_iso"]),
                        "error": str(e)
                    })
                    continue  # Skip this window
                
                try:
                    end_monday = parse_iso_week(str(row["available_end_week_iso"]))
                except Exception as e:
                    error(f"Failed to parse end ISO week for resource {resource_id}", {
                        "row": idx + 2,
                        "value": str(row["available_end_week_iso"]),
                        "error": str(e)
                    })
                    continue  # Skip this window
                
                # Validate window range
                if end_monday < start_monday:
                    warning(f"Resource window end date is before start date for {resource_id}", {
                        "row": idx + 2,
                        "start": str(row["available_start_week_iso"]),
                        "end": str(row["available_end_week_iso"])
                    })
                    # Swap dates to ensure valid window
                    start_monday, end_monday = end_monday, start_monday
                
                windows.append(
                    ResourceWindow(
                        resource_id=resource_id,
                        start_monday=start_monday,
                        end_monday_inclusive=end_monday
                    )
                )
            except Exception as e:
                error(f"Error processing resource window at row {idx + 2}", {"error": str(e)})
                # Continue processing other rows
        
        info(f"Loaded {len(windows)} resource windows")
        
        # Check for overlapping windows
        resource_ids = set(w.resource_id for w in windows)
        for rid in resource_ids:
            resource_windows = [w for w in windows if w.resource_id == rid]
            if len(resource_windows) > 1:
                # Sort windows by start date
                resource_windows.sort(key=lambda w: w.start_monday)
                
                # Check for overlaps
                for i in range(len(resource_windows) - 1):
                    if resource_windows[i].end_monday_inclusive >= resource_windows[i+1].start_monday:
                        warning(f"Overlapping windows for resource {rid}", {
                            "window1": f"{resource_windows[i].start_monday} to {resource_windows[i].end_monday_inclusive}",
                            "window2": f"{resource_windows[i+1].start_monday} to {resource_windows[i+1].end_monday_inclusive}"
                        })
        
        return windows
    except Exception as e:
        exception(f"Failed to load resource windows from {path}", {"error": str(e)})
        # Return empty list to allow processing to continue
        return []


def compute_time_origin(legs: Dict[str, Leg], fte_windows: List[ResourceWindow], equip_windows: List[ResourceWindow]) -> date:
    dates = [leg.start_monday for leg in legs.values()] + [w.start_monday for w in fte_windows] + [w.start_monday for w in equip_windows]
    return min(dates)


def date_to_units(day0: date, d: date) -> int:
    return (d - day0).days * UNITS_PER_DAY


def units_to_datetime(day0: date, units: int) -> datetime:
    days = units // UNITS_PER_DAY
    rem = units % UNITS_PER_DAY
    dt = datetime.combine(day0 + timedelta(days=days), datetime.min.time())
    if rem:
        dt += timedelta(hours=12)
    return dt


@timeit
def build_and_solve(
    legs: Dict[str, Leg],
    tests: List[Test],
    fte_windows: List[ResourceWindow],
    equip_windows: List[ResourceWindow],
    priority_config: Optional[Dict] = None,
):
    info("Building and solving constraint model")
    
    # Save input data for debugging
    debug_data = {
        "legs_count": len(legs),
        "tests_count": len(tests),
        "fte_windows_count": len(fte_windows),
        "equip_windows_count": len(equip_windows),
        "priority_config": priority_config
    }
    save_debug_data(debug_data, "solver_input_summary")
    
    # Compute time origin
    with timer("compute_time_origin"):
        day0 = compute_time_origin(legs, fte_windows, equip_windows)
        info(f"Time origin set to {day0}")
    
    # Calculate resource bounds
    with timer("calculate_resource_bounds"):
        fte_bounds = {}
        for idx, w in enumerate(fte_windows):
            fte_bounds[idx] = (date_to_units(day0, w.start_monday), date_to_units(day0, w.end_monday_inclusive + timedelta(days=6)) + UNITS_PER_DAY - 1)
        
        equip_bounds = {}
        for idx, w in enumerate(equip_windows):
            equip_bounds[idx] = (date_to_units(day0, w.start_monday), date_to_units(day0, w.end_monday_inclusive + timedelta(days=6)) + UNITS_PER_DAY - 1)
        
        debug(f"FTE bounds: {len(fte_bounds)} windows")
        debug(f"Equipment bounds: {len(equip_bounds)} windows")
    
    # Filter tests that need scheduling (not completed)
    with timer("filter_tests"):
        sched_tests = [t for t in tests if t.completion_pct < 100]
        info(f"Scheduling {len(sched_tests)} tests out of {len(tests)} total")
    
    # Calculate horizon
    with timer("calculate_horizon"):
        total_units = sum(t.duration_units for t in sched_tests)
        
        # Check if there are any tests to schedule
        if not sched_tests:
            warning("No tests to schedule")
            return None
        
        # Check if all tests have valid leg references
        invalid_legs = [t for t in sched_tests if t.project_leg_id not in legs]
        if invalid_legs:
            error(f"Tests reference non-existent legs", {
                "test_count": len(invalid_legs),
                "first_test_id": invalid_legs[0].test_id if invalid_legs else None,
                "missing_leg_id": invalid_legs[0].project_leg_id if invalid_legs else None
            })
            # Filter out tests with invalid legs
            sched_tests = [t for t in sched_tests if t.project_leg_id in legs]
            if not sched_tests:
                error("No valid tests to schedule after filtering")
                return None
        
        try:
            latest_leg_start = max(date_to_units(day0, legs[t.project_leg_id].start_monday) for t in sched_tests) if sched_tests else 0
        except Exception as e:
            error(f"Failed to calculate latest leg start", {"error": str(e)})
            latest_leg_start = 0
        
        max_resource_end = max([b for _, (_, b) in fte_bounds.items()] + [b for _, (_, b) in equip_bounds.items()]) if (fte_bounds or equip_bounds) else 0
        horizon = max(max_resource_end, latest_leg_start + total_units + 1)
        
        info(f"Planning horizon: {horizon} units ({horizon/UNITS_PER_DAY:.1f} days)")
        debug(f"Planning parameters", {
            "total_units": total_units,
            "latest_leg_start": latest_leg_start,
            "max_resource_end": max_resource_end
        })

    with timer("create_model"):
        model = cp_model.CpModel()
        info("Creating constraint model")
    
    # Create variables for test start/end times
    with timer("create_test_variables"):
        start_vars: Dict[str, cp_model.IntVar] = {}
        end_vars: Dict[str, cp_model.IntVar] = {}
        
        debug(f"Creating variables for {len(sched_tests)} tests")
        
        forced_starts = 0
        for t in sched_tests:
            try:
                earliest_start = date_to_units(day0, legs[t.project_leg_id].start_monday)
                
                # Apply forced start if provided
                if t.force_start_week_iso and t.force_start_week_iso != "*":
                    try:
                        forced_date = parse_iso_week(t.force_start_week_iso)
                        forced_units = date_to_units(day0, forced_date)
                        forced_starts += 1
                    except Exception as e:
                        error(f"Failed to parse forced start week for test {t.test_id}", {
                            "value": t.force_start_week_iso,
                            "error": str(e)
                        })
                        forced_units = earliest_start
                    start = model.NewIntVar(forced_units, forced_units, f"start_{t.uid}")
                    debug(f"Test {t.test_id} has forced start at {forced_date}")
                else:
                    start = model.NewIntVar(earliest_start, horizon, f"start_{t.uid}")
                
                end = model.NewIntVar(earliest_start, horizon + t.duration_units, f"end_{t.uid}")
                model.NewIntervalVar(start, t.duration_units, end, f"ivl_{t.uid}")
                start_vars[t.uid] = start
                end_vars[t.uid] = end
            except Exception as e:
                error(f"Failed to create variables for test {t.test_id}", {"error": str(e)})
                # Continue with other tests
        
        info(f"Created variables for {len(start_vars)} tests ({forced_starts} with forced start dates)")

    # Group tests by leg for easier processing
    by_leg: Dict[str, List[Test]] = {}
    for t in sched_tests:
        by_leg.setdefault(t.project_leg_id, []).append(t)

    # Determine the longest leg to prioritize its compactness
    leg_durations = {leg_id: 0 for leg_id in by_leg.keys()}
    for t in sched_tests:
        leg_durations[t.project_leg_id] += t.duration_units
    
    longest_leg_id = None
    if leg_durations:
        longest_leg_id = max(leg_durations, key=leg_durations.get)
        info(f"Longest leg identified: {longest_leg_id} with total duration {leg_durations[longest_leg_id]} units")

    # Add sequencing constraints
    with timer("add_sequencing_constraints"):
        sequence_constraints = 0
        for leg_id, leg_tests in by_leg.items():
            try:
                leg_tests_sorted = sorted(leg_tests, key=lambda x: x.sequence_index)
                for prev, nxt in zip(leg_tests_sorted, leg_tests_sorted[1:]):
                    if prev.uid in end_vars and nxt.uid in start_vars:
                        # Add sequencing constraint
                        model.Add(end_vars[prev.uid] <= start_vars[nxt.uid])
                        
                        # This rigid constraint is removed in favor of a soft constraint in the objective
                        # if leg_id == longest_leg_id:
                        #     max_idle_days = 14
                        #     max_idle_units = max_idle_days * UNITS_PER_DAY
                        #     model.Add(start_vars[nxt.uid] - end_vars[prev.uid] <= max_idle_units)
                        
                        sequence_constraints += 1
                    else:
                        warning(f"Cannot create sequence constraint for tests in leg {leg_id}", {
                            "prev_test": prev.test_id,
                            "next_test": nxt.test_id
                        })
            except Exception as e:
                error(f"Failed to create sequencing constraints for leg {leg_id}", {"error": str(e)})
        
        info(f"Added {sequence_constraints} sequencing constraints for {len(by_leg)} legs")

    # Hierarchical sequencing: sub-legs must start after their parent leg completes
    for leg_id, leg_tests in by_leg.items():
        leg = legs[leg_id]
        if leg.parent_leg_id and leg.parent_leg_id in by_leg:
            # This is a sub-leg, find the latest end time of parent leg tests
            parent_tests = by_leg[leg.parent_leg_id]
            if parent_tests:
                # Find the maximum end time of all parent leg tests
                parent_end_times = [end_vars[t.uid] for t in parent_tests]
                parent_max_end = model.NewIntVar(0, horizon, f"parent_max_end_{leg_id}")
                model.AddMaxEquality(parent_max_end, parent_end_times)

                # All sub-leg tests must start after parent leg completes
                for sub_test in leg_tests:
                    model.Add(start_vars[sub_test.uid] >= parent_max_end)

    # equipment assignment
    equip_nooverlap = {i: [] for i in range(len(equip_windows))}
    equip_nooverlap_by_resource: Dict[str, List[cp_model.IntervalVar]] = {}
    equip_assign: Dict[Tuple[str, int], cp_model.BoolVar] = {}
    for t in sched_tests:
        lits = []
        for r_idx, (a, b) in equip_bounds.items():
            eq_id = equip_windows[r_idx].resource_id
            # Support '|' as OR operator in selector (case-insensitive substring match)
            if t.equipment_assigned == "*" or t.equipment_assigned.strip() == "":
                allowed = True
            else:
                # Fix: Ensure string containment matching works correctly
                # If equipment_assigned is "setup_hengelo", it should match any resource with "setup_hengelo" in the name
                tokens = [tok.strip().lower() for tok in str(t.equipment_assigned).split("|")]
                allowed = any(tok and tok in eq_id.lower() for tok in tokens)
            x = model.NewBoolVar(f"xeq_{t.uid}_{r_idx}")
            opt_ivl = model.NewOptionalIntervalVar(start_vars[t.uid], t.duration_units, end_vars[t.uid], x, f"ivleq_{t.uid}_{r_idx}")
            model.Add(start_vars[t.uid] >= a).OnlyEnforceIf(x)
            model.Add(end_vars[t.uid] <= b).OnlyEnforceIf(x)
            equip_nooverlap[r_idx].append(opt_ivl)
            equip_nooverlap_by_resource.setdefault(eq_id, []).append(opt_ivl)
            equip_assign[(t.uid, r_idx)] = x
            if allowed:
                lits.append(x)
        model.Add(sum(lits) == max(0, t.equipment_required))
    for ivls in equip_nooverlap_by_resource.values():
        model.AddNoOverlap(ivls)
    # Note: NoOverlap across windows for the same equipment is now correctly handled

    # fte assignment
    fte_nooverlap = {i: [] for i in range(len(fte_windows))}
    fte_nooverlap_by_resource: Dict[str, List[cp_model.IntervalVar]] = {}
    fte_assign: Dict[Tuple[str, int], cp_model.BoolVar] = {}
    fte_sub_start_vars: Dict[Tuple[str, int], cp_model.IntVar] = {}
    fte_sub_end_vars: Dict[Tuple[str, int], cp_model.IntVar] = {}
    for t in sched_tests:
        lits = []
        for r_idx, (a, b) in fte_bounds.items():
            fte_id = fte_windows[r_idx].resource_id
            # Support '|' as OR operator in selector (case-insensitive substring match)
            if t.fte_assigned == "*" or t.fte_assigned.strip() == "":
                allowed = True
            else:
                # Fix: Ensure string containment matching works correctly
                # If fte_assigned is "fte_hengelo", it should match any resource with "fte_hengelo" in the name
                tokens = [tok.strip().lower() for tok in str(t.fte_assigned).split("|")]
                allowed = any(tok and tok in fte_id.lower() for tok in tokens)
            x = model.NewBoolVar(f"xft_{t.uid}_{r_idx}")
            work_dur = max(0, t.fte_time_units)
            # Model FTE usage for only a portion of the test: place an optional sub-interval inside [start,end]
            # sub_start >= start; sub_end = sub_start + work_dur; and sub_end <= end
            sub_start = model.NewIntVar(0, horizon, f"ft_sub_start_{t.uid}_{r_idx}")
            sub_end = model.NewIntVar(0, horizon, f"ft_sub_end_{t.uid}_{r_idx}")
            model.Add(sub_end == sub_start + work_dur).OnlyEnforceIf(x)
            model.Add(sub_start >= start_vars[t.uid]).OnlyEnforceIf(x)
            model.Add(sub_end <= end_vars[t.uid]).OnlyEnforceIf(x)
            opt_ivl_ft = model.NewOptionalIntervalVar(sub_start, work_dur, sub_end, x, f"ivlft_{t.uid}_{r_idx}")
            model.Add(start_vars[t.uid] >= a).OnlyEnforceIf(x)
            model.Add(end_vars[t.uid] <= b).OnlyEnforceIf(x)
            # NoOverlap uses the sub-interval (actual work) rather than full test duration
            fte_nooverlap[r_idx].append(opt_ivl_ft)
            fte_nooverlap_by_resource.setdefault(fte_id, []).append(opt_ivl_ft)
            fte_assign[(t.uid, r_idx)] = x
            fte_sub_start_vars[(t.uid, r_idx)] = sub_start
            fte_sub_end_vars[(t.uid, r_idx)] = sub_end
            if allowed:
                lits.append(x)
        model.Add(sum(lits) == max(0, t.fte_required))
    for ivls in fte_nooverlap_by_resource.values():
        model.AddNoOverlap(ivls)
    # Note: NoOverlap across windows for the same resource is now correctly handled

    # objective - configurable priority system
    if priority_config is None:
        priority_config = {"priority_mode": "leg_priority"}

    priority_mode = priority_config.get("priority_mode", "leg_priority")

    if priority_mode == "makespan_minimize":
        # Multi-stage optimization:
        # 1. Find a feasible solution first.
        # 2. Use the feasible solution as a hint to optimize the final objective.

        # --- Stage 1: Find a feasible solution ---
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 30.0  # Shorter timeout for feasibility check
        status = solver.Solve(model)

        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            # If still no solution, raise the detailed error as before
            # (Diagnostics gathering logic is omitted for brevity but would be here)
            raise RuntimeError(f"No feasible solution found even with a simple objective: {solver.StatusName(status)}")

        info("Feasible solution found, proceeding to optimization.")

        # --- Stage 2: Optimize for the actual objective ---
        # Hint the solver with the feasible solution found in Stage 1
        for var_name, var in start_vars.items():
            model.AddHint(var, solver.Value(var))
        for var_name, var in end_vars.items():
            model.AddHint(var, solver.Value(var))

        # Now, define the complex objective function
        makespan = model.NewIntVar(0, horizon, "makespan")
        longest_leg_tests = by_leg.get(longest_leg_id, [])
        other_tests = [t for t in sched_tests if t.project_leg_id != longest_leg_id]

        if longest_leg_tests:
            last_test_of_longest_leg = max(longest_leg_tests, key=lambda t: t.sequence_index)
            model.Add(makespan == end_vars[last_test_of_longest_leg.uid])
        else:
            model.AddMaxEquality(makespan, [end_vars[t.uid] for t in sched_tests])

        idle_time_penalties = []
        if longest_leg_tests:
            sorted_longest_leg = sorted(longest_leg_tests, key=lambda t: t.sequence_index)
            for prev, nxt in zip(sorted_longest_leg, sorted_longest_leg[1:]):
                idle_time = start_vars[nxt.uid] - end_vars[prev.uid]
                idle_time_penalties.append(idle_time)

        objective_terms = [makespan * 1000] + idle_time_penalties + [end_vars[t.uid] for t in other_tests]
        model.Minimize(sum(objective_terms))

        # Solve again with the full objective
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 180
        solver.parameters.num_search_workers = 10
        status = solver.Solve(model)

    elif priority_mode == "equal_weight":
        # All tests have equal weight
        model.Minimize(sum(end_vars[t.uid] for t in sched_tests))

    elif priority_mode == "leg_priority":
        # Original leg priority system
        max_priority = max(leg.priority for leg in legs.values()) if legs else 0
        model.Minimize(sum(((max_priority + 1) - legs[t.project_leg_id].priority) * end_vars[t.uid] for t in sched_tests))

    elif priority_mode == "completion_date":
        # Prioritize by completion deadlines
        deadlines = priority_config.get("completion_deadlines", {})
        terms = []
        for t in sched_tests:
            leg_id = t.project_leg_id
            if leg_id in deadlines:
                deadline_week = deadlines[leg_id]
                try:
                    deadline_date = parse_iso_week(deadline_week)
                    deadline_units = date_to_units(day0, deadline_date)
                    # Penalize going beyond deadline
                    penalty = model.NewIntVar(0, horizon, f"penalty_{t.uid}")
                    model.Add(penalty >= end_vars[t.uid] - deadline_units)
                    terms.append(penalty)
                except:
                    # Fallback to leg priority if deadline parsing fails
                    max_priority = max(leg.priority for leg in legs.values()) if legs else 0
                    weight = (max_priority + 1) - legs[leg_id].priority
                    terms.append(weight * end_vars[t.uid])
            else:
                # No deadline specified, use leg priority as fallback
                max_priority = max(leg.priority for leg in legs.values()) if legs else 0
                weight = (max_priority + 1) - legs[leg_id].priority
                terms.append(weight * end_vars[t.uid])
        if terms:
            model.Minimize(sum(terms))

    else:
        # Default to leg priority for unknown modes
        max_priority = max(leg.priority for leg in legs.values()) if legs else 0
        model.Minimize(sum(((max_priority + 1) - legs[t.project_leg_id].priority) * end_vars[t.uid] for t in sched_tests))

    # This block is moved down since makespan_minimize now has its own solver logic
    if priority_mode != "makespan_minimize":
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 60.0
        solver.parameters.num_search_workers = 4
        status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        # Collect diagnostic information before raising error
        diagnostics = []
        
        # Check if there are any tests to schedule
        if not sched_tests:
            diagnostics.append("No tests to schedule (all tests are 100% complete)")
        
        # Check resource availability vs requirements - use duration-weighted calculations
        total_fte_days_required = sum(t.duration_units / UNITS_PER_DAY * t.fte_required for t in sched_tests)
        total_equip_days_required = sum(t.duration_units / UNITS_PER_DAY * t.equipment_required for t in sched_tests)
        
        # Calculate available resource-days
        available_fte_days = 0
        for w in fte_windows:
            days_available = (w.end_monday_inclusive - w.start_monday).days + 7  # inclusive of end week
            available_fte_days += days_available
        
        available_equip_days = 0
        for w in equip_windows:
            days_available = (w.end_monday_inclusive - w.start_monday).days + 7  # inclusive of end week
            available_equip_days += days_available
        
        diagnostics.append(f"Tests to schedule: {len(sched_tests)}")
        diagnostics.append(f"Total FTE-days required: {total_fte_days_required:.1f}")
        diagnostics.append(f"Total equipment-days required: {total_equip_days_required:.1f}")
        diagnostics.append(f"Available FTE-days: {available_fte_days}")
        diagnostics.append(f"Available equipment-days: {available_equip_days}")
        
        # Check if resource-days requirements exceed availability
        if total_fte_days_required > available_fte_days:
            diagnostics.append(f"WARNING: FTE-days requirement ({total_fte_days_required:.1f}) exceeds available FTE-days ({available_fte_days})")
        if total_equip_days_required > available_equip_days:
            diagnostics.append(f"WARNING: Equipment-days requirement ({total_equip_days_required:.1f}) exceeds available equipment-days ({available_equip_days})")
        
        # Also show the simple counts for reference
        diagnostics.append(f"Available FTE resources: {len(fte_windows)}")
        diagnostics.append(f"Available equipment resources: {len(equip_windows)}")
        
        # Check for concurrency constraints that might be problematic
        max_concurrent_fte = max(t.fte_required for t in sched_tests) if sched_tests else 0
        max_concurrent_equip = max(t.equipment_required for t in sched_tests) if sched_tests else 0
        
        diagnostics.append(f"Maximum concurrent FTE needed: {max_concurrent_fte}")
        diagnostics.append(f"Maximum concurrent equipment needed: {max_concurrent_equip}")
        
        # Check if maximum concurrency exceeds available resources
        if max_concurrent_fte > len(fte_windows):
            diagnostics.append(f"ERROR: Maximum concurrent FTE ({max_concurrent_fte}) exceeds available FTE ({len(fte_windows)})")
        if max_concurrent_equip > len(equip_windows):
            diagnostics.append(f"ERROR: Maximum concurrent equipment ({max_concurrent_equip}) exceeds available equipment ({len(equip_windows)})")
        
        # Check time horizon vs resource availability windows
        if fte_windows:
            fte_start = min(w.start_monday for w in fte_windows)
            fte_end = max(w.end_monday_inclusive for w in fte_windows)
            diagnostics.append(f"FTE availability: {fte_start} to {fte_end}")
        
        if equip_windows:
            equip_start = min(w.start_monday for w in equip_windows)
            equip_end = max(w.end_monday_inclusive for w in equip_windows)
            diagnostics.append(f"Equipment availability: {equip_start} to {equip_end}")
        
        # Check leg start dates
        if legs:
            leg_start = min(leg.start_monday for leg in legs.values())
            leg_end = max(leg.start_monday for leg in legs.values())
            diagnostics.append(f"Leg start dates: {leg_start} to {leg_end}")
        
        # Check for forced start dates that might be outside resource availability
        forced_starts = [t for t in sched_tests if t.force_start_week_iso and t.force_start_week_iso != "*"]
        if forced_starts:
            diagnostics.append(f"Tests with forced start dates: {len(forced_starts)}")
            for t in forced_starts[:3]:  # Show first 3 as examples
                try:
                    forced_date = parse_iso_week(t.force_start_week_iso)
                    diagnostics.append(f"  Test {t.test_id}: forced start {forced_date}")
                except:
                    diagnostics.append(f"  Test {t.test_id}: invalid forced start format '{t.force_start_week_iso}'")
        
        # Check for specific assignment constraints that might be problematic
        specific_fte_assignments = [t for t in sched_tests if t.fte_assigned != "*" and t.fte_assigned.strip()]
        specific_equip_assignments = [t for t in sched_tests if t.equipment_assigned != "*" and t.equipment_assigned.strip()]
        
        diagnostics.append(f"Tests with specific FTE assignments: {len(specific_fte_assignments)}")
        diagnostics.append(f"Tests with specific equipment assignments: {len(specific_equip_assignments)}")
        
        # Check for hierarchical constraint issues
        parent_leg_issues = []
        for leg_id, leg in legs.items():
            if leg.parent_leg_id and leg.parent_leg_id not in legs:
                parent_leg_issues.append(f"Leg {leg_id} has unknown parent {leg.parent_leg_id}")
            elif leg.parent_leg_id and leg.parent_leg_id in by_leg:
                parent_tests = by_leg[leg.parent_leg_id]
                child_tests = by_leg.get(leg_id, [])
                if parent_tests and child_tests:
                    # Check if parent leg has tests that need to complete before child can start
                    parent_leg_issues.append(f"Hierarchical constraint: {len(child_tests)} tests in {leg_id} must wait for {len(parent_tests)} tests in {leg.parent_leg_id}")
        
        if parent_leg_issues:
            diagnostics.append(f"Hierarchical constraints detected: {len(parent_leg_issues)}")
            for issue in parent_leg_issues[:3]:  # Show first 3 issues
                diagnostics.append(f"  {issue}")
        
        # Check for tests with very long durations that might cause issues
        long_tests = [t for t in sched_tests if t.duration_units > 100]  # More than 50 days
        if long_tests:
            diagnostics.append(f"Tests with long durations (>50 days): {len(long_tests)}")
            for t in long_tests[:3]:
                diagnostics.append(f"  Test {t.test_id}: {t.duration_units/UNITS_PER_DAY:.1f} days")
        
        # Check for tests that might have sequencing issues
        leg_sequence_counts = {}
        for leg_id, tests_in_leg in by_leg.items():
            leg_sequence_counts[leg_id] = len(tests_in_leg)
        
        if leg_sequence_counts:
            max_sequence = max(leg_sequence_counts.values())
            diagnostics.append(f"Maximum tests in a single leg sequence: {max_sequence}")
            if max_sequence > 20:
                diagnostics.append(f"WARNING: Long sequence of {max_sequence} tests may cause scheduling complexity")
        
        # Check if there are any validation issues that might have been missed
        # Note: We can't easily call validate_inputs here without the input directory path
        # Instead, we'll rely on the validation that was already done in main.py
        diagnostics.append("Note: Check validation_report.csv for detailed input validation issues")
        
        # Check for forced start dates that might conflict with resource availability
        forced_start_conflicts = []
        for t in sched_tests:
            if t.force_start_week_iso and t.force_start_week_iso != "*":
                try:
                    forced_date = parse_iso_week(t.force_start_week_iso)
                    forced_units = date_to_units(day0, forced_date)
                    
                    # Check if forced start is within any resource availability
                    fte_available = any(a <= forced_units <= b for a, b in fte_bounds.values())
                    equip_available = any(a <= forced_units <= b for a, b in equip_bounds.values())
                    
                    if not fte_available or not equip_available:
                        conflict_msg = f"Test {t.test_id}: forced start {forced_date}"
                        if not fte_available:
                            conflict_msg += " (no FTE available)"
                        if not equip_available:
                            conflict_msg += " (no equipment available)"
                        forced_start_conflicts.append(conflict_msg)
                        
                except Exception as e:
                    forced_start_conflicts.append(f"Test {t.test_id}: invalid forced start '{t.force_start_week_iso}' - {e}")
        
        if forced_start_conflicts:
            diagnostics.append(f"Potential forced start conflicts: {len(forced_start_conflicts)}")
            for conflict in forced_start_conflicts[:3]:
                diagnostics.append(f"  {conflict}")
        
        # Check if any tests have requirements that exceed individual resource capacities
        high_fte_tests = [t for t in sched_tests if t.fte_required > 1]
        high_equip_tests = [t for t in sched_tests if t.equipment_required > 1]
        
        if high_fte_tests:
            diagnostics.append(f"Tests requiring >1 FTE: {len(high_fte_tests)}")
        if high_equip_tests:
            diagnostics.append(f"Tests requiring >1 equipment: {len(high_equip_tests)}")
        
        # Check for tests that might have very short windows between constraints
        leg_start_variability = {}
        for leg_id, leg_tests in by_leg.items():
            leg = legs[leg_id]
            leg_start = date_to_units(day0, leg.start_monday)
            test_durations = sum(t.duration_units for t in leg_tests)
            leg_start_variability[leg_id] = (leg_start, test_durations, len(leg_tests))
        
        if leg_start_variability:
            tight_schedules = []
            for leg_id, (start, duration, count) in leg_start_variability.items():
                # Check if leg has parent constraints
                leg = legs[leg_id]
                if leg.parent_leg_id and leg.parent_leg_id in leg_start_variability:
                    parent_start, parent_duration, parent_count = leg_start_variability[leg.parent_leg_id]
                    total_parent_time = parent_start + parent_duration
                    time_available = horizon - total_parent_time
                    if duration > time_available:
                        tight_schedules.append(f"Leg {leg_id} may not fit after parent {leg.parent_leg_id}: needs {duration} units, only {time_available} available")
            
            if tight_schedules:
                diagnostics.append(f"Potential tight scheduling constraints: {len(tight_schedules)}")
                for schedule in tight_schedules[:3]:
                    diagnostics.append(f"  {schedule}")
        
        # Enhanced FTE assignment analysis
        diagnostics.append(f"Detailed FTE assignment analysis:")
        
        # Check for potential constraint saturation by estimating how many tests *could* be assigned to each resource
        total_tests_per_resource = {rid: 0 for rid in set(w.resource_id for w in fte_windows)}
        for t in sched_tests:
            if t.fte_assigned != "*" and t.fte_assigned.strip():
                tokens = [tok.strip().lower() for tok in str(t.fte_assigned).split("|")]
                # Find matching resources and increment their count
                matching_resources = set()
                for w in fte_windows:
                    if any(tok and tok in w.resource_id.lower() for tok in tokens):
                        matching_resources.add(w.resource_id)
                for rid in matching_resources:
                    total_tests_per_resource[rid] += 1
        
        diagnostics.append(f"  Tests per resource estimate:")
        for resource, count in total_tests_per_resource.items():
            if count > 0:
                diagnostics.append(f"    {resource}: ~{count} tests")
                if count > 20:  # High load per resource
                    diagnostics.append(f"      WARNING: High load on resource {resource}")
        
        # Check if the makespan minimization objective might be causing issues
        if priority_config and priority_config.get('priority_mode') == 'makespan_minimize':
            diagnostics.append(f"  Using makespan minimization - this can create complex constraints")
        
        # Add detailed constraint debugging for the problematic case
        diagnostics.append(f"Detailed constraint analysis for mwcu_a7_5 leg:")
        
        # Check hierarchical constraints for this specific leg
        mwcu_a7_5_leg = None
        for leg_id, leg in legs.items():
            if leg_id == 'mwcu_a7_5':
                mwcu_a7_5_leg = leg
                break
        
        if mwcu_a7_5_leg and mwcu_a7_5_leg.parent_leg_id:
            diagnostics.append(f"  Parent leg: {mwcu_a7_5_leg.parent_leg_id}")
            if mwcu_a7_5_leg.parent_leg_id in by_leg:
                parent_tests = by_leg[mwcu_a7_5_leg.parent_leg_id]
                parent_end_times = [solver.Value(end_vars[t.uid]) for t in parent_tests if status in (cp_model.OPTIMAL, cp_model.FEASIBLE)]
                if parent_end_times:
                    max_parent_end = max(parent_end_times)
                    diagnostics.append(f"  Parent leg completion time: {max_parent_end} units")
                    diagnostics.append(f"  Parent leg completion date: {units_to_datetime(day0, max_parent_end)}")
        
        # Check resource assignment constraints for the problematic test
        problematic_test = None
        for t in sched_tests:
            if t.test_id == 'mwcu_a7_5_P-04':
                problematic_test = t
                break
        
        if problematic_test:
            diagnostics.append(f"  Problematic test: {problematic_test.test_id}")
            diagnostics.append(f"  Sequence index: {problematic_test.sequence_index}")
            
            # Check if this test has specific resource requirements
            if problematic_test.fte_assigned != "*":
                diagnostics.append(f"  Specific FTE assignment: {problematic_test.fte_assigned}")
            if problematic_test.equipment_assigned != "*":
                diagnostics.append(f"  Specific equipment assignment: {problematic_test.equipment_assigned}")
            
            # Check forced start if any
            if problematic_test.force_start_week_iso != "*":
                diagnostics.append(f"  Forced start week: {problematic_test.force_start_week_iso}")
        
        # Check if there are any no-overlap constraints causing issues
        diagnostics.append(f"  Total no-overlap constraints: {len(equip_nooverlap) + len(fte_nooverlap)}")
        
        # Check if the solver found any conflicts
        if hasattr(solver, 'NumConflicts'):
            diagnostics.append(f"  Solver conflicts: {solver.NumConflicts()}")
        
        # Add information about the objective function
        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            try:
                objective_value = solver.ObjectiveValue()
                diagnostics.append(f"  Objective value: {objective_value}")
            except:
                pass
        
        error_msg = f"No feasible solution: {solver.StatusName(status)}"
        error_msg += f"\nDiagnostics:" + "\n  ".join([""] + diagnostics)
        
        raise RuntimeError(error_msg)

    # build outputs
    equip_index_to_id = {idx: w.resource_id for idx, w in enumerate(equip_windows)}
    fte_index_to_id = {idx: w.resource_id for idx, w in enumerate(fte_windows)}

    assigned_equipment_index: Dict[str, Optional[int]] = {}
    assigned_fte_index: Dict[str, Optional[int]] = {}
    for t in sched_tests:
        eq = None
        for r_idx in range(len(equip_windows)):
            if solver.Value(equip_assign[(t.uid, r_idx)]) == 1:
                eq = r_idx
                break
        ft = None
        for r_idx in range(len(fte_windows)):
            if solver.Value(fte_assign[(t.uid, r_idx)]) == 1:
                ft = r_idx
                break
        assigned_equipment_index[t.uid] = eq
        assigned_fte_index[t.uid] = ft

    return (
        day0,
        solver,
        sched_tests,
        start_vars,
        end_vars,
        assigned_equipment_index,
        assigned_fte_index,
        equip_index_to_id,
        fte_index_to_id,
        fte_sub_start_vars,
        fte_sub_end_vars,
    )


def plan_and_output(sample_dir: str, outputs_dir_data: str, outputs_dir_plots: str) -> None:
    legs = load_legs(os.path.join(sample_dir, "data_legs.csv"))
    tests = load_tests(os.path.join(sample_dir, "data_test.csv"))
    fte_windows = load_resource_windows(os.path.join(sample_dir, "data_fte.csv"), id_col="fte_id")
    equip_windows = load_resource_windows(os.path.join(sample_dir, "data_equipment.csv"), id_col="equipment_id")

    # Load priority configuration
    priority_config_path = os.path.join(sample_dir, "priority_config.json")
    priority_config = None
    if os.path.exists(priority_config_path):
        try:
            with open(priority_config_path, 'r') as f:
                priority_config = json.load(f)
        except Exception as e:
            print(f"Warning: Could not load priority configuration: {e}")
            print("Using default leg priority system.")

    (
        day0,
        solver,
        sched_tests,
        start_vars,
        end_vars,
        assigned_equipment_index,
        assigned_fte_index,
        equip_index_to_id,
        fte_index_to_id,
        fte_sub_start_vars,
        fte_sub_end_vars,
    ) = build_and_solve(legs, tests, fte_windows, equip_windows, priority_config)

    # assemble rows
    rows = []
    equip_usage = {}
    fte_usage = {}

    # Create mapping from test_id to test_name for CSV output
    test_id_to_name = {t.test_id: t.test_name for t in tests}
    for t in sched_tests:
        s = solver.Value(start_vars[t.uid])
        e = solver.Value(end_vars[t.uid])
        s_dt = units_to_datetime(day0, s)
        e_dt = units_to_datetime(day0, e)
        eq_idx = assigned_equipment_index.get(t.uid)
        ft_idx = assigned_fte_index.get(t.uid)
        eq_id = equip_index_to_id[eq_idx] if eq_idx is not None else ""
        ft_id = fte_index_to_id[ft_idx] if ft_idx is not None else ""
        rows.append({
            "test_id": t.test_id,
            "project_leg_id": t.project_leg_id,
            "test_name": t.test_name,
            "sequence_index": t.sequence_index,
            "duration_days": t.duration_units/UNITS_PER_DAY,
            "start": s_dt.isoformat(),
            "end": e_dt.isoformat(),
            "assigned_equipment_id": eq_id,
            "assigned_fte_id": ft_id,
        })
        if eq_id:
            equip_usage.setdefault(eq_id, []).append((s_dt, e_dt, t.test_id))
        if ft_id:
            # Use actual FTE sub-interval from the solver for plotting and CSV
            key = (t.uid, ft_idx)
            if key in fte_sub_start_vars and key in fte_sub_end_vars:
                s_units = solver.Value(fte_sub_start_vars[key])
                e_units = solver.Value(fte_sub_end_vars[key])
                s_dt_ft = units_to_datetime(day0, s_units)
                e_dt_ft = units_to_datetime(day0, e_units)
            else:
                s_dt_ft, e_dt_ft = s_dt, e_dt
            fte_usage.setdefault(ft_id, []).append((s_dt_ft, e_dt_ft, t.test_id))

    # write csvs
    pd.DataFrame(rows).to_csv(os.path.join(outputs_dir_data, "tests_schedule.csv"), index=False)
    erows = []
    for eq_id, ivls in equip_usage.items():
        for s_dt, e_dt, test_id in sorted(ivls, key=lambda x: x[0]):
            erows.append({
                "equipment_id": eq_id,
                "test_id": test_id,
                "test_name": test_id_to_name.get(test_id, ""),
                "start": s_dt.isoformat(),
                "end": e_dt.isoformat()
            })
    pd.DataFrame(erows).to_csv(os.path.join(outputs_dir_data, "equipment_usage.csv"), index=False)
    frows = []
    for ft_id, ivls in fte_usage.items():
        for s_dt, e_dt, test_id in sorted(ivls, key=lambda x: x[0]):
            frows.append({
                "fte_id": ft_id,
                "test_id": test_id,
                "test_name": test_id_to_name.get(test_id, ""),
                "start": s_dt.isoformat(),
                "end": e_dt.isoformat()
            })
    pd.DataFrame(frows).to_csv(os.path.join(outputs_dir_data, "fte_usage.csv"), index=False)

    # plots
    def plot_gantt(data: List[Tuple[str, datetime, datetime, str]], title: str, fname: str) -> None:
        if not data:
            return
        # Numeric-aware sort for labels like "Test Group 1", "Test Group 10"
        num_re = re.compile(r"(\d+)")
        def label_key(lbl: str) -> tuple:
            m = num_re.search(lbl or "")
            if m:
                # Sort by non-numeric prefix then numeric value
                prefix = num_re.sub("", lbl).strip().lower()
                return (prefix, int(m.group(1)))
            return (lbl.lower(), -1)
        rows_sorted = sorted(set(lbl for lbl, *_ in data), key=label_key)
        ymap = {lbl: i for i, lbl in enumerate(rows_sorted)}
        fig, ax = plt.subplots(figsize=(12, max(4, 0.4*len(rows_sorted))))
        for lbl, s_dt, e_dt, key in data:
            y = ymap[lbl]
            width_days = (e_dt - s_dt).total_seconds()/86400.0
            ax.barh(y, width_days, left=mdates.date2num(s_dt), height=0.35, align='center')
            # annotate
            if 'FTE' in title or 'Equipment' in title:
                ax.text(mdates.date2num(s_dt)+width_days/2, y, key[0:10], va='center', ha='center', fontsize=7, color='white')
            if 'Tests by Leg' in title:
                ax.text(mdates.date2num(s_dt)+0.1, y+0.18, key[0:14], va='center', ha='left', fontsize=7, color='black')
        ax.set_yticks(range(len(rows_sorted)))
        ax.set_yticklabels(rows_sorted)
        ax.xaxis.set_major_locator(mdates.MonthLocator(interval=1))
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m'))
        ax.set_title(title)
        fig.autofmt_xdate()
        plt.tight_layout()
        plt.savefig(os.path.join(outputs_dir_plots, fname))
        plt.close(fig)

    # tests by leg
    test_bars = []
    for r in rows:
        test_bars.append((r['project_leg_id'], datetime.fromisoformat(r['start']), datetime.fromisoformat(r['end']), r['test_name']))
    plot_gantt(test_bars, 'Gantt - Tests by Leg', 'gantt_tests.png')

    equip_bars = []
    for eq_id, ivls in equip_usage.items():
        for s_dt, e_dt, test_id in ivls:
            equip_bars.append((eq_id, s_dt, e_dt, test_id))
    plot_gantt(equip_bars, 'Equipment Utilization', 'gantt_equipment.png')

    fte_bars = []
    for ft_id, ivls in fte_usage.items():
        for s_dt, e_dt, test_id in ivls:
            fte_bars.append((ft_id, s_dt, e_dt, test_id))
    plot_gantt(fte_bars, 'FTE Utilization', 'gantt_fte.png')

    # Resource timelines: availability vs utilization under each resource
    def plot_availability_and_usage(resource_windows: List[ResourceWindow], usage_map: Dict[str, List[Tuple[datetime, datetime, str]]], title: str, fname: str) -> None:
        if not resource_windows:
            return
        # Unique resource ids, numeric-aware sort (e.g., Setup_1, Setup_10)
        ids = list({w.resource_id for w in resource_windows})
        num_re = re.compile(r"(\d+)")
        def id_key(rid: str) -> tuple:
            m = num_re.search(rid or "")
            if m:
                prefix = num_re.sub("", rid).strip().lower()
                return (prefix, int(m.group(1)))
            return (rid.lower(), -1)
        rows_sorted: List[str] = sorted(ids, key=id_key)
        ymap = {rid: i*2 for i, rid in enumerate(rows_sorted)}  # double spacing for availability and usage rows
        fig, ax = plt.subplots(figsize=(12, max(4, 0.6*len(rows_sorted))))
        # availability bars (row y) – draw ALL windows per resource
        first_avail_drawn = False
        for w in resource_windows:
            rid = w.resource_id
            s_dt = datetime.combine(w.start_monday, datetime.min.time())
            e_dt = datetime.combine(w.end_monday_inclusive + timedelta(days=7), datetime.min.time())
            y = ymap[rid]
            width_days = (e_dt - s_dt).total_seconds()/86400.0
            ax.barh(y, width_days, left=mdates.date2num(s_dt), height=0.35, align='center', color='#c7e9c0', label='availability' if not first_avail_drawn else None)
            first_avail_drawn = True
            # annotate only once per resource at the beginning of its first window
            ax.text(mdates.date2num(s_dt)+0.1, y+0.18, f"{rid} avail", fontsize=7)
        # usage bars (row y+1)
        for rid in rows_sorted:
            y = ymap[rid] + 1
            for s_dt, e_dt, test_id in usage_map.get(rid, []):
                width_days = (e_dt - s_dt).total_seconds()/86400.0
                ax.barh(y, width_days, left=mdates.date2num(s_dt), height=0.35, align='center', color='#6baed6')
                ax.text(mdates.date2num(s_dt)+0.1, y+0.18, test_id[0:12], fontsize=7, color='white')
        ax.set_yticks([i for rid in rows_sorted for i in (ymap[rid], ymap[rid]+1)])
        ax.set_yticklabels([f"{rid} (avail)" if i%2==0 else f"{rid} (use)" for rid in rows_sorted for i in (0,1)])
        ax.xaxis.set_major_locator(mdates.MonthLocator(interval=1))
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m'))
        ax.set_title(title)
        fig.autofmt_xdate()
        plt.tight_layout()
        plt.savefig(os.path.join(outputs_dir_plots, fname))
        plt.close(fig)

    plot_availability_and_usage(fte_windows, fte_usage, 'Resource FTE (availability vs utilization)', 'resource_fte.png')
    plot_availability_and_usage(equip_windows, equip_usage, 'Resource Equipment (availability vs utilization)', 'resource_equipment.png')

    # Concurrency and capacity over time (half-day resolution)
    if rows:
        start_min = min(datetime.fromisoformat(r['start']) for r in rows)
        end_max = max(datetime.fromisoformat(r['end']) for r in rows)
        step = timedelta(hours=24//UNITS_PER_DAY)
        ts: List[datetime] = []
        active: List[int] = []
        avail_fte: List[int] = []
        avail_eq: List[int] = []
        t = start_min
        # Precompute availability windows as datetime
        fte_avail = [
            (
                datetime.combine(w.start_monday, datetime.min.time()),
                datetime.combine(w.end_monday_inclusive + timedelta(days=7), datetime.min.time()),
            )
            for w in fte_windows
        ]
        eq_avail = [
            (
                datetime.combine(w.start_monday, datetime.min.time()),
                datetime.combine(w.end_monday_inclusive + timedelta(days=7), datetime.min.time()),
            )
            for w in equip_windows
        ]

        intervals = [
            (datetime.fromisoformat(r['start']), datetime.fromisoformat(r['end'])) for r in rows
        ]
        while t <= end_max:
            ts.append(t)
            active.append(sum(1 for s,e in intervals if s <= t < e))
            avail_fte.append(sum(1 for a,b in fte_avail if a <= t < b))
            avail_eq.append(sum(1 for a,b in eq_avail if a <= t < b))
            t = t + step
        cap = [min(f,e) for f,e in zip(avail_fte, avail_eq)]
        dfc = pd.DataFrame({
            'timestamp': ts,
            'active_tests': active,
            'available_fte': avail_fte,
            'available_equipment': avail_eq,
            'capacity_min': cap,
        })
        dfc.to_csv(os.path.join(outputs_dir_data, 'concurrency_timeseries.csv'), index=False)

        # Plot concurrency vs capacity
        fig, ax = plt.subplots(figsize=(12, 3.5))
        ax.plot(ts, active, label='active tests')
        ax.step(ts, cap, where='post', label='capacity=min(FTE,Equipment)', linestyle='--', color='red')
        ax.set_ylim(bottom=0)
        ax.xaxis.set_major_locator(mdates.MonthLocator(interval=1))
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m'))
        ax.set_title('Active tests vs capacity')
        ax.legend(loc='upper left')
        fig.autofmt_xdate()
        plt.tight_layout()
        plt.savefig(os.path.join(outputs_dir_plots, 'concurrency_line.png'))
        plt.close(fig)



