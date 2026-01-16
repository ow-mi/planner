# Feature Specification: Port D3 Visualization System to Alpine.js Planning Tool

**Feature Branch**: `002-d3-vis-port`
**Created**: 2025-11-19
**Status**: Draft
**Input**: User description: "Port D3 Visualization System to Alpine.js Planning Tool..."

## MIGRATION CONTEXT (CRITICAL)

**Objective**: Port the D3 plots from the legacy static HTML file into the new `ui` application as a modular Alpine.js component.

**Source Codebase (READ-ONLY)**: 
- File: `web_page_visualizer/d3_visualizations_refactored.html`
- Directory: `web_page_visualizer/`
- **Constraint**: This directory is for reference only. DO NOT MODIFY any files in `web_page_visualizer/`.

**Destination Codebase**:
- Directory: `ui/`
- Implementation: New files in `ui/js/` and `ui/css/` (e.g., `ui/js/visualization-component.js`).

**Exclusions**:
- Do NOT edit `web_page_visualizer/*`.
- Do NOT edit `ui/config_editor.html` unless necessary for integration (prefer new file `ui/visualizer.html` or similar if standalone, otherwise integrate carefully).

---

## Clarifications

### Session 2025-11-19
- Q: How should the D3 code in the editor access the DOM element it needs to draw inside? → A: **Inject a `container` variable**: The system passes an actual DOM element (e.g., `container`) to the execution scope. User code writes `d3.select(container).append(...)`.
- Q: Which editor library should we standardize on? → A: **CodeMirror 6**: Modern, modular, highly extensible, excellent accessibility.
- Q: What data format will be passed to the `data` variable in the visualization code? → A: **Raw JSON Object (Solver Output)**: The `data` variable is the exact output from the solver (the `SolutionResult` object). Templates must handle parsing/transforming this structure themselves.

## User Scenarios & Testing

### User Story 1 - View Standard Visualizations (Priority: P1)

As a planner, I want to view standard D3 visualizations of the solver output so that I can analyze the plan immediately without writing code.

**Why this priority**: Core functionality. The system must provide value out of the box with existing templates.

**Independent Test**: Can be tested by mounting the component with mock solver data and verifying that the default "Gantt" or other standard charts render correctly without user intervention.

**Alpine.js Component Requirements**:
- `x-data` store for visualization state (current template, data).
- Automatic rendering on component initialization.
- Selector for default templates.

**Acceptance Scenarios**:
1. **Given** the application loads with solver data, **When** the visualization component initializes, **Then** the default D3 chart is rendered in the main view.
2. **Given** multiple default templates exist, **When** I select a different template from the dropdown, **Then** the chart updates to match the new template using the current data.

---

### User Story 2 - Live Code Editing (Priority: P1)

As a power user, I want to edit the D3 visualization code in an embedded editor and see the results immediately, so that I can tweak the chart to highlight specific details.

**Why this priority**: Critical requirement ("maintaining code editability"). Differentiates this tool from static dashboards.

**Independent Test**: Mount component, type invalid syntax (check error handling), type valid D3 code (check rendering).

**Alpine.js Component Requirements**:
- Integration with **CodeMirror 6**.
- Two-way binding or event listening between editor content and Alpine state.
- "Run" capability to execute the string content as code.

**Acceptance Scenarios**:
1. **Given** the code editor is open, **When** I modify the D3 code and click "Run" (or auto-run), **Then** the visualization updates to reflect my changes.
2. **Given** I have made edits, **When** I switch tabs or interact with other parts of the app, **Then** my edits are preserved (during the session).
3. **Given** I make a syntax error, **When** the code executes, **Then** an error message is displayed near the plot without crashing the application.

---

### User Story 3 - Reactive Data Updates (Priority: P2)

As a planner, I want the visualization to update automatically when the solver produces new data, so that I always see the current state of the plan.

**Why this priority**: Ensures the visualization is always consistent with the solver state.

**Independent Test**: Update the reactive data store externally and verify the chart re-renders.

