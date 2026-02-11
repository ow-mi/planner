/**
 * Validation Utilities - Form validation and data validation functions
 */

/**
 * Validates an email address format
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid email format, false otherwise
 */
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Validates a URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL format, false otherwise
 */
function validateUrl(url) {
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Validates that a value is not null, undefined, or empty
 * @param {*} value - Value to validate
 * @returns {boolean} True if value is not empty
 */
function validateRequired(value) {
    return value !== null && value !== undefined && value !== '';
}

/**
 * Validates that a value meets minimum length requirement
 * @param {*} value - Value to validate
 * @param {number} minLength - Minimum required length
 * @returns {boolean} True if value meets minimum length
 */
function validateMinLength(value, minLength) {
    return value && value.length >= minLength;
}

/**
 * Validates that a value meets maximum length requirement
 * @param {*} value - Value to validate
 * @param {number} maxLength - Maximum allowed length
 * @returns {boolean} True if value meets maximum length
 */
function validateMaxLength(value, maxLength) {
    return value && value.length <= maxLength;
}

/**
 * Validates that a value is a valid number
 * @param {*} value - Value to validate
 * @returns {boolean} True if value is a valid number
 */
function validateNumber(value) {
    return !isNaN(parseFloat(value)) && isFinite(value);
}

/**
 * Validates that a value is greater than or equal to a minimum
 * @param {*} value - Value to validate
 * @param {number} min - Minimum allowed value
 * @returns {boolean} True if value is >= min
 */
function validateMinValue(value, min) {
    return validateNumber(value) && parseFloat(value) >= min;
}

/**
 * Validates that a value is less than or equal to a maximum
 * @param {*} value - Value to validate
 * @param {number} max - Maximum allowed value
 * @returns {boolean} True if value is <= max
 */
function validateMaxValue(value, max) {
    return validateNumber(value) && parseFloat(value) <= max;
}

/**
 * Validates that a date string is in YYYY-MM-DD format
 * @param {string} dateString - Date string to validate
 * @returns {boolean} True if valid date format
 */
function validateDate(dateString) {
    const date = new Date(dateString);
    const isValidDate = !isNaN(date.getTime());
    const isValidFormat = dateString.match(/^\d{4}-\d{2}-\d{2}$/);
    return isValidDate && isValidFormat !== null;
}

/**
 * Validates that a file is a CSV file
 * @param {File} file - File object to validate
 * @returns {boolean} True if file is a CSV
 */
function validateCsvFile(file) {
    if (!file) return false;
    const isTextCsv = file.type === 'text/csv';
    const endsWithCsv = file.name.toLowerCase().endsWith('.csv');
    return isTextCsv || endsWithCsv;
}

/**
 * Validates that a file is a JSON file
 * @param {File} file - File object to validate
 * @returns {boolean} True if file is a JSON
 */
function validateJsonFile(file) {
    if (!file) return false;
    const isJson = file.type === 'application/json';
    const endsWithJson = file.name.toLowerCase().endsWith('.json');
    return isJson || endsWithJson;
}

/**
 * Validates all inputs in a form element
 * @param {HTMLElement} formElement - Form element to validate
 * @returns {boolean} True if all inputs are valid
 */
function validateForm(formElement) {
    let isValid = true;
    const inputs = formElement.querySelectorAll('[data-validation]');

    inputs.forEach(input => {
        const validationRules = input.getAttribute('data-validation').split('|');
        let inputValid = true;

        validationRules.forEach(rule => {
            const [ruleName, ruleValue] = rule.split(':');

            switch (ruleName) {
                case 'required':
                    if (!validateRequired(input.value)) {
                        inputValid = false;
                        showValidationError(input, 'This field is required');
                    }
                    break;
                case 'email':
                    if (!validateEmail(input.value)) {
                        inputValid = false;
                        showValidationError(input, 'Please enter a valid email address');
                    }
                    break;
                case 'minLength':
                     if (!validateMinLength(input.value, parseInt(ruleValue, 10))) {
                        inputValid = false;
                        showValidationError(input, `Minimum length: ${ruleValue} characters`);
                    }
                    break;
                case 'maxLength':
                     if (!validateMaxLength(input.value, parseInt(ruleValue, 10))) {
                        inputValid = false;
                        showValidationError(input, `Maximum length: ${ruleValue} characters`);
                    }
                    break;
                case 'number':
                    if (!validateNumber(input.value)) {
                        inputValid = false;
                        showValidationError(input, 'Please enter a valid number');
                    }
                    break;
                case 'min':
                    if (!validateMinValue(input.value, parseFloat(ruleValue))) {
                        inputValid = false;
                        showValidationError(input, `Minimum value: ${ruleValue}`);
                    }
                    break;
                case 'max':
                    if (!validateMaxValue(input.value, parseFloat(ruleValue))) {
                        inputValid = false;
                        showValidationError(input, `Maximum value: ${ruleValue}`);
                    }
                    break;
            }
        });

        if (inputValid) {
            clearValidationError(input);
        } else {
            isValid = false;
        }
    });

    return isValid;
}

/**
 * Shows a validation error message for an input element
 * @param {HTMLElement} input - Input element to show error for
 * @param {string} message - Error message to display
 */
function showValidationError(input, message) {
    // Remove existing error first
    clearValidationError(input);

    // Add error class to input
    input.classList.add('validation-error');

    // Create error message element
    const errorElement = document.createElement('div');
    errorElement.className = 'validation-error-message';
    errorElement.textContent = message;
    errorElement.style.color = 'var(--danger-color)';
    errorElement.style.fontSize = '0.8rem';
    errorElement.style.marginTop = '0.25rem';

    // Insert error message after input
    input.parentNode.insertBefore(errorElement, input.nextSibling);
}

/**
 * Clears validation error for an input element
 * @param {HTMLElement} input - Input element to clear error for
 */
function clearValidationError(input) {
    input.classList.remove('validation-error');

    const errorElement = input.nextSibling;
    if (errorElement && errorElement.className === 'validation-error-message') {
        errorElement.parentNode.removeChild(errorElement);
    }
}

/**
 * Validates a configuration object structure
 * @param {Object} config - Configuration object to validate
 * @returns {{isValid: boolean, errors: string[]}} Validation result with errors array
 */
function validateConfiguration(config) {
    const errors = [];

    // Validate required fields
    if (!config.mode) {
        errors.push('Configuration mode is required');
    }

    if (!config.weights) {
        errors.push('Weights configuration is required');
    } else {
        // Validate weights
        const makespanWeight = config.weights.makespan_weight;
        const priorityWeight = config.weights.priority_weight;

        if (typeof makespanWeight !== 'number' || makespanWeight < 0 || makespanWeight > 1) {
            errors.push('makespan_weight must be a number between 0 and 1');
        }

        if (typeof priorityWeight !== 'number' || priorityWeight < 0 || priorityWeight > 1) {
            errors.push('priority_weight must be a number between 0 and 1');
        }

        // Check weights sum to 1.0
        const weightSum = makespanWeight + priorityWeight;
        if (Math.abs(weightSum - 1.0) > 0.001) {
            errors.push('makespan_weight + priority_weight must equal 1.0');
        }
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// Export functions to global scope
window.validationUtils = {
    validateEmail,
    validateUrl,
    validateRequired,
    validateMinLength,
    validateMaxLength,
    validateNumber,
    validateMinValue,
    validateMaxValue,
    validateDate,
    validateCsvFile,
    validateJsonFile,
    validateForm,
    showValidationError,
    clearValidationError,
    validateConfiguration
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        validateEmail,
        validateUrl,
        validateRequired,
        validateMinLength,
        validateMaxLength,
        validateNumber,
        validateMinValue,
        validateMaxValue,
        validateDate,
        validateCsvFile,
        validateJsonFile,
        validateForm,
        showValidationError,
        clearValidationError,
        validateConfiguration
    };
}
