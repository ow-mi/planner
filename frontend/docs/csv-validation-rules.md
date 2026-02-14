# CSV Validation Rules

## Overview

This document describes the validation rules that the frontend application enforces when users upload or input CSV files. These rules ensure data integrity before the configuration and solver processes can proceed.

## Required CSV Format

### File Requirements

- **File Type**: `.csv` (Comma-Separated Values) or Excel files (`.xlsx`, `.xls`)
- **Encoding**: UTF-8 recommended
- **Header Row**: Must be present in the first row
- **Column Separator**: Comma (`,`) for CSV files
- **Line Endings**: Unix (LF) or Windows (CRLF) accepted

### Required Columns

The CSV file **must** contain exactly these 7 columns in any order:

| Column Name | Data Type | Required | Description |
|-------------|-----------|----------|-------------|
| `project` | String | Yes | Project identifier/name |
| `leg` | String | Yes | Leg identifier within the project |
| `branch` | String | No | Branch variant (can be empty) |
| `test` | String | Yes | Test type/name identifier |
| `duration_days` | Number | Yes | Test duration in days |
| `description` | String | Yes | Human-readable test description |
| `next_leg` | String | No | Next leg(s) in workflow, semicolon-separated for parallel branches |

## Validation Rules

### 1. Header Validation

**Rule**: All 6 required column headers must be present.

**Error Message Format**:
```
Missing required column: {column_name}
```

**Example Errors**:
- `Missing required column: project`
- `Missing required column: duration_days`

### 2. Column Name Validation

**Rule**: Column names must match exactly (case-sensitive).

**Valid Column Names**:
- `project`
- `leg`
- `branch`
- `test`
- `duration_days`
- `description`
- `next_leg`

**Error Message Format**:
```
Invalid column name: '{provided_name}'. Expected: '{expected_name}'
```

### 3. Empty Value Validation (Required Fields)

**Rule**: The following fields cannot be empty, null, or whitespace-only:
- `project`
- `leg`
- `test`
- `duration_days`
- `description`

**Allowed Empty Fields**:
- `branch` - Can be empty (represents no branch)
- `next_leg` - Can be empty (represents end of workflow branch)

**Error Message Format**:
```
Row {row_number}: Empty value in required column '{column_name}'
```

**Example Error**:
- `Row 5: Empty value in required column 'test'`

### 4. Data Type Validation

#### 4.1 duration_days

**Rule**: Must be a positive number (integer or float).

**Valid Values**:
- `5`
- `10.5`
- `0.5`

**Invalid Values**:
- `-5` (negative)
- `0` (zero)
- `abc` (non-numeric)
- Empty string

**Error Message Format**:
```
Row {row_number}: Invalid duration_days '{value}'. Must be a positive number.
```

### 5. Sequence Validation (Implicit)

**Rule**: Within each unique `project` + `leg` + `branch` combination, tests are implicitly sequenced by their row order (top to bottom).

**Computed Fields**:
- `sequence`: Row number within the leg_branch group (1, 2, 3, ...)
- `test_name`: Computed as `{project}__{leg}__{branch}{sequence}__{test}`
  - If branch is empty: `{project}__{leg}__{sequence}__{test}`

**Example Computations**:
| project | leg | branch | test | Computed test_name |
|---------|-----|--------|------|-------------------|
| mwcu | 2 | (empty) | P-01 | mwcu__2__1__P-01 |
| mwcu | 2 | a | K-01 | mwcu__2__a1__K-01 |
| mwcu | 2 | a | K-02 | mwcu__2__a2__K-02 |
| hec | 3 | (empty) | Leak | hec__3__1__Leak |

### 6. Whitespace Handling

**Rule**: Leading and trailing whitespace is trimmed from all string values.

**Example**:
- Input: `"  mwcu  "` → Trimmed: `"mwcu"`
- Input: `"Leak  "` → Trimmed: `"Leak"`

### 7. Duplicate Detection

**Rule**: Duplicate rows (same values in all columns after trimming) are allowed but will generate a warning.

**Warning Message Format**:
```
Row {row_number}: Duplicate of row {original_row_number} detected
```

### 8. Workflow Dependency Validation (next_leg)

**Rule**: The `next_leg` column defines workflow dependencies using leg identifiers. Multiple parallel next legs are separated by semicolons (`;`).

**Valid Formats**:
- Empty or null: No next leg (end of workflow branch)
- Single leg: `"3"` - Proceed to leg 3 after completion
- Multiple legs: `"2a;2b"` - Branch to legs 2a AND 2b (parallel execution)
- Leg within same project only

**Invalid Formats**:
- Non-existent leg references
- Self-references (leg pointing to itself)
- Circular dependencies (A→B→A)
- Cross-project references (project_a leg referencing project_b leg)

**Error Message Formats**:
```
Row {row_number}: Invalid next_leg '{value}'. Leg '{leg_name}' does not exist in project '{project}'.
Row {row_number}: Circular dependency detected: {leg_a} → {leg_b} → {leg_a}
Row {row_number}: Cross-project reference not allowed: '{value}' references different project
```

**Workflow Patterns**:

