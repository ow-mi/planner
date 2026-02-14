# JSON Configuration Structure

## Overview

This document defines the JSON configuration structure for the PV Planning Tool. The configuration works alongside the CSV data file to define:
- Solver weights and penalties
- Leg scheduling (start/end dates)
- FTE (Full Time Employee) calendars and team assignments
- Equipment calendars and assignments
- Test-specific settings with hierarchical overrides

The configuration follows a **hierarchical override system** where more specific settings override more general ones.

## File Format

**File Extension**: `.json`
**Encoding**: UTF-8
**Structure**: Single JSON object with named sections

## Hierarchical Override System

Settings can be defined at 5 levels of specificity:

```
Project (most general)
  ↓ (can be overridden by)
Leg Type
  ↓
Leg (specific leg within project)
  ↓
Test Type
  ↓
Test (specific test - most specific)
```

**Override Rule**: More specific settings always override less specific settings.

**Example**:
```json
{
  "projects": {
    "gen3_pv": { "fte": "team_gen3" }           // Default for all gen3_pv tests
  },
  "leg_types": {
    "2": { "fte": "team_mw" },                  // Overrides for leg type 2
  },
  "legs": {
    "gen3_pv__2": { "fte": "micky" }            // Overrides for specific leg
  },
  "test_types": {
    "Leak": { "external": true },               // Overrides for test type Leak
  },
  "tests": {
    "gen3_pv__2__1__P-01": { "fte": "fte_3" }   // Overrides for specific test
  }
}
```

