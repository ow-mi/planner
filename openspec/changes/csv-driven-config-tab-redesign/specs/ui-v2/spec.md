## MODIFIED Requirements

### Requirement: CSV File Intake and Management
The system SHALL require one active CSV/Excel planning file as the primary data source for configuration and solver workflows.

#### Scenario: Mandatory active data file selection
- **WHEN** users provide files via path discovery and/or upload
- **THEN** the UI SHALL list all supported CSV/XLSX/XLS candidates
- **AND** users SHALL select exactly one active input file before configuration or solver actions are enabled

#### Scenario: Multiple-file disambiguation
- **WHEN** multiple candidate spreadsheet files are available
- **THEN** the UI SHALL require explicit user selection of one file
- **AND** the selected file SHALL be used as the source of extracted projects, legs, and tests

### Requirement: Full Configuration Editor Parity
The Configuration tab SHALL be restructured into six subtabs: Import, Weights, Legs, FTE, Equipment, and Test.

#### Scenario: Six-subtab layout
- **WHEN** users open the Configuration tab
- **THEN** exactly six subtabs SHALL be visible in this order: Import, Weights, Legs, FTE, Equipment, Test
- **AND** controls from legacy Mode/Weight, Penalty, and Weights Slider SHALL be consolidated under Weights

### Requirement: Solver Execution and Status Tracking
The Solver experience SHALL support queued scenarios using the selected spreadsheet and generated configuration JSON.

#### Scenario: Queue-first workflow
- **WHEN** users click add-to-queue for a scenario definition
- **THEN** a scenario entry/tab SHALL be created and persisted without immediate solver execution
- **AND** selecting run-all SHALL execute unsolved queued scenarios sequentially

#### Scenario: Scenario-level control and progress streaming
- **WHEN** a scenario run is in progress
- **THEN** users SHALL be able to run a single scenario independently
- **AND** the UI SHALL render simplified streamed progress output during execution
- **AND** users SHALL have a stop-render control that preserves the latest available solver state snapshot

### Requirement: Visualization Templates and Code Editing
The Visualizer SHALL allow users to choose which run to visualize, including imported run outputs.

#### Scenario: Run selection for visualization
- **WHEN** multiple local or imported runs are available
- **THEN** users SHALL be able to choose the run context before rendering visualizations
- **AND** charts SHALL render from the selected run's data only

## ADDED Requirements

### Requirement: Spreadsheet Schema Validation
The system SHALL validate spreadsheet inputs against required schema and data-type rules before enabling downstream workflows.

#### Scenario: Required columns validation
- **WHEN** a spreadsheet is loaded
- **THEN** required columns SHALL include `project`, `leg`, `branch`, `test`, `duration_days`, `description`, and `next_leg`
- **AND** missing or invalid headers SHALL produce actionable error messages naming problematic columns

#### Scenario: Value and type validation
- **WHEN** rows are validated
- **THEN** `project`, `leg`, `test`, `duration_days`, and `description` SHALL reject empty values
- **AND** `duration_days` SHALL be a positive numeric value
- **AND** row-level validation errors SHALL identify row and column

### Requirement: Configuration Import and Consistency Validation
The system SHALL support JSON upload/paste import and validate configuration objects against version `2.0` plus active spreadsheet consistency.

#### Scenario: JSON upload and apply
- **WHEN** users upload a `.json` file or paste JSON text in Import
- **THEN** the system SHALL parse and validate JSON syntax and required top-level structure
- **AND** successful apply SHALL populate Weights, Legs, FTE, Equipment, and Test subtabs

#### Scenario: Configuration/CSV consistency warnings
- **WHEN** JSON contains legs/tests/projects not present in the active spreadsheet
- **THEN** the system SHALL warn users about out-of-scope entries
- **AND** only entries mapped to active spreadsheet entities SHALL be used for execution

### Requirement: Leg Scheduling Editor
The Legs subtab SHALL support ordered leg definitions with week-based dates and optional end-date controls.

#### Scenario: Leg ordering and date model
- **WHEN** users edit the Legs subtab
- **THEN** each leg SHALL support drag/reorder interaction
- **AND** each leg SHALL support required start date using `YYYY-Www.f` format
- **AND** each leg SHALL support optional enabled end date values

### Requirement: Resource Calendar and Alias Management
The FTE and Equipment subtabs SHALL provide yearly availability calendars, holiday ranges, and alias-group definitions.

#### Scenario: Yearly calendar editing
- **WHEN** users select a year and a resource
- **THEN** availability SHALL be editable in a calendar/grid view optimized for fast bulk toggling across date ranges
- **AND** holiday ranges SHALL be pre-applied but user-overridable

#### Scenario: Alias groups
- **WHEN** users define alias groups
- **THEN** each alias SHALL map to one or more underlying resource names
- **AND** aliases SHALL be selectable in Test-level resource assignment inputs

### Requirement: Hierarchical Test Overrides
Test settings SHALL support hierarchical overrides in this precedence order: project -> leg type -> leg -> test type -> test.

#### Scenario: Override precedence resolution
- **WHEN** the same setting is defined at multiple hierarchy levels
- **THEN** the most specific level SHALL override less specific levels
- **AND** effective values SHALL be deterministic for every resolved test

#### Scenario: Test settings fields
- **WHEN** users configure Test settings at any hierarchy level
- **THEN** editable fields SHALL include FTE selector, equipment selector, duration days, FTE-time percent, equipment-time percent, and external flag
- **AND** external tests SHALL not require FTE/equipment unless explicitly assigned

### Requirement: Run Artifact Visibility
Each run SHALL expose input snapshots, generated config, solver outputs, and plots for review and export.

#### Scenario: Output completeness
- **WHEN** a scenario run completes
- **THEN** users SHALL be able to inspect the spreadsheet input used, configuration JSON used, produced output data files, and generated plots
- **AND** these artifacts SHALL be associated with that specific run name and scenario
