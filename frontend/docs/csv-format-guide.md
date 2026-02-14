# CSV File Format Guide

## Overview

This guide explains how to create a CSV file for use with the PV Planning Tool. The CSV file describes your test schedule, including projects, legs, tests, and their durations. Configuration details (priorities, resources, dates) are managed separately in the Configuration tab.

## Quick Start

**Minimum Required Format** (7 columns, `next_leg` is optional):
```csv
project,leg,branch,test,duration_days,description,next_leg
MyProject,1,,TestA,5,Description here,
```

**With Workflow Dependencies**:
```csv
project,leg,branch,test,duration_days,description,next_leg
MyProject,1,,TestA,5,First test,2
MyProject,2,,TestB,5,Second test,
```
*Test B waits for Test A to complete (sequential workflow)*

## Column Reference

### 1. project

**Purpose**: Identifies the project or product being tested.

**Type**: Text (string)

**Required**: Yes

**Examples**:
- `mwcu`
- `hec`
- `gen3_pv`

**Rules**:
- Cannot be empty
- Will be trimmed of leading/trailing spaces
- Case-sensitive (`MWCU` ≠ `mwcu`)

**Usage**: Used to group tests by project. Projects can have different configurations in the Configuration tab.

---

### 2. leg

**Purpose**: Identifies a leg (phase/stage) within a project.

**Type**: Text (string)

**Required**: Yes

**Examples**:
- `2` (numeric leg)
- `3`
- `prototyping` (named leg)
- `engineering`
- `production`

**Rules**:
- Cannot be empty
- Will be trimmed of leading/trailing spaces
- Can be numbers or text
- Must be unique within a project context

**Usage**: 
- Tests are organized by leg
- Legs can have specific start/end dates in Configuration
- Multiple projects can have legs with the same name (e.g., both `mwcu` and `hec` can have leg `2`)

---

### 3. branch

**Purpose**: Identifies a variant or sub-group within a leg.

**Type**: Text (string)

**Required**: No (can be empty)

**Examples**:
- (empty) - No branch, main leg
- `a` - Branch A
- `b` - Branch B
- `variant1`

**Rules**:
- Can be empty (represents the main/default branch)
- Will be trimmed of leading/trailing spaces
- Empty and non-empty branches can coexist within the same leg

**Usage**:
- Allows parallel test tracks within the same leg
- Each branch has its own test sequence
- Example: Leg 2 might have main track and branch "a" track running simultaneously

---

### 4. test

**Purpose**: Identifies the type of test being performed.

**Type**: Text (string)

**Required**: Yes

**Examples**:
- `Leak` - Leak test
- `K-01` - Thermal cycle test
- `P-01` - Parameter test
- `Vibration` - Vibration test

**Rules**:
- Cannot be empty
- Will be trimmed of leading/trailing spaces
- Same test name can appear multiple times in different legs/branches

**Usage**:
- Defines test types for configuration overrides
- Used to group similar tests across legs
- Format convention: Use codes like `K-*` for thermal, `P-*` for parameter tests

---

### 5. duration_days

**Purpose**: Specifies how long the test takes to complete.

**Type**: Number (integer or decimal)

**Required**: Yes

**Examples**:
- `5` - 5 days
- `10.5` - 10 and a half days
- `0.5` - Half day
- `3` - 3 days

**Rules**:
- Must be a positive number (> 0)
- Can be whole numbers or decimals
- Cannot be negative
- Cannot be zero
- Cannot be text

**Usage**:
- Used by the solver to calculate test scheduling
- Combined with leg dates to determine test placement
- Partial days supported for precision

---

### 6. description

**Purpose**: Human-readable explanation of what the test does.

**Type**: Text (string)

**Required**: Yes

**Examples**:
- `Pre-test parameter check`
- `Thermal cycle from -40°C to +85°C`
- `Final leak verification`
- `Vibration test XYZ axis`

