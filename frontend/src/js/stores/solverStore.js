/**
 * Solver Store - Alpine.js Store for Solver Execution Management
 *
 * Manages solver execution state, progress tracking, and results handling
 * Includes scenario tab management with named scenario queue
 */

// Storage key constants for consistency
const SOLVER_STORAGE_KEYS = {
    SOLVER_EXECUTION_CONFIG: 'ui_v2_exp__solver__executionConfig',
    SOLVER_SCENARIOS: 'ui_v2_exp__solver__scenarios'
};

/**
 * Generate a UUID v4
 * @returns {string} UUID string
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Generate a simple hash of the config object
 * @param {Object} config - Configuration object to hash
 * @returns {string} Hash string
 */
function generateConfigHash(config) {
    try {
        const str = JSON.stringify(config);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16).substring(0, 12);
    } catch (e) {
        return Date.now().toString(36);
    }
}

/**
 * Get status icon based on scenario status
 * @param {string} status - Scenario status
 * @returns {string} Status icon
 */
function getStatusIcon(status) {
    switch (status) {
        case 'QUEUED': return '⏳';
        case 'RUNNING': return '▶';
        case 'COMPLETED': return '✓';
        case 'FAILED': return '⚠';
        default: return '⏳';
    }
}

/**
 * Get status CSS class based on scenario status
 * @param {string} status - Scenario status
 * @returns {string} CSS class name
 */
function getStatusClass(status) {
    switch (status) {
        case 'QUEUED': return 'status-queued';
        case 'RUNNING': return 'status-running';
        case 'COMPLETED': return 'status-completed';
        case 'FAILED': return 'status-failed';
        default: return 'status-queued';
    }
}

