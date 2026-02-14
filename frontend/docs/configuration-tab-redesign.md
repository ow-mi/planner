# Configuration Tab Redesign Specification

## Overview

This document specifies the redesigned Configuration Tab for the PV Planning Tool. The Configuration Tab will be restructured from 7 subtabs to 6 subtabs, with significantly enhanced functionality to support the new data model with CSV-driven hierarchical configuration.

## Current vs New Structure

### Current Structure (7 Subtabs)
1. **Import JSON** - Paste JSON configuration
2. **Mode & Weight** - Scheduling mode and enable toggle
3. **Deadlines** - Leg deadline configuration (start/end dates)
4. **Penalty** - Penalty settings (deadline, compactness, parallel)
5. **Proximity Rules** - Test proximity configuration
6. **Weights Slider** - Makespan vs priority balance
7. **Output JSON** - View generated configuration

### New Structure (6 Subtabs)
1. **Import** - JSON file upload and paste
2. **Weights** - Combines Mode & Weight + Penalty + Weights Slider
3. **Legs** - Renamed from "Deadlines", adds ordering and new date format
4. **FTE** - Full Time Employee calendars, holidays, team aliases
5. **Equipment** - Equipment calendars and assignments
6. **Test** - Hierarchical test settings with override system

## Data Flow Architecture

```
CSV Upload → Extract Data → Populate Config Tab
                                    ↓
User Configures Each Subtab → Store State in Alpine.js
                                    ↓
Generate JSON Configuration → Save to localStorage
                                    ↓
Solver Execution → Use CSV + Generated JSON
```

## Dependency: CSV Data Extraction

Before the Configuration Tab can be used, the CSV must be uploaded and parsed. The system extracts:

- **Projects**: Unique `project` column values
- **Leg Types**: Unique `leg` column values (e.g., 2, 3, prototyping)
- **Leg Names**: `project__leg` combinations (e.g., "gen3_pv__2", "hec__3")
- **Test Types**: Unique `test` column values (e.g., Leak, K-01, P-03)
- **Test Names**: Computed as `project__leg__branch{sequence}__test` (e.g., "mwcu__2__a1__P-01")

These extracted values populate dropdowns and lists throughout the Configuration Tab.

---

## Subtab 1: Import

### Purpose
Load existing configuration from JSON files.

### Current State
- Textarea for pasting JSON
- "Apply JSON" button

### New Design

#### Layout
```
┌─────────────────────────────────────────────────────┐
│ IMPORT CONFIGURATION                                 │
├─────────────────────────────────────────────────────┤
│                                                      │
│ [Upload JSON File]        [Browse...]               │
│                                                      │
│ ─────────── OR ───────────                          │
│                                                      │
│ Paste JSON Configuration:                           │
│ ┌────────────────────────────────────────────────┐ │
│ │ {                                              │ │
│ │   "version": "2.0",                            │ │
│ │   "weights": { ... },                          │ │
│ │   ...                                          │ │
│ │ }                                              │ │
│ └────────────────────────────────────────────────┘ │
│                                                      │
│ [Apply Configuration]                               │
│                                                      │
│ Validation Status: ✓ Valid / ✗ Invalid             │
│                                                      │
└─────────────────────────────────────────────────────┘
```

#### Inputs

**File Upload**
- **Type**: File input
- **Accept**: `.json` files
- **Action**: Load file content into textarea, then validate and apply

**JSON Textarea**
- **Type**: Text area (multi-line)
- **Placeholder**: Example JSON structure
- **Validation**: Real-time JSON syntax validation
- **Action**: Parse and populate all subtabs on "Apply"

**Apply Button**
- **Action**: Validate JSON against schema, then:
  1. Populate Weights subtab
  2. Populate Legs subtab with ordering and dates
  3. Populate FTE subtab with resources and aliases
  4. Populate Equipment subtab
  5. Populate Test subtab with hierarchical overrides

#### Validation

**Schema Validation**:
- Required fields: `version` (must be "2.0")
- Optional sections: `weights`, `legs`, `fte`, `equipment`, `tests`
- Type checking for all fields
- Cross-reference validation (e.g., FTE aliases reference existing resources)

