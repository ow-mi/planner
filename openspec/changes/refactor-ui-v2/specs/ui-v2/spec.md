## ADDED Requirements

### Requirement: HTMX + Alpine Application Architecture
The UI SHALL be implemented as a component-oriented frontend in `ui_v2_exp/` using HTMX for fragment requests and Alpine.js for client-side state and interactivity.

#### Scenario: HTMX fragment loading with Alpine initialization
- **WHEN** a tab or route area loads component HTML via HTMX
- **THEN** the response SHALL be swapped using explicit `hx-target` and `hx-swap` behavior
- **AND** Alpine SHALL initialize newly swapped DOM using `Alpine.initTree(...)`

#### Scenario: Global Alpine store registration
- **WHEN** the page initializes
- **THEN** global stores SHALL be registered through `Alpine.store(...)` during `alpine:init`
- **AND** each store MAY use `init()` for persistence/bootstrap logic

#### Scenario: Loading indicators for async requests
- **WHEN** an HTMX request is in flight
- **THEN** request state SHALL surface through `hx-indicator`/`htmx-request` class behavior
- **AND** users SHALL see a visible loading indicator tied to that request scope

### Requirement: Seven-Tab Application Shell
The system SHALL provide the same seven top-level tabs as the legacy UI: Input Data, Edit Data, Configuration, Solver, Visualizer, Output Data, and Save.

#### Scenario: Tab navigation behavior
- **WHEN** a user selects a tab
- **THEN** the selected tab SHALL be marked active
- **AND** only that tab's content SHALL be visible
- **AND** tab content SHALL remain reactive with Alpine state

#### Scenario: Global error and busy feedback
- **WHEN** an application-level error occurs
- **THEN** an error banner SHALL display a clear message and dismissal control
- **AND** when long-running operations are active, a loading indicator SHALL be shown

### Requirement: CSV File Intake and Management
The system SHALL support CSV upload and management parity with the legacy Input Data workflow.

#### Scenario: Drag-and-drop and click upload
- **WHEN** a user drops CSV files into the upload area or selects files via file picker
- **THEN** files SHALL be parsed using PapaParse
- **AND** parsed file entries SHALL appear in the uploaded file list

#### Scenario: File list maintenance
- **WHEN** a user removes an uploaded file
- **THEN** both metadata and parsed data for that file SHALL be removed from store state
- **AND** downstream selectors dependent on that file SHALL update safely

### Requirement: Editable CSV Data Grid
The system SHALL provide a data editor for viewing and editing uploaded CSV content.

#### Scenario: Select and display uploaded CSV
- **WHEN** at least one CSV file exists
- **THEN** the user SHALL be able to choose the active CSV from a selector
- **AND** rows and headers SHALL render in an editable table

#### Scenario: Edit persistence
- **WHEN** a user modifies cells and saves changes
- **THEN** updated rows SHALL persist back into file store state
- **AND** unsaved-change indicators SHALL reset after successful save

#### Scenario: Empty-state handling
- **WHEN** no CSV files are uploaded
- **THEN** the editor SHALL display guidance to upload files first

### Requirement: Full Configuration Editor Parity
The Configuration tab SHALL carry over all legacy configuration controls and behaviors.

#### Scenario: JSON configuration import and removal
- **WHEN** a user uploads or drops a JSON config file
- **THEN** configuration fields SHALL populate from JSON
- **AND** the uploaded config reference SHALL be removable from UI state

#### Scenario: Mode, description, and weight controls
- **WHEN** the user edits mode/description/objective weights
- **THEN** values SHALL update store state in real time
- **AND** weight validation SHALL enforce makespan + priority equals 1.0

#### Scenario: Section toggles
- **WHEN** a config subsection is disabled
- **THEN** associated inputs SHALL be disabled and visually dimmed
- **AND** disabled sections SHALL not contribute to generated optional config blocks

#### Scenario: Leg deadlines editor
- **WHEN** a user adds or removes leg deadline rows
- **THEN** each row SHALL support editable leg ID and date fields
- **AND** resulting `leg_deadlines` output SHALL reflect current rows

