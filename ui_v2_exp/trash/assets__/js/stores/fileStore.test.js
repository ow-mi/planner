describe('fileStore folder import flow', () => {
    const path = require('path');
    const fileStorePath = path.join(process.cwd(), 'ui_v2_exp', 'assets', 'js', 'stores', 'fileStore.js');

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
            parse: jest.fn((content) => {
                const lines = String(content).trim().split('\n');
                const headers = lines[0].split(',');
                const rows = lines.slice(1).map((line) => line.split(','));
                return {
                    errors: [],
                    meta: { fields: headers },
                    data: rows.map((row) => ({
                        [headers[0]]: row[0],
                        [headers[1]]: row[1]
                    }))
                };
            }),
            unparse: jest.fn(() => '')
        };

        require(fileStorePath);
        document.dispatchEvent(new Event('alpine:init'));
        return global.Alpine.store('files');
    }

    beforeEach(() => {
        localStorage.clear();
        window.apiService = {
            createRunSession: jest.fn(async () => ({ session_id: 'session-1' })),
            importSessionInputsFromFolder: jest.fn(async () => ({
                folder_path: '/tmp/input-folder',
                csv_files: {
                    'data_test.csv': 'test_id,priority\nT1,1',
                    'data_legs.csv': 'leg_id,priority\nL1,2'
                },
                priority_config: { mode: 'leg_end_dates', weights: { makespan_weight: 0.2, priority_weight: 0.8 } }
            }))
        };
    });

    test('importFolder loads csv files via backend folder endpoint', async () => {
        const files = createFileStore();
        files.setBaseFolderPath('/tmp/input-folder');

        await files.importFolder();

        expect(window.apiService.createRunSession).toHaveBeenCalled();
        expect(window.apiService.importSessionInputsFromFolder).toHaveBeenCalledWith('session-1', '/tmp/input-folder');
        expect(files.sessionId).toBe('session-1');
        expect(files.baseFolderPath).toBe('/tmp/input-folder');
        expect(Object.keys(files.parsedCsvData)).toEqual(['data_test.csv', 'data_legs.csv']);
        expect(files.selectedCsv).toBe('data_test.csv');
    });

    test('importFolder fails when folder path is missing', async () => {
        const files = createFileStore();

        await files.importFolder();

        expect(files.error).toMatch(/Folder path is required/);
        expect(window.apiService.createRunSession).not.toHaveBeenCalled();
    });

    test('save/load persistence keeps folder path and session id', () => {
        const files = createFileStore();
        files.baseFolderPath = '/tmp/base';
        files.sessionId = 'session-abc';
        files.parsedCsvData = {
            'data_test.csv': { headers: ['a'], rows: [['1']] }
        };
        files.selectedCsv = 'data_test.csv';
        files.saveToLocalStorage();

        const reloaded = createFileStore();
        reloaded.loadFromLocalStorage();

        expect(reloaded.baseFolderPath).toBe('/tmp/base');
        expect(reloaded.sessionId).toBe('session-abc');
        expect(reloaded.selectedCsv).toBe('data_test.csv');
    });
});
