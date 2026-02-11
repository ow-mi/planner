/**
 * Regression tests for visualizer component/store integration.
 */

const fs = require('fs');
const path = require('path');

describe('visualizer component csvData guards', () => {
    let componentHtml;
    let componentScript;
    let storeScript;

    beforeAll(() => {
        const visualizerPath = path.join(process.cwd(), 'ui_v2_exp', 'src', 'components', 'visualizer.html');
        componentHtml = fs.readFileSync(visualizerPath, 'utf8');
        const scriptMatch = componentHtml.match(/<script>([\s\S]*?)<\/script>/);
        const storePath = path.join(process.cwd(), 'ui_v2_exp', 'src', 'js', 'stores', 'visualizationStore.js');

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
});
