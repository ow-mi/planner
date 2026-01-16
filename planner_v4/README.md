# Test Planner V4

A constraint-based test scheduling optimizer for project management and resource allocation. This package provides a complete solution for optimizing test scheduling with resource constraints, leg dependencies, and priority management.

## Overview

Test Planner V4 uses Google OR-Tools' CP-SAT solver to find optimal test schedules that minimize project makespan while respecting resource constraints, leg dependencies, and priority requirements. It's designed for complex testing environments where multiple projects, legs, and resources need to be coordinated efficiently.

### Key Features

- **Constraint-based optimization**: Uses advanced constraint programming to find optimal schedules
- **Resource management**: Handles FTE (Full-Time Equivalent) and equipment constraints
- **Leg dependencies**: Respects project leg sequencing and dependencies
- **Priority-based scheduling**: Supports test prioritization and deadline management
- **Test proximity constraints**: Forces pattern-matched tests to run within specified time windows of their immediately preceding tests
- **Flexible configuration**: Environment-specific configuration with validation
- **Comprehensive reporting**: Generates detailed CSV reports and visualizations
- **Data validation**: Robust input data validation and error handling

## Installation

### Requirements

- Python 3.8 or higher
- Google OR-Tools
- Pandas
- Matplotlib

### Install Dependencies

```bash
pip install -r requirements.txt
```

### Install from Source

```bash
git clone <repository-url>
cd planner_v4
pip install -e .
```

## Quick Start

### Basic Usage

```python
from planner_v4 import main

# Run with default configuration
main(input_folder="input_data/gen3_pv/senario_1")
```

### Command Line Interface

```bash
# Basic usage
python -m planner_v4.main --input-folder input_data/gen3_pv/senario_1

# With custom configuration
python -m planner_v4.main --input-folder input_data/gen3_pv/senario_1 --debug-level DEBUG --output-folder custom_output

# Show help
python -m planner_v4.main --help
```

### Configuration

Create a custom configuration file:

```python
from planner_v4.config.settings import Config

config = Config(
    solver=SolverConfig(time_limit_seconds=600),
    logging=LoggingConfig(level="DEBUG"),
    input=InputConfig(input_folder="my_data", output_folder="my_results")
)

main(config=config)
```

## Input Data Format

### Required Files

1. **data_legs.csv**: Project legs and their properties
2. **data_test.csv**: Individual tests with requirements
3. **data_fte.csv**: FTE availability and constraints
4. **data_equipment.csv**: Equipment availability and constraints
5. **data_test_duts.csv**: Device under test information
6. **priority_config.json**: Priority and deadline configuration

### Example Structure

#### data_legs.csv
```csv
project_id,project_name,project_leg_id,leg_number,leg_name,priority,start_iso_week,start_monday
PROJ1,Project Alpha,PROJ1_LEG1,1,Initial Testing,1,2024-W01,2024-01-01
PROJ1,Project Alpha,PROJ1_LEG2,2,Integration Testing,2,2024-W05,2024-01-29
```

#### data_test.csv
```csv
test_id,project_leg_id,sequence_index,test_name,test_description,duration_days,fte_required,equipment_required,fte_assigned,equipment_assigned
TEST001,PROJ1_LEG1,1,Unit Tests,Basic unit testing,5,2,1,team_a,test_bench_1
TEST002,PROJ1_LEG1,2,System Tests,System integration tests,3,3,2,team_a,test_bench_2
```

## Architecture

### Core Components

- **Data Loader**: Loads and validates input data
- **Model Builder**: Constructs the CP-SAT optimization model
- **Solver**: Solves the optimization problem
- **Reporter**: Generates reports and visualizations
- **Config**: Manages configuration settings

### Data Flow

1. **Input Loading**: Load CSV files and JSON configuration
2. **Validation**: Validate data integrity and constraints
3. **Model Building**: Create CP-SAT model with constraints
4. **Optimization**: Solve the scheduling problem
5. **Reporting**: Generate output files and reports

