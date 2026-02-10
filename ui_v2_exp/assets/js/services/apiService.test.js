const ApiService = require('./apiService');

describe('ApiService canonical config mapping', () => {
    let service;

    beforeEach(() => {
        service = new ApiService('http://localhost:8000/api');
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ execution_id: 'exec-123' })
        });
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    test('maps UI-oriented config shape to canonical backend schema', () => {
        const uiConfig = {
            mode: 'leg_end_dates',
            description: 'ui shape',
            weights: {
                makespan_weight: 0.3,
                priority_weight: 0.7
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
                priority_weight: 0.7
            },
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

    test('executeSolver sends canonical config and settings_used', async () => {
        const solverRequest = {
            csv_files: { 'data_test.csv': 'col1,col2\n1,2' },
            priority_config: {
                mode: 'leg_end_dates',
                description: 'canonical already',
                weights: {
                    makespan_weight: 0.2,
                    priority_weight: 0.8
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

        const sentBody = JSON.parse(options.body);
        expect(sentBody.priority_config).toEqual({
            mode: 'leg_end_dates',
            description: 'canonical already',
            weights: {
                makespan_weight: 0.2,
                priority_weight: 0.8
            },
            leg_deadlines: {
                'leg-1': '2027-01-01'
            }
        });
        expect(sentBody.settings_used).toEqual(sentBody.priority_config);
        expect(service.getLastCanonicalPriorityConfig()).toEqual(sentBody.priority_config);
    });
});
