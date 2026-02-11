/**
 * Batch Store - Alpine.js Store for batch scenario execution
 */
class BatchStore {
    constructor(options = {}) {
        this.storageKey = options.storageKey || 'batchWorkflowState';
        this.apiService = options.apiService || (typeof window !== 'undefined' ? window.apiService : null);
        this.pollIntervalMs = options.pollIntervalMs || 1500;

        this.status = 'IDLE';
        this.error = null;
        this.isLoading = false;
        this.message = '';
        this.progress = 0;

        this.sessionId = null;
        this.batchId = null;
        this.results = null;

        this.inputs = [];
        this.scenarios = [this.createDefaultScenario()];
    }

    init() {
        this.loadFromLocalStorage();
    }

    createDefaultScenario() {
        return {
            name: '',
            time_limit: 300,
            debug_level: 'INFO',
            output_folder: ''
        };
    }

    addScenario() {
        this.scenarios.push(this.createDefaultScenario());
        this.saveToLocalStorage();
    }

    removeScenario(index) {
        if (index < 0 || index >= this.scenarios.length) {
            return;
        }
        this.scenarios.splice(index, 1);
        if (this.scenarios.length === 0) {
            this.scenarios.push(this.createDefaultScenario());
        }
        this.saveToLocalStorage();
    }

    updateScenario(index, field, value) {
        if (!this.scenarios[index]) {
            return;
        }
        this.scenarios[index][field] = value;
        this.saveToLocalStorage();
    }

    normalizeScenario(scenario) {
        return {
            name: String(scenario?.name || '').trim(),
            time_limit: Number.isFinite(Number(scenario?.time_limit)) ? Number(scenario.time_limit) : 300,
            debug_level: scenario?.debug_level || 'INFO',
            output_folder: scenario?.output_folder ? String(scenario.output_folder).trim() : null
        };
    }

    validateScenarios() {
        const errors = [];

        this.scenarios.forEach((scenario, index) => {
            const label = `Scenario ${index + 1}`;
            const name = String(scenario?.name || '').trim();
            const timeLimit = Number(scenario?.time_limit);

            if (!name) {
                errors.push(`${label}: name is required.`);
            }

            if (!Number.isFinite(timeLimit) || timeLimit <= 0) {
                errors.push(`${label}: time limit must be a positive number.`);
            }
        });

        return {
            valid: errors.length === 0,
            errors
        };
    }

    setInputsFromFileStore() {
        try {
            if (typeof Alpine === 'undefined' || !Alpine.store) {
                return;
            }

            const filesStore = Alpine.store('files');
            if (!filesStore || typeof filesStore.getSolverInputData !== 'function') {
                return;
            }

            const fileMap = filesStore.getSolverInputData();
            this.inputs = Object.entries(fileMap).map(([name, content]) => ({ name, content }));
            this.saveToLocalStorage();
        } catch (error) {
            console.warn('Failed to sync inputs from file store:', error);
        }
    }

    clearError() {
        this.error = null;
    }

    getComparisonRows() {
        const resultItems = this.extractBatchResultItems(this.results);
        const rows = [];
        const usedResultIndexes = new Set();

        const indexedScenarios = this.scenarios.map((scenario, index) => ({
            scenario,
            index,
            nameKey: this.normalizeLookupKey(scenario?.name),
            idKey: this.normalizeLookupKey(scenario?.id || scenario?.scenario_id)
        }));

        indexedScenarios.forEach((entry) => {
            const resultIndex = this.findBestResultMatchIndex(resultItems, entry, usedResultIndexes);
            if (resultIndex >= 0) {
                usedResultIndexes.add(resultIndex);
                rows.push(this.createComparisonRow(resultItems[resultIndex], entry.scenario, resultIndex, true));
                return;
            }

            rows.push(this.createComparisonRow(null, entry.scenario, entry.index, false));
        });

        resultItems.forEach((item, index) => {
            if (!usedResultIndexes.has(index)) {
                rows.push(this.createComparisonRow(item, null, index, true));
            }
        });

        return rows;
    }

    extractBatchResultItems(results) {
        if (!results || typeof results !== 'object') {
            return [];
        }

        const directCandidates = [
            results.items,
            results.results,
            results.scenario_results,
            results.batch_results,
            results.entries
        ];

        for (let index = 0; index < directCandidates.length; index += 1) {
            const candidate = directCandidates[index];
            if (Array.isArray(candidate)) {
                return candidate;
            }
        }

        if (Array.isArray(results.scenarios)) {
            return results.scenarios;
        }

        return [];
    }

