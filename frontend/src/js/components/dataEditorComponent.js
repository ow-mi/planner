/**
 * Data Editor Component - Alpine.js Component
 *
 * This file defines the Alpine.js component for the CSV data editor.
 * It must be loaded BEFORE Alpine.js initializes to ensure x-data works correctly.
 */

function dataEditorComponent() {
    return {
        selectedCsv: '',
        activeCsvData: { headers: [], rows: [] },
        originalData: null,
        selectedRowIndex: -1,
        columnTypes: [],
        validationErrors: {},
        isMutatingRows: false,
        selectedRowIndicesByCsv: {},

        get uploadedFiles() {
            return this.$store.files.uploadedFiles || [];
        },

        get dedupedUploadedFilenames() {
            // Get unique filenames directly from parsedCsvData keys
            const parsedData = this.$store.files.parsedCsvData || {};
            const fileNames = Object.keys(parsedData);

            return fileNames.sort();
        },

        init() {
            console.log('Data editor component initialized');
            this.loadRowSelectionState();

            // Watch for file changes
            this.$watch('$store.files.selectedCsv', (newVal) => {
                if (newVal) {
                    this.selectedCsv = newVal;
                    this.displayCsvData();
                }
            });
        },

        displayCsvData() {
            if (this.selectedCsv && this.$store.files.parsedCsvData[this.selectedCsv]) {
                this.activeCsvData = this.$store.files.parsedCsvData[this.selectedCsv];
                this.originalData = JSON.stringify(this.activeCsvData);
                this.selectedRowIndex = this.getPersistedSelectedRowIndex(this.selectedCsv, this.activeCsvData.rows.length);
                this.validationErrors = {};
                this.refreshColumnTypes();
                return true;
            } else {
                this.activeCsvData = { headers: [], rows: [] };
                this.originalData = null;
                this.selectedRowIndex = -1;
                this.validationErrors = {};
                this.columnTypes = [];
                return false;
            }
        },

        loadRowSelectionState() {
            try {
                const savedSelectionState = localStorage.getItem('dataEditorSelectedRowIndices');
                if (!savedSelectionState) {
                    this.selectedRowIndicesByCsv = {};
                    return;
                }

                const parsedSelectionState = JSON.parse(savedSelectionState);
                this.selectedRowIndicesByCsv = parsedSelectionState && typeof parsedSelectionState === 'object'
                    ? parsedSelectionState
                    : {};
            } catch (error) {
                this.selectedRowIndicesByCsv = {};
            }
        },

        persistRowSelectionState() {
            localStorage.setItem('dataEditorSelectedRowIndices', JSON.stringify(this.selectedRowIndicesByCsv));
        },

        getPersistedSelectedRowIndex(fileName, rowCount) {
            if (!fileName) {
                return -1;
            }

            const persistedIndex = this.selectedRowIndicesByCsv[fileName];
            if (!Number.isInteger(persistedIndex) || persistedIndex < 0 || persistedIndex >= rowCount) {
                delete this.selectedRowIndicesByCsv[fileName];
                this.persistRowSelectionState();
                return -1;
            }

            return persistedIndex;
        },

        persistSelectedRowIndex() {
            if (!this.selectedCsv) {
                return;
            }

            if (this.selectedRowIndex < 0) {
                delete this.selectedRowIndicesByCsv[this.selectedCsv];
            } else {
                this.selectedRowIndicesByCsv[this.selectedCsv] = this.selectedRowIndex;
            }

            this.persistRowSelectionState();
        },

        hasChanges() {
            if (!this.originalData) return false;
            return this.originalData !== JSON.stringify(this.activeCsvData);
        },

        saveChanges() {
            if (!this.hasChanges()) {
                alert('No changes to save');
                return;
            }

            // Update the store with modified data
            this.syncActiveCsvDataToStore();
            this.originalData = JSON.stringify(this.activeCsvData);

            alert('Changes saved successfully!');
        },

        syncActiveCsvDataToStore() {
            if (!this.selectedCsv) {
                return;
            }

            const clonedData = typeof structuredClone === 'function'
                ? structuredClone(this.activeCsvData)
                : JSON.parse(JSON.stringify(this.activeCsvData));

            this.$store.files.parsedCsvData[this.selectedCsv] = clonedData;
            this.$store.files.saveToLocalStorage();
        },

        addNewRow() {
            if (this.activeCsvData.headers.length === 0 || this.isMutatingRows) return;

            this.isMutatingRows = true;
            try {
                // Create new row with empty values using immutable spread pattern
                const newRow = Array(this.activeCsvData.headers.length).fill('');
                this.activeCsvData = {
                    ...this.activeCsvData,
                    rows: [...this.activeCsvData.rows, newRow]
                };
                this.refreshColumnTypes();
                this.syncActiveCsvDataToStore();
            } finally {
                this.isMutatingRows = false;
            }
        },

        removeSelectedRow() {
            if (this.isMutatingRows) {
                return;
            }

            if (this.selectedRowIndex >= 0 && this.selectedRowIndex < this.activeCsvData.rows.length) {
                if (confirm('Are you sure you want to remove this row?')) {
                    this.isMutatingRows = true;
                    try {
                        // Use immutable spread pattern instead of splice
                        this.activeCsvData = {
                            ...this.activeCsvData,
                            rows: this.activeCsvData.rows.filter((_, idx) => idx !== this.selectedRowIndex)
                        };
                        this.selectedRowIndex = -1;
                        this.persistSelectedRowIndex();
                        this.refreshColumnTypes();
                        this.syncActiveCsvDataToStore();
                    } finally {
                        this.isMutatingRows = false;
                    }
                }
            } else {
                alert('Please select a row to remove');
            }
        },

        selectRow(index, event) {
            // Don't select row if clicking on an input or button
            if (event && (event.target.tagName === 'INPUT' || event.target.tagName === 'BUTTON' || event.target.tagName === 'SELECT' || event.target.tagName === 'TEXTAREA')) {
                return;
            }

            if (index < 0 || index >= this.activeCsvData.rows.length) {
                return;
            }

            this.selectedRowIndex = index;
            this.persistSelectedRowIndex();
        },

        refreshColumnTypes() {
            this.columnTypes = this.$store.files.inferColumnTypes(this.activeCsvData);
        },

        getColumnType(cellIndex) {
            return this.columnTypes[cellIndex] || 'text';
        },

        getInputMode(cellIndex) {
            const columnType = this.getColumnType(cellIndex);
            if (columnType === 'number') {
                return 'decimal';
            }

            return 'text';
        },

        getPlaceholder(cellIndex) {
            const columnType = this.getColumnType(cellIndex);
            if (columnType === 'number') {
                return 'Numeric value';
            }
            if (columnType === 'date') {
                return 'YYYY-MM-DD';
            }

            return '';
        },

        getValidationKey(rowIndex, cellIndex) {
            return `${rowIndex}:${cellIndex}`;
        },

        handleCellInput(rowIndex, cellIndex) {
            this.validateCell(rowIndex, cellIndex);
        },

        validateCell(rowIndex, cellIndex) {
            const row = this.activeCsvData.rows[rowIndex] || [];
            const value = row[cellIndex] || '';
            const columnType = this.getColumnType(cellIndex);
            const key = this.getValidationKey(rowIndex, cellIndex);
            const isValid = this.$store.files.validateCellValueByType(value, columnType);

            if (isValid) {
                delete this.validationErrors[key];
                return true;
            }

            if (columnType === 'number') {
                this.validationErrors[key] = 'Expected a numeric value';
            } else if (columnType === 'date') {
                this.validationErrors[key] = 'Expected date format YYYY-MM-DD';
            } else {
                this.validationErrors[key] = 'Invalid value';
            }

            return false;
        },

        hasValidationError(rowIndex, cellIndex) {
            return Boolean(this.validationErrors[this.getValidationKey(rowIndex, cellIndex)]);
        },

        getValidationHint(rowIndex, cellIndex) {
            return this.validationErrors[this.getValidationKey(rowIndex, cellIndex)] || '';
        },

        getCellInputClass(rowIndex, cellIndex) {
            return {
                [`column-type-${this.getColumnType(cellIndex)}`]: true,
                'invalid-cell': this.hasValidationError(rowIndex, cellIndex)
            };
        },

        handleCellPaste(event, startRow, startCol) {
            const rawText = event?.clipboardData?.getData('text/plain');
            if (!rawText || !rawText.includes('\t') && !rawText.includes('\n')) {
                return;
            }

            event.preventDefault();
            const pastedMatrix = this.$store.files.parseTabularText(rawText);
            if (!pastedMatrix.length) {
                return;
            }

            const updatedRows = this.$store.files.applyRectangularPaste(
                this.activeCsvData.rows,
                startRow,
                startCol,
                pastedMatrix,
                this.activeCsvData.headers.length
            );

            this.activeCsvData.rows = updatedRows;
            this.refreshColumnTypes();

            pastedMatrix.forEach((pastedRow, rowOffset) => {
                pastedRow.forEach((_, colOffset) => {
                    const targetCol = startCol + colOffset;
                    if (targetCol < this.activeCsvData.headers.length) {
                        this.validateCell(startRow + rowOffset, targetCol);
                    }
                });
            });
        }
    };
}
