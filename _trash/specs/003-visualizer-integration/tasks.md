# Tasks: Visualizer Integration into Config Editor

**Input**: Design documents from `/specs/003-visualizer-integration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are OPTIONAL - not explicitly requested in specification, so test tasks are excluded.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., [US1], [US2], [US3])
- Include exact file paths in descriptions

## Path Conventions

- **Web application**: `ui/` directory at repository root
- Primary file: `ui/config_editor.html`
- Component files: `ui/js/visualization-component.js`, `ui/js/legacy-templates.js`
- Styles: `ui/css/visualization.css`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add required dependencies and include visualizer component files

- [X] T001 Add D3.js v7 library script tag to head section in ui/config_editor.html
- [X] T002 [P] Include visualization-component.js script before closing body tag in ui/config_editor.html
- [X] T003 [P] Include legacy-templates.js script before closing body tag in ui/config_editor.html
- [X] T004 [P] Include visualization.css stylesheet link in head section in ui/config_editor.html

**Checkpoint**: All dependencies and component files are included and ready for integration

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core component integration structure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Replace placeholder Visualizer tab content with visualizer component container structure in ui/config_editor.html
- [X] T006 Add visualizationComponent() x-data directive to Visualizer tab container in ui/config_editor.html
- [X] T007 Add chart container div with x-ref="chartContainer" in Visualizer tab in ui/config_editor.html
- [X] T008 Add error display section with x-show="error" in Visualizer tab in ui/config_editor.html
- [X] T009 Add empty state message display section in Visualizer tab in ui/config_editor.html
- [X] T010 Add initialization logic to ensure visualization component initializes correctly when Visualizer tab is opened in ui/js/visualization-component.js

**Checkpoint**: Foundation ready - visualizer component structure is in place and component can initialize. User story implementation can now begin.

---

## Phase 3: User Story 1 - Visualize Solver Results (Priority: P1) 🎯 MVP

**Goal**: Automatically display solver results in visualization when solver completes successfully. Users navigate to Visualizer tab and see test schedule data displayed in interactive D3.js visualization.

**Independent Test**: Run solver in Solver tab, navigate to Visualizer tab, verify visualization automatically displays test schedule data from solver results. Test can be verified independently by checking that visualization renders with mock solver data.

### Implementation for User Story 1

- [X] T011 [US1] Add watchSolverData() x-effect directive to watch solverState.results changes in ui/config_editor.html
- [X] T012 [US1] Modify visualizationComponent() to accept solver data from parent configEditor() component in ui/js/visualization-component.js
- [X] T013 [US1] Add method to pass solverState.results to visualizer component when solver completes in ui/config_editor.html
- [X] T014 [US1] Update updateData() method to set activeDataSource to 'solver' when solver data is received in ui/js/visualization-component.js
- [X] T015 [US1] Ensure transformSolutionResult() method is properly integrated to transform solver data format in ui/js/visualization-component.js
- [X] T016 [US1] Modify runCode() method to use solverData when activeDataSource is 'solver' in ui/js/visualization-component.js
- [X] T017 [US1] Add automatic visualization rendering when solver results become available in ui/js/visualization-component.js
- [X] T018 [US1] Add data source indicator showing "Active: solver" when solver data is displayed in ui/config_editor.html
- [X] T019 [US1] Implement automatic visualization update logic when new solver results arrive (even if CSV was previously active) in ui/js/visualization-component.js

**Checkpoint**: At this point, User Story 1 should be fully functional. Solver results automatically display in visualization when solver completes. Test independently by running solver and navigating to Visualizer tab.

---

## Phase 4: User Story 2 - Upload CSV Data for Visualization (Priority: P2)

**Goal**: Users can upload CSV files containing test schedule data to visualize historical or external data without running the solver. CSV data is parsed and displayed in the same visualization interface.

**Independent Test**: Navigate to Visualizer tab, upload a CSV file matching solver output format, verify file is parsed and visualization updates to display CSV data. Test can be verified independently without solver results.

### Implementation for User Story 2

- [X] T020 [US2] Add CSV file input element with file upload handler in Visualizer tab in ui/config_editor.html
- [X] T021 [US2] Add loading indicator display section with x-show="isLoading" in Visualizer tab in ui/config_editor.html
- [X] T022 [US2] Implement processCSVFile() async method to handle CSV file upload in ui/js/visualization-component.js
- [X] T023 [US2] Add CSV file parsing using PapaParse library in processCSVFile() method in ui/js/visualization-component.js
- [X] T024 [US2] Add CSV validation to check required columns (test_id, project_leg_id, start_date, end_date) in ui/js/visualization-component.js
- [X] T025 [US2] Add file size check and warning message for files over 10MB in processCSVFile() method in ui/js/visualization-component.js
- [X] T026 [US2] Transform CSV data to TransformedVisualizationData format using transformSolutionResult() method in ui/js/visualization-component.js
- [X] T027 [US2] Update csvData state and set activeDataSource to 'csv' when CSV upload succeeds in ui/js/visualization-component.js
- [X] T028 [US2] Add CSV validation error display with specific missing column information in ui/js/visualization-component.js
- [X] T029 [US2] Add success message display when CSV data loads successfully in ui/config_editor.html
- [X] T030 [US2] Update runCode() method to use csvData when activeDataSource is 'csv' in ui/js/visualization-component.js
- [X] T031 [US2] Add date format validation and error handling for CSV date parsing in ui/js/visualization-component.js

**Checkpoint**: At this point, User Story 2 should be fully functional. Users can upload CSV files and see them visualized. Test independently by uploading a CSV file without running solver.

---

## Phase 5: User Story 3 - Select Visualization Templates (Priority: P3)

**Goal**: Users can select from multiple visualization templates (Gantt charts, equipment utilization, FTE utilization, concurrency charts) to view their data in different formats. Template selection persists across tab switches.

**Independent Test**: Load data (solver or CSV), select different templates from dropdown, verify visualization re-renders using selected template. Test can be verified independently with any data source.

### Implementation for User Story 3

- [X] T032 [US3] Add template selection dropdown with options (gantt-tests, equipment, fte, concurrency) in Visualizer tab in ui/config_editor.html
- [X] T033 [US3] Add x-model="currentTemplateId" binding to template dropdown in ui/config_editor.html
- [X] T034 [US3] Add @change handler to call loadTemplate() when template selection changes in ui/config_editor.html
- [X] T035 [US3] Ensure loadTemplate() method loads template code from legacyTemplates object correctly in ui/js/visualization-component.js
- [X] T036 [US3] Add template code persistence to localStorage in loadTemplate() method in ui/js/visualization-component.js
- [X] T037 [US3] Add automatic visualization re-rendering when template changes in ui/js/visualization-component.js
- [X] T038 [US3] Implement template selection persistence logic when navigating away from and returning to Visualizer tab in ui/js/visualization-component.js
- [X] T039 [US3] Add template loading from localStorage on component initialization in init() method in ui/js/visualization-component.js

**Checkpoint**: At this point, User Story 3 should be fully functional. Users can switch between visualization templates and selection persists. Test independently by selecting different templates with any data source.

---

## Phase 6: Data Source Switching & Integration

**Purpose**: Enable users to switch between solver and CSV data sources with clear indication

- [X] T040 Add data source switching buttons (Switch to Solver Data / Switch to CSV Data) in Visualizer tab in ui/config_editor.html
- [X] T041 Implement switchDataSource() method to toggle between 'solver' and 'csv' data sources in ui/js/visualization-component.js
- [X] T042 Add conditional display of switch buttons based on available data sources in ui/config_editor.html
- [X] T043 Add active data source indicator display showing current source in Visualizer tab in ui/config_editor.html
- [X] T044 Implement data source switching logic to update visualization correctly when switching between solver and CSV data in ui/js/visualization-component.js
- [X] T045 Add automatic switch to solver data when new solver results arrive (overriding CSV) in ui/js/visualization-component.js

**Checkpoint**: Data source switching fully functional. Users can switch between solver and CSV data with clear indication of active source.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Error handling, edge cases, performance, and final integration polish

- [X] T046 Add error handling for malformed solver results data in ui/js/visualization-component.js
- [X] T047 Add error handling for visualization code execution failures with line numbers (when available from error stack traces) in ui/js/visualization-component.js
- [X] T048 Add empty state message when no data is available (neither solver nor CSV) in ui/config_editor.html
- [X] T049 Review and resolve any CSS conflicts between visualization.css and config_editor.html styles in ui/css/visualization.css
- [X] T050 Add ARIA labels and accessibility attributes to loading indicators and error messages in ui/config_editor.html
- [X] T051 Implement visualization state persistence logic to maintain state correctly when switching between tabs in ui/js/visualization-component.js
- [X] T052 Add performance optimization for large datasets (up to 1000 test schedules per SC-003) in ui/js/visualization-component.js
- [X] T053 Validate all success criteria are met (SC-001 through SC-008) per spec.md
- [X] T054 Test edge cases: incomplete solver results, missing CSV columns, large CSV files, date format variations
- [X] T055 Run quickstart.md validation to verify integration steps work correctly
- [X] T056 [P] Update documentation if needed based on implementation changes

**Checkpoint**: All edge cases handled, error messages clear, performance acceptable, accessibility improved. Feature complete and ready for validation.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed sequentially in priority order (P1 → P2 → P3)
  - Or in parallel if multiple developers available (US1, US2, US3 can be worked on simultaneously after Phase 2)
- **Data Source Switching (Phase 6)**: Depends on US1 and US2 completion
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent of US1, but shares visualization rendering logic
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Independent of US1/US2, works with any data source

### Within Each User Story

- Component structure before data integration
- Data integration before visualization rendering
- Core functionality before edge cases
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 1**: T002, T003, T004 can run in parallel (different script/style includes)
- **Phase 2**: Most tasks are sequential (building component structure)
- **After Phase 2**: US1, US2, US3 can be worked on in parallel by different developers
- **Phase 6**: Can start once both US1 and US2 are complete
- **Phase 7**: T055 can run in parallel with other polish tasks

---

## Parallel Example: User Story 1

```bash
# After Phase 2 completes, US1 tasks can be worked on:
# T011: Add watchSolverData() directive
# T012: Modify visualizationComponent() to accept solver data
# T013: Add method to pass solver results
# These can be worked on in parallel by coordinating on the same files
```

---

## Parallel Example: User Stories 2 and 3

```bash
# After Phase 2 completes, US2 and US3 can be worked on simultaneously:
# Developer A: US2 - CSV upload functionality (T019-T030)
# Developer B: US3 - Template selection (T031-T038)
# These are independent and don't conflict
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (add dependencies)
2. Complete Phase 2: Foundational (component structure)
3. Complete Phase 3: User Story 1 (solver results visualization)
4. **STOP and VALIDATE**: Test User Story 1 independently
   - Run solver
   - Navigate to Visualizer tab
   - Verify visualization displays automatically
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add Data Source Switching → Test independently → Deploy/Demo
6. Add Polish → Final validation → Deploy
7. Each increment adds value without breaking previous functionality

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (solver integration)
   - Developer B: User Story 2 (CSV upload)
   - Developer C: User Story 3 (template selection)
