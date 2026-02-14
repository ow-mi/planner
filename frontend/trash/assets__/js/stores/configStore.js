/**
 * Configuration Store - Alpine.js Store for Configuration Management
 *
 * Manages solver configuration settings and validation
 */

// Storage key constants for consistency
const CONFIG_STORAGE_KEYS = {
    SOLVER_CONFIG: 'ui_v2_exp__config__solverConfig',
    CONFIG_SECTION_STATES: 'ui_v2_exp__config__sectionStates',
    CONFIG_SECTION_ENABLED: 'ui_v2_exp__config__sectionEnabled'
};

function isValidWeekDeadlineFormat(value) {
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
}

function convertDateToWeekFormat(value) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return '';
    }

    if (isValidWeekDeadlineFormat(value)) {
        return value;
    }

    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const dayOfWeek = date.getUTCDay();
    const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;
    const thursday = new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate() + (4 - isoDay)
    ));
    const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((thursday - yearStart) / 86400000) + 1) / 7);
    const weekStr = String(week).padStart(2, '0');
    return `${thursday.getUTCFullYear()}-W${weekStr}.${isoDay}`;
}

function normalizeDeadlineValue(value) {
    if (!value) {
        return '';
    }
    return convertDateToWeekFormat(String(value));
}

function normalizeDeadlineEntry(entry) {
    if (!entry || typeof entry !== 'object') {
        return null;
    }

    const legId = entry.legId || '';
    const startEnabled = typeof entry.startEnabled === 'boolean' ? entry.startEnabled : false;
    const endEnabled = typeof entry.endEnabled === 'boolean' ? entry.endEnabled : true;
    const startDeadline = normalizeDeadlineValue(entry.startDeadline || entry.startDate || '');
    const endDeadline = normalizeDeadlineValue(entry.endDeadline || entry.deadlineDate || entry.endDate || '');

    return {
        legId,
        startDeadline,
        endDeadline,
        startEnabled,
        endEnabled
    };
}

function buildDefaultDeadlines() {
    const defaultDates = [
        { legId: 'mwcu_b10_6', endDate: '2027-05-01' },
        { legId: 'mwcu_a7_6', endDate: '2027-05-01' },
        { legId: 'mwcu_b10_2.1', endDate: '2028-12-15' },
        { legId: 'mwcu_a7_2.1', endDate: '2028-12-15' },
        { legId: 'mwcu_b10_2.2', endDate: '2028-07-01' },
        { legId: 'mwcu_a7_2.2', endDate: '2028-07-01' },
        { legId: 'mwcu_b10_3', endDate: '2028-06-01' },
        { legId: 'mwcu_a7_3', endDate: '2028-06-01' },
        { legId: 'mwcu_b10_4', endDate: '2027-07-01' },
        { legId: 'mwcu_a7_4', endDate: '2027-07-01' },
        { legId: 'mwcu_b10_5', endDate: '2027-07-01' },
        { legId: 'mwcu_a7_5', endDate: '2027-07-01' },
        { legId: 'mwcu_b10_5a', endDate: '2027-07-01' },
        { legId: 'mwcu_a7_5a', endDate: '2027-07-01' },
        { legId: 'mwcu_b10_5b', endDate: '2027-07-01' },
        { legId: 'mwcu_a7_5b', endDate: '2027-07-01' },
        { legId: 'mwcu_b10_7', endDate: '2028-12-15' },
        { legId: 'mwcu_a7_7', endDate: '2028-12-15' }
    ];

    return defaultDates.map((entry) => ({
        legId: entry.legId,
        startDeadline: '',
        endDeadline: convertDateToWeekFormat(entry.endDate),
        startEnabled: false,
        endEnabled: true
    }));
}

