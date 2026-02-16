# Phase 1: Backend Contracts Implementation

## Spec Files to Read
- `openspec/changes/csv-driven-config-tab-redesign/specs/backend/spec.md` (PRIMARY)
- `openspec/changes/csv-driven-config-tab-redesign/design.md` (for context)

## Your Task

Implement the following backend endpoints in Go:

### 1. Spreadsheet Discovery Endpoint
- Add `GET /api/spreadsheets/discover`
- Return list of CSV/XLSX/XLS files from configured paths and uploaded sessions
- Include stable identifiers and metadata

### 2. Spreadsheet Validation Endpoint
- Add `POST /api/spreadsheets/validate`
- Validate required columns: project, leg, branch, test, duration_days, description, next_leg
- Return actionable errors for missing/invalid headers
- Return row-level type/value failures
- Return extracted entities: projects, leg types, leg names, test types, computed test names

### 3. Configuration Consistency Check
- Add `POST /api/config/consistency`
- Validate imported JSON config against active spreadsheet entities
- Return warnings for out-of-scope references

### 4. Scenario Queue Orchestration API
- `POST /api/scenarios/queue/add` - add scenario to queue
- `POST /api/scenarios/queue/run-one` - run single scenario
- `POST /api/scenarios/queue/run-all-unsolved` - run all unsolved scenarios
- `GET /api/scenarios/queue/status` - get queue status
- `POST /api/scenarios/queue/stop-render` - stop rendering but preserve state

## Instructions
1. Read the spec files first to understand the full requirements
2. Create new files in the backend package as needed
3. Follow existing patterns in the codebase
4. Ensure proper error handling and validation