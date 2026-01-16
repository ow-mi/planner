# Configuration Guide

This guide explains how to configure the Test Planner V4 for different environments and use cases.

## Configuration Overview

The Test Planner V4 uses a unified configuration system with environment-specific settings. Configuration is managed through Python dataclasses that provide type safety and validation.

## Configuration Classes

### SolverConfig

Controls the CP-SAT solver behavior and performance settings.

**Attributes:**
- `time_limit_seconds` (float): Maximum time spent solving (default: 300.0)
- `num_workers` (int): Number of parallel solver threads (default: 4)
- `log_search_progress` (bool): Enable detailed solver logging (default: True)

**Example:**
```python
from planner_v4.config import SolverConfig

config = SolverConfig(
    time_limit_seconds=600.0,  # 10 minutes
    num_workers=8,            # Use 8 CPU cores
    log_search_progress=True  # Enable progress logging
)
```

### LoggingConfig

Controls logging behavior and output destinations.

**Attributes:**
- `level` (str): Logging verbosity level (default: "INFO")
- `log_to_file` (bool): Enable file logging (default: True)
- `log_to_console` (bool): Enable console logging (default: True)
- `log_dir` (str): Directory for log files (default: "logs")
- `log_file` (str): Base log filename (default: "planner.log")

**Valid Log Levels:**
- `"DEBUG"`: Detailed diagnostic information
- `"INFO"`: General information about execution
- `"WARNING"`: Warning messages for potential issues
- `"ERROR"`: Error messages for failures
- `"CRITICAL"`: Critical errors that may cause termination

**Example:**
```python
from planner_v4.config import LoggingConfig

config = LoggingConfig(
    level="DEBUG",
    log_to_file=True,
    log_to_console=True,
    log_dir="my_logs",
    log_file="planning_session.log"
)
```

### InputConfig

Defines input data locations and required files.

**Attributes:**
- `input_folder` (str): Default input data folder
- `output_folder` (str): Default output folder
- `required_files` (list): List of mandatory input filenames

**Required Files:**
- `"data_legs.csv"`: Project leg definitions
- `"data_test.csv"`: Individual test specifications
- `"data_fte.csv"`: FTE resource availability
- `"data_equipment.csv"`: Equipment resource availability
- `"data_test_duts.csv"`: Test-to-DUT mappings
- `"priority_config.json"`: Priority rule configuration

### ValidationConfig

Controls data validation behavior and strictness.

**Attributes:**
- `strict_validation` (bool): Enable strict validation mode (default: True)
- `validate_referential_integrity` (bool): Check foreign key relationships (default: True)

## Environment Configuration

### Development Environment

Recommended settings for development and debugging:

```python
# config/settings.py - Development settings
SOLVER_CONFIG = SolverConfig(
    time_limit_seconds=60.0,  # Shorter timeouts for quick iteration
    num_workers=2,            # Fewer workers for development machines
    log_search_progress=True  # Enable detailed logging
)

LOGGING_CONFIG = LoggingConfig(
    level="DEBUG",            # Maximum verbosity
    log_to_file=True,
    log_to_console=True,
    log_dir="logs/dev",
    log_file="planner_dev.log"
)

VALIDATION_CONFIG = ValidationConfig(
    strict_validation=True,   # Full validation in development
    validate_referential_integrity=True
)
```

### Production Environment

Optimized settings for production deployment:

```python
# config/settings.py - Production settings
SOLVER_CONFIG = SolverConfig(
    time_limit_seconds=1800.0,  # 30 minutes for complex problems
    num_workers=12,            # Use available CPU cores
    log_search_progress=False  # Reduce log volume
)

LOGGING_CONFIG = LoggingConfig(
    level="INFO",             # Standard verbosity
    log_to_file=True,
    log_to_console=False,     # No console output in production
    log_dir="logs/prod",
    log_file="planner_prod.log"
)

VALIDATION_CONFIG = ValidationConfig(
    strict_validation=True,   # Maintain data integrity
    validate_referential_integrity=True
)
```

## Runtime Configuration

### Command Line Configuration

Override configuration through command line arguments:

```bash
# Basic configuration
python -m planner_v4.main --input-folder data/prod --debug-level INFO

# Advanced solver configuration
python -m planner_v4.main \
    --input-folder data/prod \
    --debug-level WARNING \
    --time-limit 1200 \
    --output-folder results/q4_2024
```

