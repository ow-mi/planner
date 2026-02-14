# Test Planner V3 - Data Processing Overview

## Overview

The Test Planner V3 is a constraint-based scheduling system that optimizes test execution across multiple project legs, considering resource availability, dependencies, and business constraints.

## Data Flow Architecture

```
Input CSV Files → Data Loading → Validation → Model Building → Solving → Report Generation → Output Files
```

## Detailed Processing Flow

### 1. Input Data Loading

**Input Files Required:**
- `data_legs.csv` - Project legs with metadata and start constraints
- `data_test.csv` - Individual tests with resource requirements
- `data_fte.csv` - FTE availability windows
- `data_equipment.csv` - Equipment availability windows  
- `data_test_duts.csv` - Test-to-DUT mappings
- `priority_config.json` - Priority weighting configuration

**Data Loading Process:**
1. **Leg Loading** (`load_legs()`): Loads project legs with validation of ISO week formats
2. **Test Loading** (`load_tests()`): Loads and renumbers tests within each leg
3. **Resource Loading** (`load_resource_windows()`): Loads FTE and equipment availability
4. **DUT Mapping** (`load_test_duts()`): Maps tests to DUT identifiers
5. **Priority Configuration** (`load_priority_config()`): Loads scheduling priorities
6. **Dependency Detection** (`detect_leg_dependencies()`): Auto-detects leg dependencies

**Validation Performed:**
- File existence checks
- Data format validation (ISO weeks, numeric fields)
- Referential integrity (tests reference valid legs)
- Sequence continuity within legs
- Resource assignment validity

### 2. Data Validation & Preprocessing

**Validation Steps:**
1. **Schema Validation**: Ensures all required columns exist with correct types
2. **Business Rule Validation**: Checks logical consistency of data
3. **Cross-Reference Validation**: Ensures all foreign key relationships are valid
4. **Temporal Validation**: Validates date ranges and sequences

**Error Handling:**
- Detailed error messages with file/row context
- Graceful degradation with partial data recovery
- Comprehensive logging for debugging

### 3. Model Building

**Model Components:**
1. **Time Horizon Calculation**: Determines scheduling window based on total work
2. **Variable Creation**:
   - Test start/end time variables
   - Resource assignment boolean variables
   - Makespan minimization variable
3. **Constraint Categories**:
   - **Sequencing**: Tests within legs must execute in order
   - **Resource Assignment**: Each test must get required FTE/equipment
   - **Resource Availability**: Resources can only be used when available
   - **Leg Dependencies**: Successor legs wait for predecessor completion
   - **Forced Start Times**: Tests with mandatory start weeks

**Constraint Programming Model:**
- Uses Google OR-Tools CP-SAT solver
- Variables: ~1,000-10,000 depending on problem size
- Constraints: ~5,000-50,000 depending on complexity
- Objective: Minimize project makespan (total duration)

### 4. Solving Process

**Solver Configuration:**
- Time limit: Configurable (default 300 seconds)
- Parallel workers: Configurable (default 4)
- Search logging: Enabled for debugging

**Solution States:**
- **OPTIMAL**: Best possible solution found
- **FEASIBLE**: Good solution found (may not be optimal)
- **INFEASIBLE**: No valid solution exists
- **UNKNOWN**: Solver timed out or failed

**Solution Extraction:**
- Maps solver variables back to real-world schedule
- Calculates resource utilization percentages
- Validates solution against original constraints

### 5. Report Generation

**Output Files Generated:**

**Data Files:**
- `tests_schedule.csv`: Complete test schedule with dates and assignments
- `resource_utilization.csv`: Resource usage percentages
- `validation_report.csv`: Detailed validation of solution correctness
- `fte_usage.csv`: Detailed FTE assignment timeline
- `equipment_usage.csv`: Detailed equipment assignment timeline
- `concurrency_timeseries.csv`: Resource utilization over time

**Visualizations:**
- `gantt_tests.png`: Gantt chart of test schedule
- `resource_fte.png`: FTE utilization bar chart
- `resource_equipment.png`: Equipment utilization bar chart

**Summary Reports:**
- `validation_summary.txt`: High-level solution summary

### 6. Error Handling & Recovery

**Error Categories:**
1. **Input Data Errors**: Missing files, invalid formats, logical inconsistencies
2. **Model Errors**: Infeasible constraints, invalid variable domains
3. **Solver Errors**: Timeout, memory issues, numerical problems
4. **System Errors**: File I/O, resource constraints

**Recovery Strategies:**
- Detailed error messages with context
- Partial solution recovery when possible
- Comprehensive logging for debugging
- Validation reports for manual review

## Usage Examples

### Basic Usage
```python
from planner_v3.main import run_planner

# Run with default settings
solution = run_planner("input_data/my_scenario")

# Run with custom parameters
solution = run_planner(
    input_folder="input_data/my_scenario",
    debug_level="DEBUG",
    time_limit=600,
    output_folder="custom_output"
)
```

### Command Line Usage
```bash
# Basic run
python -m planner_v3.main --input-folder input_data/scenario_1

# With custom settings
python -m planner_v3.main --input-folder input_data/scenario_2 --debug-level DEBUG --time-limit 600
```

## Data Processing Pipeline Details

### Input Data Requirements

**data_legs.csv:**
- project_id: Unique project identifier
- project_name: Human-readable project name
- project_leg_id: Unique leg identifier (format: project_legNumber)
- leg_number: Leg identifier within project
- leg_name: Human-readable leg description
- priority: Scheduling priority (higher = more important)
- start_iso_week: ISO week when leg can start (YYYY-W## format)

**data_test.csv:**
- test_id: Unique test identifier
- project_leg_id: Reference to parent leg
- sequence_index: Order within leg (1, 2, 3...)
- test: Test name/description
- test_description: Detailed test description
- duration_days: Test duration in days (can be fractional)
- fte_required: Number of FTE needed
- equipment_required: Number of equipment units needed
- fte_assigned: FTE assignment pattern (specific ID, type pattern, or "*")
- equipment_assigned: Equipment assignment pattern
- force_start_week_iso: Mandatory start week (optional)

**data_fte.csv & data_equipment.csv:**
- fte_id/equipment_id: Unique resource identifier
- available_start_week_iso: First available week
- available_end_week_iso: Last available week

### Processing Stages

1. **Preprocessing**: Load and validate all input data
2. **Model Creation**: Build constraint programming model
3. **Optimization**: Find optimal schedule using CP-SAT solver
4. **Post-processing**: Extract and validate solution
5. **Reporting**: Generate all output files and visualizations

## Performance Considerations

**Typical Performance:**
- Small scenarios (10-50 tests): 1-10 seconds
- Medium scenarios (50-200 tests): 10-60 seconds  
- Large scenarios (200+ tests): 1-5 minutes

**Memory Usage:**
- Linear growth with problem size
- Typical usage: 100MB-1GB depending on scenario complexity

**Scalability Limits:**
- Tested up to 500 tests with good performance
- Solver time increases exponentially with constraints
- Memory usage grows with time horizon and resource count