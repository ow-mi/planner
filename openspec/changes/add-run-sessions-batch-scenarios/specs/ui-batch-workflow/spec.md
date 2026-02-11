## ADDED Requirements

### Requirement: Batch Scenario Authoring in UI v2
The UI in `ui_v2_exp` SHALL provide a batch workflow for defining multiple scenarios as deltas over a selected baseline dataset.

#### Scenario: Create and edit multiple scenarios
- **WHEN** a user opens the Batch tab and defines multiple scenarios
- **THEN** each scenario supports editing of FTE counts, equipment counts, project/leg assignment overrides, and project/leg window overrides
- **AND** scenario definitions are validated before submission

### Requirement: Backend-Managed Submission
The UI SHALL submit baseline input and batch scenario definitions to backend run-session endpoints and SHALL NOT be the source of persisted run artifacts.

#### Scenario: Submit batch run
- **WHEN** a user submits a batch run from UI v2
- **THEN** the UI sends baseline data and `batch_config` to backend APIs
- **AND** backend-owned run/session identifiers are used for status and results polling

### Requirement: Batch Result Comparison
The UI SHALL provide a batch result matrix for per-scenario comparison and artifact access.

#### Scenario: View batch outcomes
- **WHEN** batch execution completes
- **THEN** the UI displays one row per scenario with key metrics
- **AND** each scenario row links to run artifacts and output files produced by backend packaging