#### Scenario: Penalty settings editor
- **WHEN** a user edits penalty controls
- **THEN** the UI SHALL support deadline penalty, compactness penalty, and parallel-within-deadlines options
- **AND** these values SHALL be emitted in generated configuration when enabled

#### Scenario: Proximity rules editor
- **WHEN** a user adds/removes proximity patterns and edits proximity fields
- **THEN** pattern arrays and related rule values SHALL remain synchronized in generated config

#### Scenario: Config export utilities
- **WHEN** the user opens generated output
- **THEN** JSON SHALL appear in a read-only output panel
- **AND** copy-to-clipboard and reset-to-default actions SHALL be available

### Requirement: Solver Execution and Status Tracking
The Solver tab SHALL execute scheduling runs and expose parity status feedback.

#### Scenario: Solver request composition
- **WHEN** a user starts solver execution
- **THEN** request payload SHALL include CSV inputs, active priority configuration, and solver runtime options
- **AND** network calls SHALL be routed through the shared API service layer

#### Scenario: Status polling and progress updates
- **WHEN** a solver run is active
- **THEN** status SHALL update through periodic polling using HTMX trigger timing or equivalent fixed interval
- **AND** UI SHALL show progress percentage, current status message, and elapsed time

#### Scenario: Completion and failure outcomes
- **WHEN** solver status resolves to completed
- **THEN** results SHALL be stored and success UI with results navigation SHALL display
- **WHEN** solver status resolves to failed or timeout
- **THEN** an actionable error panel SHALL display and allow retry

### Requirement: Visualization Templates and Code Editing
The Visualizer tab SHALL preserve legacy charting capabilities and template editing workflows.

#### Scenario: Legacy template availability
- **GIVEN** templates `gantt-tests`, `equipment`, `fte`, and `concurrency`
- **WHEN** a user selects a template
- **THEN** the corresponding template code SHALL load from defaults or local overrides

#### Scenario: Data source switching
- **WHEN** a user switches between Solver and CSV data sources
- **THEN** UI controls SHALL adapt for that source
- **AND** charts SHALL render using transformed data compatible with legacy template expectations

#### Scenario: Code editor workflow
- **WHEN** a user toggles code editor visibility
- **THEN** a split layout with CodeMirror editor and chart pane SHALL be available
- **AND** template edits SHALL autosave to localStorage
- **AND** editor-hidden mode SHALL return to full-width chart layout

#### Scenario: Render execution safety and diagnostics
- **WHEN** visualization code execution fails
- **THEN** the UI SHALL display a clear error message with line context when available
- **AND** the app SHALL remain responsive for retry after fixes

### Requirement: Output Viewer and Downloads
The Output Data tab SHALL provide parity output review and download behavior.

#### Scenario: Results summary
- **WHEN** solver results are available
- **THEN** summary fields SHALL display status, makespan, solve time, and objective value when present

#### Scenario: File downloads
- **WHEN** a user chooses an output file download
- **THEN** that file SHALL download individually
- **AND** users SHALL be able to download all outputs as a ZIP archive

#### Scenario: No-results empty state
- **WHEN** no solver results exist
- **THEN** the output view SHALL instruct users to run solver first

### Requirement: Save Tab Export Workflow
The Save tab SHALL provide export actions needed to preserve user outputs in the refactored UI.

#### Scenario: Save tab export actions
- **WHEN** the user opens the Save tab
- **THEN** configuration export SHALL be available
- **AND** any session-level artifacts defined in the parity matrix SHALL be downloadable from this tab or clearly linked

### Requirement: Responsive and Usability Baseline
The refactored UI SHALL remain usable across desktop and smaller viewports.

#### Scenario: Narrow viewport behavior
- **WHEN** viewport width is constrained
- **THEN** tab navigation SHALL remain usable (including horizontal scrolling if required)
- **AND** major form layouts SHALL reflow without losing access to controls

#### Scenario: Alpine render stability
- **WHEN** Alpine-controlled elements start hidden by default
- **THEN** `x-cloak` handling SHALL prevent visible pre-initialization flicker

#### Scenario: Keyboard operability
- **WHEN** users navigate with keyboard only
- **THEN** interactive controls SHALL remain focusable with visible focus feedback
