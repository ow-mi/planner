/**
 * Store Registry - Centralized Store Initialization
 *
 * This file registers all Alpine.js stores and provides a single point
 * for store initialization and management.
 */

// Import all stores
import { fileStore } from './fileStore.js';
import { configStore } from './configStore.js';
import { solverStore } from './solverStore.js';
import { batchStore } from './batchStore.js';
import { visualizationStore } from './visualizationStore.js';

// Store registry
export const storeRegistry = {
    files: fileStore,
    config: configStore,
    solver: solverStore,
    batch: batchStore,
    visualization: visualizationStore
};

/**
 * Register all stores with Alpine.js
 */
export function registerStores() {
    Object.entries(storeRegistry).forEach(([name, store]) => {
        if (typeof Alpine !== 'undefined' && Alpine.store) {
            Alpine.store(name, store);
            console.log(`Store registered: ${name}`);
        }
    });
}

/**
 * Initialize all stores
 */
export function initializeStores() {
    Object.entries(storeRegistry).forEach(([name, store]) => {
        if (typeof store.init === 'function') {
            try {
                store.init();
                console.log(`Store initialized: ${name}`);
            } catch (error) {
                console.error(`Failed to initialize store ${name}:`, error);
            }
        }
    });
}

/**
 * Get a store by name
 * @param {string} name - Store name
 * @returns {Object|null} Store object or null if not found
 */
export function getStore(name) {
    return storeRegistry[name] || null;
}

/**
 * Check if a store exists
 * @param {string} name - Store name
 * @returns {boolean} True if store exists
 */
export function hasStore(name) {
    return name in storeRegistry;
}
