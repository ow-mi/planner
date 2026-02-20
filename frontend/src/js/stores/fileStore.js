/**
 * File Store - Alpine.js Store for File Management
 *
 * Manages folder-imported files, CSV parsing, and data storage
 */

// Storage key constants for consistency
const FILE_STORAGE_KEYS = {
    PARSED_CSV_DATA: 'ui_v2_exp__files__parsedCsvData',
    SELECTED_CSV: 'ui_v2_exp__files__selectedCsv',
    BASE_FOLDER_PATH: 'ui_v2_exp__files__baseFolderPath',
    SESSION_ID: 'ui_v2_exp__files__sessionId'
};

const SOLVER_TABLE_NAME_TO_CANONICAL_KEY = {
    legs: 'legs',
    tests: 'tests',
    fte: 'fte',
    equipment: 'equipment',
    test_duts: 'test_duts'
};

const SOLVER_TABLE_NAME_ALIASES = {
    legs: ['legs', 'leg', 'data_legs', 'data_legs_csv'],
    tests: ['tests', 'test', 'data_test', 'data_test_csv'],
    fte: ['fte', 'data_fte', 'data_fte_csv'],
    equipment: ['equipment', 'data_equipment', 'data_equipment_csv'],
    test_duts: ['test_duts', 'testduts', 'data_test_duts', 'data_test_duts_csv']
};

const DEFAULT_RESOURCE_START_WEEK = '2025-W01';
const DEFAULT_RESOURCE_END_WEEK = '2035-W52';

function parseIsoWeekStartDate(isoWeekValue) {
    const raw = String(isoWeekValue || '').trim();
    const match = raw.match(/^(\d{4})-W?(\d{1,2})$/i);
    if (!match) {
        return null;
    }
    const year = Number(match[1]);
    const week = Number(match[2]);
    if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) {
        return null;
    }

    const jan4 = new Date(Date.UTC(year, 0, 4));
    const jan4Weekday = (jan4.getUTCDay() + 6) % 7; // Mon=0..Sun=6
    const week1Monday = new Date(jan4);
    week1Monday.setUTCDate(jan4.getUTCDate() - jan4Weekday);

    const startDate = new Date(week1Monday);
    startDate.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
    return startDate;
}

