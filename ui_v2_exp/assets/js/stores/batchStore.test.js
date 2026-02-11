const BatchStore = require('./batchStore');

describe('BatchStore scenario authoring and orchestration', () => {
    let store;
    let apiService;

    beforeEach(() => {
        localStorage.clear();
        apiService = {
            createRunSession: jest.fn().mockResolvedValue({ session_id: 'session-1' }),
            uploadSessionInputs: jest.fn().mockResolvedValue({ uploaded: true }),
            submitBatch: jest.fn().mockResolvedValue({ batch_id: 'batch-1', status: 'queued' }),
            getBatchStatus: jest.fn(),
            getBatchResults: jest.fn().mockResolvedValue({ items: [{ scenario_name: 'Scenario A' }] })
        };

        store = new BatchStore({
            storageKey: 'testBatchState',
            apiService,
            pollIntervalMs: 1
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('adds and validates scenarios locally', () => {
        store.scenarios = [];
        store.addScenario();

        expect(store.scenarios).toHaveLength(1);
        expect(store.scenarios[0]).toEqual({
            name: '',
            time_limit: 300,
            debug_level: 'INFO',
            output_folder: ''
        });

        const validation = store.validateScenarios();
        expect(validation.valid).toBe(false);
        expect(validation.errors[0]).toContain('Scenario 1');
    });

    test('runBatch orchestrates session create, upload, submit, poll and results', async () => {
        store.scenarios = [{
            name: 'Scenario A',
            time_limit: 120,
            debug_level: 'INFO',
            output_folder: ''
        }];
        store.inputs = [{ name: 'input.csv', content: 'a,b\n1,2' }];
        apiService.getBatchStatus
            .mockResolvedValueOnce({ status: 'RUNNING', progress: 35 })
            .mockResolvedValueOnce({ status: 'COMPLETED', progress: 100 });

        await store.runBatch();

        expect(apiService.createRunSession).toHaveBeenCalledWith({
            name: 'Batch Session',
            source: 'ui_v2_exp'
        });
        expect(apiService.uploadSessionInputs).toHaveBeenCalledWith('session-1', {
            files: [{ name: 'input.csv', content: 'a,b\n1,2' }]
        });
        expect(apiService.submitBatch).toHaveBeenCalledWith('session-1', {
            scenarios: [{
                name: 'Scenario A',
                time_limit: 120,
                debug_level: 'INFO',
                output_folder: null
            }]
        });
        expect(apiService.getBatchStatus).toHaveBeenCalledTimes(2);
        expect(apiService.getBatchResults).toHaveBeenCalledWith('batch-1');
        expect(store.status).toBe('COMPLETED');
        expect(store.results).toEqual({ items: [{ scenario_name: 'Scenario A' }] });
    });

    test('setErrorState keeps UI stable when backend request fails', async () => {
        store.scenarios = [{
            name: 'Scenario A',
            time_limit: 120,
            debug_level: 'INFO',
            output_folder: ''
        }];
        apiService.createRunSession.mockRejectedValue(new Error('Endpoint unavailable'));

        await store.runBatch();

        expect(store.status).toBe('FAILED');
        expect(store.error).toBe('Endpoint unavailable');
        expect(store.isLoading).toBe(false);
    });

    test('derives comparison rows with KPI and artifact fields', () => {
        store.scenarios = [
            { name: 'Scenario A', time_limit: 120, debug_level: 'INFO', output_folder: '' },
            { name: 'Scenario B', time_limit: 180, debug_level: 'DEBUG', output_folder: '' }
        ];
        store.results = {
            items: [
                {
                    scenario_name: 'Scenario A',
                    scenario_id: 'scenario-a',
                    status: 'completed',
                    metrics: { makespan: 15, objective: 211.5 },
                    solver_stats: { solve_time: 1.23 },
                    artifacts: {
                        schedule_csv: '/tmp/a/schedule.csv',
                        summary_json: '/tmp/a/summary.json'
                    }
                },
                {
                    name: 'Scenario B',
                    id: 'scenario-b',
                    state: 'failed',
                    objective_value: 300,
                    solve_time_seconds: 9.5,
                    output_files: {
                        'report.txt': 'done'
                    }
                }
            ]
        };

        const rows = store.getComparisonRows();

        expect(rows).toHaveLength(2);
        expect(rows[0]).toMatchObject({
            scenarioLabel: 'Scenario A',
            scenarioId: 'scenario-a',
            status: 'COMPLETED',
            makespan: '15',
            objective: '211.5',
            solveTime: '1.23s'
        });
        expect(rows[0].artifacts).toEqual([
            { label: 'schedule_csv', value: '/tmp/a/schedule.csv' },
            { label: 'summary_json', value: '/tmp/a/summary.json' }
        ]);

        expect(rows[1]).toMatchObject({
            scenarioLabel: 'Scenario B',
            scenarioId: 'scenario-b',
            status: 'FAILED',
            makespan: 'N/A',
            objective: '300',
            solveTime: '9.5s'
        });
        expect(rows[1].artifacts).toEqual([
            { label: 'report.txt', value: 'Available' }
        ]);
    });

    test('uses placeholder values when comparison fields are missing', () => {
        store.scenarios = [
            { name: 'Scenario A', time_limit: 120, debug_level: 'INFO', output_folder: '' },
            { name: 'Scenario B', time_limit: 180, debug_level: 'DEBUG', output_folder: '' }
        ];
        store.results = {
            items: [
                {
                    scenario_name: 'Scenario A'
                }
            ]
        };

        const rows = store.getComparisonRows();

        expect(rows).toHaveLength(2);
        expect(rows[0]).toMatchObject({
            scenarioLabel: 'Scenario A',
            status: 'UNKNOWN',
            makespan: 'N/A',
            objective: 'N/A',
            solveTime: 'N/A',
            artifacts: [{ label: 'Artifacts', value: 'Not available' }]
        });
        expect(rows[1]).toMatchObject({
            scenarioLabel: 'Scenario B',
            status: 'PENDING',
            makespan: 'N/A',
            objective: 'N/A',
            solveTime: 'N/A',
            artifacts: [{ label: 'Artifacts', value: 'Not available' }]
        });
    });
});
