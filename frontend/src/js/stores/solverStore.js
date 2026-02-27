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
        case 'CANCELLED': return '⏹';
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
        case 'CANCELLED': return 'status-failed';
        case 'FAILED': return 'status-failed';
        default: return 'status-queued';
    }
}

function downloadJsonFile(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}

function buildExecutionStatusError(statusPayload, fallbackMessage = 'Execution failed') {
    const rawError = statusPayload?.error;
    if (!rawError) {
        return new Error(fallbackMessage);
    }

    if (typeof rawError === 'string') {
        return new Error(rawError);
    }

    const message = rawError.message || fallbackMessage;
    const error = new Error(message);
    error.code = rawError.error_code || rawError.code || null;
    error.guidance = rawError.guidance || '';
    error.debug = {
        detail: rawError.details ? JSON.stringify(rawError.details, null, 2) : message
    };
    return error;
}

function validateSolverInputResourceAssignments(inputData) {
    const tables = inputData?.tables || {};
    const testsTable = tables.tests;
    if (!testsTable || !Array.isArray(testsTable.headers) || !Array.isArray(testsTable.rows)) {
        return [];
    }

    const headers = testsTable.headers.map((header) => String(header || '').trim().toLowerCase());
    const idx = {
        testId: headers.indexOf('test_id'),
        fteRequired: headers.indexOf('fte_required'),
        equipmentRequired: headers.indexOf('equipment_required'),
        fteAssigned: headers.indexOf('fte_assigned'),
        equipmentAssigned: headers.indexOf('equipment_assigned')
    };

    if (
        idx.fteRequired < 0 ||
        idx.equipmentRequired < 0 ||
        idx.fteAssigned < 0 ||
        idx.equipmentAssigned < 0
    ) {
        return [];
    }

    const problems = [];
    testsTable.rows.forEach((row) => {
        if (!Array.isArray(row)) {
            return;
        }
        const testId = idx.testId >= 0 ? String(row[idx.testId] || '').trim() : '';
        const fteRequired = Number(row[idx.fteRequired] ?? 0);
        const equipmentRequired = Number(row[idx.equipmentRequired] ?? 0);
        const fteAssigned = String(row[idx.fteAssigned] ?? '').trim();
        const equipmentAssigned = String(row[idx.equipmentAssigned] ?? '').trim();

        const fteMissing =
            Number.isFinite(fteRequired) &&
            fteRequired > 0 &&
            (!fteAssigned || fteAssigned === '*' || fteAssigned.includes('fte_unassigned'));
        const equipmentMissing =
            Number.isFinite(equipmentRequired) &&
            equipmentRequired > 0 &&
            (!equipmentAssigned || equipmentAssigned === '*' || equipmentAssigned.includes('setup_unassigned'));

        if (fteMissing || equipmentMissing) {
            problems.push({
                testId: testId || '(unknown_test)',
                fteRequired,
                equipmentRequired,
                fteAssigned,
                equipmentAssigned
            });
        }
    });

    return problems;
}

