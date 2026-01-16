/**
 * Helper Functions - Utility functions for the application
 */

// Date formatting helpers
function formatDate(dateString, format = 'YYYY-MM-DD') {
    if (!dateString) return '';

    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
        console.warn('Invalid date:', dateString);
        return dateString;
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

// File size formatting
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Debounce function
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

// Throttle function
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

// Deep clone object
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

// Generate unique ID
function generateUniqueId(prefix = 'id') {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

// Validate email
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Validate URL
function validateUrl(url) {
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

// Capitalize first letter
function capitalizeFirstLetter(string) {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Truncate text
function truncateText(text, maxLength = 50, suffix = '...') {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + suffix;
}

// Array chunking
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