**CSV Consistency Check**:
- Validate that JSON references only exist in CSV
- Warning if JSON has settings for legs/tests not in current CSV
- Option to "prune to current CSV" (remove orphaned settings)

**Example Warning Message**:
```
⚠️ Configuration contains references not in current CSV:
   - Leg: "hec__4" (not found in CSV)
   - Test: "gen3_pv__5__1__P-01" (not found in CSV)

Options:
  [Keep All] [Prune Orphans] [Cancel]
```

---

## Subtab 2: Weights

### Purpose
Configure solver optimization parameters by combining three current subtabs.

### Current State (3 separate subtabs)
- Mode & Weight: Scheduling mode dropdown
- Penalty: 3 numeric inputs
- Weights Slider: Single slider for makespan/priority

### New Design

#### Layout
```
┌─────────────────────────────────────────────────────┐
│ WEIGHTS & PENALTIES                                  │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Mode: [Optimize for Leg End Dates ▼]                │
│ Description: [Optimize project delivery dates      ] │
│                                                      │
│ ─────────────────────────────────────────────────── │
│                                                      │
│ Objective Balance:                                   │
│                                                      │
│  Makespan Priority                                   │
│    0% ──────────────────────────────── 100%         │
│    ↑                                   ↑            │
│  Minimize                        Respect           │
│  Total Duration                 Test Priorities      │
│                                                      │
│  Current: 30% Makespan / 70% Priority               │
│                                                      │
│ ─────────────────────────────────────────────────── │
│                                                      │
│ Penalties:                                          │
│                                                      │
│  Deadline Penalty (per day):     [100.0          ]  │
│  Compactness Penalty (per day):  [10.0           ]  │
│  Parallel Within Deadlines:      [0.5            ]  │
│                                                      │
│ ─────────────────────────────────────────────────── │
│                                                      │
│ Test Proximity Rules:                               │
│                                                      │
│  ┌──────────┬─────────────┬────────────┬──────────┐ │
│  │ Pattern  │ Max Gap     │ Penalty/   │ Enforce  │ │
│  │          │ (days)      │ Day        │ Sequence │ │
│  ├──────────┼─────────────┼────────────┼──────────┤ │
│  │ K-*      │ 7           │ 50.0       │ ☑        │ │
│  │ P-*      │ 14          │ 20.0       │ ☐        │ │
│  │ [+ Add]  │             │            │          │ │
│  └──────────┴─────────────┴────────────┴──────────┘ │
│                                                      │
└─────────────────────────────────────────────────────┘
```

#### Inputs

**Mode Dropdown**
- **Type**: Select dropdown
- **Options**: 
  - `leg_end_dates` - Optimize for meeting leg end dates
  - `leg_start_dates` - Optimize for meeting leg start dates
- **Default**: `leg_end_dates`

**Description Text**
- **Type**: Text input
- **Placeholder**: Human-readable description of weight configuration
- **Example**: "Optimize project delivery dates with priority weighting"

**Objective Balance Slider**
- **Type**: Range slider (0-100)
- **Labels**: Left="Makespan" (minimize total duration), Right="Priority" (respect test priorities)
- **Default**: 30 (30% makespan, 70% priority)
- **Storage**: Converts to `makespanWeight` and `priorityWeight` (must sum to 1.0)

**Penalty Inputs**
- **Deadline Penalty**: Number input (≥0), default 100.0
- **Compactness Penalty**: Number input (≥0), default 10.0
- **Parallel Within Deadlines**: Number input (0.0-1.0), default 0.5

**Proximity Rules Table**
- **Columns**: Pattern, Max Gap Days, Penalty Per Day, Enforce Sequence
- **Pattern**: Text input with wildcard support (* and ?)
  - Examples: "K-*" matches K-01, K-02, etc.
  - "Leak" matches exactly "Leak"
- **Max Gap Days**: Number input (≥0)
- **Penalty Per Day**: Number input (≥0)
- **Enforce Sequence**: Checkbox
- **Add Row**: Button to add new rule
- **Remove Row**: Button per row to delete

#### Data Model

