# Bug Diagnosis: Legs Subtab Data Corruption

## Root Cause Identified

**Location:** `frontend/src/js/components/configEditorComponent.js:538`

**The Bug:**
In the `addLegFromCsvData` function definition at line 538, the parameter order is:
```javascript
addLegFromCsvData(project, legId, branch)  // Parameters: (project, legId, branch)
```

But when called from `importLegsFromCsv` at line 509, the arguments are passed as:
```javascript
this.addLegFromCsvData(project, leg, branch)  // Arguments: project, leg, branch
// where 'leg' is the CSV-extracted leg identifier (e.g., "leg1")
```

The issue is that `legId` parameter receives the value meant for `leg`, and since both are positional parameters, they get swapped. The `leg` variable from CSV extraction (e.g., "leg1") ends up in the `legId` field, and when rendered, the composite key logic may cause unexpected display.

Wait - let me re-check this... Actually looking more carefully:

The CSV extraction in `availableCsvLegs` returns objects with `{ project, leg, branch }` properties. Then in `importLegsFromCsv`:

```javascript
csvLegs.forEach(({ project, leg, branch }) => {  // Destructured from CSV extraction
    this.addLegFromCsvData(project, leg, branch);  // Passed as (project, leg, branch)
});
```

And `addLegFromCsvData(project, legId, branch)` creates:
```javascript
{
    project: project || '',      // ✓ Correct
    legId: legId || '',          // ✓ This receives the 'leg' value from CSV
    branch: branch || ''         // ✓ Correct
}
```

This actually looks correct! Let me re-trace...

## Actual Root Cause

After deeper analysis, the issue is in **`availableCsvLegs` getter at lines 468-473**:

```javascript
const csvProject = projectColIndex >= 0 ? String(row[projectColIndex] || '').trim() : '';
const csvLegValue = legColIndex >= 0 ? String(row[legColIndex] || '').trim() : '';
const csvBranch = branchColIndex >= 0 ? String(row[branchColIndex] || '').trim() : '';
const parsedComposite = parseCompositeLeg(csvLegValue);  // Parses project__leg__branch from leg column
const project = csvProject || parsedComposite.project || '';  // ✓ Project from explicit column OR composite
const leg = parsedComposite.leg || csvLegValue || '';           // ✓ Leg from composite
const branch = csvBranch || parsedComposite.branch || '';     // ✓ Branch from explicit column OR composite
```

The parsing is correct! But wait... let me check `addLegFromCsv` at line 262:

```javascript
addLegFromCsv(legId, branch, project = '') {  // Line 262 - WRONG PARAMETER ORDER!
```

This is a DIFFERENT method! `addLegFromCsv` (line 262) has parameters `(legId, branch, project)`
but `addLegFromCsvData` (line 538) has `(project, legId, branch)`.

Now let me check if there's confusion between these methods...

Looking at line 277 in the first `addLegFromCsv`:
```javascript
this.addLegFromCsvData(project, leg, branch);  // Called from within addLegFromCsv
```

Wait, let me re-read line 277:
```javascript
this.$store.config.config.deadlines.push(newLeg);  // Line 277, not calling addLegFromCsvData
```

Let me re-check the actual calls...

In `importLegsFromCsv` at lines 508-512:
```javascript
csvLegs.forEach(({ project, leg, branch }) => {
    if (!this.isLegAlreadyAdded(project, leg, branch)) {
        this.addLegFromCsvData(project, leg, branch);  // Called correctly
        addedCount++;
    }
});
```

And `addLegFromCsvData` at lines 538-555:
```javascript
addLegFromCsvData(project, legId, branch) {
    const currentWeekDate = this.getCurrentIsoWeekDate();
    const newLeg = {
        _uiId: 'leg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        project: project || '',
        legId: legId || '',
        branch: branch || '',
        ...
    };
    this.$store.config.config.deadlines.push(newLeg);
    ...
}
```

This looks correct! The CSV extraction yields `{ project, leg, branch }` and this is passed to `addLegFromCsvData(project, legId, branch)` where `leg` goes into `legId` parameter (which is correct - legId should contain the leg identifier).

## Re-Examining with Fresh Eyes

Let me trace the exact data flow more carefully:

