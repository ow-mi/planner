# Feature Parity Matrix: Legacy UI vs ui_v2_exp

## Overview

This document maps every legacy feature from `ui/config_editor.html` to its v2 equivalent in `ui_v2_exp/` with test cases.

## Legend

| Status | Meaning |
|--------|---------|
| ✅ Full Parity | Feature fully implemented and tested |
| ⚠️ Partial Parity | Feature exists but has gaps or limitations |
| ❌ Missing | Feature not yet implemented |
| 🔄 Planned | Feature planned but not yet implemented |

## 1. Application Shell (7-Tab Navigation)

| Legacy Feature | v2 Component | Status | Test Case |
|----------------|--------------|--------|-----------|
| 7-tab navigation (Input Data, Edit Data, Configuration, Solver, Visualizer, Output Data, Save) | `main-app.html` | ✅ Full Parity | Navigation works with tab switching and active state styling |

## 2. Input Data (CSV Upload & Management)

| Legacy Feature | v2 Component | Status | Test Case |
|----------------|--------------|--------|-----------|
| CSV file drag & drop upload | `file-upload.html` | ✅ Full Parity | Drag CSV files onto upload area, verify file list appears |
| CSV file picker upload | `file-upload.html` | ✅ Full Parity | Click upload area, select files via dialog, verify list updates |
| File list display with name & remove control | `file-upload.html` | ✅ Full Parity | Check uploaded files list shows all files with remove buttons |
| File removal (single) | `fileStore.js` | ✅ Full Parity | Click remove on a file, verify it's removed from list and store |
| File removal (all) | `fileStore.js` | ✅ Full Parity | Call `clearAllFiles()`, verify all files removed |
| CSV parsing with PapaParse | `fileStore.js` | ✅ Full Parity | Parse uploaded CSV, verify headers and rows stored correctly |
| Error handling for invalid CSV | `fileStore.js` | ✅ Full Parity | Upload malformed CSV, verify error message displayed |
| localStorage persistence for files | `fileStore.js` | ✅ Full Parity | Upload files, refresh page, verify files persist |

## 3. Edit Data (CSV editor)

| Legacy Feature | v2 Component | Status | Test Case |
|----------------|--------------|--------|-----------|
| CSV selector dropdown | `data-editor.html` | ✅ Full Parity | Select from uploaded files dropdown |
| Editable data grid | `data-editor.html` | ✅ Full Parity | Edit cell values in table, verify changes visible |
| Save changes | `data-editor.html` | ⚠️ Partial Parity | Save button updates store, but no unsaved-change indicator visible |
| Add new row | `data-editor.html` | ❌ Missing | Button exists in UI but row add does not persist correctly |
| Remove selected row | `data-editor.html` | ⚠️ Partial Parity | Remove button exists but row selection tracking not working |
| Empty state guidance | `data-editor.html` | ✅ Full Parity | Shows "upload CSV files first" message when no files exist |

## 4. Configuration Editor

| Legacy Feature | v2 Component | Status | Test Case |
|----------------|--------------|--------|-----------|
| JSON config file upload/drop | `config-editor.html` | ✅ Full Parity | Upload JSON file, verify fields populate |
| JSON config remove reference | `configStore.js` | ✅ Full Parity | Remove uploaded JSON reference from UI |
| Mode selection dropdown | `config-editor.html` | ✅ Full Parity | Select modes (leg_end_dates, leg_priority, etc.) |
| Description textarea | `config-editor.html` | ✅ Full Parity | Edit description, verify store updates |
| Makespan weight input | `config-editor.html` | ✅ Full Parity | Edit makespan weight, verify validation |
| Priority weight input | `config-editor.html` | ✅ Full Parity | Edit priority weight, verify validation |
| Weight-sum validation (must equal 1.0) | `config-editor.html` | ✅ Full Parity | Weights not summing to 1.0 show error message |
| Section toggle: Basic (mode/description/weights) | `configStore.js` | ✅ Full Parity | Disable section, inputs dim and are disabled |
| Section toggle: Weights | `configStore.js` | ✅ Full Parity | Disable section, weight inputs disabled |
| **Leg deadlines editor (add/remove rows)** | `configStore.js` + `config-editor.html` | ❌ Missing | Store has methods but UI lacks row management controls |
| **Full penalty settings (deadline penalty field)** | `configStore.js` | ⚠️ Partial Parity | Store has deadline_penalty_per_day but no UI control |
| **Proximity rules editor (add/remove patterns)** | `configStore.js` | ⚠️ Partial Parity | Store has methods but UI lacks pattern row management |
| Weight-sum validation (makespan + priority = 1.0) | `config-editor.html` | ✅ Full Parity | UI shows validation error when sum ≠ 1.0 |
| Config output display (read-only JSON) | `config-editor.html` | ✅ Full Parity | Generated config shown in read-only textarea |
| Copy to clipboard | `configStore.js` | ✅ Full Parity | Copy button copies config JSON |
| Reset to defaults | `configStore.js` | ✅ Full Parity | Reset button restores default values |