function validateLegDeadlinePenaltyConfiguration(priorityConfig) {
    const config = priorityConfig || {};
    const legDeadlines =
        config.leg_deadlines ||
        config.legDeadlines ||
        config.legEndDeadlines ||
        {};
    const legDeadlinePenalties =
        config.leg_deadline_penalties ||
        config.legDeadlinePenalties ||
        {};

    if (!legDeadlinePenalties || typeof legDeadlinePenalties !== 'object') {
        return [];
    }

    const missingDeadlineLegs = [];
    Object.entries(legDeadlinePenalties).forEach(([legId, penalty]) => {
        const numericPenalty = Number(penalty);
        if (!Number.isFinite(numericPenalty) || numericPenalty <= 0) {
            return;
        }
        const hasDeadline = Object.prototype.hasOwnProperty.call(legDeadlines, legId) &&
            String(legDeadlines[legId] || '').trim().length > 0;
        if (!hasDeadline) {
            missingDeadlineLegs.push(legId);
        }
    });

    return missingDeadlineLegs;
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
            outputFolder: '',
            plotUpdateInterval: 2
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
        progressTimeline: [],
        lastPlotUpdateTime: null,
        plotUpdateCounter: 0,

        // Initialization
        init() {
            try {
                if (this.isInitialized) {
                    console.log('[solverStore] Already initialized, skipping');
                    return;
                }
                console.log('Solver store initialized');
                this.loadExecutionConfigFromLocalStorage();
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

        formatUiError(error, fallbackMessage = 'Execution failed') {
            if (typeof window !== 'undefined' &&
                window.apiService &&
                typeof window.apiService.toUiError === 'function') {
                return window.apiService.toUiError(error, fallbackMessage);
            }
            return {
                message: error?.message || fallbackMessage,
                guidance: '',
                debug: ''
            };
        },

        normalizeSolverStatus(status) {
            const normalized = String(status || 'UNKNOWN').toUpperCase();
            const isNoPlan = normalized === 'INFEASIBLE' || normalized === 'NO_SOLUTION';
            return {
                code: normalized,
                isNoPlan,
                label: normalized.replace(/_/g, ' ')
            };
        },

        getResultStatusLabel(result) {
            return this.normalizeSolverStatus(result?.status).label;
        },

        getResultObjective(result) {
            const value = result?.solver_stats?.objective_value;
            if (typeof value !== 'number' || Number.isNaN(value)) {
                return null;
            }
            return value;
        },

        getResultSolveTimeSeconds(result) {
            const value = result?.solver_stats?.solve_time;
            if (typeof value !== 'number' || Number.isNaN(value)) {
                return null;
            }
            return value;
        },

        getResultTestsScheduled(result) {
            const schedules = result?.test_schedule;
            return Array.isArray(schedules) ? schedules.length : 0;
        },

        buildCompletionMessage(results) {
            const normalized = this.normalizeSolverStatus(results?.status);
            if (normalized.isNoPlan) {
                return `Execution completed: ${normalized.label}. No feasible schedule was found for current constraints.`;
            }
            return `Execution completed: ${normalized.label}.`;
        },

        buildResultDetails(results) {
            const normalized = this.normalizeSolverStatus(results?.status);
            const testsScheduled = this.getResultTestsScheduled(results);
            const objectiveValue = this.getResultObjective(results);
            const solveTime = this.getResultSolveTimeSeconds(results);
            return {
                solverStatus: normalized.code,
                solverStatusLabel: normalized.label,
                isNoPlan: normalized.isNoPlan,
                testsScheduled,
                objectiveValue,
                solveTimeSeconds: solveTime,
                hasOutputFiles: Object.keys(results?.output_files || {}).length > 0
            };
        },

        async completeScenarioWithResults(scenario) {
            scenario.status = 'COMPLETED';
            scenario.completedAt = Date.now();
            scenario.error = null;
            this.status = 'COMPLETED';
            await this.fetchResults();
            scenario.results = this.results;
            scenario.resultDetails = this.buildResultDetails(this.results);
            this.message = this.buildCompletionMessage(this.results);
        },

        async completeCancelledScenarioWithResults(scenario) {
            scenario.status = 'CANCELLED';
            scenario.completedAt = Date.now();
            scenario.error = null;
            this.status = 'CANCELLED';

            try {
                this.results = await window.apiService.getExecutionResultsWithOptions(this.executionId, { includePartial: true });
            } catch (error) {
                console.error('Error getting cancelled execution partial results:', error);
                this.results = null;
            }

            if (this.results) {
                scenario.results = this.results;
                scenario.resultDetails = this.buildResultDetails(this.results);
                const normalized = this.normalizeSolverStatus(this.results?.status);
                this.message = `Execution cancelled. Latest plan preserved (${normalized.label}).`;
            } else {
                scenario.resultDetails = null;
                this.message = 'Execution cancelled.';
            }
        },

        // ============================================================================
        // SCENARIO TAB MANAGEMENT
        // ============================================================================

        /**
         * Load execution config from localStorage
         */
        loadExecutionConfigFromLocalStorage() {
            try {
                const savedConfig = localStorage.getItem(SOLVER_STORAGE_KEYS.SOLVER_EXECUTION_CONFIG);
                if (!savedConfig) {
                    return;
                }
                const parsed = JSON.parse(savedConfig);
                if (parsed?.config && typeof parsed.config === 'object') {
                    this.config = { ...this.config, ...parsed.config };
                }
                if (typeof parsed?.activeScenarioId === 'string') {
                    this.activeScenarioId = parsed.activeScenarioId;
                }
            } catch (error) {
                console.error('Failed to load solver execution config from localStorage:', error);
            }
        },

        /**
         * Save execution config to localStorage
         */
        saveExecutionConfigToLocalStorage() {
            try {
                const persisted = {
                    config: this.config,
                    activeScenarioId: this.activeScenarioId
                };
                localStorage.setItem(SOLVER_STORAGE_KEYS.SOLVER_EXECUTION_CONFIG, JSON.stringify(persisted));
            } catch (error) {
                console.error('Failed to save solver execution config to localStorage:', error);
            }
        },

        /**
         * Load scenarios from localStorage
         */
        loadScenariosFromLocalStorage() {
            try {
                const savedScenarios = localStorage.getItem(SOLVER_STORAGE_KEYS.SOLVER_SCENARIOS);
                if (savedScenarios) {
                    const parsed = JSON.parse(savedScenarios);
                    this.scenarios = Array.isArray(parsed)
                        ? parsed.map((scenario) => this.normalizeScenarioShape(scenario))
                        : [];
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
                localStorage.setItem(SOLVER_STORAGE_KEYS.SOLVER_SCENARIOS, JSON.stringify(this.scenarios));
            } catch (error) {
                console.error('Failed to save scenarios to localStorage:', error);
            }
        },

        /**
         * Alias for saveScenariosToLocalStorage (for template compatibility)
         */
        saveToLocalStorage() {
            this.saveScenariosToLocalStorage();
            this.saveExecutionConfigToLocalStorage();
        },

        /**
         * Create a default scenario when none exist
         */
        createDefaultScenario() {
            const currentConfig = this.getCurrentConfigHash();
            const configSnapshot = this.captureCurrentConfigSnapshot();
            const dataSnapshot = this.captureCurrentDataSnapshot();
            const newScenario = {
                id: generateUUID(),
                name: 'Run 1',
                createdAt: Date.now(),
                status: 'QUEUED',
                runId: null,
                configHash: currentConfig,
                configSnapshot,
                dataSnapshot,
                liveSchedule: [],
                liveScheduleHash: null,
                liveScheduleUpdatedAt: null,
                liveResults: null
            };
            this.scenarios = [newScenario];
            this.activeScenarioId = newScenario.id;
            this.saveScenariosToLocalStorage();
        },

        normalizeScenarioShape(scenario) {
            return {
                ...scenario,
                liveSchedule: Array.isArray(scenario?.liveSchedule) ? scenario.liveSchedule : [],
                liveScheduleHash: scenario?.liveScheduleHash || null,
                liveScheduleUpdatedAt: scenario?.liveScheduleUpdatedAt || null,
                liveResults: scenario?.liveResults || null
            };
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
            const configSnapshot = this.captureCurrentConfigSnapshot();
            const dataSnapshot = this.captureCurrentDataSnapshot();
            console.log('[solverStore] Config hash:', currentConfig);
            
            const newScenario = {
                id: generateUUID(),
                name: trimmedName,
                createdAt: Date.now(),
                status: 'QUEUED',
                runId: null,
                configHash: currentConfig,
                configSnapshot,
                dataSnapshot,
                liveSchedule: [],
                liveScheduleHash: null,
                liveScheduleUpdatedAt: null,
                liveResults: null
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
                configHash: currentConfig,
                configSnapshot: scenario.configSnapshot || this.captureCurrentConfigSnapshot(),
                dataSnapshot: scenario.dataSnapshot || this.captureCurrentDataSnapshot(),
                liveSchedule: [],
                liveScheduleHash: null,
                liveScheduleUpdatedAt: null,
                liveResults: null
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

        captureCurrentConfigSnapshot() {
            const configStore = typeof Alpine !== 'undefined' && Alpine.store ? Alpine.store('config') : null;
            if (!configStore) {
                return null;
            }
            if (typeof configStore.getRunConfigSnapshot === 'function') {
                return configStore.getRunConfigSnapshot();
            }
            return configStore.getCurrentConfig ? configStore.getCurrentConfig() : configStore.config;
        },

        captureCurrentDataSnapshot() {
            const filesStore = typeof Alpine !== 'undefined' && Alpine.store ? Alpine.store('files') : null;
            if (!filesStore || typeof filesStore.getActiveCsvSnapshot !== 'function') {
                return null;
            }
            return filesStore.getActiveCsvSnapshot();
        },

        isDebugModeEnabled() {
            return String(this.config?.debugLevel || '').toUpperCase() === 'DEBUG';
        },

        captureDebugSolverRequestPayload(scenarioId) {
            const scenario = this.getScenario(scenarioId);
            if (!scenario) {
                return false;
            }
            if (!this.isDebugModeEnabled()) {
                scenario.lastSolverRequest = null;
                this.saveScenariosToLocalStorage();
                return false;
            }

            const apiService = typeof window !== 'undefined' ? window.apiService : null;
            const payload = apiService?.getLastExecuteSolverPayload
                ? apiService.getLastExecuteSolverPayload()
                : null;
            if (!payload) {
                return false;
            }

            scenario.lastSolverRequest = {
                capturedAt: new Date().toISOString(),
                payload
            };
            this.saveScenariosToLocalStorage();
            return true;
        },

        prepareDebugSolverRequestPayload(scenarioId, solverRequest) {
            const scenario = this.getScenario(scenarioId);
            if (!scenario) {
                return false;
            }
            if (!this.isDebugModeEnabled()) {
                scenario.lastSolverRequest = null;
                this.saveScenariosToLocalStorage();
                return false;
            }

            const apiService = typeof window !== 'undefined' ? window.apiService : null;
            let payload = null;
            if (apiService?.buildExecuteSolverPayload) {
                payload = apiService.buildExecuteSolverPayload(solverRequest);
            } else if (apiService?.getLastExecuteSolverPayload) {
                payload = apiService.getLastExecuteSolverPayload();
            }
            if (!payload) {
                return false;
            }

            scenario.lastSolverRequest = {
                capturedAt: new Date().toISOString(),
                payload: JSON.parse(JSON.stringify(payload))
            };
            this.saveScenariosToLocalStorage();
            return true;
        },

        downloadScenarioSolverRequest(scenarioId) {
            const scenario = this.getScenario(scenarioId);
            const requestArtifact = scenario?.lastSolverRequest;
            if (!requestArtifact?.payload) {
                this.error = this.formatUiError(
                    new Error('No saved solver request payload for this run. Re-run with DEBUG level.'),
                    'No saved solver request payload for this run. Re-run with DEBUG level.'
                );
                return false;
            }

            const safeName = String(scenario.name || 'scenario')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_+|_+$/g, '');
            const timestamp = new Date(requestArtifact.capturedAt || Date.now())
                .toISOString()
                .replace(/[:.]/g, '-');
            const filename = `solver_request_${safeName || 'scenario'}_${timestamp}.json`;
            downloadJsonFile(filename, requestArtifact.payload);
            return true;
        },

        updateScenarioConfigSnapshot(scenarioId) {
            const scenario = this.getScenario(scenarioId);
            if (!scenario) return false;
            scenario.configSnapshot = this.captureCurrentConfigSnapshot();
            scenario.configHash = this.getCurrentConfigHash();
            scenario.snapshotUpdatedAt = Date.now();
            this.message = `Updated config snapshot for ${scenario.name}`;
            this.saveScenariosToLocalStorage();
            return true;
        },

        updateScenarioDataSnapshot(scenarioId) {
            const scenario = this.getScenario(scenarioId);
            if (!scenario) return false;
            const snapshot = this.captureCurrentDataSnapshot();
            if (!snapshot) {
                this.error = this.formatUiError(
                    new Error('No CSV data available to snapshot'),
                    'No CSV data available to snapshot'
                );
                return false;
            }
            scenario.dataSnapshot = snapshot;
            scenario.snapshotUpdatedAt = Date.now();
            this.message = `Updated data snapshot for ${scenario.name}`;
            this.saveScenariosToLocalStorage();
            return true;
        },

        restoreScenarioSnapshots(scenarioId) {
            const scenario = this.getScenario(scenarioId);
            if (!scenario) return false;
            const confirmed = confirm(
                `Restore configuration and CSV data from "${scenario.name}"? This will overwrite current tabs.`
            );
            if (!confirmed) return false;

            const configStore = typeof Alpine !== 'undefined' && Alpine.store ? Alpine.store('config') : null;
            const filesStore = typeof Alpine !== 'undefined' && Alpine.store ? Alpine.store('files') : null;
            if (!configStore || !filesStore) {
                this.error = this.formatUiError(
                    new Error('Stores not initialized. Please refresh the page.'),
                    'Stores not initialized. Please refresh the page.'
                );
                return false;
            }

            try {
                if (scenario.configSnapshot) {
                    if (typeof configStore.applyRunConfigSnapshot === 'function') {
                        configStore.applyRunConfigSnapshot(scenario.configSnapshot);
                    } else if (typeof configStore.loadJsonConfiguration === 'function') {
                        configStore.loadJsonConfiguration(scenario.configSnapshot);
                    }
                }

                if (scenario.dataSnapshot?.csvText && typeof filesStore.restoreFromCsvSnapshot === 'function') {
                    const filename = scenario.dataSnapshot.filename || 'run_data.csv';
                    filesStore.restoreFromCsvSnapshot(scenario.dataSnapshot.csvText, filename);
                }

                this.message = `Restored configuration and data from ${scenario.name}`;
                document.dispatchEvent(new CustomEvent('switchTab', {
                    detail: { tab: 'configuration' }
                }));
                return true;
            } catch (error) {
                this.error = this.formatUiError(error, 'Failed to restore run snapshot');
                return false;
            } finally {
                this.saveScenariosToLocalStorage();
            }
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
                scenario.configSnapshot = this.captureCurrentConfigSnapshot();
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
                    await window.apiService.stopExecution(scenario.runId);
                }
                if (this.activeEventSource) {
                    this.activeEventSource.close();
                    this.activeEventSource = null;
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
            scenario.liveSchedule = [];
            scenario.liveScheduleHash = null;
            scenario.liveScheduleUpdatedAt = null;
            scenario.liveResults = null;
            this.lastPlotUpdateTime = null;
            this.plotUpdateCounter = 0;
            console.info('[solverStore] Starting scenario run', {
                scenarioId,
                name: scenario.name
            });
            this.saveScenariosToLocalStorage();

            try {
                // Call the executeSolver logic with scenario ID
                await this.executeScenarioSolver(scenarioId);
            } catch (error) {
                console.error('[solverStore] Failed to run scenario:', error);
                scenario.status = 'FAILED';
                scenario.error = this.formatUiError(error, 'Execution failed');
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
                    scenario.error = this.formatUiError(
                        new Error('Stores not initialized. Please refresh the page.'),
                        'Stores not initialized. Please refresh the page.'
                    );
                    this.status = 'FAILED';
                    this.error = scenario.error;
                    return;
                }

                const inputData = typeof filesStore.getSolverInputPayload === 'function'
                    ? filesStore.getSolverInputPayload()
                    : { schema_version: '1.0', tables: {} };
                const tableCount = Object.keys(inputData?.tables || {}).length;
                if (tableCount === 0) {
                    scenario.status = 'FAILED';
                    scenario.error = this.formatUiError(
                        new Error('No input data found. Please import a folder first.'),
                        'No input data found. Please import a folder first.'
                    );
                    this.status = 'FAILED';
                    this.error = scenario.error;
                    return;
                }

                const assignmentProblems = validateSolverInputResourceAssignments(inputData);
                if (assignmentProblems.length > 0) {
                    const preview = assignmentProblems
                        .slice(0, 5)
                        .map((problem) => problem.testId)
                        .join(', ');
                    const problemCount = assignmentProblems.length;
                    const message =
                        `Resource assignment validation failed: ${problemCount} test(s) require FTE/equipment but have no assigned options (${preview}).`;
                    const error = new Error(message);
                    error.guidance =
                        'Assign FTE/equipment resources in Configuration > Test, or set required counts to 0.';
                    error.debug = {
                        detail: JSON.stringify({
                            problem_count: problemCount,
                            examples: assignmentProblems.slice(0, 10)
                        }, null, 2)
                    };
                    scenario.status = 'FAILED';
                    scenario.error = this.formatUiError(error, message);
                    this.status = 'FAILED';
                    this.error = scenario.error;
                    this.saveScenariosToLocalStorage();
                    return;
                }

                const currentPriorityConfig =
                    configStore.getCurrentConfig ? configStore.getCurrentConfig() : configStore.config;
                const missingDeadlineLegs = validateLegDeadlinePenaltyConfiguration(currentPriorityConfig);
                if (missingDeadlineLegs.length > 0) {
                    const preview = missingDeadlineLegs.slice(0, 8).join(', ');
                    const message =
                        `Deadline configuration incomplete: ${missingDeadlineLegs.length} leg(s) have positive deadline penalty but no end date (${preview}).`;
                    const error = new Error(message);
                    error.guidance =
                        'In Configuration > Leg Scheduling, set an End date for each leg with a positive Deadline Penalty.';
                    error.debug = {
                        detail: JSON.stringify(
                            {
                                issue: 'missing_leg_deadlines_for_positive_penalties',
                                missing_legs: missingDeadlineLegs
                            },
                            null,
                            2
                        )
                    };
                    scenario.status = 'FAILED';
                    scenario.error = this.formatUiError(error, message);
                    this.status = 'FAILED';
                    this.error = scenario.error;
                    this.saveScenariosToLocalStorage();
                    return;
                }

                const folderPath = typeof filesStore.getCurrentFolderPath === 'function'
                    ? filesStore.getCurrentFolderPath()
                    : '';
                const normalizedOutputFolder = this.config.outputFolder || folderPath || null;

                // 2. Prepare Request
                const request = {
                    input_data: inputData,
                    priority_config: currentPriorityConfig,
                    time_limit: this.config.timeLimit,
                    debug_level: this.config.debugLevel,
                    output_folder: normalizedOutputFolder,
                    scenario_id: scenarioId,
                    scenario_name: scenario.name
                };
                this.prepareDebugSolverRequestPayload(scenarioId, request);

                // 3. Execute Solver via API
                const response = await this.executeSolverApi(request);
                this.captureDebugSolverRequestPayload(scenarioId);
                this.executionId = response.execution_id;
                scenario.runId = this.executionId;
                console.info('[solverStore] Solver execution accepted', {
                    scenarioId,
                    executionId: this.executionId
                });
                this.message = 'Solver execution queued...';

                // 4. Poll for status
                this.startScenarioProgressTracking(scenarioId);

            } catch (error) {
                this.captureDebugSolverRequestPayload(scenarioId);
                scenario.status = 'FAILED';
                scenario.error = this.formatUiError(error, 'Execution failed');
                this.status = 'FAILED';
                this.error = scenario.error;
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
                    await this.completeScenarioWithResults(scenario);
                    
                    // Auto-switch to output tab on completion
                    document.dispatchEvent(new CustomEvent('switchTab', {
                        detail: { tab: 'output_data' }
                    }));
                    
                } else if (status.status === 'CANCELLED') {
                    await this.completeCancelledScenarioWithResults(scenario);
                    document.dispatchEvent(new CustomEvent('switchTab', {
                        detail: { tab: 'output_data' }
                    }));
                } else if (status.status === 'FAILED' || status.status === 'TIMEOUT') {
                    scenario.status = 'FAILED';
                    const statusError = buildExecutionStatusError(
                        status,
                        'Execution failed'
                    );
                    scenario.error = this.formatUiError(
                        statusError,
                        'Execution failed'
                    );
                    this.status = 'FAILED';
                    this.error = scenario.error;
                } else {
                    // Continue polling
                    setTimeout(() => this.pollScenarioStatus(scenarioId), 1000);
                    return;
                }
                
                this.saveScenariosToLocalStorage();
                
            } catch (error) {
                console.error('[solverStore] Polling error:', error);
                this.error = this.formatUiError(error, 'Polling failed while tracking execution.');
                // Continue polling on error
                setTimeout(() => this.pollScenarioStatus(scenarioId), 2000);
            }
        },

        startScenarioProgressTracking(scenarioId) {
            console.info('[solverStore] Starting progress tracking', {
                scenarioId,
                executionId: this.executionId
            });
            if (this.activeEventSource) {
                this.activeEventSource.close();
                this.activeEventSource = null;
            }

            if (typeof window !== 'undefined' &&
                window.apiService &&
                typeof window.apiService.streamExecutionProgress === 'function' &&
                typeof EventSource !== 'undefined') {
                try {
                    this.activeEventSource = window.apiService.streamExecutionProgress(this.executionId, {
                        onProgress: (event) => this.handleStreamProgressEvent(scenarioId, event),
                        onStateChanged: (event) => this.handleStreamStateEvent(scenarioId, event),
                        onCompleted: () => this.handleStreamCompleted(scenarioId),
                        onResyncRequired: async () => {
                            await this.pollScenarioStatus(scenarioId);
                        },
                        onError: () => {
                            if (this.activeEventSource) {
                                this.activeEventSource.close();
                                this.activeEventSource = null;
                            }
                            // Fallback to polling if SSE fails.
                            this.pollScenarioStatus(scenarioId);
                        }
                    });
                    return;
                } catch (error) {
                    console.warn('[solverStore] SSE unavailable, falling back to polling:', error);
                }
            }

            this.pollScenarioStatus(scenarioId);
        },

        handleStreamProgressEvent(scenarioId, event) {
            const scenario = this.getScenario(scenarioId);
            if (!scenario) return;
            console.info('[solverStore][stream] Progress event received', {
                scenarioId,
                type: event?.type,
                status: event?.status,
                hasSchedulePreview: Array.isArray(event?.schedule_preview) && event.schedule_preview.length > 0,
                makespan: event?.plot_point?.makespan ?? event?.metrics?.makespan ?? null
            });

            const progress = event.progress || {};
            const metrics = event.metrics || {};
            const plotPoint = event.plot_point || {};

            this.progress = progress.percent ?? this.progress;
            this.elapsedTime = (progress.elapsed_seconds ?? this.elapsedTime);
            const streamedMakespan = plotPoint.makespan ?? metrics.makespan ?? null;
            if (streamedMakespan !== null && streamedMakespan !== undefined && Number.isFinite(Number(streamedMakespan))) {
                this.message = `Running... best makespan: ${Number(streamedMakespan)}`;
            } else {
                this.message = progress.phase || this.message || 'Running...';
            }

            this.plotUpdateCounter += 1;
            const now = Date.now();
            const intervalSeconds = Number(this.config.plotUpdateInterval ?? 0);
            const intervalMs = Number.isFinite(intervalSeconds) && intervalSeconds > 0 ? intervalSeconds * 1000 : 0;
            const shouldUpdatePlot = intervalMs === 0
                || this.lastPlotUpdateTime === null
                || (now - this.lastPlotUpdateTime) >= intervalMs;

            const objectiveValue = plotPoint.objective ?? metrics.objective_value ?? null;
            if (shouldUpdatePlot) {
                this.lastPlotUpdateTime = now;
                const schedulePreview = Array.isArray(event.schedule_preview) ? event.schedule_preview : [];
                if (schedulePreview.length > 0) {
                    scenario.liveSchedule = schedulePreview;
                    scenario.liveScheduleHash = event.schedule_hash || null;
                    scenario.liveScheduleUpdatedAt = now;
                    console.info('[solverStore][stream] Live schedule snapshot received', {
                        scenarioId,
                        rows: schedulePreview.length,
                        hash: scenario.liveScheduleHash,
                        makespan: streamedMakespan
                    });
                }
                const hasLiveSignal = (
                    (streamedMakespan !== null && streamedMakespan !== undefined)
                    || (objectiveValue !== null && objectiveValue !== undefined)
                    || (Array.isArray(scenario.liveSchedule) && scenario.liveSchedule.length > 0)
                );
                if (hasLiveSignal) {
                    scenario.liveResults = {
                        execution_id: scenario.runId || null,
                        status: 'FEASIBLE',
                        makespan: (streamedMakespan !== null && streamedMakespan !== undefined) ? Number(streamedMakespan) : null,
                        test_schedule: Array.isArray(scenario.liveSchedule) ? scenario.liveSchedule : [],
                        resource_utilization: {},
                        output_files: {},
                        written_output_paths: {},
                        solver_stats: {
                            partial: true,
                            objective_value: objectiveValue
                        }
                    };
                }
                if (schedulePreview.length === 0) {
                    console.info('[solverStore][stream] Metrics update without schedule snapshot', {
                        scenarioId,
                        makespan: streamedMakespan,
                        objectiveValue
                    });
                }
            }

            this.progressTimeline.push({
                t_seconds: plotPoint.t_seconds ?? progress.elapsed_seconds ?? 0,
                makespan: plotPoint.makespan ?? metrics.makespan ?? null,
                objective: plotPoint.objective ?? metrics.objective_value ?? null
            });
        },

        handleStreamStateEvent(scenarioId, event) {
            const scenario = this.getScenario(scenarioId);
            if (!scenario) return;
            if (event.status === 'CANCELLATION_REQUESTED') {
                this.message = 'Cancellation requested...';
            }
        },

        async handleStreamCompleted(scenarioId) {
            const scenario = this.getScenario(scenarioId);
            if (!scenario) return;

            if (this.activeEventSource) {
                this.activeEventSource.close();
                this.activeEventSource = null;
            }

            const status = await this.getExecutionStatus();
            if (status.status === 'COMPLETED') {
                await this.completeScenarioWithResults(scenario);
            } else if (status.status === 'CANCELLED') {
                await this.completeCancelledScenarioWithResults(scenario);
            } else {
                scenario.status = 'FAILED';
                const statusError = buildExecutionStatusError(status, 'Execution failed');
                scenario.error = this.formatUiError(
                    statusError,
                    'Execution failed'
                );
                this.status = 'FAILED';
                this.error = scenario.error;
            }
            this.saveScenariosToLocalStorage();
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
                            message: updatedScenario.error?.message || updatedScenario.error || 'Unknown error'
                        });
                        
                        if (this.batchExecution.stopOnError) {
                            console.log('[solverStore] Stopping batch execution due to error');
                            break;
                        }
                    }
                    
                } catch (error) {
                    console.error(`[solverStore] Scenario ${scenario.name} failed:`, error);
                    scenario.status = 'FAILED';
                    scenario.error = this.formatUiError(error, 'Execution failed');
                    this.batchExecution.errors.push({
                        scenarioId: scenario.id,
                        scenarioName: scenario.name,
                        message: scenario.error.message || 'Execution failed'
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
                
                if (scenario.status === 'COMPLETED' || scenario.status === 'FAILED' || scenario.status === 'CANCELLED') {
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
                this.error = this.formatUiError(error, 'Failed to fetch results');
                throw error;
            }
        },

        // Reset solver state
        reset() {
            if (this.activeEventSource) {
                this.activeEventSource.close();
                this.activeEventSource = null;
            }
            this.status = 'IDLE';
            this.executionId = null;
            this.progress = 0;
            this.elapsedTime = 0;
            this.message = '';
            this.error = null;
            this.results = null;
            this.settingsUsed = null;
            this.progressTimeline = [];
            this.lastPlotUpdateTime = null;
            this.plotUpdateCounter = 0;
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