**Alpine.js Component Requirements**:
- `x-effect` or `$watch` on the solver data store.
- efficient re-rendering logic (destroy/recreate or update D3 selection).

**Acceptance Scenarios**:
1. **Given** a chart is displayed, **When** the solver output data changes, **Then** the chart automatically re-renders with the new data.
2. **Given** I have custom code in the editor, **When** data changes, **Then** my custom code is re-executed against the new data (my edits are not lost).

---

### User Story 4 - Custom Template Management (Priority: P3)

As a developer/analyst, I want to load custom visualization templates from files, so that I can reuse complex visualizations across different sessions or share them.

**Why this priority**: Extensibility. Allows the library of views to grow without changing the application code.

**Independent Test**: Trigger file upload with a valid JS/JSON file and check editor content/rendering.

**Alpine.js Component Requirements**:
- File input handler.
- Logic to parse loaded file and inject into editor/state.

**Acceptance Scenarios**:
1. **Given** I have a custom D3 template file, **When** I upload it via the UI, **Then** the editor populates with the file's code and the chart renders.
2. **Given** a loaded custom template, **When** I switch back to a default template, **Then** the custom template is replaced (or saved in a "Custom" list if implemented).

### Edge Cases

- **Invalid Syntax**: When user types invalid JS, the system catches the error on execution attempt and displays a friendly error message instead of a blank screen or console error.
- **Empty Data**: If solver output is null or empty, the visualization clears or displays a "No Data" state, without throwing errors.
- **Bad Template File**: If a user uploads a non-text file or a file that isn't valid JS, the system rejects it with an error message.
- **Infinite Loops**: (Optional/Advanced) If user code contains an infinite loop, the browser might freeze. *Constraint*: We cannot easily prevent this in a simple `eval` context without complex sandboxing, so we accept this risk but maybe warn the user.
- **Large Datasets**: If data is too large for D3 to render quickly, the UI remains responsive (e.g., does not block the main thread for > 2s).

## Requirements

### Functional Requirements

- **FR-001**: The system MUST provide an embedded code editor using **CodeMirror 6** with syntax highlighting for JavaScript.
- **FR-002**: The system MUST include the 4 legacy D3 templates from the previous tool (`web_page_visualizer/d3_visualizations_refactored.html`) as selectable options.
- **FR-003**: The system MUST allow execution of arbitrary JavaScript code from the editor, providing it access to a `data` variable containing the raw `SolutionResult` JSON from the solver.
- **FR-004**: The system MUST display execution errors (syntax or runtime) in a user-readable format (e.g., "Error on line 5: x is undefined").
- **FR-005**: The UI MUST implement a "Collapsible Side Panel" layout: Editor on the side (collapsible), Chart in the main area.
- **FR-006**: The system MUST automatically re-execute the current editor code when the input solver data changes.
- **FR-007**: The system MUST allow users to upload a text file (JS/JSON) to replace the current editor content.
- **FR-008**: The editor state MUST persist during the browser session (until reload) even if the user hides the panel.
- **FR-009**: The system MUST inject a `container` DOM element variable into the execution scope for the user code to select and draw into (e.g., `d3.select(container)`), preventing ID collisions.

### Key Entities

- **Template**: A string of JavaScript code that defines a D3 visualization.
- **SolverData**: The JSON object produced by the solver (read-only input for visualization).
- **VisualizationState**: Current editor content, selected template ID, error state.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can load and render a default template in under 1 second (excluding solver time).
- **SC-002**: Code edits are reflected in the visualization (re-rendered) within 500ms of triggering execution.
- **SC-003**: 100% of syntax errors in user code are caught and displayed without breaking the application UI.
- **SC-004**: System successfully renders all 4 legacy templates with valid sample data.

## Assumptions

- Solver data is available in a global Alpine store or accessible reactive variable in the `ui` app.
- The environment allows `new Function()` or similar dynamic execution mechanisms (standard for browser-based visualization editors).
- Performance is sufficient for re-rendering D3 charts on every data change (no massive datasets requiring WebGL immediately, standard SVG/Canvas D3 use).