```json
{
  "weights": {
    "mode": "leg_end_dates",
    "description": "Optimize project delivery dates",
    "objective_weights": {
      "makespan_weight": 0.3,
      "priority_weight": 0.7
    },
    "penalties": {
      "deadline_penalty_per_day": 100.0,
      "compactness_penalty_per_day": 10.0,
      "allow_parallel_within_deadlines": 0.5
    },
    "test_proximity_rules": [
      {
        "pattern": "K-*",
        "max_gap_days": 7,
        "proximity_penalty_per_day": 50.0,
        "enforce_sequence_order": true
      }
    ]
  }
}
```

---

## Subtab 3: Legs

### Purpose
Configure leg scheduling with start dates, optional end dates, and ordering.

### Current State ("Deadlines" subtab)
- Leg ID input (text)
- Start Deadline with enable checkbox
- End Deadline with enable checkbox
- Format: YYYY-WWW.N (e.g., 2026-W30.5)

### New Design

#### Layout
```
┌─────────────────────────────────────────────────────┐
│ LEG SCHEDULING                                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Leg Ordering (drag to reorder):                     │
│                                                      │
│  ≡ 1. prototyping                                   │
│  ≡ 2. engineering                                   │
│  ≡ 3. production                                    │
│  ≡ 4. 2  (mwcu, hec, gen3_pv)                       │
│  ≡ 5. 3  (mwcu, hec)                                │
│                                                      │
│ ─────────────────────────────────────────────────── │
│                                                      │
│ Leg Type Defaults:                                  │
│                                                      │
│  ┌───────────┬─────────────────┬────────────────┬───┐│
│  │ Leg Type  │ Start Date      │ End Date       │ P ││
│  ├───────────┼─────────────────┼────────────────┼───┤│
│  │ 2         │ 2026-W03.0      │ 2026-W15.0     │ 8 ││
│  │ 3         │ 2026-W16.0      │ [Optional]     │ 7 ││
│  │ prototyp..│ 2026-W01.0      │ 2026-W10.0     │ 9 ││
│  └───────────┴─────────────────┴────────────────┴───┘│
│                                                      │
│ ─────────────────────────────────────────────────── │
│                                                      │
│ Project-Specific Overrides:                         │
│                                                      │
│  Project: [mwcu ▼]                                  │
│                                                      │
│  ┌───────────┬─────────────────┬────────────────┬───┐│
│  │ Leg       │ Start Date      │ End Date       │ P ││
│  ├───────────┼─────────────────┼────────────────┼───┤│
│  │ mwcu__2   │ 2026-W05.0      │ 2026-W20.0     │ 10││
│  │ mwcu__3   │ 2026-W12.0      │ [Optional]     │ 6 ││
│  └───────────┴─────────────────┴────────────────┴───┘│
│                                                      │
└─────────────────────────────────────────────────────┘
```

#### Inputs

**Leg Ordering List**
- **Type**: Draggable list
- **Source**: Unique `leg` values from CSV
- **Action**: Drag to reorder legs (affects priority in solver)
- **Storage**: Array of leg type names in order

**Leg Type Defaults Table**
- **Columns**: Leg Type, Start Date, End Date, Priority
- **Leg Type**: Read-only (from CSV)
- **Start Date**: Text input, format `YYYY-Www.f`
  - Validation: Valid ISO week format
  - Example: "2026-W03.0" (Monday of week 3)
- **End Date**: Text input, same format, optional (can be empty)
  - Placeholder: "[Optional]"
  - If empty: No end deadline constraint
- **Priority**: Number input (1-10)
  - Higher = more important
  - Default: 5

**Project-Specific Overrides**
- **Project Selector**: Dropdown of projects from CSV
- **Table**: Shows legs for selected project (`project__leg` format)
- **Columns**: Same as Leg Type Defaults
- **Behavior**: Empty cells inherit from Leg Type Defaults
- **Override Indicator**: Highlight cells that differ from default

#### Date Format

**Format**: `YYYY-Www.f`
- `YYYY` = 4-digit year (2026, 2027)
- `Www` = ISO week number (W01-W53)
- `.f` = Day fraction (0.0-6.0)
  - 0.0 = Monday morning
  - 3.5 = Wednesday noon
  - 6.0 = Sunday end

**Examples**:
- "2026-W03.0" - Monday of week 3, 2026
- "2026-W15.5" - Wednesday noon of week 15
- "2026-W52.6" - Sunday end of week 52

#### Data Model