// Helper to migrate legacy storage keys to new namespaced format
function migrateLegacyStorage() {
    const legacyMapping = {
        'solverConfig': CONFIG_STORAGE_KEYS.SOLVER_CONFIG,
        'configSectionStates': CONFIG_STORAGE_KEYS.CONFIG_SECTION_STATES,
        'configSectionEnabled': CONFIG_STORAGE_KEYS.CONFIG_SECTION_ENABLED
    };

    Object.entries(legacyMapping).forEach(([oldKey, newKey]) => {
        const data = localStorage.getItem(oldKey);
        if (data && !localStorage.getItem(newKey)) {
            localStorage.setItem(newKey, data);
            // Optionally remove old key after migration
            // localStorage.removeItem(oldKey);
        }
    });
}

document.addEventListener('alpine:init', () => {
    Alpine.store('config', {
         // State
         config: {
             mode: 'leg_end_dates',
             description: 'Each leg has a target completion date. Legs can be scheduled in parallel if they don\'t exceed their deadlines.',
             weights: {
                 makespanWeight: 0.2,
                 priorityWeight: 0.8,
             },
             deadlines: [],
             penaltySettings: {
                 deadlinePenalty: 1000.0,
                 compactnessPenalty: 500.0,
                 parallelWithinDeadlines: 100.0
             },
             proximityRules: []
         },
          sectionEnabled: {
              modeEnabled: true,
              deadlinesEnabled: true,
              penaltyEnabled: true,
              proximityEnabled: true
          },
          sectionStates: {
              basic: true,
              weights: true,
              deadlines: true,
              penalties: true,
              proximity: true
          },
         priorityConfigSettings: {},
         isLoading: false,
         error: null,
         successMessage: '',
         jsonUploadFiles: [],
         jsonDragOver: false,

         // Initialization
         init() {
             try {
                 console.log('Configuration store initialized');
                 migrateLegacyStorage();
                 this.loadFromLocalStorage();
                 this.config.deadlines = (this.config.deadlines || [])
                     .map(normalizeDeadlineEntry)
                     .filter(Boolean);
                 this.updateOutputSettings();

                 // Watch for sectionEnabled changes and trigger output settings update
                 // This is a workaround since Alpine.js stores don't have built-in reactivity for nested properties
                 const originalSectionEnabled = this.sectionEnabled;
                 this.sectionEnabled = {
                     modeEnabled: originalSectionEnabled.modeEnabled,
                     deadlinesEnabled: originalSectionEnabled.deadlinesEnabled,
                     penaltyEnabled: originalSectionEnabled.penaltyEnabled,
                     proximityEnabled: originalSectionEnabled.proximityEnabled
                 };

                 // Mark as initialized for reactive updates
                 this.sectionEnabledInitialized = true;
             } catch (error) {
                 console.error('ConfigStore init failed:', error);
                 this.error = 'Failed to initialize configuration storage';
             }
         },

         // Load from localStorage
         loadFromLocalStorage() {
             try {
                const savedConfig = localStorage.getItem(CONFIG_STORAGE_KEYS.SOLVER_CONFIG);
                if (savedConfig) {
                   const parsed = JSON.parse(savedConfig);
                   // Migrate legacy snake_case to camelCase if needed
                   this.config = this.migrateConfigToCamelCase(parsed);
                   this.updateOutputSettings();
                }

                const savedSectionStates = localStorage.getItem(CONFIG_STORAGE_KEYS.CONFIG_SECTION_STATES);
                if (savedSectionStates) {
                   this.sectionStates = JSON.parse(savedSectionStates);
                }

                const savedSectionEnabled = localStorage.getItem(CONFIG_STORAGE_KEYS.CONFIG_SECTION_ENABLED);
                if (savedSectionEnabled) {
                   this.sectionEnabled = JSON.parse(savedSectionEnabled);
                }
             } catch (error) {
                console.error('Failed to load configuration from localStorage:', error);
                this.error = 'Failed to load saved configuration';
             }
         },

         // Migrate legacy snake_case config to camelCase
         migrateConfigToCamelCase(config) {
             if (!config) return config;
             
             const migrated = { ...config };
             
             // Migrate weights
             if (config.weights) {
                 migrated.weights = {
                     makespanWeight: config.weights.makespan_weight ?? config.weights.makespanWeight ?? 0.2,
                     priorityWeight: config.weights.priority_weight ?? config.weights.priorityWeight ?? 0.8
                 };
             }
             
             // Migrate proximityRules
             if (config.proximityRules && Array.isArray(config.proximityRules)) {
                 migrated.proximityRules = config.proximityRules.map(rule => ({
                     pattern: rule.pattern,
                     maxGapDays: rule.maxgapdays ?? rule.maxGapDays ?? 10,
                     proximityPenaltyPerDay: rule.proximitypenaltyperday ?? rule.proximityPenaltyPerDay ?? 50.0,
                     enforceSequenceOrder: rule.enforce_sequence_order ?? rule.enforceSequenceOrder ?? false
                 }));
             }
             
             // Migrate penaltySettings
             if (config.penaltySettings) {
                 migrated.penaltySettings = {
                     deadlinePenalty: config.penaltySettings.deadline_penalty ?? config.penaltySettings.deadlinePenalty ?? 1000.0,
                     compactnessPenalty: config.penaltySettings.compactness_penalty ?? config.penaltySettings.compactnessPenalty ?? 500.0,
                     parallelWithinDeadlines: config.penaltySettings.parallel_within_deadlines ?? config.penaltySettings.parallelWithinDeadlines ?? 100.0
                 };
             }
             
             return migrated;
         },

         // Save to localStorage
         saveToLocalStorage() {
             try {
                localStorage.setItem(CONFIG_STORAGE_KEYS.SOLVER_CONFIG, JSON.stringify(this.config));
                localStorage.setItem(CONFIG_STORAGE_KEYS.CONFIG_SECTION_STATES, JSON.stringify(this.sectionStates));
                localStorage.setItem(CONFIG_STORAGE_KEYS.CONFIG_SECTION_ENABLED, JSON.stringify(this.sectionEnabled));
             } catch (error) {
                console.error('Failed to save configuration to localStorage:', error);
                this.error = 'Failed to save configuration';
             }
         },

         // Update output settings based on current configuration
         updateOutputSettings() {
             console.log('[configStore] Updating output settings...');
             console.log('[configStore] Current config:', this.config);
             
             // Create output object with only enabled sections
             this.priorityConfigSettings = {
                 mode: this.config.mode,
                 description: this.config.description,
                 weights: { ...this.config.weights }
             };

             // Add sections only if they are enabled
             if (this.sectionEnabled.deadlinesEnabled && this.config.deadlines.length > 0) {
                 const startDeadlines = {};
                 const endDeadlines = {};

                 this.config.deadlines.forEach(deadline => {
                    if (!deadline || !deadline.legId) {
                        return;
                    }

                    if (deadline.startEnabled && isValidWeekDeadlineFormat(deadline.startDeadline)) {
                        startDeadlines[deadline.legId] = deadline.startDeadline;
                    }

                    if (deadline.endEnabled && isValidWeekDeadlineFormat(deadline.endDeadline)) {
                        endDeadlines[deadline.legId] = deadline.endDeadline;
                    }
                 });

                 if (Object.keys(endDeadlines).length > 0) {
                     this.priorityConfigSettings.legDeadlines = endDeadlines;
                     this.priorityConfigSettings.legEndDeadlines = endDeadlines;
                 }

                 if (Object.keys(startDeadlines).length > 0) {
                     this.priorityConfigSettings.legStartDeadlines = startDeadlines;
                 }
             }

             if (this.sectionEnabled.penaltyEnabled) {
                 this.priorityConfigSettings.deadlinePenaltyPerDay = this.config.penaltySettings?.deadlinePenalty ?? 1000.0;
                 this.priorityConfigSettings.legCompactnessPenaltyPerDay = this.config.penaltySettings?.compactnessPenalty ?? 500.0;
                 this.priorityConfigSettings.allowParallelWithinDeadlines = this.config.penaltySettings?.parallelWithinDeadlines ?? 100.0;
             }

             if (this.sectionEnabled.proximityEnabled && this.config.proximityRules?.length > 0) {
                 const seenPatterns = new Set();
                 const uniqueRules = this.config.proximityRules.filter((rule) => {
                     const pattern = rule?.pattern;
                     if (!pattern || seenPatterns.has(pattern)) {
                         return false;
                     }
                     seenPatterns.add(pattern);
                     return true;
                 });

                 if (uniqueRules.length > 0) {
                     this.priorityConfigSettings.testProximityRules = {
                         patterns: uniqueRules.map(rule => rule.pattern),
                         maxGapDays: uniqueRules[0]?.maxGapDays ?? 10,
                         proximityPenaltyPerDay: uniqueRules[0]?.proximityPenaltyPerDay ?? 50.0,
                         enforceSequenceOrder: uniqueRules.some(rule => rule.enforceSequenceOrder)
                     };
                 }
             }

             this.saveToLocalStorage();
             console.log('[configStore] Output settings updated:', this.priorityConfigSettings);
         },

        // Configuration management methods
        setMode(mode) {
            this.config.mode = mode;
            this.updateOutputSettings();
        },

        setDescription(description) {
            this.config.description = description;
            this.updateOutputSettings();
        },

        updateWeights(makespanWeight, priorityWeight) {
            this.config.weights.makespanWeight = makespanWeight;
            this.config.weights.priorityWeight = priorityWeight;
            this.updateOutputSettings();
        },

        // Leg deadlines management
        addLegDeadline() {
            this.addDeadlineRow();
        },

        removeLegDeadline(index) {
            this.removeDeadlineRow(index);
        },

        updateLegDeadline(index, id, startDeadline, endDeadline) {
            if (!this.config.deadlines[index]) {
                return;
            }
            this.config.deadlines[index] = {
                ...this.config.deadlines[index],
                legId: id,
                startDeadline: normalizeDeadlineValue(startDeadline),
                endDeadline: normalizeDeadlineValue(endDeadline)
            };
            this.updateOutputSettings();
        },

         // Proximity rules management
         addPattern() {
             this.addProximityRule();
         },

         removePattern(index) {
             this.removeProximityRule(index);
         },

         updatePattern(index, pattern) {
             if (!this.config.proximityRules[index]) {
                 return;
             }
             this.config.proximityRules[index].pattern = pattern;
             this.updateOutputSettings();
         },

         // Deadline management (UI wrapper methods)
         addDeadlineRow() {
             this.config.deadlines.push({ 
                 legId: '',
                 startDeadline: '',
                 endDeadline: '',
                 startEnabled: false,
                 endEnabled: true
             });
             this.updateOutputSettings();
         },

         removeDeadlineRow(index) {
             this.config.deadlines.splice(index, 1);
             this.updateOutputSettings();
         },

         // Proximity rules UI wrapper methods
         addProximityRule() {
             this.config.proximityRules.push({
                 pattern: '',
                 maxGapDays: 10,
                 proximityPenaltyPerDay: 50.0,
                 enforceSequenceOrder: false
             });
             this.updateOutputSettings();
         },

         removeProximityRule(index) {
             this.config.proximityRules.splice(index, 1);
             this.updateOutputSettings();
         },

        // JSON configuration handling
        handleJsonFileUpload(event) {
            this.processJsonFiles(event.target.files);
        },

        handleJsonFileDrop(event) {
            this.jsonDragOver = false;
            this.processJsonFiles(event.dataTransfer.files);
        },

        processJsonFiles(files) {
            const jsonFiles = Array.from(files).filter(file =>
                file.type === 'application/json' || file.name.endsWith('.json')
            );

            if (jsonFiles.length === 0) {
                this.error = 'Please select a valid JSON file';
                return;
            }

            // Only process the first JSON file
            const file = jsonFiles[0];
            this.jsonUploadFiles = [file];
            this.error = null;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const jsonData = JSON.parse(e.target.result);
                    this.loadJsonConfiguration(jsonData);
                } catch (error) {
                    this.error = 'Invalid JSON format: ' + error.message;
                }
            };
            reader.onerror = () => {
                this.error = 'Error reading file';
            };
            reader.readAsText(file);
        },

        removeJsonFile(fileName) {
            this.jsonUploadFiles = this.jsonUploadFiles.filter(file => file.name !== fileName);
        },

        validateJsonStructure(jsonData) {
            // Required fields validation
            if (!jsonData.mode) {
                throw new Error('Missing required field: mode');
            }

            if (!jsonData.weights) {
                throw new Error('Missing required field: weights');
            }

            // Validate mode
            const validModes = ['end_date_priority', 'leg_priority', 'end_date_sticky', 'leg_end_dates', 'resource_bottleneck'];
            if (!validModes.includes(jsonData.mode)) {
                throw new Error('Invalid mode. Must be one of: ' + validModes.join(', '));
            }

            // Validate weights (support both camelCase and legacy snake_case)
            const weights = jsonData.weights;
            const makespanWeight = weights.makespanWeight ?? weights.makespan_weight;
            const priorityWeight = weights.priorityWeight ?? weights.priority_weight;
            
            if (typeof makespanWeight !== 'number' || makespanWeight < 0 || makespanWeight > 1) {
                throw new Error('makespanWeight must be a number between 0 and 1');
            }
            if (typeof priorityWeight !== 'number' || priorityWeight < 0 || priorityWeight > 1) {
                throw new Error('priorityWeight must be a number between 0 and 1');
            }

            // Check weights sum to 1.0 (within tolerance)
            const weightSum = makespanWeight + priorityWeight;
            if (Math.abs(weightSum - 1.0) > 0.001) {
                throw new Error('makespanWeight + priorityWeight must equal 1.0');
            }

            return true;
        },

        loadJsonConfiguration(jsonData) {
            // Clear any existing errors
            this.error = null;

            try {
                // Validate JSON structure
                this.validateJsonStructure(jsonData);

                // Load basic configuration
                this.config.mode = jsonData.mode;
                this.config.description = jsonData.description || '';

                // Load weights (support both camelCase and legacy snake_case)
                const weights = jsonData.weights;
                this.config.weights.makespanWeight = weights.makespanWeight ?? weights.makespan_weight ?? 0.2;
                this.config.weights.priorityWeight = weights.priorityWeight ?? weights.priority_weight ?? 0.8;

                // Load leg deadlines if present (support both camelCase and legacy snake_case)
                const legacyDeadlines = jsonData.legDeadlines ?? jsonData.leg_deadlines ?? {};
                const startDeadlines = jsonData.legStartDeadlines ?? jsonData.leg_start_deadlines ?? {};
                const endDeadlines = jsonData.legEndDeadlines ?? jsonData.leg_end_deadlines ?? legacyDeadlines;
                const legIds = new Set([
                    ...Object.keys(startDeadlines || {}),
                    ...Object.keys(endDeadlines || {})
                ]);

                if (legIds.size > 0) {
                    this.config.deadlines = Array.from(legIds).map((legId) => ({
                        legId,
                        startDeadline: normalizeDeadlineValue(startDeadlines[legId]),
                        endDeadline: normalizeDeadlineValue(endDeadlines[legId]),
                        startEnabled: startDeadlines[legId] !== undefined,
                        endEnabled: endDeadlines[legId] !== undefined
                    }));
                    this.sectionEnabled.deadlinesEnabled = true;
                } else {
                    this.config.deadlines = [];
                    this.sectionEnabled.deadlinesEnabled = false;
                }

                // Load penalty settings if present (support both camelCase and legacy snake_case)
                if (jsonData.deadlinePenaltyPerDay !== undefined || jsonData.deadline_penalty_per_day !== undefined) {
                    this.config.penaltySettings.deadlinePenalty = jsonData.deadlinePenaltyPerDay ?? jsonData.deadline_penalty_per_day ?? 1000.0;
                }
                if (jsonData.legCompactnessPenaltyPerDay !== undefined || jsonData.leg_compactness_penalty_per_day !== undefined) {
                    this.config.penaltySettings.compactnessPenalty = jsonData.legCompactnessPenaltyPerDay ?? jsonData.leg_compactness_penalty_per_day ?? 500.0;
                }
                if (jsonData.allowParallelWithinDeadlines !== undefined || jsonData.allow_parallel_within_deadlines !== undefined) {
                    // allowParallelWithinDeadlines is a number (penalty value), not boolean
                    this.config.penaltySettings.parallelWithinDeadlines = jsonData.allowParallelWithinDeadlines ?? jsonData.allow_parallel_within_deadlines ?? 100.0;
                }
                // Enable penalty section if any penalty fields are present
                const hasPenalty = jsonData.deadlinePenaltyPerDay !== undefined || jsonData.deadline_penalty_per_day !== undefined ||
                     jsonData.legCompactnessPenaltyPerDay !== undefined || jsonData.leg_compactness_penalty_per_day !== undefined ||
                     jsonData.allowParallelWithinDeadlines !== undefined || jsonData.allow_parallel_within_deadlines !== undefined;
                this.sectionEnabled.penaltyEnabled = hasPenalty || this.sectionEnabled.penaltyEnabled;

                // Load proximity rules if present (support both camelCase and legacy snake_case)
                const testProximityRules = jsonData.testProximityRules ?? jsonData.test_proximity_rules ?? null;
                if (testProximityRules) {
                    const rules = testProximityRules;
                    if (rules.patterns && rules.patterns.length > 0) {
                        this.config.proximityRules = rules.patterns.map(pattern => ({
                            pattern,
                            maxGapDays: rules.maxGapDays ?? rules.max_gap_days ?? 10,
                            proximityPenaltyPerDay: rules.proximityPenaltyPerDay ?? rules.proximity_penalty_per_day ?? 50.0,
                            enforceSequenceOrder: rules.enforceSequenceOrder ?? rules.enforce_sequence_order ?? false
                        }));
                    }
                    this.sectionEnabled.proximityEnabled = true;
                } else {
                    this.config.proximityRules = [];
                    this.sectionEnabled.proximityEnabled = false;
                }

                // Update output settings
                this.updateOutputSettings();
                this.saveToLocalStorage();

            } catch (error) {
                this.error = 'Error loading configuration: ' + error.message;
            }
        },

        // Get current configuration for export
        getCurrentConfig() {
            return this.priorityConfigSettings;
        },

         // Reset to default configuration
         resetToDefaults() {
            this.config = {
               mode: 'leg_end_dates',
               description: "",
               weights: {
                  makespanWeight: 0.2,
                  priorityWeight: 0.8,
               },
               deadlines: [],
               penaltySettings: {
                  deadlinePenalty: 1000.0,
                  compactnessPenalty: 500.0,
                  parallelWithinDeadlines: 100.0
               },
               proximityRules: [],
            };

            this.sectionEnabled = {
               modeEnabled: true,
               deadlinesEnabled: true,
               penaltyEnabled: true,
               proximityEnabled: true
            };

            this.updateOutputSettings();
         },

           clearSuccessMessage() {
               this.successMessage = '';
           },

          // Set section enabled state and trigger output settings update
          setSectionEnabled(section, enabled) {
              this.sectionEnabled[section] = enabled;
              this.updateOutputSettings();
          },

          // Copy configuration to clipboard
          copyToClipboard() {
              const jsonText = JSON.stringify(this.priorityConfigSettings, null, 2);
              navigator.clipboard.writeText(jsonText).then(() => {
                  console.log('Configuration copied to clipboard');
                  this.successMessage = '✓ JSON copied to clipboard';
                  this.error = null;
                  // Clear success message after 3 seconds
                  setTimeout(() => {
                      this.successMessage = '';
                  }, 3000);
                  return true;
              }).catch(err => {
                  console.error('Failed to copy to clipboard:', err);
                  this.error = 'Failed to copy to clipboard: ' + err.message;
                  this.successMessage = '';
                  return false;
              });
          }
     });
 });

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        isValidWeekDeadlineFormat,
        convertDateToWeekFormat,
        CONFIG_STORAGE_KEYS
    };
}
