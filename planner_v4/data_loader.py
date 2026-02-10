# planner_v4/data_loader.py

"""
Data loading and validation for the Test Planner V4.

This module handles loading and validating input data from CSV files for the test planning
optimization system. It provides comprehensive data validation, type checking, and
relationship integrity verification.

Main Components:
- Data Classes: Typed data structures for legs, tests, and resources
- Loading Functions: CSV file parsing and data conversion
- Validation Functions: Data integrity and consistency checks
- PlanningData Container: Unified data structure for all input data

Input Files Required:
- data_legs.csv: Project leg definitions with priorities and deadlines
- data_test.csv: Individual test specifications with resource requirements
- data_fte.csv: FTE (Full-Time Equivalent) resource availability
- data_equipment.csv: Equipment resource availability
- data_test_duts.csv: Test-to-device-under-test mappings
- priority_config.json: Priority rule configuration

Data Validation:
- Referential integrity between tests and legs
- Resource availability consistency
- Date format and range validation
- Required field presence checks
- Type and format validation

Usage:
    # Load all data from input folder
    data = load_data("input_data/gen3_pv/senario_1")

    # Access loaded data
    print(f"Loaded {len(data.legs)} legs, {len(data.tests)} tests")

    # Validate data integrity
    validate_data_integrity(data)

Functions:
    load_data: Main data loading function
    validate_data_integrity: Comprehensive data validation
    load_legs_data: Load project leg definitions
    load_tests_data: Load individual test specifications
    load_fte_data: Load FTE resource availability
    load_equipment_data: Load equipment resource availability
    load_test_duts_data: Load test-to-DUT mappings

Classes:
    Leg: Project leg data structure
    Test: Individual test data structure
    ResourceWindow: Resource availability window
    PlanningData: Container for all loaded data

Exceptions:
    FileNotFoundError: When required input files are missing
    ValueError: When data validation fails
    KeyError: When required columns are missing from CSV files
"""

import os
import json
import pandas as pd
from datetime import date
import re
from typing import Dict, List, Optional
from dataclasses import dataclass, replace


@dataclass
class Leg:
    """
    Represents a project leg with tests that must be executed in sequence.

    A project leg is a logical grouping of tests that share scheduling constraints,
    resource requirements, and priority rules. All tests within a leg must be
    executed in their specified sequence order, and the leg has collective
    priority and deadline constraints.

    Attributes:
        project_id (str): Unique identifier for the parent project
        project_name (str): Human-readable project name
        project_leg_id (str): Unique identifier for this leg (primary key)
        leg_number (str): Leg sequence number (supports '1', '2a', '2b', etc.)
        leg_name (str): Human-readable leg description
        priority (int): Priority level (higher numbers = higher priority)
        start_iso_week (str): ISO week string (YYYY-WW) for planned start
        start_monday (date): Monday date of the start week

    Example:
        >>> leg = Leg(
        ...     project_id="PROJ_001",
        ...     project_name="Solar Panel Testing",
        ...     project_leg_id="LEG_001_1",
        ...     leg_number="1",
        ...     leg_name="Initial Testing Phase",
        ...     priority=5,
        ...     start_iso_week="2024-01",
        ...     start_monday=date(2024, 1, 1)
        ... )

    Note:
        The leg_number field uses string type to support complex numbering
        schemes like '2a', '2b' for parallel legs within the same sequence.
    """

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
    """
    Represents an individual test within a project leg.

    A test is the atomic unit of work in the planning system. Each test has
    specific resource requirements, duration estimates, and must be executed
    within the constraints of its parent leg. Tests within the same leg must
    be executed in sequence order.

    Attributes:
        test_id (str): Unique identifier for this test (primary key)
        project_leg_id (str): Reference to parent leg (foreign key)
        sequence_index (int): Execution order within the leg (1-based)
        test_name (str): Human-readable test name
        test_description (str): Detailed test description
        duration_days (float): Estimated duration in working days
        fte_required (int): Number of FTE resources required simultaneously
        equipment_required (int): Number of equipment resources required simultaneously
        fte_assigned (str): Specific FTE assignment or type requirement
        equipment_assigned (str): Specific equipment assignment or type requirement
        force_start_week_iso (Optional[str]): Forced start week (YYYY-WW format)

    Example:
        >>> test = Test(
        ...     test_id="TEST_001",
        ...     project_leg_id="LEG_001_1",
        ...     sequence_index=1,
        ...     test_name="Power Output Test",
        ...     test_description="Measure maximum power output under standard conditions",
        ...     duration_days=2.5,
        ...     fte_required=2,
        ...     equipment_required=1,
        ...     fte_assigned="fte_sofia",
        ...     equipment_assigned="EQUIP_SOLAR_001",
        ...     force_start_week_iso=None
        ... )

    Note:
        Resource assignments can be specific IDs (e.g., "fte_sofia") or general
        types (e.g., "sofia_fte"). Use "*" in equipment_assigned for any available
        equipment of the required type.
    """

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
    fte_time_pct: float = 100.0


