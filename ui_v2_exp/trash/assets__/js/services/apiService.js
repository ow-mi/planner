/**
 * API Service - Centralized API Communication Service
 *
 * Handles all backend API requests with standardized error handling
 */
class ApiService {
    constructor(baseUrl = 'http://localhost:8000/api') {
        this.baseUrl = baseUrl;
        this.lastCanonicalPriorityConfig = null;
        this.credentialsMode = 'include';
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }

    toCanonicalPriorityConfig(priorityConfig = {}) {
        const source = priorityConfig || {};
        const normalizeNumber = (value, fallback) => {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : fallback;
        };
        const normalizeDate = (value) => {
            if (!value) {
                return null;
            }
            const asDate = new Date(value);
            if (!Number.isNaN(asDate.getTime())) {
                return asDate.toISOString().split('T')[0];
            }
            return String(value);
        };

        const canonical = {
            mode: source.mode || 'leg_end_dates',
            description: source.description || '',
            weights: {
                makespan_weight: normalizeNumber(source.weights?.makespan_weight, 0.2),
                priority_weight: normalizeNumber(source.weights?.priority_weight, 0.8)
            }
        };

        const isUiShape = Array.isArray(source.deadlines) ||
            Array.isArray(source.proximityRules) ||
            !!source.penaltySettings;

        if (isUiShape) {
            const legStartDeadlines = {};
            const legEndDeadlines = {};

            (source.deadlines || []).forEach((deadline) => {
                if (!deadline || !deadline.legId) {
                    return;
                }

                if (deadline.startEnabled && deadline.startDeadline) {
                    const normalizedStart = normalizeDate(deadline.startDeadline);
                    if (normalizedStart) {
                        legStartDeadlines[deadline.legId] = normalizedStart;
                    }
                }

                const legacyDeadline = deadline.deadlineDate || deadline.endDeadline;
                if (deadline.endEnabled !== false && legacyDeadline) {
                    const normalizedEnd = normalizeDate(legacyDeadline);
                    if (normalizedEnd) {
                        legEndDeadlines[deadline.legId] = normalizedEnd;
                    }
                }
            });

            if (Object.keys(legEndDeadlines).length > 0) {
                canonical.leg_deadlines = legEndDeadlines;
            }

            if (Object.keys(legStartDeadlines).length > 0) {
                canonical.leg_start_deadlines = legStartDeadlines;
            }

            const penalty = source.penaltySettings || {};
            canonical.deadline_penalty_per_day = normalizeNumber(penalty.deadline_penalty, 1000.0);
            canonical.leg_compactness_penalty_per_day = normalizeNumber(penalty.compactness_penalty, 500.0);
            canonical.allow_parallel_within_deadlines = normalizeNumber(penalty.parallel_within_deadlines, 100.0);

            if (Array.isArray(source.proximityRules) && source.proximityRules.length > 0) {
                const seenPatterns = new Set();
                const uniqueRules = source.proximityRules.filter((rule) => {
                    const pattern = rule?.pattern;
                    if (!pattern || seenPatterns.has(pattern)) {
                        return false;
                    }
                    seenPatterns.add(pattern);
                    return true;
                });
                if (uniqueRules.length > 0) {
                    const firstRule = uniqueRules[0] || {};
                    canonical.test_proximity_rules = {
                        patterns: uniqueRules
                            .map((rule) => rule?.pattern)
                            .filter((pattern) => typeof pattern === 'string' && pattern.trim().length > 0),
                        max_gap_days: normalizeNumber(firstRule.maxgapdays, 10),
                        proximity_penalty_per_day: normalizeNumber(firstRule.proximitypenaltyperday, 50.0),
                        enforce_sequence_order: uniqueRules.some((rule) => !!rule?.enforce_sequence_order)
                    };
                }
            }

            return canonical;
        }

        if (source.leg_deadlines && typeof source.leg_deadlines === 'object') {
            canonical.leg_deadlines = {};
            Object.entries(source.leg_deadlines).forEach(([legId, dateValue]) => {
                const normalized = normalizeDate(dateValue);
                if (normalized) {
                    canonical.leg_deadlines[legId] = normalized;
                }
            });
            if (Object.keys(canonical.leg_deadlines).length === 0) {
                delete canonical.leg_deadlines;
            }
        }

        if (source.deadline_penalty_per_day !== undefined || source.leg_compactness_penalty_per_day !== undefined || source.allow_parallel_within_deadlines !== undefined) {
            canonical.deadline_penalty_per_day = normalizeNumber(source.deadline_penalty_per_day, 1000.0);
            canonical.leg_compactness_penalty_per_day = normalizeNumber(source.leg_compactness_penalty_per_day, 500.0);
            canonical.allow_parallel_within_deadlines = normalizeNumber(source.allow_parallel_within_deadlines, 100.0);
        }

        if (source.test_proximity_rules && typeof source.test_proximity_rules === 'object') {
            const rules = source.test_proximity_rules;
            const patterns = Array.isArray(rules.patterns)
                ? rules.patterns.filter((pattern) => typeof pattern === 'string' && pattern.trim().length > 0)
                : [];
            if (patterns.length > 0) {
                canonical.test_proximity_rules = {
                    patterns,
                    max_gap_days: normalizeNumber(rules.max_gap_days, 10),
                    proximity_penalty_per_day: normalizeNumber(rules.proximity_penalty_per_day, 50.0),
                    enforce_sequence_order: !!rules.enforce_sequence_order
                };
            }
        }

        return canonical;
    }

