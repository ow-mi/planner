/**
 * Configuration Store - Alpine.js Store for Configuration Management
 *
 * Manages solver configuration settings and validation
 */
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

document.addEventListener('alpine:init', () => {
    Alpine.store('config', {
         // State
         config: {
             mode: 'leg_end_dates',
             description: 'Each leg has a target completion date. Legs can be scheduled in parallel if they don\'t exceed their deadlines.',
             weights: {
                 makespan_weight: 0.2,
                 priority_weight: 0.8,
             },
             deadlines: buildDefaultDeadlines(),
             penaltySettings: {
                 deadline_penalty: 1000.0,
                 compactness_penalty: 500.0,
                 parallel_within_deadlines: 100.0
             },
             proximityRules: [
                 { pattern: 'P-02', maxgapdays: 10, proximitypenaltyperday: 50.0, enforce_sequence_order: false },
                 { pattern: 'P-03', maxgapdays: 10, proximitypenaltyperday: 50.0, enforce_sequence_order: false },
                 { pattern: 'P-04', maxgapdays: 10, proximitypenaltyperday: 50.0, enforce_sequence_order: false },
                 { pattern: 'P-03-E', maxgapdays: 10, proximitypenaltyperday: 50.0, enforce_sequence_order: true },
                 { pattern: 'P-02-L', maxgapdays: 10, proximitypenaltyperday: 50.0, enforce_sequence_order: false },
                 { pattern: 'Leak', maxgapdays: 10, proximitypenaltyperday: 50.0, enforce_sequence_order: false }
             ]
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
         priority_config_settings: {},
         isLoading: false,
         error: null,
         successMessage: '',
         jsonUploadFiles: [],
         jsonDragOver: false,

         // Initialization
         init() {
             console.log('Configuration store initialized');
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
         },

         // Load from localStorage
         loadFromLocalStorage() {
             try {
                const savedConfig = localStorage.getItem('solverConfig');
                if (savedConfig) {
                   this.config = JSON.parse(savedConfig);
                   this.updateOutputSettings();
                }

                const savedSectionStates = localStorage.getItem('configSectionStates');
                if (savedSectionStates) {
                   this.sectionStates = JSON.parse(savedSectionStates);
                }

                const savedSectionEnabled = localStorage.getItem('configSectionEnabled');
                if (savedSectionEnabled) {
                   this.sectionEnabled = JSON.parse(savedSectionEnabled);
                }
             } catch (error) {
                console.error('Failed to load configuration from localStorage:', error);
                this.error = 'Failed to load saved configuration';
             }
         },

         // Save to localStorage
         saveToLocalStorage() {
             try {
                localStorage.setItem('solverConfig', JSON.stringify(this.config));
                localStorage.setItem('configSectionStates', JSON.stringify(this.sectionStates));
                localStorage.setItem('configSectionEnabled', JSON.stringify(this.sectionEnabled));
             } catch (error) {
                console.error('Failed to save configuration to localStorage:', error);
                this.error = 'Failed to save configuration';
             }
         },

         // Update output settings based on current configuration
         updateOutputSettings() {
             // Create output object with only enabled sections
             this.priority_config_settings = {
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
                     this.priority_config_settings.leg_deadlines = endDeadlines;
                     this.priority_config_settings.leg_end_deadlines = endDeadlines;
                 }

                 if (Object.keys(startDeadlines).length > 0) {
                     this.priority_config_settings.leg_start_deadlines = startDeadlines;
                 }
             }

             if (this.sectionEnabled.penaltyEnabled) {
                 this.priority_config_settings.deadline_penalty_per_day = this.config.penaltySettings?.deadline_penalty || 1000.0;
                 this.priority_config_settings.leg_compactness_penalty_per_day = this.config.penaltySettings?.compactness_penalty || 500.0;
                 this.priority_config_settings.allow_parallel_within_deadlines = this.config.penaltySettings?.parallel_within_deadlines || 100.0;
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
                     this.priority_config_settings.test_proximity_rules = {
                         patterns: uniqueRules.map(rule => rule.pattern),
                         max_gap_days: uniqueRules[0]?.maxgapdays || 10,
                         proximity_penalty_per_day: uniqueRules[0]?.proximitypenaltyperday || 50.0,
                         enforce_sequence_order: uniqueRules.some(rule => rule.enforce_sequence_order)
                     };
                 }
             }

             this.saveToLocalStorage();
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
            this.config.weights.makespan_weight = makespanWeight;
            this.config.weights.priority_weight = priorityWeight;
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
                 maxgapdays: 10,
                 proximitypenaltyperday: 50.0,
                 enforce_sequence_order: false
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

            // Validate weights
            const weights = jsonData.weights;
            if (typeof weights.makespan_weight !== 'number' || weights.makespan_weight < 0 || weights.makespan_weight > 1) {
                throw new Error('makespan_weight must be a number between 0 and 1');
            }
            if (typeof weights.priority_weight !== 'number' || weights.priority_weight < 0 || weights.priority_weight > 1) {
                throw new Error('priority_weight must be a number between 0 and 1');
            }

            // Check weights sum to 1.0 (within tolerance)
            const weightSum = weights.makespan_weight + weights.priority_weight;
            if (Math.abs(weightSum - 1.0) > 0.001) {
                throw new Error('makespan_weight + priority_weight must equal 1.0');
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

                // Load weights
                this.config.weights.makespan_weight = jsonData.weights.makespan_weight;
                this.config.weights.priority_weight = jsonData.weights.priority_weight;

                // Load leg deadlines if present
                const legacyDeadlines = jsonData.leg_deadlines || {};
                const startDeadlines = jsonData.leg_start_deadlines || {};
                const endDeadlines = jsonData.leg_end_deadlines || legacyDeadlines;
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

                // Load penalty settings if present
                if (jsonData.deadline_penalty_per_day !== undefined) {
                    this.config.penaltySettings.deadline_penalty = jsonData.deadline_penalty_per_day;
                }
                if (jsonData.leg_compactness_penalty_per_day !== undefined) {
                    this.config.penaltySettings.compactness_penalty = jsonData.leg_compactness_penalty_per_day;
                }
                if (jsonData.allow_parallel_within_deadlines !== undefined) {
                    // allow_parallel_within_deadlines is a number (penalty value), not boolean
                    this.config.penaltySettings.parallel_within_deadlines = jsonData.allow_parallel_within_deadlines;
                }
                // Enable penalty section if any penalty fields are present
                this.sectionEnabled.penaltyEnabled = jsonData.deadline_penalty_per_day !== undefined ||
                                                     jsonData.leg_compactness_penalty_per_day !== undefined ||
                                                     jsonData.allow_parallel_within_deadlines !== undefined;

                // Load proximity rules if present
                if (jsonData.test_proximity_rules) {
                    const rules = jsonData.test_proximity_rules;
                    if (rules.patterns && rules.patterns.length > 0) {
                        this.config.proximityRules = rules.patterns.map(pattern => ({
                            pattern,
                            maxgapdays: rules.max_gap_days || 10,
                            proximitypenaltyperday: rules.proximity_penalty_per_day || 50.0,
                            enforce_sequence_order: rules.enforce_sequence_order !== undefined ? rules.enforce_sequence_order : false
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
            return this.priority_config_settings;
        },

         // Reset to default configuration
         resetToDefaults() {
            this.config = {
               mode: 'leg_end_dates',
               description: 'Each leg has a target completion date. Legs can be scheduled in parallel if they don\'t exceed their deadlines.',
               weights: {
                  makespan_weight: 0.2,
                  priority_weight: 0.8,
               },
               deadlines: buildDefaultDeadlines(),
               penaltySettings: {
                  deadline_penalty: 1000.0,
                  compactness_penalty: 500.0,
                  parallel_within_deadlines: 100.0
               },
               proximityRules: [
                  { pattern: 'P-02', maxgapdays: 10, proximitypenaltyperday: 50.0, enforce_sequence_order: false },
                  { pattern: 'P-03', maxgapdays: 10, proximitypenaltyperday: 50.0, enforce_sequence_order: false },
                  { pattern: 'P-04', maxgapdays: 10, proximitypenaltyperday: 50.0, enforce_sequence_order: false },
                  { pattern: 'P-03-E', maxgapdays: 10, proximitypenaltyperday: 50.0, enforce_sequence_order: true },
                  { pattern: 'P-02-L', maxgapdays: 10, proximitypenaltyperday: 50.0, enforce_sequence_order: false },
                  { pattern: 'Leak', maxgapdays: 10, proximitypenaltyperday: 50.0, enforce_sequence_order: false }
               ]
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
              const jsonText = JSON.stringify(this.priority_config_settings, null, 2);
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
        convertDateToWeekFormat
    };
}