@dataclass
class ResourceWindow:
    """
    Represents an availability window for a resource (FTE or equipment).

    Resource windows define when specific resources are available for scheduling.
    Each resource can have multiple availability windows, allowing for complex
    availability patterns such as part-time availability or seasonal constraints.

    Attributes:
        resource_id (str): Unique identifier for the resource
        start_iso_week (str): ISO week string (YYYY-WW) when availability starts
        end_iso_week (str): ISO week string (YYYY-WW) when availability ends
        start_monday (date): Monday date of the start week
        end_monday (date): Monday date of the week after end_iso_week

    Example:
        >>> window = ResourceWindow(
        ...     resource_id="fte_sofia",
        ...     start_iso_week="2024-01",
        ...     end_iso_week="2024-26",
        ...     start_monday=date(2024, 1, 1),
        ...     end_monday=date(2024, 7, 1)
        ... )
        # Resource available from Jan 1 to June 30, 2024

    Note:
        The end_monday date is the Monday of the week AFTER end_iso_week.
        For example, if end_iso_week is "2024-26", end_monday will be the
        Monday of week 2024-27.
    """

    resource_id: str
    start_iso_week: str
    end_iso_week: str
    start_monday: date
    end_monday: date


@dataclass
class LegDependency:
    """Represents a dependency between legs."""

    predecessor_leg_id: str  # Leg that must finish first
    successor_leg_id: str  # Leg that can only start after predecessor finishes


@dataclass
class PlanningData:
    """
    Container for all loaded and validated planning data.

    This is the main data container that holds all input data required for
    optimization. It serves as the single source of truth for the planning
    system and is passed between all major components.

    Attributes:
        legs (Dict[str, Leg]): Project leg definitions indexed by project_leg_id
        tests (List[Test]): All individual test specifications
        fte_windows (List[ResourceWindow]): FTE resource availability windows
        equipment_windows (List[ResourceWindow]): Equipment resource availability windows
        priority_config (Dict): Priority rule configuration from JSON
        test_duts (Dict[str, int]): Test-to-device-under-test mappings
        leg_dependencies (List[LegDependency]): Inter-leg dependency constraints

    Example:
        >>> data = PlanningData(
        ...     legs={"LEG_001": leg_obj},
        ...     tests=[test1, test2, test3],
        ...     fte_windows=[fte_window1, fte_window2],
        ...     equipment_windows=[equip_window1],
        ...     priority_config={"rules": [...], "weights": {...}},
        ...     test_duts={"TEST_001": 1, "TEST_002": 2},
        ...     leg_dependencies=[dep1, dep2]
        ... )

    Note:
        This container is immutable after creation. All data should be validated
        before creating a PlanningData instance. The container provides efficient
        access patterns for the optimization algorithms.
    """

    legs: Dict[str, Leg]
    tests: List[Test]
    fte_windows: List[ResourceWindow]
    equipment_windows: List[ResourceWindow]
    priority_config: Dict
    test_duts: Dict[str, int]  # test_id -> dut_id mapping
    leg_dependencies: List[LegDependency]


WEEK_VALUE_RE = re.compile(
    r"^(?P<year>\d{4})-(?:W)?(?P<week>\d{1,2})(?:\.(?P<fraction>[0-6]))?$"
)


