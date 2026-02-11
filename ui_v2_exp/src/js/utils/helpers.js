/**
 * Helper Functions - Utility functions for the application
 */

/**
 * Formats a date string to the specified format
 * @param {string} dateString - The date string to format
 * @param {string} [format='YYYY-MM-DD'] - Target format (YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD HH:mm, YYYY-MM-DDTHH:mm:ss)
 * @returns {string} Formatted date string or empty string if invalid
 * @example
 * formatDate('2024-01-15', 'MM/DD/YYYY') // '01/15/2024'
 */
function formatDate(dateString, format = 'YYYY-MM-DD') {
    if (!dateString) return '';

    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
        return '';
    }

    const pad = (num) => num.toString().padStart(2, '0');

    const formats = {
        'YYYY-MM-DD': `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
        'MM/DD/YYYY': `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()}`,
        'DD/MM/YYYY': `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`,
        'YYYY-MM-DD HH:mm': `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`,
        'YYYY-MM-DDTHH:mm:ss': date.toISOString().replace('Z', '')
    };

    return formats[format] || date.toISOString();
}

/**
 * Formats a file size in bytes to a human-readable string
 * @param {number} bytes - File size in bytes
 * @returns {string} Human-readable file size (e.g., '1.5 MB')
 * @example
 * formatFileSize(1572864) // '1.5 MB'
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Creates a debounced version of a function that delays execution until after wait milliseconds
 * @param {Function} func - The function to debounce
 * @param {number} wait - Number of milliseconds to delay execution
 * @returns {Function} Debounced function
 * @example
 * const debouncedSearch = debounce(search, 300);
 */
function debounce(func, wait) {
    let timeout;

    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };

        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Creates a throttled version of a function that limits execution to once per limit milliseconds
 * @param {Function} func - The function to throttle
 * @param {number} limit - Minimum number of milliseconds between function calls
 * @returns {Function} Throttled function
 * @example
 * const throttledScroll = throttle(handleScroll, 100);
 */
function throttle(func, limit) {
    let lastFunc;
    let lastRan;

    return function(...args) {
        if (!lastRan) {
            func(...args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(() => {
                if ((Date.now() - lastRan) >= limit) {
                    func(...args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
}

/**
 * Creates a deep clone of an object, array, or primitive value
 * @param {*} obj - The value to clone
 * @returns {*} Deep clone of the input value
 * @example
 * const cloned = deepClone({ a: 1, b: { c: 2 } });
 */
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (obj instanceof Date) {
        return new Date(obj);
    }

    if (Array.isArray(obj)) {
        return obj.map(item => deepClone(item));
    }

    const clone = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            clone[key] = deepClone(obj[key]);
        }
    }

    return clone;
}

/**
 * Generates a unique ID string with optional prefix
 * @param {string} [prefix='id'] - Prefix for the ID
 * @returns {string} Unique ID (e.g., 'id-1707744000000-1234')
 */
function generateUniqueId(prefix = 'id') {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

/**
 * Validates an email address format
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid email format, false otherwise
 * @example
 * validateEmail('user@example.com') // true
 */
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Validates a URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL format, false otherwise
 * @example
 * validateUrl('https://example.com') // true
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
 * Capitalizes the first letter of a string
 * @param {string} string - String to capitalize
 * @returns {string} String with first letter capitalized
 * @example
 * capitalizeFirstLetter('hello') // 'Hello'
 */
function capitalizeFirstLetter(string) {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Truncates text to a maximum length with optional suffix
 * @param {string} text - Text to truncate
 * @param {number} [maxLength=50] - Maximum length of truncated text
 * @param {string} [suffix='...'] - Suffix to append if truncated
 * @returns {string} Truncated text
 * @example
 * truncateText('This is a long text', 10) // 'This is a...'
 */
function truncateText(text, maxLength = 50, suffix = '...') {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + suffix;
}

/**
 * Chunks an array into smaller arrays of specified size
 * @param {Array} array - Array to chunk
 * @param {number} size - Size of each chunk
 * @returns {Array[]} Array of chunks
 * @example
 * chunkArray([1, 2, 3, 4, 5], 2) // [[1, 2], [3, 4], [5]]
 */
function chunkArray(array, size) {
    if (!Array.isArray(array)) return [];
    const chunked = [];
    for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
    }
    return chunked;
}

// Export functions to global scope
window.helpers = {
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
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
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
    };
}
