/**
 * Validation Utilities - Form validation and data validation functions
 */

// Email validation
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// URL validation
function validateUrl(url) {
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

// Required field validation
function validateRequired(value) {
    return value !== null && value !== undefined && value !== '';
}

// Minimum length validation
function validateMinLength(value, minLength) {
    return value && value.length >= minLength;
}

// Maximum length validation
function validateMaxLength(value, maxLength) {
    return value && value.length <= maxLength;
}

// Number validation
function validateNumber(value) {
    return !isNaN(parseFloat(value)) && isFinite(value);
}

// Minimum value validation
function validateMinValue(value, min) {
    return validateNumber(value) && parseFloat(value) >= min;
}

// Maximum value validation
function validateMaxValue(value, max) {
    return validateNumber(value) && parseFloat(value) <= max;
}

// Date validation (YYYY-MM-DD format)
function validateDate(dateString) {
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && dateString.match(/^\d{4}-\d{2}-\d{2}$/);
}

// CSV file validation
function validateCsvFile(file) {
    return file && (file.type === 'text/csv' || file.name.endsWith('.csv'));
}

// JSON file validation
function validateJsonFile(file) {
    return file && (file.type === 'application/json' || file.name.endsWith('.json'));
}

// Form validation - validate all inputs in a form
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
                    if (!validateMinLength(input.value, parseInt(ruleValue))) {
                        inputValid = false;
                        showValidationError(input, `Minimum length: ${ruleValue} characters`);
                    }
                    break;
                case 'maxLength':
                    if (!validateMaxLength(input.value, parseInt(ruleValue))) {
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

// Show validation error for an input
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

// Clear validation error for an input
function clearValidationError(input) {
    input.classList.remove('validation-error');

    const errorElement = input.nextSibling;
    if (errorElement && errorElement.className === 'validation-error-message') {
        errorElement.parentNode.removeChild(errorElement);
    }
}

// Validate configuration object
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
