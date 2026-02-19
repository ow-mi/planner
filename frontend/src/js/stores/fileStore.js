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

                // Phase 6: Update CSV entities in config store for validation
                const configStore = typeof Alpine !== 'undefined' && Alpine.store ? Alpine.store('config') : null;
                if (configStore) {
                    configStore.updateCsvEntities(this.parsedCsvData);
                    if (this.selectedCsv && this.parsedCsvData[this.selectedCsv]) {
                        configStore.syncConfigFromSelectedCsv(this.parsedCsvData[this.selectedCsv]);
                    }
                }

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
                this.syncConfigFromSelectedCsv();
                
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
                this.syncConfigFromSelectedCsv();
                this.saveToLocalStorage();
                return true;
            }
            return false;
        },

        // Backward-compatible alias used by upload flows
        setSelectedCsv(filename) {
            if (!this.parsedCsvData[filename]) {
                return false;
            }
            this.selectedCsv = filename;
            this.activeCsvData = this.parsedCsvData[filename];
            this.syncConfigFromSelectedCsv();
            this.saveToLocalStorage();
            return true;
        },

        syncConfigFromSelectedCsv() {
            const configStore = typeof Alpine !== 'undefined' && Alpine.store ? Alpine.store('config') : null;
            if (!configStore || !this.selectedCsv || !this.parsedCsvData[this.selectedCsv]) {
                return false;
            }

            configStore.updateCsvEntities({ [this.selectedCsv]: this.parsedCsvData[this.selectedCsv] });
            return configStore.syncConfigFromSelectedCsv(this.parsedCsvData[this.selectedCsv]);
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
            
            // Clear uploaded files storage (for drag-drop uploads)
            localStorage.removeItem('ui_v2_exp__files__directUploads');
            this.directUploads = [];
            
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
        },

        // ========== DIRECT FILE UPLOAD METHODS (Phase A) ==========
        
        // Store for directly uploaded files (not from folder)
        directUploads: [],
        isUploading: false,
        uploadError: null,
        uploadProgress: 0,

        // Upload a single file via API
        async uploadFile(file) {
            console.log('[fileStore] Starting file upload:', file.name);
            this.isUploading = true;
            this.uploadError = null;
            this.uploadProgress = 0;

            try {
                const formData = new FormData();
                formData.append('file', file);
                
                if (this.sessionId) {
                    formData.append('session_id', this.sessionId);
                }

                const response = await window.apiService.uploadFile(formData, (progress) => {
                    this.uploadProgress = progress;
                });

                if (response.success) {
                    // Backend wraps data in "data" field
                    const data = response.data || {};
                    
                    // Add to direct uploads list
                    const uploadInfo = {
                        fileId: data.file_id,
                        filename: data.filename,
                        fileType: data.file_type, // 'spreadsheet' or 'config'
                        extension: data.extension,
                        sizeBytes: data.size_bytes,
                        uploadedAt: new Date().toISOString(),
                        parsedData: data.parsed_data
                    };

                    // Check if file already exists (by name)
                    const existingIndex = this.directUploads.findIndex(u => u.filename === data.filename);
                    if (existingIndex >= 0) {
                        this.directUploads[existingIndex] = uploadInfo;
                    } else {
                        this.directUploads.push(uploadInfo);
                    }

                    // Save to localStorage
                    this.saveDirectUploadsToLocalStorage();

                    // If it's a spreadsheet, also add to parsedCsvData
                    if (data.parsed_data && data.parsed_data.type === 'spreadsheet') {
                        this.parsedCsvData[data.filename] = {
                            headers: data.parsed_data.columns || [],
                            rows: this._convertRecordsToRows(data.parsed_data.data || [], data.parsed_data.columns || []),
                            entities: data.parsed_data.entities
                        };
                        
                        // Auto-select if first spreadsheet
                        if (!this.selectedCsv) {
                            this.setSelectedCsv(data.filename);
                        }
                        
                        this.saveToLocalStorage();
                        
                        // Dispatch event for other components
                        window.dispatchEvent(new CustomEvent('csv-data-ready', {
                            detail: { filename: data.filename, data: this.parsedCsvData[data.filename] }
                        }));
                    }

                    // If it's a config JSON, store it separately
                    if (data.parsed_data && data.parsed_data.type === 'config') {
                        this.importedConfig = data.parsed_data.content;
                        
                        // Dispatch event for config editor
                        window.dispatchEvent(new CustomEvent('config-json-loaded', {
                            detail: { config: data.parsed_data.content }
                        }));
                    }

                    console.log('[fileStore] File upload successful:', data.filename);
                    return { success: true, data: uploadInfo };
                } else {
                    throw new Error(response.message || 'Upload failed');
                }
            } catch (error) {
                console.error('[fileStore] File upload failed:', error);
                this.uploadError = error.message || 'Upload failed';
                return { success: false, error: this.uploadError };
            } finally {
                this.isUploading = false;
                this.uploadProgress = 0;
            }
        },

        // Upload multiple files
        async uploadMultipleFiles(files) {
            console.log('[fileStore] Starting batch upload of', files.length, 'files');
            const results = [];
            
            for (const file of files) {
                const result = await this.uploadFile(file);
                results.push({ filename: file.name, ...result });
            }
            
            const successful = results.filter(r => r.success);
            const failed = results.filter(r => !r.success);
            
            console.log('[fileStore] Batch upload complete:', successful.length, 'successful,', failed.length, 'failed');
            
            return {
                total: files.length,
                successful: successful.length,
                failed: failed.length,
                results: results
            };
        },

        // Handle drag and drop files
        async handleDropFiles(fileList) {
            console.log('[fileStore] Handling dropped files:', fileList.length);
            const files = Array.from(fileList);
            return await this.uploadMultipleFiles(files);
        },

        // Set active file from uploads
        setActiveUploadedFile(filename) {
            const upload = this.directUploads.find(u => u.filename === filename);
            if (!upload) {
                console.warn('[fileStore] Uploaded file not found:', filename);
                return false;
            }

            // If it's a spreadsheet, select it
            if (upload.fileType === 'spreadsheet' && this.parsedCsvData[filename]) {
                this.setSelectedCsv(filename);
                return true;
            }

            // If it's a config, trigger config load
            if (upload.fileType === 'config' && upload.parsedData?.content) {
                this.importedConfig = upload.parsedData.content;
                window.dispatchEvent(new CustomEvent('config-json-loaded', {
                    detail: { config: upload.parsedData.content, filename: filename }
                }));
                return true;
            }

            return false;
        },

        // Remove uploaded file
        removeUploadedFile(filename) {
            console.log('[fileStore] Removing uploaded file:', filename);
            
            // Remove from direct uploads
            this.directUploads = this.directUploads.filter(u => u.filename !== filename);
            
            // Remove from parsed data
            if (this.parsedCsvData[filename]) {
                delete this.parsedCsvData[filename];
            }
            
            // Update selection if needed
            if (this.selectedCsv === filename) {
                const remainingFiles = Object.keys(this.parsedCsvData);
                this.selectedCsv = remainingFiles.length > 0 ? remainingFiles[0] : '';
                this.activeCsvData = this.selectedCsv ? this.parsedCsvData[this.selectedCsv] : { headers: [], rows: [] };
                if (this.selectedCsv) {
                    this.syncConfigFromSelectedCsv();
                }
            }
            
            // Save to storage
            this.saveDirectUploadsToLocalStorage();
            this.saveToLocalStorage();
        },

        // Get list of uploaded spreadsheet files
        getUploadedSpreadsheets() {
            return this.directUploads.filter(u => u.fileType === 'spreadsheet');
        },

        // Get list of uploaded config files
        getUploadedConfigs() {
            return this.directUploads.filter(u => u.fileType === 'config');
        },

        // Save direct uploads to localStorage
        saveDirectUploadsToLocalStorage() {
            try {
                localStorage.setItem('ui_v2_exp__files__directUploads', JSON.stringify(this.directUploads));
            } catch (error) {
                console.error('[fileStore] Failed to save direct uploads to localStorage:', error);
            }
        },

        // Load direct uploads from localStorage
        loadDirectUploadsFromLocalStorage() {
            try {
                const saved = localStorage.getItem('ui_v2_exp__files__directUploads');
                if (saved) {
                    this.directUploads = JSON.parse(saved);
                }
            } catch (error) {
                console.error('[fileStore] Failed to load direct uploads from localStorage:', error);
                this.directUploads = [];
            }
        },

        // Get supported file formats
        getSupportedFormats() {
            return ['.csv', '.xlsx', '.xls', '.json'];
        },

        // Validate file type
        isValidFileType(filename) {
            const ext = filename.split('.').pop().toLowerCase();
            return ['csv', 'xlsx', 'xls', 'json'].includes(ext);
        },

        // Helper: Convert records (array of objects) to rows (array of arrays)
        _convertRecordsToRows(records, headers) {
            if (!Array.isArray(records) || !Array.isArray(headers)) {
                return [];
            }
            return records.map(record => 
                headers.map(header => record[header] !== undefined ? String(record[header]) : '')
            );
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
