/**
 * API Service - Centralized API Communication Service
 *
 * Handles all backend API requests with standardized error handling
 */
class ApiService {
    constructor(baseUrl = 'http://localhost:8000/api') {
        this.baseUrl = baseUrl;
        this.lastCanonicalPriorityConfig = null;
        this.lastExecuteSolverPayload = null;
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
        const parseWeekDateToIso = (value) => {
            const raw = String(value || '').trim();
            const match = raw.match(/^(\d{4})-W(\d{1,2})\.(\d)$/i);
            if (!match) {
                return null;
            }
            const year = Number(match[1]);
            const week = Number(match[2]);
            const dayOffset = Number(match[3]);
            if (!Number.isInteger(year) || !Number.isInteger(week) || !Number.isInteger(dayOffset)) {
                return null;
            }
            if (week < 1 || week > 53 || dayOffset < 0 || dayOffset > 6) {
                return null;
            }
            // ISO week algorithm: Jan 4 is always in week 1.
            const jan4 = new Date(Date.UTC(year, 0, 4));
            const jan4IsoDay = jan4.getUTCDay() || 7;
            const week1Monday = new Date(jan4);
            week1Monday.setUTCDate(jan4.getUTCDate() - (jan4IsoDay - 1));
            const target = new Date(week1Monday);
            target.setUTCDate(week1Monday.getUTCDate() + ((week - 1) * 7) + dayOffset);
            return target.toISOString().split('T')[0];
        };
        const normalizeDate = (value) => {
            if (!value) {
                return null;
            }
            const weekDate = parseWeekDateToIso(value);
            if (weekDate) {
                return weekDate;
            }
            const asDate = new Date(value);
            if (!Number.isNaN(asDate.getTime())) {
                return asDate.toISOString().split('T')[0];
            }
            return String(value);
        };
        const buildDeadlineKey = (deadline) => {
            const legId = String(deadline?.legId || '').trim();
            if (!legId) {
                return '';
            }
            const project = String(deadline?.project || '').trim();
            const branch = String(deadline?.branch || '').trim();
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
        };

        const legEndingWeight = normalizeNumber(
            source.weights?.leg_ending_weight ??
            source.weights?.legEndingWeight ??
            source.leg_ending_weight ??
            source.legEndingWeight,
            0.0
        );

        const canonical = {
            mode: source.mode || 'leg_end_dates',
            description: source.description || '',
            weights: {
                makespan_weight: normalizeNumber(
                    source.weights?.makespan_weight ?? source.weights?.makespanWeight,
                    0.2
                ),
                priority_weight: normalizeNumber(
                    source.weights?.priority_weight ?? source.weights?.priorityWeight,
                    0.8
                ),
                leg_ending_weight: legEndingWeight
            },
            leg_ending_weight: legEndingWeight
        };

        const isUiShape = Array.isArray(source.deadlines) ||
            Array.isArray(source.proximityRules) ||
            !!source.penaltySettings;

        if (isUiShape) {
            const legStartDeadlines = {};
            const legEndDeadlines = {};
            const legDeadlinePenalties = {};
            const legCompactnessPenalties = {};

            (source.deadlines || []).forEach((deadline) => {
                if (!deadline || !deadline.legId) {
                    return;
                }
                const deadlineKey = buildDeadlineKey(deadline);
                if (!deadlineKey) {
                    return;
                }

                if (deadline.startDeadline) {
                    const normalizedStart = normalizeDate(deadline.startDeadline);
                    if (normalizedStart) {
                        legStartDeadlines[deadlineKey] = normalizedStart;
                    }
                }

                const legacyDeadline = deadline.deadlineDate || deadline.endDeadline;
                if (legacyDeadline) {
                    const normalizedEnd = normalizeDate(legacyDeadline);
                    if (normalizedEnd) {
                        legEndDeadlines[deadlineKey] = normalizedEnd;
                    }
                }

                const deadlinePenalty = normalizeNumber(
                    deadline.deadlinePenalty ?? deadline.deadline_penalty,
                    null
                );
                if (Number.isFinite(deadlinePenalty) && deadlinePenalty >= 0) {
                    legDeadlinePenalties[deadlineKey] = deadlinePenalty;
                }

                const compactnessPenalty = normalizeNumber(
                    deadline.compactness ?? deadline.compactnessPenalty ?? deadline.compactness_penalty,
                    null
                );
                if (Number.isFinite(compactnessPenalty) && compactnessPenalty >= 0) {
                    legCompactnessPenalties[deadlineKey] = compactnessPenalty;
                }
            });

            if (Object.keys(legEndDeadlines).length > 0) {
                canonical.leg_deadlines = legEndDeadlines;
            }

            if (Object.keys(legStartDeadlines).length > 0) {
                canonical.leg_start_deadlines = legStartDeadlines;
            }

            if (Object.keys(legDeadlinePenalties).length > 0) {
                canonical.leg_deadline_penalties = legDeadlinePenalties;
            }

            if (Object.keys(legCompactnessPenalties).length > 0) {
                canonical.leg_compactness_penalties = legCompactnessPenalties;
            }

            const penalty = source.penaltySettings || {};
            canonical.deadline_penalty_per_day = normalizeNumber(
                penalty.deadlinePenalty ?? penalty.deadline_penalty,
                1000.0
            );
            canonical.leg_compactness_penalty_per_day = normalizeNumber(
                penalty.compactnessPenalty ?? penalty.compactness_penalty,
                500.0
            );
            canonical.allow_parallel_within_deadlines = normalizeNumber(
                penalty.parallelWithinDeadlines ?? penalty.parallel_within_deadlines,
                100.0
            );

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

        const sourceLegDeadlines =
            source.leg_deadlines || source.legDeadlines || source.legEndDeadlines || null;
        if (sourceLegDeadlines && typeof sourceLegDeadlines === 'object') {
            canonical.leg_deadlines = {};
            Object.entries(sourceLegDeadlines).forEach(([legId, dateValue]) => {
                const normalized = normalizeDate(dateValue);
                if (normalized) {
                    canonical.leg_deadlines[legId] = normalized;
                }
            });
            if (Object.keys(canonical.leg_deadlines).length === 0) {
                delete canonical.leg_deadlines;
            }
        }

        const sourceLegStartDeadlines =
            source.leg_start_deadlines || source.legStartDeadlines || null;
        if (sourceLegStartDeadlines && typeof sourceLegStartDeadlines === 'object') {
            canonical.leg_start_deadlines = {};
            Object.entries(sourceLegStartDeadlines).forEach(([legId, dateValue]) => {
                const normalized = normalizeDate(dateValue);
                if (normalized) {
                    canonical.leg_start_deadlines[legId] = normalized;
                }
            });
            if (Object.keys(canonical.leg_start_deadlines).length === 0) {
                delete canonical.leg_start_deadlines;
            }
        }

        const sourceLegDeadlinePenalties =
            source.leg_deadline_penalties || source.legDeadlinePenalties || null;
        if (sourceLegDeadlinePenalties && typeof sourceLegDeadlinePenalties === 'object') {
            canonical.leg_deadline_penalties = {};
            Object.entries(sourceLegDeadlinePenalties).forEach(([legId, penaltyValue]) => {
                const normalizedPenalty = normalizeNumber(penaltyValue, null);
                if (Number.isFinite(normalizedPenalty) && normalizedPenalty >= 0) {
                    canonical.leg_deadline_penalties[legId] = normalizedPenalty;
                }
            });
            if (Object.keys(canonical.leg_deadline_penalties).length === 0) {
                delete canonical.leg_deadline_penalties;
            }
        }

        const sourceLegCompactnessPenalties =
            source.leg_compactness_penalties || source.legCompactnessPenalties || null;
        if (sourceLegCompactnessPenalties && typeof sourceLegCompactnessPenalties === 'object') {
            canonical.leg_compactness_penalties = {};
            Object.entries(sourceLegCompactnessPenalties).forEach(([legId, penaltyValue]) => {
                const normalizedPenalty = normalizeNumber(penaltyValue, null);
                if (Number.isFinite(normalizedPenalty) && normalizedPenalty >= 0) {
                    canonical.leg_compactness_penalties[legId] = normalizedPenalty;
                }
            });
            if (Object.keys(canonical.leg_compactness_penalties).length === 0) {
                delete canonical.leg_compactness_penalties;
            }
        }

        if (
            source.deadline_penalty_per_day !== undefined ||
            source.deadlinePenaltyPerDay !== undefined ||
            source.leg_compactness_penalty_per_day !== undefined ||
            source.legCompactnessPenaltyPerDay !== undefined ||
            source.allow_parallel_within_deadlines !== undefined ||
            source.allowParallelWithinDeadlines !== undefined
        ) {
            canonical.deadline_penalty_per_day = normalizeNumber(
                source.deadline_penalty_per_day ?? source.deadlinePenaltyPerDay,
                1000.0
            );
            canonical.leg_compactness_penalty_per_day = normalizeNumber(
                source.leg_compactness_penalty_per_day ?? source.legCompactnessPenaltyPerDay,
                500.0
            );
            canonical.allow_parallel_within_deadlines = normalizeNumber(
                source.allow_parallel_within_deadlines ?? source.allowParallelWithinDeadlines,
                100.0
            );
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

    getLastExecuteSolverPayload() {
        if (!this.lastExecuteSolverPayload) {
            return null;
        }
        return JSON.parse(JSON.stringify(this.lastExecuteSolverPayload));
    }

    buildExecuteSolverPayload(solverRequest) {
        const canonicalPriorityConfig = this.toCanonicalPriorityConfig(solverRequest.priority_config || {});
        this.lastCanonicalPriorityConfig = canonicalPriorityConfig;

        const payload = {
            ...solverRequest,
            priority_config: canonicalPriorityConfig,
            progress_interval_seconds: solverRequest.progress_interval_seconds ?? 10,
            settings_used: canonicalPriorityConfig
        };
        if (payload.input_data && payload.input_data.tables) {
            delete payload.csv_files;
        }
        this.lastExecuteSolverPayload = JSON.parse(JSON.stringify(payload));
        return payload;
    }

    validateLegDeadlinePenaltyConfig(priorityConfig = {}) {
        const legDeadlines = priorityConfig.leg_deadlines || {};
        const legDeadlinePenalties = priorityConfig.leg_deadline_penalties || {};
        if (!legDeadlinePenalties || typeof legDeadlinePenalties !== 'object') {
            return [];
        }

        const missing = [];
        Object.entries(legDeadlinePenalties).forEach(([legId, penalty]) => {
            const numericPenalty = Number(penalty);
            if (!Number.isFinite(numericPenalty) || numericPenalty <= 0) {
                return;
            }
            const deadlineValue = legDeadlines[legId];
            if (!deadlineValue || !String(deadlineValue).trim()) {
                missing.push(legId);
            }
        });
        return missing;
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
            error.endpoint = endpoint;
            error.method = 'GET';
            throw this.handleError(error);
        }
    }

    /**
     * Execute a POST request
     * @param {string} endpoint - API endpoint
     * @param {Object|FormData} data - Request data (object or FormData)
     * @param {Object} options - Additional options (headers override)
     */
    async post(endpoint, data = {}, options = {}) {
        try {
            const isFormData = data instanceof FormData;
            
            const fetchOptions = {
                method: 'POST',
                credentials: this.credentialsMode
            };
            
            if (isFormData) {
                // For FormData, don't set Content-Type (browser sets it with boundary)
                fetchOptions.body = data;
            } else {
                fetchOptions.headers = { ...this.defaultHeaders, ...options.headers };
                fetchOptions.body = JSON.stringify(data);
            }

            const response = await fetch(`${this.baseUrl}${endpoint}`, fetchOptions);

            return await this.handleResponse(response);
        } catch (error) {
            error.endpoint = endpoint;
            error.method = 'POST';
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
            error.endpoint = endpoint;
            error.method = 'PUT';
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
            error.endpoint = endpoint;
            error.method = 'DELETE';
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
            error.endpoint = response.url;
            error.method = response?.request?.method || null;
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
        const status = Number(error?.status || error?.response?.status || 0);
        const responsePayload = error?.response || null;
        const detail = this._extractErrorDetail(responsePayload) || error?.message || 'API request failed';
        const message = this._buildUserMessage(status, detail);
        const guidance = this._buildGuidance(status);
        const code = this._extractErrorCode(responsePayload);

        const processedError = new Error(message);
        processedError.status = status;
        processedError.code = code;
        processedError.guidance = guidance;
        processedError.response = responsePayload;
        processedError.endpoint = error?.endpoint || null;
        processedError.method = error?.method || null;
        processedError.debug = {
            status,
            code,
            endpoint: processedError.endpoint,
            method: processedError.method,
            detail,
            timestamp: new Date().toISOString()
        };

        console.error('API Error:', processedError.message, processedError.debug, responsePayload || '');
        return processedError;
    }

    _extractErrorDetail(responsePayload) {
        if (!responsePayload) return '';
        const detail = responsePayload.detail ?? responsePayload.error?.message ?? responsePayload.message;
        if (typeof detail === 'string') return detail;
        if (Array.isArray(detail)) {
            return detail
                .map((item) => {
                    if (typeof item === 'string') return item;
                    if (item?.msg) return item.msg;
                    return JSON.stringify(item);
                })
                .join('; ');
        }
        if (detail && typeof detail === 'object') {
            if (typeof detail.message === 'string') return detail.message;
            return JSON.stringify(detail);
        }
        return '';
    }

    _extractErrorCode(responsePayload) {
        if (!responsePayload || typeof responsePayload !== 'object') return null;
        return (
            responsePayload?.error?.error_code ||
            responsePayload?.error_code ||
            responsePayload?.code ||
            null
        );
    }

    _buildUserMessage(status, detail) {
        const baseDetail = String(detail || '').trim();
        if (status === 0) {
            return baseDetail || 'Network error: unable to reach backend API.';
        }
        if (status === 400) return `Invalid request: ${baseDetail || 'Please verify inputs.'}`;
        if (status === 404) return `Not found: ${baseDetail || 'Requested resource was not found.'}`;
        if (status === 409) return `Conflict: ${baseDetail || 'Request conflicts with current state.'}`;
        if (status === 422) return `Validation failed: ${baseDetail || 'Request format is invalid.'}`;
        if (status === 429) return `Rate limited: ${baseDetail || 'Too many requests.'}`;
        if (status >= 500) return `Server error: ${baseDetail || 'Backend failed to process request.'}`;
        return baseDetail || 'API request failed';
    }

    _buildGuidance(status) {
        if (status === 0) return 'Verify backend is running and CORS/network settings are correct.';
        if (status === 400 || status === 422) return 'Review required fields and input schema, then retry.';
        if (status === 404) return 'Refresh state and try again. The run or execution may have expired.';
        if (status === 409) return 'Wait for current operation to settle, then retry.';
        if (status === 429) return 'Retry after a short delay.';
        if (status >= 500) return 'Check backend logs for traceback and request details.';
        return '';
    }

    toUiError(error, fallbackMessage = 'Request failed') {
        const message = error?.message || fallbackMessage;
        const guidance = error?.guidance || '';
        const status = Number(error?.status || 0);
        const code = error?.code || null;
        const debugObject = {
            status,
            code,
            endpoint: error?.endpoint || null,
            method: error?.method || null,
            detail: error?.debug?.detail || message,
            timestamp: error?.debug?.timestamp || new Date().toISOString()
        };

        return {
            message,
            guidance,
            status,
            code,
            debug: JSON.stringify(debugObject, null, 2)
        };
    }

    /**
     * Execute solver
     */
    async executeSolver(solverRequest) {
        const payload = this.buildExecuteSolverPayload(solverRequest);
        const missingDeadlineLegs = this.validateLegDeadlinePenaltyConfig(payload.priority_config || {});
        if (missingDeadlineLegs.length > 0) {
            const message =
                `Invalid request: Priority Config Validation Error: leg_deadlines is required when leg_deadline_penalties contains positive values (${missingDeadlineLegs.slice(0, 10).join(', ')})`;
            const error = new Error(message);
            error.status = 400;
            error.endpoint = '/solver/execute';
            error.method = 'POST';
            error.guidance = 'Set an End date for each leg that has a positive deadline penalty.';
            error.debug = {
                detail: message,
                missing_legs: missingDeadlineLegs
            };
            throw this.handleError(error);
        }
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
     * Get execution results, optionally returning partial checkpoints.
     */
    async getExecutionResultsWithOptions(executionId, { includePartial = false } = {}) {
        if (!executionId) {
            throw new Error('executionId is required');
        }
        if (!includePartial) {
            return await this.getExecutionResults(executionId);
        }
        return await this.get(`/solver/results/${executionId}`, { include_partial: true });
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

    /**
     * Discover available spreadsheets from configured paths and uploaded sessions
     */
    async discoverSpreadsheets(configPaths = [], sessionId = null) {
        return await this.get('/spreadsheets/discover', {
            config_paths: configPaths,
            session_id: sessionId
        });
    }

    /**
     * Validate a selected spreadsheet against required schema
     */
    async validateSpreadsheet({ spreadsheet_id, file_content }) {
        if (!spreadsheet_id) {
            throw new Error('spreadsheet_id is required');
        }
        if (!file_content) {
            throw new Error('file_content is required');
        }
        return await this.post('/spreadsheets/validate', {
            spreadsheet_id,
            file_content
        });
    }

    /**
     * Check configuration consistency against active spreadsheet entities
     */
    async checkConfigConsistency(configJson, spreadsheetEntities) {
        return await this.post('/config/consistency-check', {
            config_json: configJson,
            spreadsheet_entities: spreadsheetEntities
        });
    }

    /**
     * Stream execution progress via EventSource.
     */
    streamExecutionProgress(executionId, {
        onEvent = null,
        onProgress = null,
        onStateChanged = null,
        onCompleted = null,
        onError = null,
        onResyncRequired = null,
        lastEventId = null
    } = {}) {
        if (!executionId) {
            throw new Error('executionId is required');
        }
        return this._streamSolverEvents(`/solver/execute/${executionId}/stream`, {
            onEvent,
            onProgress,
            onStateChanged,
            onCompleted,
            onError,
            onResyncRequired,
            lastEventId
        });
    }

    _streamSolverEvents(path, {
        onEvent = null,
        onProgress = null,
        onStateChanged = null,
        onCompleted = null,
        onError = null,
        onResyncRequired = null,
        lastEventId = null
    } = {}) {
        if (typeof EventSource === 'undefined') {
            throw new Error('EventSource is not available in this environment');
        }

        const query = lastEventId ? `?last_event_id=${encodeURIComponent(lastEventId)}` : '';
        const source = new EventSource(`${this.baseUrl}${path}${query}`, {
            withCredentials: true
        });
        console.info('[apiService][stream] Opened SSE stream', { path, query, url: source.url });

        const handlePayload = (payload) => {
            if (typeof onEvent === 'function') onEvent(payload);
            if (payload.type === 'progress' && typeof onProgress === 'function') onProgress(payload);
            if (payload.type === 'state_changed' && typeof onStateChanged === 'function') onStateChanged(payload);
            if (payload.type === 'completed' && typeof onCompleted === 'function') onCompleted(payload);
            if (payload.type === 'resync_required' && typeof onResyncRequired === 'function') onResyncRequired(payload);
        };

        const parseAndDispatch = (event, channel) => {
            let payload = {};
            try {
                payload = JSON.parse(event.data);
            } catch (error) {
                if (typeof onError === 'function') {
                    onError(new Error('Invalid stream event payload'));
                }
                return;
            }
            console.info('[apiService][stream] Received SSE event', {
                channel,
                type: payload?.type,
                status: payload?.status,
                sequence: payload?.sequence
            });
            handlePayload(payload);
        };

        source.onmessage = (event) => {
            parseAndDispatch(event, 'message');
        };
        // Backend emits named events (event: progress/state_changed/completed/resync_required).
        // Register explicit listeners because onmessage may not fire for named SSE events.
        source.addEventListener('progress', (event) => parseAndDispatch(event, 'progress'));
        source.addEventListener('state_changed', (event) => parseAndDispatch(event, 'state_changed'));
        source.addEventListener('completed', (event) => parseAndDispatch(event, 'completed'));
        source.addEventListener('resync_required', (event) => parseAndDispatch(event, 'resync_required'));

        source.onerror = (event) => {
            console.error('[apiService][stream] SSE error', { path, url: source.url, event });
            if (typeof onError === 'function') {
                onError(event);
            }
        };

        return source;
    }

    /**
     * Stream run progress via EventSource.
     */
    streamRunProgress(runId, handlers = {}) {
        if (!runId) {
            throw new Error('runId is required');
        }
        return this._streamSolverEvents(`/solver/runs/${runId}/stream`, handlers);
    }

    /**
     * Request cancellation for an execution.
     */
    async stopExecution(executionId) {
        if (!executionId) {
            throw new Error('executionId is required');
        }
        return await this.post(`/solver/execute/${executionId}/stop`, {});
    }

    /**
     * Request cancellation for a run-scoped execution.
     */
    async stopRun(runId) {
        if (!runId) {
            throw new Error('runId is required');
        }
        return await this.post(`/solver/runs/${runId}/stop`, {});
    }

    /**
     * @deprecated Legacy queue endpoint removed from backend.
     */
    async addScenarioToQueue() {
        throw new Error('Deprecated API: scenario queue endpoints were removed. Use solver execute or batch endpoints.');
    }

    /**
     * @deprecated Legacy queue endpoint removed from backend.
     */
    async getScenarioQueueStatus() {
        throw new Error('Deprecated API: scenario queue endpoints were removed. Use solver status endpoints.');
    }

    /**
     * @deprecated Legacy queue endpoint removed from backend.
     */
    async runSingleScenario() {
        throw new Error('Deprecated API: scenario queue endpoints were removed. Use solver execute endpoints.');
    }

    /**
     * @deprecated Legacy queue endpoint removed from backend.
     */
    async runAllUnsolved() {
        throw new Error('Deprecated API: scenario queue endpoints were removed. Use batch job endpoints.');
    }

    /**
     * Backward-compatible alias for stopExecution.
     */
    async stopRender(executionId) {
        return await this.stopExecution(executionId);
    }

    // ========== FILE UPLOAD METHODS (Phase A) ==========

    /**
     * Upload a single file (CSV, Excel, or JSON)
     * @param {FormData} formData - FormData containing the file
     * @param {Function} onProgress - Optional progress callback (0-100)
     * @returns {Promise<Object>} Upload response with parsed data
     */
    async uploadFile(formData, onProgress = null) {
        const url = `${this.baseUrl}/v1/files/upload`;
        
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            // Track upload progress
            if (onProgress && typeof onProgress === 'function') {
                xhr.upload.addEventListener('progress', (event) => {
                    if (event.lengthComputable) {
                        const percentComplete = Math.round((event.loaded / event.total) * 100);
                        onProgress(percentComplete);
                    }
                });
            }
            
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch (error) {
                        reject(new Error('Invalid JSON response from server'));
                    }
                } else {
                    try {
                        const errorData = JSON.parse(xhr.responseText);
                        reject(new Error(errorData.detail || errorData.message || `Upload failed: ${xhr.status}`));
                    } catch {
                        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
                    }
                }
            });
            
            xhr.addEventListener('error', () => {
                reject(new Error('Network error during upload'));
            });
            
            xhr.addEventListener('abort', () => {
                reject(new Error('Upload aborted'));
            });
            
            xhr.open('POST', url);
            // Don't set Content-Type header for FormData - browser sets it with boundary
            xhr.withCredentials = true;
            xhr.send(formData);
        });
    }

    /**
     * Upload multiple files
     * @param {FormData} formData - FormData containing multiple files
     * @returns {Promise<Object>} Batch upload response
     */
    async uploadMultipleFiles(formData) {
        return this.post('/v1/files/upload/multiple', formData, {
            headers: {} // Let browser set multipart boundary
        });
    }

    /**
     * Get supported file formats
     * @returns {Promise<Object>} Supported formats and constraints
     */
    async getSupportedFormats() {
        return this.get('/v1/files/supported-formats');
    }
}

// Create global instance
window.apiService = new ApiService();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiService;
}
