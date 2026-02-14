/**
 * File Upload Component - Alpine.js Component
 *
 * This file defines the Alpine.js component for the file upload panel.
 * It must be loaded BEFORE Alpine.js initializes to ensure x-data works correctly.
 */

function fileUploadComponent() {
    return {
        dragOver: false,
        helpers: window.helpers,

        get uploadedFiles() {
            return this.$store.files.uploadedFiles || [];
        },

        get error() {
            return this.$store.files.error;
        },

        get isLoading() {
            return this.$store.files.isLoading;
        },

        get baseFolderPath() {
            return this.$store.files.baseFolderPath || '';
        },

        set baseFolderPath(value) {
            this.$store.files.setBaseFolderPath(value);
        },

        init() {
            console.log('Folder import component initialized');
        },

        async importFolder() {
            await this.$store.files.importFolder();
        },

        setBaseFolderPath(value) {
            this.$store.files.setBaseFolderPath(value);
        },

        removeFile(filename) {
            this.$store.files.removeFile(filename);
        },

        clearAllFiles() {
            if (confirm('Are you sure you want to clear all imported files?')) {
                this.$store.files.clearAllFiles();
            }
        }
    };
}
