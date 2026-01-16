/**
 * API Service - Centralized API Communication Service
 *
 * Handles all backend API requests with standardized error handling
 */
class ApiService {
    constructor(baseUrl = 'http://localhost:8000/api') {
        this.baseUrl = baseUrl;
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
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
                credentials: 'include'
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
                credentials: 'include'
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
                credentials: 'include'
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
                credentials: 'include'
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
        return await this.post('/solver/execute', solverRequest);
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
}

// Create global instance
window.apiService = new ApiService();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiService;
}
