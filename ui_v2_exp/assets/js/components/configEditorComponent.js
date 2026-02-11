/**
 * Configuration Editor Component - Alpine.js Component
 * 
 * This file defines the Alpine.js component for the configuration editor.
 * It must be loaded BEFORE Alpine.js initializes to ensure x-data works correctly.
 */

function configEditorComponent() {
    return {
        jsonDragOver: false,
        weightsPercent: {
            makespan: 20,
            priority: 80
        },
        _outputUpdateScheduled: false,

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

        get dedupedProximityRules() {
            const seen = new Set();
            return (this.config.proximityRules || []).reduce((acc, rule, index) => {
                const pattern = rule?.pattern || '';
                if (!pattern || seen.has(pattern)) {
                    return acc;
                }
                seen.add(pattern);
                acc.push({ rule, index, key: `${pattern}-${index}` });
                return acc;
            }, []);
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
                this.syncWeightsFromConfig();
            }
        },

        init() {
            this.syncWeightsFromConfig();
            this.queueOutputUpdate(true);

            this.$watch(() => JSON.stringify(this.config), () => {
                this.syncWeightsFromConfig();
                this.queueOutputUpdate();
            });

            this.$watch(() => JSON.stringify(this.sectionEnabled), () => {
                this.queueOutputUpdate();
            });
        },

        syncWeightsFromConfig() {
            const makespan = Number(this.config.weights?.makespan_weight) || 0;
            const priority = Number(this.config.weights?.priority_weight) || 0;
            this.weightsPercent = {
                makespan: Math.round(makespan * 100),
                priority: Math.round(priority * 100)
            };
        },

        syncWeightsToConfig() {
            const makespan = Number(this.weightsPercent.makespan);
            const priority = Number(this.weightsPercent.priority);
            this.config.weights.makespan_weight = Number.isFinite(makespan) ? makespan / 100 : 0;
            this.config.weights.priority_weight = Number.isFinite(priority) ? priority / 100 : 0;
        },

        queueOutputUpdate(force = false) {
            if (this._outputUpdateScheduled && !force) {
                return;
            }

            this._outputUpdateScheduled = true;
            setTimeout(() => {
                this._outputUpdateScheduled = false;
                this.$store.config.updateOutputSettings();
            }, 0);
        },

        isValidWeekDeadlineFormat(value) {
            if (typeof value !== 'string') {
                return false;
            }

            const match = value.match(/^(\d{4})-W(\d{2})\.(\d)$/);
            if (!match) {
                return false;
            }

            const week = Number(match[2]);
            const day = Number(match[3]);

            if (!Number.isInteger(week) || week < 1 || week > 53) {
                return false;
            }

            if (!Number.isInteger(day) || day < 1 || day > 7) {
                return false;
            }

            return true;
        },

        getDeadlineError(value, enabled) {
            if (!enabled) {
                return '';
            }

            if (!value) {
                return 'Required format: YYYY-WWW.N';
            }

            if (!this.isValidWeekDeadlineFormat(value)) {
                return 'Invalid format. Use YYYY-WWW.N (e.g., 2026-W30.5)';
            }

            return '';
        }
    };
}