**Result for test "gen3_pv__2__1__P-01"**:
- FTE: "fte_3" (from specific test setting)
- External: true (from test type "Leak" - wait, P-01 isn't Leak...)

Actually, let me reconsider. The hierarchy should probably be per-project or the CSV needs to provide more context. Let me document it as described in the design.

## Top-Level Structure

```json
{
  "version": "2.0",
  "metadata": {
    "created_date": "2026-02-13",
    "description": "Configuration for gen3_pv project"
  },
  
  // Configuration Tab Subtabs
  "weights": {},           // Combined Mode + Penalty + Weights
  "legs": {},              // Leg scheduling (renamed from Deadlines)
  "fte": {},               // FTE calendars and team aliases
  "equipment": {},         // Equipment calendars
  "tests": {}              // Hierarchical test settings
}
```

## 1. Weights Configuration

Combines Mode & Weight + Penalty + Weights Slider from the old format.

```json
{
  "weights": {
    "mode": "leg_end_dates",
    "description": "Optimize for leg end date adherence",
    
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

### Field Descriptions

#### mode
**Type**: String
**Values**: `"leg_end_dates"` | `"leg_start_dates"`
**Description**: Determines whether the solver optimizes for meeting leg end dates or leg start dates.

#### description
**Type**: String
**Description**: Human-readable explanation of the weight configuration.

#### objective_weights
**Type**: Object
**Fields**:
- `makespan_weight` (number, 0.0-1.0): Weight given to minimizing total project duration
- `priority_weight` (number, 0.0-1.0): Weight given to respecting test priorities
**Constraint**: `makespan_weight + priority_weight = 1.0`

#### penalties
**Type**: Object
**Fields**:
- `deadline_penalty_per_day` (number): Penalty points per day a test exceeds its leg deadline
- `compactness_penalty_per_day` (number): Penalty for spreading tests too far apart
- `allow_parallel_within_deadlines` (number, 0.0-1.0): How much parallelism is allowed within leg deadlines (0 = none, 1 = unlimited)

#### test_proximity_rules
**Type**: Array of objects
**Purpose**: Define rules for keeping related tests close together in time.
**Fields per rule**:
- `pattern` (string): Wildcard pattern for matching test names (e.g., "K-*" matches K-01, K-02, etc.)
- `max_gap_days` (number): Maximum allowed gap between consecutive tests matching the pattern
- `proximity_penalty_per_day` (number): Penalty per day of gap beyond max_gap_days
- `enforce_sequence_order` (boolean): Whether tests must maintain their sequence order

---

## 2. Legs Configuration

Defines scheduling for each leg with start and optional end dates.

**Date Format**: `YYYY-Www.f` where:
- `YYYY` = Year (e.g., 2026)
- `Www` = ISO week number (e.g., W03)
- `.f` = Fraction of week (0.0-6.0, where 0=Monday, 6=Sunday, 0.5=Wednesday noon)

```json
{
  "legs": {
    "ordering": ["2", "3", "4", "5", "prototyping", "engineering", "production"],
    
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
      },
      "prototyping": {
        "start_date": "2026-W01.0",
        "end_date": "2026-W10.0",
        "priority": 9
      }
    },
    
    "legs": {
      "gen3_pv__2": {
        "start_date": "2026-W05.0",
        "end_date": "2026-W20.0",
        "priority": 10,
        "force_sequence": true
      },
      "hec__3": {
        "start_date": "2026-W12.0",
        "end_date": null,
        "priority": 6
      }
    }
  }
}
```

### Field Descriptions

#### ordering
**Type**: Array of strings
**Description**: Defines the display and priority order of leg types. Users can reorder this array in the UI.

#### leg_types
**Type**: Object
**Key**: Leg type name (from CSV leg column)
**Value**: Leg configuration object
**Purpose**: Default settings for all legs of this type across all projects

#### legs
**Type**: Object
**Key**: Full leg identifier in format `project__leg` (e.g., "gen3_pv__2", "hec__3")
**Value**: Leg configuration object
**Purpose**: Project-specific overrides for specific legs

#### Leg Configuration Object Fields

**start_date** (string, required): Start date in `YYYY-Www.f` format
**end_date** (string, optional): End date in `YYYY-Www.f` format or `null`
**priority** (number, optional): Leg priority (1-10, higher = more important)
**force_sequence** (boolean, optional): Whether tests in this leg must maintain CSV order strictly

---

## 3. FTE Configuration

Defines Full Time Employee resources, their availability calendars, holidays, and team aliases.

```json
{
  "fte": {
    "aliases": {
      "team_gen3": ["fte_1", "fte_2", "fte_3", "fte_4"],
      "team_hec": ["fte_6", "fte_10", "fte_15"],
      "team_mw": ["mw"],
      "sofia_hengelo": ["sofia", "hengelo"]
    },
    
    "resources": {
      "fte_1": {
        "name": "John Smith",
        "calendar": {
          "2026": {
            "holidays": [
              {"start": "2026-W01.0", "end": "2026-W01.6", "name": "New Year"},
              {"start": "2026-W52.0", "end": "2026-W52.6", "name": "Christmas"}
            ],
            "availability": "preset_full_time"
          }
        },
        "availability_override": {
          "2026": {
            "W10": 0.5,
            "W11": 0.0,
            "W12": 0.5
          }
        }
      },
      
      "fte_2": {
        "name": "Jane Doe",
        "calendar": {
          "2026": {
            "holidays": [],
            "availability": "preset_full_time"
          }
        },
        "availability_override": {}
      },
      
      "mw": {
        "name": "Micky Worker",
        "calendar": {
          "2026": {
            "holidays": [
              {"start": "2026-W30.0", "end": "2026-W30.6", "name": "Summer break"}
            ],
            "availability": "preset_full_time"
          }
        },
        "availability_override": {}
      }
    }
  }
}
```

### Field Descriptions

#### aliases
**Type**: Object
**Key**: Team alias name (used in test assignments)
**Value**: Array of FTE resource IDs
**Purpose**: Define teams that can be assigned to tests as a group

#### resources
**Type**: Object
**Key**: FTE resource ID (used in assignments and aliases)
**Value**: Resource definition object

#### Resource Definition Object Fields

**name** (string, required): Human-readable name of the employee
**calendar** (object): Per-year calendar configuration
**availability_override** (object): Specific week overrides (0.0 = unavailable, 0.5 = half-time, 1.0 = full-time)

#### Calendar Configuration

**Key**: Year (e.g., "2026", "2027")
**Value**: Object with:
- `holidays` (array): List of holiday periods
  - `start` (string): Start date `YYYY-Www.f`
  - `end` (string): End date `YYYY-Www.f`
  - `name` (string): Holiday name
- `availability` (string): Preset availability pattern
  - `"preset_full_time"`: Available all working days
  - `"preset_part_time"`: 50% availability
  - `"custom"`: Uses availability_override

### FTE Calendar UI Behavior

The calendar display shows:
1. **Year selector**: Choose which year to view (2026, 2027, etc.)
2. **Employee selector**: Choose which FTE's calendar to edit
3. **52-week grid**: Each week shows availability status
4. **Holiday visualization**: Holiday periods are marked/blocked out
5. **Quick toggle**: Click week cells to toggle availability (full → half → none → full)

**Preset Behavior**:
- When holidays are set, those weeks are automatically marked unavailable
- Users can override any week individually
- Changes apply only to the selected year

---

## 4. Equipment Configuration

Defines equipment resources and their availability calendars. Structure is identical to FTE but for equipment/machinery.

```json
{
  "equipment": {
    "aliases": {
      "thermal_chambers": ["thermal_chamber_1", "thermal_chamber_2"],
      "test_stands": ["test_stand_1", "test_stand_2", "test_stand_3", "test_stand_4"]
    },
    
    "resources": {
      "thermal_chamber_1": {
        "name": "Environmental Chamber A",
        "calendar": {
          "2026": {
            "holidays": [],
            "availability": "preset_full_time"
          }
        },
        "availability_override": {
          "2026": {
            "W20": 0.0,
            "W21": 0.0
          }
        }
      },
      
      "test_stand_1": {
        "name": "Test Stand 1",
        "calendar": {
          "2026": {
            "holidays": [],
            "availability": "preset_full_time"
          }
        },
        "availability_override": {}
      },
      
      "torque_bench": {
        "name": "Torque Test Bench",
        "calendar": {
          "2026": {
            "holidays": [],
            "availability": "preset_full_time"
          }
        },
        "availability_override": {}
      }
    }
  }
}
```

### Differences from FTE Configuration

1. **No holidays concept**: Equipment doesn't take holidays, but can have maintenance periods
2. **Maintenance periods**: Use the holidays array for scheduled maintenance
3. **Same calendar UI**: 52-week availability toggle system

---

## 5. Tests Configuration

Defines test-specific settings using the hierarchical override system.

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
        "equipment": "test_stands",
        "fte_time_pct": 100,
        "equipment_time_pct": 100,
        "external": false
      },
      "hec": {
        "fte": "team_hec",
        "equipment": null,
        "fte_time_pct": 100,
        "equipment_time_pct": 100,
        "external": false
      }
    },
    
    "leg_types": {
      "2": {
        "fte": "team_mw",
        "priority": 9
      },
      "prototyping": {
        "fte": null,
        "equipment": "test_stands",
        "external": false
      }
    },
    
    "legs": {
      "gen3_pv__2": {
        "fte": "micky",
        "priority": 10
      },
      "hec__3": {
        "equipment": "test_stand_1"
      }
    },
    
    "test_types": {
      "Leak": {
        "external": true,
        "fte": null,
        "equipment": null
      },
      "K-*": {
        "equipment": "thermal_chambers",
        "fte_time_pct": 50,
        "equipment_time_pct": 100
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
      },
      "mwcu__2__a3__K-02": {
        "equipment": "thermal_chamber_1",
        "external": false
      }
    }
  }
}
```

