## ADDED Requirements

### Requirement: Backend Run Session Lifecycle
The system SHALL provide a backend-owned run session lifecycle that allows clients to create a run, upload run inputs, execute solve, and retrieve status/results using a run identifier.

#### Scenario: Create and execute a run session
- **WHEN** a client creates a run session and uploads required inputs
- **THEN** the backend stores session state and returns a stable run identifier
- **AND** the client can trigger solve using the stored session snapshot
- **AND** status and results are retrievable by run identifier without requiring the browser to resend all inputs

### Requirement: Run Artifact Packaging
The system SHALL persist a complete artifact package for each run under a deterministic run folder that includes original inputs, effective inputs, settings used, outputs, and plots.

#### Scenario: Successful run packaging
- **WHEN** a run completes successfully
- **THEN** artifacts are stored under `runs/<timestamp>_<run_name>/<run_id>/`
- **AND** `input_original/`, `input_effective/`, `output/`, `plots/`, and `settings_used.json` are present

#### Scenario: Infeasible or failed run packaging
- **WHEN** a run completes with infeasible or failed status
- **THEN** the run folder is still created
- **AND** available artifacts and diagnostic metadata are stored for reproducibility

### Requirement: Batch Scenario Execution
The system SHALL support batch execution where multiple scenarios are evaluated from one baseline dataset and scenario-specific override deltas.

#### Scenario: Execute multiple scenarios in one batch
- **WHEN** a client submits a baseline input with `batch_config` containing multiple scenarios
- **THEN** the backend fans out one run per scenario
- **AND** each scenario run writes artifacts in its own scenario-scoped run folder
- **AND** the batch response includes per-scenario status tracking

### Requirement: Deterministic Override Precedence
The system SHALL apply assignment and resource overrides in deterministic precedence order.

#### Scenario: Assignment precedence with wildcard fallback
- **WHEN** a test has explicit non-`*` assignment values
- **THEN** explicit test assignments take precedence over scenario project/leg overrides
- **AND** scenario project/leg overrides apply only when the test-level value is `*`
- **AND** default pool assignment behavior is used when neither explicit nor override assignments apply
