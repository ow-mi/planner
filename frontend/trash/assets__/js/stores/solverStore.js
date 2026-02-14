/**
 * Solver Store - Alpine.js Store for Solver Execution Management
 *
 * Manages solver execution state, progress tracking, and results handling
 */

// Storage key constants for consistency
const SOLVER_STORAGE_KEYS = {
    SOLVER_EXECUTION_CONFIG: 'ui_v2_exp__solver__executionConfig'
};

document.addEventListener('alpine:init', () => {
    Alpine.store('solver', {
        // State
        status: 'IDLE', // IDLE, RUNNING, COMPLETED, FAILED
        executionId: null,
        progress: 0,
        elapsedTime: 0,
        message: '',
        error: null,
        results: null,
        settingsUsed: null,
        config: {
            timeLimit: 300,
            debugLevel: 'INFO',
            outputFolder: ''
        },
        isLoading: false,

        // Initialization
        init() {
            try {
                console.log('Solver store initialized');
                this.loadFromLocalStorage();
            } catch (error) {
                console.error('SolverStore init failed:', error);
                this.error = 'Failed to initialize solver storage';
            }
        },

        // Load from localStorage
        loadFromLocalStorage() {
            try {
                const savedConfig = localStorage.getItem(SOLVER_STORAGE_KEYS.SOLVER_EXECUTION_CONFIG);
                if (savedConfig) {
                    this.config = JSON.parse(savedConfig);
                }
            } catch (error) {
                console.error('Failed to load solver config from localStorage:', error);
            }
        },

        // Save to localStorage
        saveToLocalStorage() {
            try {
                localStorage.setItem(SOLVER_STORAGE_KEYS.SOLVER_EXECUTION_CONFIG, JSON.stringify(this.config));
            } catch (error) {
                console.error('Failed to save solver config to localStorage:', error);
            }
        },

        // Update solver configuration
        updateConfig(timeLimit, debugLevel, outputFolder) {
            this.config.timeLimit = timeLimit;
            this.config.debugLevel = debugLevel;
            this.config.outputFolder = outputFolder;
            this.saveToLocalStorage();
        },

        // Execute solver
        async executeSolver() {
            this.status = 'RUNNING';
            this.progress = 0;
            this.message = 'Starting solver...';
            this.error = null;
            this.results = null;
            this.settingsUsed = null;
            this.elapsedTime = 0;

            try {
                // 1. Prepare Data
                const filesStore = typeof Alpine !== 'undefined' && Alpine.store ? Alpine.store('files') : null;
                const configStore = typeof Alpine !== 'undefined' && Alpine.store ? Alpine.store('config') : null;

                if (!filesStore || !configStore) {
                    this.status = 'FAILED';
                    this.error = { message: "Stores not initialized. Please refresh the page." };
                    return;
                }

                const csvFiles = filesStore.getSolverInputData();
                if (Object.keys(csvFiles).length === 0) {
                    this.status = 'FAILED';
                    this.error = { message: "No input data found. Please import a folder first." };
                    return;
                }

                const folderPath = typeof filesStore.getCurrentFolderPath === 'function'
                    ? filesStore.getCurrentFolderPath()
                    : '';
                const normalizedOutputFolder = this.config.outputFolder || folderPath || null;

                // 2. Prepare Request
                const request = {
                    csv_files: csvFiles,
                    priority_config: configStore.getCurrentConfig(),
                    time_limit: this.config.timeLimit,
                    debug_level: this.config.debugLevel,
                    output_folder: normalizedOutputFolder
                };

                // 3. Execute Solver via API
                const response = await this.executeSolverApi(request);
                this.executionId = response.execution_id;
                this.message = 'Solver execution queued...';

                // 4. Poll for status
                await this.pollStatus();

            } catch (error) {
                this.status = 'FAILED';
                this.error = { message: error.message };
                console.error('Solver execution failed:', error);
            }
        },

         // Execute solver via API (uses apiService)
         async executeSolverApi(solverRequest) {
             try {
                 const response = await window.apiService.executeSolver(solverRequest);
                 if (response.settings_used) {
                     this.settingsUsed = response.settings_used;
                 } else if (window.apiService.getLastCanonicalPriorityConfig) {
                     this.settingsUsed = window.apiService.getLastCanonicalPriorityConfig();
                 }
                 return response;
             } catch (error) {
                 console.error("Error executing solver:", error);
                 throw error;
             }
         },

        // Poll solver status
        async pollStatus() {
            if (this.status !== 'RUNNING') return;

            try {
                const status = await this.getExecutionStatus();
                this.progress = status.progress_percentage;
                this.elapsedTime = status.elapsed_time_seconds ? status.elapsed_time_seconds.toFixed(1) : 0;
                this.message = status.current_phase || 'Running...';

                if (status.status === 'COMPLETED') {
                    this.status = 'COMPLETED';
                    this.message = 'Execution completed!';
                    await this.fetchResults();
                } else if (status.status === 'FAILED' || status.status === 'TIMEOUT') {
                    this.status = 'FAILED';
                    this.error = status.error || { message: 'Execution failed' };
                } else {
                    // Continue polling
                    setTimeout(() => this.pollStatus(), 1000);
                }
            } catch (error) {
                console.error("Polling error", error);
                setTimeout(() => this.pollStatus(), 2000);
            }
        },

         // Get execution status (uses apiService)
         async getExecutionStatus() {
             try {
                 return await window.apiService.getExecutionStatus(this.executionId);
             } catch (error) {
                 console.error("Error getting execution status:", error);
                 throw error;
             }
         },

         // Fetch solver results (uses apiService)
         async fetchResults() {
             try {
                  this.results = await window.apiService.getExecutionResults(this.executionId);

                  if (this.settingsUsed) {
                      const outputFiles = this.results.output_files || {};
                      if (!outputFiles['settings_used.json']) {
                          outputFiles['settings_used.json'] = JSON.stringify(this.settingsUsed, null, 2);
                      }
                      this.results.output_files = outputFiles;
                  }

                  return this.results;
              } catch (error) {
                  console.error("Error getting execution results:", error);
                 this.error = { message: "Failed to fetch results: " + error.message };
                 throw error;
             }
         },

        // Reset solver state
        reset() {
            this.status = 'IDLE';
            this.executionId = null;
            this.progress = 0;
            this.elapsedTime = 0;
            this.message = '';
            this.error = null;
            this.results = null;
            this.settingsUsed = null;
        },

        // Check if solver has results
        hasResults() {
            return this.results !== null;
        },

        // Get solver results
        getResults() {
            return this.results;
        },

        // Check if solver is currently running
        isRunning() {
            return this.status === 'RUNNING';
        },

        // Check if solver has completed successfully
        isCompleted() {
            return this.status === 'COMPLETED';
        },

        // Check if solver has failed
        isFailed() {
            return this.status === 'FAILED';
        }
    });
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SOLVER_STORAGE_KEYS
    };
}