document.addEventListener('alpine:init', () => {
    Alpine.store('solver', {
        // Legacy State (for single runs)
        status: 'IDLE', // IDLE, RUNNING, COMPLETED, FAILED
        executionId: null,
        progress: 0,
        elapsedTime: 0,
        message: '',
        error: null,
        isInitialized: false,
        results: null,
        settingsUsed: null,
        config: {
            timeLimit: 300,
            debugLevel: 'INFO',
            outputFolder: ''
        },
        isLoading: false,

        // Scenario Tab Management State
        scenarios: [],
        activeScenarioId: null,
        editingScenarioId: null,
        editingName: '',
        showNewScenarioModal: false,
        newScenarioName: '',
        configChangedWarning: null,
        configChangedScenario: null,

        // Batch Execution State
        batchExecution: {
            isRunning: false,
            totalScenarios: 0,
            completedScenarios: 0,
            currentScenarioId: null,
            stopOnError: true,
            shouldCancel: false,
            errors: []
        },

        // SSE/EventSource State
        activeEventSource: null,
        activePollInterval: null,

        // Initialization
        init() {
            try {
                if (this.isInitialized) {
                    console.log('[solverStore] Already initialized, skipping');
                    return;
                }
                console.log('Solver store initialized');
                this.loadScenariosFromLocalStorage();
                
                // Set first scenario as active if exists
                if (this.scenarios.length > 0 && !this.activeScenarioId) {
                    this.activeScenarioId = this.scenarios[0].id;
                }
                
                this.isInitialized = true;
            } catch (error) {
                console.error('SolverStore init failed:', error);
                this.error = 'Failed to initialize solver storage';
            }
        },

        // ============================================================================
        // SCENARIO TAB MANAGEMENT
        // ============================================================================

        /**
         * Load scenarios from localStorage
         */
        loadScenariosFromLocalStorage() {
            try {
                const savedScenarios = localStorage.getItem(SOLVER_STORAGE_KEYS.SOLVER_SCENARIOS);
                if (savedScenarios) {
                    this.scenarios = JSON.parse(savedScenarios);
                    console.log('[solverStore] Loaded scenarios:', this.scenarios.length);
                } else {
                    // Create a default scenario if none exist
                    this.createDefaultScenario();
                }
            } catch (error) {
                console.error('Failed to load scenarios from localStorage:', error);
                this.scenarios = [];
            }
        },

        /**
         * Save scenarios to localStorage
         */
        saveScenariosToLocalStorage() {
            try {
                // Only store metadata, not full config snapshots
                const scenariosToSave = this.scenarios.map(s => ({
                    ...s,
                    // Don't store full config, just the hash
                    configSnapshot: undefined
                }));
                localStorage.setItem(SOLVER_STORAGE_KEYS.SOLVER_SCENARIOS, JSON.stringify(scenariosToSave));
            } catch (error) {
                console.error('Failed to save scenarios to localStorage:', error);
            }
        },

        /**
         * Alias for saveScenariosToLocalStorage (for template compatibility)
         */
        saveToLocalStorage() {
            this.saveScenariosToLocalStorage();
        },

        /**
         * Create a default scenario when none exist
         */
        createDefaultScenario() {
            const currentConfig = this.getCurrentConfigHash();
            const newScenario = {
                id: generateUUID(),
                name: 'Run 1',
                createdAt: Date.now(),
                status: 'QUEUED',
                runId: null,
                configHash: currentConfig
            };
            this.scenarios = [newScenario];
            this.activeScenarioId = newScenario.id;
            this.saveScenariosToLocalStorage();
        },

        /**
         * Get current config hash from the config store
         * @returns {string} Config hash
         */
        getCurrentConfigHash() {
            // Get config from config store
            if (typeof Alpine !== 'undefined' && Alpine.store('config')) {
                const configStore = Alpine.store('config');
                const currentConfig = configStore.getCurrentConfig ? configStore.getCurrentConfig() : configStore.config;
                return generateConfigHash(currentConfig);
            }
            return 'default';
        },

        /**
         * Open modal to create a new scenario
         */
        openNewScenarioModal() {
            console.log('[solverStore] Opening new scenario modal, scenarios count:', this.scenarios.length);
            this.newScenarioName = `Run ${this.scenarios.length + 1}`;
            this.showNewScenarioModal = true;
            console.log('[solverStore] showNewScenarioModal set to:', this.showNewScenarioModal);
            
            // Focus input after modal opens
            setTimeout(() => {
                const input = document.getElementById('new-scenario-name');
                console.log('[solverStore] Focus attempt, input found:', !!input);
                if (input) {
                    input.focus();
                    input.select();
                }
            }, 50);
        },

        /**
         * Close the new scenario modal
         */
        closeNewScenarioModal() {
            this.showNewScenarioModal = false;
            this.newScenarioName = '';
        },

        /**
         * Create a new scenario
         * @param {string} name - Scenario name
         * @returns {Object} Created scenario
         */
        createNewScenario(name) {
            console.log('[solverStore] createNewScenario called with:', name);
            const trimmedName = name ? name.trim() : '';
            if (!trimmedName) {
                console.warn('[solverStore] Cannot create scenario with empty name');
                return null;
            }

            const currentConfig = this.getCurrentConfigHash();
            console.log('[solverStore] Config hash:', currentConfig);
            
            const newScenario = {
                id: generateUUID(),
                name: trimmedName,
                createdAt: Date.now(),
                status: 'QUEUED',
                runId: null,
                configHash: currentConfig
            };

            console.log('[solverStore] Adding scenario to array, current length:', this.scenarios.length);
            this.scenarios.push(newScenario);
            console.log('[solverStore] New array length:', this.scenarios.length);
            
            this.activeScenarioId = newScenario.id;
            this.saveScenariosToLocalStorage();
            this.closeNewScenarioModal();
            
            console.log('[solverStore] Created new scenario:', newScenario);
            return newScenario;
        },

        /**
         * Duplicate an existing scenario
         * @param {string} scenarioId - ID of scenario to duplicate
         */
        duplicateScenario(scenarioId) {
            const scenario = this.scenarios.find(s => s.id === scenarioId);
            if (!scenario) return null;

            const currentConfig = this.getCurrentConfigHash();
            const newScenario = {
                id: generateUUID(),
                name: `${scenario.name} (Copy)`,
                createdAt: Date.now(),
                status: 'QUEUED',
                runId: null,
                configHash: currentConfig
            };

            this.scenarios.push(newScenario);
            this.activeScenarioId = newScenario.id;
            this.saveScenariosToLocalStorage();
            return newScenario;
        },

        /**
         * Delete a scenario
         * @param {string} scenarioId - ID of scenario to delete
         * @returns {boolean} Success
         */
        deleteScenario(scenarioId) {
            if (this.scenarios.length <= 1) {
                // Don't allow deleting the last scenario
                console.warn('[solverStore] Cannot delete the last scenario');
                return false;
            }

            const scenario = this.getScenario(scenarioId);
            if (!scenario) return false;

            // If running, warn the user
            if (scenario.status === 'RUNNING') {
                const confirmed = confirm('This scenario is currently running. Delete anyway?');
                if (!confirmed) return false;
            }

            this.scenarios = this.scenarios.filter(s => s.id !== scenarioId);
            
            // Switch to another scenario if this was active
            if (this.activeScenarioId === scenarioId) {
                this.activeScenarioId = this.scenarios.length > 0 ? this.scenarios[0].id : null;
            }

            this.saveScenariosToLocalStorage();
            console.log('[solverStore] Deleted scenario:', scenarioId);
            return true;
        },

        /**
         * Start editing a scenario name
         * @param {string} scenarioId - ID of scenario to edit
         * @param {string} currentName - Current name of the scenario
         */
        startEditingScenarioName(scenarioId, currentName) {
            this.editingScenarioId = scenarioId;
            this.editingName = currentName;
        },

        /**
         * Save the edited scenario name (finish editing)
         */
        finishEditingScenarioName() {
            if (!this.editingScenarioId || !this.editingName?.trim()) {
                this.cancelEditingScenarioName();
                return;
            }
            
            const scenario = this.getScenario(this.editingScenarioId);
            if (scenario) {
                scenario.name = this.editingName.trim();
                this.saveScenariosToLocalStorage();
            }
            
            this.editingScenarioId = null;
            this.editingName = '';
        },

        /**
         * Cancel editing a scenario name
         */
        cancelEditingScenarioName() {
            this.editingScenarioId = null;
            this.editingName = '';
        },

        /**
         * Switch to a scenario (set as active)
         * @param {string} scenarioId - ID of scenario to activate
         */
        switchToScenario(scenarioId) {
            this.activeScenarioId = scenarioId;
            
            // Check if config has changed
            const scenario = this.getScenario(scenarioId);
            if (scenario && scenario.configHash) {
                const currentHash = this.getCurrentConfigHash();
                if (scenario.configHash !== currentHash && scenario.status !== 'RUNNING') {
                    this.configChangedWarning = true;
                    this.configChangedScenario = scenarioId;
                } else {
                    this.configChangedWarning = false;
                    this.configChangedScenario = null;
                }
            }
        },

        /**
         * Remove a scenario
         * @param {string} scenarioId - ID of scenario to remove
         */
        removeScenario(scenarioId) {
            if (this.scenarios.length <= 1) {
                alert('Cannot remove the last scenario');
                return;
            }
            
            const scenario = this.getScenario(scenarioId);
            if (!scenario) return;
            
            if (scenario.status === 'RUNNING') {
                if (!confirm('This scenario is currently running. Remove anyway?')) return;
                // Try to stop it first
                this.stopScenario(scenarioId).catch(() => {});
            }
            
            this.scenarios = this.scenarios.filter(s => s.id !== scenarioId);
            
            // Switch to another scenario if this was active
            if (this.activeScenarioId === scenarioId && this.scenarios.length > 0) {
                this.activeScenarioId = this.scenarios[0].id;
            }
            
            this.saveScenariosToLocalStorage();
        },

        /**
         * Dismiss config changed warning
         */
        dismissConfigWarning() {
            this.configChangedWarning = false;
            this.configChangedScenario = null;
        },

        /**
         * Update scenario config to current
         * @param {string} scenarioId - Scenario ID to update
         */
        updateScenarioConfig(scenarioId) {
            const scenario = this.getScenario(scenarioId);
            if (scenario) {
                scenario.configHash = this.getCurrentConfigHash();
                this.saveScenariosToLocalStorage();
                this.dismissConfigWarning();
            }
        },

        /**
         * Clear completed scenarios
         */
        clearCompletedScenarios() {
            const hasRunning = this.scenarios.some(s => s.status === 'RUNNING');
            if (hasRunning) {
                if (!confirm('Some scenarios are still running. Clear completed ones anyway?')) return;
            }
            
            const remaining = this.scenarios.filter(s => s.status !== 'COMPLETED');
            this.scenarios = remaining;
            
            if (this.activeScenarioId && !this.scenarios.find(s => s.id === this.activeScenarioId)) {
                this.activeScenarioId = this.scenarios.length > 0 ? this.scenarios[0].id : null;
            }
            
            this.saveScenariosToLocalStorage();
        },

        /**
         * Stop a running scenario
         * @param {string} scenarioId - Scenario ID to stop
         */
        async stopScenario(scenarioId) {
            const scenario = this.getScenario(scenarioId);
            if (!scenario || scenario.status !== 'RUNNING') return;
            
            try {
                // Call API to stop
                if (scenario.runId) {
                    await window.apiService.stopRender(scenario.runId);
                }
                
                scenario.status = 'QUEUED';
                scenario.runId = null;
                this.saveScenariosToLocalStorage();
            } catch (error) {
                console.error('[solverStore] Failed to stop scenario:', error);
            }
        },

        /**
         * Get a scenario by ID
         * @param {string} scenarioId - Scenario ID
         * @returns {Object|undefined} Scenario object
         */
        getScenario(scenarioId) {
            return this.scenarios.find(s => s.id === scenarioId);
        },

        /**
         * Get the active scenario
         * @returns {Object|undefined} Active scenario
         */
        getActiveScenario() {
            return this.getScenario(this.activeScenarioId);
        },

        /**
         * Check if config has changed since scenario was created
         * @param {string} scenarioId - Scenario ID to check
         * @returns {boolean} True if config has changed
         */
        hasConfigChanged(scenarioId) {
            const scenario = this.getScenario(scenarioId);
            if (!scenario || !scenario.configHash) return false;
            
            const currentConfig = this.getCurrentConfigHash();
            return scenario.configHash !== currentConfig && scenario.status === 'QUEUED';
        },

        /**
         * Update scenario config hash to current
         * @param {string} scenarioId - Scenario ID to update
         */
        updateScenarioConfigToCurrent(scenarioId) {
            const scenario = this.getScenario(scenarioId);
            if (scenario) {
                scenario.configHash = this.getCurrentConfigHash();
                this.saveScenariosToLocalStorage();
                this.configChangedWarning = null;
                this.configChangedScenario = null;
            }
        },

        /**
         * Show config changed warning
         * @param {string} scenarioId - Scenario ID
         */
        showConfigChangedWarning(scenarioId) {
            const scenario = this.getScenario(scenarioId);
            if (scenario) {
                this.configChangedScenario = scenario;
                this.configChangedWarning = `Config has changed since "${scenario.name}" was created. Run with current config or keep original config?`;
            }
        },

        /**
         * Dismiss config changed warning
         */
        dismissConfigChangedWarning() {
            this.configChangedWarning = null;
            this.configChangedScenario = null;
        },

        /**
         * Run a specific scenario
         * @param {string} scenarioId - Scenario ID to run
         */
        async runScenario(scenarioId) {
            const scenario = this.getScenario(scenarioId);
            if (!scenario) {
                console.error('[solverStore] Scenario not found:', scenarioId);
                return;
            }

            // Check if config has changed
            if (this.hasConfigChanged(scenarioId)) {
                this.showConfigChangedWarning(scenarioId);
                return;
            }

            // Update scenario status
            scenario.status = 'RUNNING';
            scenario.runId = null;
            this.saveScenariosToLocalStorage();

            try {
                // Call the executeSolver logic with scenario ID
                await this.executeScenarioSolver(scenarioId);
            } catch (error) {
                console.error('[solverStore] Failed to run scenario:', error);
                scenario.status = 'FAILED';
                scenario.error = error.message || 'Execution failed';
                this.saveScenariosToLocalStorage();
            }
        },

        /**
         * Execute solver for a specific scenario
         * @param {string} scenarioId - Scenario ID
         */
        async executeScenarioSolver(scenarioId) {
            const scenario = this.getScenario(scenarioId);
            if (!scenario) return;

            // Set legacy state for UI compatibility
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
                    scenario.status = 'FAILED';
                    scenario.error = 'Stores not initialized. Please refresh the page.';
                    this.status = 'FAILED';
                    this.error = { message: scenario.error };
                    return;
                }

                const csvFiles = filesStore.getSolverInputData();
                if (Object.keys(csvFiles).length === 0) {
                    scenario.status = 'FAILED';
                    scenario.error = 'No input data found. Please import a folder first.';
                    this.status = 'FAILED';
                    this.error = { message: scenario.error };
                    return;
                }

                const folderPath = typeof filesStore.getCurrentFolderPath === 'function'
                    ? filesStore.getCurrentFolderPath()
                    : '';
                const normalizedOutputFolder = this.config.outputFolder || folderPath || null;

                // 2. Prepare Request
                const request = {
                    csv_files: csvFiles,
                    priority_config: configStore.getCurrentConfig ? configStore.getCurrentConfig() : configStore.config,
                    time_limit: this.config.timeLimit,
                    debug_level: this.config.debugLevel,
                    output_folder: normalizedOutputFolder,
                    scenario_id: scenarioId,
                    scenario_name: scenario.name
                };

                // 3. Execute Solver via API
                const response = await this.executeSolverApi(request);
                this.executionId = response.execution_id;
                scenario.runId = this.executionId;
                this.message = 'Solver execution queued...';

                // 4. Poll for status
                await this.pollScenarioStatus(scenarioId);

            } catch (error) {
                scenario.status = 'FAILED';
                scenario.error = error.message || 'Execution failed';
                this.status = 'FAILED';
                this.error = { message: scenario.error };
                this.saveScenariosToLocalStorage();
                console.error('Scenario execution failed:', error);
            }
        },

        /**
         * Poll status for a specific scenario
         * @param {string} scenarioId - Scenario ID
         */
        async pollScenarioStatus(scenarioId) {
            const scenario = this.getScenario(scenarioId);
            if (!scenario || scenario.status !== 'RUNNING') return;

            try {
                const status = await this.getExecutionStatus();
                
                // Update both legacy state and scenario state
                this.progress = status.progress_percentage;
                this.elapsedTime = status.elapsed_time_seconds ? status.elapsed_time_seconds.toFixed(1) : 0;
                this.message = status.current_phase || 'Running...';

                if (status.status === 'COMPLETED') {
                    scenario.status = 'COMPLETED';
                    scenario.completedAt = Date.now();
                    this.status = 'COMPLETED';
                    this.message = 'Execution completed!';
                    await this.fetchResults();
                    scenario.results = this.results;
                    
                    // Auto-switch to output tab on completion
                    document.dispatchEvent(new CustomEvent('switchTab', {
                        detail: { tab: 'output_data' }
                    }));
                    
                } else if (status.status === 'FAILED' || status.status === 'TIMEOUT') {
                    scenario.status = 'FAILED';
                    scenario.error = status.error || 'Execution failed';
                    this.status = 'FAILED';
                    this.error = { message: scenario.error };
                } else {
                    // Continue polling
                    setTimeout(() => this.pollScenarioStatus(scenarioId), 1000);
                    return;
                }
                
                this.saveScenariosToLocalStorage();
                
            } catch (error) {
                console.error('[solverStore] Polling error:', error);
                // Continue polling on error
                setTimeout(() => this.pollScenarioStatus(scenarioId), 2000);
            }
        },

        /**
         * Run all queued scenarios sequentially with batch tracking
         * @param {boolean} stopOnError - Whether to stop on first error
         */
        async runAllScenarios(stopOnError = true) {
            const queuedScenarios = this.scenarios.filter(s => s.status === 'QUEUED');
            
            if (queuedScenarios.length === 0) {
                console.log('[solverStore] No queued scenarios to run');
                return;
            }

            // Initialize batch execution state
            this.batchExecution = {
                isRunning: true,
                totalScenarios: queuedScenarios.length,
                completedScenarios: 0,
                currentScenarioId: null,
                stopOnError: stopOnError,
                shouldCancel: false,
                errors: []
            };

            console.log(`[solverStore] Starting batch execution of ${queuedScenarios.length} scenarios`);

            for (const scenario of queuedScenarios) {
                // Check if should cancel
                if (this.batchExecution.shouldCancel) {
                    console.log('[solverStore] Batch execution cancelled');
                    break;
                }

                // Update current scenario
                this.batchExecution.currentScenarioId = scenario.id;
                
                // Update scenario status to RUNNING
                scenario.status = 'RUNNING';
                scenario.runId = null;
                scenario.error = null;
                this.saveScenariosToLocalStorage();

                try {
                    console.log(`[solverStore] Running scenario: ${scenario.name} (${scenario.id})`);
                    
                    // Execute the scenario
                    await this.executeScenarioSolver(scenario.id);
                    
                    // Wait for completion by polling
                    await this.waitForScenarioCompletion(scenario.id);
                    
                    // Update scenario status based on result
                    const updatedScenario = this.getScenario(scenario.id);
                    if (updatedScenario.status === 'FAILED') {
                        this.batchExecution.errors.push({
                            scenarioId: scenario.id,
                            scenarioName: scenario.name,
                            message: updatedScenario.error || 'Unknown error'
                        });
                        
                        if (this.batchExecution.stopOnError) {
                            console.log('[solverStore] Stopping batch execution due to error');
                            break;
                        }
                    }
                    
                } catch (error) {
                    console.error(`[solverStore] Scenario ${scenario.name} failed:`, error);
                    scenario.status = 'FAILED';
                    scenario.error = error.message || 'Execution failed';
                    this.batchExecution.errors.push({
                        scenarioId: scenario.id,
                        scenarioName: scenario.name,
                        message: error.message || 'Execution failed'
                    });
                    this.saveScenariosToLocalStorage();
                    
                    if (this.batchExecution.stopOnError) {
                        break;
                    }
                }

                // Increment completed count
                this.batchExecution.completedScenarios++;
                console.log(`[solverStore] Completed ${this.batchExecution.completedScenarios}/${this.batchExecution.totalScenarios}`);
                
                // Small delay between scenarios
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Mark batch as complete
            this.batchExecution.isRunning = false;
            this.batchExecution.currentScenarioId = null;
            console.log('[solverStore] Batch execution completed');
            
            // Auto-switch to output tab if any scenarios completed successfully
            const hasCompleted = this.scenarios.some(s => s.status === 'COMPLETED');
            if (hasCompleted) {
                document.dispatchEvent(new CustomEvent('switchTab', {
                    detail: { tab: 'output_data' }
                }));
            }
        },

        /**
         * Wait for a scenario to complete execution
         * @param {string} scenarioId - Scenario ID
         * @returns {Promise<void>}
         */
        async waitForScenarioCompletion(scenarioId) {
            const maxAttempts = 600; // 10 minutes at 1 second intervals
            let attempts = 0;
            
            while (attempts < maxAttempts) {
                const scenario = this.getScenario(scenarioId);
                
                if (!scenario) {
                    throw new Error('Scenario not found during execution');
                }
                
                if (scenario.status === 'COMPLETED' || scenario.status === 'FAILED') {
                    return;
                }
                
                // Check for cancellation
                if (this.batchExecution.shouldCancel) {
                    return;
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                attempts++;
            }
            
            throw new Error('Scenario execution timeout');
        },

        /**
         * Cancel batch execution
         */
        cancelBatchExecution() {
            if (this.batchExecution.isRunning) {
                console.log('[solverStore] Cancelling batch execution...');
                this.batchExecution.shouldCancel = true;
            }
        },

        /**
         * Run all queued scenarios (legacy method)
         */
        async runAllQueued() {
            await this.runAllScenarios(true);
        },

        /**
         * Reset a scenario to QUEUED status
         * @param {string} scenarioId - Scenario ID
         */
        resetScenario(scenarioId) {
            const scenario = this.getScenario(scenarioId);
            if (scenario && confirm('Reset this scenario? This will clear its results.')) {
                scenario.status = 'QUEUED';
                scenario.runId = null;
                scenario.error = null;
                scenario.results = null;
                // Update config hash to current
                scenario.configHash = this.getCurrentConfigHash();
                this.saveScenariosToLocalStorage();
            }
        },

        /**
         * Get formatted date for a scenario
         * @param {number} timestamp - Unix timestamp
         * @returns {string} Formatted date string
         */
        getFormattedDate(timestamp) {
            if (!timestamp) return '';
            const date = new Date(timestamp);
            return date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        },

        // ============================================================================
        // LEGACY SINGLE RUN METHODS (for backward compatibility)
        // ============================================================================

        // Execute solver
        async executeSolver() {
            // Get or create an active scenario
            let scenario = this.getActiveScenario();
            if (!scenario) {
                scenario = this.createNewScenario('Run');
                this.activeScenarioId = scenario.id;
            }
            
            await this.runScenario(scenario.id);
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
            
            // Find the running scenario
            const runningScenario = this.scenarios.find(s => s.status === 'RUNNING');
            if (runningScenario) {
                await this.pollScenarioStatus(runningScenario.id);
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
        },

        // Update solver configuration
        updateConfig(timeLimit, debugLevel, outputFolder) {
            this.config.timeLimit = timeLimit;
            this.config.debugLevel = debugLevel;
            this.config.outputFolder = outputFolder;
        }
    });
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SOLVER_STORAGE_KEYS,
        generateUUID,
        generateConfigHash,
        getStatusIcon,
        getStatusClass
    };
}
