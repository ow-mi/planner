/**
 * File Store - Alpine.js Store for File Management
 *
 * Manages folder-imported files, CSV parsing, and data storage
 */

// Storage key constants for consistency
const FILE_STORAGE_KEYS = {
    PARSED_CSV_DATA: 'ui_v2_exp__files__parsedCsvData',
    SELECTED_CSV: 'ui_v2_exp__files__selectedCsv',
    BASE_FOLDER_PATH: 'ui_v2_exp__files__baseFolderPath',
    SESSION_ID: 'ui_v2_exp__files__sessionId'
};

function inferColumnTypeFromValues(values) {
    const normalizedValues = values
        .map(value => (value === null || value === undefined ? '' : String(value).trim()))
        .filter(value => value.length > 0);

    if (normalizedValues.length === 0) {
        return 'text';
    }

    const allNumbers = normalizedValues.every(value => /^[-+]?\d*\.?\d+$/.test(value));
    if (allNumbers) {
        return 'number';
    }

    const allDates = normalizedValues.every(value => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return false;
        }

        const date = new Date(`${value}T00:00:00Z`);
        return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    });

    if (allDates) {
        return 'date';
    }

    return 'text';
}

function inferColumnTypes(csvData) {
    if (!csvData || !Array.isArray(csvData.headers) || !Array.isArray(csvData.rows)) {
        return [];
    }

    return csvData.headers.map((_, colIndex) => {
        const columnValues = csvData.rows.map(row => (Array.isArray(row) ? row[colIndex] : ''));
        return inferColumnTypeFromValues(columnValues);
    });
}

function validateCellValueByType(value, columnType) {
    const normalized = value === null || value === undefined ? '' : String(value).trim();
    if (normalized.length === 0 || columnType === 'text') {
        return true;
    }

    if (columnType === 'number') {
        return /^[-+]?\d*\.?\d+$/.test(normalized);
    }

    if (columnType === 'date') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
            return false;
        }

        const date = new Date(`${normalized}T00:00:00Z`);
        return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === normalized;
    }

    return true;
}

function parseTabularText(rawText) {
    if (typeof rawText !== 'string' || rawText.length === 0) {
        return [];
    }

    return rawText
        .replace(/\r\n/g, '\n')
        .split('\n')
        .filter((line, index, lines) => line.length > 0 || index < lines.length - 1)
        .map(line => line.split('\t'));
}

function applyRectangularPaste(rows, startRow, startCol, pastedMatrix, columnCount) {
    const nextRows = Array.isArray(rows) ? rows.map(row => (Array.isArray(row) ? [...row] : [])) : [];
    if (!Array.isArray(pastedMatrix) || pastedMatrix.length === 0) {
        return nextRows;
    }

    pastedMatrix.forEach((pastedRow, rowOffset) => {
        const targetRowIndex = startRow + rowOffset;
        while (nextRows.length <= targetRowIndex) {
            nextRows.push(Array(columnCount).fill(''));
        }

        if (!Array.isArray(nextRows[targetRowIndex])) {
            nextRows[targetRowIndex] = Array(columnCount).fill('');
        }

        pastedRow.forEach((cellValue, colOffset) => {
            const targetColIndex = startCol + colOffset;
            if (targetColIndex >= columnCount) {
                return;
            }

            nextRows[targetRowIndex][targetColIndex] = cellValue;
        });
    });

    return nextRows;
}

function getFileIdentity(file) {
    if (!file || !file.name) {
        return '';
    }
    const size = Number.isFinite(file.size) ? file.size : 0;
    const lastModified = Number.isFinite(file.lastModified) ? file.lastModified : 0;
    return `${file.name}::${size}::${lastModified}`;
}

function parseCsvText(csvText) {
    const results = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true
    });

    if (results.errors && results.errors.length > 0) {
        throw new Error(results.errors[0].message || 'Failed to parse CSV content');
    }

    return {
        headers: results.meta.fields || [],
        rows: (results.data || []).map((row) => Object.values(row))
    };
}

