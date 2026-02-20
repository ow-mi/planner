/** @jest-environment jsdom */
/**
 * solverStore.test.js - Tests for solverStore initialization behavior
 */
import { describe, expect, jest, test } from '@jest/globals';

describe('solverStore', () => {
    async function createSolverStore() {
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

        await import('./solverStore.js');
        document.dispatchEvent(new Event('alpine:init'));
        return global.Alpine.store('solver');
    }

    test('executeSolver should use Alpine stores when $store is unavailable', async () => {
        const solver = await createSolverStore();
        const filesStore = {
            getSolverInputPayload: jest.fn(() => ({
                schema_version: '1.0',
                tables: {
                    tests: { headers: ['test_id'], rows: [['T1']] }
                }
            }))
        };
        const configStore = { getCurrentConfig: jest.fn(() => ({ mode: 'leg_end_dates' })) };
        global.Alpine.store('files', filesStore);
        global.Alpine.store('config', configStore);

        solver.executeSolverApi = jest.fn(async () => ({ execution_id: 'exec-1' }));
        solver.pollStatus = jest.fn();
        solver.$store = undefined;

        await solver.executeSolver();

        expect(filesStore.getSolverInputPayload).toHaveBeenCalled();
        expect(configStore.getCurrentConfig).toHaveBeenCalled();
        expect(solver.executeSolverApi).toHaveBeenCalledTimes(1);
        expect(solver.status).not.toBe('FAILED');
    });

    test('executeSolver should fail fast if required stores are missing', async () => {
        const solver = await createSolverStore();
        global.Alpine.store('files', null);
        global.Alpine.store('config', null);

        await solver.executeSolver();

        expect(solver.status).toBe('FAILED');
        expect(solver.error).toBeTruthy();
        expect(solver.error.message).toMatch(/Stores not initialized/);
    });

    test('handleStreamProgressEvent appends plot-friendly timeline points', async () => {
        const solver = await createSolverStore();
        solver.scenarios = [{ id: 's1', name: 'Run 1', status: 'RUNNING' }];

        solver.handleStreamProgressEvent('s1', {
            type: 'progress',
            progress: { percent: 35, elapsed_seconds: 15.2, phase: 'Running solver' },
            metrics: { makespan: 118, objective_value: 8200 },
            plot_point: { t_seconds: 15.2, makespan: 118, objective: 8200 }
        });

        expect(solver.progress).toBe(35);
        expect(solver.message).toBe('Running... best makespan: 118');
        expect(solver.progressTimeline.length).toBe(1);
        expect(solver.progressTimeline[0]).toEqual({
            t_seconds: 15.2,
            makespan: 118,
            objective: 8200
        });
        expect(solver.scenarios[0].liveResults).toBeTruthy();
        expect(solver.scenarios[0].liveResults.makespan).toBe(118);
        expect(solver.scenarios[0].liveResults.test_schedule).toEqual([]);
    });

    test('stopScenario calls stopExecution endpoint', async () => {
        const solver = await createSolverStore();
        solver.scenarios = [{ id: 's1', name: 'Run 1', status: 'RUNNING', runId: 'exec-stop' }];
        global.window = global.window || {};
        global.window.apiService = {
            stopExecution: jest.fn(async () => ({ accepted: true }))
        };

        await solver.stopScenario('s1');

        expect(global.window.apiService.stopExecution).toHaveBeenCalledWith('exec-stop');
        expect(solver.scenarios[0].status).toBe('QUEUED');
    });

    test('executeSolver does not fail with "No input data found" when migrated payload is present', async () => {
        const solver = await createSolverStore();
        const filesStore = {
            getSolverInputPayload: jest.fn(() => ({
                schema_version: '1.0',
                tables: {
                    legs: { headers: ['project_leg_id'], rows: [['p_1']] },
                    tests: { headers: ['project_leg_id', 'test_id'], rows: [['p_1', 'p_1_t1']] },
                    fte: { headers: ['fte_id'], rows: [['fte_alice']] },
                    equipment: { headers: ['equipment_id'], rows: [['setup_rig_1']] },
                    test_duts: { headers: ['test_id', 'dut_id'], rows: [['p_1_t1', 1]] }
                }
            })),
            getCurrentFolderPath: jest.fn(() => '')
        };
        const configStore = {
            getCurrentConfig: jest.fn(() => ({ mode: 'leg_end_dates', weights: { makespanWeight: 0.2, priorityWeight: 0.8 } }))
        };
        global.Alpine.store('files', filesStore);
        global.Alpine.store('config', configStore);

        solver.executeSolverApi = jest.fn(async () => ({ execution_id: 'exec-2' }));
        solver.startScenarioProgressTracking = jest.fn();

        await solver.executeSolver();

        expect(solver.executeSolverApi).toHaveBeenCalledTimes(1);
        expect(solver.error?.message || '').not.toMatch(/No input data found/);
    });

    test('updateScenarioConfigSnapshot and updateScenarioDataSnapshot persist snapshots', async () => {
        const solver = await createSolverStore();
        const scenario = solver.createNewScenario('Run Snapshot');
        const configSnapshot = { mode: 'leg_end_dates' };
        const dataSnapshot = { filename: 'run_data.csv', csvText: 'a,b\n1,2' };

        global.Alpine.store('config', {
            getRunConfigSnapshot: jest.fn(() => configSnapshot),
            getCurrentConfig: jest.fn(() => ({ mode: 'leg_end_dates' }))
        });
        global.Alpine.store('files', {
            getActiveCsvSnapshot: jest.fn(() => dataSnapshot)
        });

        expect(solver.updateScenarioConfigSnapshot(scenario.id)).toBe(true);
        expect(solver.updateScenarioDataSnapshot(scenario.id)).toBe(true);
        expect(scenario.configSnapshot).toEqual(configSnapshot);
        expect(scenario.dataSnapshot).toEqual(dataSnapshot);
    });

    test('restoreScenarioSnapshots applies config/data with confirmation', async () => {
        const solver = await createSolverStore();
        const scenario = solver.createNewScenario('Run Restore');
        scenario.configSnapshot = { mode: 'leg_end_dates', weights: { makespanWeight: 0.2, priorityWeight: 0.8 } };
        scenario.dataSnapshot = { filename: 'run_data.csv', csvText: 'x,y\n1,2' };

        const applyRunConfigSnapshot = jest.fn();
        const restoreFromCsvSnapshot = jest.fn();
        global.Alpine.store('config', { applyRunConfigSnapshot });
        global.Alpine.store('files', { restoreFromCsvSnapshot });
        global.confirm = jest.fn(() => true);

        const restored = solver.restoreScenarioSnapshots(scenario.id);
        expect(restored).toBe(true);
        expect(applyRunConfigSnapshot).toHaveBeenCalledWith(scenario.configSnapshot);
        expect(restoreFromCsvSnapshot).toHaveBeenCalledWith('x,y\n1,2', 'run_data.csv');
    });

    test('executeSolver captures last solver request payload when debug level is DEBUG', async () => {
        const solver = await createSolverStore();
        const filesStore = {
            getSolverInputPayload: jest.fn(() => ({
                schema_version: '1.0',
                tables: {
                    legs: { headers: ['project_leg_id'], rows: [['p_1']] },
                    tests: { headers: ['project_leg_id', 'test_id'], rows: [['p_1', 'p_1_t1']] },
                    fte: { headers: ['fte_id'], rows: [['fte_alice']] },
                    equipment: { headers: ['equipment_id'], rows: [['setup_rig_1']] },
                    test_duts: { headers: ['test_id', 'dut_id'], rows: [['p_1_t1', 1]] }
                }
            })),
            getCurrentFolderPath: jest.fn(() => '')
        };
        const configStore = {
            getCurrentConfig: jest.fn(() => ({ mode: 'leg_end_dates' }))
        };
        global.Alpine.store('files', filesStore);
        global.Alpine.store('config', configStore);

        solver.startScenarioProgressTracking = jest.fn();
        solver.config.debugLevel = 'DEBUG';
        global.window.apiService = {
            executeSolver: jest.fn(async () => ({ execution_id: 'exec-debug-1' })),
            getLastExecuteSolverPayload: jest.fn(() => ({ debug_payload: true })),
            getLastCanonicalPriorityConfig: jest.fn(() => ({ mode: 'leg_end_dates' }))
        };

        await solver.executeSolver();

        const scenario = solver.getActiveScenario();
        expect(scenario.lastSolverRequest).toBeTruthy();
        expect(scenario.lastSolverRequest.payload).toEqual({ debug_payload: true });
    });

    test('executeSolver clears saved debug payload when debug level is not DEBUG', async () => {
        const solver = await createSolverStore();
        const scenario = solver.createNewScenario('Run');
        solver.scenarios = [scenario];
        solver.activeScenarioId = scenario.id;
        scenario.lastSolverRequest = { capturedAt: '2026-01-01T00:00:00.000Z', payload: { old: true } };

        const filesStore = {
            getSolverInputPayload: jest.fn(() => ({
                schema_version: '1.0',
                tables: {
                    legs: { headers: ['project_leg_id'], rows: [['p_1']] },
                    tests: { headers: ['project_leg_id', 'test_id'], rows: [['p_1', 'p_1_t1']] },
                    fte: { headers: ['fte_id'], rows: [['fte_alice']] },
                    equipment: { headers: ['equipment_id'], rows: [['setup_rig_1']] },
                    test_duts: { headers: ['test_id', 'dut_id'], rows: [['p_1_t1', 1]] }
                }
            })),
            getCurrentFolderPath: jest.fn(() => '')
        };
        const configStore = {
            getCurrentConfig: jest.fn(() => ({ mode: 'leg_end_dates' }))
        };
        global.Alpine.store('files', filesStore);
        global.Alpine.store('config', configStore);
        scenario.configHash = solver.getCurrentConfigHash();

        solver.startScenarioProgressTracking = jest.fn();
        solver.config.debugLevel = 'INFO';
        global.window.apiService = {
            executeSolver: jest.fn(async () => ({ execution_id: 'exec-info-1' })),
            getLastExecuteSolverPayload: jest.fn(() => ({ should_not_be_saved: true })),
            getLastCanonicalPriorityConfig: jest.fn(() => ({ mode: 'leg_end_dates' }))
        };

        await solver.executeSolver();

        expect(scenario.lastSolverRequest).toBeNull();
    });

    test('executeSolver saves debug payload before API failure', async () => {
        const solver = await createSolverStore();
        const scenario = solver.createNewScenario('Run');
        solver.scenarios = [scenario];
        solver.activeScenarioId = scenario.id;

        const filesStore = {
            getSolverInputPayload: jest.fn(() => ({
                schema_version: '1.0',
                tables: {
                    legs: { headers: ['project_leg_id'], rows: [['p_1']] },
                    tests: { headers: ['project_leg_id', 'test_id'], rows: [['p_1', 'p_1_t1']] },
                    fte: { headers: ['fte_id'], rows: [['fte_alice']] },
                    equipment: { headers: ['equipment_id'], rows: [['setup_rig_1']] },
                    test_duts: { headers: ['test_id', 'dut_id'], rows: [['p_1_t1', 1]] }
                }
            })),
            getCurrentFolderPath: jest.fn(() => '')
        };
        const configStore = {
            getCurrentConfig: jest.fn(() => ({ mode: 'leg_end_dates' }))
        };
        global.Alpine.store('files', filesStore);
        global.Alpine.store('config', configStore);
        scenario.configHash = solver.getCurrentConfigHash();

        solver.config.debugLevel = 'DEBUG';
        global.window.apiService = {
            buildExecuteSolverPayload: jest.fn(() => ({ preflight_payload: true })),
            executeSolver: jest.fn(async () => {
                throw new Error('Simulated execute failure');
            }),
            getLastExecuteSolverPayload: jest.fn(() => null),
            getLastCanonicalPriorityConfig: jest.fn(() => ({ mode: 'leg_end_dates' }))
        };

        await solver.executeSolver();

        expect(scenario.lastSolverRequest).toBeTruthy();
        expect(scenario.lastSolverRequest.payload).toEqual({ preflight_payload: true });
        expect(solver.status).toBe('FAILED');
    });

    test('executeSolver fails fast when positive deadline penalties are missing end dates', async () => {
        const solver = await createSolverStore();
        const filesStore = {
            getSolverInputPayload: jest.fn(() => ({
                schema_version: '1.0',
                tables: {
                    legs: { headers: ['project_leg_id'], rows: [['mwcu_2_1']] },
                    tests: { headers: ['project_leg_id', 'test_id'], rows: [['mwcu_2_1', 't1']] },
                    fte: { headers: ['fte_id'], rows: [['fte_alice']] },
                    equipment: { headers: ['equipment_id'], rows: [['setup_rig_1']] },
                    test_duts: { headers: ['test_id', 'dut_id'], rows: [['t1', 1]] }
                }
            })),
            getCurrentFolderPath: jest.fn(() => '')
        };
        const configStore = {
            getCurrentConfig: jest.fn(() => ({
                mode: 'leg_end_dates',
                legDeadlinePenalties: { 'mwcu__2.1': 500000 }
            }))
        };
        global.Alpine.store('files', filesStore);
        global.Alpine.store('config', configStore);

        solver.executeSolverApi = jest.fn(async () => ({ execution_id: 'should-not-run' }));
        solver.startScenarioProgressTracking = jest.fn();

        await solver.executeSolver();

        expect(solver.executeSolverApi).not.toHaveBeenCalled();
        expect(solver.status).toBe('FAILED');
        expect(solver.error?.message || '').toMatch(/positive deadline penalty but no end date/i);
    });
});
