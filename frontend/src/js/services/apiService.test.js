/** @jest-environment jsdom */
import { afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';

let ApiService;

describe('ApiService canonical config mapping', () => {
    let service;
    let originalEventSource;

    class MockEventSource {
        static instances = [];

        constructor(url, options) {
            this.url = url;
            this.options = options;
            this.onmessage = null;
            this.onerror = null;
            this.listeners = {};
            this.closed = false;
            MockEventSource.instances.push(this);
        }

        close() {
            this.closed = true;
        }

        addEventListener(type, handler) {
            if (!this.listeners[type]) {
                this.listeners[type] = [];
            }
            this.listeners[type].push(handler);
        }

        emit(payload) {
            if (typeof this.onmessage === 'function') {
                this.onmessage({ data: JSON.stringify(payload) });
            }
        }

        emitType(type, payload) {
            const handlers = this.listeners[type] || [];
            handlers.forEach((handler) => handler({ data: JSON.stringify(payload) }));
        }
    }

    beforeEach(() => {
        service = new ApiService('http://localhost:8000/api');
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ execution_id: 'exec-123' })
        });
        originalEventSource = global.EventSource;
        global.EventSource = MockEventSource;
        MockEventSource.instances = [];
    });

    afterEach(() => {
        jest.resetAllMocks();
        global.EventSource = originalEventSource;
    });

    beforeAll(async () => {
        await import('./apiService.js');
        ApiService = global.window.apiService.constructor;
    });

    test('maps UI-oriented config shape to canonical backend schema', () => {
        const uiConfig = {
            mode: 'leg_end_dates',
            description: 'ui shape',
            weights: {
                makespan_weight: 0.3,
                priority_weight: 0.7,
                leg_ending_weight: 0.0
            },
            deadlines: [
                { legId: 'leg-1', deadlineDate: '2027-05-01' },
                { legId: 'leg-2', deadlineDate: '2027-06-10' }
            ],
            penaltySettings: {
                deadline_penalty: 25,
                compactness_penalty: 7,
                parallel_within_deadlines: 101
            },
            proximityRules: [
                { pattern: 'P-01', maxgapdays: 4, proximitypenaltyperday: 2, enforce_sequence_order: false },
                { pattern: 'P-02', maxgapdays: 4, proximitypenaltyperday: 2, enforce_sequence_order: true }
            ]
        };

        const mapped = service.toCanonicalPriorityConfig(uiConfig);

        expect(mapped).toEqual({
            mode: 'leg_end_dates',
            description: 'ui shape',
            weights: {
                makespan_weight: 0.3,
                priority_weight: 0.7,
                leg_ending_weight: 0.0
            },
            leg_ending_weight: 0.0,
            leg_deadlines: {
                'leg-1': '2027-05-01',
                'leg-2': '2027-06-10'
            },
            deadline_penalty_per_day: 25,
            leg_compactness_penalty_per_day: 7,
            allow_parallel_within_deadlines: 101,
            test_proximity_rules: {
                patterns: ['P-01', 'P-02'],
                max_gap_days: 4,
                proximity_penalty_per_day: 2,
                enforce_sequence_order: true
            }
        });
    });

    test('maps per-leg deadline and compactness weights from UI deadlines rows', () => {
        const uiConfig = {
            mode: 'leg_end_dates',
            description: 'per-leg penalties',
            weights: {
                makespan_weight: 0.0,
                priority_weight: 1.0
            },
            deadlines: [
                {
                    project: 'mwcu',
                    legId: '2.1',
                    branch: 'a',
                    startEnabled: true,
                    startDeadline: '2027-W16.1',
                    endEnabled: true,
                    endDeadline: '2027-W18.6',
                    deadlinePenalty: 12.5,
                    compactness: 3.5
                }
            ],
            penaltySettings: {
                deadlinePenalty: 1000.0,
                compactnessPenalty: 500.0
            }
        };

        const mapped = service.toCanonicalPriorityConfig(uiConfig);

        expect(mapped.leg_deadlines).toEqual({
            'mwcu__2.1__a': '2027-05-09'
        });
        expect(mapped.leg_start_deadlines).toEqual({
            'mwcu__2.1__a': '2027-04-20'
        });
        expect(mapped.leg_deadline_penalties).toEqual({
            'mwcu__2.1__a': 12.5
        });
        expect(mapped.leg_compactness_penalties).toEqual({
            'mwcu__2.1__a': 3.5
        });
    });

    test('maps configStore camelCase deadline fields to canonical snake_case', () => {
        const configStoreShape = {
            mode: 'leg_end_dates',
            description: 'config store shape',
            weights: { makespanWeight: 0.2, priorityWeight: 0.8, legEndingWeight: 2.5 },
            legDeadlines: { 'mwcu__2.1': '2026-W18.5' },
            legStartDeadlines: { 'mwcu__2.1': '2026-W08.5' },
            legDeadlinePenalties: { 'mwcu__2.1': 1000 },
            legCompactnessPenalties: { 'mwcu__2.1': 0 },
            deadlinePenaltyPerDay: 1000,
            legCompactnessPenaltyPerDay: 500,
            allowParallelWithinDeadlines: 100
        };

        const mapped = service.toCanonicalPriorityConfig(configStoreShape);

        expect(mapped.weights).toEqual({
            makespan_weight: 0.2,
            priority_weight: 0.8,
            leg_ending_weight: 2.5
        });
        expect(mapped.leg_ending_weight).toBe(2.5);
        expect(mapped.leg_deadlines).toEqual({ 'mwcu__2.1': '2026-05-02' });
        expect(mapped.leg_start_deadlines).toEqual({ 'mwcu__2.1': '2026-02-21' });
        expect(mapped.leg_deadline_penalties).toEqual({ 'mwcu__2.1': 1000 });
        expect(mapped.deadline_penalty_per_day).toBe(1000);
        expect(mapped.leg_compactness_penalty_per_day).toBe(500);
        expect(mapped.allow_parallel_within_deadlines).toBe(100);
    });

    test('maps start/end deadlines when values are present even if enabled flags are false', () => {
        const uiConfig = {
            mode: 'leg_end_dates',
            deadlines: [
                {
                    project: 'mwcu',
                    legId: '2.1',
                    startEnabled: false,
                    startDeadline: '2027-04-22',
                    endEnabled: false,
                    endDeadline: '2027-05-10'
                }
            ]
        };

        const mapped = service.toCanonicalPriorityConfig(uiConfig);

        expect(mapped.leg_start_deadlines).toEqual({
            'mwcu__2.1': '2027-04-22'
        });
        expect(mapped.leg_deadlines).toEqual({
            'mwcu__2.1': '2027-05-10'
        });
    });

    test('executeSolver sends canonical config and settings_used', async () => {
        const solverRequest = {
            csv_files: { 'data_test.csv': 'col1,col2\n1,2' },
            input_data: {
                schema_version: '1.0',
                tables: {
                    tests: {
                        headers: ['test_id'],
                        rows: [['T1']]
                    }
                }
            },
            priority_config: {
                mode: 'leg_end_dates',
                description: 'canonical already',
                weights: {
                    makespan_weight: 0.2,
                    priority_weight: 0.8,
                    leg_ending_weight: 0.0
                },
                leg_deadlines: { 'leg-1': '2027-01-01' }
            },
            time_limit: 300,
            debug_level: 'INFO',
            output_folder: null
        };

        await service.executeSolver(solverRequest);

        expect(fetch).toHaveBeenCalledTimes(1);
        const [url, options] = fetch.mock.calls[0];
        expect(url).toBe('http://localhost:8000/api/solver/execute');
        expect(options.method).toBe('POST');
        expect(options.credentials).toBe('include');

        const sentBody = JSON.parse(options.body);
        expect(sentBody.priority_config).toEqual({
            mode: 'leg_end_dates',
            description: 'canonical already',
            weights: {
                makespan_weight: 0.2,
                priority_weight: 0.8,
                leg_ending_weight: 0.0
            },
            leg_ending_weight: 0.0,
            leg_deadlines: {
                'leg-1': '2027-01-01'
            }
        });
        expect(sentBody.settings_used).toEqual(sentBody.priority_config);
        expect(sentBody.input_data).toEqual({
            schema_version: '1.0',
            tables: {
                tests: {
                    headers: ['test_id'],
                    rows: [['T1']]
                }
            }
        });
        expect(sentBody.csv_files).toBeUndefined();
        expect(service.getLastCanonicalPriorityConfig()).toEqual(sentBody.priority_config);
        expect(service.getLastExecuteSolverPayload()).toEqual(sentBody);
    });

    test('executeSolver fails locally when positive per-leg penalties have no deadlines', async () => {
        const solverRequest = {
            input_data: {
                schema_version: '1.0',
                tables: {
                    tests: {
                        headers: ['test_id'],
                        rows: [['T1']]
                    }
                }
            },
            priority_config: {
                mode: 'leg_end_dates',
                leg_deadline_penalties: { 'mwcu__2.1': 500000 }
            }
        };

        await expect(service.executeSolver(solverRequest)).rejects.toMatchObject({
            status: 400
        });
        expect(fetch).not.toHaveBeenCalled();
    });

    test('batch lifecycle methods hit expected endpoints', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ ok: true })
        });

        await service.createRunSession({ name: 'demo-session' });
        await service.importSessionInputsFromFolder('session-123', '/tmp/input-folder');
        await service.submitBatch('session-123', { scenarios: [{ name: 'Scenario A' }] });
        await service.getBatchStatus('batch-123');
        await service.getBatchResults('batch-123');

        expect(fetch.mock.calls[0][0]).toBe('http://localhost:8000/api/runs/sessions');
        expect(fetch.mock.calls[0][1].method).toBe('POST');
        expect(fetch.mock.calls[0][1].credentials).toBe('include');

        expect(fetch.mock.calls[1][0]).toBe('http://localhost:8000/api/runs/sessions/session-123/inputs/import-folder');
        expect(fetch.mock.calls[1][1].method).toBe('POST');
        expect(fetch.mock.calls[1][1].credentials).toBe('include');
        expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ folder_path: '/tmp/input-folder' });

        expect(fetch.mock.calls[2][0]).toBe('http://localhost:8000/api/batch/jobs');
        expect(fetch.mock.calls[2][1].method).toBe('POST');
        expect(fetch.mock.calls[2][1].credentials).toBe('include');
        expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({
            session_id: 'session-123',
            scenarios: [{ name: 'Scenario A' }]
        });

        expect(fetch.mock.calls[3][0]).toContain('/batch/jobs/batch-123/status');
        expect(fetch.mock.calls[3][1].method).toBe('GET');
        expect(fetch.mock.calls[3][1].credentials).toBe('include');
        expect(fetch.mock.calls[4][0]).toContain('/batch/jobs/batch-123/results');
        expect(fetch.mock.calls[4][1].method).toBe('GET');
        expect(fetch.mock.calls[4][1].credentials).toBe('include');
    });

    test('stopExecution uses implemented stop endpoint', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ accepted: true, status: 'CANCELLATION_REQUESTED' })
        });

        const response = await service.stopExecution('exec-999');

        expect(response.accepted).toBe(true);
        expect(fetch).toHaveBeenCalledWith(
            'http://localhost:8000/api/solver/execute/exec-999/stop',
            expect.objectContaining({ method: 'POST' })
        );
    });

    test('streamExecutionProgress dispatches typed event callbacks', () => {
        const onProgress = jest.fn();
        const onStateChanged = jest.fn();
        const onCompleted = jest.fn();
        const onResyncRequired = jest.fn();

        const source = service.streamExecutionProgress('exec-1', {
            onProgress,
            onStateChanged,
            onCompleted,
            onResyncRequired,
            lastEventId: 42
        });

        expect(source.url).toContain('/solver/execute/exec-1/stream?last_event_id=42');

        source.emitType('progress', { type: 'progress', progress: { percent: 10 } });
        source.emitType('state_changed', { type: 'state_changed', status: 'RUNNING' });
        source.emitType('resync_required', { type: 'resync_required' });
        source.emitType('completed', { type: 'completed', status: 'COMPLETED' });

        expect(onProgress).toHaveBeenCalledTimes(1);
        expect(onStateChanged).toHaveBeenCalledTimes(1);
        expect(onResyncRequired).toHaveBeenCalledTimes(1);
        expect(onCompleted).toHaveBeenCalledTimes(1);
    });

    test('handleError normalizes backend validation errors with guidance', () => {
        const normalized = service.handleError({
            status: 400,
            endpoint: '/solver/execute',
            method: 'POST',
            response: {
                detail: 'CSV Validation Error: Missing required file: data_test.csv'
            }
        });

        expect(normalized.message).toMatch(/Invalid request:/);
        expect(normalized.guidance).toMatch(/Review required fields/);
        expect(normalized.debug).toBeDefined();
        expect(normalized.debug.endpoint).toBe('/solver/execute');
    });

    test('toUiError returns structured UI-safe error payload', () => {
        const uiError = service.toUiError(
            Object.assign(new Error('Server error: failed'), {
                status: 500,
                guidance: 'Check backend logs.',
                debug: { detail: 'traceback here', timestamp: '2026-02-19T00:00:00.000Z' }
            }),
            'Execution failed'
        );

        expect(uiError.message).toBe('Server error: failed');
        expect(uiError.guidance).toBe('Check backend logs.');
        expect(uiError.status).toBe(500);
        expect(uiError.debug).toContain('traceback here');
    });

    test('streamRunProgress uses run stream endpoint', () => {
        const source = service.streamRunProgress('run-321');
        expect(source.url).toContain('/solver/runs/run-321/stream');
    });

    test('deprecated queue methods throw explicit errors', async () => {
        await expect(service.addScenarioToQueue()).rejects.toThrow(/Deprecated API/);
        await expect(service.getScenarioQueueStatus()).rejects.toThrow(/Deprecated API/);
    });

    test('does not provide browser upload endpoint helper', () => {
        expect(typeof service.uploadSessionInputs).toBe('undefined');
    });
});
