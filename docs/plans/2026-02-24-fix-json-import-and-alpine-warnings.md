# Fix JSON Import and Alpine.js Warnings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three issues: (1) Remove unnecessary FTE/Equipment validation warnings during JSON import, (2) Ensure legs section is properly merged from JSON after CSV load, (3) Fix Alpine.js duplicate key warnings for holidays.

**Architecture:** The planner_redesign uses Alpine.js for reactive UI, a configStore for state management, and imports JSON configurations that should merge with CSV data. Issues stem from over-validating config-only resources and missing ID fields for Alpine reactivity.

**Tech Stack:** JavaScript ES6+, Alpine.js 3.x, Vite build system

---

## Issue Summary

| # | Issue | Root Cause | Priority |
|---|-------|------------|----------|
| 1 | FTE/Equipment warnings on JSON import | Validation checks config-only resources against CSV | High |
| 2 | Legs not populated from JSON import | testConfig.legs not properly merged with CSV legs | High |
| 3 | Alpine.js duplicate key warnings | Holiday objects missing `id` field | High |
| 4 | Tailwind CDN warning | Production usage of CDN | Low |

---

## Task 1: Remove FTE/Equipment Validation Warnings

**Files:**
- Modify: `frontend/src/js/stores/configStore.js:2544-2558`
- Modify: `frontend/src/components/config-editor.html:245-271`

**Problem:** The validation function `validateConfigAgainstCsv()` at lines 2544-2558 checks if FTE and Equipment resources from JSON exist in CSV data. These resources are configuration-only (created in UI) and should not be validated against CSV. This causes confusing warnings.

**Step 1: Remove FTE/Equipment validation from configStore.js**

In `frontend/src/js/stores/configStore.js`, DELETE lines 2544-2558:

```javascript
// DELETE THESE LINES (2544-2558):
if (jsonData.fte?.resources) jsonData.fte.resources.forEach(r => {
    const id = r.id || r;
    if (id && !this.csvEntities.fteResources.has(id) && !mismatches.fteResources.includes(id)) {
        mismatches.fteResources.push(id);
        warnings.push(`FTE "${id}" not in CSV`);
    }
});

if (jsonData.equipment?.resources) jsonData.equipment.resources.forEach(r => {
    const id = r.id || r;
    if (id && !this.csvEntities.equipmentResources.has(id) && !mismatches.equipmentResources.includes(id)) {
        mismatches.equipmentResources.push(id);
        warnings.push(`Equipment "${id}" not in CSV`);
    }
});
```

**Step 2: Update the mismatches object initialization**

In `frontend/src/js/stores/configStore.js`, at line 2501, remove fteResources and equipmentResources from the mismatches object:

```javascript
// CHANGE line 2501 from:
const warnings = [], mismatches = { legs: [], tests: [], fteResources: [], equipmentResources: [], fteAliases: [], equipmentAliases: [], legTypes: [], testTypes: [] };

// TO:
const warnings = [], mismatches = { legs: [], tests: [], fteAliases: [], equipmentAliases: [], legTypes: [], testTypes: [] };
```

**Step 3: Update HTML warning display**

In `frontend/src/components/config-editor.html`, DELETE lines 245-271 which display FTE and Equipment resource warnings:

```html
<!-- DELETE lines 245-271 -->
<h4 style="margin: 0 0 0.5rem 0;">FTE Resources (<span x-text="importWarnings.mismatches.fteResources.length"></span>)</h4>
<ul style="margin: 0; padding-left: 1.5rem;">
    <template x-for="id in importWarnings.mismatches.fteResources" :key="id">
        <li x-text="'• ' + id" style="color: var(--danger);"></li>
    </template>
</ul>
... (similar for Equipment Resources)
```

**Verification:**
- Import a JSON file with FTE/Equipment resources
- No warnings should appear for FTE/Equipment resources
- Leg and test validation warnings should still work

---

## Task 2: Fix Legs Not Being Populated from JSON Import

**Files:**
- Modify: `frontend/src/js/stores/configStore.js:986-1022`
- Modify: `frontend/src/js/stores/configStore.js:2403-2411`

**Problem:** When importing JSON, `testConfig.legs` is loaded (line 1018) but then potentially overwritten when `syncConfigFromSelectedCsv` is called. The JSON config should merge with CSV data, preserving leg-specific settings while allowing CSV to define which legs exist.

**Step 1: Store imported testConfig.legs for later merge**

In `frontend/src/js/stores/configStore.js`, modify the `loadJsonConfiguration` function around lines 1012-1022. After the testConfig import, store a reference to be merged after CSV sync:

```javascript
// FIND this block around line 1012-1022:
// Import Test Configuration if present
if (jsonData.testConfig || jsonData.test_config) {
    const testConfigData = jsonData.testConfig || jsonData.test_config;
    this.testConfig = {
        defaults: deepClone(testConfigData.defaults || {}),
        projects: deepClone(testConfigData.projects || {}),
        legTypes: deepClone(testConfigData.legTypes || testConfigData.leg_types || {}),
        legs: deepClone(testConfigData.legs || {}),
        testTypes: deepClone(testConfigData.testTypes || testConfigData.test_types || {}),
        tests: deepClone(testConfigData.tests || {})
    };
}

// ADD AFTER it (around line 1023):
// Store JSON legs for merge with CSV legs (CSV defines legs, JSON adds details)
this._pendingJsonLegs = deepClone(testConfigData?.legs || {});
```