```json
{
  "legs": {
    "ordering": ["prototyping", "engineering", "production", "2", "3"],
    "leg_types": {
      "2": {
        "start_date": "2026-W03.0",
        "end_date": "2026-W15.0",
        "priority": 8
      },
      "3": {
        "start_date": "2026-W16.0",
        "end_date": null,
        "priority": 7
      }
    },
    "legs": {
      "mwcu__2": {
        "start_date": "2026-W05.0",
        "end_date": "2026-W20.0",
        "priority": 10
      }
    }
  }
}
```

---

## Subtab 4: FTE (Full Time Employee)

### Purpose
Configure employee resources, their availability calendars, holidays, and team aliases.

### Current State
- No FTE-specific configuration exists currently
- FTE assignments were in CSV (now moved to config)

### New Design

#### Layout
```
┌─────────────────────────────────────────────────────┐
│ FTE RESOURCES                                       │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Team Aliases:                                       │
│                                                      │
│  Alias Name        │ FTE Members                   │
│  ──────────────────┼───────────────────────────────│
│  team_gen3         │ fte_1, fte_2, fte_3, fte_4    │
│  team_hec          │ fte_6, fte_10, fte_15         │
│  [+ Add Alias]     │                               │
│                                                      │
│ ─────────────────────────────────────────────────── │
│                                                      │
│ FTE Resources:                                      │
│                                                      │
│  Select FTE: [fte_1 ▼]                              │
│  Name: John Smith                                   │
│                                                      │
│  Select Year: [2026 ▼]                              │
│                                                      │
│  Holidays:                                          │
│  ┌──────────────┬──────────────┬────────────────┐   │
│  │ Start        │ End          │ Name           │   │
│  ├──────────────┼──────────────┼────────────────┤   │
│  │ 2026-W52.0   │ 2026-W52.6   │ Christmas      │   │
│  │ [+ Add]      │              │                │   │
│  └──────────────┴──────────────┴────────────────┘   │
│                                                      │
│  Year 2026 Availability Calendar:                   │
│                                                      │
│  Week: 01 02 03 04 05 06 07 08 09 10 11 12 13...   │
│  Avail: █ █ █ █ ░ ░ █ █ █ █ █ █ █ █...            │
│                                                      │
│  █ = Full (100%)  ░ = None (0%)  ▒ = Half (50%)   │
│                                                      │
│  Click weeks to toggle: Full → Half → None → Full │
│                                                      │
└─────────────────────────────────────────────────────┘
```

#### Inputs

**Team Aliases Section**
- **Alias Name**: Text input (identifier)
  - Validation: No spaces, unique
  - Examples: "team_gen3", "team_hec", "sofia_hengelo"
- **FTE Members**: Text input (comma-separated list)
  - References to FTE resource IDs
  - Validation: All referenced FTEs must exist
  - Examples: "fte_1, fte_2, fte_3, fte_4"
- **Add Alias**: Button to add new row
- **Remove Alias**: Button per row to delete
- **Alias Usage**: Display where each alias is used in Test subtab

**FTE Selector**
- **Type**: Dropdown
- **Options**: All defined FTE resource IDs
- **Action**: Load selected FTE's data for editing

**FTE Name**
- **Type**: Text input
- **Purpose**: Human-readable name
- **Example**: "John Smith", "Sofia", "Micky Worker"

**Year Selector**
- **Type**: Dropdown
- **Options**: Current year, next 2 years (2026, 2027, 2028)
- **Action**: Load calendar for selected year

**Holidays Table**
- **Columns**: Start Date, End Date, Holiday Name
- **Start/End Date**: Text input, format `YYYY-Www.f`
- **Holiday Name**: Text input
- **Auto-Calendar Impact**: Holiday periods automatically marked unavailable
- **Add Holiday**: Button to add new row
- **Remove Holiday**: Button per row to delete

**Availability Calendar**
- **Type**: 52-week grid visualization
- **Display**: 
  - Full availability: █ (solid block)
  - Half availability: ▒ (half block)
  - No availability: ░ (empty/block pattern)
- **Interaction**: Click cell to cycle: Full → Half → None → Full
- **Week Labels**: W01, W02, W03, etc.
- **Visual Markers**: 
  - Holiday periods highlighted
  - Current week indicator

