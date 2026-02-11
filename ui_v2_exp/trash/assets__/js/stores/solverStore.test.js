/**
 * solverStore.test.js - Tests for solverStore initialization behavior
 */

describe('solverStore', () => {
    const path = require('path');
    const solverStorePath = path.join(process.cwd(), 'ui_v2_exp', 'assets', 'js', 'stores', 'solverStore.js');

    function createSolverStore() {
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

        require(solverStorePath);
        document.dispatchEvent(new Event('alpine:init'));
        return global.Alpine.store('solver');
    }

    test('executeSolver should use Alpine stores when $store is unavailable', async () => {
        const solver = createSolverStore();
        const filesStore = { getSolverInputData: jest.fn(() => ({ 'input.csv': 'a,b' })) };
        const configStore = { getCurrentConfig: jest.fn(() => ({ mode: 'leg_end_dates' })) };
        global.Alpine.store('files', filesStore);
        global.Alpine.store('config', configStore);

        solver.executeSolverApi = jest.fn(async () => ({ execution_id: 'exec-1' }));
        solver.pollStatus = jest.fn();
        solver.$store = undefined;

        await solver.executeSolver();

        expect(filesStore.getSolverInputData).toHaveBeenCalled();
        expect(configStore.getCurrentConfig).toHaveBeenCalled();
        expect(solver.executeSolverApi).toHaveBeenCalledTimes(1);
        expect(solver.status).not.toBe('FAILED');
    });

    test('executeSolver should fail fast if required stores are missing', async () => {
        const solver = createSolverStore();
        global.Alpine.store('files', null);
        global.Alpine.store('config', null);

        await solver.executeSolver();

        expect(solver.status).toBe('FAILED');
        expect(solver.error).toBeTruthy();
        expect(solver.error.message).toMatch(/Stores not initialized/);
    });
});
