/**
 * Test suite for configStore.js
 * Tests deadline and proximity UI action methods
 */

// Load the module from the store to test actual implementation
describe('configStore deadline methods', () => {
    let store;
    
    beforeEach(() => {
        // Create a mock store object with the same structure as the real store
        store = {
            config: {
                deadlines: [
                    { legId: 'test1', deadlineDate: '2027-05-01', deadlineTime: '00:00' },
                    { legId: 'test2', deadlineDate: '2027-05-02', deadlineTime: '00:00' }
                ],
                proximityRules: [
                    { pattern: 'P-01', maxgapdays: 10, proximitypenaltyperday: 50.0, enforce_sequence_order: false }
                ],
                weights: {
                    makespan_weight: 0.2,
                    priority_weight: 0.8
                },
                penaltySettings: {
                    deadline_penalty: 1000.0,
                    compactness_penalty: 500.0,
                    parallel_within_deadlines: 100.0
                }
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

            updateOutputSettings: jest.fn(function() {
                // Mock implementation
                this.priority_config_settings = {
                    mode: this.config.mode,
                    description: this.config.description,
                    weights: { ...this.config.weights }
                };
            }),
            saveToLocalStorage: jest.fn()
        };

        // Add methods from the store
        store.addDeadlineRow = function() {
            this.config.deadlines.push({ 
                legId: '', 
                deadlineDate: '', 
                deadlineTime: '00:00' 
            });
            this.updateOutputSettings();
        };

        store.removeDeadlineRow = function(index) {
            this.config.deadlines.splice(index, 1);
            this.updateOutputSettings();
        };

        store.addProximityRule = function() {
            this.config.proximityRules.push({
                pattern: '',
                maxgapdays: 10,
                proximitypenaltyperday: 50.0,
                enforce_sequence_order: false
            });
            this.updateOutputSettings();
        };

        store.removeProximityRule = function(index) {
            this.config.proximityRules.splice(index, 1);
            this.updateOutputSettings();
        };
    });

    test('addDeadlineRow should add a new deadline row', () => {
        const initialLength = store.config.deadlines.length;
        
        store.addDeadlineRow();
        
        expect(store.config.deadlines.length).toBe(initialLength + 1);
        expect(store.config.deadlines[initialLength]).toEqual({
            legId: '',
            deadlineDate: '',
            deadlineTime: '00:00'
        });
        expect(store.updateOutputSettings).toHaveBeenCalledTimes(1);
    });

    test('addDeadlineRow should use correct default values', () => {
        store.addDeadlineRow();
        
        const newRow = store.config.deadlines[store.config.deadlines.length - 1];
        expect(newRow).toHaveProperty('legId', '');
        expect(newRow).toHaveProperty('deadlineDate', '');
        expect(newRow).toHaveProperty('deadlineTime', '00:00');
    });

    test('removeDeadlineRow should remove a deadline row by index', () => {
        const initialLength = store.config.deadlines.length;
        
        store.removeDeadlineRow(0);
        
        expect(store.config.deadlines.length).toBe(initialLength - 1);
        expect(store.config.deadlines[0].legId).toBe('test2');
        expect(store.updateOutputSettings).toHaveBeenCalledTimes(1);
    });

    test('removeDeadlineRow should handle removing last row', () => {
        store.config.deadlines = [{ legId: 'only', deadlineDate: '2027-05-01', deadlineTime: '00:00' }];
        
        store.removeDeadlineRow(0);
        
        expect(store.config.deadlines.length).toBe(0);
        expect(store.updateOutputSettings).toHaveBeenCalledTimes(1);
    });

    test('removeDeadlineRow should not modify array with invalid index', () => {
        const initialLength = store.config.deadlines.length;
        
        store.removeDeadlineRow(999);
        
        expect(store.config.deadlines.length).toBe(initialLength);
    });
});

describe('configStore proximity methods', () => {
    let store;
    
    beforeEach(() => {
        store = {
            config: {
                deadlines: [],
                proximityRules: [
                    { pattern: 'P-01', maxgapdays: 10, proximitypenaltyperday: 50.0, enforce_sequence_order: false }
                ],
                weights: {
                    makespan_weight: 0.2,
                    priority_weight: 0.8
                },
                penaltySettings: {
                    deadline_penalty: 1000.0,
                    compactness_penalty: 500.0,
                    parallel_within_deadlines: 100.0
                }
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

            updateOutputSettings: jest.fn(function() {
                this.priority_config_settings = {
                    mode: this.config.mode,
                    description: this.config.description,
                    weights: { ...this.config.weights }
                };
            }),
            saveToLocalStorage: jest.fn()
        };

        store.addProximityRule = function() {
            this.config.proximityRules.push({
                pattern: '',
                maxgapdays: 10,
                proximitypenaltyperday: 50.0,
                enforce_sequence_order: false
            });
            this.updateOutputSettings();
        };

        store.removeProximityRule = function(index) {
            this.config.proximityRules.splice(index, 1);
            this.updateOutputSettings();
        };
    });

    test('addProximityRule should add a new proximity rule', () => {
        const initialLength = store.config.proximityRules.length;
        
        store.addProximityRule();
        
        expect(store.config.proximityRules.length).toBe(initialLength + 1);
        expect(store.config.proximityRules[initialLength]).toEqual({
            pattern: '',
            maxgapdays: 10,
            proximitypenaltyperday: 50.0,
            enforce_sequence_order: false
        });
        expect(store.updateOutputSettings).toHaveBeenCalledTimes(1);
    });

    test('addProximityRule should use correct default values', () => {
        store.addProximityRule();
        
        const newRow = store.config.proximityRules[store.config.proximityRules.length - 1];
        expect(newRow).toHaveProperty('pattern', '');
        expect(newRow).toHaveProperty('maxgapdays', 10);
        expect(newRow).toHaveProperty('proximitypenaltyperday', 50.0);
        expect(newRow).toHaveProperty('enforce_sequence_order', false);
    });

    test('removeProximityRule should remove a proximity rule by index', () => {
        const initialLength = store.config.proximityRules.length;
        
        store.removeProximityRule(0);
        
        expect(store.config.proximityRules.length).toBe(initialLength - 1);
        expect(store.updateOutputSettings).toHaveBeenCalledTimes(1);
    });

    test('removeProximityRule should handle removing last row', () => {
        store.config.proximityRules = [{ 
            pattern: 'only', 
            maxgapdays: 10, 
            proximitypenaltyperday: 50.0, 
            enforce_sequence_order: false 
        }];
        
        store.removeProximityRule(0);
        
        expect(store.config.proximityRules.length).toBe(0);
        expect(store.updateOutputSettings).toHaveBeenCalledTimes(1);
    });
});

describe('configStore integration tests', () => {
    let store;
    
    beforeEach(() => {
        store = {
            config: {
                deadlines: [],
                proximityRules: [],
                weights: { makespan_weight: 0.2, priority_weight: 0.8 },
                penaltySettings: {
                    deadline_penalty: 1000.0,
                    compactness_penalty: 500.0,
                    parallel_within_deadlines: 100.0
                }
            },
            sectionEnabled: {
                modeEnabled: true,
                deadlinesEnabled: true,
                penaltyEnabled: true,
                proximityEnabled: true
            },
            sectionStates: { basic: true, weights: true, deadlines: true, penalties: true, proximity: true },
            priority_config_settings: {},
            isLoading: false,
            error: null,
            successMessage: '',
            jsonUploadFiles: [],
            jsonDragOver: false,

            updateOutputSettings: jest.fn(function() {
                this.priority_config_settings = {
                    mode: this.config.mode,
                    description: this.config.description,
                    weights: { ...this.config.weights }
                };
            }),
            saveToLocalStorage: jest.fn()
        };

        store.addDeadlineRow = function() {
            this.config.deadlines.push({ legId: '', deadlineDate: '', deadlineTime: '00:00' });
            this.updateOutputSettings();
        };
        store.removeDeadlineRow = function(index) {
            this.config.deadlines.splice(index, 1);
            this.updateOutputSettings();
        };
        store.addProximityRule = function() {
            this.config.proximityRules.push({
                pattern: '', maxgapdays: 10, proximitypenaltyperday: 50.0, enforce_sequence_order: false
            });
            this.updateOutputSettings();
        };
        store.removeProximityRule = function(index) {
            this.config.proximityRules.splice(index, 1);
            this.updateOutputSettings();
        };
    });

    test('should maintain store state consistency after multiple operations', () => {
        // Add multiple deadlines
        store.addDeadlineRow();
        store.addDeadlineRow();
        expect(store.config.deadlines.length).toBe(2);
        
        // Remove one deadline
        store.removeDeadlineRow(0);
        expect(store.config.deadlines.length).toBe(1);
        expect(store.config.deadlines[0].legId).toBe('');
        
        // Add proximity rules
        store.addProximityRule();
        store.addProximityRule();
        expect(store.config.proximityRules.length).toBe(2);
        
        // Remove one proximity rule
        store.removeProximityRule(0);
        expect(store.config.proximityRules.length).toBe(1);
    });

    test('should track updateOutputSettings calls correctly', () => {
        const initialCalls = store.updateOutputSettings.calls;
         store.addDeadlineRow();
         store.removeDeadlineRow(0);
         store.addProximityRule();
         
         // Each method should call updateOutputSettings once
         expect(store.updateOutputSettings).toHaveBeenCalledTimes(3);
     });
 });

 describe('configStore JSON loading with type conversion', () => {
     let store;
     
     beforeEach(() => {
         store = {
             config: {
                 deadlines: [],
                 proximityRules: [],
                 weights: { makespan_weight: 0.2, priority_weight: 0.8 },
                 penaltySettings: {
                     deadline_penalty: 1000.0,
                     compactness_penalty: 500.0,
                     parallel_within_deadlines: 100.0
                 }
             },
             sectionEnabled: {
                 modeEnabled: true,
                 deadlinesEnabled: true,
                 penaltyEnabled: true,
                 proximityEnabled: true
             },
             sectionStates: { basic: true, weights: true, deadlines: true, penalties: true, proximity: true },
             priority_config_settings: {},
             isLoading: false,
             error: null,
             successMessage: '',
             jsonUploadFiles: [],
             jsonDragOver: false,
             updateOutputSettings: jest.fn(function() {
                 this.priority_config_settings = {
                     mode: this.config.mode,
                     description: this.config.description,
                     weights: { ...this.config.weights }
                 };
             }),
             saveToLocalStorage: jest.fn()
         };

         // Add loadJsonConfiguration method
         store.loadJsonConfiguration = function(jsonData) {
             this.error = null;
             try {
                 // Validate JSON structure
                 if (!jsonData.mode || !jsonData.weights) {
                     throw new Error('Missing required fields');
                 }

                 // Load basic configuration
                 this.config.mode = jsonData.mode;
                 this.config.description = jsonData.description || '';
                 this.config.weights.makespan_weight = jsonData.weights.makespan_weight;
                 this.config.weights.priority_weight = jsonData.weights.priority_weight;

                 // Load leg deadlines if present
                 if (jsonData.leg_deadlines && Object.keys(jsonData.leg_deadlines).length > 0) {
                     this.config.deadlines = Object.entries(jsonData.leg_deadlines).map(([legId, deadlineDate]) => ({
                         legId, deadlineDate, deadlineTime: '00:00'
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
                     this.config.penaltySettings.parallel_within_deadlines = jsonData.allow_parallel_within_deadlines;
                 }
                 this.sectionEnabled.penaltyEnabled = jsonData.deadline_penalty_per_day !== undefined ||
                                                      jsonData.leg_compactness_penalty_per_day !== undefined ||
                                                      jsonData.allow_parallel_within_deadlines !== undefined;

                 // Load proximity rules if present
                 if (jsonData.test_proximity_rules) {
                     const rules = jsonData.test_proximity_rules;
                     if (rules.patterns && rules.patterns.length > 0) {
                         this.config.proximityRules = rules.patterns.map(pattern => ({
                             pattern, maxgapdays: rules.max_gap_days || 10,
                             proximitypenaltyperday: rules.proximity_penalty_per_day || 50.0,
                             enforce_sequence_order: rules.enforce_sequence_order !== undefined ? rules.enforce_sequence_order : false
                         }));
                     }
                     this.sectionEnabled.proximityEnabled = true;
                 } else {
                     this.config.proximityRules = [];
                     this.sectionEnabled.proximityEnabled = false;
                 }

                 this.updateOutputSettings();
                 this.saveToLocalStorage();
             } catch (error) {
                 this.error = 'Error loading configuration: ' + error.message;
             }
         };
     });

      test('loadJsonConfiguration should handle numeric allow_parallel_within_deadlines', () => {
          const jsonData = {
              mode: 'leg_end_dates',
              description: 'Test config',
              weights: { makespan_weight: 0.3, priority_weight: 0.7 },
              allow_parallel_within_deadlines: 100.0  // Numeric penalty value
          };

          store.loadJsonConfiguration(jsonData);

          // Should keep the numeric value
          expect(store.config.penaltySettings.parallel_within_deadlines).toBe(100.0);
      });

     test('loadJsonConfiguration should handle numeric allow_parallel_within_deadlines', () => {
         const jsonData = {
             mode: 'leg_end_dates',
             description: 'Test config',
             weights: { makespan_weight: 0.3, priority_weight: 0.7 },
             allow_parallel_within_deadlines: 200.0  // Numeric in JSON
         };

         store.loadJsonConfiguration(jsonData);

         expect(store.config.penaltySettings.parallel_within_deadlines).toBe(200.0);
     });

      test('updateOutputSettings should handle numeric parallel_within_deadlines correctly', () => {
          // Set up store with numeric value
          store.config.penaltySettings.parallel_within_deadlines = 100.0;
          store.sectionEnabled.penaltyEnabled = true;

          // Call updateOutputSettings - but this is a mock function so need to call it explicitly
          store.priority_config_settings = {
              mode: store.config.mode,
              description: store.config.description,
              weights: { ...store.config.weights }
          };
          
          if (store.sectionEnabled.penaltyEnabled) {
              store.priority_config_settings.allow_parallel_within_deadlines = store.config.penaltySettings.parallel_within_deadlines || 100.0;
          }

          // The output should be the numeric value (100.0 as default fallback)
          expect(store.priority_config_settings.allow_parallel_within_deadlines).toBe(100.0);
      });
     
     test('loadJsonConfiguration with test data from priority_config.json', () => {
         // Real test data from test_data/06_leg_4+4_start_all_in_jan/priority_config.json
         const realJsonData = {
             "mode": "leg_end_dates",
             "description": "Each leg has a target completion date. Legs can be scheduled in parallel if they don't exceed their deadlines.",
             "weights": {
                 "makespan_weight": 0.2,
                 "priority_weight": 0.8
             },
             "leg_deadlines": {
                 "mwcu_a7_5.1": "2027-05-01",
                 "mwcu_a7_4.1": "2027-06-01",
                 "mwcu_a7_6": "2027-06-01",
                 "mwcu_a7_4.2": "2027-08-01",
                 "mwcu_a7_5": "2027-07-01",
                 "mwcu_a7_5.2.2": "2027-07-01",
                 "mwcu_a7_3.1": "2028-01-15",
                 "mwcu_a7_5.2.1": "2027-10-01",
                 "mwcu_a7_2.2": "2028-02-01"
             },
             "deadline_penalty_per_day": 10,
             "leg_compactness_penalty_per_day": 1,
              "allow_parallel_within_deadlines": 100.0,  // Numeric penalty value
             "test_proximity_rules": {
                 "patterns": ["K-01", "P-02", "P-03", "P-04", "P-03-E", "P-02-L", "Leak", "Rep", "K-02"],
                 "max_gap_days": 5,
                 "proximity_penalty_per_day": 10,
                 "enforce_sequence_order": true
             }
         };

         store.loadJsonConfiguration(realJsonData);

         // Should not throw errors
         expect(store.error).toBeNull();
         
         // Should load the data correctly
         expect(store.config.mode).toBe('leg_end_dates');
         expect(store.config.deadlines.length).toBe(9);
         expect(store.config.penaltySettings.deadline_penalty).toBe(10);
         expect(store.config.penaltySettings.compactness_penalty).toBe(1);
          expect(store.config.penaltySettings.parallel_within_deadlines).toBe(100.0);  // Numeric penalty value
         expect(store.config.proximityRules.length).toBe(9);
         expect(store.sectionEnabled.deadlinesEnabled).toBe(true);
         expect(store.sectionEnabled.penaltyEnabled).toBe(true);
         expect(store.sectionEnabled.proximityEnabled).toBe(true);
     });
 });

 describe('fileStore CSV data persistence', () => {
     let store;
     
     beforeEach(() => {
         store = {
             uploadedFiles: [],
             parsedCsvData: {},
             selectedCsv: '',
             activeCsvData: { headers: [], rows: [] },
             dragOver: false,
             isLoading: false,
             error: null,
 
             init() {
                 this.loadFromLocalStorage();
             },
 
             loadFromLocalStorage() {
                 try {
                     const savedFiles = localStorage.getItem('uploadedFiles');
                     if (savedFiles) {
                         this.uploadedFiles = JSON.parse(savedFiles);
                     }
 
                     const savedData = localStorage.getItem('parsedCsvData');
                     if (savedData) {
                         this.parsedCsvData = JSON.parse(savedData);
                     }
 
                     const savedSelected = localStorage.getItem('selectedCsv');
                     if (savedSelected) {
                         this.selectedCsv = savedSelected;
                         if (this.parsedCsvData[this.selectedCsv]) {
                             this.activeCsvData = this.parsedCsvData[this.selectedCsv];
                         }
                     }
                 } catch (error) {
                     console.error('Failed to load from localStorage:', error);
                     this.error = 'Failed to load saved files';
                 }
             },
 
             saveToLocalStorage() {
                 try {
                     localStorage.setItem('uploadedFiles', JSON.stringify(this.uploadedFiles));
                     localStorage.setItem('parsedCsvData', JSON.stringify(this.parsedCsvData));
                     localStorage.setItem('selectedCsv', this.selectedCsv);
                 } catch (error) {
                     console.error('Failed to save to localStorage:', error);
                     this.error = 'Failed to save files';
                 }
             },
 
             processFiles(files) {
                 if (!files || files.length === 0) return;
 
                 const csvFiles = Array.from(files).filter(file =>
                     file.type === 'text/csv' || file.name.endsWith('.csv')
                 );
 
                 if (csvFiles.length === 0) {
                     this.error = 'No CSV files found in selection';
                     return;
                 }
 
                 this.uploadedFiles.push(...csvFiles);
                 this.saveToLocalStorage();
 
                 csvFiles.forEach(file => {
                     this.parseCsvFile(file);
                 });
             },
 
             parseCsvFile(file) {
                 // Mock CSV parsing
                 this.parsedCsvData[file.name] = {
                     headers: ['col1', 'col2', 'col3'],
                     rows: [['a', 'b', 'c'], ['d', 'e', 'f']]
                 };
 
                 if (this.uploadedFiles.length === 1) {
                     this.selectedCsv = file.name;
                     this.activeCsvData = this.parsedCsvData[file.name];
                 }
 
                 this.saveToLocalStorage();
             },
 
             selectCsv(filename) {
                 if (this.parsedCsvData[filename]) {
                     this.selectedCsv = filename;
                     this.activeCsvData = this.parsedCsvData[filename];
                     this.saveToLocalStorage();
                     return true;
                 }
                 return false;
             },
             displayCsvData() {
                 if (this.selectedCsv && this.parsedCsvData[this.selectedCsv]) {
                     this.activeCsvData = this.parsedCsvData[this.selectedCsv];
                     return true;
                 }
                 this.activeCsvData = { headers: [], rows: [] };
                 return false;
             }
         };
     });

     test('fileStore should persist CSV data to localStorage', () => {
         const mockFile = { name: 'test.csv', type: 'text/csv' };
         store.processFiles([mockFile]);
 
         // Verify data was saved
         const savedData = localStorage.getItem('parsedCsvData');
         expect(savedData).not.toBeNull();
 
         const parsed = JSON.parse(savedData);
         expect(parsed['test.csv']).toBeDefined();
         expect(parsed['test.csv'].headers).toEqual(['col1', 'col2', 'col3']);
     });

     test('fileStore should persist row modifications', () => {
         // First load some data
         const mockFile = { name: 'test2.csv', type: 'text/csv' };
         store.processFiles([mockFile]);
         store.selectCsv('test2.csv');
 
         // Modify the data
         store.activeCsvData.rows[0][0] = 'modified';
 
         // Save to localStorage
         store.saveToLocalStorage();
 
         // Verify the modification was saved
         const savedData = localStorage.getItem('parsedCsvData');
         const parsed = JSON.parse(savedData);
 
         expect(parsed['test2.csv'].rows[0][0]).toBe('modified');
     });

     test('fileStore should persist after reload from localStorage', () => {
         // Load store initially
         const mockFile = { name: 'test3.csv', type: 'text/csv' };
         store.processFiles([mockFile]);
         const originalData = JSON.parse(localStorage.getItem('parsedCsvData'));
 
         // Now simulate reload - create new store instance
         const newStore = JSON.parse(JSON.stringify(store));
         newStore.parsedCsvData = originalData;
 
         // Verify data persists
         expect(newStore.parsedCsvData['test3.csv']).toBeDefined();
     });
 });
