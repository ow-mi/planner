## ADDED Requirements

### Requirement: Spreadsheet Discovery and Selection Contract
The backend SHALL provide a contract to discover and describe candidate planning spreadsheets for frontend selection workflows.

#### Scenario: Discover candidate files
- **WHEN** the frontend requests available planning inputs from configured path and/or uploaded-session sources
- **THEN** backend SHALL return discoverable CSV/XLSX/XLS files with stable identifiers and metadata
- **AND** the response SHALL support frontend mandatory single active-file selection

### Requirement: Spreadsheet Validation Contract
The backend SHALL validate the selected spreadsheet schema and content before configuration and solver workflows proceed.

#### Scenario: Header and type validation responses
- **WHEN** a selected spreadsheet is validated
- **THEN** backend SHALL enforce required columns: `project`, `leg`, `branch`, `test`, `duration_days`, `description`, and `next_leg`
- **AND** backend SHALL return actionable errors for missing/invalid headers and row-level type/value failures

#### Scenario: Extracted entity payload
- **WHEN** spreadsheet validation succeeds
- **THEN** backend SHALL return extracted entities including projects, leg types, leg names, test types, and computed test names
- **AND** this payload SHALL be consumable by configuration-tab editors

### Requirement: Configuration Consistency Validation Contract
The backend SHALL validate imported/generated JSON configuration against active spreadsheet entities.

#### Scenario: Out-of-scope configuration entries
- **WHEN** configuration references projects/legs/tests absent from the active spreadsheet
- **THEN** backend SHALL return non-fatal warnings identifying out-of-scope references
- **AND** execution-time effective settings SHALL ignore out-of-scope entries

### Requirement: Scenario Queue Orchestration API
The backend SHALL expose scenario queue lifecycle operations for run-name scoped execution.

#### Scenario: Queue and execute scenarios
- **WHEN** frontend submits add-to-queue operations for a run name
- **THEN** backend SHALL persist queued scenarios without immediate execution
- **AND** run-all SHALL execute only unsolved scenarios sequentially

#### Scenario: Scenario-level execution controls
- **WHEN** frontend requests run-single-scenario, status, or stop-render
- **THEN** backend SHALL support per-scenario run control and status retrieval
- **AND** stop-render SHALL preserve latest available progress state for later inspection

### Requirement: Run Artifact Persistence Contract
The backend SHALL persist run-scoped artifacts needed for output and visualization tabs.

#### Scenario: Artifact completeness by run/scenario
- **WHEN** a scenario completes
- **THEN** backend SHALL persist input spreadsheet snapshot, effective JSON configuration, solver output files, and plot artifacts
- **AND** artifacts SHALL be queryable by run name and scenario identifier
