# Input Data Format Specification

This document specifies the required format and structure for all input data files used by Test Planner V4.

## Overview

Test Planner V4 requires six input files in CSV and JSON formats. All files must be placed in the same input directory and follow the exact column specifications below.

## Required Files

1. **data_legs.csv** - Project leg definitions
2. **data_test.csv** - Individual test specifications
3. **data_fte.csv** - FTE resource availability windows
4. **data_equipment.csv** - Equipment resource availability windows
5. **data_test_duts.csv** - Test-to-device-under-test mappings
6. **priority_config.json** - Priority rule configuration

## File Specifications

### data_legs.csv

Defines project legs with scheduling constraints and priorities.

**Required Columns:**
- `project_id` (string): Unique identifier for the parent project
- `project_name` (string): Human-readable project name
- `project_leg_id` (string): Unique identifier for this leg (primary key)
- `leg_number` (string): Leg sequence number (supports '1', '2a', '2b', etc.)
- `leg_name` (string): Human-readable leg description
- `priority` (integer): Priority level (higher numbers = higher priority, 1-10)
- `start_iso_week` (string): ISO week string (YYYY-WW) for planned start

**Example:**
```csv
project_id,project_name,project_leg_id,leg_number,leg_name,priority,start_iso_week
PROJ_001,Solar Panel Testing,LEG_001_1,1,Initial Testing Phase,8,2024-01
PROJ_001,Solar Panel Testing,LEG_001_2,2,Performance Validation,6,2024-08
PROJ_002,Wind Turbine Testing,LEG_002_1,1,Component Testing,7,2024-03
```

**Validation Rules:**
- `project_leg_id` must be unique across all legs
- `priority` must be between 1 and 10
- `start_iso_week` must be valid ISO week format (YYYY-WW)
- `leg_number` supports alphanumeric sequences for parallel legs

### data_test.csv

Defines individual tests with resource requirements and constraints.

**Required Columns:**
- `test_id` (string): Unique identifier for this test (primary key)
- `project_leg_id` (string): Reference to parent leg (foreign key to data_legs.csv)
- `sequence_index` (integer): Execution order within the leg (1-based)
- `test_name` (string): Human-readable test name
- `test_description` (string): Detailed test description
- `duration_days` (float): Estimated duration in working days
- `fte_required` (integer): Number of FTE resources required simultaneously
- `equipment_required` (integer): Number of equipment resources required simultaneously
- `fte_assigned` (string): Specific FTE assignment or type requirement
- `equipment_assigned` (string): Specific equipment assignment or type requirement
- `force_start_week_iso` (string, optional): Forced start week (YYYY-WW format)

**Example:**
```csv
test_id,project_leg_id,sequence_index,test_name,test_description,duration_days,fte_required,equipment_required,fte_assigned,equipment_assigned,force_start_week_iso
TEST_001,LEG_001_1,1,Power Output Test,Measure maximum power output under standard conditions,2.5,2,1,fte_sofia,EQUIP_SOLAR_001,
TEST_002,LEG_001_1,2,Efficiency Test,Calculate conversion efficiency across operating range,1.0,1,1,fte_sofia,EQUIP_SOLAR_001,
TEST_003,LEG_001_2,1,Temperature Test,Test performance under extreme temperatures,3.0,1,2,fte_hengelo,EQUIP_CHAMBER_001,2024-10
```

**Validation Rules:**
- `test_id` must be unique across all tests
- `project_leg_id` must exist in data_legs.csv
- `sequence_index` must be consecutive within each leg (1, 2, 3, ...)
- `duration_days` must be positive
- `fte_required` and `equipment_required` must be non-negative integers
- Resource assignments can be specific IDs or general types

### data_fte.csv

Defines FTE (Full-Time Equivalent) resource availability windows.

**Required Columns:**
- `resource_id` (string): Unique identifier for the FTE resource
- `start_iso_week` (string): ISO week when availability starts (YYYY-WW)
- `end_iso_week` (string): ISO week when availability ends (YYYY-WW)

**Example:**
```csv
resource_id,start_iso_week,end_iso_week
fte_sofia,2024-01,2024-26
fte_hengelo,2024-01,2024-52
fte_amsterdam,2024-15,2024-38
```

**Validation Rules:**
- `resource_id` must be unique
- `start_iso_week` must be before or equal to `end_iso_week`
- ISO week format must be valid (YYYY-WW)
- Resources can have multiple availability windows

**Notes:**
- Multiple rows can exist for the same `resource_id` to define complex availability patterns
- End date is calculated as the Monday of the week following `end_iso_week`

### data_equipment.csv

Defines equipment resource availability windows.

**Required Columns:**
- `resource_id` (string): Unique identifier for the equipment resource
- `start_iso_week` (string): ISO week when availability starts (YYYY-WW)
- `end_iso_week` (string): ISO week when availability ends (YYYY-WW)

**Example:**
```csv
resource_id,start_iso_week,end_iso_week
EQUIP_SOLAR_001,2024-01,2024-52
EQUIP_CHAMBER_001,2024-01,2024-26
EQUIP_WIND_001,2024-10,2024-35
EQUIP_TEST_RIG_001,2024-01,2024-52
```

**Validation Rules:**
- Same as data_fte.csv
- Equipment can be shared across multiple tests when assigned with "*" in test specifications

### data_test_duts.csv