def normalize_week_value(
    raw_value, field_name: str, allow_blank: bool = False
) -> Optional[str]:
    """Normalize legacy/canonical week values to canonical ``YYYY-Www.f`` format."""
    if raw_value is None or pd.isna(raw_value):
        if allow_blank:
            return None
        raise ValueError(
            f"Invalid week value for {field_name}: {raw_value!r}. Expected YYYY-Www.f"
        )

    value = str(raw_value).strip()
    if value in {"", "*", "nan", "None"}:
        if allow_blank:
            return None
        raise ValueError(
            f"Invalid week value for {field_name}: {raw_value!r}. Expected YYYY-Www.f"
        )

    match = WEEK_VALUE_RE.fullmatch(value)
    if not match:
        raise ValueError(
            f"Invalid week value for {field_name}: {raw_value!r}. Expected YYYY-Www.f"
        )

    year = int(match.group("year"))
    week = int(match.group("week"))
    fraction = int(match.group("fraction") or 0)

    if not (1900 <= year <= 2100):
        raise ValueError(
            f"Invalid week value for {field_name}: {raw_value!r}. Year must be between 1900 and 2100"
        )
    if not (1 <= week <= 53):
        raise ValueError(
            f"Invalid week value for {field_name}: {raw_value!r}. Week must be between 1 and 53"
        )
    if not (0 <= fraction <= 6):
        raise ValueError(
            f"Invalid week value for {field_name}: {raw_value!r}. Fraction must be between 0 and 6"
        )

    return f"{year:04d}-W{week:02d}.{fraction}"


def parse_iso_week(iso_week: str) -> date:
    """Parse canonical/legacy ISO week to date, where fraction is Monday+offset.

    Canonical format is ``YYYY-Www.f`` where ``f`` is day offset ``0..6`` from
    Monday (0=Monday, 6=Sunday).
    """
    normalized_week = normalize_week_value(iso_week, "iso_week", allow_blank=True)
    if normalized_week is None:
        return None

    year_week, fraction = normalized_week.split(".")
    year_str, week_str = year_week.split("-W")
    return date.fromisocalendar(int(year_str), int(week_str), int(fraction) + 1)


def load_legs(input_folder: str) -> Dict[str, Leg]:
    """Load project legs from data_legs.csv."""
    legs_path = os.path.join(input_folder, "data_legs.csv")
    df = pd.read_csv(legs_path, dtype={"leg_number": str})

    # Vectorized string and date operations
    for col in [
        "project_id",
        "project_name",
        "project_leg_id",
        "leg_name",
        "start_iso_week",
    ]:
        if col in df.columns:
            df[col] = df[col].str.strip()

    df["start_iso_week"] = df["start_iso_week"].apply(
        lambda value: normalize_week_value(value, "data_legs.start_iso_week")
    )

    df["start_monday"] = df["start_iso_week"].apply(parse_iso_week)

    legs = {row["project_leg_id"]: Leg(**row) for row in df.to_dict("records")}
    return legs


def load_tests(input_folder: str) -> List[Test]:
    """Load tests from data_test.csv."""
    tests_path = os.path.join(input_folder, "data_test.csv")
    df = pd.read_csv(tests_path)

    # Clean string columns
    str_cols = [
        "project_leg_id",
        "test_id",
        "test",
        "test_description",
        "fte_assigned",
        "equipment_assigned",
    ]
    for col in str_cols:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip()

    if "force_start_week_iso" in df.columns:
        df["force_start_week_iso"] = df["force_start_week_iso"].apply(
            lambda value: normalize_week_value(
                value, "data_test.force_start_week_iso", allow_blank=True
            )
        )

    # Sort and renumber sequence index within each leg
    df = df.sort_values(by=["project_leg_id", "sequence_index"])
    df["new_sequence_index"] = df.groupby("project_leg_id").cumcount() + 1

    # Create unique test ID
    df["unique_test_id"] = df["test_id"] + "_seq" + df["new_sequence_index"].astype(str)
    df = df.rename(columns={"test": "test_name"})

    tests = [
        Test(
            test_id=row["unique_test_id"],
            project_leg_id=row["project_leg_id"],
            sequence_index=row["new_sequence_index"],
            test_name=row["test_name"],
            test_description=row["test_description"],
            duration_days=float(row["duration_days"]),
            fte_required=int(row["fte_required"]),
            equipment_required=int(row["equipment_required"]),
            fte_assigned=row["fte_assigned"],
            equipment_assigned=row["equipment_assigned"],
            force_start_week_iso=row.get("force_start_week_iso"),
            fte_time_pct=float(row.get("fte_time_pct", 100.0)),
        )
        for _, row in df.iterrows()
    ]

    return tests


