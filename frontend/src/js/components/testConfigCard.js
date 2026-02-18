/**
 * Test Configuration Card Component
 * Standardized UI for hierarchical test configuration
 * 
 * This component provides a consistent interface for displaying and editing
 * test configuration values across all hierarchy levels:
 * - All (Global Defaults)
 * - Projects
 * - Leg Types
 * - Legs
 * - Test Types
 * - Tests
 */

import { getEditableFields, getInheritedValue, updateTestConfigValue, updateTestConfigOverride } 
    from '../stores/configStore.js';

/**
 * Create a test configuration card component
 * @param {string} level - The hierarchy level ('all', 'projects', 'legTypes', 'legs', 'testTypes', 'tests')
 * @param {string|null} configId - Configuration identifier (null for 'all' level)
 * @param {Object} configData - The configuration data for this specific config
 * @param {Object} inheritedData - Data inherited from parent levels
 * @returns {Object} Card component with reactive data and methods
 */
function createTestConfigCard(level, configId, configData, inheritedData) {
    const levelConfig = {
        all: { title: 'Global Defaults', icon: 'globe', color: 'primary' },
        projects: { title: 'Project', icon: 'folder', color: 'blue' },
        legTypes: { title: 'Leg Type', icon: 'layers', color: 'purple' },
        legs: { title: 'Leg', icon: 'map-pin', color: 'green' },
        testTypes: { title: 'Test Type', icon: 'tag', color: 'orange' },
        tests: { title: 'Test', icon: 'file-text', color: 'red' }
    };

    const meta = levelConfig[level];
    
    return {
        level,
        configId,
        configData: configData || {},
        inheritedData: inheritedData || {},
        meta,
        
        // Check if field should be shown at this level
        isFieldVisible(field) {
            const editableFields = getEditableFields(level);
            return editableFields.includes(field);
        },
        
        // Check if field has an override
        hasOverride(field) {
            const overrides = this.configData.overrides || {};
            return overrides[field] === true;
        },
        
        // Get effective value (own or inherited)
        getEffectiveValue(field) {
            if (this.hasOverride(field)) {
                return this.configData[field];
            }
            return this.inheritedData[field];
        },
        
        // Toggle override for a field
        toggleOverride(field) {
            const overrides = this.configData.overrides || {};
            const newOverrides = { ...overrides, [field]: !overrides[field] };
            
            // Update via config store
            if (typeof window !== 'undefined' && window.Alpine) {
                const store = window.Alpine.store('config');
                if (store) {
                    store.updateTestConfigOverride(this.level, this.configId, field, newOverrides[field]);
                }
            }
        },
        
        // Update field value
        updateValue(field, value) {
            if (typeof window !== 'undefined' && window.Alpine) {
                const store = window.Alpine.store('config');
                if (store) {
                    store.updateTestConfigValue(this.level, this.configId, field, value);
                }
            }
        }
    };
}

/**
 * Get the card metadata for a level
 * @param {string} level - The hierarchy level
 * @returns {Object} Metadata for the level
 */
function getCardMetadata(level) {
    const levelConfig = {
        all: { title: 'Global Defaults', icon: 'globe', color: 'primary' },
        projects: { title: 'Project', icon: 'folder', color: 'blue' },
        legTypes: { title: 'Leg Type', icon: 'layers', color: 'purple' },
        legs: { title: 'Leg', icon: 'map-pin', color: 'green' },
        testTypes: { title: 'Test Type', icon: 'tag', color: 'orange' },
        tests: { title: 'Test', icon: 'file-text', color: 'red' }
    };
    return levelConfig[level] || levelConfig.all;
}

/**
 * Check if a field is editable at a given level
 * @param {string} level - The hierarchy level
 * @param {string} field - The field name
 * @returns {boolean} True if the field is editable at this level
 */
function isFieldEditable(level, field) {
    const editableFields = getEditableFields(level);
    return editableFields.includes(field);
}

export { createTestConfigCard, getCardMetadata, isFieldEditable };
export default createTestConfigCard;
