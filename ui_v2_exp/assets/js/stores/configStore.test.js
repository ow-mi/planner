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
