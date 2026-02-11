const { normalizeScenario, validateScenarios } = require('./batchStore');

describe('BatchStore module functions', () => {
    test('normalizeScenario creates default values', () => {
        const result = normalizeScenario({});
        expect(result).toEqual({
            name: '',
            timeLimit: 300,
            debugLevel: 'INFO',
            outputFolder: null
        });
    });

    test('normalizeScenario preserves provided values', () => {
        const input = {
            name: 'Test Scenario',
            timeLimit: 120,
            debugLevel: 'DEBUG',
            outputFolder: '/output'
        };
        const result = normalizeScenario(input);
        expect(result).toEqual({
            name: 'Test Scenario',
            timeLimit: 120,
            debugLevel: 'DEBUG',
            outputFolder: '/output'
        });
    });

    test('normalizeScenario trims name and outputFolder', () => {
        const input = {
            name: '  Test  ',
            timeLimit: 100,
            outputFolder: '  /path  '
        };
        const result = normalizeScenario(input);
        expect(result.name).toBe('Test');
        expect(result.outputFolder).toBe('/path');
    });

    test('normalizeScenario handles invalid timeLimit', () => {
        const input = {
            name: 'Test',
            timeLimit: 'invalid'
        };
        const result = normalizeScenario(input);
        expect(result.timeLimit).toBe(300); // uses default
    });

    test('validateScenarios passes for valid scenarios', () => {
        const scenarios = [
            { name: 'Scenario A', timeLimit: 120 },
            { name: 'Scenario B', timeLimit: 180 }
        ];
        const validation = validateScenarios(scenarios);
        expect(validation.valid).toBe(true);
        expect(validation.errors).toHaveLength(0);
    });

    test('validateScenarios fails with missing names', () => {
        const scenarios = [
            { name: '', timeLimit: 120 }
        ];
        const validation = validateScenarios(scenarios);
        expect(validation.valid).toBe(false);
        expect(validation.errors[0]).toContain('Scenario 1');
        expect(validation.errors[0]).toContain('name is required');
    });

    test('validateScenarios fails with invalid time limits', () => {
        const scenarios = [
            { name: 'Test', timeLimit: -5 }
        ];
        const validation = validateScenarios(scenarios);
        expect(validation.valid).toBe(false);
        expect(validation.errors[0]).toContain('time limit');
    });

    test('validateScenarios handles zero time limit', () => {
        const scenarios = [
            { name: 'Test', timeLimit: 0 }
        ];
        const validation = validateScenarios(scenarios);
        expect(validation.valid).toBe(false);
        expect(validation.errors[0]).toContain('time limit');
    });

    test('validateScenarios handles string timeLimit', () => {
        const scenarios = [
            { name: 'Test', timeLimit: '200' }
        ];
        const validation = validateScenarios(scenarios);
        expect(validation.valid).toBe(true); // 200 is a valid number
    });

    test('validateScenarios handles NaN timeLimit', () => {
        const scenarios = [
            { name: 'Test', timeLimit: NaN }
        ];
        const validation = validateScenarios(scenarios);
        expect(validation.valid).toBe(false);
    });

    test('validateScenarios handles multiple errors', () => {
        const scenarios = [
            { name: '', timeLimit: -1 },
            { name: '', timeLimit: 'invalid' }
        ];
        const validation = validateScenarios(scenarios);
        expect(validation.valid).toBe(false);
        expect(validation.errors).toHaveLength(4); // 2 scenarios x 2 errors each
    });
});
