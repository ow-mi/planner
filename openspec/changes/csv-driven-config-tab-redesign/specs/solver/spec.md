## ADDED Requirements

### Requirement: Solver Input Model v2
The solver SHALL accept active spreadsheet data plus a version `2.0` configuration model aligned to redesigned configuration subtabs.

#### Scenario: Accepted input bundle
- **WHEN** a scenario is started
- **THEN** solver SHALL receive one active spreadsheet dataset and one resolved configuration object
- **AND** the configuration SHALL include weights, legs, fte, equipment, and tests sections when provided

### Requirement: Hierarchical Override Resolution
The solver SHALL resolve effective test settings using deterministic precedence: project -> leg type -> leg -> test type -> test.

#### Scenario: Deterministic effective values
- **WHEN** overlapping settings are defined at multiple hierarchy levels
- **THEN** solver SHALL apply the most specific level for each field
- **AND** effective resolved values SHALL be reproducible for identical inputs

### Requirement: Resource Availability Semantics
The solver SHALL apply FTE and equipment availability using yearly calendars, holiday overrides, and alias expansions.

#### Scenario: Calendar and alias expansion
- **WHEN** configuration defines aliases and calendar availability windows
- **THEN** solver SHALL expand aliases to concrete resources before allocation
- **AND** holiday/default availability rules SHALL be enforced with explicit per-resource overrides

### Requirement: Test Resource-Time and External Semantics
The solver SHALL support partial-duration resource usage and external test behavior.

#### Scenario: Percentage-of-duration resource windows
- **WHEN** a test defines FTE-time and equipment-time percentages
- **THEN** solver SHALL model resource occupancy only for corresponding leading fractions of test duration
- **AND** remaining test duration SHALL continue without those resources unless other constraints require them

#### Scenario: External test handling
- **WHEN** a test is marked external
- **THEN** solver SHALL treat FTE/equipment as not required by default
- **AND** explicitly assigned resources SHALL still be honored

### Requirement: Progress Snapshot Emission
The solver SHALL emit incremental progress snapshots for frontend streaming visualization and stop-render workflows.

#### Scenario: Stream-compatible solver progress
- **WHEN** long-running solve operations execute
- **THEN** solver SHALL emit periodic progress snapshots with stable status fields
- **AND** snapshots SHALL support backend persistence of latest known state for interrupted rendering