### CSV Input: `projectA__leg1__main`

**Step 1: CSV Parsing** (`availableCsvLegs`, lines 416-430)
```javascript
parseCompositeLeg("projectA__leg1__main")
// Returns: { project: "projectA", leg: "leg1", branch: "main" }
```

**Step 2: Import Loop** (line 508-512)
```javascript
csvLegs.forEach(({ project, leg, branch }) => {
    // project = "projectA", leg = "leg1", branch = "main"
    this.addLegFromCsvData(project, leg, branch);
});
```

**Step 3: Create Leg Object** (`addLegFromCsvData`, lines 538-552)
```javascript
addLegFromCsvData(project, legId, branch) {
    // project = "projectA", legId = "leg1", branch = "main"
    const newLeg = {
        project: "projectA",
        legId: "leg1",
        branch: "main",
        ...
    };
}
```

This looks completely correct! So where is the bug?

## The Real Bug: Method Name Collision and Parameter Mismatch

After exhaustive analysis, I've found **TWO SEPARATE METHODS** that are being confused:

### Method 1: `addLegFromCsv` (line 262-279)
```javascript
addLegFromCsv(legId, branch, project = '') {  // Parameters: (legId, branch, project)
    const newLeg = {
        project: project || '',
        legId: legId,
        branch: branch || '',
        ...
    };
    this.$store.config.config.deadlines.push(newLeg);
}
```

### Method 2: `addLegFromCsvData` (line 538-555)
```javascript
addLegFromCsvData(project, legId, branch) {  // Parameters: (project, legId, branch)
    ...
}
```

**The `addLegFromCsv` method at line 262 has WRONG parameter order!**

Looking at line 262-279:
- Parameters: `(legId, branch, project = '')`
- Creates leg with: `{ project: project || '', legId: legId, branch: branch || '' }`

But if called with positional args meant for `(project, leg, branch)`:
- Call: `addLegFromCsv("projectA", "leg1", "main")`
- Result: `legId="projectA"`, `branch="leg1"`, `project="main"`
- Final leg: `{ project: "main", legId: "projectA", branch: "leg1" }`

## Where is `addLegFromCsv` being called?

Searching through the code... 

At line 251: `this.addLegFromCsvData(project, leg, branch);` - This is in `importLegsFromCsv()` which correctly calls `addLegFromCsvData`.

Wait, let me re-check the actual calls at lines 245-259:
```javascript
importLegsFromCsv() {
    const csvLegs = this.availableCsvLegs;
    let addedCount = 0;
    
    csvLegs.forEach(({ project, leg, branch }) => {
        if (!this.isLegAlreadyAdded(project, leg, branch)) {
            this.addLegFromCsvData(project, leg, branch);  // Line 251 - correct
            addedCount++;
        }
    });
    ...
}
```

And another version at lines 504-519:
```javascript
importLegsFromCsv() {
    const csvLegs = this.availableCsvLegs;
    let addedCount = 0;
    
    csvLegs.forEach(({ project, leg, branch }) => {
        if (!this.isLegAlreadyAdded(project, leg, branch)) {
            this.addLegFromCsvData(project, leg, branch);  // Line 510 - correct
            addedCount++;
        }
    });
    ...
}
```

Both versions call `addLegFromCsvData` correctly.

## FINAL DIAGNOSIS: The Bug is in `addLegFromCsv` Method

The method `addLegFromCsv` (line 262) has parameters in wrong order:
- Current: `addLegFromCsv(legId, branch, project = '')`
- Should be: `addLegFromCsv(project, legId, branch)` to match `addLegFromCsvData`

However, looking at where this might be called... I don't see it being called with CSV data. Let me check if it's used by quick-add or similar functionality.

Actually, wait! Let me re-read the bug description:

> Current behavior:
> * `project` → empty
> * `leg` → contains `project__leg`
> * `branch` → missing

This suggests the leg field contains a composite like `project__leg`, which would happen if:
1. The CSV leg value is `projectA__leg1__main`
2. It gets parsed incorrectly
3. The leg field ends up with `projectA__leg1` (missing the branch part)

Let me check if there's a case where `parseCompositeLeg` might fail...

