## Context
The current planner flow accepts client-side parsed CSV content and executes single solver runs. The system needs reproducible backend-owned run state, canonical normalization, and multi-scenario batch execution without changing baseline test sequence definitions.

## Goals / Non-Goals
- Goals:
  - Define a backend run session lifecycle that persists authoritative inputs and outputs.
  - Define batch execution from one baseline input with scenario-specific deltas.
  - Define canonical week formatting and normalization for consistent ingest behavior.
  - Define deterministic precedence rules for assignment overrides.
- Non-Goals:
  - Implementing plotting libraries or changing solver objective semantics.
  - Replacing all existing UI tabs or redesigning unrelated workflows.

## Decisions
- Decision: Backend run session is the source of truth.
  - Rationale: Prevent browser-only divergence and ensure reproducible runs.
- Decision: Persist both original and effective inputs per run.
  - Rationale: Preserve auditability while capturing transformed values used at solve time.
- Decision: Batch scenarios are deltas against baseline input.
  - Rationale: Reduce duplication and keep scenario intent explicit.
- Decision: Override precedence SHALL be deterministic.
  - Rationale: Avoid ambiguous assignment behavior.

## Data and Contracts
- Run folder contract:
  - `runs/<timestamp>_<run_name>/<run_or_scenario_id>/input_original/`
  - `runs/<timestamp>_<run_name>/<run_or_scenario_id>/input_effective/`
  - `runs/<timestamp>_<run_name>/<run_or_scenario_id>/output/`
  - `runs/<timestamp>_<run_name>/<run_or_scenario_id>/plots/`
  - `runs/<timestamp>_<run_name>/<run_or_scenario_id>/settings_used.json`
- Week canonical format: `YYYY-Www.f`.
  - Normalize incoming week values at backend boundary.
  - Store raw and normalized values when transformation occurs.
- Override precedence:
  1. Explicit test-level assignment (non-`*`)
  2. Scenario project/leg override (applies only when test-level value is `*`)
  3. Default pool assignment behavior

## Risks / Trade-offs
- Risk: Backward compatibility for legacy `YYYY-W##` inputs.
  - Mitigation: Accept legacy input but normalize and persist canonical representation.
- Risk: Batch fan-out increases compute time and storage.
  - Mitigation: Add bounded concurrency and explicit retention policy.
- Risk: UI complexity in scenario editing.
  - Mitigation: Start with JSON-first batch editor and progressive table UX.

## Migration Plan
1. Add run-session API contract and storage layout.
2. Add ingest normalization and snapshot persistence.
3. Add batch execution API and scenario override application.
4. Add UI v2 Batch tab and results matrix.
5. Validate parity and run packaging before cutover.

## Open Questions
- Should batch scenarios support inheritance (`base_scenario`) in V1 or defer to V2?
- What retention window should apply to run artifact folders?
- Should `plot.html`/`plot.png` be required for failed or infeasible runs?
