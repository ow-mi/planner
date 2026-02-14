/**
 * Batch Editor Component - Alpine.js Component
 *
 * This file defines the Alpine.js component for the batch editor.
 * It must be loaded BEFORE Alpine.js initializes to ensure x-data works correctly.
 */

function batchEditorComponent() {
    return {
        init() {
            if (this.$store.batch && typeof this.$store.batch.init === 'function') {
                this.$store.batch.init();
            }
        },

        get scenarios() {
            return this.$store.batch.scenarios;
        },

        get status() {
            return this.$store.batch.status;
        },

        get message() {
            return this.$store.batch.message;
        },

        get progress() {
            return this.$store.batch.progress;
        },

        get results() {
            return this.$store.batch.results;
        },

        get error() {
            return this.$store.batch.error;
        },

        get isRunning() {
            return this.$store.batch.isLoading;
        },

        get comparisonRows() {
            if (!this.$store.batch || typeof this.$store.batch.getComparisonRows !== 'function') {
                return [];
            }
            return this.$store.batch.getComparisonRows();
        },

        artifactKey(artifact, index) {
            return `${artifact?.label || 'artifact'}-${index}`;
        },

        isArtifactLink(value) {
            if (!value || typeof value !== 'string') {
                return false;
            }
            return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/') || value.startsWith('./') || value.startsWith('../');
        },

        addScenario() {
            this.$store.batch.addScenario();
        },

        removeScenario(index) {
            this.$store.batch.removeScenario(index);
        },

        setScenarioField(index, field, value) {
            this.$store.batch.updateScenario(index, field, value);
        },

        syncInputFiles() {
            this.$store.batch.setInputsFromFileStore();
        },

        runBatch() {
            this.$store.batch.runBatch();
        }
    };
}
