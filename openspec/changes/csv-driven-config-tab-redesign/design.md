## Context

The redesign is a cross-cutting change across frontend (`ui-v2`), backend APIs, and solver integration. The current UI and data model are not aligned to the spreadsheet-first workflow documented in `frontend/docs`, particularly around strict spreadsheet validation, configuration hierarchy, and queued scenario execution.

Current state constraints:
- Configuration behavior is split across legacy sections and does not map to the six-subtab target model.
- Solver execution UX and contracts are not fully queue-oriented at scenario granularity.
- Effective settings for resources/tests require deterministic override resolution across multiple levels.
- Frontend behavior depends on backend contracts for discovery, validation, and run artifact retrieval.

Stakeholders:
- Frontend users configuring tests, resources, and runs.
- Backend/solver maintainers responsible for contract stability and scheduling semantics.

## Goals / Non-Goals

**Goals:**
- Define a stable contract where one active spreadsheet gates downstream configuration and solve actions.
- Implement a six-subtab configuration IA (Import, Weights, Legs, FTE, Equipment, Test) without ambiguity in generated JSON.
- Ensure deterministic hierarchical override resolution (`project -> leg type -> leg -> test type -> test`) for all effective test settings.
- Support queued scenario execution with run-name scoping, per-scenario controls, and streamed progress snapshots.
- Persist run artifacts in a way that reliably powers output review and visualizer run selection.

**Non-Goals:**
- Replacing the underlying optimization objective/algorithm itself.
- Defining a new long-term storage system outside current run/session artifact patterns.
- Introducing parallel execution of queued scenarios in this change.
- Full UI visual redesign beyond behavior required by the specs.

## Decisions

### 1) Backend-validated active spreadsheet as gatekeeper
Decision:
- Treat spreadsheet discovery + validation as a backend-owned contract and a hard prerequisite for configuration/solver flows.

Rationale:
- Keeps validation rules centralized and consistent across path-based and upload-based intake.
- Avoids frontend/backend drift in required columns and row-level semantics.

Alternatives considered:
- Frontend-only validation using local parsers.
Why not chosen:
- Duplicates logic and increases mismatch risk with backend/solver behavior.

### 2) Canonical extracted-entity payload for configuration editors
Decision:
- Backend returns normalized entities (projects, leg types, leg names, test types, computed test names) after validation.

Rationale:
- Configuration subtabs depend on a shared index of valid targets.
- Enables consistent cross-reference checks for imported JSON config.

Alternatives considered:
- Let each frontend subtab derive its own entities.
Why not chosen:
- Creates repeated transformation logic and inconsistent edge-case behavior.

### 3) Deterministic override engine in solver boundary
Decision:
- Resolve effective values per test at solver-input normalization stage using fixed precedence: `project -> leg type -> leg -> test type -> test`.

Rationale:
- Centralizes behavior where execution semantics matter most.
- Guarantees reproducibility independent of UI order of operations.

Alternatives considered:
- Pre-resolve all overrides in frontend.
Why not chosen:
- Couples correctness to UI behavior and risks divergence for API-driven or imported runs.

### 4) Explicit resource-time semantics
Decision:
- Model `fte_time_percent` and `equipment_time_percent` as leading-duration occupancy windows for each test.
- External tests default to no FTE/equipment requirement but still honor explicit assignments.

Rationale:
- Matches documented business semantics while keeping solver constraints explicit.

Alternatives considered:
- Treat percentages as relative weights only.
Why not chosen:
- Does not encode the required temporal occupancy behavior.

### 5) Queue-first scenario orchestration with sequential execution
Decision:
- Backend exposes queue lifecycle (`add`, `run one`, `run all unsolved`, `status`, `stop-render`) and executes scenarios one at a time per run name.

Rationale:
- Aligns with UI requirement for deferring execution until explicit run command.
- Prevents resource contention and simplifies progress/artifact mapping.

Alternatives considered:
- Immediate execution on add-to-queue.
Why not chosen:
- Conflicts with required workflow and reduces control over scenario sets.

### 6) Run artifact contract as source for output + visualizer
Decision:
- Persist per-scenario artifacts: input spreadsheet snapshot, effective config JSON, solver outputs, and plots.
- Visualizer selects run/scenario from persisted artifacts, including imported runs where available.

Rationale:
- Ensures reproducibility and traceability across solver/output/visualizer tabs.

Alternatives considered:
- Keep visualizer bound only to in-memory current run.
Why not chosen:
- Breaks multi-run comparison and imported-run visualization requirements.

## Risks / Trade-offs

- [Validation strictness may block existing loose datasets] -> Provide precise row/column error reporting and migration guidance in UI messages.
- [Override logic complexity can cause subtle regressions] -> Add solver-level unit tests for precedence and effective-value snapshots.
- [Calendar/alias expansion may increase solve-time overhead] -> Precompute expanded availability windows during normalization and cache per scenario.
- [Streaming updates can increase API/storage load] -> Throttle snapshot cadence and persist only latest + key milestones.
- [Stop-render semantics can be misinterpreted as stop-solve] -> Separate API semantics and labels for rendering stop vs solver cancellation.

## Migration Plan

1. Add backend contracts first:
- Discovery/validation/extraction endpoints and response models.
- JSON consistency warning contract.
- Scenario queue lifecycle endpoints.

2. Add solver input-normalization support:
- Override-resolution engine.
- Resource calendar + alias expansion.
- Percentage-window and external-test semantics.
- Progress snapshot emission.

3. Update frontend flows against stable contracts:
- Enforce active spreadsheet selection gate.
- Implement six-subtab configuration behavior and JSON import.
- Implement queue controls and streamed progress views.
- Implement visualizer run selection from persisted artifacts.

4. Verification gates:
- Contract tests for backend validation and queue APIs.
- Solver semantic tests for overrides/resource-time behavior.
- Frontend integration tests for end-to-end queue and artifact flows.

Rollback strategy:
- Keep legacy configuration/solver tab paths behind feature flag until new workflow passes integration tests.
- If regressions occur, disable new queue/configuration paths and route users to legacy flow while preserving artifacts.

## Open Questions

- Should spreadsheet discovery prioritize folder-path sources, uploaded-session sources, or merge both by default?
- What is the canonical run/scenario naming rule for uniqueness and collision handling?
- What snapshot interval and payload size are acceptable for progress streaming under typical solver runtimes?
- Should out-of-scope JSON references be dropped silently after warning, or preserved in output metadata for audit?
- Do we need separate timezone/week-calculation rules for `YYYY-Www.f` parsing across frontend/backend/solver?