**Rules**:
- Cannot be empty
- Will be trimmed of leading/trailing spaces
- Any descriptive text is valid

**Usage**:
- Displayed in reports and visualizations
- Helps identify tests in the UI
- Not used by the solver (informational only)

---

### 7. next_leg (Optional)

**Purpose**: Defines workflow dependencies - which leg(s) must complete before this leg can start. Enables branching (parallel execution) and merging (synchronization points).

**Type**: Text (string)

**Required**: No (can be empty)

**Format**: Single leg name or semicolon-separated list (`leg_a;leg_b`)

**Examples**:
- (empty) - No dependencies, can start immediately or continues current workflow
- `3` - Wait for leg 3 to complete before starting this leg
- `2a;2b` - Wait for BOTH leg 2a AND leg 2b to complete (merge point)

**Rules**:
- Can be empty (no dependency)
- Multiple dependencies separated by semicolon (`;`)
- Leg names must exist in the same project
- Circular dependencies are not allowed (e.g., leg 2 → 3 → 2)
- Self-references are not allowed (e.g., leg 2 cannot depend on leg 2)

**Usage**:
- **Sequential workflow**: Leave empty for all rows (default behavior)
- **Branching (Split)**: Put `next_leg` on ONE row in the leg to define where it goes next (e.g., leg 2 → leg 2a AND leg 2b)
- **Merging (Join)**: Put `next_leg` on rows in branches to point to merge leg (e.g., leg 2a → 3 and leg 2b → 3)
- **Important**: Most rows will have empty `next_leg`. Only specify it where workflow branches or merges.

**Workflow Examples**:

*Simple Sequential (No Branching)* - All rows have empty next_leg:
```csv
project,leg,branch,test,duration_days,description,next_leg
mwcu,2,,P-01,5,Test 1,
mwcu,2,,P-02,5,Test 2,
mwcu,3,,K-01,10,Test 3,
```
*Leg 2 tests run, then leg 3 tests run (implicit sequential order).*

*Split Workflow (Leg → Parallel Branches)* - Only ONE row has next_leg:
```csv
project,leg,branch,test,duration_days,description,next_leg
mwcu,2,,P-01,5,Main test,
mwcu,2,,P-02,5,Main test cont,2a;2b    ← Only this row defines the split
mwcu,2a,,K-01,10,Branch A test,
mwcu,2a,,K-02,10,Branch A cont,
mwcu,2b,,V-01,8,Branch B test,
mwcu,2b,,V-02,8,Branch B cont,
```
*After leg 2 completes, both leg 2a AND leg 2b start in parallel.*

*Merge Workflow (Parallel Branches → Merge Point)* - Branch rows point to merge:
```csv
project,leg,branch,test,duration_days,description,next_leg
mwcu,2,,P-01,5,Initial,
mwcu,2,,P-02,5,Initial cont,2a;2b
mwcu,2a,,K-01,10,Branch A test,
mwcu,2a,,K-02,10,Branch A cont,3      ← Points to merge leg
mwcu,2b,,V-01,8,Branch B test,
mwcu,2b,,V-02,8,Branch B cont,3       ← Points to merge leg
mwcu,3,,Final,3,Final test,
```
*Leg 3 starts only after BOTH leg 2a AND leg 2b complete.*

*Complex Workflow (Split → Merge → Continue)*:
```csv
project,leg,branch,test,duration_days,description,next_leg
mwcu,2,,P-01,5,Setup,
mwcu,2,,P-02,5,Setup cont,2a;2b       ← Split to 2a and 2b
mwcu,2a,,K-01,10,Branch A test,
mwcu,2a,,K-02,10,Branch A cont,3      ← Merge to leg 3
mwcu,2b,,V-01,8,Branch B test,
mwcu,2b,,V-02,8,Branch B cont,3       ← Merge to leg 3
mwcu,3,,Merge,3,Merge point,4         ← Continue to leg 4
mwcu,4,,Final,2,Final test,
```

