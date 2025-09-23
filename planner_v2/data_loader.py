# planner_v2/data_loader.py

"""
Data loading and validation for the Test Planner V2.
"""

import os
import json
import pandas as pd
from datetime import date
from typing import Dict, List, Optional
from dataclasses import dataclass


@dataclass
class Leg:
    """Represents a project leg with tests that must be executed in sequence."""
    project_id: str
    project_name: str
    project_leg_id: str
    leg_number: str  # Changed from int to str to handle '2a', '2b', etc.
    leg_name: str
    priority: int
    start_iso_week: str
    start_monday: date


@dataclass
class Test:
    """Represents an individual test within a leg."""
    test_id: str
    project_leg_id: str
    sequence_index: int
    test_name: str
    test_description: str
    duration_days: float
    fte_required: int
    equipment_required: int
    fte_assigned: str  # Can be specific ID or type like "fte_sofia"
    equipment_assigned: str  # Can be specific ID or type, or "*" for any
    force_start_week_iso: Optional[str] = None


@dataclass
class ResourceWindow:
    """Represents an availability window for a resource (FTE or equipment)."""
    resource_id: str
    start_iso_week: str
    end_iso_week: str
    start_monday: date
    end_monday: date


@dataclass
class LegDependency:
    """Represents a dependency between legs."""
    predecessor_leg_id: str  # Leg that must finish first
    successor_leg_id: str    # Leg that can only start after predecessor finishes


@dataclass
class PlanningData:
    """Container for all loaded planning data."""
    legs: Dict[str, Leg]
    tests: List[Test]
    fte_windows: List[ResourceWindow]
    equipment_windows: List[ResourceWindow]
    priority_config: Dict
    test_duts: Dict[str, int]  # test_id -> dut_id mapping
    leg_dependencies: List[LegDependency]


def parse_iso_week(iso_week: str) -> date:
    """Parse ISO week string (e.g., '2025-W02') to Monday date."""
    if iso_week == "*" or iso_week.strip() == "":
        return None
    
    iso_week = iso_week.strip()
    year_str, week_str = iso_week.split("-W")
    return date.fromisocalendar(int(year_str), int(week_str), 1)


def load_legs(input_folder: str) -> Dict[str, Leg]:
    """Load project legs from data_legs.csv."""
    legs_path = os.path.join(input_folder, "data_legs.csv")
    df = pd.read_csv(legs_path)
    
    legs = {}
    for _, row in df.iterrows():
        project_leg_id = str(row["project_leg_id"]).strip()
        start_monday = parse_iso_week(str(row["start_iso_week"]))
        
        leg = Leg(
            project_id=str(row["project_id"]).strip(),
            project_name=str(row["project_name"]).strip(),
            project_leg_id=project_leg_id,
            leg_number=str(row["leg_number"]).strip(),  # Keep as string
            leg_name=str(row["leg_name"]).strip(),
            priority=int(row["priority"]),
            start_iso_week=str(row["start_iso_week"]).strip(),
            start_monday=start_monday
        )
        legs[project_leg_id] = leg
    
    return legs


