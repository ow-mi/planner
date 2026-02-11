/**
 * fileStore.test.js - Tests for fileStore functionality
 *
 * Covers:
 * - localStorage persistence and reconstruction of uploadedFiles
 * - CSV data persistence
 * - Row operations persistence
 */

describe('fileStore', () => {
    const fs = require('fs');
    const path = require('path');
    const fileStorePath = path.join(process.cwd(), 'ui_v2_exp', 'assets', 'js', 'stores', 'fileStore.js');
    const dataEditorPath = path.join(process.cwd(), 'ui_v2_exp', 'components', 'data-editor.html');

    function loadDataEditorFactory() {
        const componentHtml = fs.readFileSync(dataEditorPath, 'utf8');
        const scriptMatch = componentHtml.match(/<script>([\s\S]*?)<\/script>/);
        if (!scriptMatch) {
            throw new Error('Unable to locate data-editor component script');
        }

        return new Function(`${scriptMatch[1]}; return dataEditorComponent;`)();
    }

    function createDataEditorInstance(overrides = {}) {
        const componentFactory = loadDataEditorFactory();
        const defaultFilesStore = {
            uploadedFiles: [],
            parsedCsvData: {},
            saveToLocalStorage: jest.fn(),
            inferColumnTypes: jest.fn(() => []),
            validateCellValueByType: jest.fn(() => true),
            parseTabularText: jest.fn(() => []),
            applyRectangularPaste: jest.fn(() => [])
        };

        const filesStore = {
            ...defaultFilesStore,
            ...(overrides.files || {})
        };

        const component = componentFactory();
        component.$store = { files: filesStore };
        component.$watch = jest.fn();

        Object.keys(overrides).forEach((key) => {
            if (key !== 'files') {
                component[key] = overrides[key];
            }
        });

        return { component, filesStore };
    }

    function createFileStore() {
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
            parse: jest.fn(),
            unparse: jest.fn(() => '')
        };

        require(fileStorePath);
        document.dispatchEvent(new Event('alpine:init'));
        return global.Alpine.store('files');
    }

    beforeEach(() => {
        // Clear localStorage before each test
        localStorage.clear();
        // Reset Alpine store state
        if (window.Alpine && window.Alpine.store('files')) {
            const files = window.Alpine.store('files');
            files.uploadedFiles = [];
            files.parsedCsvData = {};
            files.selectedCsv = '';
            files.activeCsvData = { headers: [], rows: [] };
        }
    });

    afterAll(() => {
        localStorage.clear();
    });

    describe('localStorage persistence', () => {
        test('should reconstruct uploadedFiles from parsedCsvData keys', () => {
            if (!window.Alpine || !window.Alpine.store('files')) {
                console.warn('fileStore not initialized - skipping test');
                return;
            }
            const files = window.Alpine.store('files');

            // Simulate CSV data being saved to localStorage (as if uploaded via file drop)
            const mockCsvData = {
                'test.csv': {
                    headers: ['name', 'value'],
                    rows: [['Alice', '10'], ['Bob', '20']]
                },
                'data.csv': {
                    headers: ['id', 'label'],
                    rows: [['1', 'Item A'], ['2', 'Item B']]
                }
            };
            localStorage.setItem('parsedCsvData', JSON.stringify(mockCsvData));

            // Simulate page reload by calling loadFromLocalStorage
            files.loadFromLocalStorage();

            // Verify uploadedFiles was reconstructed correctly from parsedCsvData keys
            expect(files.uploadedFiles).toHaveLength(2);
            expect(files.uploadedFiles[0]).toMatchObject({ name: 'test.csv' });
            expect(files.uploadedFiles[1]).toMatchObject({ name: 'data.csv' });

            // Verify parsedCsvData was loaded correctly
            expect(files.parsedCsvData).toEqual(mockCsvData);
        });

        test('should persist and restore selectedCsv', () => {
            if (!window.Alpine || !window.Alpine.store('files')) {
                console.warn('fileStore not initialized - skipping test');
                return;
            }
            const files = window.Alpine.store('files');

            // Save state
            files.parsedCsvData = {
                'selected.csv': { headers: ['col1'], rows: [['val1']] }
            };
            files.selectedCsv = 'selected.csv';
            files.saveToLocalStorage();

            // Clear state and reload
            files.uploadedFiles = [];
            files.parsedCsvData = {};
            files.selectedCsv = '';
            files.activeCsvData = { headers: [], rows: [] };
            files.loadFromLocalStorage();

            // Verify selectedCsv was restored
            expect(files.selectedCsv).toBe('selected.csv');
            expect(files.activeCsvData).toEqual({
                headers: ['col1'],
                rows: [['val1']]
            });
        });

        test('should not store File objects in localStorage', () => {
            if (!window.Alpine || !window.Alpine.store('files')) {
                console.warn('fileStore not initialized - skipping test');
                return;
            }
            const files = window.Alpine.store('files');

            // Set up state with mock CSV data
            files.parsedCsvData = {
                'test.csv': { headers: ['a'], rows: [['1']] }
            };
            files.saveToLocalStorage();

            // Verify uploadedFiles is NOT in localStorage (since File objects cannot be serialized)
            expect(localStorage.getItem('uploadedFiles')).toBeNull();

            // Verify parsedCsvData and selectedCsv ARE in localStorage
            expect(localStorage.getItem('parsedCsvData')).not.toBeNull();
        });
    });

    describe('row operations persistence', () => {
        test('should persist addRow operation to filesystem', () => {
            if (!window.Alpine || !window.Alpine.store('files')) {
                console.warn('fileStore not initialized - skipping test');
                return;
            }
            const files = window.Alpine.store('files');

            // Set up initial CSV data
            files.parsedCsvData = {
                'test.csv': {
                    headers: ['name', 'value'],
                    rows: [['Alice', '10'], ['Bob', '20']]
                }
            };
            files.selectedCsv = 'test.csv';

            // Simulate addNewRow operation (as triggered by data-editor component)
            const newRow = Array(files.parsedCsvData['test.csv'].headers.length).fill('');
            files.parsedCsvData['test.csv'].rows.push(newRow);
            files.saveToLocalStorage();

            // Verify data was persisted
            const savedData = JSON.parse(localStorage.getItem('parsedCsvData'));
            expect(savedData['test.csv'].rows).toHaveLength(3);
            expect(savedData['test.csv'].rows[2]).toEqual(['', '']);

            // Reload and verify state
            files.loadFromLocalStorage();
            expect(files.parsedCsvData['test.csv'].rows).toHaveLength(3);
        });

        test('should persist removeRow operation to filesystem', () => {
            if (!window.Alpine || !window.Alpine.store('files')) {
                console.warn('fileStore not initialized - skipping test');
                return;
            }
            const files = window.Alpine.store('files');

            // Set up initial CSV data
            files.parsedCsvData = {
                'test.csv': {
                    headers: ['name', 'value'],
                    rows: [['Alice', '10'], ['Bob', '20'], ['Charlie', '30']]
                }
            };
            files.selectedCsv = 'test.csv';

            // Simulate removeRow operation
            files.parsedCsvData['test.csv'].rows.splice(1, 1); // Remove row at index 1
            files.saveToLocalStorage();

            // Verify data was persisted
            const savedData = JSON.parse(localStorage.getItem('parsedCsvData'));
            expect(savedData['test.csv'].rows).toHaveLength(2);
            expect(savedData['test.csv'].rows).not.toContainEqual(['Bob', '20']);

            // Reload and verify state
            files.loadFromLocalStorage();
            expect(files.parsedCsvData['test.csv'].rows).toHaveLength(2);
            expect(files.parsedCsvData['test.csv'].rows).toEqual([['Alice', '10'], ['Charlie', '30']]);
        });

        test('should persist cell value changes', () => {
            if (!window.Alpine || !window.Alpine.store('files')) {
                console.warn('fileStore not initialized - skipping test');
                return;
            }
            const files = window.Alpine.store('files');

            // Set up initial CSV data
            files.parsedCsvData = {
                'test.csv': {
                    headers: ['name', 'value'],
                    rows: [['Alice', '10']]
                }
            };
            files.selectedCsv = 'test.csv';

            // Simulate cell edit
            files.parsedCsvData['test.csv'].rows[0][1] = '15';
            files.saveToLocalStorage();

            // Verify data was persisted
            const savedData = JSON.parse(localStorage.getItem('parsedCsvData'));
            expect(savedData['test.csv'].rows[0][1]).toBe('15');

            // Reload and verify state
            files.loadFromLocalStorage();
            expect(files.parsedCsvData['test.csv'].rows[0][1]).toBe('15');
        });
    });

    describe('edge cases', () => {
        test('should handle empty localStorage gracefully', () => {
            if (!window.Alpine || !window.Alpine.store('files')) {
                console.warn('fileStore not initialized - skipping test');
                return;
            }
            const files = window.Alpine.store('files');

            files.loadFromLocalStorage();

            expect(files.uploadedFiles).toEqual([]);
            expect(files.parsedCsvData).toEqual({});
            expect(files.selectedCsv).toBe('');
            expect(files.activeCsvData).toEqual({ headers: [], rows: [] });
        });

        test('should handle corrupted localStorage gracefully', () => {
            if (!window.Alpine || !window.Alpine.store('files')) {
                console.warn('fileStore not initialized - skipping test');
                return;
            }
            const files = window.Alpine.store('files');

            localStorage.setItem('parsedCsvData', '{invalid json');
            files.loadFromLocalStorage();

            // Should not crash, should have empty state
            expect(files.uploadedFiles).toEqual([]);
            expect(files.parsedCsvData).toEqual({});
        });
    });

    describe('planner-2fw regressions', () => {
        test('processFiles should dedupe uploadedFiles by filename', () => {
            const files = createFileStore();
            files.uploadedFiles = [{ name: 'existing.csv', type: 'text/csv' }];
            files.saveToLocalStorage = jest.fn();
            files.parseCsvFile = jest.fn();

            files.processFiles([
                { name: 'existing.csv', type: 'text/csv' },
                { name: 'new.csv', type: 'text/csv' },
                { name: 'new.csv', type: 'text/csv' }
            ]);

            expect(files.uploadedFiles.map(file => file.name)).toEqual(['existing.csv', 'new.csv']);
            expect(files.parseCsvFile).toHaveBeenCalledTimes(2);
            expect(files.parseCsvFile.mock.calls.map(call => call[0].name)).toEqual(['existing.csv', 'new.csv']);
        });

        test('processFiles should keep unique files when uploading 5+ entries', () => {
            const files = createFileStore();
            files.uploadedFiles = [{ name: 'existing.csv', type: 'text/csv', size: 0, lastModified: 1 }];
            files.saveToLocalStorage = jest.fn();
            files.parseCsvFile = jest.fn();

            files.processFiles([
                { name: 'existing.csv', type: 'text/csv', size: 123, lastModified: 10 },
                { name: 'alpha.csv', type: 'text/csv', size: 50, lastModified: 11 },
                { name: 'beta.csv', type: 'text/csv', size: 60, lastModified: 12 },
                { name: 'gamma.csv', type: 'text/csv', size: 70, lastModified: 13 },
                { name: 'delta.csv', type: 'text/csv', size: 80, lastModified: 14 },
                { name: 'alpha.csv', type: 'text/csv', size: 50, lastModified: 11 }
            ]);

            expect(files.uploadedFiles.map(file => file.name)).toEqual([
                'existing.csv',
                'alpha.csv',
                'beta.csv',
                'gamma.csv',
                'delta.csv'
            ]);
            const existing = files.uploadedFiles.find(file => file.name === 'existing.csv');
            expect(existing.size).toBe(123);
        });

        test('data editor template should render selector using deduped filename keys', () => {
            const componentHtml = fs.readFileSync(dataEditorPath, 'utf8');

            expect(componentHtml).toMatch(/x-for="fileName in dedupedUploadedFilenames"\s*:key="fileName"/);
            expect(componentHtml).toMatch(/<option :value="fileName" x-text="fileName"><\/option>/);
        });

        test('addNewRow should apply a row mutation guard for single increment', () => {
            const { component } = createDataEditorInstance({
                activeCsvData: { headers: ['name'], rows: [] }
            });
            let retriggered = false;
            component.syncActiveCsvDataToStore = jest.fn(() => {
                if (!retriggered) {
                    retriggered = true;
                    component.addNewRow();
                }
            });

            component.addNewRow();

            expect(component.activeCsvData.rows).toHaveLength(1);
            expect(component.isMutatingRows).toBe(false);
        });

        test('selected row should persist after sync and display reload', () => {
            const { component, filesStore } = createDataEditorInstance({
                selectedCsv: 'alpha.csv',
                files: {
                    parsedCsvData: {
                        'alpha.csv': {
                            headers: ['name'],
                            rows: [['A'], ['B']]
                        }
                    }
                }
            });

            component.displayCsvData();
            component.selectRow(1);
            component.syncActiveCsvDataToStore();
            component.displayCsvData();

            expect(component.selectedRowIndex).toBe(1);
            expect(component.selectedRowIndex === -1).toBe(false);
            expect(filesStore.saveToLocalStorage).toHaveBeenCalled();
        });

        test('syncActiveCsvDataToStore should deep clone data before storing', () => {
            const { component, filesStore } = createDataEditorInstance({
                selectedCsv: 'alpha.csv',
                activeCsvData: {
                    headers: ['name', 'value'],
                    rows: [['A', '10']]
                },
                files: {
                    parsedCsvData: {}
                }
            });

            component.syncActiveCsvDataToStore();
            component.activeCsvData.rows[0][1] = '99';

            expect(filesStore.parsedCsvData['alpha.csv'].rows[0][1]).toBe('10');
        });
    });
});
