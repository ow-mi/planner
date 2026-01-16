# Test Planner V4 API Reference

This document provides comprehensive API documentation for the Test Planner V4 library.

## Table of Contents

- [Core Functions](#core-functions)
- [Data Structures](#data-structures)
- [Configuration](#configuration)
- [Reports](#reports)
- [Utilities](#utilities)

## Core Functions

### main()

```python
def main(input_folder: str = None, debug_level: str = None,
         time_limit: float = None, output_folder: str = None) -> dict
```

Main orchestration function for the Test Planner V4.

**Parameters:**
- `input_folder` (str, optional): Path to input data folder containing CSV files
- `debug_level` (str, optional): Logging verbosity level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
- `time_limit` (float, optional): Maximum solver time in seconds
- `output_folder` (str, optional): Custom output folder path

**Returns:**
- `dict`: Solution result containing status, makespan, test schedules, and statistics

**Raises:**
- `FileNotFoundError`: When required input files are missing
- `ValueError`: When input data validation fails
- `RuntimeError`: When solver encounters critical errors

**Example:**
```python
from planner_v4 import main

solution = main(
    input_folder="input_data/gen3_pv/senario_1",
    debug_level="INFO",
    time_limit=300.0
)
print(f"Status: {solution['status']}")
```

### cli()

```python
def cli() -> None
```

Command line interface for Test Planner V4.

Provides argument parsing and executes the main planning process with user-specified parameters.

**Command Line Arguments:**
- `--input-folder, -i`: Input data folder path
- `--debug-level, -d`: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
- `--time-limit, -t`: Solver time limit in seconds
- `--output-folder, -o`: Custom output folder path

**Example:**
```bash
python -m planner_v4.main --input-folder input_data/gen3_pv/senario_1 --debug-level DEBUG
```

## Data Structures

### PlanningData

Container for all loaded and validated planning data.

**Attributes:**
- `legs` (Dict[str, Leg]): Project leg definitions indexed by project_leg_id
- `tests` (List[Test]): All individual test specifications
- `fte_windows` (List[ResourceWindow]): FTE resource availability windows
- `equipment_windows` (List[ResourceWindow]): Equipment resource availability windows
- `priority_config` (Dict): Priority rule configuration from JSON
- `test_duts` (Dict[str, int]): Test-to-device-under-test mappings
- `leg_dependencies` (List[LegDependency]): Inter-leg dependency constraints

**Example:**
```python
data = load_data("input_data/gen3_pv/senario_1")
print(f"Loaded {len(data.legs)} legs, {len(data.tests)} tests")
```

### Leg

Represents a project leg with tests that must be executed in sequence.

**Attributes:**
- `project_id` (str): Unique identifier for the parent project
- `project_name` (str): Human-readable project name
- `project_leg_id` (str): Unique identifier for this leg (primary key)
- `leg_number` (str): Leg sequence number (supports '1', '2a', '2b', etc.)
- `leg_name` (str): Human-readable leg description
- `priority` (int): Priority level (higher numbers = higher priority)
- `start_iso_week` (str): ISO week string (YYYY-WW) for planned start
- `start_monday` (date): Monday date of the start week

### Test

Represents an individual test within a project leg.

**Attributes:**
- `test_id` (str): Unique identifier for this test (primary key)
- `project_leg_id` (str): Reference to parent leg (foreign key)
- `sequence_index` (int): Execution order within the leg (1-based)
- `test_name` (str): Human-readable test name
- `test_description` (str): Detailed test description
- `duration_days` (float): Estimated duration in working days
- `fte_required` (int): Number of FTE resources required simultaneously
- `equipment_required` (int): Number of equipment resources required simultaneously
- `fte_assigned` (str): Specific FTE assignment or type requirement
- `equipment_assigned` (str): Specific equipment assignment or type requirement
- `force_start_week_iso` (Optional[str]): Forced start week (YYYY-WW format)

### ResourceWindow

Represents an availability window for a resource (FTE or equipment).

**Attributes:**
- `resource_id` (str): Unique identifier for the resource
- `start_iso_week` (str): ISO week string (YYYY-WW) when availability starts
- `end_iso_week` (str): ISO week string (YYYY-WW) when availability ends
- `start_monday` (date): Monday date of the start week
- `end_monday` (date): Monday date of the week after end_iso_week

### TestSchedule

Represents the scheduling result for a single test.

**Attributes:**
- `test_id` (str): Unique test identifier
- `project_leg_id` (str): Parent leg identifier
- `test_name` (str): Human-readable test name
- `start_day` (int): Start day offset from project start (0-based)
- `end_day` (int): End day offset from project start (0-based)
- `duration_days` (int): Actual scheduled duration in days
- `start_date` (date): Absolute start date
- `end_date` (date): Absolute end date
- `assigned_fte` (List[str]): List of assigned FTE resource IDs
- `assigned_equipment` (List[str]): List of assigned equipment resource IDs

### SolutionResult

Complete optimization solution container.

**Attributes:**
- `status` (str): Solution status (OPTIMAL, FEASIBLE, INFEASIBLE, NO_SOLUTION, TIMEOUT)
- `makespan` (Optional[int]): Total project duration in days (if solution found)
- `test_schedule` (List[TestSchedule]): Complete test scheduling results
- `solver_stats` (Dict): Solver performance statistics
- `resource_utilization` (Dict): Resource usage statistics

## Configuration

### SolverConfig

Configuration for the CP-SAT solver.

**Attributes:**
- `time_limit_seconds` (float): Maximum solving time in seconds (default: 300.0)
- `num_workers` (int): Number of parallel worker threads (default: 4)
- `log_search_progress` (bool): Enable solver progress logging (default: True)

### LoggingConfig

Configuration for logging.

**Attributes:**
- `level` (str): Logging verbosity level (default: "INFO")
- `log_to_file` (bool): Enable file logging (default: True)
- `log_to_console` (bool): Enable console logging (default: True)
- `log_dir` (str): Log file directory (default: "logs")
- `log_file` (str): Log filename (default: "planner.log")

### InputConfig

Configuration for input data.

**Attributes:**
- `input_folder` (str): Default input data folder path
- `output_folder` (str): Default output folder path
- `required_files` (list): List of required input filenames

### ValidationConfig

Configuration for data validation.

**Attributes:**
- `strict_validation` (bool): Enable strict validation mode (default: True)
- `validate_referential_integrity` (bool): Check foreign key relationships (default: True)

## Reports

### generate_schedule_csv()

```python
def generate_schedule_csv(test_schedules: List[TestSchedule],
                         output_file: str, project_start_date: date) -> None
```

Generate detailed test schedule CSV report.

**Parameters:**
- `test_schedules` (List[TestSchedule]): List of test scheduling results
- `output_file` (str): Output CSV file path
- `project_start_date` (date): Project start date for date calculations

### generate_resource_utilization_csv()

```python
def generate_resource_utilization_csv(resource_utilization: Dict[str, float],
                                    output_file: str) -> None
```

Generate resource utilization statistics CSV report.

**Parameters:**
- `resource_utilization` (Dict[str, float]): Resource utilization percentages
- `output_file` (str): Output CSV file path

### generate_fte_usage_csv()

```python
def generate_fte_usage_csv(test_schedules: List[TestSchedule],
                          project_start_date: date, output_file: str,
                          time_horizon_days: int) -> None
```

Generate FTE usage timeseries CSV report.

**Parameters:**
- `test_schedules` (List[TestSchedule]): Test scheduling results
- `project_start_date` (date): Project start date
- `output_file` (str): Output CSV file path
- `time_horizon_days` (int): Total project duration in days

### generate_equipment_usage_csv()

```python
def generate_equipment_usage_csv(test_schedules: List[TestSchedule],
                                project_start_date: date, output_file: str,
                                time_horizon_days: int) -> None
```

Generate equipment usage timeseries CSV report.

**Parameters:**
- `test_schedules` (List[TestSchedule]): Test scheduling results
- `project_start_date` (date): Project start date
- `output_file` (str): Output CSV file path
- `time_horizon_days` (int): Total project duration in days

### generate_concurrency_timeseries_csv()

```python
def generate_concurrency_timeseries_csv(test_schedules: List[TestSchedule],
                                       project_start_date: date, output_file: str,
                                       time_horizon_days: int) -> None
```

Generate test concurrency timeseries CSV report.

**Parameters:**
- `test_schedules` (List[TestSchedule]): Test scheduling results
- `project_start_date` (date): Project start date
- `output_file` (str): Output CSV file path
- `time_horizon_days` (int): Total project duration in days

## Utilities

### load_data()

```python
def load_data(input_folder: str) -> PlanningData
```

Load and validate all input data from the specified folder.

**Parameters:**
- `input_folder` (str): Path to folder containing CSV files and config

**Returns:**
- `PlanningData`: Unified data container with all loaded data

**Raises:**
- `FileNotFoundError`: When required input files are missing
- `ValueError`: When data validation fails
- `KeyError`: When required columns are missing from CSV files

### build_model()

```python
def build_model(data: PlanningData) -> ScheduleModel
```

Build the complete CP-SAT optimization model from planning data.

**Parameters:**
- `data` (PlanningData): Complete planning data container

**Returns:**
- `ScheduleModel`: Fully constructed model with variables and constraints

### solve_model()

```python
def solve_model(model: ScheduleModel, data: PlanningData,
                time_limit_seconds: float = None) -> SolutionResult
```

Execute the CP-SAT optimization and return solution results.

**Parameters:**
- `model` (ScheduleModel): Complete CP-SAT model
- `data` (PlanningData): Original planning data
- `time_limit_seconds` (float, optional): Maximum solving time

**Returns:**
- `SolutionResult`: Comprehensive solution container

## Error Handling

The Test Planner V4 uses standard Python exception handling:

- **FileNotFoundError**: Missing input files or directories
- **ValueError**: Invalid data formats or constraint violations
- **KeyError**: Missing required data fields or keys
- **RuntimeError**: Solver failures or internal errors
- **json.JSONDecodeError**: Malformed configuration files

## Type Hints

All functions and methods include comprehensive type hints for better IDE support and documentation. The library uses the following main types:

- `PlanningData`: Central data container
- `ScheduleModel`: CP-SAT model container
- `SolutionResult`: Optimization results
- `TestSchedule`: Individual test results
- `Leg`: Project leg definition
- `Test`: Test specification
- `ResourceWindow`: Resource availability

## Examples

### Basic Usage

```python
from planner_v4 import main

# Run complete planning process
solution = main(input_folder="input_data/gen3_pv/senario_1")

# Check results
if solution['status'] in ['OPTIMAL', 'FEASIBLE']:
    print(f"Project duration: {solution['makespan']} days")
    print(f"Tests scheduled: {len(solution['test_schedule'])}")
```

### Advanced Usage

```python
from planner_v4.data_loader import load_data
from planner_v4.model_builder import build_model
from planner_v4.solver import solve_model

# Step-by-step execution
data = load_data("input_data/gen3_pv/senario_1")
model = build_model(data)
solution = solve_model(model, data, time_limit_seconds=600.0)

# Access detailed results
for test in solution.test_schedule:
    print(f"{test.test_name}: {test.start_date} - {test.end_date}")
```

### Custom Configuration

```python
from planner_v4.config import SolverConfig, LoggingConfig

# Custom solver settings
solver_config = SolverConfig(
    time_limit_seconds=900.0,
    num_workers=8,
    log_search_progress=True
)

# Custom logging
logging_config = LoggingConfig(
    level="DEBUG",
    log_to_file=True,
    log_file="custom_planner.log"
)
```