def load_tests(input_folder: str) -> List[Test]:
    """Load tests from data_test.csv."""
    tests_path = os.path.join(input_folder, "data_test.csv")
    df = pd.read_csv(tests_path)
    
    # Group tests by leg to renumber sequence indices within each leg
    leg_tests = {}
    for _, row in df.iterrows():
        project_leg_id = str(row["project_leg_id"]).strip()
        if project_leg_id not in leg_tests:
            leg_tests[project_leg_id] = []
        leg_tests[project_leg_id].append(row)
    
    tests = []
    
    # Sort tests within each leg by original sequence index and renumber
    for project_leg_id, leg_test_rows in leg_tests.items():
        # Sort by original sequence index
        leg_test_rows.sort(key=lambda x: int(x["sequence_index"]))
        
        # Renumber sequences starting from 1 within each leg
        for new_seq_idx, row in enumerate(leg_test_rows, 1):
            force_start = str(row["force_start_week_iso"]).strip()
            if force_start == "*" or force_start == "":
                force_start = None
                
            # Create unique test ID using the renumbered sequence index
            base_test_id = str(row["test_id"]).strip()
            unique_test_id = f"{base_test_id}_seq{new_seq_idx}"
            
            test = Test(
                test_id=unique_test_id,
                project_leg_id=project_leg_id,
                sequence_index=new_seq_idx,  # Use renumbered sequence
                test_name=str(row["test"]).strip(),
                test_description=str(row["test_description"]).strip(),
                duration_days=float(row["duration_days"]),
                fte_required=int(row["fte_required"]),
                equipment_required=int(row["equipment_required"]),
                fte_assigned=str(row["fte_assigned"]).strip(),
                equipment_assigned=str(row["equipment_assigned"]).strip(),
                force_start_week_iso=force_start
            )
            tests.append(test)
    
    return tests


def load_resource_windows(input_folder: str, resource_type: str) -> List[ResourceWindow]:
    """Load resource availability windows from CSV file."""
    file_map = {
        "fte": "data_fte.csv",
        "equipment": "data_equipment.csv"
    }
    
    resource_path = os.path.join(input_folder, file_map[resource_type])
    df = pd.read_csv(resource_path)
    
    windows = []
    for _, row in df.iterrows():
        resource_id = str(row[f"{resource_type}_id"]).strip()
        start_iso = str(row["available_start_week_iso"]).strip()
        end_iso = str(row["available_end_week_iso"]).strip()
        
        window = ResourceWindow(
            resource_id=resource_id,
            start_iso_week=start_iso,
            end_iso_week=end_iso,
            start_monday=parse_iso_week(start_iso),
            end_monday=parse_iso_week(end_iso)
        )
        windows.append(window)
    
    return windows


def load_test_duts(input_folder: str, tests: List[Test]) -> Dict[str, int]:
    """Load test-DUT mappings from data_test_duts.csv and map to unique test IDs."""
    duts_path = os.path.join(input_folder, "data_test_duts.csv")
    df = pd.read_csv(duts_path)
    
    # Create mapping from original test_id to DUT
    original_to_dut = {}
    for _, row in df.iterrows():
        test_id = str(row["test_id"]).strip()
        dut_id = int(row["dut_id"])
        original_to_dut[test_id] = dut_id
    
    # Map unique test IDs to DUTs
    test_duts = {}
    for test in tests:
        # Extract original test ID from unique ID (remove _seqN suffix)
        original_id = test.test_id.rsplit('_seq', 1)[0]
        if original_id in original_to_dut:
            test_duts[test.test_id] = original_to_dut[original_id]
    
    return test_duts


def load_priority_config(input_folder: str) -> Dict:
    """Load priority configuration from priority_config.json."""
    config_path = os.path.join(input_folder, "priority_config.json")
    with open(config_path, 'r') as f:
        return json.load(f)


def validate_data(data: PlanningData) -> List[str]:
    """Validate loaded data and return list of validation errors."""
    errors = []
    
    # Check that all tests belong to valid legs
    leg_ids = set(data.legs.keys())
    for test in data.tests:
        if test.project_leg_id not in leg_ids:
            errors.append(f"Test {test.test_id} references unknown leg {test.project_leg_id}")
    
    # Check test sequence indices are continuous within each leg
    leg_tests = {}
    for test in data.tests:
        if test.project_leg_id not in leg_tests:
            leg_tests[test.project_leg_id] = []
        leg_tests[test.project_leg_id].append(test)
    
    for leg_id, tests in leg_tests.items():
        sequences = sorted([t.sequence_index for t in tests])
        expected = list(range(1, len(sequences) + 1))
        if sequences != expected:
            errors.append(f"Leg {leg_id} has non-continuous sequence indices: {sequences}")
    
    # Check resource assignments exist
    fte_ids = set(w.resource_id for w in data.fte_windows)
    equipment_ids = set(w.resource_id for w in data.equipment_windows)
    
    for test in data.tests:
        # Check FTE assignment
        if test.fte_assigned != "*" and not test.fte_assigned.startswith("fte_"):
            errors.append(f"Test {test.test_id} has invalid FTE assignment: {test.fte_assigned}")
        
        # Check equipment assignment  
        if test.equipment_assigned != "*" and not test.equipment_assigned.startswith("setup_"):
            errors.append(f"Test {test.test_id} has invalid equipment assignment: {test.equipment_assigned}")
    
    return errors


