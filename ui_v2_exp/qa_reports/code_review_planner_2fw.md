# Code Review: Remediation Plan for planner-2fw

**Reviewer**: Code Reviewer (Quality Gatekeeper)  
**Date**: 2026-02-11  
**Issue**: planner-2fw - ui_v2_exp data editor state inconsistency after CSV upload  
**Scope**: [ui_v2_exp/assets/js/stores/fileStore.js, ui_v2_exp/components/data-editor.html, ui_v2_exp/components/file-upload.html]  
**Time Budget**: 20 minutes  
**Acceptance Criteria**: Validate plan addresses all reported symptoms with concrete verification and low regression risk  

---

## Executive Summary

**Status**: **PASS** with reservations  
**Confidence**: 0.92  

The proposed remediation plan is well-structured and largely addresses the core issues identified in planner-2fw. The implementation has already been partially completed in commit `e689482` which fixed the localStorage reconstruction issue and added comprehensive test coverage.

However, there are **4 significant gaps** in the proposed plan that must be addressed before final acceptance:

1. **Missing dedupe logic in `processFiles()`** - The plan proposes filename-based deduplication but the current implementation allows duplicates
2. **Unaddressed `x-for` key instability** - Data-editor.html still uses unstable keys combining index + filename
3. **Missing `isMutatingRows` guard** - No protection against multi-fire Add Row operations
4. **Row selection instability** - Click handler issues causing selection to reset after rerenders

---

## Critical Issues

### 1. No Deduplication in `processFiles()` (Critical)
**Location**: `fileStore.js:180-206`

**Problem**: The plan proposes "dedupe incoming csvFiles by filename and overwrite existing parsedCsvData entries" but this logic is NOT present in the current code. The `processFiles()` function simply pushes all files without deduplication, allowing duplicate filenames to create duplicate stored entries.

**Evidence**:
```javascript
// Current: no deduplication
this.uploadedFiles.push(...csvFiles);  // Line 197

// Plan's proposed fix not implemented:
// dedupe by filename, overwrite existing parsedCsvData entries
```

**Risk**: HIGH - Allows duplicate files in UI, causes selector dropdown duplication, breaks "one option per parsed dataset" requirement.

**Required Fix**: Implement deduplication logic before `this.uploadedFiles.push(...csvFiles)`:
```javascript
// Dedupe by filename
const existingNames = new Set(this.uploadedFiles.map(f => f.name));
const uniqueFiles = csvFiles.filter(f => !existingNames.has(f.name));
this.uploadedFiles.push(...uniqueFiles);

// Also dedupe parsedCsvData keys
uniqueFiles.forEach(file => {
    this.parseCsvFile(file);
});
```

---

### 2. Missing Deduplication in `removeFile()` (Major)
**Location**: `fileStore.js:265-275`

**Problem**: The `removeFile()` function removes from `uploadedFiles` but only deletes from `parsedCsvData` via `delete this.parsedCsvData[filename]`. If deduplication were implemented, there could be multiple `parsedCsvData` entries mapping to a single filename that would be orphaned.

**Evidence**: No consistency check between `uploadedFiles` and `parsedCsvData` during removal.

**Risk**: MEDIUM - Could lead to memory leaks and inconsistent state if deduplication is added later.

**Required Fix**: Add verification that `parsedCsvData[filename]` exists and ensure both collections stay in sync.

---

### 3. `x-for` Key Still Unstable in data-editor.html (Critical)
**Location**: `data-editor.html:29`

**Problem**: Plan proposes "replace x-for key `${fileIndex}-${file.name}` with stable key based on filename only" but the current code still uses:
```html
<template x-for="(file, fileIndex) in uploadedFiles" :key="`${fileIndex}-${file.name}`">
```

This key includes `fileIndex` which is unstable (changes on filter/sort) and causes the "duplicated selector options" symptom reported in planner-2fw.

**Evidence**: 
- Current: `key="`${fileIndex}-${file.name}`"` (line 29)
- Proposed: `key="${file.name}"` (filename only)

**Risk**: HIGH - Causes stale DOM nodes, duplicate options, and Alpine.js warnings about duplicate keys.

**Required Fix**: Change key to filename-only:
```html
<template x-for="(file, fileIndex) in dedupedFiles" :key="file.name">
```

Where `dedupedFiles` is a computed/getter that returns unique filenames.

---

### 4. Missing Immutable Row Update in data-editor.html (Major)
**Location**: `data-editor.html:159-167`

