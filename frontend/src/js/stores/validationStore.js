/**
 * Validation Store - Alpine.js Store for Spreadsheet Validation
 *
 * Manages validation state and gates downstream configuration/solver actions
 */

// Storage keys
const VALIDATION_STORAGE_KEYS = {
    ACTIVE_SPREADSHEET_ID: 'ui_v2_validation__activeSpreadsheetId',
    VALIDATION_RESULT: 'ui_v2_validation__validationResult',
    IS_VALID: 'ui_v2_validation__isValid'
};

document.addEventListener('alpine:init', () => {
    Alpine.store('validation', {
        // State
        activeSpreadsheetId: null,
        validationResult: null,
        isValidating: false,
        validationError: null,
        isInitialized: false,

        // Initialization
        init() {
            try {
                if (this.isInitialized) {
                    console.log('[validationStore] Already initialized, skipping');
                    return;
                }
                console.log('Validation store initialized');
                this.isInitialized = true;
            } catch (error) {
                console.error('ValidationStore init failed:', error);
                this.validationError = 'Failed to initialize validation store';
            }
        },

        // Check if validation passed and we have an active spreadsheet
        isValidationPassed() {
            return Boolean(
                this.activeSpreadsheetId && 
                this.validationResult && 
                this.validationResult.is_valid === true
            );
        },

        // Get the active spreadsheet ID
        getActiveSpreadsheetId() {
            return this.activeSpreadsheetId;
        },

        // Check if a specific spreadsheet is the active one
        isActiveSpreadsheet(spreadsheetId) {
            return this.activeSpreadsheetId === spreadsheetId;
        },

        // Set the active spreadsheet and validate it
        async setActiveSpreadsheet(spreadsheetId, fileContent) {
            this.isValidating = true;
            this.validationError = null;

            try {
                if (!window.apiService) {
                    throw new Error('Backend API service is unavailable.');
                }

                if (!fileContent) {
                    throw new Error('File content is required for validation.');
                }

                // Call backend validation
                const response = await window.apiService.validateSpreadsheet({
                    spreadsheet_id: spreadsheetId,
                    file_content: fileContent
                });

                this.activeSpreadsheetId = spreadsheetId;
                this.validationResult = response.validation;

                // Dispatch event for other components
                window.dispatchEvent(new CustomEvent('spreadsheet-validated', {
                    detail: {
                        spreadsheetId,
                        validation: response.validation
                    }
                }));

                return {
                    success: response.validation.is_valid,
                    errors: this.getValidationErrors(response.validation)
                };

            } catch (error) {
                console.error('[validationStore] Validation failed:', error);
                this.validationError = error?.message || 'Validation failed';
                this.activeSpreadsheetId = null;
                this.validationResult = null;
                return {
                    success: false,
                    errors: [this.validationError]
                };
            } finally {
                this.isValidating = false;
            }
        },

        // Clear active spreadsheet (e.g., when file is removed)
        clearActiveSpreadsheet() {
            this.activeSpreadsheetId = null;
            this.validationResult = null;
            this.validationError = null;
        },

        // Get extracted entities from validation result
        getExtractedEntities() {
            return this.validationResult?.extracted_entities || null;
        },

        // Get all validation errors as flat array
        getValidationErrors(validation = null) {
            const result = validation || this.validationResult;
            if (!result) return [];

            const errors = [];

            // Header errors
            if (result.header_errors) {
                result.header_errors.forEach(err => {
                    errors.push({
                        type: 'header',
                        column: err.column_name,
                        message: err.error_message,
                        category: err.category
                    });
                });
            }

            // Row errors
            if (result.row_errors) {
                result.row_errors.forEach(err => {
                    errors.push({
                        type: 'row',
                        row: err.row_index,
                        column: err.column_name,
                        value: err.value,
                        message: err.error_message,
                        category: err.category
                    });
                });
            }

            return errors;
        },

        // Check if validation has header errors
        hasHeaderErrors() {
            return Boolean(
                this.validationResult?.header_errors && 
                this.validationResult.header_errors.length > 0
            );
        },

        // Check if validation has row errors
        hasRowErrors() {
            return Boolean(
                this.validationResult?.row_errors && 
                this.validationResult.row_errors.length > 0
            );
        },

        // Block configuration/solver actions when validation fails
        canAccessConfiguration() {
            return this.isValidationPassed();
        },

        canAccessSolver() {
            return this.isValidationPassed();
        }
    });
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        VALIDATION_STORAGE_KEYS
    };
}