**Preset Buttons**
- **Full Time**: Set all weeks to 100%
- **Part Time**: Set all weeks to 50%
- **Clear All**: Set all weeks to 0% (unavailable)
- **Apply Holidays**: Auto-block holiday periods

#### Data Model

```json
{
  "fte": {
    "aliases": {
      "team_gen3": ["fte_1", "fte_2", "fte_3", "fte_4"],
      "team_hec": ["fte_6", "fte_10", "fte_15"]
    },
    "resources": {
      "fte_1": {
        "name": "John Smith",
        "calendar": {
          "2026": {
            "holidays": [
              {
                "start": "2026-W52.0",
                "end": "2026-W52.6",
                "name": "Christmas"
              }
            ],
            "availability": "preset_full_time"
          }
        },
        "availability_override": {
          "2026": {
            "W10": 0.5,
            "W11": 0.0
          }
        }
      }
    }
  }
}
```

---

## Subtab 5: Equipment

### Purpose
Configure equipment resources and their availability calendars.

### Current State
- No Equipment-specific configuration exists currently
- Equipment assignments were in CSV (now moved to config)

### New Design

#### Layout
```
┌─────────────────────────────────────────────────────┐
│ EQUIPMENT RESOURCES                                 │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Equipment Aliases:                                  │
│                                                      │
│  Alias Name          │ Equipment Members           │
│  ────────────────────┼─────────────────────────────│
│  thermal_chambers    │ tc_1, tc_2                  │
│  test_stands         │ ts_1, ts_2, ts_3, ts_4      │
│  [+ Add Alias]       │                             │
│                                                      │
│ ─────────────────────────────────────────────────── │
│                                                      │
│ Equipment Resources:                                │
│                                                      │
│  Select Equipment: [thermal_chamber_1 ▼]            │
│  Name: Environmental Chamber A                      │
│                                                      │
│  Select Year: [2026 ▼]                              │
│                                                      │
│  Maintenance Periods:                               │
│  ┌──────────────┬──────────────┬────────────────┐   │
│  │ Start        │ End          │ Description    │   │
│  ├──────────────┼──────────────┼────────────────┤   │
│  │ 2026-W20.0   │ 2026-W21.6   │ Annual Service │   │
│  │ [+ Add]      │              │                │   │
│  └──────────────┴──────────────┴────────────────┘   │
│                                                      │
│  Year 2026 Availability Calendar:                   │
│                                                      │
│  Week: 01 02 03 04 05 06 07 08 09 10 11 12 13...   │
│  Avail: █ █ █ █ █ █ ░ ░ █ █ █ █ █ █...            │
│                                                      │
│  █ = Available  ░ = Maintenance/Unavail            │
│                                                      │
└─────────────────────────────────────────────────────┘
```

#### Inputs

**Equipment Aliases Section**
- Same structure as FTE Aliases
- Examples: "thermal_chambers", "test_stands", "torque_benches"

**Equipment Selector**
- **Type**: Dropdown
- **Options**: All defined equipment resource IDs

**Equipment Name**
- **Type**: Text input
- **Example**: "Environmental Chamber A", "Test Stand 1"

**Maintenance Periods Table**
- Same structure as FTE Holidays
- Called "Maintenance" instead of "Holidays" for clarity
- Examples: "Annual Service", "Calibration", "Repair"

**Availability Calendar**
- Same 52-week grid as FTE
- Binary availability (Available █ / Unavailable ░)
- No partial availability for equipment (typically)

#### Differences from FTE Tab

1. **No holidays concept** - Equipment uses "Maintenance Periods"
2. **Binary availability** - Equipment is available or not (no 50%)
3. **Same alias system** - Can group equipment into teams

#### Data Model

```json
{
  "equipment": {
    "aliases": {
      "thermal_chambers": ["tc_1", "tc_2"],
      "test_stands": ["ts_1", "ts_2", "ts_3", "ts_4"]
    },
    "resources": {
      "tc_1": {
        "name": "Environmental Chamber A",
        "calendar": {
          "2026": {
            "maintenance": [
              {
                "start": "2026-W20.0",
                "end": "2026-W21.6",
                "description": "Annual Service"
              }
            ],
            "availability": "preset_full_time"
          }
        },
        "availability_override": {
          "2026": {
            "W20": 0.0,
            "W21": 0.0
          }
        }
      }
    }
  }
}
```