    findBestResultMatchIndex(resultItems, scenarioEntry, usedResultIndexes) {
        let index;

        if (scenarioEntry.idKey) {
            index = resultItems.findIndex((item, itemIndex) => {
                if (usedResultIndexes.has(itemIndex)) {
                    return false;
                }
                const itemIdKey = this.normalizeLookupKey(item?.scenario_id || item?.id);
                return itemIdKey && itemIdKey === scenarioEntry.idKey;
            });
            if (index >= 0) {
                return index;
            }
        }

        if (scenarioEntry.nameKey) {
            index = resultItems.findIndex((item, itemIndex) => {
                if (usedResultIndexes.has(itemIndex)) {
                    return false;
                }
                const itemNameKey = this.normalizeLookupKey(item?.scenario_name || item?.name || item?.scenario);
                return itemNameKey && itemNameKey === scenarioEntry.nameKey;
            });
            if (index >= 0) {
                return index;
            }
        }

        if (!usedResultIndexes.has(scenarioEntry.index) && resultItems[scenarioEntry.index]) {
            return scenarioEntry.index;
        }

        return -1;
    }

    normalizeLookupKey(value) {
        if (value === null || value === undefined) {
            return '';
        }
        return String(value).trim().toLowerCase();
    }

    createComparisonRow(resultItem, scenario, index, hasResult) {
        const fallbackScenarioLabel = String(scenario?.name || '').trim() || `Scenario ${index + 1}`;
        const scenarioLabel = String(
            resultItem?.scenario_name
            || resultItem?.name
            || resultItem?.scenario
            || scenario?.name
            || fallbackScenarioLabel
        ).trim();
        const scenarioId = String(resultItem?.scenario_id || resultItem?.id || scenario?.scenario_id || scenario?.id || '').trim() || 'N/A';

        const status = this.normalizeStatusValue(resultItem, hasResult);
        const makespanValue = this.pickValue(resultItem, [
            ['metrics', 'makespan'],
            ['kpis', 'makespan'],
            ['summary', 'makespan'],
            ['solver_stats', 'makespan'],
            ['makespan']
        ]);
        const objectiveValue = this.pickValue(resultItem, [
            ['metrics', 'objective'],
            ['kpis', 'objective'],
            ['summary', 'objective'],
            ['objective'],
            ['objective_value'],
            ['solver_stats', 'objective'],
            ['solver_stats', 'objective_value']
        ]);
        const solveTimeValue = this.pickValue(resultItem, [
            ['metrics', 'solve_time'],
            ['metrics', 'solve_time_seconds'],
            ['kpis', 'solve_time'],
            ['kpis', 'solve_time_seconds'],
            ['solver_stats', 'solve_time'],
            ['solve_time'],
            ['solve_time_seconds']
        ]);

        return {
            scenarioLabel,
            scenarioId,
            status,
            makespan: this.formatScalarValue(makespanValue),
            objective: this.formatScalarValue(objectiveValue),
            solveTime: this.formatSecondsValue(solveTimeValue),
            artifacts: this.extractArtifactReferences(resultItem)
        };
    }

    normalizeStatusValue(resultItem, hasResult) {
        if (!hasResult) {
            return 'PENDING';
        }

        const status = String(resultItem?.status || resultItem?.state || resultItem?.result_status || '').trim();
        if (!status) {
            return 'UNKNOWN';
        }
        return status.toUpperCase();
    }

    pickValue(source, candidatePaths) {
        if (!source || typeof source !== 'object') {
            return null;
        }

        for (let i = 0; i < candidatePaths.length; i += 1) {
            const path = candidatePaths[i];
            let cursor = source;
            for (let j = 0; j < path.length; j += 1) {
                const segment = path[j];
                if (!cursor || typeof cursor !== 'object' || !(segment in cursor)) {
                    cursor = undefined;
                    break;
                }
                cursor = cursor[segment];
            }

            if (cursor !== undefined && cursor !== null && cursor !== '') {
                return cursor;
            }
        }

        return null;
    }

    formatScalarValue(value) {
        if (value === null || value === undefined || value === '') {
            return 'N/A';
        }

        if (typeof value === 'number' && Number.isFinite(value)) {
            return String(value);
        }

        const parsed = Number(value);
        if (Number.isFinite(parsed) && String(value).trim() !== '') {
            return String(parsed);
        }

        return String(value);
    }

    formatSecondsValue(value) {
        if (value === null || value === undefined || value === '') {
            return 'N/A';
        }

        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
            return String(value);
        }