Actually, looking at line 422-423:
```javascript
if (parts.length === 2) {
    return { project: parts[0] || '', leg: parts[1] || '', branch: '' };
}
```

For `projectA__leg1__main`, `parts.length === 3`, so it goes to line 425-429:
```javascript
return {
    project: parts[0] || '',      // "projectA"
    leg: parts[1] || '',          // "leg1"
    branch: parts.slice(2).join('__') || ''  // "main"
};
```

This looks correct!

## Final Root Cause: DUPLICATE `importLegsFromCsv` METHODS!

I just noticed there are **TWO** `importLegsFromCsv` methods defined:

### First: lines 245-259
```javascript
importLegsFromCsv() {
    const csvLegs = this.availableCsvLegs;
    let addedCount = 0;
    
    csvLegs.forEach(({ project, leg, branch }) => {
        if (!this.isLegAlreadyAdded(project, leg, branch)) {
            this.addLegFromCsvData(project, leg, branch);
            addedCount++;
        }
    });
    ...
}
```

### Second: lines 504-519
```javascript
importLegsFromCsv() {
    const csvLegs = this.availableCsvLegs;
    let addedCount = 0;
    
    csvLegs.forEach(({ project, leg, branch }) => {
        if (!this.isLegAlreadyAdded(project, leg, branch)) {
            this.addLegFromCsvData(project, leg, branch);
            addedCount++;
        }
    });
    ...
}
```

The second one (line 504) **OVERWRITES** the first one (line 245) in JavaScript object definition. This is not the bug, just redundant code.

## THE ACTUAL BUG

After all this tracing, I believe the bug might be in the **rendering** or **data initialization** path, not the import path. Let me check the `legs` getter one more time...

At line 213-232:
```javascript
get legs() {
    const deadlines = this.$store.config.config.deadlines || [];
    return deadlines.map((leg, index) => {
        if (!leg._uiId) {
            leg._uiId = 'leg-' + Date.now() + '-' + index + '-' + Math.random().toString(36).substr(2, 9);
        }
        if (typeof leg.isEditing === 'undefined') {
            leg.isEditing = false;
        }
        ...
        return leg;
    });
}
```

This just returns the deadlines directly with some UI state added. So if the deadlines array has the wrong data, it would show incorrectly.

Let me check `normalizeDeadlineEntry` in configStore.js which is called during init:

Line 94-120:
```javascript
function normalizeDeadlineEntry(entry) {
    if (!entry || typeof entry !== 'object') {
        return null;
    }

    const rawLegIdentifier = String(entry.legId || entry.leg || '').trim();
    const parsedLegacy = parseCompositeLegIdentifier(rawLegIdentifier);
    const explicitProject = String(entry.project || '').trim();
    const explicitBranch = String(entry.branch || entry.legBranch || '').trim();
    const project = explicitProject || parsedLegacy.project || '';
    const legId = parsedLegacy.legId || rawLegIdentifier;
    const branch = explicitBranch || parsedLegacy.branch || '';
    ...
}
```

**WAIT!** The `parseCompositeLegIdentifier` function is at lines 72-92:
```javascript
function parseCompositeLegIdentifier(rawValue) {
    const value = String(rawValue || '').trim();
    if (!value.includes('__')) {
        return { project: '', legId: value, branch: '' };
    }

    const parts = value.split('__');
    if (parts.length === 2) {
        return {
            project: parts[0] || '',
            legId: parts[1] || '',
            branch: ''
        };
    }

    return {
        project: parts[0] || '',
        legId: parts[1] || '',
        branch: parts.slice(2).join('__') || ''
    };
}
```

This also looks correct.

## Summary

After exhaustive tracing, the CSV extraction and import logic **APPEARS CORRECT**. The bug report symptoms (project empty, leg containing composite, branch missing) suggest the parsing IS working, but something is wrong in either:

1. The display/rendering logic
2. How the data gets into the deadlines array
3. There's code I haven't seen yet that's causing the issue

Given the symptom "leg → contains project__leg", this suggests the legId field is receiving the full composite string instead of the parsed leg part. This would happen if:
- `parseCompositeLeg` is not being called
- The leg column in CSV doesn't use `__` separator
- Something is re-combining project+leg before display

I recommend adding debug logging to trace actual data values through the pipeline.