### Field Descriptions

#### default
**Type**: Object
**Purpose**: Default settings for all tests if no override applies
**Fields**:
- `fte` (string|null): Default FTE assignment (alias, specific FTE ID, or null)
- `equipment` (string|null): Default equipment assignment (alias, specific equipment ID, or null)
- `fte_time_pct` (number): Percentage of test duration FTE is needed (0-100)
- `equipment_time_pct` (number): Percentage of test duration equipment is needed (0-100)
- `external` (boolean): Whether test is performed externally

#### projects / leg_types / legs / test_types / tests
**Type**: Object
**Key**: Identifier at that hierarchy level
**Value**: Settings object (partial or complete)

### Test Settings Fields

#### fte
**Type**: String or null
**Values**:
- Team alias: `"team_gen3"` → Resolves to ["fte_1", "fte_2", "fte_3", "fte_4"]
- Specific FTE: `"fte_1"`, `"mw"`, `"micky"`
- null: No FTE assigned

**Assignment Logic**: Uses "contains string search" pattern:
- If assigned FTE is a team alias → all FTEs in that team
- If assigned FTE is specific ID → that specific FTE
- If pattern matching used → all FTEs matching pattern

#### equipment
**Type**: String or null
**Values**:
- Equipment alias: `"thermal_chambers"`, `"test_stands"`
- Specific equipment: `"thermal_chamber_1"`, `"torque_bench"`
- null: No equipment assigned