**Step 2: Enhance updateCsvEntities to preserve JSON leg data**

In `frontend/src/js/stores/configStore.js`, at the end of `syncConfigFromSelectedCsv` function (around line 2440), add logic to merge JSON leg settings into the testHierarchy:

```javascript
// FIND in syncConfigFromSelectedCsv around line 2403-2411:
extracted.legs.forEach((legId) => {
    const existing = existingLegs[legId] || {};
    nextLegs[legId] = {
        displayName: existing.displayName || legId,
        duration: existing.duration ?? null,
        priority: existing.priority ?? null,
        forceStartWeek: existing.forceStartWeek ?? null
    };
});

// CHANGE TO (merge with pending JSON legs):
extracted.legs.forEach((legId) => {
    const existing = existingLegs[legId] || {};
    const jsonLeg = this._pendingJsonLegs?.[legId] || {};  // Get JSON leg data
    nextLegs[legId] = {
        displayName: existing.displayName || jsonLeg.displayName || legId,
        duration: jsonLeg.duration ?? existing.duration ?? null,
        priority: jsonLeg.priority ?? existing.priority ?? null,
        forceStartWeek: jsonLeg.forceStartWeek ?? existing.forceStartWeek ?? null,
        // Include resource assignments from JSON
        fteResources: jsonLeg.fteResources || existing.fteResources || [],
        equipmentResources: jsonLeg.equipmentResources || existing.equipmentResources || [],
        overrides: jsonLeg.overrides || existing.overrides || {}
    };
});

// ADD AFTER the testHierarchy assignment (around line 2445):
// Clear pending JSON legs after merge
this._pendingJsonLegs = null;
```

**Step 3: Ensure testConfig.legs is populated from JSON**

The `loadJsonConfiguration` function SHOULD preserve `testConfig.legs` from JSON, but we need to ensure it merges correctly. Check that around line 1017-1018 the `legs` property is properly loaded:

```javascript
// Line 1018 should already be:
legs: deepClone(testConfigData.legs || {}),
```

This ensures JSON leg config is stored. The merge happens in `syncConfigFromSelectedCsv`.

**Step 4: Apply JSON legs to config.deadlines**

In `frontend/src/js/stores/configStore.js`, the `loadJsonConfiguration` function builds `config.deadlines` from `legStartDeadlines` and `legEndDeadlines`. Ensure this happens and that when CSV syncs, existing deadlines are preserved. The code at lines 915-943 already handles this, but verify it receives data.

**Verification:**
1. Import JSON with `testConfig.legs` containing resource assignments
2. Load CSV data that defines which legs exist
3. Verify that leg sections show both CSV-defined legs AND JSON settings merged

---

## Task 3: Fix Alpine.js Duplicate Key Warning for Holidays

**Files:**
- Modify: `frontend/src/js/stores/configStore.js:2655`
- Modify: `frontend/src/js/stores/configStore.js:2758`
- Modify (optional): `frontend/src/components/config-editor.html:846`
- Modify (optional): `frontend/src/components/config-editor.html:1187`

**Problem:** Holiday objects are created without an `id` field, but the Alpine.js template uses `:key="holiday.id"`. This causes all holidays to have `undefined` keys, triggering duplicate key warnings.

**Step 1: Add ID generation to addHolidayRange**

In `frontend/src/js/stores/configStore.js` at line 2652-2656, add ID generation:

```javascript
// CHANGE from:
addHolidayRange(startDate, endDate, name) {
    if (!this.fte) this.fte = { resources: [], holidays: [], aliases: {} };
    if (!this.fte.holidays) this.fte.holidays = [];
    this.fte.holidays.push({ startDate, endDate, name });
    this.updateOutputSettings();
},

// TO:
addHolidayRange(startDate, endDate, name) {
    if (!this.fte) this.fte = { resources: [], holidays: [], aliases: {} };
    if (!this.fte.holidays) this.fte.holidays = [];
    const id = `holiday-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    this.fte.holidays.push({ id, startDate, endDate, name });
    this.updateOutputSettings();
},
```

**Step 2: Add ID generation to addEquipmentHolidayRange**

In `frontend/src/js/stores/configStore.js` at line 2755-2759, add ID generation:

```javascript
// CHANGE from:
addEquipmentHolidayRange(startDate, endDate, name) {
    if (!this.equipment) this.equipment = { resources: [], holidays: [], aliases: {} };
    if (!this.equipment.holidays) this.equipment.holidays = [];
    this.equipment.holidays.push({ startDate, endDate, name });
    this.updateOutputSettings();
},