### Programmatic Configuration

Configure through API calls:

```python
from planner_v4 import main

# Configure via parameters
solution = main(
    input_folder="data/production",
    debug_level="WARNING",    # Reduce log verbosity
    time_limit=1200.0,       # 20 minute timeout
    output_folder="results/2024_q4"
)
```

## Priority Configuration

Priority rules are defined in `priority_config.json`:

```json
{
  "rules": [
    {
      "name": "deadline_priority",
      "weight": 0.4,
      "function": "exponential_decay",
      "parameters": {
        "half_life_days": 30
      }
    },
    {
      "name": "base_priority",
      "weight": 0.6,
      "function": "linear",
      "parameters": {
        "multiplier": 1.0
      }
    }
  ],
  "weights": {
    "makespan_weight": 0.3,
    "priority_weight": 0.7
  }
}
```

### Priority Rules

- **deadline_priority**: Exponential decay based on time to deadline
- **base_priority**: Linear scaling of base priority values
- **custom_rules**: User-defined priority functions

### Priority Weights

- `makespan_weight`: Weight for minimizing total project duration
- `priority_weight`: Weight for maximizing priority-weighted completion

## Performance Tuning

### Solver Performance

**For faster solving:**
- Reduce `time_limit_seconds`
- Increase `num_workers` (up to CPU core count)
- Set `log_search_progress=False`

**For better solutions:**
- Increase `time_limit_seconds`
- Use more `num_workers`
- Enable `log_search_progress` for monitoring

### Memory Usage

**For large problems:**
- Reduce logging verbosity
- Use appropriate `time_limit_seconds`
- Consider problem decomposition

**For small problems:**
- Enable full logging and validation
- Use shorter timeouts for quick results

## Troubleshooting

### Common Configuration Issues

**Solver timeout:**
```
Solution: Increase time_limit_seconds or simplify constraints
```

**Memory errors:**
```
Solution: Reduce problem size or increase system memory
```

**Invalid configuration:**
```
Solution: Validate configuration values against documentation
```

### Validation Configuration

**Strict validation (recommended for production):**
```python
VALIDATION_CONFIG = ValidationConfig(
    strict_validation=True,
    validate_referential_integrity=True
)
```

**Relaxed validation (for debugging):**
```python
VALIDATION_CONFIG = ValidationConfig(
    strict_validation=False,
    validate_referential_integrity=False
)
```

## Configuration Files

### settings.py

Main configuration file containing all default settings:

```python
# planner_v4/config/settings.py
from .config import *

# Default configurations
SOLVER_CONFIG = SolverConfig(...)
LOGGING_CONFIG = LoggingConfig(...)
INPUT_CONFIG = InputConfig(...)
VALIDATION_CONFIG = ValidationConfig(...)

# Environment overrides
if os.getenv("ENVIRONMENT") == "production":
    SOLVER_CONFIG.time_limit_seconds = 1800.0
    LOGGING_CONFIG.level = "WARNING"
```

### Environment Variables

Supported environment variables:

- `PLANNER_ENVIRONMENT`: Set environment (development/production)
- `PLANNER_LOG_LEVEL`: Override default log level
- `PLANNER_TIME_LIMIT`: Override default solver time limit

**Example:**
```bash
export PLANNER_ENVIRONMENT=production
export PLANNER_LOG_LEVEL=ERROR
export PLANNER_TIME_LIMIT=3600
python -m planner_v4.main --input-folder data/prod
```

## Best Practices

### Configuration Management

1. **Separate environments**: Use different configurations for dev/prod
2. **Version control**: Keep configuration files under version control
3. **Documentation**: Document custom configuration changes
4. **Validation**: Always validate configuration before deployment

### Performance Optimization

1. **Profile first**: Measure performance before optimizing
2. **Start conservative**: Use moderate settings initially
3. **Scale gradually**: Increase resources based on needs
4. **Monitor logs**: Use logs to identify bottlenecks

### Error Handling

1. **Graceful degradation**: Handle configuration errors gracefully
2. **Fallback values**: Provide sensible defaults
3. **Clear messages**: Give clear error messages for configuration issues
4. **Logging**: Log configuration decisions and overrides