function parseIsoDate(value) {
    const raw = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return null;
    }
    const parsed = new Date(`${raw}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return parsed;
}

function formatIsoDate(dateValue) {
    if (!(dateValue instanceof Date) || Number.isNaN(dateValue.getTime())) {
        return '';
    }
    return dateValue.toISOString().slice(0, 10);
}

function addDays(dateValue, days) {
    const next = new Date(dateValue);
    next.setUTCDate(next.getUTCDate() + Number(days || 0));
    return next;
}

function mergeDateIntervals(intervals) {
    const normalized = (Array.isArray(intervals) ? intervals : [])
        .map((interval) => ({
            start: Number(interval?.start),
            end: Number(interval?.end)
        }))
        .filter((interval) => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end > interval.start)
        .sort((a, b) => a.start - b.start);

    if (normalized.length === 0) {
        return [];
    }

    const merged = [normalized[0]];
    for (let i = 1; i < normalized.length; i += 1) {
        const current = normalized[i];
        const previous = merged[merged.length - 1];
        if (current.start <= previous.end) {
            previous.end = Math.max(previous.end, current.end);
        } else {
            merged.push({ ...current });
        }
    }

    return merged;
}

function subtractDateIntervals(baseStartMs, baseEndMs, blockedIntervals) {
    const blocked = mergeDateIntervals(blockedIntervals);
    if (!Number.isFinite(baseStartMs) || !Number.isFinite(baseEndMs) || baseEndMs <= baseStartMs) {
        return [];
    }
    if (blocked.length === 0) {
        return [{ start: baseStartMs, end: baseEndMs }];
    }

    const available = [];
    let cursor = baseStartMs;
    blocked.forEach((interval) => {
        if (interval.end <= cursor) {
            return;
        }
        if (interval.start > cursor) {
            available.push({ start: cursor, end: Math.min(interval.start, baseEndMs) });
        }
        cursor = Math.max(cursor, interval.end);
    });

    if (cursor < baseEndMs) {
        available.push({ start: cursor, end: baseEndMs });
    }

    return available.filter((interval) => interval.end > interval.start);
}

function hasUnavailableCalendarDay(resource) {
    const calendar = resource?.calendar;
    if (!calendar || typeof calendar !== 'object') {
        return false;
    }

    // Support both nested shape: { "2026": { "2026-01-10": false } }
    // and flat shape: { "2026-01-10": false }.
    const entries = Object.entries(calendar);
    return entries.some(([key, value]) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(key))) {
            return value === false || String(value).toLowerCase() === 'false';
        }
        if (value && typeof value === 'object') {
            return Object.values(value).some((available) => (
                available === false || String(available).toLowerCase() === 'false'
            ));
        }
        return false;
    });
}

function getResourceBySolverId(resourceLookup, solverResourceId, expectedPrefix) {
    if (!resourceLookup || typeof resourceLookup !== 'object') {
        return null;
    }
    if (resourceLookup[solverResourceId]) {
        return resourceLookup[solverResourceId];
    }
    const prefix = String(expectedPrefix || '');
    const normalizedSolverId = normalizeAssignedResourceId(solverResourceId, prefix, '');
    if (normalizedSolverId && resourceLookup[normalizedSolverId]) {
        return resourceLookup[normalizedSolverId];
    }
    if (prefix && solverResourceId.startsWith(prefix)) {
        const stripped = solverResourceId.slice(prefix.length);
        if (resourceLookup[stripped]) {
            return resourceLookup[stripped];
        }
        const normalizedStripped = normalizeAssignedResourceId(stripped, prefix, '');
        if (normalizedStripped && resourceLookup[normalizedStripped]) {
            return resourceLookup[normalizedStripped];
        }
    }
    return null;
}

function buildResourceAvailabilityTable({
    resourceIds = [],
    resources = [],
    holidays = [],
    defaultStartWeek = DEFAULT_RESOURCE_START_WEEK,
    defaultEndWeek = DEFAULT_RESOURCE_END_WEEK,
    prefix = ''
}) {
    const normalizedResourceIds = Array.isArray(resourceIds) ? resourceIds : [];
    const resourceList = Array.isArray(resources) ? resources : [];
    const holidayRanges = Array.isArray(holidays) ? holidays : [];

    const hasConstraints = holidayRanges.length > 0 || resourceList.some((resource) => hasUnavailableCalendarDay(resource));
    if (!hasConstraints) {
        return {
            headers: ['resource_id', 'available_start_week_iso', 'available_end_week_iso'],
            rows: normalizedResourceIds.map((resourceId) => [resourceId, defaultStartWeek, defaultEndWeek])
        };
    }

    const baseStartDate = parseIsoWeekStartDate(defaultStartWeek);
    const baseEndWeekDate = parseIsoWeekStartDate(defaultEndWeek);
    if (!baseStartDate || !baseEndWeekDate) {
        return {
            headers: ['resource_id', 'available_start_week_iso', 'available_end_week_iso'],
            rows: normalizedResourceIds.map((resourceId) => [resourceId, defaultStartWeek, defaultEndWeek])
        };
    }
    const baseStartMs = baseStartDate.getTime();
    const baseEndMs = addDays(baseEndWeekDate, 7).getTime(); // End is exclusive.

    const resourceLookup = {};
    resourceList.forEach((resource) => {
        const resourceId = String(resource?.id || '').trim();
        if (resourceId) {
            resourceLookup[resourceId] = resource;
            const normalizedSolverId = normalizeAssignedResourceId(
                resourceId,
                String(prefix || ''),
                ''
            );
            if (normalizedSolverId) {
                resourceLookup[normalizedSolverId] = resource;
                if (normalizedSolverId.startsWith(String(prefix || ''))) {
                    resourceLookup[normalizedSolverId.slice(String(prefix || '').length)] = resource;
                }
            }
        }
    });

    const commonBlockedIntervals = [];
    holidayRanges.forEach((holiday) => {
        const startDate = parseIsoDate(holiday?.startDate);
        const endDate = parseIsoDate(holiday?.endDate);
        if (!startDate || !endDate || endDate.getTime() < startDate.getTime()) {
            return;
        }
        commonBlockedIntervals.push({
            start: startDate.getTime(),
            end: addDays(endDate, 1).getTime() // inclusive end -> exclusive
        });
    });

    const rows = [];
    normalizedResourceIds.forEach((solverResourceId) => {
        const blockedIntervals = [...commonBlockedIntervals];
        const resource = getResourceBySolverId(resourceLookup, String(solverResourceId || ''), prefix);
        const calendar = resource?.calendar;

        if (calendar && typeof calendar === 'object') {
            Object.entries(calendar).forEach(([calendarKey, calendarValue]) => {
                if (/^\d{4}-\d{2}-\d{2}$/.test(String(calendarKey))) {
                    const unavailable = (
                        calendarValue === false ||
                        String(calendarValue).toLowerCase() === 'false'
                    );
                    if (!unavailable) {
                        return;
                    }
                    const dayDate = parseIsoDate(calendarKey);
                    if (!dayDate) {
                        return;
                    }
                    blockedIntervals.push({
                        start: dayDate.getTime(),
                        end: addDays(dayDate, 1).getTime()
                    });
                    return;
                }

                if (!calendarValue || typeof calendarValue !== 'object') {
                    return;
                }

                Object.entries(calendarValue).forEach(([dateKey, available]) => {
                    const unavailable = (
                        available === false ||
                        String(available).toLowerCase() === 'false'
                    );
                    if (!unavailable) {
                        return;
                    }
                    const dayDate = parseIsoDate(dateKey);
                    if (!dayDate) {
                        return;
                    }
                    blockedIntervals.push({
                        start: dayDate.getTime(),
                        end: addDays(dayDate, 1).getTime()
                    });
                });
            });
        }

        const availableIntervals = subtractDateIntervals(baseStartMs, baseEndMs, blockedIntervals);
        availableIntervals.forEach((interval) => {
            rows.push([
                solverResourceId,
                formatIsoDate(new Date(interval.start)),
                formatIsoDate(new Date(interval.end))
            ]);
        });
    });

    return {
        headers: ['resource_id', 'available_start_date', 'available_end_date_exclusive'],
        rows
    };
}

function inferColumnTypeFromValues(values) {
    const normalizedValues = values
        .map(value => (value === null || value === undefined ? '' : String(value).trim()))
        .filter(value => value.length > 0);

    if (normalizedValues.length === 0) {
        return 'text';
    }

    const allNumbers = normalizedValues.every(value => /^[-+]?\d*\.?\d+$/.test(value));
    if (allNumbers) {
        return 'number';
    }

    const allDates = normalizedValues.every(value => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return false;
        }

        const date = new Date(`${value}T00:00:00Z`);
        return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    });

    if (allDates) {
        return 'date';
    }

    return 'text';
}

function inferColumnTypes(csvData) {
    if (!csvData || !Array.isArray(csvData.headers) || !Array.isArray(csvData.rows)) {
        return [];
    }

    return csvData.headers.map((_, colIndex) => {
        const columnValues = csvData.rows.map(row => (Array.isArray(row) ? row[colIndex] : ''));
        return inferColumnTypeFromValues(columnValues);
    });
}

function validateCellValueByType(value, columnType) {
    const normalized = value === null || value === undefined ? '' : String(value).trim();
    if (normalized.length === 0 || columnType === 'text') {
        return true;
    }

    if (columnType === 'number') {
        return /^[-+]?\d*\.?\d+$/.test(normalized);
    }

    if (columnType === 'date') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
            return false;
        }

        const date = new Date(`${normalized}T00:00:00Z`);
        return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === normalized;
    }

    return true;
}

function parseTabularText(rawText) {
    if (typeof rawText !== 'string' || rawText.length === 0) {
        return [];
    }

    return rawText
        .replace(/\r\n/g, '\n')
        .split('\n')
        .filter((line, index, lines) => line.length > 0 || index < lines.length - 1)
        .map(line => line.split('\t'));
}

function applyRectangularPaste(rows, startRow, startCol, pastedMatrix, columnCount) {
    const nextRows = Array.isArray(rows) ? rows.map(row => (Array.isArray(row) ? [...row] : [])) : [];
    if (!Array.isArray(pastedMatrix) || pastedMatrix.length === 0) {
        return nextRows;
    }

    pastedMatrix.forEach((pastedRow, rowOffset) => {
        const targetRowIndex = startRow + rowOffset;
        while (nextRows.length <= targetRowIndex) {
            nextRows.push(Array(columnCount).fill(''));
        }

        if (!Array.isArray(nextRows[targetRowIndex])) {
            nextRows[targetRowIndex] = Array(columnCount).fill('');
        }

        pastedRow.forEach((cellValue, colOffset) => {
            const targetColIndex = startCol + colOffset;
            if (targetColIndex >= columnCount) {
                return;
            }

            nextRows[targetRowIndex][targetColIndex] = cellValue;
        });
    });

    return nextRows;
}

function getFileIdentity(file) {
    if (!file || !file.name) {
        return '';
    }
    const size = Number.isFinite(file.size) ? file.size : 0;
    const lastModified = Number.isFinite(file.lastModified) ? file.lastModified : 0;
    return `${file.name}::${size}::${lastModified}`;
}

function parseCsvText(csvText) {
    const results = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true
    });

    if (results.errors && results.errors.length > 0) {
        throw new Error(results.errors[0].message || 'Failed to parse CSV content');
    }

    return {
        headers: results.meta.fields || [],
        rows: (results.data || []).map((row) => Object.values(row))
    };
}

function downloadTextFile(filename, content, mimeType = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}

function normalizeTableName(rawName) {
    return String(rawName || '')
        .trim()
        .toLowerCase()
        .replace(/\.[a-z0-9]+$/i, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function inferSolverTableKey(filename, tableData) {
    const normalizedName = normalizeTableName(filename);

    for (const [canonicalKey, aliases] of Object.entries(SOLVER_TABLE_NAME_ALIASES)) {
        if (aliases.includes(normalizedName)) {
            return SOLVER_TABLE_NAME_TO_CANONICAL_KEY[canonicalKey];
        }
    }

    const headers = Array.isArray(tableData?.headers)
        ? tableData.headers.map((header) => String(header || '').trim().toLowerCase())
        : [];
    const headerSet = new Set(headers);

    if (headerSet.has('test_id') && headerSet.has('dut_id')) return 'test_duts';
    if (headerSet.has('equipment_id')) return 'equipment';
    if (headerSet.has('fte_id')) return 'fte';
    if (headerSet.has('test_id')) return 'tests';
    if (headerSet.has('project_leg_id') || headerSet.has('leg_id')) return 'legs';

    return null;
}

function slugifyIdentifier(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function normalizeAssignedResourceId(rawValue, prefix, fallbackId) {
    const value = String(rawValue || '').trim();
    if (!value) {
        return fallbackId;
    }
    if (value === '*') {
        return '*';
    }
    if (value.toLowerCase().startsWith(prefix)) {
        return value;
    }
    const slug = slugifyIdentifier(value);
    return slug ? `${prefix}${slug}` : fallbackId;
}

function normalizeResourcePool(resourceIds, prefix, fallbackId) {
    const normalized = [];
    const seen = new Set();
    (resourceIds || []).forEach((resourceId) => {
        const normalizedId = normalizeAssignedResourceId(resourceId, prefix, fallbackId);
        if (!normalizedId || normalizedId === '*' || seen.has(normalizedId)) {
            return;
        }
        seen.add(normalizedId);
        normalized.push(normalizedId);
    });
    return normalized;
}

function resolveConfiguredResourceIds({
    selectedIds,
    aliases,
    prefix,
    fallbackId
}) {
    const resolved = [];
    const seen = new Set();
    const aliasMap = aliases && typeof aliases === 'object' ? aliases : {};

    const pushResolved = (rawValue) => {
        const normalizedId = normalizeAssignedResourceId(rawValue, prefix, fallbackId);
        if (!normalizedId || normalizedId === '*' || seen.has(normalizedId)) {
            return;
        }
        seen.add(normalizedId);
        resolved.push(normalizedId);
    };

    (selectedIds || []).forEach((selected) => {
        const selectedKey = String(selected || '').trim();
        if (!selectedKey) return;
        if (aliasMap[selectedKey] && Array.isArray(aliasMap[selectedKey])) {
            aliasMap[selectedKey].forEach(pushResolved);
            return;
        }
        pushResolved(selectedKey);
    });

    if (resolved.length === 0) {
        return [];
    }

    return resolved;
}

function normalizeRequiredCount(value, fallback = 1) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return fallback;
    }
    return Math.max(0, Math.round(numericValue));
}

function buildResolvedConfigTestId(project, leg, branch, sequence, testName) {
    const projectValue = String(project || '').trim();
    const legValue = String(leg || '').trim();
    const branchValue = String(branch || '').trim();
    const testNameValue = String(testName || '').trim();
    const sequenceValue = Number(sequence);

    if (!projectValue || !legValue || !testNameValue || !Number.isFinite(sequenceValue) || sequenceValue < 1) {
        return '';
    }

    const normalizedSequence = Math.trunc(sequenceValue);
    const branchSequence = branchValue ? `${branchValue}_${normalizedSequence}` : String(normalizedSequence);
    return `${projectValue}__${legValue}__${branchSequence}__${testNameValue}`;
}

function getResolvedRequiredCount(configStore, testIds, field, fallback) {
    const fallbackValue = normalizeRequiredCount(fallback, 1);
    if (!configStore) {
        return fallbackValue;
    }

    const candidateIds = Array.isArray(testIds) ? testIds : [testIds];
    for (const candidateId of candidateIds) {
        if (!candidateId) {
            continue;
        }

        if (typeof configStore.getResolvedFieldForLevel === 'function') {
            const resolved = configStore.getResolvedFieldForLevel('tests', candidateId, field);
            if (resolved && resolved.value !== undefined) {
                return normalizeRequiredCount(resolved.value, fallbackValue);
            }
        }

        if (typeof configStore.getResolvedTestSetting === 'function') {
            const value = configStore.getResolvedTestSetting(candidateId, field);
            if (value !== undefined) {
                return normalizeRequiredCount(value, fallbackValue);
            }
        }
    }

    return fallbackValue;
}

function getResolvedResourceSelection(configStore, testIds, field, fallbackValues) {
    const fallback = Array.isArray(fallbackValues) ? fallbackValues : [];
    if (!configStore) {
        return fallback;
    }

    const candidateIds = Array.isArray(testIds) ? testIds : [testIds];
    for (const candidateId of candidateIds) {
        if (!candidateId) {
            continue;
        }

        if (typeof configStore.getResolvedFieldForLevel === 'function') {
            const resolved = configStore.getResolvedFieldForLevel('tests', candidateId, field);
            if (resolved && resolved.value !== undefined) {
                return Array.isArray(resolved.value) ? resolved.value : fallback;
            }
        }

        if (typeof configStore.getResolvedTestSetting === 'function') {
            const value = configStore.getResolvedTestSetting(candidateId, field);
            if (value !== undefined) {
                return Array.isArray(value) ? value : fallback;
            }
        }
    }

    return fallback;
}

function parseMigratedCsvTables(csvData, configStore = null) {
    if (!Array.isArray(csvData?.headers) || !Array.isArray(csvData?.rows)) {
        return null;
    }

    const headers = csvData.headers.map((header) => String(header || '').trim().toLowerCase());
    const projectIdx = headers.indexOf('project');
    const legIdx = headers.indexOf('leg');
    const branchIdx = headers.indexOf('branch');
    const testIdx = headers.indexOf('test');
    const durationIdx = headers.indexOf('duration_days');
    const descriptionIdx = headers.indexOf('description');
    if (projectIdx < 0 || legIdx < 0 || testIdx < 0 || durationIdx < 0) {
        return null;
    }

    const configDefaults = configStore?.testConfig?.defaults || {};
    const configuredFte = Array.isArray(configDefaults.fteResources) ? configDefaults.fteResources : [];
    const configuredEquipment = Array.isArray(configDefaults.equipmentResources) ? configDefaults.equipmentResources : [];
    const defaultFteRequired = normalizeRequiredCount(configDefaults.fteRequired, 1);
    const defaultEquipmentRequired = normalizeRequiredCount(configDefaults.equipmentRequired, 1);
    const fteResources = Array.isArray(configStore?.fte?.resources) ? configStore.fte.resources : [];
    const equipmentResources = Array.isArray(configStore?.equipment?.resources) ? configStore.equipment.resources : [];
    const fteAliases = configStore?.fte?.aliases || {};
    const equipmentAliases = configStore?.equipment?.aliases || {};

    const fallbackFteId = normalizeAssignedResourceId(
        configuredFte[0] || fteResources[0]?.id || 'default',
        'fte_',
        'fte_default'
    );
    const fallbackEquipmentId = normalizeAssignedResourceId(
        configuredEquipment[0] || equipmentResources[0]?.id || 'default',
        'setup_',
        'setup_default'
    );

    const globalResolvedFteAssignments = resolveConfiguredResourceIds({
        selectedIds: configuredFte,
        aliases: fteAliases,
        prefix: 'fte_',
        fallbackId: fallbackFteId
    });
    const globalResolvedEquipmentAssignments = resolveConfiguredResourceIds({
        selectedIds: configuredEquipment,
        aliases: equipmentAliases,
        prefix: 'setup_',
        fallbackId: fallbackEquipmentId
    });

    const ftePoolSet = new Set(
        normalizeResourcePool(
            [...globalResolvedFteAssignments, ...fteResources.map((resource) => resource?.id)],
            'fte_',
            fallbackFteId
        )
    );
    const equipmentPoolSet = new Set(
        normalizeResourcePool(
            [...globalResolvedEquipmentAssignments, ...equipmentResources.map((resource) => resource?.id)],
            'setup_',
            fallbackEquipmentId
        )
    );

    const legsRows = [];
    const testsRows = [];
    const testDutRows = [];
    const seenLegs = new Set();
    const sequenceByLeg = new Map();
    let dutCounter = 1;

    const getCell = (row, index) => {
        if (!Array.isArray(row) || index < 0 || index >= row.length) return '';
        return String(row[index] ?? '').trim();
    };

    csvData.rows.forEach((row) => {
        const project = getCell(row, projectIdx) || 'project';
        const leg = getCell(row, legIdx) || '1';
        const branch = branchIdx >= 0 ? getCell(row, branchIdx) : '';
        const testName = getCell(row, testIdx) || 'test';
        const description = descriptionIdx >= 0 ? getCell(row, descriptionIdx) : testName;
        const parsedDuration = Number(getCell(row, durationIdx));
        const durationDays = Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 1.0;

        const projectSlug = slugifyIdentifier(project) || 'project';
        const legSlug = slugifyIdentifier(leg) || 'leg';
        const branchSlug = slugifyIdentifier(branch);
        const projectLegId = branchSlug
            ? `${projectSlug}_${legSlug}_${branchSlug}`
            : `${projectSlug}_${legSlug}`;
        const legKey = projectLegId;

        if (!seenLegs.has(legKey)) {
            seenLegs.add(legKey);
            legsRows.push([
                projectSlug,
                project,
                projectLegId,
                leg,
                branch ? `Leg ${leg} (${branch})` : `Leg ${leg}`,
                1,
                DEFAULT_RESOURCE_START_WEEK
            ]);
        }

        const nextSequence = (sequenceByLeg.get(projectLegId) || 0) + 1;
        sequenceByLeg.set(projectLegId, nextSequence);

        const testSlug = slugifyIdentifier(testName) || 'test';
        const testId = `${projectLegId}_${testSlug}_${nextSequence}`;
        const resolvedConfigTestId = buildResolvedConfigTestId(project, leg, branch, nextSequence, testName);
        const fteRequired = getResolvedRequiredCount(configStore, [resolvedConfigTestId, testId], 'fteRequired', defaultFteRequired);
        const equipmentRequired = getResolvedRequiredCount(configStore, [resolvedConfigTestId, testId], 'equipmentRequired', defaultEquipmentRequired);
        const selectedFte = getResolvedResourceSelection(
            configStore,
            [resolvedConfigTestId, testId],
            'fteResources',
            configuredFte
        );
        const selectedEquipment = getResolvedResourceSelection(
            configStore,
            [resolvedConfigTestId, testId],
            'equipmentResources',
            configuredEquipment
        );
        const resolvedFteAssignments = resolveConfiguredResourceIds({
            selectedIds: selectedFte,
            aliases: fteAliases,
            prefix: 'fte_',
            fallbackId: fallbackFteId
        });
        const resolvedEquipmentAssignments = resolveConfiguredResourceIds({
            selectedIds: selectedEquipment,
            aliases: equipmentAliases,
            prefix: 'setup_',
            fallbackId: fallbackEquipmentId
        });
        const assignedFte = resolvedFteAssignments.length > 0
            ? resolvedFteAssignments.join(';')
            : (fteRequired > 0 ? 'fte_unassigned' : '*');
        const assignedEquipment = resolvedEquipmentAssignments.length > 0
            ? resolvedEquipmentAssignments.join(';')
            : (equipmentRequired > 0 ? 'setup_unassigned' : '*');

        resolvedFteAssignments.forEach((id) => ftePoolSet.add(id));
        resolvedEquipmentAssignments.forEach((id) => equipmentPoolSet.add(id));

        testsRows.push([
            projectLegId,
            testId,
            testName,
            description || testName,
            durationDays,
            fteRequired,
            equipmentRequired,
            assignedFte,
            assignedEquipment,
            nextSequence
        ]);
        testDutRows.push([testId, dutCounter]);
        dutCounter += 1;
    });

    if (legsRows.length === 0 || testsRows.length === 0) {
        return null;
    }

    const fteAvailability = buildResourceAvailabilityTable({
        resourceIds: Array.from(ftePoolSet),
        resources: fteResources,
        holidays: configStore?.fte?.holidays || [],
        prefix: 'fte_'
    });
    const equipmentAvailability = buildResourceAvailabilityTable({
        resourceIds: Array.from(equipmentPoolSet),
        resources: equipmentResources,
        holidays: configStore?.equipment?.holidays || [],
        prefix: 'setup_'
    });

    const normalizeResourceTable = (tableData, idHeader) => {
        if (!tableData || !Array.isArray(tableData.headers) || !Array.isArray(tableData.rows)) {
            return {
                headers: [idHeader, 'available_start_week_iso', 'available_end_week_iso'],
                rows: []
            };
        }
        const headers = [...tableData.headers];
        if (headers[0] === 'resource_id') {
            headers[0] = idHeader;
        }
        return {
            headers,
            rows: tableData.rows.map((row) => (Array.isArray(row) ? [...row] : []))
        };
    };

    return {
        legs: {
            headers: [
                'project_id',
                'project_name',
                'project_leg_id',
                'leg_number',
                'leg_name',
                'priority',
                'start_iso_week'
            ],
            rows: legsRows
        },
        tests: {
            headers: [
                'project_leg_id',
                'test_id',
                'test',
                'test_description',
                'duration_days',
                'fte_required',
                'equipment_required',
                'fte_assigned',
                'equipment_assigned',
                'sequence_index'
            ],
            rows: testsRows
        },
        fte: normalizeResourceTable(fteAvailability, 'fte_id'),
        equipment: normalizeResourceTable(equipmentAvailability, 'equipment_id'),
        test_duts: {
            headers: ['test_id', 'dut_id'],
            rows: testDutRows
        }
    };
}

function isMigratedTestsTableShape(tableData) {
    if (!Array.isArray(tableData?.headers)) {
        return false;
    }
    const headerSet = new Set(
        tableData.headers.map((header) => String(header || '').trim().toLowerCase())
    );
    return (
        headerSet.has('project') &&
        headerSet.has('leg') &&
        headerSet.has('test') &&
        headerSet.has('duration_days') &&
        !headerSet.has('project_leg_id') &&
        !headerSet.has('test_id')
    );
}

document.addEventListener('alpine:init', () => {
    Alpine.store('files', {
        // State
        uploadedFiles: [],
        parsedCsvData: {},
        selectedCsv: '',
        activeCsvData: { headers: [], rows: [] },
        baseFolderPath: '',
        sessionId: null,
        importedConfig: null,
        isLoading: false,
        error: null,
        isInitialized: false,

        // Initialization
        init() {
            try {
                if (this.isInitialized) {
                    console.log('[fileStore] Already initialized, skipping');
                    return;
                }
                console.log('File store initialized');
                this.loadFromLocalStorage();
                this.loadDirectUploadsFromLocalStorage();
                this.isInitialized = true;
            } catch (error) {
                console.error('FileStore init failed:', error);
                this.error = 'Failed to initialize file storage';
            }
        },

        // Load from localStorage
        loadFromLocalStorage() {
            try {
                console.log('[fileStore] Loading from localStorage...');
                console.log('[fileStore] Current uploadedFiles count:', this.uploadedFiles.length);
                console.log('[fileStore] Current uploadedFiles:', this.uploadedFiles.map(f => f.name));

                const savedData = localStorage.getItem(FILE_STORAGE_KEYS.PARSED_CSV_DATA);
                if (savedData) {
                    this.parsedCsvData = JSON.parse(savedData);
                    this.uploadedFiles = Object.keys(this.parsedCsvData).map(name => ({
                        name: name,
                        size: 0,
                        lastModified: Date.now()
                    }));
                }

                const savedSelected = localStorage.getItem(FILE_STORAGE_KEYS.SELECTED_CSV);
                if (savedSelected) {
                    this.selectedCsv = savedSelected;
                    if (this.parsedCsvData[this.selectedCsv]) {
                        this.activeCsvData = this.parsedCsvData[this.selectedCsv];
                    }
                }

                const savedBaseFolderPath = localStorage.getItem(FILE_STORAGE_KEYS.BASE_FOLDER_PATH);
                if (savedBaseFolderPath) {
                    this.baseFolderPath = savedBaseFolderPath;
                }

                const savedSessionId = localStorage.getItem(FILE_STORAGE_KEYS.SESSION_ID);
                if (savedSessionId) {
                    this.sessionId = savedSessionId;
                }

                console.log('[fileStore] After loading, uploadedFiles count:', this.uploadedFiles.length);
                console.log('[fileStore] After loading, uploadedFiles:', this.uploadedFiles.map(f => f.name));
            } catch (error) {
                console.error('Failed to load from localStorage:', error);
                this.error = 'Failed to load saved files';
            }
        },

        // Save to localStorage
        saveToLocalStorage() {
            try {
                localStorage.setItem(FILE_STORAGE_KEYS.PARSED_CSV_DATA, JSON.stringify(this.parsedCsvData));
                localStorage.setItem(FILE_STORAGE_KEYS.SELECTED_CSV, this.selectedCsv);
                localStorage.setItem(FILE_STORAGE_KEYS.BASE_FOLDER_PATH, this.baseFolderPath || '');
                if (this.sessionId) {
                    localStorage.setItem(FILE_STORAGE_KEYS.SESSION_ID, this.sessionId);
                } else {
                    localStorage.removeItem(FILE_STORAGE_KEYS.SESSION_ID);
                }
            } catch (error) {
                console.error('Failed to save to localStorage:', error);
                this.error = 'Failed to save files';
            }
        },

        setBaseFolderPath(folderPath) {
            this.baseFolderPath = String(folderPath || '').trim();
            this.saveToLocalStorage();
        },

        hasImportedFolder() {
            return Boolean(this.sessionId) && this.hasFiles();
        },

        async importFolder() {
            this.error = null;
            this.isLoading = true;

            try {
                const folderPath = String(this.baseFolderPath || '').trim();
                if (!folderPath) {
                    throw new Error('Folder path is required.');
                }

                if (!window.apiService) {
                    throw new Error('Backend API service is unavailable.');
                }

                const sessionResponse = await window.apiService.createRunSession({
                    name: 'Folder Session',
                    source: 'ui_v2_exp'
                });
                const sessionId = sessionResponse.session_id || sessionResponse.sessionId;
                if (!sessionId) {
                    throw new Error('Backend did not return a session ID.');
                }

                const importResponse = await window.apiService.importSessionInputsFromFolder(
                    sessionId,
                    folderPath
                );

                const importedCsvFiles = importResponse.csv_files || {};
                const parsedCsvData = {};
                const existingNames = new Set();
                const dedupedUploadedFiles = [];

                this.uploadedFiles.forEach((file) => {
                    if (!file || !file.name || existingNames.has(file.name)) {
                        return;
                    }
                    existingNames.add(file.name);
                    dedupedUploadedFiles.push(file);
                });

                Object.entries(importedCsvFiles).forEach(([fileName, fileContent]) => {
                    // Skip duplicates - only add if not already in uploadedFiles
                    if (!existingNames.has(fileName)) {
                        parsedCsvData[fileName] = parseCsvText(fileContent);
                    }
                });

                // Dedupe: only add new files that weren't already present
                const newFileNames = Object.keys(parsedCsvData);
                this.parsedCsvData = {
                    ...this.parsedCsvData,
                    ...parsedCsvData
                };
                this.uploadedFiles = [
                    ...dedupedUploadedFiles,
                    ...newFileNames.map((name) => ({
                        name,
                        size: (importedCsvFiles[name] || '').length,
                        lastModified: Date.now()
                    }))
                ];
                this.selectedCsv = this.uploadedFiles.length > 0 ? this.uploadedFiles[0].name : '';
                this.activeCsvData = this.selectedCsv ? this.parsedCsvData[this.selectedCsv] : { headers: [], rows: [] };
                this.sessionId = sessionId;
                this.baseFolderPath = importResponse.folder_path || folderPath;
                this.importedConfig = importResponse.priority_config || null;
                this.saveToLocalStorage();

                // Phase 6: Update CSV entities in config store for validation
                const configStore = typeof Alpine !== 'undefined' && Alpine.store ? Alpine.store('config') : null;
                if (configStore) {
                    configStore.updateCsvEntities(this.parsedCsvData);
                    if (this.selectedCsv && this.parsedCsvData[this.selectedCsv]) {
                        configStore.syncConfigFromSelectedCsv(this.parsedCsvData[this.selectedCsv]);
                    }
                }

                if (this.importedConfig && configStore && typeof configStore.loadJsonConfiguration === 'function') {
                    configStore.loadJsonConfiguration(this.importedConfig);
                }
            } catch (error) {
                this.error = error?.message || 'Failed to import inputs from folder.';
                this.sessionId = null;
            } finally {
                this.isLoading = false;
            }
        },

        getCurrentSessionId() {
            return this.sessionId;
        },

        getCurrentFolderPath() {
            return this.baseFolderPath;
        },

        // Select a CSV file as the active spreadsheet (triggers validation)
        async selectCsvAsActive(filename) {
            if (this.parsedCsvData[filename]) {
                // First select locally
                this.selectedCsv = filename;
                this.activeCsvData = this.parsedCsvData[filename];
                this.syncConfigFromSelectedCsv();
                
                // Get CSV content for backend validation
                const csvContent = Papa.unparse({
                    fields: this.activeCsvData.headers,
                    data: this.activeCsvData.rows
                });

                // Validate via backend
                const validationStore = Alpine.store('validation');
                if (validationStore) {
                    const result = await validationStore.setActiveSpreadsheet(filename, csvContent);
                    
                    // If validation fails, keep the file selected but downstream actions are blocked
                    if (!result.success) {
                        console.warn('[fileStore] Validation failed for active spreadsheet:', result.errors);
                    }
                }
                
                this.saveToLocalStorage();
                return true;
            }
            return false;
        },

        // Select a CSV file (local only, no validation - legacy behavior)
        selectCsv(filename) {
            if (this.parsedCsvData[filename]) {
                this.selectedCsv = filename;
                this.activeCsvData = this.parsedCsvData[filename];
                this.syncConfigFromSelectedCsv();
                this.saveToLocalStorage();
                return true;
            }
            return false;
        },

        // Backward-compatible alias used by upload flows
        setSelectedCsv(filename) {
            if (!this.parsedCsvData[filename]) {
                return false;
            }
            this.selectedCsv = filename;
            this.activeCsvData = this.parsedCsvData[filename];
            this.syncConfigFromSelectedCsv();
            this.saveToLocalStorage();
            return true;
        },

        syncConfigFromSelectedCsv() {
            const configStore = typeof Alpine !== 'undefined' && Alpine.store ? Alpine.store('config') : null;
            if (!configStore || !this.selectedCsv || !this.parsedCsvData[this.selectedCsv]) {
                return false;
            }

            configStore.updateCsvEntities({ [this.selectedCsv]: this.parsedCsvData[this.selectedCsv] });
            return configStore.syncConfigFromSelectedCsv(this.parsedCsvData[this.selectedCsv]);
        },

        // Display CSV data in table format
        displayCsvData() {
            if (this.selectedCsv && this.parsedCsvData[this.selectedCsv]) {
                this.activeCsvData = this.parsedCsvData[this.selectedCsv];
                return true;
            } else {
                this.activeCsvData = { headers: [], rows: [] };
                return false;
            }
        },

        // Remove a file
        removeFile(filename) {
            this.uploadedFiles = this.uploadedFiles.filter(file => file.name !== filename);

            if (this.selectedCsv === filename) {
                this.selectedCsv = '';
                this.activeCsvData = { headers: [], rows: [] };
                
                // Clear validation when active file is removed
                const validationStore = Alpine.store('validation');
                if (validationStore) {
                    validationStore.clearActiveSpreadsheet();
                }
            }

            delete this.parsedCsvData[filename];
            this.saveToLocalStorage();
        },

        // Clear all files
        clearAllFiles() {
            console.log('[fileStore] Clearing all files and localStorage');
            console.log('[fileStore] Before clear - uploadedFiles count:', this.uploadedFiles.length);
            console.log('[fileStore] Before clear - parsedCsvData keys:', Object.keys(this.parsedCsvData));

            this.uploadedFiles = [];
            this.parsedCsvData = {};
            this.selectedCsv = '';
            this.activeCsvData = { headers: [], rows: [] };
            
            // Clear uploaded files storage (for drag-drop uploads)
            localStorage.removeItem('ui_v2_exp__files__directUploads');
            this.directUploads = [];
            
            // Clear validation
            const validationStore = Alpine.store('validation');
            if (validationStore) {
                validationStore.clearActiveSpreadsheet();
            }
            
            // Clear localStorage items
            localStorage.removeItem(FILE_STORAGE_KEYS.PARSED_CSV_DATA);
            localStorage.removeItem(FILE_STORAGE_KEYS.SELECTED_CSV);
            localStorage.removeItem(FILE_STORAGE_KEYS.BASE_FOLDER_PATH);
            localStorage.removeItem(FILE_STORAGE_KEYS.SESSION_ID);
            this.baseFolderPath = '';
            this.sessionId = null;
            this.importedConfig = null;

            console.log('[fileStore] After clear - uploadedFiles count:', this.uploadedFiles.length);
            console.log('[fileStore] localStorage cleared');
        },

        // Get file count
        getFileCount() {
            return this.uploadedFiles.length;
        },

        // Check if files are available
        hasFiles() {
            return this.uploadedFiles.length > 0;
        },

        // Get parsed data for all files
        getAllParsedData() {
            return this.parsedCsvData;
        },

        // Legacy getter retained for batch/editor compatibility.
        getSolverInputData() {
            const csvFiles = {};

            for (const [filename, data] of Object.entries(this.parsedCsvData || {})) {
                if (data.headers && data.rows) {
                    const csvContent = Papa.unparse({
                        fields: data.headers,
                        data: data.rows
                    });
                    csvFiles[filename] = csvContent;
                }
            }

            return csvFiles;
        },

        // JSON-first input payload for solver execution APIs.
        getSolverInputPayload() {
            const tables = {};
            const configStore = typeof Alpine !== 'undefined' && Alpine.store ? Alpine.store('config') : null;

            for (const [filename, data] of Object.entries(this.parsedCsvData || {})) {
                if (!Array.isArray(data?.headers) || !Array.isArray(data?.rows)) {
                    continue;
                }

                const inferredKey = inferSolverTableKey(filename, data);
                if (!inferredKey) {
                    continue;
                }

                tables[inferredKey] = {
                    headers: [...data.headers],
                    rows: data.rows.map((row) => (Array.isArray(row) ? [...row] : [])),
                    source_filename: filename
                };
            }

            if (isMigratedTestsTableShape(tables.tests)) {
                const sourceFilename = tables.tests.source_filename || this.selectedCsv || '';
                const sourceData = sourceFilename ? this.parsedCsvData[sourceFilename] : null;
                const migratedTables = sourceData ? parseMigratedCsvTables(sourceData, configStore) : null;
                if (migratedTables?.tests) {
                    tables.tests = {
                        ...migratedTables.tests,
                        source_filename: sourceFilename || tables.tests.source_filename
                    };
                    ['legs', 'fte', 'equipment', 'test_duts'].forEach((tableKey) => {
                        if (!tables[tableKey] && migratedTables[tableKey]) {
                            tables[tableKey] = {
                                ...migratedTables[tableKey],
                                source_filename: sourceFilename
                            };
                        }
                    });
                }
            }

            const requiredSolverTables = ['legs', 'tests', 'fte', 'equipment', 'test_duts'];
            const missingRequiredTables = requiredSolverTables.filter((tableKey) => !tables[tableKey]);

            if (missingRequiredTables.length > 0) {
                const candidateNames = [
                    this.selectedCsv,
                    ...Object.keys(this.parsedCsvData || {}).filter((name) => name !== this.selectedCsv)
                ].filter(Boolean);

                for (const candidateName of candidateNames) {
                    const candidateData = this.parsedCsvData[candidateName];
                    if (!candidateData) {
                        continue;
                    }
                    const migratedTables = parseMigratedCsvTables(candidateData, configStore);
                    if (!migratedTables) {
                        continue;
                    }
                    Object.entries(migratedTables).forEach(([tableKey, tableValue]) => {
                        if (!tables[tableKey]) {
                            tables[tableKey] = {
                                ...tableValue,
                                source_filename: candidateName
                            };
                        }
                    });
                    const stillMissing = requiredSolverTables.some((tableKey) => !tables[tableKey]);
                    if (!stillMissing) {
                        break;
                    }
                }
            }

            return {
                schema_version: '1.0',
                tables
            };
        },

        getActiveCsvSnapshot() {
            const candidateName = this.selectedCsv || Object.keys(this.parsedCsvData || {})[0] || '';
            if (!candidateName || !this.parsedCsvData[candidateName]) {
                return null;
            }

            const csvData = this.parsedCsvData[candidateName];
            if (!Array.isArray(csvData?.headers) || !Array.isArray(csvData?.rows)) {
                return null;
            }

            const csvText = Papa.unparse({
                fields: csvData.headers,
                data: csvData.rows
            });

            return {
                filename: candidateName,
                csvText
            };
        },

        downloadActiveCsvSnapshot(filename = 'run_data.csv') {
            const snapshot = this.getActiveCsvSnapshot();
            if (!snapshot) {
                return false;
            }
            downloadTextFile(filename, snapshot.csvText, 'text/csv;charset=utf-8');
            return true;
        },

        restoreFromCsvSnapshot(csvText, filename = 'run_data.csv') {
            const parsed = parseCsvText(csvText);
            this.parsedCsvData = {
                [filename]: parsed
            };
            this.uploadedFiles = [{
                name: filename,
                size: String(csvText || '').length,
                lastModified: Date.now()
            }];
            this.selectedCsv = filename;
            this.activeCsvData = parsed;
            this.saveToLocalStorage();
            this.syncConfigFromSelectedCsv();
            return true;
        },

        inferColumnTypes(csvData) {
            return inferColumnTypes(csvData);
        },

        validateCellValueByType(value, columnType) {
            return validateCellValueByType(value, columnType);
        },

        parseTabularText(rawText) {
            return parseTabularText(rawText);
        },

        applyRectangularPaste(rows, startRow, startCol, pastedMatrix, columnCount) {
            return applyRectangularPaste(rows, startRow, startCol, pastedMatrix, columnCount);
        },

        // ========== DIRECT FILE UPLOAD METHODS (Phase A) ==========
        
        // Store for directly uploaded files (not from folder)
        directUploads: [],
        isUploading: false,
        uploadError: null,
        uploadProgress: 0,

        // Upload a single file via API
        async uploadFile(file) {
            console.log('[fileStore] Starting file upload:', file.name);
            this.isUploading = true;
            this.uploadError = null;
            this.uploadProgress = 0;

            try {
                const formData = new FormData();
                formData.append('file', file);
                
                if (this.sessionId) {
                    formData.append('session_id', this.sessionId);
                }

                const response = await window.apiService.uploadFile(formData, (progress) => {
                    this.uploadProgress = progress;
                });

                if (response.success) {
                    // Backend wraps data in "data" field
                    const data = response.data || {};
                    
                    // Add to direct uploads list
                    const uploadInfo = {
                        fileId: data.file_id,
                        filename: data.filename,
                        fileType: data.file_type, // 'spreadsheet' or 'config'
                        extension: data.extension,
                        sizeBytes: data.size_bytes,
                        uploadedAt: new Date().toISOString(),
                        parsedData: data.parsed_data
                    };

                    // Check if file already exists (by name)
                    const existingIndex = this.directUploads.findIndex(u => u.filename === data.filename);
                    if (existingIndex >= 0) {
                        this.directUploads[existingIndex] = uploadInfo;
                    } else {
                        this.directUploads.push(uploadInfo);
                    }

                    // Save to localStorage
                    this.saveDirectUploadsToLocalStorage();

                    // If it's a spreadsheet, also add to parsedCsvData
                    if (data.parsed_data && data.parsed_data.type === 'spreadsheet') {
                        this.parsedCsvData[data.filename] = {
                            headers: data.parsed_data.columns || [],
                            rows: this._convertRecordsToRows(data.parsed_data.data || [], data.parsed_data.columns || []),
                            entities: data.parsed_data.entities
                        };

                        // Use the most recently uploaded spreadsheet as active.
                        this.setSelectedCsv(data.filename);
                        
                        this.saveToLocalStorage();
                        
                        // Dispatch event for other components
                        window.dispatchEvent(new CustomEvent('csv-data-ready', {
                            detail: { filename: data.filename, data: this.parsedCsvData[data.filename] }
                        }));
                    }

                    // If it's a config JSON, store it separately
                    if (data.parsed_data && data.parsed_data.type === 'config') {
                        this.importedConfig = data.parsed_data.content;
                        
                        // Dispatch event for config editor
                        window.dispatchEvent(new CustomEvent('config-json-loaded', {
                            detail: { config: data.parsed_data.content }
                        }));
                    }

                    console.log('[fileStore] File upload successful:', data.filename);
                    return { success: true, data: uploadInfo };
                } else {
                    throw new Error(response.message || 'Upload failed');
                }
            } catch (error) {
                console.error('[fileStore] File upload failed:', error);
                this.uploadError = error.message || 'Upload failed';
                return { success: false, error: this.uploadError };
            } finally {
                this.isUploading = false;
                this.uploadProgress = 0;
            }
        },

        // Upload multiple files
        async uploadMultipleFiles(files) {
            console.log('[fileStore] Starting batch upload of', files.length, 'files');
            const results = [];
            
            for (const file of files) {
                const result = await this.uploadFile(file);
                results.push({ filename: file.name, ...result });
            }
            
            const successful = results.filter(r => r.success);
            const failed = results.filter(r => !r.success);
            
            console.log('[fileStore] Batch upload complete:', successful.length, 'successful,', failed.length, 'failed');
            
            return {
                total: files.length,
                successful: successful.length,
                failed: failed.length,
                results: results
            };
        },

        // Handle drag and drop files
        async handleDropFiles(fileList) {
            console.log('[fileStore] Handling dropped files:', fileList.length);
            const files = Array.from(fileList);
            return await this.uploadMultipleFiles(files);
        },

        // Set active file from uploads
        setActiveUploadedFile(filename) {
            const upload = this.directUploads.find(u => u.filename === filename);
            if (!upload) {
                console.warn('[fileStore] Uploaded file not found:', filename);
                return false;
            }

            // If it's a spreadsheet, select it
            if (upload.fileType === 'spreadsheet' && this.parsedCsvData[filename]) {
                this.setSelectedCsv(filename);
                return true;
            }

            // If it's a config, trigger config load
            if (upload.fileType === 'config' && upload.parsedData?.content) {
                this.importedConfig = upload.parsedData.content;
                window.dispatchEvent(new CustomEvent('config-json-loaded', {
                    detail: { config: upload.parsedData.content, filename: filename }
                }));
                return true;
            }

            return false;
        },

        // Remove uploaded file
        removeUploadedFile(filename) {
            console.log('[fileStore] Removing uploaded file:', filename);
            
            // Remove from direct uploads
            this.directUploads = this.directUploads.filter(u => u.filename !== filename);
            
            // Remove from parsed data
            if (this.parsedCsvData[filename]) {
                delete this.parsedCsvData[filename];
            }
            
            // Update selection if needed
            if (this.selectedCsv === filename) {
                const remainingFiles = Object.keys(this.parsedCsvData);
                this.selectedCsv = remainingFiles.length > 0 ? remainingFiles[0] : '';
                this.activeCsvData = this.selectedCsv ? this.parsedCsvData[this.selectedCsv] : { headers: [], rows: [] };
                if (this.selectedCsv) {
                    this.syncConfigFromSelectedCsv();
                }
            }
            
            // Save to storage
            this.saveDirectUploadsToLocalStorage();
            this.saveToLocalStorage();
        },

        // Get list of uploaded spreadsheet files
        getUploadedSpreadsheets() {
            return this.directUploads.filter(u => u.fileType === 'spreadsheet');
        },

        // Get list of uploaded config files
        getUploadedConfigs() {
            return this.directUploads.filter(u => u.fileType === 'config');
        },

        // Save direct uploads to localStorage
        saveDirectUploadsToLocalStorage() {
            try {
                localStorage.setItem('ui_v2_exp__files__directUploads', JSON.stringify(this.directUploads));
            } catch (error) {
                console.error('[fileStore] Failed to save direct uploads to localStorage:', error);
            }
        },

        // Load direct uploads from localStorage
        loadDirectUploadsFromLocalStorage() {
            try {
                const saved = localStorage.getItem('ui_v2_exp__files__directUploads');
                if (saved) {
                    this.directUploads = JSON.parse(saved);
                }
            } catch (error) {
                console.error('[fileStore] Failed to load direct uploads from localStorage:', error);
                this.directUploads = [];
            }
        },

        // Get supported file formats
        getSupportedFormats() {
            return ['.csv', '.xlsx', '.xls', '.json'];
        },

        // Validate file type
        isValidFileType(filename) {
            const ext = filename.split('.').pop().toLowerCase();
            return ['csv', 'xlsx', 'xls', 'json'].includes(ext);
        },

        // Helper: Convert records (array of objects) to rows (array of arrays)
        _convertRecordsToRows(records, headers) {
            if (!Array.isArray(records) || !Array.isArray(headers)) {
                return [];
            }
            return records.map(record => 
                headers.map(header => record[header] !== undefined ? String(record[header]) : '')
            );
        }
    });
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        inferColumnTypeFromValues,
        inferColumnTypes,
        validateCellValueByType,
        parseTabularText,
        applyRectangularPaste,
        FILE_STORAGE_KEYS
    };
}
