/**
 * File Store - Alpine.js Store for File Management
 *
 * Manages uploaded files, CSV parsing, and data storage
 */
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
                const savedFiles = localStorage.getItem('uploadedFiles');
                if (savedFiles) {
                    this.uploadedFiles = JSON.parse(savedFiles);
                }

                const savedData = localStorage.getItem('parsedCsvData');
                if (savedData) {
                    this.parsedCsvData = JSON.parse(savedData);
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
                localStorage.setItem('uploadedFiles', JSON.stringify(this.uploadedFiles));
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

            if (csvFiles.length === 0) {
                this.error = 'No CSV files found in selection';
                this.isLoading = false;
                return;
            }

            // Add files to uploaded list
            this.uploadedFiles.push(...csvFiles);
            this.saveToLocalStorage();

            // Process each CSV file
            csvFiles.forEach(file => {
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
        }
    });
});
