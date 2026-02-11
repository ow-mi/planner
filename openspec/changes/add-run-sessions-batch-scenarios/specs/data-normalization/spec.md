## ADDED Requirements

### Requirement: Canonical Week Format on Ingest
The system SHALL normalize week/date fields at the backend boundary to canonical format `YYYY-Www.f` while preserving the original raw value for auditability.

#### Scenario: Normalize legacy and canonical week input
- **WHEN** a client submits week values in accepted legacy or canonical formats
- **THEN** the backend validates and stores the original value in `input_original`
- **AND** stores canonical `YYYY-Www.f` values in `input_effective`
- **AND** rejects invalid week values with field-level validation errors

### Requirement: Canonical Config Mapping
The system SHALL map UI-oriented config naming conventions to canonical backend naming once at the API boundary.

#### Scenario: Config key normalization
- **WHEN** a client submits configuration using UI-specific key conventions
- **THEN** the backend translates keys to canonical backend schema
- **AND** `settings_used.json` stores the canonical schema used for solving

### Requirement: Input Snapshot Integrity
The system SHALL capture reproducible snapshots of all effective inputs used by the solver for each run.

#### Scenario: Solver uses transformed data
- **WHEN** any input is transformed during normalization or override application
- **THEN** `input_effective` reflects transformed values actually used by the solver
- **AND** snapshots include all required CSV and JSON inputs
