 ## Implementation Tasks

 ## 1. Planning and Parity Baseline
 - [x] 1.1 Audit legacy UI features from `ui/config_editor.html` and `ui/js/*`
 - [x] 1.2 Audit current `ui_v2_exp/` implementation and identify parity gaps
 - [x] 1.3 Capture HTMX + Alpine guidance from docs-mcp-server for architecture decisions
 - [x] 1.4 Publish a feature parity matrix (legacy feature -> v2 file -> test case)
 - [x] 1.5 Record task completion in tasks.md

 ## 2. Architecture Alignment (HTMX + Alpine)
 - [x] 2.1 Normalize bootstrap in `ui_v2_exp/index.html`
   - [x] Use HTMX-driven fragment loading (remove mixed manual-fetch bootstrap path)
   - [x] Upgrade and pin HTMX to 2.x
   - [x] Keep `htmx.onLoad` + `Alpine.initTree(...)` integration
   - [x] Apply `x-cloak` CSS to prevent Alpine flicker
 - [x] 2.2 Standardize request UX patterns
   - [x] Use `hx-indicator`/`htmx-request` for async visual feedback
   - [x] Ensure active requests disable relevant controls
 - [x] 2.3 Enforce store initialization patterns
   - [x] Register stores inside `alpine:init`
   - [x] Use store `init()` methods for persistence/bootstrap

 ## 3. Close Legacy Feature Parity Gaps
 - [x] 3.1 Complete Configuration Editor parity (`components/config-editor.html` + `stores/configStore.js`)
   - [x] Add leg deadlines section with add/remove rows
   - [x] Add full penalty settings (including compactness penalty field)
   - [x] Add proximity rule patterns editor with add/remove rows
   - [x] Keep weight-sum validation and section enable/disable behavior
 - [x] 3.2 Complete Visualizer parity (`components/visualizer.html` + `stores/visualizationStore.js`)
   - [x] Add CodeMirror editor toggle and split/full layout behavior
   - [x] Load/store template code per template in localStorage
   - [x] Preserve all legacy templates: gantt-tests, equipment, fte, concurrency
   - [x] Fix render execution contract (`container` wiring) and show actionable error messages
 - [x] 3.3 Complete Data Editor parity (`components/data-editor.html`)
   - [x] Fix unsaved-change tracking behavior
   - [x] Ensure row selection + delete behavior is functional
   - [x] Add visual selection indicator for selected rows
 - [x] 3.4 Complete Solver integration parity (`components/solver-controls.html` + `stores/solverStore.js`)
   - [x] Route solver network calls through `apiService`
   - [x] Keep progress + elapsed-time UX
   - [x] Use HTMX polling trigger pattern for status endpoint updates
 - [x] 3.5 Complete Save/Export flow (`components/main-app.html`)
   - [x] Ensure Save tab exports the generated config and current session artifacts needed by users
   - [x] Add export of entire session (JSON)
   - [x] Add solver results export (ZIP and individual files)
   - [x] Add configuration import and session clear functionality

  ## 4. Verification and Quality Gates
  - [x] 4.1 Add parity regression checks for each legacy workflow
    - [x] File upload + CSV parse/edit
    - [x] Config import/edit/export
    - [x] Solver run -> status -> results
    - [x] Visualization from solver data and CSV data
    - [x] Output file downloads (single + ZIP)
  - [x] 4.2 Validate responsive behavior (mobile/tablet/desktop)
  - [x] 4.3 Validate keyboard focus order and tab interactions
  - [x] 4.4 Run `openspec validate refactor-ui-v2 --strict`

 ## 5. Release Readiness
 - [ ] 5.1 Sign off parity matrix with stakeholders
 - [ ] 5.2 Document migration cutover steps from `ui/` to `ui_v2_exp/`
 - [ ] 5.3 Cutover only after all parity and verification tasks are complete
