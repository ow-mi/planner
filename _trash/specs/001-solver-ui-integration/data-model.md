# Data Model: Solver UI Integration

**Date**: 2024-12-19  
**Feature**: Solver UI Integration

## Entities

### SolverExecution

Represents a single solver execution request and its lifecycle.

**Fields**:
- `execution_id` (string, UUID): Unique identifier for the execution
- `status` (enum): Current execution status
  - Values: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `TIMEOUT`
- `created_at` (datetime): Timestamp when execution was created
- `started_at` (datetime, optional): Timestamp when execution started
- `completed_at` (datetime, optional): Timestamp when execution completed
- `progress_percentage` (integer, 0-100): Current progress percentage
- `elapsed_time_seconds` (float): Elapsed time since start
- `current_phase` (string, optional): Current execution phase (e.g., "Loading data", "Building model", "Solving")
- `error` (ErrorDetails, optional): Error information if execution failed
- `results` (SolverResults, optional): Execution results if completed

**State Transitions**:
1. `PENDING` → `RUNNING`: Execution starts processing
2. `RUNNING` → `COMPLETED`: Execution succeeds
3. `RUNNING` → `FAILED`: Execution fails with error
4. `RUNNING` → `TIMEOUT`: Execution exceeds time limit
5. `PENDING` → `FAILED`: Validation fails before execution starts

**Validation Rules**:
- `execution_id` must be unique
- `progress_percentage` must be between 0 and 100
- `elapsed_time_seconds` must be non-negative
- `status` transitions must follow valid state machine

### SolverRequest

Input data for solver execution request.

**Fields**:
- `csv_files` (dict): Map of CSV file names to file contents
  - Required keys: `data_legs.csv`, `data_test.csv`, `data_fte.csv`, `data_equipment.csv`, `data_test_duts.csv`
  - Values: CSV file content as strings
- `priority_config` (dict): Priority configuration JSON object
  - Must match priority_config.json schema from planner_v4
- `time_limit` (float, optional): Solver time limit in seconds (default: 500)
- `debug_level` (enum, optional): Logging level
  - Values: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL` (default: `INFO`)
- `output_folder` (string, optional): Output folder path (default: auto-generated)

**Validation Rules**:
- All required CSV files must be present
- CSV files must have valid headers matching expected columns
- `priority_config` must be valid JSON matching schema
- `time_limit` must be positive
- `debug_level` must be valid enum value

### SolverResults

Output data from successful solver execution.

**Fields**:
- `status` (enum): Solution status from solver
  - Values: `OPTIMAL`, `FEASIBLE`, `INFEASIBLE`, `NO_SOLUTION`
- `makespan` (float, optional): Total project duration in days
- `test_schedule` (list): List of scheduled test objects
  - Each object contains: `test_id`, `start_date`, `end_date`, `leg_id`, etc.
- `resource_utilization` (dict, optional): Resource usage statistics
- `output_files` (dict): Map of output file names to file contents
  - Keys: `schedule.csv`, `resource_utilization.csv`, `fte_usage.csv`, `equipment_usage.csv`, `concurrency_timeseries.csv`, `logs.txt`
  - Values: File content as strings or Base64-encoded strings
- `solver_stats` (dict, optional): Solver performance statistics
  - Contains: `solve_time`, `objective_value`, `num_variables`, `num_constraints`, etc.

**Validation Rules**:
- `status` must be valid enum value
- `makespan` must be non-negative if present
- `test_schedule` must be list of valid schedule objects
- `output_files` must contain expected file names

### ErrorDetails

Error information for failed executions.

**Fields**:
- `category` (enum): Error category
  - Values: `ValidationError`, `SolverError`, `TimeoutError`, `SystemError`
- `message` (string): Human-readable error message
- `guidance` (string): Actionable guidance for resolving the error
- `error_code` (string): Machine-readable error code
- `details` (dict, optional): Additional error details
  - May contain: `field`, `value`, `expected_format`, `line_number`, etc.

**Validation Rules**:
- `category` must be valid enum value
- `message` must be non-empty
- `guidance` must provide actionable steps

### ExecutionQueue

Queue management for solver executions.

**Fields**:
- `queue` (Queue): Thread-safe queue of pending executions
- `active_execution` (SolverExecution, optional): Currently running execution
- `queue_position` (dict): Map of execution_id to position in queue

**State Management**:
- Only one execution can be active at a time
- New executions are added to queue if active execution exists
- When active execution completes, next execution starts automatically

## Relationships

- **SolverExecution** has one **SolverRequest** (input data)
- **SolverExecution** has zero or one **SolverResults** (output data, if successful)
- **SolverExecution** has zero or one **ErrorDetails** (error information, if failed)
- **ExecutionQueue** manages multiple **SolverExecution** instances

## Data Flow

1. **Request Creation**: UI creates `SolverRequest` with CSV files and config
2. **Validation**: Backend validates `SolverRequest` and creates `SolverExecution` with `PENDING` status
3. **Queue Management**: `ExecutionQueue` adds execution to queue or starts immediately
4. **Execution**: `SolverExecution` transitions to `RUNNING`, progress updates tracked
5. **Completion**: `SolverExecution` transitions to `COMPLETED` with `SolverResults` or `FAILED`/`TIMEOUT` with `ErrorDetails`
6. **Response**: Results or errors returned to UI for display/export

## Constraints

- Maximum queue size: 10 pending executions (prevents unbounded growth)
- Execution timeout: Configurable per request (default 500 seconds)
- Result size limit: 50MB total (prevents memory issues)
- CSV file size limit: 10MB per file (prevents upload issues)