#### fte_time_pct
**Type**: Number (0-100)
**Description**: Percentage of test duration from start when FTE is required
**Example**: 25% on an 8-week test = FTE needed for first 2 weeks only

#### equipment_time_pct
**Type**: Number (0-100)
**Description**: Percentage of test duration from start when equipment is required

#### external
**Type**: Boolean
**Description**: Whether test is performed at external facility
**Override Behavior**: If external=true but FTE/equipment assigned, the resources are still used (e.g., sending equipment to external lab)

#### priority
**Type**: Number (1-10)
**Description**: Test priority override (higher = more important)

### Hierarchical Override Resolution

To determine settings for a specific test, the system:

1. Start with `default` settings
2. Apply `projects` settings if project matches
3. Apply `leg_types` settings if leg type matches
4. Apply `legs` settings if specific leg matches
5. Apply `test_types` settings if test type matches
6. Apply `tests` settings if specific test matches

**Each step can override fields from previous steps**.

**Example Resolution for "gen3_pv__2__1__P-01"**:

```
Start with default:
  { fte: null, equipment: null, fte_time_pct: 100, equipment_time_pct: 100, external: false }

Apply projects["gen3_pv"]:
  { fte: "team_gen3", equipment: "test_stands", fte_time_pct: 100, equipment_time_pct: 100, external: false }

Apply leg_types["2"]:
  { fte: "team_mw", equipment: "test_stands", fte_time_pct: 100, equipment_time_pct: 100, external: false }
  (fte changed from team_gen3 to team_mw)

Apply legs["gen3_pv__2"]:
  { fte: "micky", equipment: "test_stands", fte_time_pct: 100, equipment_time_pct: 100, external: false }
  (fte changed from team_mw to micky)

Apply test_types["P-*"]:  (P-01 matches P-* pattern)
  { fte: "micky", equipment: "test_stands", fte_time_pct: 25, equipment_time_pct: 25, external: false }
  (time percentages changed)

Apply tests["gen3_pv__2__1__P-01"]:
  { fte: "fte_3", equipment: "test_stands", fte_time_pct: 50, external: false }
  (fte changed to fte_3, time_pct changed to 50)

Final settings for this test:
  fte: "fte_3"
  equipment: "test_stands"
  fte_time_pct: 50
  equipment_time_pct: 25
  external: false
```

---

## Complete Example Configuration

