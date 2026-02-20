/** @jest-environment jsdom */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import fs from 'fs';
import path from 'path';

function parseCsvLine(line) {
    const cells = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }
        if (char === ',' && !inQuotes) {
            cells.push(current);
            current = '';
            continue;
        }
        current += char;
    }
    cells.push(current);
    return cells;
}

function csvToRecords(csvContent) {
    const lines = String(csvContent).trim().split(/\r?\n/);
    if (lines.length === 0) return { headers: [], records: [] };
    const headers = parseCsvLine(lines[0]);
    const records = lines.slice(1).map((line) => {
        const values = parseCsvLine(line);
        const record = {};
        headers.forEach((header, index) => {
            record[header] = values[index] ?? '';
        });
        return record;
    });
    return { headers, records };
}

describe('fileStore folder import flow', () => {
    async function createFileStore(configStore = null) {
        jest.resetModules();
        const stores = {};
        global.Alpine = {
            store(name, value) {
                if (arguments.length === 2) {
                    stores[name] = value;
                    return value;
                }
                return stores[name];
            }
        };
        global.Papa = {
            parse: jest.fn((content) => {
                const lines = String(content).trim().split('\n');
                const headers = lines[0].split(',');
                const rows = lines.slice(1).map((line) => line.split(','));
                return {
                    errors: [],
                    meta: { fields: headers },
                    data: rows.map((row) => {
                        const record = {};
                        headers.forEach((header, index) => {
                            record[header] = row[index] ?? '';
                        });
                        return record;
                    })
                };
            }),
            unparse: jest.fn(({ fields = [], data = [] } = {}) => {
                const headerLine = fields.join(',');
                const rows = data.map((row) => (Array.isArray(row) ? row : []).join(','));
                return [headerLine, ...rows].join('\n');
            })
        };

        // Pre-populate config store if provided
        if (configStore) {
            stores.config = configStore;
        }

        await import('./fileStore.js');
        document.dispatchEvent(new Event('alpine:init'));
        return global.Alpine.store('files');
    }

    beforeEach(() => {
        localStorage.clear();
        window.apiService = {
            createRunSession: jest.fn(async () => ({ session_id: 'session-1' })),
            importSessionInputsFromFolder: jest.fn(async () => ({
                folder_path: '/tmp/input-folder',
                csv_files: {
                    'data_test.csv': 'test_id,priority\nT1,1',
                    'data_legs.csv': 'leg_id,priority\nL1,2'
                },
                priority_config: { mode: 'leg_end_dates', weights: { makespan_weight: 0.2, priority_weight: 0.8 } }
            }))
        };
    });

    test('importFolder loads csv files via backend folder endpoint', async () => {
        const files = await createFileStore();
        files.setBaseFolderPath('/tmp/input-folder');

        await files.importFolder();

        expect(window.apiService.createRunSession).toHaveBeenCalled();
        expect(window.apiService.importSessionInputsFromFolder).toHaveBeenCalledWith('session-1', '/tmp/input-folder');
        expect(files.sessionId).toBe('session-1');
        expect(files.baseFolderPath).toBe('/tmp/input-folder');
        expect(Object.keys(files.parsedCsvData)).toEqual(['data_test.csv', 'data_legs.csv']);
        expect(files.selectedCsv).toBe('data_test.csv');
    });

    test('importFolder fails when folder path is missing', async () => {
        const files = await createFileStore();

        await files.importFolder();

        expect(files.error).toMatch(/Folder path is required/);
        expect(window.apiService.createRunSession).not.toHaveBeenCalled();
    });

    test('save/load persistence keeps folder path and session id', async () => {
        const files = await createFileStore();
        files.baseFolderPath = '/tmp/base';
        files.sessionId = 'session-abc';
        files.parsedCsvData = {
            'data_test.csv': { headers: ['a'], rows: [['1']] }
        };
        files.selectedCsv = 'data_test.csv';
        files.saveToLocalStorage();

        const reloaded = await createFileStore();
        reloaded.loadFromLocalStorage();

        expect(reloaded.baseFolderPath).toBe('/tmp/base');
        expect(reloaded.sessionId).toBe('session-abc');
        expect(reloaded.selectedCsv).toBe('data_test.csv');
    });

    test('importFolder loads priority_config.json into configuration store', async () => {
        // Mock the config store with loadJsonConfiguration method
        const mockLoadJsonConfiguration = jest.fn();
        const mockConfigStore = {
            loadJsonConfiguration: mockLoadJsonConfiguration,
            updateCsvEntities: jest.fn(),
            syncConfigFromSelectedCsv: jest.fn()
        };

        const files = await createFileStore(mockConfigStore);
        files.setBaseFolderPath('/tmp/input-folder');

        await files.importFolder();

        // Verify that loadJsonConfiguration was called with the priority_config
        expect(mockLoadJsonConfiguration).toHaveBeenCalledWith({
            mode: 'leg_end_dates',
            weights: { makespan_weight: 0.2, priority_weight: 0.8 }
        });
        expect(files.importedConfig).toEqual({
            mode: 'leg_end_dates',
            weights: { makespan_weight: 0.2, priority_weight: 0.8 }
        });
    });

    test('importFolder handles missing priority_config gracefully', async () => {
        // Mock the config store with loadJsonConfiguration method
        const mockLoadJsonConfiguration = jest.fn();
        const mockConfigStore = {
            loadJsonConfiguration: mockLoadJsonConfiguration,
            updateCsvEntities: jest.fn(),
            syncConfigFromSelectedCsv: jest.fn()
        };

        // Reset apiService to return no priority_config
        window.apiService.importSessionInputsFromFolder = jest.fn(async () => ({
            folder_path: '/tmp/input-folder',
            csv_files: {
                'data_test.csv': 'test_id,priority\nT1,1'
            }
            // No priority_config field
        }));

        const files = await createFileStore(mockConfigStore);
        files.setBaseFolderPath('/tmp/input-folder');

        await files.importFolder();

        // Should not call loadJsonConfiguration when no config is present
        expect(mockLoadJsonConfiguration).not.toHaveBeenCalled();
        expect(files.importedConfig).toBeNull();
    });

    test('getSolverInputPayload maps parsed sheets to canonical solver tables', async () => {
        const files = await createFileStore();
        files.parsedCsvData = {
            'legs_input.csv': { headers: ['project_leg_id'], rows: [['LEG-1']] },
            'tests_input.csv': { headers: ['test_id'], rows: [['T1']] },
            'fte_pool.csv': { headers: ['fte_id'], rows: [['F1']] },
            'equipment_pool.csv': { headers: ['equipment_id'], rows: [['E1']] },
            'dut_assignments.csv': { headers: ['test_id', 'dut_id'], rows: [['T1', 'D1']] }
        };

        const payload = files.getSolverInputPayload();

        expect(payload.schema_version).toBe('1.0');
        expect(Object.keys(payload.tables).sort()).toEqual([
            'equipment',
            'fte',
            'legs',
            'test_duts',
            'tests'
        ]);
        expect(payload.tables.legs.headers).toEqual(['project_leg_id']);
        expect(payload.tables.test_duts.rows).toEqual([['T1', 'D1']]);
    });

    test('upload migrated_data.csv + config defaults expands groups into assignment option lists', async () => {
        const migratedCsvPath = path.join(process.cwd(), '..', 'sample_data', 'migrated_data.csv');
        const migratedCsv = fs.readFileSync(migratedCsvPath, 'utf-8');
        const { headers, records } = csvToRecords(migratedCsv);

        const mockConfigStore = {
            updateCsvEntities: jest.fn(),
            syncConfigFromSelectedCsv: jest.fn(() => true),
            testConfig: {
                defaults: {
                    fteResources: [],
                    equipmentResources: [],
                    fteRequired: 2,
                    equipmentRequired: 3
                }
            },
            fte: { resources: [], aliases: { team_alpha: ['alice', 'bob'] } },
            equipment: { resources: [], aliases: { lab_rigs: ['rig_1', 'rig_2'] } },
            addFteResource(id, name) {
                this.fte.resources.push({ id, name });
            },
            addEquipmentResource(id, name) {
                this.equipment.resources.push({ id, name });
            },
            addDefaultResource(type, resourceId) {
                if (type === 'fte') {
                    this.testConfig.defaults.fteResources.push(resourceId);
                } else {
                    this.testConfig.defaults.equipmentResources.push(resourceId);
                }
            }
        };

        window.apiService.uploadFile = jest.fn(async () => ({
            success: true,
            data: {
                file_id: 'file-1',
                filename: 'migrated_data.csv',
                file_type: 'spreadsheet',
                extension: '.csv',
                size_bytes: migratedCsv.length,
                parsed_data: {
                    type: 'spreadsheet',
                    columns: headers,
                    data: records
                }
            }
        }));

        const files = await createFileStore(mockConfigStore);
        await files.uploadFile({ name: 'migrated_data.csv' });
        files.setSelectedCsv('migrated_data.csv');

        mockConfigStore.addFteResource('alice', 'Alice');
        mockConfigStore.addFteResource('bob', 'Bob');
        mockConfigStore.addEquipmentResource('rig_1', 'Rig 1');
        mockConfigStore.addEquipmentResource('rig_2', 'Rig 2');
        mockConfigStore.addDefaultResource('fte', 'team_alpha');
        mockConfigStore.addDefaultResource('equipment', 'lab_rigs');

        const payload = files.getSolverInputPayload();

        expect(Object.keys(payload.tables).sort()).toEqual([
            'equipment',
            'fte',
            'legs',
            'test_duts',
            'tests'
        ]);
        expect(payload.tables.tests.rows.length).toBeGreaterThan(0);
        expect(payload.tables.tests.rows[0][5]).toBe(2);
        expect(payload.tables.tests.rows[0][6]).toBe(3);
        expect(payload.tables.tests.rows[0][7]).toBe('fte_alice;fte_bob');
        expect(payload.tables.tests.rows[0][8]).toBe('setup_rig_1;setup_rig_2');
    });

    test('migrated CSV uses resolved per-test required counts when config store provides overrides', async () => {
        const mockConfigStore = {
            updateCsvEntities: jest.fn(),
            syncConfigFromSelectedCsv: jest.fn(() => true),
            testConfig: {
                defaults: {
                    fteResources: [],
                    equipmentResources: [],
                    fteRequired: 1,
                    equipmentRequired: 1
                }
            },
            fte: { resources: [], aliases: {} },
            equipment: { resources: [], aliases: {} },
            getResolvedFieldForLevel(level, configId, field) {
                if (level === 'tests' && configId === 'P__L__1__T1') {
                    if (field === 'fteRequired') return { value: 4 };
                    if (field === 'equipmentRequired') return { value: 5 };
                }
                return { value: this.testConfig.defaults[field] };
            }
        };

        const files = await createFileStore(mockConfigStore);
        files.parsedCsvData = {
            'migrated_data.csv': {
                headers: ['project', 'leg', 'test', 'duration_days', 'description'],
                rows: [['P', 'L', 'T1', '3', 'desc']]
            }
        };
        files.selectedCsv = 'migrated_data.csv';

        const payload = files.getSolverInputPayload();

        expect(payload.tables.tests.rows).toHaveLength(1);
        expect(payload.tables.tests.rows[0][5]).toBe(4);
        expect(payload.tables.tests.rows[0][6]).toBe(5);
    });

    test('getSolverInputPayload normalizes migrated tests even when all required tables already exist', async () => {
        const files = await createFileStore();
        files.parsedCsvData = {
            'data_test.csv': {
                headers: ['project', 'leg', 'branch', 'test', 'duration_days', 'description', 'next_leg'],
                rows: [['mwcu', '2.1', '', 'Leak', '3.6', 'Leak', '']]
            },
            'data_legs.csv': {
                headers: ['project_id', 'project_name', 'project_leg_id', 'leg_number', 'leg_name', 'priority', 'start_iso_week'],
                rows: [['mwcu', 'mwcu', 'mwcu_2_1', '2.1', 'Leg 2.1', 1, '2025-W01']]
            },
            'data_fte.csv': {
                headers: ['fte_id', 'available_start_week_iso', 'available_end_week_iso'],
                rows: [['fte_a', '2025-W01', '2035-W52']]
            },
            'data_equipment.csv': {
                headers: ['equipment_id', 'available_start_week_iso', 'available_end_week_iso'],
                rows: [['setup_a', '2025-W01', '2035-W52']]
            },
            'data_test_duts.csv': {
                headers: ['test_id', 'dut_id'],
                rows: [['mwcu_2_1_leak_1', 1]]
            }
        };
        files.selectedCsv = 'data_test.csv';

        const payload = files.getSolverInputPayload();

        expect(payload.tables.tests.headers[0]).toBe('project_leg_id');
        expect(payload.tables.tests.headers[1]).toBe('test_id');
        expect(payload.tables.tests.rows[0][0]).toBe('mwcu_2_1');
    });

    test('migrated CSV converts FTE holidays/day-off into date availability windows', async () => {
        const mockConfigStore = {
            updateCsvEntities: jest.fn(),
            syncConfigFromSelectedCsv: jest.fn(() => true),
            testConfig: {
                defaults: {
                    fteResources: ['alice'],
                    equipmentResources: ['rig_1'],
                    fteRequired: 1,
                    equipmentRequired: 1
                }
            },
            fte: {
                resources: [{
                    id: 'alice',
                    name: 'Alice',
                    calendar: {
                        2025: {
                            '2025-01-20': false
                        }
                    }
                }],
                holidays: [{
                    startDate: '2025-01-06',
                    endDate: '2025-01-12',
                    name: 'holiday'
                }],
                aliases: {}
            },
            equipment: {
                resources: [{ id: 'rig_1', name: 'Rig 1', calendar: {} }],
                holidays: [],
                aliases: {}
            }
        };

        const files = await createFileStore(mockConfigStore);
        files.parsedCsvData = {
            'migrated_data.csv': {
                headers: ['project', 'leg', 'test', 'duration_days', 'description'],
                rows: [['P', 'L', 'T1', '3', 'desc']]
            }
        };
        files.selectedCsv = 'migrated_data.csv';

        const payload = files.getSolverInputPayload();
        const fteTable = payload.tables.fte;
        expect(fteTable.headers).toEqual(['fte_id', 'available_start_date', 'available_end_date_exclusive']);

        const aliceRows = (fteTable.rows || []).filter((row) => row[0] === 'fte_alice');
        expect(aliceRows.length).toBeGreaterThan(0);

        const blockedDates = ['2025-01-08', '2025-01-20'];
        const includesBlockedDate = (targetDate, interval) => {
            const start = new Date(`${interval[1]}T00:00:00Z`).getTime();
            const endExclusive = new Date(`${interval[2]}T00:00:00Z`).getTime();
            const current = new Date(`${targetDate}T00:00:00Z`).getTime();
            return current >= start && current < endExclusive;
        };

        blockedDates.forEach((blockedDate) => {
            const covered = aliceRows.some((row) => includesBlockedDate(blockedDate, row));
            expect(covered).toBe(false);
        });
    });

    test('migrated CSV applies day-off calendar for hyphenated resource IDs', async () => {
        const mockConfigStore = {
            updateCsvEntities: jest.fn(),
            syncConfigFromSelectedCsv: jest.fn(() => true),
            testConfig: {
                defaults: {
                    fteResources: ['fte-abc-1'],
                    equipmentResources: ['rig_1'],
                    fteRequired: 1,
                    equipmentRequired: 1
                }
            },
            fte: {
                resources: [{
                    id: 'fte-abc-1',
                    name: 'A',
                    calendar: { '2025-01-20': false }
                }],
                holidays: [],
                aliases: {}
            },
            equipment: {
                resources: [{ id: 'rig_1', name: 'Rig 1', calendar: {} }],
                holidays: [],
                aliases: {}
            }
        };

        const files = await createFileStore(mockConfigStore);
        files.parsedCsvData = {
            'migrated_data.csv': {
                headers: ['project', 'leg', 'test', 'duration_days', 'description'],
                rows: [['P', 'L', 'T1', '2', 'desc']]
            }
        };
        files.selectedCsv = 'migrated_data.csv';

        const payload = files.getSolverInputPayload();
        const fteRows = payload.tables.fte.rows || [];
        const targetRows = fteRows.filter((row) => row[0] === 'fte_fte_abc_1');
        expect(targetRows.length).toBeGreaterThan(0);

        const blocked = new Date('2025-01-20T00:00:00Z').getTime();
        const covered = targetRows.some((row) => {
            const start = new Date(`${row[1]}T00:00:00Z`).getTime();
            const end = new Date(`${row[2]}T00:00:00Z`).getTime();
            return blocked >= start && blocked < end;
        });
        expect(covered).toBe(false);
    });

    test('exports and restores CSV snapshot', async () => {
        const files = await createFileStore();
        files.parsedCsvData = {
            'edited.csv': {
                headers: ['project', 'leg', 'test'],
                rows: [['gen3', '1', 'T1']]
            }
        };
        files.selectedCsv = 'edited.csv';

        const snapshot = files.getActiveCsvSnapshot();
        expect(snapshot).toBeTruthy();
        expect(snapshot.filename).toBe('edited.csv');
        expect(snapshot.csvText).toContain('project,leg,test');

        files.restoreFromCsvSnapshot('a,b\n1,2', 'run_data.csv');
        expect(Object.keys(files.parsedCsvData)).toEqual(['run_data.csv']);
        expect(files.selectedCsv).toBe('run_data.csv');
        expect(files.parsedCsvData['run_data.csv'].headers).toEqual(['a', 'b']);
    });
});
