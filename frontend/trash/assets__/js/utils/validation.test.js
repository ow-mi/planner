/**
 * Unit tests for validation.js utility functions
 */

const {
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
} = require('./validation');

describe('validationUtils', () => {
    test('validateEmail validates correct email format', () => {
        expect(validateEmail('user@example.com')).toBe(true);
        expect(validateEmail('test.user@domain.org')).toBe(true);
    });

    test('validateEmail rejects invalid email format', () => {
        expect(validateEmail('invalid')).toBe(false);
        expect(validateEmail('user@')).toBe(false);
        expect(validateEmail('@example.com')).toBe(false);
    });

    test('validateUrl validates correct URL format', () => {
        expect(validateUrl('https://example.com')).toBe(true);
        expect(validateUrl('http://localhost:3000')).toBe(true);
    });

    test('validateUrl rejects invalid URL format', () => {
        expect(validateUrl('invalid-url')).toBe(false);
        expect(validateUrl('example.com')).toBe(false);
    });

    test('validateRequired validates non-empty values', () => {
        expect(validateRequired('hello')).toBe(true);
        expect(validateRequired(0)).toBe(true);
        expect(validateRequired(false)).toBe(true);
    });

    test('validateRequired rejects empty values', () => {
        expect(validateRequired('')).toBe(false);
        expect(validateRequired(null)).toBe(false);
        expect(validateRequired(undefined)).toBe(false);
    });

    test('validateMinLength validates minimum length', () => {
        expect(validateMinLength('hello', 3)).toBe(true);
        expect(validateMinLength('hi', 3)).toBe(false);
    });

    test('validateMaxLength validates maximum length', () => {
        expect(validateMaxLength('hello', 10)).toBe(true);
        expect(validateMaxLength('hello world', 5)).toBe(false);
    });

    test('validateNumber validates numeric values', () => {
        expect(validateNumber(123)).toBe(true);
        expect(validateNumber('123')).toBe(true);
        expect(validateNumber(12.5)).toBe(true);
    });

    test('validateNumber rejects non-numeric values', () => {
        expect(validateNumber('abc')).toBe(false);
        expect(validateNumber(NaN)).toBe(false);
        expect(validateNumber(Infinity)).toBe(false);
    });

    test('validateMinValue validates minimum value', () => {
        expect(validateMinValue(10, 5)).toBe(true);
        expect(validateMinValue(3, 5)).toBe(false);
    });

    test('validateMaxValue validates maximum value', () => {
        expect(validateMaxValue(10, 15)).toBe(true);
        expect(validateMaxValue(20, 15)).toBe(false);
    });

    test('validateDate validates YYYY-MM-DD format', () => {
        expect(validateDate('2024-01-15')).toBe(true);
        expect(validateDate('2024-12-31')).toBe(true);
    });

    test('validateDate rejects invalid date format', () => {
        expect(validateDate('2024-1-15')).toBe(false);
        expect(validateDate('15-01-2024')).toBe(false);
        expect(validateDate('invalid')).toBe(false);
    });

    test('validateCsvFile validates CSV files', () => {
        const csvFile = { name: 'data.csv', type: 'text/csv' };
        expect(validateCsvFile(csvFile)).toBe(true);
    });

    test('validateCsvFile validates files by extension', () => {
        const csvFile = { name: 'data.CSV', type: 'application/octet-stream' };
        expect(validateCsvFile(csvFile)).toBe(true);
    });

    test('validateJsonFile validates JSON files', () => {
        const jsonFile = { name: 'config.json', type: 'application/json' };
        expect(validateJsonFile(jsonFile)).toBe(true);
    });

    test('validateJsonFile validates files by extension', () => {
        const jsonFile = { name: 'config.JSON', type: 'application/octet-stream' };
        expect(validateJsonFile(jsonFile)).toBe(true);
    });

    test('validateForm validates form with valid inputs', () => {
        const form = document.createElement('form');
        form.innerHTML = `
            <input data-validation="required" value="hello">
            <input data-validation="email" value="user@example.com">
        `;
        expect(validateForm(form)).toBe(true);
    });

    test('validateForm rejects form with invalid inputs', () => {
        const form = document.createElement('form');
        form.innerHTML = `
            <input data-validation="required" value="">
            <input data-validation="email" value="invalid-email">
        `;
        expect(validateForm(form)).toBe(false);
    });

    test('validateConfiguration validates correct configuration', () => {
        const config = {
            mode: 'leg_end_dates',
            weights: { makespan_weight: 0.5, priority_weight: 0.5 }
        };
        const result = validateConfiguration(config);
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    test('validateConfiguration rejects missing mode', () => {
        const config = {
            weights: { makespan_weight: 0.5, priority_weight: 0.5 }
        };
        const result = validateConfiguration(config);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Configuration mode is required');
    });

    test('validateConfiguration rejects invalid weights', () => {
        const config = {
            mode: 'leg_end_dates',
            weights: { makespan_weight: 1.5, priority_weight: 0.5 }
        };
        const result = validateConfiguration(config);
        expect(result.isValid).toBe(false);
    });

    test('validateConfiguration rejects weights not summing to 1', () => {
        const config = {
            mode: 'leg_end_dates',
            weights: { makespan_weight: 0.6, priority_weight: 0.3 }
        };
        const result = validateConfiguration(config);
        expect(result.isValid).toBe(false);
    });
});
