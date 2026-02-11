/**
 * Unit tests for helpers.js utility functions
 */

const {
    formatDate,
    formatFileSize,
    debounce,
    throttle,
    deepClone,
    generateUniqueId,
    validateEmail,
    validateUrl,
    capitalizeFirstLetter,
    truncateText,
    chunkArray
} = require('./helpers');

describe('helpers', () => {
    beforeEach(() => {
        // Clear window.helpers before each test
        if (window.helpers) {
            delete window.helpers;
        }
        // Use fake timers for debounce/throttle tests
        jest.useFakeTimers();
    });

    test('formatDate formats date to YYYY-MM-DD by default', () => {
        const result = formatDate('2024-01-15');
        expect(result).toBe('2024-01-15');
    });

    test('formatDate formats date to MM/DD/YYYY', () => {
        const result = formatDate('2024-01-15', 'MM/DD/YYYY');
        expect(result).toBe('01/15/2024');
    });

    test('formatDate formats date to DD/MM/YYYY', () => {
        const result = formatDate('2024-01-15', 'DD/MM/YYYY');
        expect(result).toBe('15/01/2024');
    });

    test('formatDate returns empty string for invalid date', () => {
        const result = formatDate('invalid-date');
        expect(result).toBe('');
    });

    test('formatDate returns original string for empty input', () => {
        const result = formatDate('');
        expect(result).toBe('');
    });

    test('formatFileSize formats bytes to KB', () => {
        const result = formatFileSize(1536);
        expect(result).toBe('1.5 KB');
    });

    test('formatFileSize formats bytes to MB', () => {
        const result = formatFileSize(1572864);
        expect(result).toBe('1.5 MB');
    });

    test('formatFileSize returns 0 Bytes for zero', () => {
        const result = formatFileSize(0);
        expect(result).toBe('0 Bytes');
    });

    test('debounce delays function execution', () => {
        const mockFn = jest.fn();
        const debouncedFn = debounce(mockFn, 100);

        debouncedFn();
        expect(mockFn).not.toHaveBeenCalled();

        // Fast forward time
        jest.advanceTimersByTime(100);
        expect(mockFn).toHaveBeenCalled();
    });

    test('throttle limits function execution frequency', () => {
        const mockFn = jest.fn();
        const throttledFn = throttle(mockFn, 100);

        throttledFn();
        expect(mockFn).toHaveBeenCalled();

        mockFn.mockClear();
        throttledFn();
        expect(mockFn).not.toHaveBeenCalled();

        // Fast forward time
        jest.advanceTimersByTime(100);
        throttledFn();
        expect(mockFn).toHaveBeenCalled();
    });

    test('deepClone creates independent copy of object', () => {
        const original = { a: 1, b: { c: 2 } };
        const cloned = deepClone(original);

        expect(cloned).toEqual(original);
        expect(cloned).not.toBe(original);
        expect(cloned.b).not.toBe(original.b);

        cloned.b.c = 3;
        expect(original.b.c).toBe(2);
    });

    test('deepClone creates independent copy of array', () => {
        const original = [1, { a: 2 }, [3]];
        const cloned = deepClone(original);

        expect(cloned).toEqual(original);
        expect(cloned).not.toBe(original);
        expect(cloned[1]).not.toBe(original[1]);

        cloned[1].a = 3;
        expect(original[1].a).toBe(2);
    });

    test('generateUniqueId creates unique IDs', () => {
        const id1 = generateUniqueId('test');
        const id2 = generateUniqueId('test');

        expect(id1).toMatch(/^test-\d+-\d+$/);
        expect(id2).toMatch(/^test-\d+-\d+$/);
        expect(id1).not.toBe(id2);
    });

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

    test('capitalizeFirstLetter capitalizes first letter', () => {
        expect(capitalizeFirstLetter('hello')).toBe('Hello');
        expect(capitalizeFirstLetter('HELLO')).toBe('HELLO');
    });

    test('capitalizeFirstLetter returns empty string for empty input', () => {
        expect(capitalizeFirstLetter('')).toBe('');
    });

    test('truncateText truncates long text', () => {
        expect(truncateText('This is a long text', 10)).toBe('This is a ...');
    });

    test('truncateText returns original text if within limit', () => {
        expect(truncateText('Short', 10)).toBe('Short');
    });

    test('truncateText uses custom suffix', () => {
        expect(truncateText('This is a long text', 10, '...more')).toBe('This is a ...more');
    });

    test('chunkArray chunks array into equal parts', () => {
        const result = chunkArray([1, 2, 3, 4, 5], 2);
        expect(result).toEqual([[1, 2], [3, 4], [5]]);
    });

    test('chunkArray returns empty array for empty input', () => {
        const result = chunkArray([], 2);
        expect(result).toEqual([]);
    });

    test('chunkArray returns original array for size >= length', () => {
        const result = chunkArray([1, 2, 3], 5);
        expect(result).toEqual([[1, 2, 3]]);
    });
});