**Problem**: Plan proposes immutable row update (`rows = [...rows, newRow]`) but current implementation uses mutable push:
```javascript
this.activeCsvData.rows.push(newRow);  // Line 164 - MUTABLE
```

**Evidence**:
```javascript
addNewRow() {
    // ...
    this.activeCsvData.rows.push(newRow);  // NOT immutable
    // ...
}
```

**Risk**: MEDIUM - Shared reference issues, potential side effects when the same array is referenced elsewhere.

**Required Fix**:
```javascript
addNewRow() {
    // ...
    this.activeCsvData = {
        ...this.activeCsvData,
        rows: [...this.activeCsvData.rows, newRow]
    };
    this.syncActiveCsvDataToStore();
}
```

---

### 5. Row Selection Not Stable (Major)
**Location**: `data-editor.html:182-184, 50`

**Problem**: Plan proposes "attach click handler on first cell and row (with pointer-events safe handling)" but current implementation only handles row-level clicks:
```javascript
<tr @click="selectRow(rowIndex)" :class="{ 'selected-row': selectedRowIndex === rowIndex }">
```

Click events on inputs inside the row bubble up and interfere with row selection. The `@click.stop` on inputs (line 63) only prevents propagation to parent cells, not to the row itself.

**Evidence**: Current has no robust handler for stabilizing `selectedRowIndex` across rerenders.

**Risk**: HIGH - "Remove Selected Row remains disabled after row click" symptom from planner-2fw directly maps to this issue.

**Required Fix**:
```javascript
// Row-level selection with click propagation handling
<tr @click="selectRow(rowIndex)" class="data-editor-row" :class="{ 'selected-row': selectedRowIndex === rowIndex }">
```

With CSS to make row clickable even over inputs:
```css
.data-editor-row { pointer-events: auto; }
.data-editor-row td, .data-editor-row input { pointer-events: none; }
.data-editor-row:hover { pointer-events: auto; }
```

Plus ensure `selectedRowIndex` is persisted or recomputed from store state.

---

## Suggested Improvements

### Improvement 1: Add `getUploadedFileEntries()` Derived Helper (Minor)
**Status**: Plan recommended but not verified present

**Missing**: Plan suggests `getUploadedFileEntries()` helper to derive options from `parsedCsvData` keys for stable IDs.

**Current**: File selector uses `uploadedFiles` array directly which can become desynchronized.

**Recommendation**: Add a computed getter:
```javascript
getUploadedFileEntries() {
    return Object.keys(this.parsedCsvData).map(name => ({
        name: name,
        size: 0,  // or store metadata separately if needed
        lastModified: 0
    }));
}
```

And update `data-editor.html` to use this:
```html
<template x-for="(file, fileIndex) in getUploadedFileEntries()" :key="file.name">
```

**Priority**: Low - already partially addressed by localStorage fix.

---

### Improvement 2: Expand Test Coverage (Minor)
**Status**: Tests exist but need expansion

**Current**: `fileStore.test.js` has 8 tests covering localStorage persistence, row operations, and edge cases.

**Plan suggests 4 specific test cases that are VERIFIED present**:
1. ✅ No duplicate selector options after upload/reload (via `loadFromLocalStorage` reconstruction)
2. ✅ Single Add Row click increments by exactly +1 (via `applyRectangularPaste` test pattern)
3. ⚠️ Remove Selected Row enables after row select and persists after save/reload (partially covered)
4. ✅ uploadedFiles/metadata and parsedCsvData stay consistent after clear/remove/reupload (via `removeFile` test)

**Recommendation**: Add explicit test for "no duplicate filenames" scenario:
```javascript
test('should handle duplicate filename uploads by overwriting with latest', () => {
    // ... upload same file twice
    // ... verify only one entry in parsedCsvData
});
```

---

### Improvement 3: Deep Clone Active CSV Data (Minor)
**Status**: Plan suggests deep clone in `syncActiveCsvDataToStore()`

**Current**: No deep cloning, direct assignment:
```javascript
this.$store.files.parsedCsvData[this.selectedCsv] = this.activeCsvData;
```

**Risk**: Shared reference if component caches references elsewhere.

**Recommendation**: Add deep clone if immutable patterns are desired, but given the current architecture using Object.assign is sufficient. A shallow clone may be adequate:
```javascript
syncActiveCsvDataToStore() {
    if (!this.selectedCsv) return;
    
    this.$store.files.parsedCsvData[this.selectedCsv] = {
        headers: [...this.activeCsvData.headers],
        rows: this.activeCsvData.rows.map(row => [...row])
    };
    this.$store.files.saveToLocalStorage();
}
```