---

## Subtab 6: Test

### Purpose
Configure test-specific settings using hierarchical override system.

### Current State
- No test-specific configuration exists currently
- All test settings were in CSV (now moved to config)

### New Design

#### Layout
```
┌─────────────────────────────────────────────────────┐
│ TEST CONFIGURATION                                   │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Default Settings (applied to all tests):            │
│                                                      │
│  FTE:          [None ▼]                             │
│  Equipment:    [None ▼]                             │
│  FTE Time %:   [100                ] % of test     │
│  Equip Time %: [100                ] % of test     │
│  External:     ☐ (No)                               │
│                                                      │
│ ─────────────────────────────────────────────────── │
│                                                      │
│ Hierarchical Overrides (specific overrides general):│
│                                                      │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 1. Project: [gen3_pv ▼]                         │ │
│ │    FTE: [team_gen3 ▼]  Equipment: [test_stands ▼]│ │
│ │    FTE%: [100]  Equip%: [100]  External: ☐     │ │
│ └─────────────────────────────────────────────────┘ │
│                                                      │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 2. Leg Type: [2 ▼]                              │ │
│ │    FTE: [team_mw ▼]  Priority: [9           ]   │ │
│ └─────────────────────────────────────────────────┘ │
│                                                      │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 3. Leg: [mwcu__2 ▼]                             │ │
│ │    FTE: [micky ▼]  Priority: [10          ]     │ │
│ └─────────────────────────────────────────────────┘ │
│                                                      │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 4. Test Type: [P-* ▼] (Pattern)                 │ │
│ │    FTE%: [25]  Equip%: [25]                     │ │
│ └─────────────────────────────────────────────────┘ │
│                                                      │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 5. Test: [mwcu__2__1__P-01 ▼] (Specific)        │ │
│ │    FTE: [fte_3 ▼]  FTE%: [50]  External: ☐     │ │
│ └─────────────────────────────────────────────────┘ │
│                                                      │
│ [+ Add Override]                                    │
│                                                      │
│ ─────────────────────────────────────────────────── │
│                                                      │
│ Override Summary:                                   │
│                                                      │
│  Test: mwcu__2__1__P-01                            │
│  ─────────────────────────────────────────────────  │
│  FTE:        fte_3          ← From specific test   │
│  Equipment:  test_stands    ← From project         │
│  FTE Time:   50%            ← From specific test   │
│  Equip Time: 25%            ← From test type P-*   │
│  External:   false          ← From default         │
│                                                      │
│  Resolution: Project → Leg Type → Leg → Type → Test│
│                                                      │
└─────────────────────────────────────────────────────┘
```

#### Inputs

**Default Settings Section**
- **FTE Dropdown**: 
  - Options: "None" (null), all FTE aliases, all specific FTE IDs
  - Default: "None"
- **Equipment Dropdown**:
  - Options: "None" (null), all equipment aliases, all specific equipment IDs
  - Default: "None"
- **FTE Time %**: Number input (0-100), default 100
- **Equipment Time %**: Number input (0-100), default 100
- **External Checkbox**: Boolean, default unchecked (false)

**Hierarchical Override Cards**

Each card represents one level of the hierarchy:

1. **Project Card**
   - **Selector**: Dropdown of projects from CSV
   - **Fields**: Same as Default Settings
   - **Label**: "Project: {name}"

2. **Leg Type Card**
   - **Selector**: Dropdown of leg types from CSV
   - **Fields**: FTE, Equipment, FTE%, Equip%, External, Priority
   - **Label**: "Leg Type: {type}"

3. **Leg Card**
   - **Selector**: Dropdown of specific legs (`project__leg` format)
   - **Fields**: Same as Leg Type
   - **Label**: "Leg: {project}__{leg}"

4. **Test Type Card**
   - **Selector**: Dropdown of test types OR pattern input
   - **Pattern Support**: Can use wildcards (* and ?)
   - **Fields**: FTE, Equipment, FTE%, Equip%, External, Priority
   - **Label**: "Test Type: {pattern}"
   - **Examples**: "Leak" (exact), "K-*" (pattern), "P-*" (pattern)

