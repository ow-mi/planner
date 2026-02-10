# Change: Refactor UI to HTMX + Alpine.js with Verified Feature Parity

## Why
The legacy UI in `ui/config_editor.html` is feature-rich but monolithic, which makes changes risky and hard to validate. A partial refactor exists in `ui_v2_exp/`, but several critical parity gaps remain (especially configuration coverage and visualizer code editing), so the project needs a clearer spec-first migration plan.

## Current Status Review

### Completed foundation
- `ui_v2_exp/` project scaffold exists with component split, stores, services, and base styles.
- Core pages/components are present for all major tabs.
- Initial Alpine stores and helper modules are wired.

### Blocking parity gaps
- Config editor UI does not expose all legacy sections (leg deadlines, full penalty settings, proximity rule editing).
- Visualizer UI is missing code editor and split-layout workflow from legacy.
- Visualization store contains a render-path defect (`container` handling) and template wiring risk.
- Solver flow duplicates API logic in store instead of using `apiService`.
- HTMX usage is inconsistent (manual fetch + store polling instead of declared HTMX polling/indicator patterns).

## What Changes
- Define a strict `ui-v2` spec that maps every legacy feature in `ui/` to `ui_v2_exp/` acceptance scenarios.
- Refine tasks to prioritize parity blockers before polish work.
- Standardize HTMX and Alpine patterns using docs-backed guidance:
  - HTMX polling via `hx-trigger="every <interval>"`.
  - HTMX loading feedback via `hx-indicator`/`htmx-request` classes.
  - Alpine global state via `Alpine.store(...)` with `init()` bootstrapping.
  - Alpine lifecycle/reactivity via `x-effect`, `$watch`, `x-init`, and `x-cloak` for flicker control.
- Add explicit migration gate: old UI can only be replaced after parity checklist and end-to-end flows pass.

## Feature Parity Scope
The refactor MUST carry over these legacy capabilities from `ui/config_editor.html` and legacy JS modules:
- 7-tab app shell (Input Data, Edit Data, Configuration, Solver, Visualizer, Output Data, Save)
- CSV upload + edit workflow
- Full priority config editor (mode, weights, deadlines, penalties, proximity rules)
- Solver execution, status tracking, completion/failure UX
- Visualizer templates (`gantt-tests`, `equipment`, `fte`, `concurrency`) with solver/CSV data sources
- Template code editing (CodeMirror) + local persistence
- Output summaries and file downloads (single + ZIP)

## Impact
- **Affected specs**: `openspec/changes/refactor-ui-v2/specs/ui-v2/spec.md`
- **Affected code (implementation phase)**:
  - `ui_v2_exp/index.html`
  - `ui_v2_exp/components/*.html`
  - `ui_v2_exp/assets/js/stores/*.js`
  - `ui_v2_exp/assets/js/services/*.js`
- **Breaking changes**: None during proposal/implementation; migration remains parallel until parity is signed off.
