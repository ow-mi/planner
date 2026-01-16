# Priority System Configuration

The planning system now supports configurable priority modes. You can choose different optimization objectives by creating or modifying the `priority_config.json` file in the input_data directory.

## Available Priority Modes

### 1. `leg_priority` (Default)
Uses the existing priority values from `data_legs.csv`.
- Lower priority numbers = higher importance
- Weights tests by `(max_priority + 1) - leg.priority`

### 2. `makespan_minimize`
Finish the testing program as quickly as possible.
- Minimizes the total project duration (makespan)
- All legs are completed as early as possible

### 3. `equal_weight`
Treat all legs equally with no priority weighting.
- All tests have equal weight in the objective
- Balances completion times across all legs

### 4. `completion_date`
Prioritize by completion deadlines.
- Specify target completion weeks for specific legs
- Penalizes going beyond deadlines
- Falls back to leg priorities for legs without deadlines

## Configuration File Format

```json
{
  "priority_mode": "makespan_minimize",
  "description": "Optional description of this configuration",
  "completion_deadlines": {
    "leg_id_1": "2025-W20",
    "leg_id_2": "2025-W22"
  }
}
```

## Example Configurations

- `priority_config.json` - Default leg priority system
- `priority_config_makespan.json` - Minimize total duration
- `priority_config_equal.json` - Equal weighting
- `priority_config_deadlines.json` - Deadline-based priorities

## Usage

1. Copy one of the example configuration files to `priority_config.json`
2. Modify the settings as needed
3. Run the planner as usual

The system will automatically load the configuration and use the specified priority mode for optimization.

## Notes

- If no configuration file is found, the system defaults to `leg_priority` mode
- Invalid configurations will show a warning and fall back to leg priority
- Completion deadlines should be in ISO week format (e.g., "2025-W14")