## Configuration

### Environment Variables

- `PLANNER_ENV`: Environment (development, staging, production)
- `PLANNER_LOG_LEVEL`: Logging level (DEBUG, INFO, WARNING, ERROR)
- `PLANNER_INPUT_FOLDER`: Default input folder path
- `PLANNER_OUTPUT_FOLDER`: Default output folder path

### Configuration Options

#### Solver Configuration
- `time_limit_seconds`: Maximum solving time (default: 300)
- `num_workers`: Number of solver workers (default: 4)
- `log_search_progress`: Enable solver progress logging (default: True)

#### Logging Configuration
- `level`: Logging level (default: INFO)
- `log_to_file`: Write logs to file (default: True)
- `log_to_console`: Write logs to console (default: True)
- `log_dir`: Log directory (default: logs)
- `log_file`: Log filename (default: planner.log)

#### Test Proximity Configuration
- `test_proximity_rules`: Configuration for pattern-based test proximity constraints
  - `patterns`: Array of strings to match in test names/IDs/descriptions
  - `max_gap_days`: Maximum allowed gap between a pattern-matched test and its immediately preceding test in the sequence
  - `proximity_penalty_per_day`: Penalty cost per day that violates the max_gap constraint (penalty for being too far apart)
  - `enforce_sequence_order`: Whether to enforce proximity within leg sequences

Example proximity configuration:
```json
{
  "mode": "leg_end_dates",
  "test_proximity_rules": {
    "patterns": ["p-02", "p-03"],
    "max_gap_days": 30,
    "proximity_penalty_per_day": 50.0,
    "enforce_sequence_order": true
  }
}
```

## Output

### Generated Files

1. **tests_schedule.csv**: Detailed test schedule with assignments
2. **resource_utilization.csv**: Resource utilization statistics
3. **project_summary.csv**: Project-level summary statistics
4. **priority_analysis.csv**: Priority-based analysis
5. **solver_statistics.json**: Solver performance metrics

### Report Structure

#### tests_schedule.csv
```csv
test_id,project_leg_id,test_name,start_date,start_time,end_date,end_time,duration_days,assigned_fte,assigned_equipment
TEST001,PROJ1_LEG1,Unit Tests,2024-01-01,09:00:00,2024-01-05,17:00:00,5,team_a,test_bench_1
```

## Advanced Usage

### Custom Constraints

```python
from planner_v4.model_builder import ScheduleModel
from planner_v4.solver import solve_schedule

# Build custom model
model = ScheduleModel()
# Add custom constraints...
solution = solve_schedule(model, data)
```

### Custom Reporting

```python
from planner_v4.reports.csv_reports import generate_schedule_csv

# Generate custom reports
generate_schedule_csv(solution, "my_output_folder")
```

## Troubleshooting

### Common Issues

1. **Solver timeout**: Increase `time_limit_seconds` in solver configuration
2. **Infeasible solution**: Check resource constraints and availability
3. **Data validation errors**: Verify input data format and completeness
4. **Memory issues**: Reduce problem size or increase system memory

### Debug Mode

Enable debug logging:

```python
from planner_v4.config.settings import Config, LoggingConfig

config = Config(
    logging=LoggingConfig(level="DEBUG", log_to_console=True)
)
main(config=config)
```

## Performance Tuning

### Optimization Tips

1. **Reduce problem size**: Split large projects into smaller chunks
2. **Adjust solver parameters**: Tune `time_limit_seconds` and `num_workers`
3. **Simplify constraints**: Remove unnecessary constraints
4. **Use appropriate data types**: Ensure consistent data types in input files

### Monitoring

Monitor solver progress:

```python
# Enable solver progress logging
config = Config(
    solver=SolverConfig(log_search_progress=True),
    logging=LoggingConfig(level="INFO")
)
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on contributing to this project.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting guide
- Review the API documentation

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and changes.