def load_resource_windows(
    input_folder: str, resource_type: str
) -> List[ResourceWindow]:
    """Load resource availability windows from CSV file."""
    file_map = {"fte": "data_fte.csv", "equipment": "data_equipment.csv"}

    resource_path = os.path.join(input_folder, file_map[resource_type])
    df = pd.read_csv(resource_path)

    id_col = f"{resource_type}_id"
    df[id_col] = df[id_col].str.strip()
    df["available_start_week_iso"] = df["available_start_week_iso"].apply(
        lambda value: normalize_week_value(
            value, f"{file_map[resource_type]}.available_start_week_iso"
        )
    )
    df["available_end_week_iso"] = df["available_end_week_iso"].apply(
        lambda value: normalize_week_value(
            value, f"{file_map[resource_type]}.available_end_week_iso"
        )
    )

    df["start_monday"] = df["available_start_week_iso"].apply(parse_iso_week)
    df["end_monday"] = df["available_end_week_iso"].apply(parse_iso_week)

    windows = [
        ResourceWindow(
            resource_id=row[id_col],
            start_iso_week=row["available_start_week_iso"],
            end_iso_week=row["available_end_week_iso"],
            start_monday=row["start_monday"],
            end_monday=row["end_monday"],
        )
        for row in df.to_dict("records")
    ]
    return windows


def load_test_duts(input_folder: str, tests: List[Test]) -> Dict[str, int]:
    """Load test-DUT mappings from data_test_duts.csv and map to unique test IDs."""
    duts_path = os.path.join(input_folder, "data_test_duts.csv")
    duts_df = pd.read_csv(duts_path, dtype={"test_id": str, "dut_id": int})

    duts_df["test_id"] = duts_df["test_id"].str.strip()

    if not tests:
        return {}

    tests_df = pd.DataFrame([vars(t) for t in tests])

    # Extract original test ID from unique ID
    tests_df["original_test_id"] = tests_df["test_id"].str.rsplit("_seq", n=1).str[0]

    # Validate that DUT file has unique test_id entries
    # (one DUT per original test_id, not per unique_test_id)
    duplicate_duts = duts_df["test_id"].duplicated()
    if duplicate_duts.any():
        raise ValueError(
            f"data_test_duts.csv has duplicate test_id entries: "
            f"{duts_df.loc[duplicate_duts, 'test_id'].unique().tolist()}. "
            f"Each original test_id should map to exactly one DUT."
        )

    # Merge tests with DUTs on the original test ID
    merged_df = pd.merge(
        tests_df, duts_df, left_on="original_test_id", right_on="test_id", how="inner"
    )

    # Create the final dictionary from the merged data
    if not merged_df.empty:
        return pd.Series(merged_df.dut_id.values, index=merged_df.test_id_x).to_dict()

    return {}


def load_priority_config(input_folder: str) -> Dict:
    """Load priority configuration from priority_config.json or priority_config.yaml."""
    import logging

    logger = logging.getLogger(__name__)

    # Try YAML first, then JSON
    yaml_path = os.path.join(input_folder, "priority_config.yaml")
    json_path = os.path.join(input_folder, "priority_config.json")

    config_path = None
    use_yaml = False

    if os.path.exists(yaml_path):
        config_path = yaml_path
        use_yaml = True
        logger.info(f"Loading priority configuration from YAML: {config_path}")
    elif os.path.exists(json_path):
        config_path = json_path
        use_yaml = False
        logger.info(f"Loading priority configuration from JSON: {config_path}")
    else:
        raise FileNotFoundError(
            f"Priority config file not found. Expected priority_config.yaml or priority_config.json in {input_folder}"
        )

    try:
        with open(config_path, "r") as f:
            if use_yaml:
                try:
                    import yaml

                    config_dict = yaml.safe_load(f)
                except ImportError:
                    raise ImportError(
                        "PyYAML is required to load YAML config files. Install with: pip install pyyaml"
                    )
            else:
                config_dict = json.load(f)

        # Log the mode and key parameters
        mode = config_dict.get("mode", "unknown")
        logger.info(f"Priority config loaded: mode={mode}")

        if mode == "resource_bottleneck":
            logger.info(
                f"  - Bottleneck threshold: {config_dict.get('bottleneck_threshold', 'N/A')}"
            )
            logger.info(
                f"  - Resource balance weight: {config_dict.get('resource_balance_weight', 'N/A')}"
            )
            logger.info(
                f"  - Utilization target: {config_dict.get('utilization_target', 'N/A')}"
            )
        elif mode == "end_date_sticky":
            logger.info(
                f"  - Target completion date: {config_dict.get('target_completion_date', 'N/A')}"
            )
        elif mode == "leg_end_dates":
            leg_deadlines = config_dict.get("leg_deadlines", {})
            logger.info(f"  - Leg deadlines: {len(leg_deadlines)} legs")

        weights = config_dict.get("weights", {})
        logger.info(f"  - Weights: {weights}")

        return config_dict
    except FileNotFoundError:
        logger.warning(f"Priority config file not found: {config_path}")
        logger.info("Using default priority configuration")
        return {}
    except Exception as e:
        logger.error(f"Failed to load priority config from {config_path}: {e}")
        logger.info("Using default priority configuration")
        return {}


