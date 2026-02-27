/** @jest-environment jsdom */
import { describe, expect, jest, test } from '@jest/globals';

async function createConfigStore() {
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

    await import('./configStore.js');
    document.dispatchEvent(new Event('alpine:init'));
    return global.Alpine.store('config');
}

describe('configStore test config required-count fields', () => {
    test('editable fields include required-count fields and exclude isExternal', async () => {
        const config = await createConfigStore();

        const allFields = config.getEditableFields('all');
        const testFields = config.getEditableFields('tests');

        expect(allFields).toContain('fteRequired');
        expect(allFields).toContain('equipmentRequired');
        expect(testFields).toContain('fteRequired');
        expect(testFields).toContain('equipmentRequired');
        expect(testFields).not.toContain('isExternal');
        expect(config.testConfig.defaults.fteRequired).toBe(1);
        expect(config.testConfig.defaults.equipmentRequired).toBe(1);
    });

    test('resolved rows/csv expose required-count columns and omit is_external', async () => {
        const config = await createConfigStore();
        const testId = 'P__L__1__Smoke';

        config.testHierarchy.tests = {
            [testId]: {
                displayName: 'Smoke',
                testType: 'Smoke'
            }
        };
        config.testConfig.defaults.fteRequired = 2;
        config.testConfig.defaults.equipmentRequired = 3;
        config.testConfig.projects.P = { fteRequired: 4 };
        config.testConfig.tests[testId] = { equipmentRequired: 5 };

        const rows = config.getResolvedTestConfigRows();
        const csv = config.getResolvedTestConfigCsv();

        expect(rows).toHaveLength(1);
        expect(rows[0].fteRequired).toBe(4);
        expect(rows[0].equipmentRequired).toBe(5);
        expect(rows[0].origins.fteRequired).toBe('projects');
        expect(rows[0].origins.equipmentRequired).toBe('tests');
        expect(csv).toContain('fte_required');
        expect(csv).toContain('equipment_required');
        expect(csv).toContain('fte_time_pct');
        expect(csv).not.toContain('fte_time_percentage');
        expect(csv).not.toContain('is_external');
    });

    test('updateOutputSettings serializes legacy deadline field names', async () => {
        const config = await createConfigStore();
        config.sectionEnabled.deadlinesEnabled = true;
        config.config.deadlines = [
            {
                project: 'mwcu',
                legId: '2.1',
                branch: '',
                startDate: '2027-04-22',
                deadlineDate: '2027-05-10',
                deadlinePenalty: 500000,
                compactness: 0
            }
        ];

        config.updateOutputSettings();

        expect(config.priorityConfigSettings.legStartDeadlines).toEqual({
            'mwcu__2.1': '2027-W16.4'
        });
        expect(config.priorityConfigSettings.legDeadlines).toEqual({
            'mwcu__2.1': '2027-W19.1'
        });
        expect(config.priorityConfigSettings.legDeadlinePenalties).toEqual({
            'mwcu__2.1': 500000
        });
    });
});
