# Change: CSV-driven configuration tab redesign and run workflow updates

## Why
The current UI and configuration model do not fully support the new spreadsheet-first workflow described in `frontend/docs`. The redesign requires stricter input validation, a restructured Configuration tab, hierarchical test settings, and updated solver/visualizer run behavior.

## What Changes
- Define a CSV/Excel-first intake workflow with required file selection and strict schema/type validation.
- Redesign Configuration tab into six subtabs: Import, Weights, Legs, FTE, Equipment, and Test.
- Add JSON import/upload validation against configuration version `2.0` and CSV-consistency checks.
- Specify hierarchical override behavior for test settings across project, leg type, leg, test type, and test scopes.
- Define FTE/equipment yearly calendar and alias-group management behavior.
- Update solver UX around run naming, scenario queueing, sequential run execution, and per-scenario run controls.
- Add visualizer run selection behavior across active and imported runs.
- Clarify expected persisted outputs for each run (input snapshots, solver outputs, plots).

## Capabilities

### New Capabilities
- `backend`: Backend contracts for spreadsheet discovery/validation, config consistency checks, and queued scenario orchestration.
- `solver`: Solver-side support for hierarchical override resolution, resource-time semantics, and streamed progress snapshots.

### Modified Capabilities
- `ui-v2`: UI behavior updates for CSV-first intake, 6-subtab configuration redesign, scenario queue controls, and run selection in visualizer.

## Impact
- Affected specs: `ui-v2`, `backend`, `solver`
- Affected code (implementation phase):
  - `frontend` input, configuration, solver, visualizer, and output UI components/stores
  - backend APIs used for run/scenario execution and artifact retrieval
  - solver integration contract for streamed progress snapshots
- Breaking/behavior changes:
  - Configuration tab information architecture changes (7 to 6 subtabs)
  - Solver tab batch flow replaced by queued scenario workflow in Solver