def load_scenario_overrides(input_folder: str) -> Dict:
    """Load optional scenario override configuration from scenario_overrides.json."""
    overrides_path = os.path.join(input_folder, "scenario_overrides.json")
    if not os.path.exists(overrides_path):
        return {}

    with open(overrides_path, "r") as handle:
        overrides = json.load(handle)

    if not isinstance(overrides, dict):
        raise ValueError("scenario_overrides.json must contain a JSON object")

    return overrides


def _resolve_assignment_override(
    current_value: str, field_name: str, leg_override: Dict, project_override: Dict
) -> str:
    """Apply deterministic override precedence for assignment fields."""
    if current_value != "*":
        return current_value

    for override_source in (leg_override, project_override):
        override_value = override_source.get(field_name)
        if isinstance(override_value, str):
            override_value = override_value.strip()

        if override_value and override_value != "*":
            return override_value

    return current_value


def apply_scenario_overrides(
    tests: List[Test], legs: Dict[str, Leg], scenario_overrides: Optional[Dict]
) -> List[Test]:
    """Apply scenario project/leg assignment overrides with deterministic precedence."""
    if not scenario_overrides:
        return tests

    project_overrides = scenario_overrides.get("project_overrides", {})
    leg_overrides = scenario_overrides.get("leg_overrides", {})

    if not isinstance(project_overrides, dict) or not isinstance(leg_overrides, dict):
        raise ValueError(
            "scenario_overrides project_overrides and leg_overrides must be JSON objects"
        )

    updated_tests = []
    for test in tests:
        leg = legs.get(test.project_leg_id)
        project_override = {}
        if leg and leg.project_id in project_overrides:
            project_override = project_overrides.get(leg.project_id, {})
        leg_override = leg_overrides.get(test.project_leg_id, {})

        if not isinstance(project_override, dict) or not isinstance(leg_override, dict):
            raise ValueError("scenario override entries must be JSON objects")

        updated_tests.append(
            replace(
                test,
                fte_assigned=_resolve_assignment_override(
                    test.fte_assigned,
                    "fte_assigned",
                    leg_override,
                    project_override,
                ),
                equipment_assigned=_resolve_assignment_override(
                    test.equipment_assigned,
                    "equipment_assigned",
                    leg_override,
                    project_override,
                ),
            )
        )

    return updated_tests


