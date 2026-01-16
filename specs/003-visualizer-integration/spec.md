# Feature Specification: Visualizer Integration into Config Editor

**Feature Branch**: `003-visualizer-integration`  
**Created**: 2024-12-19  
**Status**: Draft  
**Input**: User description: "Integrate visualizer.html into config_editor.html. The solver (Python API) will generate data, we need the generated data to be sent into the visualizer tab. We also need to be able to upload CSV's as an alternative to solver data (in case we want to see some old data and not run the solver). Our visualizer should be in the appropriate tab in the tool."

## Clarifications

### Session 2024-12-19

- Q: What CSV format should be supported for upload? → A: Use the same CSV format as solver output files (test_schedules.csv structure)
- Q: Should loading indicators be shown during CSV parsing and visualization rendering? → A: Show loading indicator only during CSV file upload/parsing
- Q: What should happen when CSV files exceed 10MB size limit? → A: Accept files over 10MB but warn about potential performance issues
- Q: Can users switch between solver data and CSV data after upload? → A: Allow users to switch between solver data and CSV data with clear indication of active source
- Q: What happens when new solver results arrive while CSV data is active? → A: Automatically switch to new solver data when it arrives (even if CSV is active)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visualize Solver Results (Priority: P1)

After running the solver successfully, users navigate to the Visualizer tab and see their test schedule data automatically displayed in an interactive D3.js visualization. The visualization shows test schedules organized by project leg, with Gantt-style charts displaying start dates, end dates, and resource assignments.

**Why this priority**: This is the primary use case - visualizing solver output immediately after execution. It provides immediate value by allowing users to see their optimized schedule in a visual format without leaving the tool.

**Independent Test**: Can be tested independently by simulating solver completion and verifying that the visualizer component receives and displays the data correctly. Test involves mounting the integrated component with mock solver results and verifying the visualization renders.

**Alpine.js Component Requirements**:
- Self-contained component with `x-data` state management
- Reactive data binding that watches for solver results changes
- Automatic data transformation from solver format to visualization format
- Template-based visualization selection

**Acceptance Scenarios**:

1. **Given** the solver has completed successfully with results available, **When** the user navigates to the Visualizer tab, **Then** the visualization automatically displays the test schedule data from the solver results
2. **Given** solver results are available in the config editor state, **When** the visualizer component initializes, **Then** it receives the solver data and renders the default visualization template
3. **Given** the user is viewing a visualization, **When** new solver results become available (from a new solver run), **Then** the visualization updates automatically to show the new solver data, even if CSV data was previously active

---

### User Story 2 - Upload CSV Data for Visualization (Priority: P2)

Users can upload CSV files containing test schedule data to visualize historical or external data without running the solver. The uploaded CSV data is parsed and displayed in the same visualization interface, allowing users to compare different schedules or view archived results.

**Why this priority**: This provides flexibility for users who want to visualize data from previous solver runs or external sources. It's secondary to the primary solver integration but important for workflow completeness.

**Independent Test**: Can be tested independently by uploading a CSV file and verifying it's parsed correctly and displayed in the visualization. Test involves file upload interaction and data parsing validation.

**Acceptance Scenarios**:

1. **Given** the user is on the Visualizer tab, **When** they upload a CSV file containing test schedule data, **Then** the file is parsed and the visualization updates to display the CSV data
2. **Given** a CSV file has been uploaded, **When** the user switches visualization templates, **Then** the CSV data is displayed using the selected template
3. **Given** both solver results and CSV data are available, **When** the user uploads a CSV file, **Then** the visualization switches to display the CSV data with clear indication of active source, and users can switch back to solver data if desired

---

### User Story 3 - Select Visualization Templates (Priority: P3)

Users can select from multiple visualization templates (Gantt charts, equipment utilization, FTE utilization, concurrency charts) to view their data in different formats. The template selection persists across tab switches and data updates.

**Why this priority**: This enhances the visualization experience but is not critical for basic functionality. Users can still get value from the default visualization.

**Independent Test**: Can be tested independently by changing template selection and verifying the visualization re-renders with the new template. Test involves template dropdown interaction and visualization re-rendering.

**Acceptance Scenarios**:

1. **Given** data is loaded in the visualizer, **When** the user selects a different template from the dropdown, **Then** the visualization re-renders using the selected template
2. **Given** a template has been selected, **When** the user navigates away from the Visualizer tab and returns, **Then** the previously selected template is still active
3. **Given** multiple templates are available, **When** the user switches between templates, **Then** all templates correctly display the same underlying data

---

### Edge Cases

