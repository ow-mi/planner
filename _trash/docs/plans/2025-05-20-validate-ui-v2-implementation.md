# UI v2 Implementation Validation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Validate that all UI v2 implementation tasks are complete and functioning correctly, identifying any issues in the new directory structure.

**Architecture:** Create a validation plan that systematically checks each completed task against the original requirements, verifies file modifications, and identifies any missing functionality or issues.

**Tech Stack:** HTMX 2.x, Alpine.js, PapaParse, CodeMirror

---

## Implementation Checklist

### Task 1: Verify HTMX Bootstrap and Architecture

**Files:**
- Check: `ui_v2_exp/index.html`
- Check: `ui_v2_exp/assets/css/base.css`
- Test: Validate HTMX 2.x is being used and x-cloak is functioning

**Step 1: Verify HTMX version in index.html**

Check that the HTMX script tag uses version 2.x:

```bash
grep -n "htmx" ui_v2_exp/index.html | head -5
```

Expected: HTMX 2.x version in script tag

**Step 2: Verify x-cloak CSS rule in base.css**

Check that x-cloak CSS rule exists:

```bash
grep -n "x-cloak" ui_v2_exp/assets/css/base.css
```

Expected: `.x-cloak { display: none; }` rule present

**Step 3: Verify x-cloak attributes in components**

Check that Alpine components use x-cloak:

```bash
grep -r "x-cloak" ui_v2_exp/components/
```

Expected: x-cloak attribute on Alpine elements

**Step 4: Run live test**

Open `ui_v2_exp/index.html` in browser and verify:
- No flickering content on load (x-cloak working)
- HTMX fragments load correctly
- Alpine stores initialize properly

---

### Task 2: Verify Solver Integration (Task 3.4)

**Files:**
- Check: `ui_v2_exp/assets/js/stores/solverStore.js`
- Check: `ui_v2_exp/components/solver-controls.html`
- Test: Validate API service routing is working

**Step 1: Verify solverStore uses apiService**

```bash
grep -n "apiService" ui_v2_exp/assets/js/stores/solverStore.js
```

Expected: All network calls use `window.apiService` instead of direct fetch

**Step 2: Verify solver-controls has hx-indicator**

```bash
grep -n "hx-indicator" ui_v2_exp/components/solver-controls.html
```

Expected: hx-indicator attributes on solver buttons

---

### Task 3: Verify Configuration Editor Parity (Task 3.1)

**Files:**
- Check: `ui_v2_exp/components/config-editor.html`
- Check: `ui_v2_exp/assets/js/stores/configStore.js`

**Step 1: Verify leg deadlines section**

```bash
grep -n "legDeadline" ui_v2_exp/components/config-editor.html | head -5
```

Expected: Leg deadlines section with add/remove rows

**Step 2: Verify penalty settings section**

```bash
grep -n "penalty" ui_v2_exp/components/config-editor.html | head -10
```

Expected: Compactness penalty and other penalty settings

**Step 3: Verify proximity rules section**

```bash
grep -n "proximity" ui_v2_exp/components/config-editor.html | head -5
```

Expected: Proximity rules editor with add/remove rows

---

### Task 4: Verify Data Editor Parity (Task 3.3)

**Files:**
- Check: `ui_v2_exp/components/data-editor.html`
- Check: `ui_v2_exp/assets/js/stores/fileStore.js`

**Step 1: Verify unsaved-change tracking**

```bash
grep -n "hasChanges\|originalData" ui_v2_exp/components/data-editor.html
```

Expected: hasChanges function that compares current and original data

**Step 2: Verify row selection functionality**

```bash
grep -n "selectedRowIndex\|selectRow" ui_v2_exp/components/data-editor.html
```

Expected: selectRow function and selectedRowIndex state

**Step 3: Verify Remove Selected Row button**

```bash
grep -n "Remove Selected Row" ui_v2_exp/components/data-editor.html
```

Expected: Button disabled when no row selected (checked !== -1)

---

### Task 5: Verify Visualizer Parity (Task 3.2)

**Files:**
- Check: `ui_v2_exp/components/visualizer.html`
- Check: `ui_v2_exp/assets/js/stores/visualizationStore.js`

**Step 1: Verify CodeMirror toggle**

```bash
grep -n "CodeMirror\|showEditor" ui_v2_exp/components/visualizer.html
```

Expected: Toggle button for CodeMirror editor

**Step 2: Verify x-cloak attribute**

```bash
grep -n "x-cloak" ui_v2_exp/components/visualizer.html
```

Expected: x-cloak attribute on Alpine elements

---

### Task 6: Verify Save/Export Flow (Task 3.5)

**Files:**
- Check: `ui_v2_exp/components/main-app.html`

**Step 1: Verify configuration export**

```bash
grep -n "downloadConfig\|exportConfig" ui_v2_exp/components/main-app.html
```

Expected: Download button for configuration JSON

**Step 2: Verify session export**

```bash
grep -n "exportSession\|session" ui_v2_exp/components/main-app.html
```

Expected: Session export functionality

**Step 3: Verify solver results export**

```bash
grep -n "solverResults\|ZIP" ui_v2_exp/components/main-app.html
```

Expected: Solver results export options

---

### Task 7: Verify File Store Integration

**Files:**
- Check: `ui_v2_exp/assets/js/stores/fileStore.js`

**Step 1: Verify CSV upload functionality**

```bash
grep -n " PapaParse\|csv" ui_v2_exp/assets/js/stores/fileStore.js | head -10
```

Expected: CSV upload with PapaParse

**Step 2: Verify data import/export**

```bash
grep -n "importData\|exportData" ui_v2_exp/assets/js/stores/fileStore.js
```

Expected: Data import and export functions

---

### Task 8: Verify Store Initialization Patterns

**Files:**
- Check: `ui_v2_exp/index.html` (alpine:init section)

**Step 1: Verify all stores registered**

```bash
grep -A 20 "alpine:init" ui_v2_exp/index.html | grep -n "Alpine.store"
```

Expected: configStore, fileStore, solverStore, visualizationStore all registered

**Step 2: Verify init() methods exist**

```bash
grep -n "init()" ui_v2_exp/assets/js/stores/*.js
```

Expected: init() methods in all stores

---

### Task 9: Final Validation

**Files:**
- Run: `openspec validate refactor-ui-v2 --strict`

**Step 1: Run validation**

```bash
openspec validate refactor-ui-v2 --strict
```

Expected: Validation passes without errors

**Step 2: Check for console errors**

Open `ui_v2_exp/index.html` in browser and check developer console for errors.

**Step 3: Verify all tasks.md items**

```bash
grep "^\- \[x\]" openspec/changes/refactor-ui-v2/tasks.md
```

Expected: All completed tasks marked with [x]
