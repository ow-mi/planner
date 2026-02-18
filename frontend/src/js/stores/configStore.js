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

function parseCompositeLegIdentifier(rawValue) {
    const value = String(rawValue || '').trim();
    if (!value.includes('__')) {
        return { project: '', legId: value, branch: '' };
    }

    const parts = value.split('__');
    if (parts.length === 2) {
        return {
            project: parts[0] || '',
            legId: parts[1] || '',
            branch: ''
        };
    }

    return {
        project: parts[0] || '',
        legId: parts[1] || '',
        branch: parts.slice(2).join('__') || ''
    };
}

function normalizeDeadlineEntry(entry) {
    if (!entry || typeof entry !== 'object') {
        return null;
    }

    const rawLegIdentifier = String(entry.legId || entry.leg || '').trim();
    const parsedLegacy = parseCompositeLegIdentifier(rawLegIdentifier);
    const explicitProject = String(entry.project || '').trim();
    const explicitBranch = String(entry.branch || entry.legBranch || '').trim();
    const project = explicitProject || parsedLegacy.project || '';
    const legId = parsedLegacy.legId || rawLegIdentifier;
    const branch = explicitBranch || parsedLegacy.branch || '';
    const startEnabled = typeof entry.startEnabled === 'boolean' ? entry.startEnabled : false;
    const endEnabled = typeof entry.endEnabled === 'boolean' ? entry.endEnabled : true;
    const startDeadline = normalizeDeadlineValue(entry.startDeadline || entry.startDate || '');
    const endDeadline = normalizeDeadlineValue(entry.endDeadline || entry.deadlineDate || entry.endDate || '');

    return {
        project,
        legId,
        branch,
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
        project: '',
        legId: entry.legId,
        branch: '',
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

function buildDeadlineKey(entry = {}) {
    const legId = String(entry.legId || '').trim();
    if (!legId) {
        return '';
    }

    const project = String(entry.project || '').trim();
    const branch = String(entry.branch || '').trim();

    if (!project && !branch) {
        return legId;
    }
    if (!project && branch) {
        return `${legId}__${branch}`;
    }
    if (project && !branch) {
        return `${project}__${legId}`;
    }
    return `${project}__${legId}__${branch}`;
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
         sectionEnabled: {
             modeEnabled: true,
             deadlinesEnabled: true,
             penaltyEnabled: true,
             proximityEnabled: true,
             fteEnabled: true,
             equipmentEnabled: true,
             testEnabled: true
         },
         fte: { resources: [], holidays: [], aliases: {} },
         equipment: { resources: [], holidays: [], aliases: {} },
         tests: {
             projectDefaults: { duration: 5, priority: 1.0, dependencies: [], force_start_week: null },
             legTypes: {}, legs: {}, testTypes: {}, tests: {}
         },
         // Phase D: Test resource assignment defaults
         testDefaults: {
             projectDefaults: {
                 fteResources: [],
                 equipmentResources: [],
                 fteTimePercentage: 100,
                 equipmentTimePercentage: 100,
                 isExternal: false
             },
             legTypes: {},
             legs: {},
             testTypes: {}
         },
         testHierarchy: {
              projectDefaults: {
                  defaultDuration: 5,
                  defaultPriority: 5,
                  startWeekBuffer: 0,
                  maxParallelTests: 10
              },
              legTypes: {},
              legs: {},
              testTypes: {},
              tests: {}
          },
          // Unified test configuration with inheritance support (Phase 1: Structure only, no migration yet)
          testConfig: {
              // Level 0: Root defaults (global defaults)
              defaults: {
                  fteResources: [],
                  equipmentResources: [],
                  fteTimePercentage: 100,
                  equipmentTimePercentage: 100,
                  isExternal: false,
                  duration: 5,
                  priority: 5,
                  forceStartWeek: null
              },
              // Level 1: Project overrides
              projects: {},
              // Level 2: Leg Type overrides
              legTypes: {},
              // Level 3: Leg overrides
              legs: {},
              // Level 4: Test Type overrides (supports patterns)
              testTypes: {},
              // Level 5: Individual test overrides
              tests: {}
          },
          priorityConfigSettings: {},
         isLoading: false,
         error: null,
         isInitialized: false,
         successMessage: '',
         jsonUploadFiles: [],
         jsonDragOver: false,

         // Initialization
         init() {
             try {
                 if (this.isInitialized) {
                     console.log('[configStore] Already initialized, skipping');
                     return;
                 }
                 console.log('Configuration store initialized');
                 migrateLegacyStorage();
                 // this.loadFromLocalStorage(); // Disabled - no persistence
                 this.config.deadlines = (this.config.deadlines || [])
                     .map(normalizeDeadlineEntry)
                     .filter(Boolean);
                 this.updateOutputSettings();

                 // Watch for sectionEnabled changes and trigger output settings update
                 // This is a workaround since Alpine.js stores don't have built-in reactivity for nested properties
                 const originalSectionEnabled = this.sectionEnabled;
                 this.sectionEnabled = {
                     ...originalSectionEnabled,
                     modeEnabled: originalSectionEnabled.modeEnabled,
                     deadlinesEnabled: originalSectionEnabled.deadlinesEnabled,
                     penaltyEnabled: originalSectionEnabled.penaltyEnabled,
                     proximityEnabled: originalSectionEnabled.proximityEnabled
                 };

                 // Mark as initialized for reactive updates
                 this.sectionEnabledInitialized = true;
                 this.isInitialized = true;
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
                    const deadlineKey = buildDeadlineKey(deadline);
                    if (!deadlineKey) {
                        return;
                    }

                    if (deadline.startEnabled && isValidWeekDeadlineFormat(deadline.startDeadline)) {
                        startDeadlines[deadlineKey] = deadline.startDeadline;
                    }

                    if (deadline.endEnabled && isValidWeekDeadlineFormat(deadline.endDeadline)) {
                        endDeadlines[deadlineKey] = deadline.endDeadline;
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
                project: this.config.deadlines[index].project || '',
                legId: id,
                branch: this.config.deadlines[index].branch || '',
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
                 project: '',
                 legId: '',
                 branch: '',
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
                    this.config.deadlines = Array.from(legIds).map((deadlineKey) => {
                        const parts = String(deadlineKey).split('__');
                        let project = '';
                        let legId = deadlineKey;
                        let branch = '';

                        if (parts.length >= 3) {
                            project = parts[0];
                            legId = parts[1];
                            branch = parts.slice(2).join('__');
                        } else if (parts.length === 2) {
                            project = parts[0];
                            legId = parts[1];
                            branch = '';
                        }

                        return {
                        project,
                        legId,
                        branch,
                        startDeadline: normalizeDeadlineValue(startDeadlines[deadlineKey]),
                        endDeadline: normalizeDeadlineValue(endDeadlines[deadlineKey]),
                        startEnabled: startDeadlines[deadlineKey] !== undefined,
                        endEnabled: endDeadlines[deadlineKey] !== undefined
                    };
                    });
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
               proximityEnabled: true,
               fteEnabled: true,
               equipmentEnabled: true,
               testEnabled: true
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
                  setTimeout(() => { this.successMessage = ''; }, 3000);
                  return true;
              }).catch(err => {
                  console.error('Failed to copy to clipboard:', err);
                  this.error = 'Failed to copy to clipboard: ' + err.message;
                  this.successMessage = '';
                  return false;
              });
          },

          // ============================================================================
          // TEST HIERARCHY MANAGEMENT METHODS
          // ============================================================================
          
          // Get effective setting by walking up the hierarchy
          getEffectiveTestSetting(level, testId, settingKey, legId, legTypeId) {
              const defaults = { duration: 5, priority: 1.0, dependencies: [], force_start_week: null };
              
              // Level 5: Individual Test (highest priority)
              if (this.tests.tests[testId]?.[settingKey] !== undefined) {
                  return { value: this.tests.tests[testId][settingKey], level: 'test', overridden: true };
              }
              
              // Level 4: Test Type
              const testType = this.tests.tests[testId]?.testType;
              if (testType && this.tests.testTypes[testType]?.[settingKey] !== undefined) {
                  return { value: this.tests.testTypes[testType][settingKey], level: 'testType', overridden: true };
              }
              
              // Level 3: Leg
              if (legId && this.tests.legs[legId]?.[settingKey] !== undefined) {
                  return { value: this.tests.legs[legId][settingKey], level: 'leg', overridden: true };
              }
              
              // Level 2: Leg Type
              if (legTypeId && this.tests.legTypes[legTypeId]?.[settingKey] !== undefined) {
                  return { value: this.tests.legTypes[legTypeId][settingKey], level: 'legType', overridden: true };
              }
              
              // Level 1: Project Defaults
              if (this.tests.projectDefaults[settingKey] !== undefined) {
                  return { value: this.tests.projectDefaults[settingKey], level: 'project', overridden: false };
              }
              
              return { value: defaults[settingKey], level: 'default', overridden: false };
          },

          // Add a test at any level
          addTest(level, id, settings) {
              if (level === 'project') {
                  this.tests.projectDefaults = { ...this.tests.projectDefaults, ...settings };
              } else if (level === 'legType') {
                  this.tests.legTypes[id] = { ...this.tests.legTypes[id], ...settings };
              } else if (level === 'leg') {
                  this.tests.legs[id] = { ...this.tests.legs[id], ...settings };
              } else if (level === 'testType') {
                  this.tests.testTypes[id] = { ...this.tests.testTypes[id], ...settings };
              } else if (level === 'test') {
                  this.tests.tests[id] = { ...this.tests.tests[id], ...settings, _uiId: id + '-' + Date.now() };
              }
              this.updateOutputSettings();
          },

          // Remove a test
          removeTest(level, id) {
              if (level === 'legType') delete this.tests.legTypes[id];
              else if (level === 'leg') delete this.tests.legs[id];
              else if (level === 'testType') delete this.tests.testTypes[id];
              else if (level === 'test') delete this.tests.tests[id];
              this.updateOutputSettings();
          },

          // Update a test setting
          updateTestSetting(level, id, settingKey, value) {
              if (level === 'project') this.tests.projectDefaults[settingKey] = value;
              else if (level === 'legType') {
                  if (!this.tests.legTypes[id]) this.tests.legTypes[id] = {};
                  this.tests.legTypes[id][settingKey] = value;
              } else if (level === 'leg') {
                  if (!this.tests.legs[id]) this.tests.legs[id] = {};
                  this.tests.legs[id][settingKey] = value;
              } else if (level === 'testType') {
                  if (!this.tests.testTypes[id]) this.tests.testTypes[id] = {};
                  this.tests.testTypes[id][settingKey] = value;
              } else if (level === 'test') {
                  if (!this.tests.tests[id]) this.tests.tests[id] = {};
                  this.tests.tests[id][settingKey] = value;
              }
              this.updateOutputSettings();
          },

          // Check if setting is overridden at this level
          isTestSettingOverridden(level, id, settingKey) {
              if (level === 'project') return false;
              if (level === 'legType') return this.tests.legTypes[id]?.[settingKey] !== undefined;
              if (level === 'leg') return this.tests.legs[id]?.[settingKey] !== undefined;
              if (level === 'testType') return this.tests.testTypes[id]?.[settingKey] !== undefined;
              if (level === 'test') return this.tests.tests[id]?.[settingKey] !== undefined;
              return false;
          },

          // Get inheritance chain for a test
          getTestInheritanceChain(testId, legId, legTypeId) {
              const chain = [];
              const settingKeys = ['duration', 'priority', 'dependencies', 'force_start_week'];
              
              settingKeys.forEach(key => {
                  const effective = this.getEffectiveTestSetting('test', testId, key, legId, legTypeId);
                  chain.push({ setting: key, ...effective });
              });
              
              return chain;
          },

          // Initialize test data from config
          initTestsFromConfig(config) {
              if (config.tests) {
                  this.tests = { ...this.tests, ...config.tests };
              }
          },

          // Update test hierarchy property
          updateTestHierarchy(path, key, value) {
              if (!this.testHierarchy[path]) {
                  this.testHierarchy[path] = {};
              }
              this.testHierarchy[path][key] = value;
              this.updateOutputSettings();
          },

          // Compatibility wrappers used by config-editor Test tab
          addLegTypeConfig(legType, config = {}) {
              this.addLegTypeToHierarchy(legType, config);
          },

          removeLegTypeConfig(legType) {
              this.removeLegTypeFromHierarchy(legType);
          },

          updateLegTypeConfig(legType, key, value) {
              if (!this.testHierarchy.legTypes) {
                  this.testHierarchy.legTypes = {};
              }
              if (!this.testHierarchy.legTypes[legType]) {
                  this.testHierarchy.legTypes[legType] = {};
              }
              this.testHierarchy.legTypes[legType][key] = value;
              this.updateOutputSettings();
          },

          updateLegTypeOverride(legType, key, enabled) {
              if (!this.testHierarchy.legTypes) {
                  this.testHierarchy.legTypes = {};
              }
              if (!this.testHierarchy.legTypes[legType]) {
                  this.testHierarchy.legTypes[legType] = {};
              }
              if (!this.testHierarchy.legTypes[legType].overrides) {
                  this.testHierarchy.legTypes[legType].overrides = {};
              }
              this.testHierarchy.legTypes[legType].overrides[key] = !!enabled;
              this.updateOutputSettings();
          },

          updateLegTestConfig(legId, key, value) {
              if (!this.testHierarchy.legs) {
                  this.testHierarchy.legs = {};
              }
              if (!this.testHierarchy.legs[legId]) {
                  this.testHierarchy.legs[legId] = {};
              }
              this.testHierarchy.legs[legId][key] = value;
              this.updateOutputSettings();
          },

          addTestTypeConfig(testType, config = {}) {
              this.addTestTypeToHierarchy(testType, config);
          },

          removeTestTypeConfig(testType) {
              this.removeTestTypeFromHierarchy(testType);
          },

          updateTestTypeConfig(testType, key, value) {
              if (!this.testHierarchy.testTypes) {
                  this.testHierarchy.testTypes = {};
              }
              if (!this.testHierarchy.testTypes[testType]) {
                  this.testHierarchy.testTypes[testType] = {};
              }
              this.testHierarchy.testTypes[testType][key] = value;
              this.updateOutputSettings();
          },

          // Add leg type to hierarchy
          addLegTypeToHierarchy(legType, config = {}) {
              if (!this.testHierarchy.legTypes) {
                  this.testHierarchy.legTypes = {};
              }
              this.testHierarchy.legTypes[legType] = {
                  duration: config.duration ?? null,
                  priority: config.priority ?? null,
                  forceStartWeek: config.forceStartWeek ?? null
              };
              this.updateOutputSettings();
          },

          // Remove leg type from hierarchy
          removeLegTypeFromHierarchy(legType) {
              if (this.testHierarchy.legTypes) {
                  delete this.testHierarchy.legTypes[legType];
              }
              this.updateOutputSettings();
          },

          // Add leg override to hierarchy
          addLegToHierarchy(legId, config = {}) {
              if (!this.testHierarchy.legs) {
                  this.testHierarchy.legs = {};
              }
              this.testHierarchy.legs[legId] = {
                  duration: config.duration ?? null,
                  priority: config.priority ?? null,
                  forceStartWeek: config.forceStartWeek ?? null
              };
              this.updateOutputSettings();
          },

          // Remove leg from hierarchy
          removeLegFromHierarchy(legId) {
              if (this.testHierarchy.legs) {
                  delete this.testHierarchy.legs[legId];
              }
              this.updateOutputSettings();
          },

          // Add test type to hierarchy
          addTestTypeToHierarchy(testType, config = {}) {
              if (!this.testHierarchy.testTypes) {
                  this.testHierarchy.testTypes = {};
              }
              this.testHierarchy.testTypes[testType] = {
                  duration: config.duration ?? null,
                  priority: config.priority ?? null,
                  category: config.category ?? 'test',
                  requiresEquipment: config.requiresEquipment ?? null
              };
              this.updateOutputSettings();
          },

          // Remove test type from hierarchy
          removeTestTypeFromHierarchy(testType) {
              if (this.testHierarchy.testTypes) {
                  delete this.testHierarchy.testTypes[testType];
              }
              this.updateOutputSettings();
          },

          // ============================================================================
          // TEST RESOURCE ASSIGNMENT METHODS (Phase D)
          // ============================================================================

          // Get effective test resource setting by walking up hierarchy
          getEffectiveTestResourceSetting(level, id, settingKey) {
              const defaults = {
                  fteResources: [],
                  equipmentResources: [],
                  fteTimePercentage: 100,
                  equipmentTimePercentage: 100,
                  isExternal: false
              };

              // Check level-specific overrides first
              if (level === 'testType' && this.testDefaults.testTypes[id]?.[settingKey] !== undefined) {
                  return { value: this.testDefaults.testTypes[id][settingKey], level: 'testType', overridden: true };
              }
              if (level === 'leg' && this.testDefaults.legs[id]?.[settingKey] !== undefined) {
                  return { value: this.testDefaults.legs[id][settingKey], level: 'leg', overridden: true };
              }
              if (level === 'legType' && this.testDefaults.legTypes[id]?.[settingKey] !== undefined) {
                  return { value: this.testDefaults.legTypes[id][settingKey], level: 'legType', overridden: true };
              }

              // Walk up hierarchy: TestType -> Leg -> LegType -> Project
              if (level === 'testType') {
                  // For test type, check leg/leg type if defined there
                  const legId = this._getLegForTestType(id);
                  const legTypeId = this._getLegTypeForTestType(id);
                  if (legId && this.testDefaults.legs[legId]?.[settingKey] !== undefined) {
                      return { value: this.testDefaults.legs[legId][settingKey], level: 'leg', overridden: false };
                  }
                  if (legTypeId && this.testDefaults.legTypes[legTypeId]?.[settingKey] !== undefined) {
                      return { value: this.testDefaults.legTypes[legTypeId][settingKey], level: 'legType', overridden: false };
                  }
              }

              if (level === 'leg') {
                  const legTypeId = this._getLegTypeForLeg(id);
                  if (legTypeId && this.testDefaults.legTypes[legTypeId]?.[settingKey] !== undefined) {
                      return { value: this.testDefaults.legTypes[legTypeId][settingKey], level: 'legType', overridden: false };
                  }
              }

              if (level === 'legType') {
                  // Go straight to project defaults
              }

              // Project defaults
              if (this.testDefaults.projectDefaults[settingKey] !== undefined) {
                  return { value: this.testDefaults.projectDefaults[settingKey], level: 'project', overridden: false };
              }

              return { value: defaults[settingKey], level: 'default', overridden: false };
          },

          // Helper to get leg for test type (simplified - can be enhanced)
          _getLegForTestType(testType) {
              // This is a placeholder - in real implementation, would lookup from test data
              return null;
          },

          // Helper to get leg type for test type
          _getLegTypeForTestType(testType) {
              return null;
          },

          // Helper to get leg type for leg
          _getLegTypeForLeg(legId) {
              return null;
          },

          // Update test resource assignment at any level
          updateTestResourceSetting(level, id, settingKey, value) {
              if (level === 'project') {
                  this.testDefaults.projectDefaults[settingKey] = value;
              } else {
                  if (!this.testDefaults[level + 's']) {
                      this.testDefaults[level + 's'] = {};
                  }
                  if (!this.testDefaults[level + 's'][id]) {
                      this.testDefaults[level + 's'][id] = {};
                  }
                  this.testDefaults[level + 's'][id][settingKey] = value;
              }
              this.updateOutputSettings();
          },

          // Get available FTE options (resources + aliases)
          getFteOptions() {
              const options = [];
              // Add FTE resources
              if (this.fte?.resources) {
                  this.fte.resources.forEach(resource => {
                      options.push({
                          id: resource.id,
                          name: resource.name || resource.id,
                          type: 'resource'
                      });
                  });
              }
              // Add FTE aliases
              if (this.fte?.aliases) {
                  Object.keys(this.fte.aliases).forEach(aliasName => {
                      options.push({
                          id: aliasName,
                          name: aliasName + ' (alias)',
                          type: 'alias'
                      });
                  });
              }
              return options;
          },

          // Get available Equipment options (resources + aliases)
          getEquipmentOptions() {
              const options = [];
              // Add equipment resources
              if (this.equipment?.resources) {
                  this.equipment.resources.forEach(resource => {
                      options.push({
                          id: resource.id,
                          name: resource.name || resource.id,
                          type: 'resource'
                      });
                  });
              }
              // Add equipment aliases
              if (this.equipment?.aliases) {
                  Object.keys(this.equipment.aliases).forEach(aliasName => {
                      options.push({
                          id: aliasName,
                          name: aliasName + ' (alias)',
                          type: 'alias'
                      });
                  });
              }
              return options;
          },

          // Phase D: Add resource to test type at any level
          addTestTypeResource(level, id, resourceType, resourceId) {
              if (!resourceId) return;

              let config;
              if (level === 'project') {
                  config = this.testDefaults.projectDefaults;
              } else {
                  if (!this.testDefaults[level + 's']) {
                      this.testDefaults[level + 's'] = {};
                  }
                  if (!this.testDefaults[level + 's'][id]) {
                      this.testDefaults[level + 's'][id] = {};
                  }
                  config = this.testDefaults[level + 's'][id];
              }

              // Initialize array if needed
              if (!config[resourceType]) {
                  config[resourceType] = [];
              }

              // Add if not already present
              if (!config[resourceType].includes(resourceId)) {
                  config[resourceType].push(resourceId);
                  this.updateOutputSettings();
              }
          },

          // Phase D: Remove resource from test type
          removeTestTypeResource(level, id, resourceType, resourceId) {
              let config;
              if (level === 'project') {
                  config = this.testDefaults.projectDefaults;
              } else {
                  if (!this.testDefaults[level + 's'] || !this.testDefaults[level + 's'][id]) {
                      return;
                  }
                  config = this.testDefaults[level + 's'][id];
              }

              if (config[resourceType]) {
                  const idx = config[resourceType].indexOf(resourceId);
                  if (idx >= 0) {
                      config[resourceType].splice(idx, 1);
                      this.updateOutputSettings();
                  }
              }
          },

          // Toggle FTE resource selection (add/remove)
          toggleTestFteResource(level, id, fteId) {
              const config = level === 'project'
                  ? this.testDefaults.projectDefaults
                  : (this.testDefaults[level + 's'][id] ||= {});

              const current = config.fteResources || [];
              const idx = current.indexOf(fteId);

              if (idx >= 0) {
                  current.splice(idx, 1);
              } else {
                  current.push(fteId);
              }
              config.fteResources = [...current];
              this.updateOutputSettings();
          },

          // Toggle Equipment resource selection (add/remove)
          toggleTestEquipmentResource(level, id, equipId) {
              const config = level === 'project'
                  ? this.testDefaults.projectDefaults
                  : (this.testDefaults[level + 's'][id] ||= {});

              const current = config.equipmentResources || [];
              const idx = current.indexOf(equipId);

              if (idx >= 0) {
                  current.splice(idx, 1);
              } else {
                  current.push(equipId);
              }
              config.equipmentResources = [...current];
              this.updateOutputSettings();
          },

          // Remove FTE resource from test assignment
          removeTestFteResource(level, id, fteId) {
              const config = level === 'project'
                  ? this.testDefaults.projectDefaults
                  : this.testDefaults[level + 's']?.[id];

              if (config?.fteResources) {
                  const idx = config.fteResources.indexOf(fteId);
                  if (idx >= 0) {
                      config.fteResources.splice(idx, 1);
                      config.fteResources = [...config.fteResources];
                  }
              }
              this.updateOutputSettings();
          },

          // Remove Equipment resource from test assignment
          removeTestEquipmentResource(level, id, equipId) {
              const config = level === 'project'
                  ? this.testDefaults.projectDefaults
                  : this.testDefaults[level + 's']?.[id];

              if (config?.equipmentResources) {
                  const idx = config.equipmentResources.indexOf(equipId);
                  if (idx >= 0) {
                      config.equipmentResources.splice(idx, 1);
                      config.equipmentResources = [...config.equipmentResources];
                  }
              }
              this.updateOutputSettings();
          },

          // Check if FTE resource is assigned to test
          isTestFteAssigned(level, id, fteId) {
              const config = level === 'project'
                  ? this.testDefaults.projectDefaults
                  : this.testDefaults[level + 's']?.[id];
              return config?.fteResources?.includes(fteId) || false;
          },

          // Check if Equipment resource is assigned to test
          isTestEquipmentAssigned(level, id, equipId) {
              const config = level === 'project'
                  ? this.testDefaults.projectDefaults
                  : this.testDefaults[level + 's']?.[id];
              return config?.equipmentResources?.includes(equipId) || false;
          },

          // ============================================================================
          // CSV ENTITY TRACKING AND VALIDATION (Phase 6)
          // ============================================================================

          csvEntities: { legs: new Set(), tests: new Set(), fteResources: new Set(), equipmentResources: new Set(), fteAliases: new Set(), equipmentAliases: new Set(), legTypes: new Set(), testTypes: new Set() },
          importValidationErrors: { warnings: [], mismatches: {}, totalErrors: 0, hasValidation: false },

          _extractOrderedCsvEntities(csvData) {
              if (!csvData?.headers || !Array.isArray(csvData.rows)) {
                  return {
                      legTypes: [],
                      legs: [],
                      testTypes: [],
                      tests: [],
                      fteResources: [],
                      equipmentResources: []
                  };
              }

              const headers = csvData.headers.map(h => String(h || '').trim().toLowerCase());
              const getIdx = (names) => headers.findIndex(h => names.includes(h));
              const val = (row, idx) => {
                  if (!Array.isArray(row) || idx < 0 || idx >= row.length) {
                      return '';
                  }
                  return String(row[idx] ?? '').trim();
              };

              const projectIdx = getIdx(['project']);
              const legTypeIdx = getIdx(['leg', 'leg_type']);
              const legIdIdx = getIdx(['project_leg', 'project_leg_id', 'leg_id']);
              const testTypeIdx = getIdx(['tests', 'test_types', 'test_type', 'test']);
              const testIdIdx = getIdx(['project_leg_tests', 'project_leg_test', 'project_leg_test_id', 'test_id', 'test_name']);
              const fteIdx = getIdx(['fte', 'fte_id', 'resource_id']);
              const equipmentIdx = getIdx(['equipment', 'equipment_id']);

              const pushUnique = (list, seen, value) => {
                  if (!value || seen.has(value)) {
                      return;
                  }
                  seen.add(value);
                  list.push(value);
              };

              const legTypes = [];
              const legs = [];
              const testTypes = [];
              const tests = [];
              const fteResources = [];
              const equipmentResources = [];

              const seenLegTypes = new Set();
              const seenLegs = new Set();
              const seenTestTypes = new Set();
              const seenTests = new Set();
              const seenFte = new Set();
              const seenEquipment = new Set();
              const generatedTestCounters = new Map();

              csvData.rows.forEach((row) => {
                  const project = val(row, projectIdx);
                  const legType = val(row, legTypeIdx);
                  const legId = val(row, legIdIdx) || ((project && legType) ? `${project}__${legType}` : '');
                  const testType = val(row, testTypeIdx);
                  let testId = val(row, testIdIdx);
                  if (!testId && legId && testType) {
                      const base = `${legId}__${testType}`;
                      const next = (generatedTestCounters.get(base) || 0) + 1;
                      generatedTestCounters.set(base, next);
                      testId = `${base}__${next}`;
                  }

                  pushUnique(legTypes, seenLegTypes, legType);
                  pushUnique(legs, seenLegs, legId);
                  pushUnique(testTypes, seenTestTypes, testType);
                  pushUnique(tests, seenTests, testId);
                  pushUnique(fteResources, seenFte, val(row, fteIdx));
                  pushUnique(equipmentResources, seenEquipment, val(row, equipmentIdx));
              });

              return { legTypes, legs, testTypes, tests, fteResources, equipmentResources };
          },

          updateCsvEntities(csvData) {
              if (!csvData || typeof csvData !== 'object') return;
              this.csvEntities = { legs: new Set(), tests: new Set(), fteResources: new Set(), equipmentResources: new Set(), fteAliases: new Set(), equipmentAliases: new Set(), legTypes: new Set(), testTypes: new Set() };
              Object.values(csvData).forEach((data) => {
                  const extracted = this._extractOrderedCsvEntities(data);
                  extracted.legs.forEach(v => this.csvEntities.legs.add(v));
                  extracted.legTypes.forEach(v => this.csvEntities.legTypes.add(v));
                  extracted.tests.forEach(v => this.csvEntities.tests.add(v));
                  extracted.testTypes.forEach(v => this.csvEntities.testTypes.add(v));
                  extracted.fteResources.forEach(v => this.csvEntities.fteResources.add(v));
                  extracted.equipmentResources.forEach(v => this.csvEntities.equipmentResources.add(v));
              });
          },

          syncConfigFromSelectedCsv(csvData) {
              const extracted = this._extractOrderedCsvEntities(csvData);
              const hasMappedValues =
                  extracted.legTypes.length > 0 ||
                  extracted.legs.length > 0 ||
                  extracted.testTypes.length > 0 ||
                  extracted.tests.length > 0;

              if (!hasMappedValues) {
                  return false;
              }

              const nextLegTypes = {};
              const nextLegs = {};
              const nextTestTypes = {};
              const nextTests = {};

              const existingHierarchy = this.testHierarchy || {};
              const existingLegTypes = existingHierarchy.legTypes || {};
              const existingLegs = existingHierarchy.legs || {};
              const existingTestTypes = existingHierarchy.testTypes || {};
              const existingTests = existingHierarchy.tests || {};

              extracted.legTypes.forEach((legType) => {
                  const existing = existingLegTypes[legType] || {};
                  nextLegTypes[legType] = {
                      displayName: existing.displayName || legType,
                      duration: existing.duration ?? null,
                      priority: existing.priority ?? null,
                      forceStartWeek: existing.forceStartWeek ?? null
                  };
              });

              extracted.legs.forEach((legId) => {
                  const existing = existingLegs[legId] || {};
                  nextLegs[legId] = {
                      displayName: existing.displayName || legId,
                      duration: existing.duration ?? null,
                      priority: existing.priority ?? null,
                      forceStartWeek: existing.forceStartWeek ?? null
                  };
              });

              extracted.testTypes.forEach((testType) => {
                  const existing = existingTestTypes[testType] || {};
                  nextTestTypes[testType] = {
                      displayName: existing.displayName || testType,
                      duration: existing.duration ?? null,
                      priority: existing.priority ?? null,
                      category: existing.category ?? 'test',
                      requiresEquipment: existing.requiresEquipment ?? null
                  };
              });

              extracted.tests.forEach((testId) => {
                  const existing = existingTests[testId] || {};
                  nextTests[testId] = {
                      displayName: existing.displayName || testId,
                      duration: existing.duration ?? null,
                      priority: existing.priority ?? null,
                      forceStartWeek: existing.forceStartWeek ?? null,
                      fteResources: Array.isArray(existing.fteResources) ? existing.fteResources : [],
                      equipmentResources: Array.isArray(existing.equipmentResources) ? existing.equipmentResources : []
                  };
              });

              this.testHierarchy = {
                  ...this.testHierarchy,
                  legTypes: nextLegTypes,
                  legs: nextLegs,
                  testTypes: nextTestTypes,
                  tests: nextTests
              };

              this.tests = {
                  ...this.tests,
                  legTypes: extracted.legTypes.reduce((acc, key) => {
                      acc[key] = this.tests.legTypes?.[key] || {};
                      return acc;
                  }, {}),
                  legs: extracted.legs.reduce((acc, key) => {
                      acc[key] = this.tests.legs?.[key] || {};
                      return acc;
                  }, {}),
                  testTypes: extracted.testTypes.reduce((acc, key) => {
                      acc[key] = this.tests.testTypes?.[key] || {};
                      return acc;
                  }, {}),
                  tests: extracted.tests.reduce((acc, key) => {
                      acc[key] = this.tests.tests?.[key] || {};
                      return acc;
                  }, {})
              };

              const existingDeadlinesByLeg = new Map(
                  (this.config.deadlines || []).map((deadline) => [deadline.legId, deadline])
              );
              const todayIsoWeek = convertDateToWeekFormat(new Date().toISOString().slice(0, 10));

              this.config.deadlines = extracted.legs.map((legId) => {
                  const existing = existingDeadlinesByLeg.get(legId);
                  if (existing) {
                      return { ...existing, legId };
                  }
                  return {
                      legId,
                      startDeadline: todayIsoWeek,
                      endDeadline: '',
                      startEnabled: true,
                      endEnabled: false
                  };
              });

              this.updateOutputSettings();
              return true;
          },

          validateConfigAgainstCsv(jsonData) {
              const warnings = [], mismatches = { legs: [], tests: [], fteResources: [], equipmentResources: [], fteAliases: [], equipmentAliases: [], legTypes: [], testTypes: [] };
              const hasCsv = this.csvEntities.legs.size > 0 || this.csvEntities.tests.size > 0 || this.csvEntities.fteResources.size > 0 || this.csvEntities.equipmentResources.size > 0;
              if (!hasCsv) return { warnings: [], mismatches, totalErrors: 0, hasValidation: false };

              ['legDeadlines', 'leg_deadlines', 'legStartDeadlines', 'leg_start_deadlines', 'legEndDeadlines', 'leg_end_deadlines'].forEach(key => {
                  const obj = jsonData[key] || {};
                  Object.keys(obj).forEach(id => {
                      if (!this.csvEntities.legs.has(id) && !mismatches.legs.includes(id)) {
                          mismatches.legs.push(id);
                          warnings.push(`Leg "${id}" not found in CSV`);
                      }
                  });
              });

              const rules = jsonData.testProximityRules || jsonData.test_proximity_rules;
              if (rules?.patterns) rules.patterns.forEach(p => {
                  if (!p.includes('*') && !this.csvEntities.testTypes.has(p) && !this.csvEntities.legTypes.has(p) && !mismatches.testTypes.includes(p)) {
                      mismatches.testTypes.push(p);
                      warnings.push(`Pattern "${p}" not found in CSV`);
                  }
              });

              if (jsonData.tests) {
                  Object.keys(jsonData.tests.legTypes || {}).forEach(lt => {
                      if (!this.csvEntities.legTypes.has(lt) && !mismatches.legTypes.includes(lt)) {
                          mismatches.legTypes.push(lt);
                          warnings.push(`Leg type "${lt}" not in CSV`);
                      }
                  });
                  Object.keys(jsonData.tests.testTypes || {}).forEach(tt => {
                      if (!this.csvEntities.testTypes.has(tt) && !mismatches.testTypes.includes(tt)) {
                          mismatches.testTypes.push(tt);
                          warnings.push(`Test type "${tt}" not in CSV`);
                      }
                  });
                  Object.keys(jsonData.tests.legs || {}).forEach(lid => {
                      if (!this.csvEntities.legs.has(lid) && !mismatches.legs.includes(lid)) {
                          mismatches.legs.push(lid);
                          warnings.push(`Leg "${lid}" from test config not in CSV`);
                      }
                  });
              }

              if (jsonData.fte?.resources) jsonData.fte.resources.forEach(r => {
                  const id = r.id || r;
                  if (id && !this.csvEntities.fteResources.has(id) && !mismatches.fteResources.includes(id)) {
                      mismatches.fteResources.push(id);
                      warnings.push(`FTE "${id}" not in CSV`);
                  }
              });

              if (jsonData.equipment?.resources) jsonData.equipment.resources.forEach(r => {
                  const id = r.id || r;
                  if (id && !this.csvEntities.equipmentResources.has(id) && !mismatches.equipmentResources.includes(id)) {
                      mismatches.equipmentResources.push(id);
                      warnings.push(`Equipment "${id}" not in CSV`);
                  }
              });

              this.importValidationErrors = { warnings, mismatches, totalErrors: warnings.length, hasValidation: true };
              return this.importValidationErrors;
          },

          getConfigValidationErrors() {
              const cfg = this.getCurrentConfig();
              return cfg ? this.validateConfigAgainstCsv(cfg) : { warnings: [], mismatches: {}, totalErrors: 0 };
          },

          hasCsvEntities() { return this.csvEntities.legs.size > 0 || this.csvEntities.tests.size > 0; },

          clearCsvEntities() { this.csvEntities = { legs: new Set(), tests: new Set(), fteResources: new Set(), equipmentResources: new Set(), fteAliases: new Set(), equipmentAliases: new Set(), legTypes: new Set(), testTypes: new Set() }; },

          clearImportWarnings() { this.importValidationErrors = { warnings: [], mismatches: {}, totalErrors: 0, hasValidation: false }; },

          // ============================================================================
          // FTE RESOURCE MANAGEMENT METHODS
          // ============================================================================

          addFteResource(id, name) {
              if (!this.fte) this.fte = { resources: [], holidays: [], aliases: {} };
              if (!this.fte.resources) this.fte.resources = [];
              this.fte.resources.push({ id, name, calendar: {} });
              this.updateOutputSettings();
          },

          removeFteResource(index) {
              if (!this.fte?.resources) return;
              this.fte.resources.splice(index, 1);
              this.updateOutputSettings();
          },

          updateFteCalendar(year, fteId, dateKey, available) {
              if (!this.fte?.resources) return;
              const resource = this.fte.resources.find(r => r.id === fteId);
              if (!resource) return;
              if (!resource.calendar) resource.calendar = {};
              if (!resource.calendar[year]) resource.calendar[year] = {};
              resource.calendar[year][dateKey] = available;
              this.updateOutputSettings();
          },

          bulkUpdateFteCalendar(year, fteId, dateKeys, available) {
              if (!this.fte?.resources) return;
              const resource = this.fte.resources.find(r => r.id === fteId);
              if (!resource) return;
              if (!resource.calendar) resource.calendar = {};
              if (!resource.calendar[year]) resource.calendar[year] = {};
              dateKeys.forEach(dateKey => {
                  resource.calendar[year][dateKey] = available;
              });
              this.updateOutputSettings();
          },

          addHolidayRange(startDate, endDate, name) {
              if (!this.fte) this.fte = { resources: [], holidays: [], aliases: {} };
              if (!this.fte.holidays) this.fte.holidays = [];
              this.fte.holidays.push({ startDate, endDate, name });
              this.updateOutputSettings();
          },

          removeHoliday(index) {
              if (!this.fte?.holidays) return;
              this.fte.holidays.splice(index, 1);
              this.updateOutputSettings();
          },

          addAliasGroup(aliasName, resourceNames) {
              if (!this.fte) this.fte = { resources: [], holidays: [], aliases: {} };
              if (!this.fte.aliases) this.fte.aliases = {};
              this.fte.aliases[aliasName] = resourceNames;
              this.updateOutputSettings();
          },

          removeAliasGroup(aliasName) {
              if (!this.fte?.aliases) return;
              delete this.fte.aliases[aliasName];
              this.updateOutputSettings();
          },

          // ============================================================================
          // EQUIPMENT RESOURCE MANAGEMENT METHODS
          // ============================================================================

          addEquipmentResource(id, name) {
              if (!this.equipment) this.equipment = { resources: [], holidays: [], aliases: {} };
              if (!this.equipment.resources) this.equipment.resources = [];
              this.equipment.resources.push({ id, name, calendar: {} });
              this.updateOutputSettings();
          },

          removeEquipmentResource(index) {
              if (!this.equipment?.resources) return;
              this.equipment.resources.splice(index, 1);
              this.updateOutputSettings();
          },

          updateEquipmentCalendar(year, equipmentId, dateKey, available) {
              if (!this.equipment?.resources) return;
              const resource = this.equipment.resources.find(r => r.id === equipmentId);
              if (!resource) return;
              if (!resource.calendar) resource.calendar = {};
              if (!resource.calendar[year]) resource.calendar[year] = {};
              resource.calendar[year][dateKey] = available;
              this.updateOutputSettings();
          },

          bulkUpdateEquipmentCalendar(year, equipmentId, dateKeys, available) {
              if (!this.equipment?.resources) return;
              const resource = this.equipment.resources.find(r => r.id === equipmentId);
              if (!resource) return;
              if (!resource.calendar) resource.calendar = {};
              if (!resource.calendar[year]) resource.calendar[year] = {};
              dateKeys.forEach(dateKey => {
                  resource.calendar[year][dateKey] = available;
              });
              this.updateOutputSettings();
          },

          addEquipmentHolidayRange(startDate, endDate, name) {
              if (!this.equipment) this.equipment = { resources: [], holidays: [], aliases: {} };
              if (!this.equipment.holidays) this.equipment.holidays = [];
              this.equipment.holidays.push({ startDate, endDate, name });
              this.updateOutputSettings();
          },

          removeEquipmentHoliday(index) {
              if (!this.equipment?.holidays) return;
              this.equipment.holidays.splice(index, 1);
              this.updateOutputSettings();
          },

          addEquipmentAliasGroup(aliasName, resourceNames) {
              if (!this.equipment) this.equipment = { resources: [], holidays: [], aliases: {} };
              if (!this.equipment.aliases) this.equipment.aliases = {};
              this.equipment.aliases[aliasName] = resourceNames;
              this.updateOutputSettings();
          },

          removeEquipmentAliasGroup(aliasName) {
              if (!this.equipment?.aliases) return;
              delete this.equipment.aliases[aliasName];
              this.updateOutputSettings();
          },

          // ============================================================================
          // TEST HIERARCHY MANAGEMENT METHODS
          // ============================================================================

          addLegTypeToHierarchy(legType, config = {}) {
              if (!this.testHierarchy) this.testHierarchy = { projectDefaults: {}, legTypes: {}, legs: {}, testTypes: {} };
              if (!this.testHierarchy.legTypes) this.testHierarchy.legTypes = {};
              this.testHierarchy.legTypes[legType] = {
                  duration: config.duration ?? null,
                  priority: config.priority ?? null,
                  forceStartWeek: config.forceStartWeek ?? null
              };
              this.updateOutputSettings();
          },

          removeLegTypeFromHierarchy(legType) {
              if (this.testHierarchy?.legTypes) {
                  delete this.testHierarchy.legTypes[legType];
              }
              this.updateOutputSettings();
          },

          addLegToHierarchy(legId, config = {}) {
              if (!this.testHierarchy) this.testHierarchy = { projectDefaults: {}, legTypes: {}, legs: {}, testTypes: {} };
              if (!this.testHierarchy.legs) this.testHierarchy.legs = {};
              this.testHierarchy.legs[legId] = {
                  duration: config.duration ?? null,
                  priority: config.priority ?? null,
                  forceStartWeek: config.forceStartWeek ?? null
              };
              this.updateOutputSettings();
          },

          removeLegFromHierarchy(legId) {
              if (this.testHierarchy?.legs) {
                  delete this.testHierarchy.legs[legId];
              }
              this.updateOutputSettings();
          },

          addTestTypeToHierarchy(testType, config = {}) {
              if (!this.testHierarchy) this.testHierarchy = { projectDefaults: {}, legTypes: {}, legs: {}, testTypes: {} };
              if (!this.testHierarchy.testTypes) this.testHierarchy.testTypes = {};
              this.testHierarchy.testTypes[testType] = {
                  duration: config.duration ?? null,
                  priority: config.priority ?? null,
                  category: config.category ?? 'test',
                  requiresEquipment: config.requiresEquipment ?? null
              };
              this.updateOutputSettings();
          },

          removeTestTypeFromHierarchy(testType) {
              if (this.testHierarchy?.testTypes) {
                  delete this.testHierarchy.testTypes[testType];
              }
              this.updateOutputSettings();
          },

          // ========== TESTS HIERARCHY METHODS ==========

          // Add individual test to hierarchy
          addTestToHierarchy(testId, config = {}) {
              if (!this.testHierarchy.tests) {
                  this.testHierarchy.tests = {};
              }
              this.testHierarchy.tests[testId] = {
                  displayName: config.displayName || testId,
                  duration: config.duration ?? null,
                  priority: config.priority ?? null,
                  forceStartWeek: config.forceStartWeek ?? null,
                  fteResources: config.fteResources || [],
                  equipmentResources: config.equipmentResources || []
              };
              this.updateOutputSettings();
          },

          // Remove individual test from hierarchy
          removeTestFromHierarchy(levelOrTestId, maybeTestId) {
              const testId = maybeTestId ?? levelOrTestId;
              if (this.testHierarchy?.tests && testId) {
                  delete this.testHierarchy.tests[testId];
              }
              this.updateOutputSettings();
          },

          // Update test settings at any hierarchy level
          updateTestSettings(level, id, settings) {
              if (!this.testHierarchy[level]) {
                  this.testHierarchy[level] = {};
              }
              if (!this.testHierarchy[level][id]) {
                  this.testHierarchy[level][id] = {};
              }
              Object.assign(this.testHierarchy[level][id], settings);
              this.updateOutputSettings();
          },

          // Add resource to test (fte or equipment)
          addTestResource(level, id, resourceType, resourceId) {
              if (!this.testHierarchy[level]?.[id]) {
                  this.testHierarchy[level][id] = {};
              }
              const testConfig = this.testHierarchy[level][id];
              const resources = resourceType === 'fteResources' ? 'fteResources' : 'equipmentResources';
              if (!testConfig[resources]) {
                  testConfig[resources] = [];
              }
              if (!testConfig[resources].includes(resourceId)) {
                  testConfig[resources].push(resourceId);
              }
              this.updateOutputSettings();
          },

           // Remove resource from test
           removeTestResource(level, id, resourceType, resourceId) {
               if (!this.testHierarchy[level]?.[id]) return;
               const testConfig = this.testHierarchy[level][id];
               const resources = resourceType === 'fteResources' ? 'fteResources' : 'equipmentResources';
               if (testConfig[resources]) {
                   testConfig[resources] = testConfig[resources].filter(r => r !== resourceId);
               }
               this.updateOutputSettings();
           },

           // ==================== Unified Test Configuration Methods (Phase 1) ====================

           // Get all hierarchy levels with metadata
           getTestHierarchyLevels() {
               return [
                   { id: 'all', label: 'All', icon: 'globe', description: 'Global defaults applied to all tests' },
                   { id: 'projects', label: 'Projects', icon: 'folder', description: 'Project-level overrides' },
                   { id: 'legTypes', label: 'Leg Types', icon: 'layers', description: 'Leg type-specific settings' },
                   { id: 'legs', label: 'Legs', icon: 'map-pin', description: 'Individual leg overrides' },
                   { id: 'testTypes', label: 'Test Types', icon: 'tag', description: 'Test type patterns' },
                   { id: 'tests', label: 'Tests', icon: 'file-text', description: 'Individual test configurations' }
               ];
           },

           // Get editable fields for a specific hierarchy level
           getEditableFields(level) {
               const fieldMap = {
                   all: ['fteResources', 'equipmentResources', 'fteTimePercentage', 'equipmentTimePercentage', 'isExternal', 'duration', 'priority'],
                   projects: ['fteResources', 'equipmentResources', 'fteTimePercentage', 'equipmentTimePercentage', 'isExternal'],
                   legTypes: ['fteResources', 'equipmentResources', 'fteTimePercentage', 'equipmentTimePercentage', 'isExternal', 'duration', 'priority'],
                   legs: ['fteResources', 'equipmentResources', 'fteTimePercentage', 'equipmentTimePercentage', 'isExternal', 'duration', 'priority'],
                   testTypes: ['fteResources', 'equipmentResources', 'fteTimePercentage', 'equipmentTimePercentage', 'isExternal', 'duration', 'priority'],
                   tests: ['fteResources', 'equipmentResources', 'fteTimePercentage', 'equipmentTimePercentage', 'isExternal', 'duration', 'priority', 'forceStartWeek']
               };
               return fieldMap[level] || [];
           },

           // Update a test configuration value (marks as overridden)
           updateTestConfigValue(level, configId, field, value) {
               if (!this.testConfig[level]) {
                   this.testConfig[level] = {};
               }
               if (!this.testConfig[level][configId]) {
                   this.testConfig[level][configId] = {};
               }
               
               this.testConfig[level][configId][field] = value;
               
               // Mark as overridden when value is set
               if (!this.testConfig[level][configId].overrides) {
                   this.testConfig[level][configId].overrides = {};
               }
               this.testConfig[level][configId].overrides[field] = true;
               
               this.updateOutputSettings();
           },

           // Toggle override flag for a field
           updateTestConfigOverride(level, configId, field, isOverridden) {
               if (!this.testConfig[level]) {
                   this.testConfig[level] = {};
               }
               if (!this.testConfig[level][configId]) {
                   this.testConfig[level][configId] = {};
               }
               if (!this.testConfig[level][configId].overrides) {
                   this.testConfig[level][configId].overrides = {};
               }
               
               this.testConfig[level][configId].overrides[field] = isOverridden;
               
               // If removing override, clear the value
               if (!isOverridden) {
                   delete this.testConfig[level][configId][field];
               }
               
               this.updateOutputSettings();
           },

           // Get inherited value by walking up the hierarchy
           getInheritedValue(level, configId, field) {
               // Define hierarchy order from most specific to most general
               const hierarchyOrder = ['tests', 'testTypes', 'legs', 'legTypes', 'projects', 'defaults'];
               const levelIndex = hierarchyOrder.indexOf(level);
               
               if (levelIndex === -1) {
                   return this.testConfig.defaults[field];
               }
               
               // Walk up hierarchy to find inherited value
               for (let i = levelIndex + 1; i < hierarchyOrder.length; i++) {
                   const parentLevel = hierarchyOrder[i];
                   const parentConfig = this.testConfig[parentLevel];
                   
                   if (parentConfig) {
                       if (parentLevel === 'defaults') {
                           return parentConfig[field];
                       }
                       
                       // For other levels, we need parent ID lookup
                       // This would need custom logic based on how configIds relate
                       // For now, return defaults as fallback
                       return parentConfig[field];
                   }
               }
               
                return this.testConfig.defaults[field];
            },

            // ==================== Data Migration Methods ====================

            // Migrate old test configuration structures to new unified model
            migrateTestConfiguration(oldData) {
                const migrated = {
                    defaults: { ...this.testConfig.defaults },
                    projects: {},
                    legTypes: {},
                    legs: {},
                    testTypes: {},
                    tests: {}
                };

                // Migrate from testHierarchy structure
                if (oldData && oldData.testHierarchy) {
                    // Migrate project defaults to global defaults
                    if (oldData.testHierarchy.projectDefaults) {
                        const projDefaults = oldData.testHierarchy.projectDefaults;
                        migrated.defaults.duration = projDefaults.defaultDuration ?? 5;
                        migrated.defaults.priority = projDefaults.defaultPriority ?? 5;
                    }

                    // Migrate leg types
                    if (oldData.testHierarchy.legTypes) {
                        Object.entries(oldData.testHierarchy.legTypes).forEach(([id, config]) => {
                            migrated.legTypes[id] = {
                                ...config,
                                overrides: config.overrides || {}
                            };
                        });
                    }

                    // Migrate legs
                    if (oldData.testHierarchy.legs) {
                        Object.entries(oldData.testHierarchy.legs).forEach(([id, config]) => {
                            migrated.legs[id] = config;
                        });
                    }

                    // Migrate test types
                    if (oldData.testHierarchy.testTypes) {
                        Object.entries(oldData.testHierarchy.testTypes).forEach(([id, config]) => {
                            migrated.testTypes[id] = config;
                        });
                    }

                    // Migrate tests
                    if (oldData.testHierarchy.tests) {
                        Object.entries(oldData.testHierarchy.tests).forEach(([id, config]) => {
                            migrated.tests[id] = config;
                        });
                    }
                }

                // Migrate from testDefaults structure (resource assignments)
                if (oldData && oldData.testDefaults) {
                    const projDefaults = oldData.testDefaults.projectDefaults || {};
                    migrated.defaults.fteResources = projDefaults.fteResources || [];
                    migrated.defaults.equipmentResources = projDefaults.equipmentResources || [];
                    migrated.defaults.fteTimePercentage = projDefaults.fteTimePercentage ?? 100;
                    migrated.defaults.equipmentTimePercentage = projDefaults.equipmentTimePercentage ?? 100;
                    migrated.defaults.isExternal = projDefaults.isExternal ?? false;

                    // Migrate leg type resource assignments
                    if (oldData.testDefaults.legTypes) {
                        Object.entries(oldData.testDefaults.legTypes).forEach(([id, config]) => {
                            if (!migrated.legTypes[id]) {
                                migrated.legTypes[id] = {};
                            }
                            if (config.fteResources) {
                                migrated.legTypes[id].fteResources = config.fteResources;
                            }
                            if (config.equipmentResources) {
                                migrated.legTypes[id].equipmentResources = config.equipmentResources;
                            }
                            if (config.fteTimePercentage !== undefined) {
                                migrated.legTypes[id].fteTimePercentage = config.fteTimePercentage;
                            }
                            if (config.equipmentTimePercentage !== undefined) {
                                migrated.legTypes[id].equipmentTimePercentage = config.equipmentTimePercentage;
                            }
                            if (config.isExternal !== undefined) {
                                migrated.legTypes[id].isExternal = config.isExternal;
                            }
                        });
                    }

                    // Migrate leg resource assignments
                    if (oldData.testDefaults.legs) {
                        Object.entries(oldData.testDefaults.legs).forEach(([id, config]) => {
                            if (!migrated.legs[id]) {
                                migrated.legs[id] = {};
                            }
                            if (config.fteResources) {
                                migrated.legs[id].fteResources = config.fteResources;
                            }
                            if (config.equipmentResources) {
                                migrated.legs[id].equipmentResources = config.equipmentResources;
                            }
                            if (config.fteTimePercentage !== undefined) {
                                migrated.legs[id].fteTimePercentage = config.fteTimePercentage;
                            }
                            if (config.equipmentTimePercentage !== undefined) {
                                migrated.legs[id].equipmentTimePercentage = config.equipmentTimePercentage;
                            }
                            if (config.isExternal !== undefined) {
                                migrated.legs[id].isExternal = config.isExternal;
                            }
                        });
                    }

                    // Migrate test type resource assignments
                    if (oldData.testDefaults.testTypes) {
                        Object.entries(oldData.testDefaults.testTypes).forEach(([id, config]) => {
                            if (!migrated.testTypes[id]) {
                                migrated.testTypes[id] = {};
                            }
                            if (config.fteResources) {
                                migrated.testTypes[id].fteResources = config.fteResources;
                            }
                            if (config.equipmentResources) {
                                migrated.testTypes[id].equipmentResources = config.equipmentResources;
                            }
                            if (config.fteTimePercentage !== undefined) {
                                migrated.testTypes[id].fteTimePercentage = config.fteTimePercentage;
                            }
                            if (config.equipmentTimePercentage !== undefined) {
                                migrated.testTypes[id].equipmentTimePercentage = config.equipmentTimePercentage;
                            }
                            if (config.isExternal !== undefined) {
                                migrated.testTypes[id].isExternal = config.isExternal;
                            }
                        });
                    }
                }

                return migrated;
            },

            // Mark migration as complete to prevent re-running
            setMigrationComplete() {
                this.migrationComplete = true;
            },

            // Check if migration has been completed
            hasMigrationCompleted() {
                return this.migrationComplete || false;
            },

            // ==================== Resource Management Methods ====================

            // Add resource to defaults (fte or equipment)
            addDefaultResource(resourceType, resourceId) {
                const resources = resourceType === 'fte' ? 'fteResources' : 'equipmentResources';
                if (!this.testConfig.defaults[resources].includes(resourceId)) {
                    this.testConfig.defaults[resources].push(resourceId);
                }
                this.updateOutputSettings();
            },

            // Remove resource from defaults
            removeDefaultResource(resourceType, resourceId) {
                const resources = resourceType === 'fte' ? 'fteResources' : 'equipmentResources';
                if (this.testConfig.defaults[resources]) {
                    this.testConfig.defaults[resources] = this.testConfig.defaults[resources].filter(r => r !== resourceId);
                }
                this.updateOutputSettings();
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