### Configuration Editor Gaps Summary

| Gap | Location | Fix Required |
|-----|----------|--------------|
| Leg deadlines UI rows | `components/config-editor.html` | Add table with add/remove row controls |
| Penalty settings UI controls | `components/config-editor.html` | Add input for deadline_penalty_per_day |
| Proximity rules UI rows | `components/config-editor.html` | Add table with pattern rows, remove add/remove controls |
| Penalty settings section toggle | `components/config-editor.html` | Add section enable/disable toggle |
| Proximity rules section toggle | `components/config-editor.html` | Add section enable/disable toggle |

## 5. Solver Execution & Status Tracking

| Legacy Feature | v2 Component | Status | Test Case |
|----------------|--------------|--------|-----------|
| Solver execution request | `solverControls.html` + `solverStore.js` | ❌ Missing API Integration | Store makes direct `fetch()` calls instead of using `apiService` |
| Time limit configuration | `solverControls.html` | ✅ Full Parity | Time limit input bound to store config |
| Debug level selection | `solverControls.html` | ✅ Full Parity | Debug level dropdown bound to store config |
| Output folder input | `solverControls.html` | ⚠️ Partial Parity | Output folder field exists, but may not be passed correctly |
| Solver request composition | `solverStore.js` | ❌ Missing API Integration | Request built inline instead of using `apiService` |
| Progress percentage display | `solverControls.html` | ✅ Full Parity | Progress bar updates during execution |
| Status message display | `solverControls.html` | ✅ Full Parity | Status message updates during execution |
| Elapsed time display | `solverControls.html` | ✅ Full Parity | Elapsed time counter updates during execution |
| Solver completion UI | `solverControls.html` | ✅ Full Parity | Success banner with results link appears |
| Solver failure UI | `solverControls.html` | ✅ Full Parity | Error banner with message and guidance |
| **HTMX polling trigger pattern** | `solverControls.html` | ❌ Missing | Current implementation uses `setTimeout()` polling instead of HTMX `hx-trigger="every"` |

### Solver Integration Gaps Summary

| Gap | Location | Fix Required |
|-----|----------|--------------|
| Direct fetch() calls | `solverStore.js` | Replace with `apiService` method calls for all API endpoints |
| HTMX polling | `solverControls.html` | Replace `setTimeout()` polling with `hx-trigger="every N"` and HTMX status indicators |
| Progress indicator | `solverControls.html` | Add `hx-indicator` to solver run button to show loading state |
| Active control disabling | `solverControls.html` | Disable solver controls when isRunning using: `:disabled="isRunning"` |

## 6. Visualization Templates & Code Editing

| Legacy Feature | v2 Component | Status | Test Case |
|----------------|--------------|--------|-----------|
| Template selection dropdown | `visualizer.html` | ✅ Full Parity | Select template from dropdown (gantt-tests, equipment, fte, concurrency) |
| Gantt-tests template | `ui/js/legacy-templates.js` | ⚠️ Partial Parity | Template exists but may need testing with v2 data format |
| Equipment template | `ui/js/legacy-templates.js` | ⚠️ Partial Parity | Template exists but may need testing with v2 data format |
| FTE template | `ui/js/legacy-templates.js` | ⚠️ Partial Parity | Template exists but may need testing with v2 data format |
| Concurrency template | `ui/js/legacy-templates.js` | ⚠️ Partial Parity | Template exists but may need testing with v2 data format |
| Solver data source | `visualizer.html` + `visualizationStore.js` | ✅ Full Parity | Switch to Solver source, visualize solver results |
| CSV data source | `visualizer.html` + `visualizationStore.js` | ✅ Full Parity | Upload CSV, switch to CSV source, visualize CSV data |
| Template code editor toggle | `visualizer.html` | ❌ Missing | Code editor toggle button not present in UI |
| **Split/full layout behavior** | `visualizer.html` | ❌ Missing | No layout switching between split editor + chart and full chart |
| **CodeMirror integration** | `visualizer.html` | ❌ Missing | CodeMirror editor not initialized or used |
| Template code localStorage persistence | `visualizationStore.js` | ⚠️ Partial Parity | Code saves to localStorage but editor not connected to load/save |
| **Render execution safety** | `visualizationStore.js` | ⚠️ Partial Parity | Error handling exists but needs better `container` wiring and actionable error messages |
| Error display with line number | `visualizer.html` | ⚠️ Partial Parity | Error section exists but may not show actionable guidance |

### Visualization Gaps Summary

