/**
 * File Store - Alpine.js Store for File Management
 *
 * Manages uploaded files, CSV parsing, and data storage
 */
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

document.addEventListener('alpine:init', () => {
    Alpine.store('files', {
        // State
        uploadedFiles: [],
        parsedCsvData: {},
        selectedCsv: '',
        activeCsvData: { headers: [], rows: [] },
        dragOver: false,
        isLoading: false,
        error: null,

        // Initialization
        init() {
            console.log('File store initialized');
            this.loadFromLocalStorage();
        },

        // Load from localStorage
        loadFromLocalStorage() {
            try {
                // Note: uploadedFiles contains File objects which cannot be serialized to localStorage.
                // We reconstruct uploadedFiles from parsedCsvData keys.
                const savedData = localStorage.getItem('parsedCsvData');
                if (savedData) {
                    this.parsedCsvData = JSON.parse(savedData);
                    // Reconstruct uploadedFiles from parsedCsvData keys
                    this.uploadedFiles = Object.keys(this.parsedCsvData).map(name => ({
                        name: name,
                        size: 0, // File size not persisted - file must be re-uploaded for original size
                        lastModified: Date.now()
                    }));
                }

                const savedSelected = localStorage.getItem('selectedCsv');
                if (savedSelected) {
                    this.selectedCsv = savedSelected;
                    if (this.parsedCsvData[this.selectedCsv]) {
                        this.activeCsvData = this.parsedCsvData[this.selectedCsv];
                    }
                }
            } catch (error) {
                console.error('Failed to load from localStorage:', error);
                this.error = 'Failed to load saved files';
            }
        },

        // Save to localStorage
        saveToLocalStorage() {
            try {
                // Note: uploadedFiles contains File objects which cannot be serialized.
                // We only persist parsedCsvData and selectedCsv.
                // uploadedFiles will be reconstructed from parsedCsvData on load.
                localStorage.setItem('parsedCsvData', JSON.stringify(this.parsedCsvData));
                localStorage.setItem('selectedCsv', this.selectedCsv);
            } catch (error) {
                console.error('Failed to save to localStorage:', error);
                this.error = 'Failed to save files';
            }
        },

        // File upload handling
        handleFileUpload(event) {
            this.processFiles(event.target.files);
        },

        handleFileDrop(event) {
            this.dragOver = false;
            this.processFiles(event.dataTransfer.files);
        },

        processFiles(files) {
            if (!files || files.length === 0) return;

            this.isLoading = true;
            this.error = null;

            const csvFiles = Array.from(files).filter(file =>
                file.type === 'text/csv' || file.name.endsWith('.csv')
            );
            const seenIdentities = new Set();
            const preferredByName = new Map();

            csvFiles.forEach((file) => {
                if (!file || !file.name) {
                    return;
                }

                const identity = getFileIdentity(file);
                if (seenIdentities.has(identity)) {
                    return;
                }

                seenIdentities.add(identity);
                const existing = preferredByName.get(file.name);
                if (!existing || (existing.size === 0 && file.size > 0)) {
                    preferredByName.set(file.name, file);
                }
            });

            const dedupedCsvFiles = Array.from(preferredByName.values());

            if (dedupedCsvFiles.length === 0) {
                this.error = 'No CSV files found in selection';
                this.isLoading = false;
                return;
            }

            // Add files to uploaded list with filename de-duplication
            const uploadedByFilename = new Map();
            this.uploadedFiles.forEach((file) => {
                if (file && file.name) {
                    uploadedByFilename.set(file.name, file);
                }
            });

            dedupedCsvFiles.forEach((file) => {
                const existing = uploadedByFilename.get(file.name);
                if (!existing || (existing.size === 0 && file.size > 0)) {
                    uploadedByFilename.set(file.name, file);
                }
            });

            this.uploadedFiles = Array.from(uploadedByFilename.values());
            this.saveToLocalStorage();

            // Process each CSV file
            dedupedCsvFiles.forEach(file => {
                this.parseCsvFile(file);
            });

            this.isLoading = false;
        },

        parseCsvFile(file) {
            return new Promise((resolve, reject) => {
                Papa.parse(file, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        if (results.errors && results.errors.length > 0) {
                            this.error = `CSV parsing error: ${results.errors[0].message}`;
                            reject(results.errors[0]);
                            return;
                        }

                        this.parsedCsvData[file.name] = {
                            headers: results.meta.fields,
                            rows: results.data.map(row => Object.values(row))
                        };

                        // If this is the first file, select it
                        if (this.uploadedFiles.length === 1) {
                            this.selectedCsv = file.name;
                            this.activeCsvData = this.parsedCsvData[file.name];
                        }

                        this.saveToLocalStorage();
                        resolve(results);
                    },
                    error: (error) => {
                        this.error = `Failed to parse CSV: ${error.message}`;
                        reject(error);
                    }
                });
            });
        },

        // Select a CSV file
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
            }

            delete this.parsedCsvData[filename];
            this.saveToLocalStorage();
        },

        // Clear all files
        clearAllFiles() {
            this.uploadedFiles = [];
            this.parsedCsvData = {};
            this.selectedCsv = '';
            this.activeCsvData = { headers: [], rows: [] };
            this.saveToLocalStorage();
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
        applyRectangularPaste
    };
}