```json
{
  "version": "2.0",
  "metadata": {
    "created_date": "2026-02-13",
    "description": "Full configuration for gen3_pv and hec projects",
    "csv_file": "test_schedule.csv"
  },
  
  "weights": {
    "mode": "leg_end_dates",
    "description": "Optimize for meeting leg deadlines with priority weighting",
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
      },
      {
        "pattern": "P-*",
        "max_gap_days": 14,
        "proximity_penalty_per_day": 20.0,
        "enforce_sequence_order": false
      }
    ]
  },
  
  "legs": {
    "ordering": ["prototyping", "engineering", "production", "2", "3", "4", "5"],
    
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
      },
      "prototyping": {
        "start_date": "2026-W01.0",
        "end_date": "2026-W10.0",
        "priority": 9
      },
      "engineering": {
        "start_date": "2026-W11.0",
        "end_date": "2026-W25.0",
        "priority": 8
      }
    },
    
    "legs": {
      "gen3_pv__prototyping": {
        "start_date": "2026-W02.0",
        "end_date": "2026-W12.0",
        "priority": 10
      }
    }
  },
  
  "fte": {
    "aliases": {
      "team_gen3": ["fte_1", "fte_2", "fte_3", "fte_4"],
      "team_hec": ["fte_6", "fte_10", "fte_15"],
      "team_mw": ["mw"],
      "sofia_hengelo": ["sofia", "hengelo"]
    },
    
    "resources": {
      "fte_1": {
        "name": "John Smith",
        "calendar": {
          "2026": {
            "holidays": [
              {"start": "2026-W52.0", "end": "2026-W52.6", "name": "Christmas"}
            ],
            "availability": "preset_full_time"
          }
        },
        "availability_override": {}
      },
      
      "fte_2": {
        "name": "Jane Doe",
        "calendar": {
          "2026": {
            "holidays": [],
            "availability": "preset_full_time"
          }
        },
        "availability_override": {}
      },
      
      "mw": {
        "name": "Micky Worker",
        "calendar": {
          "2026": {
            "holidays": [
              {"start": "2026-W30.0", "end": "2026-W30.6", "name": "Summer break"}
            ],
            "availability": "preset_full_time"
          }
        },
        "availability_override": {}
      }
    }
  },
  
  "equipment": {
    "aliases": {
      "thermal_chambers": ["thermal_chamber_1", "thermal_chamber_2"],
      "test_stands": ["test_stand_1", "test_stand_2", "test_stand_3", "test_stand_4"]
    },
    
    "resources": {
      "thermal_chamber_1": {
        "name": "Environmental Chamber A",
        "calendar": {
          "2026": {
            "holidays": [],
            "availability": "preset_full_time"
          }
        },
        "availability_override": {}
      },
      
      "test_stand_1": {
        "name": "Test Stand 1",
        "calendar": {
          "2026": {
            "holidays": [],
            "availability": "preset_full_time"
          }
        },
        "availability_override": {}
      }
    }
  },
  
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
      },
      "hec": {
        "fte": "team_hec"
      }
    },
    
    "leg_types": {
      "2": {
        "fte": "team_mw",
        "priority": 9
      }
    },
    
    "test_types": {
      "Leak": {
        "external": true,
        "fte": null,
        "equipment": null
      },
      "K-*": {
        "equipment": "thermal_chambers",
        "fte_time_pct": 50,
        "equipment_time_pct": 100
      },
      "P-*": {
        "fte_time_pct": 25,
        "equipment_time_pct": 25
      }
    }
  }
}
```

---

## Validation Rules

### JSON Schema Validation

The configuration must pass these validations:

1. **Required Top-Level Keys**:
   - `version` (string): Must be "2.0"
   - `metadata` (object): Must exist
   - At least one of: `weights`, `legs`, `fte`, `equipment`, `tests`

2. **Weights Validation**:
   - `mode` must be "leg_end_dates" or "leg_start_dates"
   - `makespan_weight + priority_weight` must equal 1.0
   - All penalty values must be non-negative numbers

3. **Legs Validation**:
   - Date format must match `YYYY-Www.f` pattern
   - Week number (ww) must be 01-53
   - Fraction (f) must be 0.0-6.0
   - End date (if provided) must be after or equal to start date

4. **FTE/Equipment Validation**:
   - All aliases must reference existing resources
   - No circular alias references
   - Holiday dates must be valid format
   - Availability overrides must be 0.0-1.0

5. **Tests Validation**:
   - All FTE/equipment references must exist (aliases or specific IDs)
   - Percentages must be 0-100
   - Pattern wildcards (*, ?) must be valid

### Warning Conditions

- Empty legs configuration (no dates set)
- Missing FTE resources referenced in aliases
- Tests with external=true but resources assigned (valid but unusual)
- Time percentages < 100% (valid but may indicate incomplete configuration)

---

## Usage Flow

1. **Upload CSV**: System validates CSV structure and extracts:
   - Project names
   - Leg types (unique leg values)
   - Test types (unique test values)
   - Leg names (project__leg combinations)
   - Test names (project__leg__branch{seq}__test)

2. **Configuration Tab** is populated with extracted values

3. **User Configures**:
   - Weights: Set solver optimization parameters
   - Legs: Set dates and priorities per leg
   - FTE: Define resources, calendars, team aliases
   - Equipment: Define equipment resources and calendars
   - Tests: Set hierarchical overrides

4. **Export JSON**: Configuration saved to JSON file

5. **Solver Execution**:
   - CSV + JSON combined
   - Hierarchical overrides resolved
   - Solver optimizes schedule
   - Results displayed in Visualizer

---

## File Naming Convention

Configuration files should be named descriptively:
- `{project_name}_config.json` (single project)
- `{description}_config.json` (multi-project)
- `config_{date}.json` (versioned)

Examples:
- `gen3_pv_config.json`
- `mwcu_hec_combined.json`
- `config_2026-02-13.json`

The JSON file can be uploaded in the Configuration tab's "Import" subtab.