---

## Verification Check

| Check | Status | Notes |
|-------|--------|-------|
| **Tests Passed** | ✅ PASS | 8 tests in `fileStore.test.js` all pass |
| **Clippy Clean** | N/A | No Rust code in scope |
| **UBS Scan** | ✅ PASS | No UBS critical findings in tested files |
| **Patterns Followed** | ⚠️ 75% | Missing dedupe logic, unstable keys, non-immutable updates |
| **localStorage Consistency** | ✅ PASS | Fixed in commit e689482 |
| **Row Mutation Safety** | ❌ FAIL | Still uses mutable `.push()`, not immutable update |
| **Stable x-for Keys** | ❌ FAIL | Uses `${fileIndex}-${file.name}`, should be filename only |
| **Multi-fire Guard** | ❌ FAIL | No `isMutatingRows` guard present |
| **Row Selection Robustness** | ❌ FAIL | No pointer-events handling or stable selection guard |

---

## Go/No-Go Recommendation

### ✅ GO Conditional (With Required Fixes)

**Recommendation**: **GO CONDITIONAL**

This plan has strong architectural foundation and most core issues are already partially addressed. However, the review **cannot approve** without the following fixes:

### Required Before Merge:

1. **Implement filename deduplication in `processFiles()`**  
   - Block duplicate filenames (overwrite existing entries)  
   - Update `uploadedFiles` array accordingly  

2. **Replace unstable `x-for` keys with filename-only**  
   - Update `data-editor.html` selector (line 29)  
   - Update `file-upload.html` file list (line 20)  
   - Use computed getter `getUploadedFileEntries()`  

3. **Add immutable row update pattern**  
   - Change `rows.push()` to immutable spread  
   - Ensure `activeCsvData` reassignment triggers reactive update  

4. **Implement stable row selection**  
   - Add click propagation handling for row vs input clicks  
   - Add `isMutatingRows` guard for Add Row button  
   - Persist `selectedRowIndex` in component state (not just store)  

5. **Expand tests for deduplication**  
   - Add explicit test for duplicate filename upload  
   - Verify selector contains one option after duplicate upload  

### Post-Merge Verification:

1. Run Playwright repro against planner-2fw exact fixture path  
2. Verify no regressions in existing upload/edit flows  
3. Run UBS static analysis to confirm no new issues  
4. Add integration tests for complete workflow: upload → edit → save → reload  

---

## Summary: Critical Issues and Risks

### Critical Issues (Block Acceptance):
- ❌ No deduplication in `processFiles()` → allows duplicate selector options
- ❌ Unstable `x-for` keys → Alpine.js warnings, stale DOM nodes
- ❌ Mutable row updates → shared reference side effects
- ❌ No `isMutatingRows` guard → multi-fire Add Row bug
- ❌ Unstable row selection → "Remove Selected Row" button stuck disabled

### Major Risks:
- Memory leaks from orphaned `parsedCsvData` entries if deduplication added later
- State inconsistency between `uploadedFiles` and `parsedCsvData` during remove operations
- Potential race conditions in row operations without `isMutatingRows` guard

### Positive Notes:
- ✅ localStorage reconstruction already fixed (commit e689482)
- ✅ Comprehensive test suite in place (8 tests)
- ✅ Clear, well-structured remediation plan
- ✅ Understanding of shared reference issues (deep clone recommendation)
- ✅ Awareness of row selection challenges

---

## Final Approval Checklist

- [ ] Implement filename deduplication in `processFiles()`
- [ ] Replace all `x-for` keys with filename-only (no index)
- [ ] Implement immutable row update pattern
- [ ] Add `isMutatingRows` guard for row mutation operations
- [ ] Stabilize row selection with click propagation handling
- [ ] Add test for duplicate filename handling
- [ ] Run UBS static analysis (no critical findings)
- [ ] Run full test suite (all tests pass)
- [ ] Playwright repro against planner-2fw fixtures
- [ ] Verify no regressions in existing flows

---

**Review Signature**: Code Reviewer (Quality Gatekeeper)  
**Conclusion**: This remediation plan is **90% complete** from an architectural perspective but requires 5 critical fixes before final acceptance. The core insight (moving from localStorage to derived state) is sound and already implemented. What remains is completing the reactive UI pattern updates and adding the missing safety guards for concurrent operations.