5. **Test Card (Specific)**
   - **Selector**: Dropdown of specific tests (computed names)
   - **Format**: `project__leg__branch{sequence}__test`
   - **Fields**: All settings
   - **Label**: "Test: {full_test_name}"

**Add Override Button**
- **Action**: Add new override card
- **Type Selection**: Choose hierarchy level first
- **Source Selection**: Then choose specific project/leg/test

**Remove Override**
- **Action**: Remove individual override cards
- **Confirmation**: "Remove override for {level}?"

**Override Summary Panel**
- **Purpose**: Show resolved settings for selected test
- **Test Selector**: Dropdown to pick any test
- **Display**: 
  - Final resolved value for each field
  - Source of each value (which override level)
  - Full resolution chain visualization

#### Hierarchical Override Logic

**Resolution Order** (most specific wins):
1. Start with **Default** settings
2. Apply **Project** override if project matches
3. Apply **Leg Type** override if leg type matches
4. Apply **Leg** override if specific leg matches
5. Apply **Test Type** override if test type matches (supports patterns)
6. Apply **Test** override if specific test matches

**Example Resolution for "gen3_pv__2__1__P-01"**:

```
Default:        { fte: null, equip: null, fte%: 100, equip%: 100, ext: false }
Project:        { fte: team_gen3, equip: test_stands }           ← Applied
Leg Type (2):   { fte: team_mw }                                  ← Overrides
Leg (gen3__2):  { fte: micky }                                    ← Overrides
Test Type (P-*):{ fte%: 25, equip%: 25 }                          ← Applied
Test (specific):{ fte: fte_3, fte%: 50 }                          ← Overrides
────────────────────────────────────────────────────────────────
Final:          { fte: fte_3, equip: test_stands, fte%: 50, 
                  equip%: 25, ext: false }
```

#### Data Model

```json
{
  "tests": {
    "default": {
      "fte": null,
      "equipment": null,
      "fte_time_pct": 100,
      "equipment_time_pct": 100,
      "external": false
    },
    "projects": {
      "gen3_pv": {
        "fte": "team_gen3",
        "equipment": "test_stands"
      }
    },
    "leg_types": {
      "2": {
        "fte": "team_mw",
        "priority": 9
      }
    },
    "legs": {
      "gen3_pv__2": {
        "fte": "micky",
        "priority": 10
      }
    },
    "test_types": {
      "Leak": {
        "external": true
      },
      "P-*": {
        "fte_time_pct": 25,
        "equipment_time_pct": 25
      }
    },
    "tests": {
      "gen3_pv__2__1__P-01": {
        "fte": "fte_3",
        "fte_time_pct": 50
      }
    }
  }
}
```

---

## Integration: CSV → Config Tab Population

### Extraction Process

When CSV is uploaded:

1. **Parse CSV** with validation
2. **Extract unique values**:
   ```javascript
   const projects = [...new Set(csvData.map(row => row.project))];
   const legTypes = [...new Set(csvData.map(row => row.leg))];
   const testTypes = [...new Set(csvData.map(row => row.test))];
   ```
3. **Generate leg names**:
   ```javascript
   const legNames = csvData.map(row => `${row.project}__${row.leg}`);
   ```
4. **Generate test names**:
   ```javascript
   const testNames = csvData.map((row, index, arr) => {
     const sequence = calculateSequence(row, arr); // Row order within leg_branch
     const branch = row.branch || '';
     return `${row.project}__${row.leg}__${branch}${sequence}__${row.test}`;
   });
   ```
5. **Store in Alpine Store** (`$store.config.extractedData`)
6. **Populate all dropdowns** in Configuration Tab

### Cross-Tab Dependencies

**FTE Tab ↔ Test Tab**:
- FTE aliases created in FTE tab appear in Test tab dropdowns
- Aliases used in Test tab show usage count in FTE tab

**Legs Tab ↔ Test Tab**:
- Leg ordering in Legs tab affects priority options in Test tab
- Leg dates in Legs tab shown as context in Test tab

**CSV ↔ All Tabs**:
- If CSV changes, config tab shows "CSV Updated - Review Configuration" warning
- Option to keep existing config or reset to defaults for new data

---

## JSON Export

### Export Button Location
Add to each subtab header:
```
[Export Current Subtab as JSON] [Export Full Configuration]
```

