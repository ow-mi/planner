/**
 * Configuration Editor Component - Alpine.js Component
 * 
 * This file defines the Alpine.js component for the configuration editor.
 * It must be loaded BEFORE Alpine.js initializes to ensure x-data works correctly.
 */

function configEditorComponent() {
    return {
        jsonDragOver: false,

        // Access store properties directly
        get config() {
            return this.$store.config.config;
        },

        get sectionStates() {
            return this.$store.config.sectionStates;
        },

        get sectionEnabled() {
            return this.$store.config.sectionEnabled;
        },

        get priority_config_settings() {
            return this.$store.config.priority_config_settings;
        },

        get jsonUploadFiles() {
            return this.$store.config.jsonUploadFiles;
        },

        get error() {
            return this.$store.config.error;
        },

        set error(value) {
            this.$store.config.error = value;
        },

        get successMessage() {
            return this.$store.config.successMessage;
        },

        set successMessage(value) {
            this.$store.config.successMessage = value;
        },

        clearSuccessMessage() {
            if (this.successMessage) {
                this.$store.config.successMessage = '';
            }
        },

        handleJsonFileUpload(event) {
            this.$store.config.handleJsonFileUpload(event);
        },

        handleJsonFileDrop(event) {
            this.$store.config.handleJsonFileDrop(event);
        },

        removeJsonFile(fileName) {
            this.$store.config.removeJsonFile(fileName);
        },

        copyToClipboard() {
            this.$store.config.copyToClipboard();
        },

        resetToDefaults() {
            if (confirm('Are you sure you want to reset all configuration settings to defaults?')) {
                this.$store.config.resetToDefaults();
            }
        }
    };
}