def detect_leg_dependencies(legs: Dict[str, Leg]) -> List[LegDependency]:
    """
    Detect leg dependencies based on naming patterns.
    
    Legs with pattern 'project_*_2a' and 'project_*_2b' depend on 'project_*_2' finishing first.
    
    Args:
        legs: Dictionary of loaded legs
        
    Returns:
        List of detected leg dependencies
    """
    dependencies = []
    
    # Group legs by project
    projects = {}
    for leg_id, leg in legs.items():
        project_id = leg.project_id
        if project_id not in projects:
            projects[project_id] = []
        projects[project_id].append(leg)
    
    # For each project, detect dependencies
    for project_id, project_legs in projects.items():
        leg_map = {leg.project_leg_id: leg for leg in project_legs}
        
        for leg in project_legs:
            leg_id = leg.project_leg_id
            
            # Check if this is a sub-leg (ends with 'a', 'b', etc.)
            if '_' in leg_id:
                parts = leg_id.split('_')
                if len(parts) >= 3 and len(parts[-1]) == 2 and parts[-1][-1].isalpha():
                    # This is a sub-leg like 'mwcu_b10_2a'
                    base_leg_id = '_'.join(parts[:-1]) + '_' + parts[-1][:-1]  # 'mwcu_b10_2'
                    
                    if base_leg_id in leg_map:
                        dependencies.append(LegDependency(
                            predecessor_leg_id=base_leg_id,
                            successor_leg_id=leg_id
                        ))
                        print(f"Detected dependency: {leg_id} depends on {base_leg_id}")
    
    return dependencies


def load_data(input_folder: str) -> PlanningData:
    """
    Load and validate all input data from the specified folder.
    
    Args:
        input_folder: Path to folder containing CSV files and config
        
    Returns:
        PlanningData object with all loaded data
        
    Raises:
        ValueError: If validation errors are found
        FileNotFoundError: If required files are missing
    """
    # Check required files exist
    required_files = [
        "data_legs.csv", "data_test.csv", "data_fte.csv", 
        "data_equipment.csv", "data_test_duts.csv", "priority_config.json"
    ]
    
    for filename in required_files:
        filepath = os.path.join(input_folder, filename)
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Required file not found: {filepath}")
    
    # Load all data
    legs = load_legs(input_folder)
    tests = load_tests(input_folder)
    fte_windows = load_resource_windows(input_folder, "fte")
    equipment_windows = load_resource_windows(input_folder, "equipment")
    test_duts = load_test_duts(input_folder, tests)  # Pass tests for unique ID mapping
    priority_config = load_priority_config(input_folder)
    
    # Detect leg dependencies
    leg_dependencies = detect_leg_dependencies(legs)
    
    data = PlanningData(
        legs=legs,
        tests=tests,
        fte_windows=fte_windows,
        equipment_windows=equipment_windows,
        priority_config=priority_config,
        test_duts=test_duts,
        leg_dependencies=leg_dependencies
    )
    
    # Validate data
    errors = validate_data(data)
    if errors:
        error_msg = "Data validation failed:\n" + "\n".join(f"  - {error}" for error in errors)
        raise ValueError(error_msg)
    
    return data