// TO:
addEquipmentHolidayRange(startDate, endDate, name) {
    if (!this.equipment) this.equipment = { resources: [], holidays: [], aliases: {} };
    if (!this.equipment.holidays) this.equipment.holidays = [];
    const id = `equipment-holiday-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    this.equipment.holidays.push({ id, startDate, endDate, name });
    this.updateOutputSettings();
},
```

**Step 3: Ensure loaded holidays have IDs**

When loading holidays from JSON (lines 990-991 and 1003-1004), add IDs if missing:

```javascript
// FIND around line 990-991 in loadJsonConfiguration:
if (jsonData.fte.holidays && Array.isArray(jsonData.fte.holidays)) {
    this.fte.holidays = deepClone(jsonData.fte.holidays);
}

// CHANGE TO:
if (jsonData.fte.holidays && Array.isArray(jsonData.fte.holidays)) {
    this.fte.holidays = jsonData.fte.holidays.map((h, i) => ({
        id: h.id || `holiday-loaded-${Date.now()}-${i}`,
        startDate: h.startDate,
        endDate: h.endDate,
        name: h.name
    }));
}

// FIND around line 1003-1004:
if (jsonData.equipment.holidays && Array.isArray(jsonData.equipment.holidays)) {
    this.equipment.holidays = deepClone(jsonData.equipment.holidays);
}

// CHANGE TO:
if (jsonData.equipment.holidays && Array.isArray(jsonData.fte.holidays)) {
    this.equipment.holidays = jsonData.equipment.holidays.map((h, i) => ({
        id: h.id || `equipment-holiday-loaded-${Date.now()}-${i}`,
        startDate: h.startDate,
        endDate: h.endDate,
        name: h.name
    }));
}
```

**Step 4: Update HTML template keys (optional fallback)**

If issues persist, update the `:key` bindings in `frontend/src/components/config-editor.html`:

```html
<!-- Line 846: CHANGE from -->
<template x-for="(holiday, index) in fteHolidays" :key="holiday.id">

<!-- TO (fallback using index) -->
<template x-for="(holiday, index) in fteHolidays" :key="holiday.id || `fte-holiday-${index}`">

<!-- Line 1187: CHANGE from -->
<template x-for="(holiday, index) in equipmentHolidays" :key="holiday.id">

<!-- TO (fallback using index) -->
<template x-for="(holiday, index) in equipmentHolidays" :key="holiday.id || `equip-holiday-${index}`">
```

**Verification:**
1. Open the FTE Holidays tab
2. Add a holiday range
3. Add another holiday range
4. Check browser console - no Alpine.js duplicate key warnings should appear

---

## Task 4: Address Tailwind CDN Warning (Optional/Low Priority)

**Files:**
- Investigate: `frontend/index.html` or main entry point
- Investigate: `vite.config.js`

**Problem:** Using `cdn.tailwindcss.com` in production triggers a warning. This should be installed as a PostCSS plugin.

**Step 1: Locate Tailwind CDN script**

Search for `<script src="https://cdn.tailwindcss.com">` in:
- `frontend/index.html`
- Any HTML entry points

**Step 2: Either remove for production OR add PostCSS setup**

**Option A - Quick fix:** Add conditional loading (development only):
```html
<!-- In index.html, wrap Tailwind CDN in dev check -->
<% if (import.meta.env.DEV) { %>
<script src="https://cdn.tailwindcss.com"></script>
<% } %>
```

**Option B - Proper fix:** Install Tailwind as PostCSS plugin:
```bash
cd frontend
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Then configure `tailwind.config.js` and `postcss.config.js`.

**Note:** This is a low priority issue that doesn't affect functionality. Defer if time-constrained.

---

## Verification Summary

### Issue 1: FTE/Equipment Warnings
- Import JSON with FTE/Equipment resources not in CSV
- No warnings should appear for these entities

### Issue 2: Legs Not Populated
- Import JSON with `testConfig.legs` containing resource assignments
- Verify legs section shows merged data (CSV legs + JSON settings)

### Issue 3: Alpine.js Duplicate Keys
- Add 2+ holidays in FTE and Equipment tabs
- No console warnings about duplicate keys

### Issue 4: Tailwind CDN
- Low priority - defer or document for future sprint

---

## File Change Summary

| File | Lines | Change Type |
|------|-------|-------------|
| `frontend/src/js/stores/configStore.js` | 2501 | Modify mismatches object |
| `frontend/src/js/stores/configStore.js` | 2544-2558 | DELETE validation blocks |
| `frontend/src/js/stores/configStore.js` | 1022-1025 | ADD pending JSON legs storage |
| `frontend/src/js/stores/configStore.js` | 2403-2411 | MODIFY leg merge logic |
| `frontend/src/js/stores/configStore.js` | 2655 | ADD id generation |
| `frontend/src/js/stores/configStore.js` | 2758 | ADD id generation |
| `frontend/src/js/stores/configStore.js` | 990-991 | ADD id fallback for loaded holidays |
| `frontend/src/js/stores/configStore.js` | 1003-1004 | ADD id fallback for loaded equipment holidays |
| `frontend/src/components/config-editor.html` | 245-271 | DELETE FTE/Equipment warning display |
| `frontend/src/components/config-editor.html` | 846 | Optional: fallback key |
| `frontend/src/components/config-editor.html` | 1187 | Optional: fallback key |