    getLastCanonicalPriorityConfig() {
        if (!this.lastCanonicalPriorityConfig) {
            return null;
        }
        return JSON.parse(JSON.stringify(this.lastCanonicalPriorityConfig));
    }

    /**
     * Execute a GET request
     */
    async get(endpoint, params = {}) {
        const url = new URL(`${this.baseUrl}${endpoint}`);

        // Add query parameters
        Object.keys(params).forEach(key =>
            url.searchParams.append(key, params[key])
        );

        try {
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: this.defaultHeaders,
                credentials: this.credentialsMode
            });

            return await this.handleResponse(response);
        } catch (error) {
            throw this.handleError(error);
        }
    }

    /**
     * Execute a POST request
     */
    async post(endpoint, data = {}) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'POST',
                headers: this.defaultHeaders,
                body: JSON.stringify(data),
                credentials: this.credentialsMode
            });

            return await this.handleResponse(response);
        } catch (error) {
            throw this.handleError(error);
        }
    }

    /**
     * Execute a PUT request
     */
    async put(endpoint, data = {}) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'PUT',
                headers: this.defaultHeaders,
                body: JSON.stringify(data),
                credentials: this.credentialsMode
            });

            return await this.handleResponse(response);
        } catch (error) {
            throw this.handleError(error);
        }
    }

    /**
     * Execute a DELETE request
     */
    async delete(endpoint) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'DELETE',
                headers: this.defaultHeaders,
                credentials: this.credentialsMode
            });

            return await this.handleResponse(response);
        } catch (error) {
            throw this.handleError(error);
        }
    }

    /**
     * Handle API response
     */
    async handleResponse(response) {
        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                errorData = {
                    detail: `HTTP error! status: ${response.status}`,
                    error: { message: response.statusText }
                };
            }

            const error = new Error(
                errorData.detail ||
                errorData.error?.message ||
                `HTTP error! status: ${response.status}`
            );

            error.status = response.status;
            error.response = errorData;
            throw error;
        }

        try {
            return await response.json();
        } catch (e) {
            return {}; // Return empty object for successful responses with no body
        }
    }

    /**
     * Handle API errors
     */
    handleError(error) {
        let processedError;

        if (error.response) {
            // API returned an error response
            processedError = new Error(
                error.response.detail ||
                error.response.error?.message ||
                'API request failed'
            );
            processedError.status = error.response.status || 500;
            processedError.response = error.response;
        } else if (error.request) {
            // Request was made but no response received
            processedError = new Error('No response received from server');
            processedError.status = 0;
        } else {
            // Something happened in setting up the request
            processedError = new Error(error.message || 'Request setup failed');
            processedError.status = 0;
        }

        console.error('API Error:', processedError);
        return processedError;
    }

    /**
     * Execute solver
     */
    async executeSolver(solverRequest) {
        const canonicalPriorityConfig = this.toCanonicalPriorityConfig(solverRequest.priority_config || {});
        this.lastCanonicalPriorityConfig = canonicalPriorityConfig;

        const payload = {
            ...solverRequest,
            priority_config: canonicalPriorityConfig,
            settings_used: canonicalPriorityConfig
        };

        return await this.post('/solver/execute', payload);
    }

    /**
     * Get execution status
     */
    async getExecutionStatus(executionId) {
        return await this.get(`/solver/status/${executionId}`);
    }

    /**
     * Get execution results
     */
    async getExecutionResults(executionId) {
        return await this.get(`/solver/results/${executionId}`);
    }

    /**
     * Health check
     */
    async healthCheck() {
        return await this.get('/health');
    }

    /**
     * Create a run session for solver or batch workflows
     */
    async createRunSession(payload = {}) {
        return await this.post('/runs/sessions', payload);
    }

    /**
     * Import session inputs from a backend-visible folder
     */
    async importSessionInputsFromFolder(sessionId, folderPath) {
        if (!sessionId) {
            throw new Error('sessionId is required');
        }
        if (!folderPath || !String(folderPath).trim()) {
            throw new Error('folderPath is required');
        }
        return await this.post(`/runs/sessions/${sessionId}/inputs/import-folder`, {
            folder_path: String(folderPath).trim()
        });
    }

    /**
     * Submit a batch request with scenarios for a session
     */
    async submitBatch(sessionId, payload = {}) {
        if (!sessionId) {
            throw new Error('sessionId is required');
        }
        return await this.post('/batch/jobs', {
            session_id: sessionId,
            ...payload
        });
    }

    /**
     * Get batch status by batch identifier
     */
    async getBatchStatus(batchId) {
        if (!batchId) {
            throw new Error('batchId is required');
        }
        return await this.get(`/batch/jobs/${batchId}/status`);
    }

    /**
     * Get batch results by batch identifier
     */
    async getBatchResults(batchId) {
        if (!batchId) {
            throw new Error('batchId is required');
        }
        return await this.get(`/batch/jobs/${batchId}/results`);
    }
}

// Create global instance
window.apiService = new ApiService();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiService;
}
