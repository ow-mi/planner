/**
 * Configuration Store - Alpine.js Store for Configuration Management
 *
 * Manages solver configuration settings and validation
 */
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
             deadlines: [
                 { legId: 'mwcu_b10_6', deadlineDate: '2027-05-01', deadlineTime: '00:00' },
                 { legId: 'mwcu_a7_6', deadlineDate: '2027-05-01', deadlineTime: '00:00' },
                 { legId: 'mwcu_b10_2.1', deadlineDate: '2028-12-15', deadlineTime: '00:00' },
                 { legId: 'mwcu_a7_2.1', deadlineDate: '2028-12-15', deadlineTime: '00:00' },
                 { legId: 'mwcu_b10_2.2', deadlineDate: '2028-07-01', deadlineTime: '00:00' },
                 { legId: 'mwcu_a7_2.2', deadlineDate: '2028-07-01', deadlineTime: '00:00' },
                 { legId: 'mwcu_b10_3', deadlineDate: '2028-06-01', deadlineTime: '00:00' },
                 { legId: 'mwcu_a7_3', deadlineDate: '2028-06-01', deadlineTime: '00:00' },
                 { legId: 'mwcu_b10_4', deadlineDate: '2027-07-01', deadlineTime: '00:00' },
                 { legId: 'mwcu_a7_4', deadlineDate: '2027-07-01', deadlineTime: '00:00' },
                 { legId: 'mwcu_b10_5', deadlineDate: '2027-07-01', deadlineTime: '00:00' },
                 { legId: 'mwcu_a7_5', deadlineDate: '2027-07-01', deadlineTime: '00:00' },
                 { legId: 'mwcu_b10_5a', deadlineDate: '2027-07-01', deadlineTime: '00:00' },
                 { legId: 'mwcu_a7_5a', deadlineDate: '2027-07-01', deadlineTime: '00:00' },
                 { legId: 'mwcu_b10_5b', deadlineDate: '2027-07-01', deadlineTime: '00:00' },
                 { legId: 'mwcu_a7_5b', deadlineDate: '2027-07-01', deadlineTime: '00:00' },
                 { legId: 'mwcu_b10_7', deadlineDate: '2028-12-15', deadlineTime: '00:00' },
                 { legId: 'mwcu_a7_7', deadlineDate: '2028-12-15', deadlineTime: '00:00' },
             ],
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
            this.updateOutputSettings();
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
                 this.priority_config_settings.leg_deadlines = {};
                 this.config.deadlines.forEach(deadline => {
                    if (deadline.legId && deadline.deadlineDate) {
                       const date = deadline.deadlineDate ? new Date(deadline.deadlineDate) : null;
                       const deadlineDate = date ? date.toISOString().split('T')[0] : null;
                       if (deadlineDate) {
                           this.priority_config_settings.leg_deadlines[deadline.legId] = deadlineDate;
                       }
                    }
                 });
             }

             if (this.sectionEnabled.penaltyEnabled) {
                 this.priority_config_settings.deadline_penalty_per_day = this.config.penaltySettings?.deadline_penalty || 1000.0;
                 this.priority_config_settings.leg_compactness_penalty_per_day = this.config.penaltySettings?.compactness_penalty || 500.0;
                 this.priority_config_settings.allow_parallel_within_deadlines = this.config.penaltySettings?.parallel_within_deadlines || 100.0;
             }

             if (this.sectionEnabled.proximityEnabled && this.config.proximityRules?.length > 0) {
                 this.priority_config_settings.test_proximity_rules = {
                     patterns: this.config.proximityRules.map(rule => rule.pattern),
                     max_gap_days: this.config.proximityRules[0]?.maxgapdays || 10,
                     proximity_penalty_per_day: this.config.proximityRules[0]?.proximitypenaltyperday || 50.0,
                     enforce_sequence_order: this.config.proximityRules.some(rule => rule.enforce_sequence_order)
                 };
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
            this.config.leg_deadlines.push({ id: '', date: '' });
            this.updateOutputSettings();
        },

        removeLegDeadline(index) {
            this.config.leg_deadlines.splice(index, 1);
            this.updateOutputSettings();
        },

        updateLegDeadline(index, id, date) {
            this.config.leg_deadlines[index] = { id, date };
            this.updateOutputSettings();
        },

        // Proximity rules management
        addPattern() {
            this.config.test_proximity_rules.patterns.push('');
            this.updateOutputSettings();
        },

        removePattern(index) {
            this.config.test_proximity_rules.patterns.splice(index, 1);
            this.updateOutputSettings();
        },

        updatePattern(index, pattern) {
            this.config.test_proximity_rules.patterns[index] = pattern;
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
                if (jsonData.leg_deadlines && Object.keys(jsonData.leg_deadlines).length > 0) {
                    this.config.deadlines = Object.entries(jsonData.leg_deadlines).map(([legId, deadlineDate]) => ({
                        legId,
                        deadlineDate,
                        deadlineTime: '00:00'
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
               deadlines: [
                  { legId: 'mwcu_b10_6', deadlineDate: '2027-05-01', deadlineTime: '00:00' },
                  { legId: 'mwcu_a7_6', deadlineDate: '2027-05-01', deadlineTime: '00:00' },
                  { legId: 'mwcu_b10_2.1', deadlineDate: '2028-12-15', deadlineTime: '00:00' },
                  { legId: 'mwcu_a7_2.1', deadlineDate: '2028-12-15', deadlineTime: '00:00' },
                  { legId: 'mwcu_b10_2.2', deadlineDate: '2028-07-01', deadlineTime: '00:00' },
                  { legId: 'mwcu_a7_2.2', deadlineDate: '2028-07-01', deadlineTime: '00:00' },
                  { legId: 'mwcu_b10_3', deadlineDate: '2028-06-01', deadlineTime: '00:00' },
                  { legId: 'mwcu_a7_3', deadlineDate: '2028-06-01', deadlineTime: '00:00' },
                  { legId: 'mwcu_b10_4', deadlineDate: '2027-07-01', deadlineTime: '00:00' },
                  { legId: 'mwcu_a7_4', deadlineDate: '2027-07-01', deadlineTime: '00:00' },
                  { legId: 'mwcu_b10_5', deadlineDate: '2027-07-01', deadlineTime: '00:00' },
                  { legId: 'mwcu_a7_5', deadlineDate: '2027-07-01', deadlineTime: '00:00' },
                  { legId: 'mwcu_b10_5a', deadlineDate: '2027-07-01', deadlineTime: '00:00' },
                  { legId: 'mwcu_a7_5a', deadlineDate: '2027-07-01', deadlineTime: '00:00' },
                  { legId: 'mwcu_b10_5b', deadlineDate: '2027-07-01', deadlineTime: '00:00' },
                  { legId: 'mwcu_a7_5b', deadlineDate: '2027-07-01', deadlineTime: '00:00' },
                  { legId: 'mwcu_b10_7', deadlineDate: '2028-12-15', deadlineTime: '00:00' },
                  { legId: 'mwcu_a7_7', deadlineDate: '2028-12-15', deadlineTime: '00:00' },
               ],
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