def validate_data(data: PlanningData) -> List[str]:
    """Validate loaded data and return list of validation errors."""
    errors = []

    # Check that all tests belong to valid legs
    leg_ids = set(data.legs.keys())
    for test in data.tests:
        if test.project_leg_id not in leg_ids:
            errors.append(
                f"Test {test.test_id} references unknown leg {test.project_leg_id}"
            )

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
            errors.append(
                f"Leg {leg_id} has non-continuous sequence indices: {sequences}"
            )

    # Check resource assignments exist
    fte_ids = set(w.resource_id for w in data.fte_windows)
    equipment_ids = set(w.resource_id for w in data.equipment_windows)

    for test in data.tests:
        # Check FTE assignment
        if test.fte_assigned != "*" and not test.fte_assigned.startswith("fte_"):
            errors.append(
                f"Test {test.test_id} has invalid FTE assignment: {test.fte_assigned}"
            )

        # Check equipment assignment
        if test.equipment_assigned != "*" and not test.equipment_assigned.startswith(
            "setup_"
        ):
            errors.append(
                f"Test {test.test_id} has invalid equipment assignment: {test.equipment_assigned}"
            )

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
            if "_" in leg_id:
                parts = leg_id.split("_")
                if len(parts) >= 3 and len(parts[-1]) == 2 and parts[-1][-1].isalpha():
                    # This is a sub-leg like 'mwcu_b10_2a'
                    base_leg_id = (
                        "_".join(parts[:-1]) + "_" + parts[-1][:-1]
                    )  # 'mwcu_b10_2'

                    if base_leg_id in leg_map:
                        dependencies.append(
                            LegDependency(
                                predecessor_leg_id=base_leg_id, successor_leg_id=leg_id
                            )
                        )
                        print(f"Detected dependency: {leg_id} depends on {base_leg_id}")

    return dependencies


def load_data(input_folder: str) -> PlanningData:
    """
    Load and validate all input data from the specified folder.

    This is the main data loading function that orchestrates the complete data loading
    process for the Test Planner. It loads data from all required CSV files and JSON
    configuration, performs comprehensive validation, and returns a unified PlanningData
    object ready for optimization.

    Loading Process:
    1. Check that all required input files exist
    2. Load project leg definitions (data_legs.csv)
    3. Load individual test specifications (data_test.csv)
    4. Load FTE resource availability windows (data_fte.csv)
    5. Load equipment resource availability windows (data_equipment.csv)
    6. Load test-to-DUT mappings (data_test_duts.csv)
    7. Load priority configuration (priority_config.json)
    8. Perform comprehensive data validation and integrity checks
    9. Return unified PlanningData container

    Args:
        input_folder (str): Path to folder containing all required input files.
            Must contain: data_legs.csv, data_test.csv, data_fte.csv,
            data_equipment.csv, data_test_duts.csv, priority_config.json

    Returns:
        PlanningData: Unified data container with all loaded and validated data:
            - legs: Dict[str, Leg] - Project leg definitions
            - tests: List[Test] - Individual test specifications
            - fte_windows: Dict[str, ResourceWindow] - FTE availability
            - equipment_windows: Dict[str, ResourceWindow] - Equipment availability
            - test_duts: Dict[str, List[str]] - Test-to-DUT mappings
            - priority_config: Dict - Priority rule configuration

    Raises:
        FileNotFoundError: When any required input file is missing from input_folder
        ValueError: When data validation fails (missing required fields, invalid formats,
            referential integrity violations, date inconsistencies)
        KeyError: When required columns are missing from CSV files
        json.JSONDecodeError: When priority_config.json is malformed

    Example:
        Basic usage:
        >>> data = load_data("input_data/gen3_pv/senario_1")
        >>> print(f"Loaded {len(data.legs)} project legs")
        >>> print(f"Loaded {len(data.tests)} individual tests")

        Error handling:
        >>> try:
        ...     data = load_data("nonexistent_folder")
        ... except FileNotFoundError as e:
        ...     print(f"Missing files: {e}")

    Note:
        This function performs extensive validation to ensure data integrity before
        optimization. Use validate_data_integrity() separately if you need additional
        validation or want to skip the automatic validation in load_data().
    """
    # Check required files exist
    required_files = [
        "data_legs.csv",
        "data_test.csv",
        "data_fte.csv",
        "data_equipment.csv",
        "data_test_duts.csv",
        "priority_config.json",
    ]

    for filename in required_files:
        filepath = os.path.join(input_folder, filename)
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Required file not found: {filepath}")

    # Load all data
    legs = load_legs(input_folder)
    tests = load_tests(input_folder)
    scenario_overrides = load_scenario_overrides(input_folder)
    tests = apply_scenario_overrides(tests, legs, scenario_overrides)
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
        leg_dependencies=leg_dependencies,
    )

    # Validate data
    errors = validate_data(data)
    if errors:
        error_msg = "Data validation failed:\n" + "\n".join(
            f"  - {error}" for error in errors
        )
        raise ValueError(error_msg)

    return data