**Key Principle**: `next_leg` only appears where a decision is made:
- **Split**: One row in the parent leg points to multiple children
- **Merge**: Rows in child legs point back to parent
- **Sequential**: Leave ALL rows empty (implicit order)
- **Most rows will be empty!**

---

## Implicit Computed Fields

The system automatically computes these values from your CSV data:

### sequence

**Computed**: Row number within each leg-branch group (1, 2, 3, ...)

**Determined by**: Order of rows in the CSV file (top to bottom)

**Example**:
```csv
project,leg,branch,test,duration_days,description
mwcu,2,,P-01,5,First test      → sequence: 1
mwcu,2,,P-02,5,Second test     → sequence: 2
mwcu,2,,P-03,5,Third test      → sequence: 3
```

### test_name

**Computed**: Unique identifier for each test instance

**Format**: `{project}__{leg}__{branch}{sequence}__{test}`

**Special Case** (empty branch): `{project}__{leg}__{sequence}__{test}`

**Examples**:

| project | leg | branch | test | sequence | Computed test_name |
|---------|-----|--------|------|----------|-------------------|
| mwcu | 2 | (empty) | P-01 | 1 | `mwcu__2__1__P-01` |
| mwcu | 2 | (empty) | P-02 | 2 | `mwcu__2__2__P-02` |
| mwcu | 2 | a | K-01 | 1 | `mwcu__2__a1__K-01` |
| mwcu | 2 | a | K-02 | 2 | `mwcu__2__a2__K-02` |
| hec | 3 | (empty) | Leak | 1 | `hec__3__1__Leak` |

**Usage**:
- Used to reference specific tests in the Configuration tab
- Appears in visualizations and reports
- Must be unique across the entire dataset

---

## Complete Examples

### Example 1: Simple Project with One Leg

```csv
project,leg,branch,test,duration_days,description,next_leg
product_a,1,,Setup,1,Initial setup and calibration,
product_a,1,,Leak,3,Pressure leak test,
product_a,1,,K-01,5,Thermal cycle 1,
product_a,1,,K-02,5,Thermal cycle 2,
product_a,1,,Final,1,Final verification,
```

**Generated test_names**:
- `product_a__1__1__Setup`
- `product_a__1__2__Leak`
- `product_a__1__3__K-01`
- `product_a__1__4__K-02`
- `product_a__1__5__Final`

*Note*: `next_leg` is empty (sequential workflow)

---

### Example 2: Multiple Legs with Branches

This example shows prototyping splitting into two thermal test variants (A and B), then continuing to engineering.

```csv
project,leg,branch,test,duration_days,description,next_leg
project_x,prototyping,,P-01,3,Prototype parameter check,a;b
project_x,prototyping,a,K-01,10,Thermal test variant A,
project_x,prototyping,a,K-02,10,Thermal test variant A part 2,engineering
project_x,prototyping,b,K-01,8,Thermal test variant B,
project_x,prototyping,b,K-02,8,Thermal test variant B part 2,engineering
project_x,engineering,,Leak,2,Engineering leak test,
project_x,engineering,,P-01,5,Engineering parameter check,
```

**Workflow Logic**:
- Leg `prototyping` test `P-01` has `next_leg=a;b` → after P-01 completes, split into branches a and b
- Last tests in branches (`K-02` in both a and b) have `next_leg=engineering` → when both complete, merge to engineering
- Leg `engineering` has no `next_leg` → workflow ends here

**Generated test_names**:
- `project_x__prototyping__1__P-01`
- `project_x__prototyping__a1__K-01`
- `project_x__prototyping__a2__K-02`
- `project_x__prototyping__b1__K-01`
- `project_x__prototyping__b2__K-02`
- `project_x__engineering__1__Leak`
- `project_x__engineering__2__P-01`

