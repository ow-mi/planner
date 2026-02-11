# Change: Add Run Sessions and Batch Scenarios

## Why
Current solver execution is single-run oriented and relies on browser-managed input state. This makes reproducibility, output packaging, and multi-scenario planning workflows difficult.

## What Changes
- Add a backend run-session lifecycle as the source of truth for solver inputs and outputs.
- Add canonical ingest normalization for week fields using `YYYY-Www.f`.
- Add persistent run artifact packaging for each run with `input_original`, `input_effective`, `output`, and `plots` folders.
- Add batch scenario execution from a baseline dataset plus per-scenario overrides.
- Define deterministic override precedence for assignments and leg windows.
- Add UI v2 batch workflow requirements for scenario authoring, submission, and comparison.

## Impact
- Affected specs: `solver-orchestration`, `data-normalization`, `ui-batch-workflow`
- Affected code: `backend/src/api/routes/solver.py`, `backend/src/services/solver_service.py`, `planner_v4/data_loader.py`, `planner_v4/main.py`, `ui_v2_exp/components/*`, `ui_v2_exp/assets/js/stores/*`