| Gap | Location | Fix Required |
|-----|----------|--------------|
| Code editor toggle button | `components/visualizer.html` | Add toggle button to show/hide code editor |
| Split/full layout | `components/visualizer.html` + CSS | Implement flexbox layout: split when editor visible, full chart when hidden |
| CodeMirror initialization | `assets/js/stores/visualizationStore.js` | Connect CodeMirror editor to `initEditor()` method and set up onChange handler |
| Container wiring | `assets/js/stores/visualizationStore.js:217` | Fix `runCode()` to properly pass `container` element to template execution |
| Error diagnostics | `assets/js/stores/visualizationStore.js` | Improve error stack parsing to show line number and context in UI |

## 7. Output Data Viewer

| Legacy Feature | v2 Component | Status | Test Case |
|----------------|--------------|--------|-----------|
| Execution status display | `output-viewer.html` | ❌ Missing | Output viewer component exists but content is minimal |
| Makespan display | `output-viewer.html` | ❌ Missing | No makespan field visible |
| Solve time display | `output-viewer.html` | ❌ Missing | No solve time field visible |
| Objective value display | `output-viewer.html` | ❌ Missing | No objective value field visible |
| Solver results summary | `output-viewer.html` | ❌ Missing | Results summary section not populated |
| Single file download | `solverStore.js` | ⚠️ Partial Parity | `downloadSingleFile()` exists but tied to solver store |
| ZIP download | `solverStore.js` | ⚠️ Partial Parity | `downloadAllResults()` exists but tied to solver store |
| No-results empty state guidance | `output-viewer.html` | ❌ Missing | No "run solver first" message |

## 8. Save Tab Export Flow

| Legacy Feature | v2 Component | Status | Test Case |
|----------------|--------------|--------|-----------|
| Configuration export to JSON | `main-app.html` | ✅ Full Parity | Export button generates JSON config |
| Configuration copy to clipboard | `main-app.html` | ✅ Full Parity | Copy button copies exported config |
| Exported config display (read-only) | `main-app.html` | ✅ Full Parity | Exported config shown in readonly textarea |

## 9. Architecture & Patterns

| Legacy Feature | v2 Component | Status | Test Case |
|----------------|--------------|--------|-----------|
| HTMX for fragment loading | `ui_v2_exp/index.html` | ❌ Missing | No HTMX fragment loading; all components initialized inline |
| HTMX fragment swap behavior | `ui_v2_exp/index.html` | ❌ Missing | No `hx-target` or `hx-swap` behavior |
| HTMX 2.x usage | `ui_v2_exp/index.html` | ❌ Missing | HTMX version not specified or updated |
| Alpine store registration | `*/stores/*.js` | ✅ Full Parity | Stores registered under `alpine:init` with `Alpine.store()` |
| `x-cloak` CSS handling | `ui_v2_exp/index.html` | ❌ Missing | No `x-cloak` applied to prevent Alpine flicker |
| `hx-indicator` pattern | `ui_v2_exp/components/*.html` | ❌ Missing | No loading indicators tied to HTMX requests |
| `htmx-request` class behavior | `ui_v2_exp/components/*.html` | ❌ Missing | No visual feedback during async requests |

### Architecture Gaps Summary

| Gap | Location | Fix Required |
|-----|----------|--------------|
| HTMX bootstrap | `ui_v2_exp/index.html` | Replace inline component initialization with HTMX fragment loading |
| HTMX 2.x update | `ui_v2_exp/index.html` | Upgrade HTMX to 2.x and update initialization |
| `x-cloak` CSS | `ui_v2_exp/assets/css/base.css` | Add `.x-cloak { display: none; }` CSS rule |
| HTMX fragment loading | `ui_v2_exp/index.html` | Replace document-ready component init with HTMX `hxget` calls |
| `hx-indicator` pattern | `ui_v2_exp/components/*.html` | Add `hx-indicator` attribute to interactive controls |
| `htmx-request` controls | `ui_v2_exp/components/*.html` | Disable controls when `.htmx-request` class is active |

## Priority Fix Order

Based on blocking parity gaps, prioritize fixes in this order:

### Critical (Block Release)
1. **3.1** - Complete Configuration Editor parity (leg deadlines, penalty settings, proximity rules)
2. **3.2** - Complete Visualizer parity (CodeMirror toggle, split/full layout, render safety)
3. **3.4** - Complete Solver integration parity (apiService routing, HTMX polling)
4. **2.x** - Normalize HTMX + Alpine patterns (bootstrap, x-cloak, hx-indicator)

### High (Quality Gate)
5. **4.1** - Parity regression checks for all workflows
6. **3.3** - Data Editor parity (unsaved-change tracking, row selection)

### Medium (Polish)
7. **7.1-7.3** - Output viewer implementation
8. **4.2-4.3** - Responsive and keyboard accessibility