document.addEventListener('alpine:init', () => {
    Alpine.store('files', {
        // State
        uploadedFiles: [],
        parsedCsvData: {},
        selectedCsv: '',
        activeCsvData: { headers: [], rows: [] },
        baseFolderPath: '',
        sessionId: null,
        importedConfig: null,
        isLoading: false,
        error: null,
        isInitialized: false,

        // Initialization
        init() {
            try {
                if (this.isInitialized) {
                    console.log('[fileStore] Already initialized, skipping');
                    return;
                }
                console.log('File store initialized');
                // this.loadFromLocalStorage(); // Disabled - no persistence
                this.isInitialized = true;
            } catch (error) {
                console.error('FileStore init failed:', error);
                this.error = 'Failed to initialize file storage';
            }
        },

        // Load from localStorage
        loadFromLocalStorage() {
            try {
                console.log('[fileStore] Loading from localStorage...');
                console.log('[fileStore] Current uploadedFiles count:', this.uploadedFiles.length);
                console.log('[fileStore] Current uploadedFiles:', this.uploadedFiles.map(f => f.name));

                const savedData = localStorage.getItem(FILE_STORAGE_KEYS.PARSED_CSV_DATA);
                if (savedData) {
                    this.parsedCsvData = JSON.parse(savedData);
                    this.uploadedFiles = Object.keys(this.parsedCsvData).map(name => ({
                        name: name,
                        size: 0,
                        lastModified: Date.now()
                    }));
                }

                const savedSelected = localStorage.getItem(FILE_STORAGE_KEYS.SELECTED_CSV);
                if (savedSelected) {
                    this.selectedCsv = savedSelected;
                    if (this.parsedCsvData[this.selectedCsv]) {
                        this.activeCsvData = this.parsedCsvData[this.selectedCsv];
                    }
                }

                const savedBaseFolderPath = localStorage.getItem(FILE_STORAGE_KEYS.BASE_FOLDER_PATH);
                if (savedBaseFolderPath) {
                    this.baseFolderPath = savedBaseFolderPath;
                }

                const savedSessionId = localStorage.getItem(FILE_STORAGE_KEYS.SESSION_ID);
                if (savedSessionId) {
                    this.sessionId = savedSessionId;
                }

                console.log('[fileStore] After loading, uploadedFiles count:', this.uploadedFiles.length);
                console.log('[fileStore] After loading, uploadedFiles:', this.uploadedFiles.map(f => f.name));
            } catch (error) {
                console.error('Failed to load from localStorage:', error);
                this.error = 'Failed to load saved files';
            }
        },

        // Save to localStorage
        saveToLocalStorage() {
            try {
                localStorage.setItem(FILE_STORAGE_KEYS.PARSED_CSV_DATA, JSON.stringify(this.parsedCsvData));
                localStorage.setItem(FILE_STORAGE_KEYS.SELECTED_CSV, this.selectedCsv);
                localStorage.setItem(FILE_STORAGE_KEYS.BASE_FOLDER_PATH, this.baseFolderPath || '');
                if (this.sessionId) {
                    localStorage.setItem(FILE_STORAGE_KEYS.SESSION_ID, this.sessionId);
                } else {
                    localStorage.removeItem(FILE_STORAGE_KEYS.SESSION_ID);
                }
            } catch (error) {
                console.error('Failed to save to localStorage:', error);
                this.error = 'Failed to save files';
            }
        },

        setBaseFolderPath(folderPath) {
            this.baseFolderPath = String(folderPath || '').trim();
            this.saveToLocalStorage();
        },

        hasImportedFolder() {
            return Boolean(this.sessionId) && this.hasFiles();
        },

        async importFolder() {
            this.error = null;
            this.isLoading = true;

            try {
                const folderPath = String(this.baseFolderPath || '').trim();
                if (!folderPath) {
                    throw new Error('Folder path is required.');
                }

                if (!window.apiService) {
                    throw new Error('Backend API service is unavailable.');
                }

                const sessionResponse = await window.apiService.createRunSession({
                    name: 'Folder Session',
                    source: 'ui_v2_exp'
                });
                const sessionId = sessionResponse.session_id || sessionResponse.sessionId;
                if (!sessionId) {
                    throw new Error('Backend did not return a session ID.');
                }

                const importResponse = await window.apiService.importSessionInputsFromFolder(
                    sessionId,
                    folderPath
                );

                const importedCsvFiles = importResponse.csv_files || {};
                const parsedCsvData = {};
                const existingNames = new Set();
                const dedupedUploadedFiles = [];

                this.uploadedFiles.forEach((file) => {
                    if (!file || !file.name || existingNames.has(file.name)) {
                        return;
                    }
                    existingNames.add(file.name);
                    dedupedUploadedFiles.push(file);
                });

                Object.entries(importedCsvFiles).forEach(([fileName, fileContent]) => {
                    // Skip duplicates - only add if not already in uploadedFiles
                    if (!existingNames.has(fileName)) {
                        parsedCsvData[fileName] = parseCsvText(fileContent);
                    }
                });

                // Dedupe: only add new files that weren't already present
                const newFileNames = Object.keys(parsedCsvData);
                this.parsedCsvData = {
                    ...this.parsedCsvData,
                    ...parsedCsvData
                };
                this.uploadedFiles = [
                    ...dedupedUploadedFiles,
                    ...newFileNames.map((name) => ({
                        name,
                        size: (importedCsvFiles[name] || '').length,
                        lastModified: Date.now()
                    }))
                ];
                this.selectedCsv = this.uploadedFiles.length > 0 ? this.uploadedFiles[0].name : '';
                this.activeCsvData = this.selectedCsv ? this.parsedCsvData[this.selectedCsv] : { headers: [], rows: [] };
                this.sessionId = sessionId;
                this.baseFolderPath = importResponse.folder_path || folderPath;
                this.importedConfig = importResponse.priority_config || null;
                this.saveToLocalStorage();

                const configStore = typeof Alpine !== 'undefined' && Alpine.store ? Alpine.store('config') : null;
                if (this.importedConfig && configStore && typeof configStore.loadJsonConfiguration === 'function') {
                    configStore.loadJsonConfiguration(this.importedConfig);
                }
            } catch (error) {
                this.error = error?.message || 'Failed to import inputs from folder.';
                this.sessionId = null;
            } finally {
                this.isLoading = false;
            }
        },

        getCurrentSessionId() {
            return this.sessionId;
        },

        getCurrentFolderPath() {
            return this.baseFolderPath;
        },

        // Select a CSV file as the active spreadsheet (triggers validation)
        async selectCsvAsActive(filename) {
            if (this.parsedCsvData[filename]) {
                // First select locally
                this.selectedCsv = filename;
                this.activeCsvData = this.parsedCsvData[filename];
                
                // Get CSV content for backend validation
                const csvContent = Papa.unparse({
                    fields: this.activeCsvData.headers,
                    data: this.activeCsvData.rows
                });

                // Validate via backend
                const validationStore = Alpine.store('validation');
                if (validationStore) {
                    const result = await validationStore.setActiveSpreadsheet(filename, csvContent);
                    
                    // If validation fails, keep the file selected but downstream actions are blocked
                    if (!result.success) {
                        console.warn('[fileStore] Validation failed for active spreadsheet:', result.errors);
                    }
                }
                
                this.saveToLocalStorage();
                return true;
            }
            return false;
        },

        // Select a CSV file (local only, no validation - legacy behavior)
        selectCsv(filename) {
            if (this.parsedCsvData[filename]) {
                this.selectedCsv = filename;
                this.activeCsvData = this.parsedCsvData[filename];
                this.saveToLocalStorage();
                return true;
            }
            return false;
        },

        // Display CSV data in table format
        displayCsvData() {
            if (this.selectedCsv && this.parsedCsvData[this.selectedCsv]) {
                this.activeCsvData = this.parsedCsvData[this.selectedCsv];
                return true;
            } else {
                this.activeCsvData = { headers: [], rows: [] };
                return false;
            }
        },

        // Remove a file
        removeFile(filename) {
            this.uploadedFiles = this.uploadedFiles.filter(file => file.name !== filename);

            if (this.selectedCsv === filename) {
                this.selectedCsv = '';
                this.activeCsvData = { headers: [], rows: [] };
                
                // Clear validation when active file is removed
                const validationStore = Alpine.store('validation');
                if (validationStore) {
                    validationStore.clearActiveSpreadsheet();
                }
            }

            delete this.parsedCsvData[filename];
            this.saveToLocalStorage();
        },

        // Clear all files
        clearAllFiles() {
            console.log('[fileStore] Clearing all files and localStorage');
            console.log('[fileStore] Before clear - uploadedFiles count:', this.uploadedFiles.length);
            console.log('[fileStore] Before clear - parsedCsvData keys:', Object.keys(this.parsedCsvData));

            this.uploadedFiles = [];
            this.parsedCsvData = {};
            this.selectedCsv = '';
            this.activeCsvData = { headers: [], rows: [] };
            
            // Clear validation
            const validationStore = Alpine.store('validation');
            if (validationStore) {
                validationStore.clearActiveSpreadsheet();
            }
            
            // Clear localStorage items
            localStorage.removeItem(FILE_STORAGE_KEYS.PARSED_CSV_DATA);
            localStorage.removeItem(FILE_STORAGE_KEYS.SELECTED_CSV);
            localStorage.removeItem(FILE_STORAGE_KEYS.BASE_FOLDER_PATH);
            localStorage.removeItem(FILE_STORAGE_KEYS.SESSION_ID);
            this.baseFolderPath = '';
            this.sessionId = null;
            this.importedConfig = null;

            console.log('[fileStore] After clear - uploadedFiles count:', this.uploadedFiles.length);
            console.log('[fileStore] localStorage cleared');
        },

        // Get file count
        getFileCount() {
            return this.uploadedFiles.length;
        },

        // Check if files are available
        hasFiles() {
            return this.uploadedFiles.length > 0;
        },

        // Get parsed data for all files
        getAllParsedData() {
            return this.parsedCsvData;
        },

        // Get data for solver input format
        getSolverInputData() {
            const csvFiles = {};

            for (const [filename, data] of Object.entries(this.parsedCsvData)) {
                if (data.headers && data.rows) {
                    const csvContent = Papa.unparse({
                        fields: data.headers,
                        data: data.rows
                    });
                    csvFiles[filename] = csvContent;
                }
            }

            return csvFiles;
        },

        inferColumnTypes(csvData) {
            return inferColumnTypes(csvData);
        },

        validateCellValueByType(value, columnType) {
            return validateCellValueByType(value, columnType);
        },

        parseTabularText(rawText) {
            return parseTabularText(rawText);
        },

        applyRectangularPaste(rows, startRow, startCol, pastedMatrix, columnCount) {
            return applyRectangularPaste(rows, startRow, startCol, pastedMatrix, columnCount);
        }
    });
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        inferColumnTypeFromValues,
        inferColumnTypes,
        validateCellValueByType,
        parseTabularText,
        applyRectangularPaste,
        FILE_STORAGE_KEYS
    };
}
