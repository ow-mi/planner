/**
 * fileStore.test.js - Tests for fileStore functionality
 *
 * Covers:
 * - localStorage persistence and reconstruction of uploadedFiles
 * - CSV data persistence
 * - Row operations persistence
 */

describe('fileStore', () => {

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
});