**Workflow Execution**:
1. Leg `prototyping` runs P-01 (3 days)
2. After P-01 completes, workflow splits: branches `a` and `b` start in parallel
   - Branch A: K-01 (10 days) → K-02 (10 days) = 20 days total
   - Branch B: K-01 (8 days) → K-02 (8 days) = 16 days total
3. When BOTH branches complete, leg `engineering` starts (merge point)
4. Engineering: Leak (2 days) → P-01 (5 days)

*Note*: `next_leg` appears only on the last test of a leg before a split/merge. Leg names include branch suffix (`prototyping_a`, `prototyping_b`).

---

### Example 3: Multiple Projects

```csv
project,leg,branch,test,duration_days,description,next_leg
mwcu,2,,P-01,5,MWCU leg 2 parameter check,
mwcu,2,,P-02,5,MWCU leg 2 mid-test check,
mwcu,3,,Leak,3,MWCU leg 3 leak test,
hec,2,,K-01,10,HEC leg 2 thermal,
hec,2,,K-02,10,HEC leg 2 thermal part 2,
gen3_pv,prototyping,,Setup,1,Gen3 PV setup,
```

*Note*: Each project is independent. Legs within each project run sequentially by default (no next_leg dependencies across projects).

---

### Example 4: Branching and Merging Workflow

This example shows a complex workflow where leg 2 splits into parallel branches (2a and 2b), which then merge back into leg 3.

```csv
project,leg,branch,test,duration_days,description,next_leg
product,2,,Setup,1,Initial setup,2a;2b
product,2,,P-01,5,Parameter check 1,2a;2b
product,2,,P-02,5,Parameter check 2,2a;2b
product,2a,,K-01,10,Thermal test A1,3
product,2a,,K-02,10,Thermal test A2,3
product,2b,,V-01,8,Vibration test B1,3
product,2b,,V-02,8,Vibration test B2,3
product,2b,,V-03,8,Vibration test B3,3
product,3,,Final,3,Final verification,
```

**Workflow Execution**:
1. **Leg 2** runs first (Setup, P-01, P-02 in sequence)
2. After leg 2 completes, **both leg 2a AND leg 2b start in parallel**:
   - Branch A: K-01 → K-02 (20 days total)
   - Branch B: V-01 → V-02 → V-03 (24 days total)
3. **Leg 3** waits for BOTH 2a AND 2b to complete (merge point)
4. Since branch B takes longer (24 days vs 20 days), leg 3 starts after 24 days
5. Finally, leg 3 runs (3 days)

**Total duration**: 1 + 5 + 5 + max(20, 24) + 3 = 38 days

---

### Example 5: Split Without Merge

Some workflows branch but never merge (independent tracks that complete separately).

```csv
project,leg,branch,test,duration_days,description,next_leg
product,2,,P-01,5,Main test,2a;2b
product,2a,,K-01,10,Track A test 1,
product,2a,,K-02,10,Track A test 2,
product,2b,,V-01,8,Track B test 1,
product,2b,,V-02,8,Track B test 2,
product,2b,,V-03,8,Track B test 3,
```

**Workflow Execution**:
1. **Leg 2** runs (P-01: 5 days)
2. **Both 2a and 2b start in parallel** after leg 2:
   - Track A: 20 days total
   - Track B: 24 days total
3. No merge - workflow ends when longest branch completes

**Total duration**: 5 + max(20, 24) = 29 days

*Note*: Leg 2a and 2b end independently. No final leg waits for them.

---

### Example 6: Multiple Sequential Splits

A workflow with multiple split-merge points.

```csv
project,leg,branch,test,duration_days,description,next_leg
product,1,,Setup,1,Initial setup,2
product,2,,P-01,5,Phase 2 main,2a;2b
product,2a,,K-01,10,Branch A,3
product,2b,,V-01,8,Branch B,3
product,3,,Merge,2,Phase 3 merge,4
product,4,,P-02,5,Phase 4 main,4a;4b
product,4a,,K-02,8,Branch A2,
product,4b,,V-02,6,Branch B2,
```

