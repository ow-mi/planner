# Implementation Tasks: Port D3 Visualization System to Alpine.js Planning Tool

**Branch**: `002-d3-vis-port` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Implementation Strategy
- **MVP**: Phase 3 (User Story 1) delivers the read-only visualization capability using legacy templates.
- **Incremental Delivery**:
    - Phase 1 & 2: Infrastructure (Alpine.js component, CodeMirror setup) in `ui/`.
    - Phase 3: Display standard charts (Read-only).
    - Phase 4: Enable code editing (Power User).
    - Phase 5: Reactivity (Planner workflow).
    - Phase 6: File uploads (Developer workflow).
- **Testing**: "Independent Test" scenarios from spec.md are manual verification steps for the developer.

## Dependencies
1. **User Story 1 (View)**: Depends on Phase 1 (Setup) & 2 (Foundation).
2. **User Story 2 (Edit)**: Depends on Phase 3 (View).
3. **User Story 3 (Reactive)**: Depends on Phase 3 (View).
4. **User Story 4 (Custom)**: Depends on Phase 4 (Edit).

## Phase 1: Setup & Infrastructure
**Goal**: Initialize project structure and dependencies in `ui/`.

- [X] T001 Create folder structure in `ui/` (js/, css/) per plan.md
- [X] T002 [P] Create `ui/css/visualization.css` with basic layout styles
- [X] T003 [P] Create empty `ui/js/visualization-component.js`
- [X] T004 [P] Create `ui/js/editor-setup.js` stub
- [X] T005 [P] Create `ui/js/legacy-templates.js` stub

## Phase 2: Foundational Components
**Goal**: Build the core Alpine.js component and CodeMirror integration.

- [X] T006 Implement `visualizationComponent` shell in `ui/js/visualization-component.js` (state: `solverData`, `currentTemplateId`)
- [X] T007 Implement CodeMirror 6 initialization logic in `ui/js/editor-setup.js` (load from CDN/ESM)
- [X] T008 Implement `loadTemplate` method in `visualization-component.js` to switch template strings
- [X] T009 Port `Gantt Tests` template from `web_page_visualizer/d3_visualizations_refactored.html` to `ui/js/legacy-templates.js` as a JS string
- [X] T010 Port `Equipment Utilization` template to `ui/js/legacy-templates.js`
- [X] T011 Port `FTE Utilization` template to `ui/js/legacy-templates.js`
- [X] T012 Port `Active Tests` template to `ui/js/legacy-templates.js`

## Phase 3: User Story 1 - View Standard Visualizations (Priority: P1)
**Goal**: Render standard charts without user coding.
**Independent Test**: Mount component with mock data, verify chart renders.

- [X] T013 [US1] Implement `runCode` method in `visualization-component.js` using `new Function` sandbox
- [X] T014 [US1] Inject `data` (solverData) and `container` (DOM node) into execution scope
- [X] T015 [US1] Create `ui/visualizer.html` test harness with mock `SolutionResult` data
- [X] T016 [US1] Bind Alpine `x-model` to template selector in `ui/visualizer.html`
- [X] T017 [US1] Verify rendering of all 4 legacy templates in the new harness

## Phase 4: User Story 2 - Live Code Editing (Priority: P1)
**Goal**: Enable live editing and execution.
**Independent Test**: Type invalid code -> see error; Type valid code -> see update.

- [X] T018 [US2] Integrate CodeMirror instance with Alpine state (two-way binding or event listener) in `visualization-component.js`
- [X] T019 [US2] Add "Run" button handler to trigger `runCode` with current editor content
- [X] T020 [US2] Implement error handling try/catch block in `runCode`
- [X] T021 [US2] Display error messages in `ui/visualizer.html` UI (red text/alert)
- [X] T022 [US2] Implement LocalStorage persistence for user edits (`x-init` load / `$watch` save)

## Phase 5: User Story 3 - Reactive Data Updates (Priority: P2)
**Goal**: Auto-update when solver data changes.
**Independent Test**: Update mock data store, verify chart re-renders.

- [X] T023 [US3] Add `updateData(newData)` method to public API of `visualization-component.js`
- [X] T024 [US3] Add `autoRun` toggle state and checkbox to UI
- [X] T025 [US3] Implement `x-effect` or `$watch('solverData')` to trigger `runCode` if `autoRun` is true
- [X] T026 [US3] Debounce re-rendering in `visualization-component.js` to prevent thrashing

## Phase 6: User Story 4 - Custom Template Management (Priority: P3)
**Goal**: Load custom templates from files.
**Independent Test**: Upload valid JS file, verify editor content updates.

- [X] T027 [US4] Add file input element to `ui/visualizer.html` (hidden or visible)
- [X] T028 [US4] Implement `uploadTemplate` handler in `visualization-component.js` (FileReader API)
- [X] T029 [US4] Validate uploaded file content (basic non-empty check)
- [X] T030 [US4] Update editor content with file text upon successful load

## Phase 7: Polish & Cross-Cutting Concerns
**Goal**: Final cleanup and styling.

- [X] T031 Apply final CSS styling to editor panel (collapsible transition) in `ui/css/visualization.css`
- [X] T032 Ensure dark/light mode compatibility for CodeMirror theme
- [X] T033 Add simple "Reset to Default" button for modified templates
- [X] T034 Verify no global ID conflicts (ensure `container` injection is working for multiple instances)
