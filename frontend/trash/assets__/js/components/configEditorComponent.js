/**
 * Configuration Editor Component - Alpine.js Component
 * 
 * This file defines the Alpine.js component for the configuration editor.
 * It must be loaded BEFORE Alpine.js initializes to ensure x-data works correctly.
 */

function configEditorComponent() {
    return {
        jsonImportText: '',
        weightsPercent: 50,  // 0-100% slider: 0%=fully makespan, 100%=fully priority
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
            return this.$store.config.priorityConfigSettings;
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

        applyJsonImportText() {
            const rawJson = String(this.jsonImportText || '').trim();
            if (!rawJson) {
                this.error = 'Please paste a JSON payload first.';
                return;
            }

            try {
                const parsed = JSON.parse(rawJson);
                this.$store.config.loadJsonConfiguration(parsed);
            } catch (error) {
                this.error = `Invalid JSON format: ${error.message}`;
            }
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
                console.log('[configEditor] sectionEnabled changed, updating output');
                this.queueOutputUpdate();
            });
        },

        syncWeightsFromConfig() {
            // Convert makespan weight (0-1) to priority percent (0-100)
            // Slider: 0% = fully makespan, 100% = fully priority
            const makespan = Number(this.config.weights?.makespanWeight) || 0;
            this.weightsPercent = Math.round((1 - makespan) * 100);
        },

        syncWeightsToConfig() {
            // Convert slider percent (0-100) to weights
            // Slider 0% = makespan 1.0, priority 0.0
            // Slider 100% = makespan 0.0, priority 1.0
            const percent = Number(this.weightsPercent);
            const priorityWeight = Number.isFinite(percent) ? percent / 100 : 0.5;
            const makespanWeight = 1 - priorityWeight;
            this.config.weights.makespanWeight = makespanWeight;
            this.config.weights.priorityWeight = priorityWeight;
        },

        queueOutputUpdate(force = false) {
            if (this._outputUpdateScheduled && !force) {
                return;
            }

            this._outputUpdateScheduled = true;
            setTimeout(() => {
                this._outputUpdateScheduled = false;
                if (this.$store && this.$store.config && this.$store.config.updateOutputSettings) {
                    console.log('[configEditor] Triggering output settings update');
                    this.$store.config.updateOutputSettings();
                }
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
