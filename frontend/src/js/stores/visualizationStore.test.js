/**
 * Regression tests for visualizer component/store integration.
 */

import fs from 'fs';
import path from 'path';

describe('visualizer component csvData guards', () => {
    let componentHtml;
    let componentScript;
    let storeScript;

    beforeAll(() => {
        const workspaceRoot = path.basename(process.cwd()) === 'frontend'
            ? process.cwd()
            : path.join(process.cwd(), 'frontend');
        const visualizerPath = path.join(workspaceRoot, 'src', 'components', 'visualizer.html');
        componentHtml = fs.readFileSync(visualizerPath, 'utf8');
        const scriptMatch = componentHtml.match(/<script>([\s\S]*?)<\/script>/);
        const storePath = path.join(workspaceRoot, 'src', 'js', 'stores', 'visualizationStore.js');

        if (!scriptMatch) {
            throw new Error('Unable to locate visualizer component script');
        }

        componentScript = scriptMatch[1];
        storeScript = fs.readFileSync(storePath, 'utf8');
    });

    test('success message guard should reference hasCsvData', () => {
        expect(componentHtml).toMatch(/x-show="hasCsvData && !error"/);
    });

    test('component should expose hasCsvData getter backed by visualization store', () => {
        expect(componentScript).toMatch(/get hasCsvData\(\)\s*\{[\s\S]*?return this\.\$store\.visualization\.hasCsvData\(\);[\s\S]*?\}/);
    });

    test('visualization store should provide hasCsvData helper', () => {
        expect(storeScript).toMatch(/hasCsvData\(\)\s*\{[\s\S]*?return !!this\.csvData;[\s\S]*?\}/);
    });

    test('visualization store transform should support backend snake_case test_schedule', () => {
        expect(storeScript).toMatch(/solutionResult\.test_schedule/);
    });

    test('visualization store should parse concurrency_timeseries.csv capacities', () => {
        expect(storeScript).toMatch(/concurrency_timeseries\.csv/);
        expect(storeScript).toMatch(/available_fte/);
        expect(storeScript).toMatch(/available_equipment/);
    });

    test('visualization store should include FTE holidays and holiday buffer schedule generation', () => {
        expect(storeScript).toMatch(/getFteHolidays\(\)/);
        expect(storeScript).toMatch(/buildHolidayBufferSchedules\(/);
        expect(storeScript).toMatch(/testName:\s*'Buff'/);
        expect(storeScript).toMatch(/fteHolidays/);
    });
});

describe('getTemplateRenderer eval-based execution', () => {
    let storeScript;

    beforeAll(() => {
        const workspaceRoot = path.basename(process.cwd()) === 'frontend'
            ? process.cwd()
            : path.join(process.cwd(), 'frontend');
        const storePath = path.join(workspaceRoot, 'src', 'js', 'stores', 'visualizationStore.js');
        storeScript = fs.readFileSync(storePath, 'utf8');
    });

    test('getTemplateRenderer should use new Function for eval-based execution', () => {
        // Check that getTemplateRenderer creates a function from code string
        expect(storeScript).toMatch(/new Function\s*\(\s*['"]data['"]\s*,\s*['"]container['"]\s*,\s*['"]d3['"]\s*,\s*code\s*\)/);
    });

    test('getTemplateRenderer should use this.code for edited template code', () => {
        // Check that the renderer reads from this.code first
        expect(storeScript).toMatch(/const code = this\.code \|\| this\.templates\[templateId\]/);
    });

    test('getTemplateRenderer should have allowlist for template security', () => {
        // Check that only built-in templates are allowed
        expect(storeScript).toMatch(/allowlistedTemplates\s*=\s*\[\s*['"]gantt-tests['"]/);
        expect(storeScript).toMatch(/Invalid template.*Only built-in templates are allowed/);
    });

    test('getTemplateRenderer should display error in container on execution failure', () => {
        // Check that errors are caught and displayed
        expect(storeScript).toMatch(/catch.*err.*\{[\s\S]*?Template execution error/);
        expect(storeScript).toMatch(/Template Error/);
    });

    test('getTemplateRenderer should reject invalid template IDs', () => {
        expect(storeScript).toMatch(/if\s*\(\s*!\s*allowlistedTemplates\.includes\s*\(\s*templateId\s*\)\s*\)/);
    });
});

describe('resetTemplateCode method', () => {
    let storeScript;

    beforeAll(() => {
        const workspaceRoot = path.basename(process.cwd()) === 'frontend'
            ? process.cwd()
            : path.join(process.cwd(), 'frontend');
        const storePath = path.join(workspaceRoot, 'src', 'js', 'stores', 'visualizationStore.js');
        storeScript = fs.readFileSync(storePath, 'utf8');
    });

    test('resetTemplateCode should exist in store', () => {
        expect(storeScript).toMatch(/resetTemplateCode\s*\(\s*templateId\s*=/);
    });

    test('resetTemplateCode should restore code from templates', () => {
        expect(storeScript).toMatch(/this\.code = this\.templates\[templateId\]\.code/);
    });

    test('resetTemplateCode should update editor if initialized', () => {
        expect(storeScript).toMatch(/this\.editor.*setValue.*this\.code/);
    });

    test('resetTemplateCode should save to localStorage', () => {
        expect(storeScript).toMatch(/resetTemplateCode[\s\S]*?saveToLocalStorage/);
    });
});

describe('legacy templates data format compatibility', () => {
    let templatesScript;

    beforeAll(() => {
        const workspaceRoot = path.basename(process.cwd()) === 'frontend'
            ? process.cwd()
            : path.join(process.cwd(), 'frontend');
        const templatesPath = path.join(workspaceRoot, 'src', 'js', 'legacy-templates.js');
        templatesScript = fs.readFileSync(templatesPath, 'utf8');
    });

    test('gantt-tests template should handle both snake_case and camelCase', () => {
        // Check for dual format handling in test_schedules
        expect(templatesScript).toMatch(/testSchedules\s*=\s*data\.test_schedules\s*\|\|\s*data\.testSchedules/);
    });

    test('equipment template should handle both snake_case and camelCase', () => {
        expect(templatesScript).toMatch(/equipmentUsage\s*=\s*data\.equipment_usage\s*\|\|\s*data\.equipmentUsage/);
    });

    test('fte template should handle both snake_case and camelCase', () => {
        expect(templatesScript).toMatch(/fteUsage\s*=\s*data\.fte_usage\s*\|\|\s*data\.fteUsage/);
    });

    test('concurrency template should handle both snake_case and camelCase', () => {
        expect(templatesScript).toMatch(/concurrencyTimeseries\s*=\s*data\.concurrency_timeseries\s*\|\|\s*data\.concurrencyTimeseries/);
    });

    test('gantt-tests should handle both project_leg_id and projectLegId', () => {
        expect(templatesScript).toMatch(/d\.project_leg_id\s*\?\?\s*d\.projectLegId/);
    });
});

describe('UI reset button', () => {
    let componentHtml;

    beforeAll(() => {
        const workspaceRoot = path.basename(process.cwd()) === 'frontend'
            ? process.cwd()
            : path.join(process.cwd(), 'frontend');
        const visualizerPath = path.join(workspaceRoot, 'src', 'components', 'visualizer.html');
        componentHtml = fs.readFileSync(visualizerPath, 'utf8');
    });

    test('reset button should call resetTemplateCode on store', () => {
        expect(componentHtml).toMatch(/\$store\.visualization\.resetTemplateCode/);
    });

    test('reset button should have appropriate title', () => {
        expect(componentHtml).toMatch(/Reset.*default.*template|Reset to Default/i);
    });
});
