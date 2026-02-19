# Tasks: Solver UI Integration

**Input**: Design documents from `/specs/001-solver-ui-integration/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Tests are OPTIONAL per spec - not included in this task list. Add test tasks if TDD approach is desired.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., [US1], [US2], [US3], [US4])
- Include exact file paths in descriptions

## Path Conventions

- **Web app structure**: `backend/src/`, `ui/` at repository root
- Paths follow plan.md structure: backend/ and ui/ directories

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create backend project structure per plan.md in backend/
- [ ] T002 Create backend/src/api/ directory structure with __init__.py files
- [ ] T003 Create backend/src/services/ directory structure with __init__.py files
- [ ] T004 Create backend/src/utils/ directory structure with __init__.py files
- [ ] T005 Create backend/tests/ directory structure with __init__.py files
- [ ] T006 [P] Create backend/requirements.txt with FastAPI, uvicorn, python-multipart, pydantic dependencies
- [ ] T007 [P] Create ui/js/ directory for API client code
- [ ] T008 [P] Configure CORS settings for FastAPI in backend/src/api/main.py

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T009 Create SolverExecution entity model in backend/src/api/models/responses.py
- [ ] T010 Create SolverRequest entity model in backend/src/api/models/requests.py
- [ ] T011 Create SolverResults entity model in backend/src/api/models/responses.py
- [ ] T012 Create ErrorDetails entity model in backend/src/api/models/responses.py
- [ ] T013 Implement ExecutionQueue service in backend/src/services/queue_service.py
- [ ] T014 Implement CSV file handler utility in backend/src/utils/file_handler.py
- [ ] T015 Implement input validation utility in backend/src/utils/validation.py
- [ ] T016 Create FastAPI application instance in backend/src/api/main.py
- [ ] T017 Implement health check endpoint GET /api/health in backend/src/api/routes/health.py
- [ ] T018 Configure error handling middleware in backend/src/api/main.py

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Run Solver with UI Data and Configuration (Priority: P1) 🎯 MVP

**Goal**: Execute the planning solver directly from the web UI using CSV data edited in the UI and priority configuration settings

**Independent Test**: Click "Run Solver" button in UI triggers solver execution with correct data and configuration, displays results or errors appropriately

### Implementation for User Story 1

- [ ] T019 [US1] Implement solver execution service in backend/src/services/solver_service.py
- [ ] T020 [US1] Implement CSV data extraction from Alpine.js reactive state (x-data parsedCsvData) in ui/config_editor.html using Alpine.js reactive patterns
- [ ] T021 [US1] Implement API client functions in ui/js/solver-api.js (executeSolver, getExecutionStatus, getExecutionResults)
- [ ] T022 [US1] Implement POST /api/solver/execute endpoint in backend/src/api/routes/solver.py
- [ ] T023 [US1] Add Solver tab content with "Run Solver" button in ui/config_editor.html
- [ ] T024 [US1] Implement Alpine.js component for solver execution in ui/config_editor.html (x-data with runSolver method)
- [ ] T025 [US1] Implement CSV data packaging from UI edited tables using Alpine.js reactive state (x-data) in ui/config_editor.html
- [ ] T026 [US1] Implement priority config extraction from Configuration tab output using Alpine.js reactive state (priority_config_settings) in ui/config_editor.html
- [ ] T027 [US1] Implement CSV file validation before solver execution in backend/src/utils/validation.py
- [ ] T028 [US1] Implement priority config validation in backend/src/utils/validation.py
- [ ] T029 [US1] Integrate planner_v4.main solver execution in backend/src/services/solver_service.py
- [ ] T030 [US1] Implement error handling with specific error categories in backend/src/api/routes/solver.py
- [ ] T031 [US1] Implement error display in UI with actionable guidance in ui/config_editor.html
- [ ] T032 [US1] Implement results display in Output Data tab in ui/config_editor.html
- [ ] T066 [US1] Preserve uploaded and edited CSV data in Alpine.js component state (x-data) during solver execution to prevent data loss in ui/config_editor.html

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Configure Solver Parameters (Priority: P2)

**Goal**: Set solver execution parameters (time limit, debug level, output folder) before running the solver from the UI

**Independent Test**: Solver parameter inputs in UI are correctly passed to solver execution and affect solver behavior accordingly

### Implementation for User Story 2

- [ ] T033 [US2] Add time limit input field in Solver tab in ui/config_editor.html
- [ ] T034 [US2] Add debug level dropdown in Solver tab in ui/config_editor.html
- [ ] T035 [US2] Add output folder input field in Solver tab in ui/config_editor.html
- [ ] T036 [US2] Update SolverRequest model to include time_limit, debug_level, output_folder in backend/src/api/models/requests.py
- [ ] T037 [US2] Update API client to send solver parameters in ui/js/solver-api.js
- [ ] T038 [US2] Update solver execution service to use parameters in backend/src/services/solver_service.py
- [ ] T039 [US2] Update Alpine.js component to bind parameter inputs in ui/config_editor.html

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - View Solver Execution Progress and Results (Priority: P2)

**Goal**: See real-time progress updates during solver execution and view results once solver completes

**Independent Test**: Progress indicators update during execution and results are properly displayed when available

### Implementation for User Story 3

- [ ] T040 [US3] Implement GET /api/solver/status/{execution_id} endpoint in backend/src/api/routes/solver.py
- [ ] T041 [US3] Implement progress tracking in solver service in backend/src/services/solver_service.py
- [ ] T042 [US3] Implement status polling mechanism that updates Alpine.js reactive state (x-data) in ui/config_editor.html, triggering automatic UI updates
- [ ] T043 [US3] Add progress indicator UI component in Solver tab in ui/config_editor.html
- [ ] T044 [US3] Implement elapsed time display in ui/config_editor.html
- [ ] T045 [US3] Implement current phase display in ui/config_editor.html
- [ ] T046 [US3] Implement GET /api/solver/results/{execution_id} endpoint in backend/src/api/routes/solver.py
- [ ] T047 [US3] Implement results display with key metrics in Output Data tab in ui/config_editor.html
- [ ] T048 [US3] Implement background execution continuation when navigating away in ui/config_editor.html
- [ ] T049 [US3] Update ExecutionStatus model with progress_percentage, elapsed_time_seconds, current_phase in backend/src/api/models/responses.py

**Checkpoint**: At this point, User Stories 1, 2, AND 3 should all work independently

---

## Phase 6: User Story 4 - Export and Download Results (Priority: P3)

**Goal**: Download solver output files (CSV reports, logs) generated by solver execution

**Independent Test**: Download buttons or links correctly retrieve and download generated output files from solver execution

### Implementation for User Story 4

- [ ] T050 [US4] Implement output files packaging in solver service in backend/src/services/solver_service.py
- [ ] T051 [US4] Implement file download functionality in Alpine.js component in ui/config_editor.html
- [ ] T052 [US4] Add "Download Results" button in Output Data tab in ui/config_editor.html
- [ ] T053 [US4] Implement individual file download links in ui/config_editor.html
- [ ] T054 [US4] Implement results data structure for export in ui/config_editor.html
- [ ] T055 [US4] Add file download handlers using Blob API in ui/js/solver-api.js

**Checkpoint**: All user stories should now be independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T056 [P] Add request/response logging in backend/src/api/main.py
- [ ] T057 [P] Implement queue size limit enforcement in backend/src/services/queue_service.py
- [ ] T058 [P] Add timeout handling with partial results in backend/src/services/solver_service.py
- [ ] T059 [P] Implement temporary file cleanup in backend/src/services/solver_service.py
- [ ] T060 [P] Add input validation error messages with actionable guidance in backend/src/utils/validation.py
- [ ] T061 [P] Update documentation in quickstart.md with actual implementation details
- [ ] T062 [P] Add error boundary handling in UI Alpine.js components in ui/config_editor.html
- [ ] T063 [P] Implement result size limit checks in backend/src/services/solver_service.py
- [ ] T064 [P] Add CSV file size limit validation in backend/src/utils/validation.py
- [ ] T065 Run quickstart.md validation steps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Extends US1 functionality but independently testable
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Extends US1 functionality but independently testable
- **User Story 4 (P3)**: Can start after Foundational (Phase 2) - Extends US1/US3 functionality but independently testable

### Within Each User Story

- Models before services
- Services before endpoints
- Backend API before frontend integration
- Core implementation before UI integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T006, T007, T008)
- All Foundational tasks can run in parallel after models are defined (T013-T018)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- Different user stories can be worked on in parallel by different team members
- Polish phase tasks marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch backend and frontend tasks in parallel:
Task: "Implement solver execution service in backend/src/services/solver_service.py"
Task: "Implement CSV data extraction from Alpine.js parsed data in ui/config_editor.html"
Task: "Implement API client functions in ui/js/solver-api.js"

# Launch validation tasks in parallel:
Task: "Implement CSV file validation before solver execution in backend/src/utils/validation.py"
Task: "Implement priority config validation in backend/src/utils/validation.py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add User Story 4 → Test independently → Deploy/Demo
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (MVP)
   - Developer B: User Story 2
   - Developer C: User Story 3
3. After MVP is complete:
   - Developer A: User Story 4
   - Developer B: Polish tasks
   - Developer C: Testing and validation
4. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- Backend API endpoints follow OpenAPI specification in contracts/openapi.yaml
- Frontend uses Alpine.js reactive patterns per Constitution requirements

