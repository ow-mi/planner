## 1. Specification
- [x] 1.1 Review redesign source documents in `frontend/docs`
- [x] 1.2 Convert redesign notes into OpenSpec requirements/scenarios under `ui-v2`
- [x] 1.3 Run `openspec validate csv-driven-config-tab-redesign --strict`

## 2. Data Intake and Validation
- [x] 2.1 Implement CSV/Excel file selection workflow with mandatory active-file selection
- [x] 2.2 Enforce required columns and data typing rules with row-level error messages
- [x] 2.3 Block downstream configuration/solver actions until input validation succeeds

## 3. Backend Contracts
- [x] 3.1 Add backend endpoint(s) to discover candidate CSV/XLSX/XLS files from configured sources
- [x] 3.2 Add backend validation response contract for header, type, and row-level errors
- [x] 3.3 Add backend consistency-check contract for JSON config references vs active spreadsheet entities
- [x] 3.4 Add scenario-queue API contract: add-to-queue, run-one, run-all-unsolved, status/progress stream, stop-render

## 4. Configuration Tab Redesign
- [ ] 4.1 Implement six-subtab structure: Import, Weights, Legs, FTE, Equipment, Test
- [ ] 4.2 Implement JSON upload/paste import with schema validation and CSV consistency warnings
- [ ] 4.3 Implement leg ordering, week-format start dates, and optional end dates
- [ ] 4.4 Implement FTE/equipment calendar editing, holidays, and alias groups
- [ ] 4.5 Implement hierarchical override editors (project -> leg type -> leg -> test type -> test)

## 5. Solver and Visualization Workflow
- [ ] 5.1 Replace legacy batch subtab with queued scenarios in Solver
- [ ] 5.2 Implement `run name`, add-to-queue, run-all-unsolved, and per-scenario run actions
- [ ] 5.3 Show streamed simplified progress visualization and stop-render option
- [ ] 5.4 Implement visualizer run selector for active and imported runs

## 6. Solver Engine Integration
- [ ] 6.1 Implement solver handling for hierarchical override precedence and effective-setting resolution
- [ ] 6.2 Implement solver handling for FTE/equipment availability calendars, holiday overrides, and alias expansion
- [ ] 6.3 Implement solver semantics for external tests and FTE/equipment time-percentage windows
- [ ] 6.4 Emit incremental progress snapshots consumable by frontend streaming UI

## 7. Verification
- [ ] 7.1 Add tests for CSV validation and JSON import consistency behavior
- [ ] 7.2 Add tests for configuration override resolution and generated JSON output
- [ ] 7.3 Add integration tests for queued scenario execution lifecycle