Maps tests to devices under test (DUTs) for resource conflict resolution.

**Required Columns:**
- `test_id` (string): Reference to test (foreign key to data_test.csv)
- `dut_id` (integer): Device under test identifier

**Example:**
```csv
test_id,dut_id
TEST_001,1
TEST_002,1
TEST_003,2
TEST_004,2
TEST_005,3
```

**Validation Rules:**
- `test_id` must exist in data_test.csv
- Multiple tests can share the same DUT (sequential testing)
- DUT IDs are used for resource conflict detection

**Notes:**
- Tests with the same DUT cannot run simultaneously
- DUT mapping helps prevent resource conflicts in shared test environments

### priority_config.json

Defines priority rules and objective function weights.

**Structure:**
```json
{
  "rules": [
    {
      "name": "rule_name",
      "weight": 0.0,
      "function": "function_name",
      "parameters": {
        "param1": "value1",
        "param2": "value2"
      }
    }
  ],
  "weights": {
    "makespan_weight": 0.0,
    "priority_weight": 0.0
  }
}
```

**Example:**
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

**Priority Functions:**
- `"exponential_decay"`: Exponential decay from deadline (parameters: half_life_days)
- `"linear"`: Linear scaling of base priority (parameters: multiplier)

**Weights:**
- `makespan_weight` + `priority_weight` must equal 1.0
- Higher `makespan_weight` prioritizes shorter project duration
- Higher `priority_weight` prioritizes high-priority tests

## Data Relationships

### Foreign Key Constraints

1. **data_test.csv.project_leg_id** → **data_legs.csv.project_leg_id**
2. **data_test_duts.csv.test_id** → **data_test.csv.test_id**

### Sequence Constraints

- Tests within the same leg must follow sequence_index order
- Tests with the same DUT cannot run simultaneously

### Resource Constraints

- FTE assignments must match available resources in data_fte.csv
- Equipment assignments must match available resources in data_equipment.csv
- Resource requirements must be satisfied by available capacity

## File Encoding and Format

### CSV Format Requirements

- **Encoding**: UTF-8
- **Delimiter**: Comma (`,`)
- **Quote Character**: Double quote (`"`)
- **Escape Character**: Double quote (`"`)
- **Header Row**: Required with exact column names
- **Empty Cells**: Treated as empty strings or null values

### JSON Format Requirements

- **Encoding**: UTF-8
- **Format**: Valid JSON
- **Structure**: Must match expected schema
- **Numeric Precision**: Use floats for weights and parameters

## Validation and Error Handling

### Automatic Validation

The system performs comprehensive validation:

1. **File Presence**: Checks all required files exist
2. **Column Presence**: Verifies required columns exist
3. **Data Types**: Validates data type consistency
4. **Referential Integrity**: Checks foreign key relationships
5. **Business Rules**: Validates business logic constraints
6. **Date Formats**: Validates ISO week formats

### Common Validation Errors

**Missing Files:**
```
FileNotFoundError: Required file not found: data_legs.csv
```

**Missing Columns:**
```
KeyError: Required column 'project_leg_id' not found in data_legs.csv
```

**Invalid References:**
```
ValueError: test_id 'TEST_999' in data_test_duts.csv not found in data_test.csv
```

**Invalid Dates:**
```
ValueError: Invalid ISO week format: '2024-1' (must be YYYY-WW)
```

## Best Practices

### Data Preparation

1. **Use consistent IDs**: Maintain consistent naming conventions
2. **Validate manually**: Check data before running planner
3. **Use templates**: Start from example data structures
4. **Document assumptions**: Record any data preparation steps

### File Organization

1. **Directory structure**: Keep all files in same directory
2. **Backup files**: Maintain backups of input data
3. **Version control**: Track changes to input files
4. **Naming conventions**: Use descriptive, consistent filenames

### Data Quality

1. **Complete data**: Fill all required fields
2. **Consistent units**: Use consistent time units (days)
3. **Realistic estimates**: Provide accurate duration estimates
4. **Regular updates**: Keep resource availability current

## Example Dataset

### Directory Structure
```
input_data/
├── data_legs.csv
├── data_test.csv
├── data_fte.csv
├── data_equipment.csv
├── data_test_duts.csv
└── priority_config.json
```

### Complete Example

See the example datasets in `input_data/` directories for complete working examples.

## Migration from Previous Versions

### V3 to V4 Changes

- **data_legs.csv**: Added `leg_number` as string (was integer)
- **data_test.csv**: Added `force_start_week_iso` column
- **priority_config.json**: New structure with rules array
- **Resource files**: End dates now calculated as week-after-end

### Compatibility Notes

- V4 maintains backward compatibility where possible
- Some field types changed for better data handling
- Priority configuration format completely revised
- Validation rules more strict in V4

## Troubleshooting

### Common Issues

**CSV parsing errors:**
- Check for special characters in text fields
- Ensure consistent quote usage
- Validate CSV format with external tools

**Date format errors:**
- Use YYYY-WW format (e.g., "2024-01" not "2024-1")
- Ensure weeks exist (not "2024-53")

**Reference errors:**
- Verify all foreign keys exist
- Check for typos in ID fields
- Ensure consistent case usage

**Validation failures:**
- Run with debug logging to see detailed errors
- Validate data incrementally
- Use smaller test datasets for debugging