**Workflow Execution**:
1. Leg 1 → Leg 2 (sequential)
2. Leg 2 → splits into 2a and 2b (parallel)
3. Leg 3 waits for both 2a and 2b (merge)
4. Leg 3 → Leg 4 (sequential)
5. Leg 4 → splits into 4a and 4b (parallel, no merge)

**Total duration**: 1 + 5 + max(10, 8) + 2 + 5 + max(8, 6) = 31 days

---

## Best Practices

### Row Ordering
- Arrange tests in the order they should execute within each leg-branch
- Keep all rows for the same leg together
- Group by project, then leg, then branch for clarity

### Naming Conventions
- Use consistent project names (e.g., always `mwcu`, not `MWCU` in some places)
- Use leg names that make sense (numbers for sequential legs, names for phases)
- Use test codes consistently (e.g., `K-01`, `K-02` for thermal tests)

### Descriptions
- Keep descriptions concise but informative
- Include key parameters (temperatures, pressures, etc.)
- Avoid special characters that might cause CSV parsing issues

### Data Consistency
- Ensure no empty required fields
- Verify duration_days are positive numbers
- Check that branch names are consistent (don't mix `a` and `A` unless intentional)

---

## Common Patterns

### Pattern 1: Sequential Legs (Default)
Use numbered legs (1, 2, 3...) when tests must complete in sequence. Leave `next_leg` empty for default sequential behavior:
```csv
project,leg,branch,test,duration_days,description,next_leg
product,1,,Setup,1,Setup,
product,1,,TestA,5,Test A,
product,2,,TestB,5,Test B,
```
*Leg 2 automatically waits for leg 1 to complete (implicit sequential ordering).*

### Pattern 2: Parallel Branches with Merge
Split into parallel branches then merge back. Use `next_leg` to define the split and merge points:
```csv
project,leg,branch,test,duration_days,description,next_leg
product,2,,Setup,1,Main setup,2a;2b
product,2a,,TestA1,5,Branch A test 1,3
product,2a,,TestA2,5,Branch A test 2,3
product,2b,,TestB1,8,Branch B test 1,3
product,2b,,TestB2,8,Branch B test 2,3
product,3,,Final,3,Merge and final,
```
*Leg 2 → splits to 2a and 2b → both must complete before leg 3 starts.*

### Pattern 3: Parallel Branches Without Merge
Split into independent tracks that don't merge:
```csv
project,leg,branch,test,duration_days,description,next_leg
product,1,,Setup,1,Setup,1a;1b
product,1a,,TestA1,5,Track A,
product,1a,,TestA2,5,Track A cont,
product,1b,,TestB1,8,Track B,
product,1b,,TestB2,8,Track B cont,
```
*No merge point - both tracks complete independently.*

### Pattern 4: Sequential with Explicit Dependencies
Use `next_leg` to explicitly control dependencies between legs:
```csv
project,leg,branch,test,duration_days,description,next_leg
product,1,,Setup,1,Setup phase,2
product,2,,Testing,5,Main tests,4
product,3,,Analysis,3,Data analysis,4
product,4,,Review,2,Review phase,
```
*Leg 4 waits for both leg 2 AND leg 3 (merge point).* 
*Note: Leg 3 doesn't depend on leg 2, so 2 and 3 could potentially overlap unless configured otherwise.*

### Pattern 5: Phased Development
Use named legs for development phases with sequential flow:
```csv
project,leg,branch,test,duration_days,description,next_leg
product,prototyping,,P-01,5,Prototype test,engineering
product,engineering,,E-01,5,Engineering test,production
product,production,,Final,3,Production verification,
```
*Explicit phase ordering: Prototyping → Engineering → Production.*

### Pattern 6: Complex Multi-Split Workflow
Multiple split-merge points for complex testing:
```csv
project,leg,branch,test,duration_days,description,next_leg
product,1,,Initial,2,Initial tests,2
product,2,,Main,5,Main phase,2a;2b
product,2a,,Thermal,10,Thermal tests,3
product,2b,,Vibration,8,Vibration tests,3
product,3,,Merge1,2,First merge,4
product,4,,PreFinal,3,Pre-final tests,4a;4b
product,4a,,CheckA,2,Final check A,
product,4b,,CheckB,2,Final check B,
```
*Workflow: 1 → 2 → (2a∥2b) → 3 → 4 → (4a∥4b) → end*

**Key Points for Workflow Design**:
- Empty `next_leg` = no explicit dependency (implicit sequential or end of branch)
- Single `next_leg` value = continue to that leg after completion
- Multiple `next_leg` values (semicolon-separated) = split workflow, start ALL listed legs in parallel
- A leg with multiple incoming dependencies (listed as `next_leg` in multiple places) = merge point, waits for ALL dependencies

---

## File Format Details

### CSV Format
- Extension: `.csv`
- Encoding: UTF-8
- Delimiter: Comma (`,`)  
- Quote character: Double quote (`"`)
- Line endings: LF (Unix) or CRLF (Windows)

### Excel Format
- Extensions: `.xlsx` or `.xls`
- First sheet used (others ignored)
- Must have header row
- Same column requirements as CSV

### Special Characters in Text Fields
If your description contains commas, enclose it in quotes:
```csv
project,leg,branch,test,duration_days,description
mwcu,2,,P-01,5,"Test with temperature range: -40°C, +85°C"
```

If your description contains quotes, double them:
```csv
project,leg,branch,test,duration_days,description
mwcu,2,,P-01,5,"Test referred to as ""thermal stress"" test"
```

---

## What This File Does NOT Include

The CSV file contains **test schedule data only**. These items are configured separately:

- **Priorities**: Set in Configuration tab (per project/leg/test)
- **FTE assignments**: Set in Configuration tab (who does the work)
- **Equipment assignments**: Set in Configuration tab (what tools are needed)
- **Start/end dates**: Set in Configuration tab (when legs happen)
- **Resource timing**: Set in Configuration tab (when FTE/equipment needed during test)
- **External testing flag**: Set in Configuration tab (is this outsourced?)

This separation allows you to:
1. Define the test structure once (in CSV)
2. Try different configurations without changing the CSV
3. Run multiple scenarios with different resource/date assignments

---

## Validation Checklist

Before uploading your CSV, verify:

- [ ] File is `.csv`, `.xlsx`, or `.xls`
- [ ] Has header row with all 7 columns
- [ ] Column names are exactly: project, leg, branch, test, duration_days, description, next_leg
- [ ] No empty cells in: project, leg, test, duration_days, description
- [ ] All duration_days are positive numbers
- [ ] Row order matches desired test sequence within each leg-branch
- [ ] No duplicate test_names will be generated (unique project+leg+branch combinations)
- [ ] All `next_leg` values reference existing legs in the same project (if not empty)
- [ ] No circular dependencies in workflow (e.g., leg 2 → 3 → 2)
- [ ] Workflow has at least one starting point (leg not referenced by any other leg's next_leg)

---

## Troubleshooting

### "Missing required column" error
Check that your column names match exactly (lowercase, underscores, no spaces).

### "Invalid duration_days" error
Ensure duration_days is a number greater than 0. No text, no zero, no negatives.

### "Empty value in required column" error
Fill in all required fields. The only optional column is `branch`.

### Tests appear out of order
The sequence is determined by row order in the CSV. Reorder your rows to change test sequence.

### Duplicate test_name errors
Ensure unique combinations of project + leg + branch. If you have the same project/leg/branch multiple times, each row will get a different sequence number (1, 2, 3...), which is fine.