- What happens when solver results are incomplete or malformed? The visualizer should display an error message indicating the data format issue
- How does the system handle CSV files with missing required columns? The visualizer should validate CSV structure matches solver output format (test_schedules.csv) and show validation errors indicating which required columns are missing
- What happens when both solver results and CSV data are available? CSV upload initially displays CSV data, but users can switch between solver data and CSV data with clear indication of which data source is currently active
- How does the system handle very large datasets? The visualization should render without performance degradation for datasets up to 1000 test schedules (per SC-003). For datasets exceeding 1000 test schedules, pagination or filtering may be required
- What happens when the user uploads a CSV while solver is still running? The CSV data should be queued and applied once upload completes, but will be automatically replaced when new solver results arrive
- What happens when new solver results arrive while CSV data is being viewed? The visualization automatically switches to display the new solver data, replacing the CSV data view
- How does the system indicate progress during CSV upload and parsing? A loading indicator must be displayed during CSV file upload and parsing operations
- What happens when CSV files exceed 10MB? Files over 10MB are accepted but a warning message is displayed about potential performance issues
- How does the system handle date format variations in CSV files? The system should parse common date formats and show errors for unrecognized formats
- What happens when visualization code execution fails? Error messages should be displayed clearly. When JavaScript errors include stack traces with line numbers, these should be included in the error display to aid debugging. Line numbers are available when errors occur during template code execution (D3.js visualization code) but may not be available for runtime data errors

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST integrate the visualizer component into the Visualizer tab of config_editor.html (see plan.md for integration approach: embed as Alpine.js component using x-data directive)
- **FR-002**: System MUST automatically pass solver results data to the visualizer component when solver execution completes successfully
- **FR-003**: System MUST transform solver result data format to match the visualizer component's expected input format
- **FR-004**: System MUST provide CSV file upload functionality in the Visualizer tab as an alternative data source
- **FR-005**: System MUST parse uploaded CSV files using the same format as solver output CSV files (test_schedules.csv structure) and convert them to the visualizer component's expected data format
- **FR-006**: System MUST validate uploaded CSV files match the solver output CSV format and display validation errors when CSV files have incorrect structure or missing required columns
- **FR-007**: System MUST allow users to select visualization templates (Gantt charts, equipment utilization, FTE utilization, concurrency)
- **FR-008**: System MUST update visualizations automatically when new solver results become available, switching from CSV data to solver data if CSV was previously active
- **FR-009**: System MUST maintain visualization state (selected template, data source) when users switch between tabs
- **FR-010**: System MUST display clear error messages when visualization rendering fails
- **FR-011**: System MUST indicate which data source is currently active (solver results vs uploaded CSV) and allow users to switch between available data sources
- **FR-012**: System MUST handle cases where no data is available by showing an appropriate empty state message
- **FR-013**: System MUST display a loading indicator during CSV file upload and parsing operations
- **FR-014**: System MUST accept CSV files over 10MB but display a warning message about potential performance issues

### Key Entities *(include if feature involves data)*

- **Solver Results Data**: Contains test schedules, resource utilization, makespan, and solver statistics. Structure includes test_schedules array with test_id, project_leg_id, start_date, end_date, assigned_equipment, assigned_fte, and status information
- **CSV Schedule Data**: Alternative data format containing test schedule information. Uses the same CSV format as solver output files (test_schedules.csv structure). Must include columns matching solver output: test_id, project_leg_id, test_name, start_date, end_date, assigned_equipment, assigned_fte, and other solver output columns. Structure maps directly to solver results format for consistent visualization
- **Visualization Template**: Defines how data is rendered (Gantt chart, utilization charts, concurrency timeline). Each template contains D3.js code that transforms data into visual elements
- **Visualizer Component State**: Manages current data source (solver vs CSV), selected template, visualization code, and error state. Persists across tab navigation

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can visualize solver results within 2 seconds of solver completion without manual data transfer
- **SC-002**: CSV files upload and parse successfully in under 3 seconds for files up to 10MB. Files over 10MB are accepted with a performance warning
- **SC-003**: Visualization renders correctly for datasets containing up to 1000 test schedules without performance degradation
- **SC-004**: Users can switch between visualization templates in under 1 second without data loss
- **SC-005**: 95% of valid solver result datasets display correctly in the visualizer without errors
- **SC-006**: CSV validation errors are displayed within 1 second of upload attempt
- **SC-007**: Visualization state persists correctly when users navigate away and return to the Visualizer tab
- **SC-008**: Error messages clearly identify data format issues and provide actionable guidance

## Assumptions

- The visualizer component from visualizer.html can be adapted to work within the config_editor.html tab structure
- Solver results data structure matches the SolutionResult format with test_schedules, status, makespan_days, and resource_utilization fields
- CSV files uploaded for visualization use the exact same format as solver output CSV files (test_schedules.csv structure)
- D3.js and Alpine.js libraries are already loaded in config_editor.html (or can be added)
- The visualizer component's JavaScript files (visualization-component.js, legacy-templates.js, editor-setup.js) can be included in config_editor.html
- Users have basic familiarity with CSV file formats and can provide properly formatted files
- The visualization component's CSS (visualization.css) can be integrated without conflicts with config_editor.html styles

## Dependencies

- Existing visualizer component implementation (visualizer.html, visualization-component.js, legacy-templates.js)
- Solver API integration already implemented in config_editor.html
- D3.js library availability
- Alpine.js framework (already used in config_editor.html)