        return `${parsed}s`;
    }

    extractArtifactReferences(resultItem) {
        if (!resultItem || typeof resultItem !== 'object') {
            return [{ label: 'Artifacts', value: 'Not available' }];
        }

        const artifacts = resultItem.artifacts;
        if (artifacts && typeof artifacts === 'object' && !Array.isArray(artifacts)) {
            const artifactEntries = Object.entries(artifacts).map(([label, value]) => ({
                label,
                value: this.formatArtifactValue(value)
            }));
            if (artifactEntries.length > 0) {
                return artifactEntries;
            }
        }

        if (Array.isArray(artifacts) && artifacts.length > 0) {
            return artifacts.map((artifact, index) => {
                if (typeof artifact === 'string') {
                    return { label: `artifact_${index + 1}`, value: artifact };
                }
                if (artifact && typeof artifact === 'object') {
                    const label = String(artifact.label || artifact.name || artifact.id || `artifact_${index + 1}`);
                    const value = artifact.url || artifact.path || artifact.href || artifact.value || 'Available';
                    return { label, value: this.formatArtifactValue(value) };
                }
                return { label: `artifact_${index + 1}`, value: 'Available' };
            });
        }

        if (resultItem.output_files && typeof resultItem.output_files === 'object') {
            const outputEntries = Object.keys(resultItem.output_files).map((filename) => ({
                label: filename,
                value: 'Available'
            }));
            if (outputEntries.length > 0) {
                return outputEntries;
            }
        }

        return [{ label: 'Artifacts', value: 'Not available' }];
    }

    formatArtifactValue(value) {
        if (value === null || value === undefined || value === '') {
            return 'Available';
        }

        if (typeof value === 'string') {
            return value;
        }

        return 'Available';
    }

    reset() {
        this.status = 'IDLE';
        this.error = null;
        this.isLoading = false;
        this.message = '';
        this.progress = 0;
        this.sessionId = null;
        this.batchId = null;
        this.results = null;
    }

    setErrorState(error) {
        this.status = 'FAILED';
        this.isLoading = false;
        this.error = error?.message || String(error) || 'Unknown batch error';
        this.message = 'Batch execution failed.';
    }

    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async runBatch() {
        this.clearError();
        this.isLoading = true;
        this.status = 'PREPARING';
        this.message = 'Validating scenarios...';
        this.progress = 0;
        this.results = null;

        const validation = this.validateScenarios();
        if (!validation.valid) {
            this.setErrorState(new Error(validation.errors.join(' ')));
            return;
        }

        try {
            if (!this.apiService) {
                throw new Error('Batch backend service is unavailable in this environment.');
            }

            if (!Array.isArray(this.inputs) || this.inputs.length === 0) {
                this.setInputsFromFileStore();
            }

            this.message = 'Creating session...';
            const sessionResponse = await this.apiService.createRunSession({
                name: 'Batch Session',
                source: 'ui_v2_exp'
            });
            this.sessionId = sessionResponse.session_id || sessionResponse.id || null;

            if (!this.sessionId) {
                throw new Error('Backend did not return a session identifier.');
            }

            if (Array.isArray(this.inputs) && this.inputs.length > 0) {
                this.message = 'Uploading input files...';
                await this.apiService.uploadSessionInputs(this.sessionId, {
                    files: this.inputs
                });
            }

            this.message = 'Submitting batch...';
            this.status = 'RUNNING';
            const submitResponse = await this.apiService.submitBatch(this.sessionId, {
                scenarios: this.scenarios.map((scenario) => this.normalizeScenario(scenario))
            });

            this.batchId = submitResponse.batch_id || submitResponse.id || null;
            if (!this.batchId) {
                throw new Error('Backend did not return a batch identifier.');
            }

            await this.pollBatchStatus();
        } catch (error) {
            this.setErrorState(error);
        } finally {
            this.isLoading = false;
            this.saveToLocalStorage();
        }
    }

    async pollBatchStatus() {
        if (!this.batchId) {
            throw new Error('Batch identifier is missing.');
        }

        const maxAttempts = 120;
        let attempts = 0;

        while (attempts < maxAttempts) {
            attempts += 1;
            const statusResponse = await this.apiService.getBatchStatus(this.batchId);
            const status = String(statusResponse.status || '').toUpperCase();
            this.progress = Number.isFinite(Number(statusResponse.progress))
                ? Number(statusResponse.progress)
                : this.progress;
            this.message = statusResponse.message || status || 'Running...';

            if (status === 'COMPLETED') {
                this.status = 'COMPLETED';
                this.progress = 100;
                this.message = 'Batch completed.';
                this.results = await this.apiService.getBatchResults(this.batchId);
                return;
            }

            if (status === 'FAILED' || status === 'ERROR' || status === 'CANCELLED') {
                throw new Error(statusResponse.error || statusResponse.message || 'Batch execution failed.');
            }

            await this.sleep(this.pollIntervalMs);
        }

        throw new Error('Batch polling timed out before completion.');
    }

    saveToLocalStorage() {
        try {
            const persisted = {
                scenarios: this.scenarios,
                inputs: this.inputs,
                sessionId: this.sessionId,
                batchId: this.batchId
            };
            localStorage.setItem(this.storageKey, JSON.stringify(persisted));
        } catch (error) {
            console.warn('Failed to save batch state:', error);
        }
    }

    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (!saved) {
                return;
            }

            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed.scenarios) && parsed.scenarios.length > 0) {
                this.scenarios = parsed.scenarios.map((scenario) => this.normalizeScenario(scenario));
            }
            if (Array.isArray(parsed.inputs)) {
                this.inputs = parsed.inputs;
            }
            this.sessionId = parsed.sessionId || null;
            this.batchId = parsed.batchId || null;
        } catch (error) {
            console.warn('Failed to load batch state:', error);
        }
    }
}

document.addEventListener('alpine:init', () => {
    Alpine.store('batch', new BatchStore());
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BatchStore;
}