1. **Simple Sequence**: Leg 1 → Leg 2 → Leg 3
```csv
project,leg,branch,test,duration_days,description,next_leg
product,1,,Setup,1,Setup,2
product,2,,TestA,5,Test A,3
product,3,,Final,3,Final test,
```

2. **Branch (Split Only)**: Leg 2 → Leg 2a AND Leg 2b (parallel)
```csv
project,leg,branch,test,duration_days,description,next_leg
product,2,,P-01,5,Main test 1,
product,2,,P-02,5,Main test 2,
product,2,,P-03,5,Main test 3,2a;2b
product,2a,,K-01,10,Branch A1,
product,2a,,K-02,10,Branch A2,
product,2b,,V-01,8,Branch B1,
product,2b,,V-02,8,Branch B2,
```

3. **Split-Merge**: Leg 2 → Leg 2a AND Leg 2b → Leg 3 (join)
```csv
project,leg,branch,test,duration_days,description,next_leg
product,2,,P-01,5,Main test 1,
product,2,,P-02,5,Main test 2,
product,2,,P-03,5,Main test 3,2a;2b
product,2a,,K-01,10,Branch A1,
product,2a,,K-02,10,Branch A2,
product,2a,,K-03,10,Branch A3,3
product,2b,,V-01,8,Branch B1,
product,2b,,V-02,8,Branch B2,
product,2b,,V-03,8,Branch B3,
product,2b,,V-04,8,Branch B4,
product,2b,,V-05,8,Branch B5,3
product,3,,Final,3,Final merge test,
```

**Dependency Rules**:
1. All rows in a leg with a `next_leg` value must complete before the next leg(s) can start
2. When `next_leg` has multiple values (semicolon-separated), ALL referenced legs can start in parallel once the current leg completes
3. A leg with multiple incoming dependencies (multiple legs point to it) waits for ALL source legs to complete
4. Leg names in `next_leg` refer to the `leg` column value, not the full `project__leg` identifier
5. Branch legs (2a, 2b) should use distinct names to allow independent tracking

## Validation Flow

1. **File Type Check**: Verify file extension is `.csv`, `.xlsx`, or `.xls`
2. **Parse CSV**: Convert file to structured data
3. **Header Validation**: Check all required columns present
4. **Column Name Validation**: Verify exact column names
5. **Row-by-Row Validation**:
   - Check empty values in required fields
   - Validate data types
   - Trim whitespace
   - Compute implicit fields
6. **Duplicate Detection**: Flag duplicate rows
7. **Summary Report**: Display all errors/warnings to user

## Error Aggregation

If multiple validation errors exist, all errors are collected and displayed together rather than stopping at the first error.

**Error Display Format**:
```
Validation Failed - {count} error(s) found:

1. Row 5: Empty value in required column 'test'
2. Row 8: Invalid duration_days 'abc'. Must be a positive number.
3. Row 12: Missing required column: 'project'

Please fix these issues and upload again.
```

## Success Criteria

Validation passes when:
- ✓ All 7 required columns present
- ✓ All column names match exactly
- ✓ No empty values in required fields (project, leg, test, duration_days, description)
- ✓ All duration_days values are positive numbers
- ✓ No critical errors (warnings allowed)

## Post-Validation Actions

After successful validation:
1. Extract unique values for config tab population:
   - Projects list
   - Leg types (unique `leg` values)
   - Test types (unique `test` values)
   - Leg-Branch combinations

2. Store parsed data in application state
3. Enable Configuration tab with extracted data
4. Allow solver execution

## Example Valid CSV

### Simple Example (Sequential Legs)
```csv
project,leg,branch,test,duration_days,description,next_leg
mwcu,2,,P-01,5,Pre-test parameter check,3
mwcu,2,,P-02,5,Mid-test parameter check,
mwcu,3,,Leak,3,Leak test,
hec,2,,Setup,1,Initial setup,3
hec,3,,Final,3,Final test,
```

### Complex Example (Split-Merge Workflow)
```csv
project,leg,branch,test,duration_days,description,next_leg
gen3_pv,1,,Setup,1,Initial calibration,2
gen3_pv,2,,P-01,5,Parameter check 1,
gen3_pv,2,,P-02,5,Parameter check 2,
gen3_pv,2,,P-03,5,Parameter check 3,2a;2b
gen3_pv,2a,,K-01,10,Thermal cycle A1,
gen3_pv,2a,,K-02,10,Thermal cycle A2,
gen3_pv,2a,,K-03,10,Thermal cycle A3,3
gen3_pv,2b,,V-01,8,Vibration test B1,
gen3_pv,2b,,V-02,8,Vibration test B2,
gen3_pv,2b,,V-03,8,Vibration test B3,
gen3_pv,2b,,V-04,8,Vibration test B4,
gen3_pv,2b,,V-05,8,Vibration test B5,3
gen3_pv,3,,Final,3,Final verification,
```

## Example Invalid CSV

```csv
project,leg,branch,test,duration,description
mwcu,2,,P-01,5,Pre-test check
,2,,P-02,5,Mid-test check
mwcu,2,a,K-01,abc,Thermal test
```

**Errors**:
1. Invalid column name: 'duration'. Expected: 'duration_days'
2. Row 2: Empty value in required column 'project'
3. Row 3: Invalid duration_days 'abc'. Must be a positive number.