### Export Formats

**Single Subtab Export**:
```json
{
  "section": "fte",
  "version": "2.0",
  "fte": {
    "aliases": { ... },
    "resources": { ... }
  }
}
```

**Full Configuration Export**:
```json
{
  "version": "2.0",
  "metadata": {
    "created_date": "2026-02-13",
    "description": "Configuration for mwcu and hec projects",
    "csv_file": "test_schedule.csv"
  },
  "weights": { ... },
  "legs": { ... },
  "fte": { ... },
  "equipment": { ... },
  "tests": { ... }
}
```

---

## State Management

### Alpine Store Structure

```javascript
$store.config = {
  // Extracted from CSV
  extractedData: {
    projects: [],
    legTypes: [],
    legNames: [],
    testTypes: [],
    testNames: []
  },
  
  // Configuration data
  weights: { ... },
  legs: { ... },
  fte: { ... },
  equipment: { ... },
  tests: { ... },
  
  // UI state
  activeSubtab: 'weights',
  selectedFte: 'fte_1',
  selectedEquipment: 'tc_1',
  selectedYear: '2026',
  selectedProjectForLegs: 'mwcu',
  selectedTestForPreview: 'mwcu__2__1__P-01'
};
```

### Persistence

**LocalStorage Keys**:
- `ui_v2_exp__config__weights`
- `ui_v2_exp__config__legs`
- `ui_v2_exp__config__fte`
- `ui_v2_exp__config__equipment`
- `ui_v2_exp__config__tests`

**Auto-Save**: Every change triggers debounced save (500ms delay)

---

## Validation & Error Handling

### Per-Subtab Validation

**Weights Tab**:
- Makespan + Priority weights must sum to 1.0
- All penalties must be ≥ 0
- Proximity rules must have valid patterns

**Legs Tab**:
- Date format must match `YYYY-Www.f`
- Week numbers must be 01-53
- Fraction must be 0.0-6.0
- End date (if set) must be ≥ start date

**FTE Tab**:
- Aliases must reference existing FTEs
- Holiday dates must be valid format
- No circular alias references

**Equipment Tab**:
- Same as FTE tab
- Maintenance periods must not overlap (warn if they do)

**Test Tab**:
- All FTE/equipment references must exist
- Pattern wildcards must be valid (* and ? only)
- Percentages must be 0-100
- Override hierarchy must be consistent

### Global Validation

**Before Solver Run**:
- All required subtabs must have valid data
- CSV and Config must be compatible
- At least one FTE or Equipment must be assigned to non-external tests

**Error Display**:
- Red badges on subtabs with errors
- Inline error messages below invalid inputs
- Toast notifications for critical errors
- Detailed validation report modal before solver run

---

## Implementation Priority

### Phase 1: Core Structure
1. Restructure subtabs (6 instead of 7)
2. Update tab navigation
3. Create placeholder subtab components

### Phase 2: Weights Subtab
1. Combine existing Mode + Penalty + Weights
2. Migrate data from old stores
3. Test backward compatibility

### Phase 3: Legs Subtab
1. Rename from Deadlines
2. Add leg ordering (drag-drop)
3. Update date format to 2026-Www.f
4. Add project-specific overrides

### Phase 4: FTE & Equipment
1. Create calendar UI component (52-week grid)
2. Build alias management
3. Implement holiday/maintenance scheduling
4. Create resource selector

### Phase 5: Test Subtab
1. Build hierarchical override cards
2. Implement resolution logic
3. Create override summary panel
4. Add pattern matching for test types

### Phase 6: Integration
1. CSV extraction and population
2. Cross-tab dependencies
3. JSON export/import
4. Full validation pipeline
5. Solver integration

---

## Summary

The redesigned Configuration Tab transforms from 7 simple subtabs into 6 powerful subtabs with:

1. **Import**: Enhanced with file upload and CSV validation
2. **Weights**: Consolidated optimization settings
3. **Legs**: Drag-reorderable with new date format
4. **FTE**: Visual calendar with holidays and team aliases
5. **Equipment**: Same structure as FTE for machinery
6. **Test**: Hierarchical override system with resolution preview

This structure supports the new CSV-driven workflow with flexible configuration and clear visualization of settings at every level.