3. Stories complete and integrate independently
4. Phase 6 (switching) requires coordination between A and B
5. Phase 7 (polish) can be distributed across team

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- File paths are relative to repository root (ui/config_editor.html, ui/js/visualization-component.js, etc.)
- All modifications are to existing files - no new files need to be created
- Component files (visualization-component.js, legacy-templates.js) already exist and just need integration

---

## Task Summary

**Total Tasks**: 56

**Tasks by Phase**:
- Phase 1 (Setup): 4 tasks
- Phase 2 (Foundational): 6 tasks
- Phase 3 (US1 - Solver Results): 9 tasks (added T015 for transformSolutionResult)
- Phase 4 (US2 - CSV Upload): 12 tasks
- Phase 5 (US3 - Template Selection): 8 tasks
- Phase 6 (Data Source Switching): 6 tasks
- Phase 7 (Polish): 11 tasks

**Tasks by User Story**:
- User Story 1: 9 tasks (added transformSolutionResult integration)
- User Story 2: 12 tasks
- User Story 3: 8 tasks
- Cross-cutting: 19 tasks (Setup, Foundational, Switching, Polish)

**Parallel Opportunities Identified**:
- Phase 1: 3 parallel tasks (T002, T003, T004)
- After Phase 2: US1, US2, US3 can be parallelized
- Phase 7: 1 parallel task (T056)

**Independent Test Criteria**:
- **US1**: Run solver → Navigate to Visualizer tab → Verify visualization displays automatically
- **US2**: Navigate to Visualizer tab → Upload CSV → Verify visualization updates
- **US3**: Load any data → Select template → Verify visualization re-renders

**Suggested MVP Scope**: Phase 1 + Phase 2 + Phase 3 (User Story 1 only) = 19 tasks
- This delivers core value: automatic visualization of solver results
- Can be deployed and demoed independently
- Subsequent stories add incremental value without breaking MVP

