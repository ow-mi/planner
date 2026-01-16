/**
 * Solver Store - Alpine.js Store for Solver Execution Management
 *
 * Manages solver execution state, progress tracking, and results handling
 */
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
        config: {
            timeLimit: 300,
            debugLevel: 'INFO',
            outputFolder: ''
        },
        isLoading: false,

        // Initialization
        init() {
            console.log('Solver store initialized');
            this.loadFromLocalStorage();
        },

        // Load from localStorage
        loadFromLocalStorage() {
            try {
                const savedConfig = localStorage.getItem('solverExecutionConfig');
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
                localStorage.setItem('solverExecutionConfig', JSON.stringify(this.config));
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
            this.elapsedTime = 0;

            try {
                // 1. Prepare Data
                const csvFiles = this.$store.files.getSolverInputData();
                if (Object.keys(csvFiles).length === 0) {
                    this.status = 'FAILED';
                    this.error = { message: "No input data found. Please upload CSV files first." };
                    return;
                }

                // 2. Prepare Request
                const request = {
                    csv_files: csvFiles,
                    priority_config: this.$store.config.getCurrentConfig(),
                    time_limit: this.config.timeLimit,
                    debug_level: this.config.debugLevel,
                    output_folder: this.config.outputFolder || null
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

        // Execute solver via API
        async executeSolverApi(solverRequest) {
            const API_BASE_URL = "http://localhost:8000/api";

            try {
                const response = await fetch(`${API_BASE_URL}/solver/execute`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(solverRequest)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || errorData.error?.message || "Solver execution failed");
                }

                return await response.json();
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

        // Get execution status
        async getExecutionStatus() {
            const API_BASE_URL = "http://localhost:8000/api";

            try {
                const response = await fetch(`${API_BASE_URL}/solver/status/${this.executionId}`);

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || "Failed to get status");
                }

                return await response.json();
            } catch (error) {
                console.error("Error getting execution status:", error);
                throw error;
            }
        },

        // Fetch solver results
        async fetchResults() {
            const API_BASE_URL = "http://localhost:8000/api";

            try {
                const response = await fetch(`${API_BASE_URL}/solver/results/${this.executionId}`);

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || "Failed to get results");
                }

                this.results = await response.json();
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
        },

        // Check if solver has results
        hasResults() {
            return this.results !== null;
        },

        // Get solver results
        getResults() {
            return this.results;
        },

        // Download single file
        downloadSingleFile(filename, content) {
            const element = document.createElement('a');
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);

            element.setAttribute('href', url);
            element.setAttribute('download', filename);

            element.style.display = 'none';
            document.body.appendChild(element);

            element.click();

            document.body.removeChild(element);
            URL.revokeObjectURL(url);
        },

        // Download all results as ZIP
        async downloadAllResults() {
            if (!this.results || !this.results.output_files) return;

            try {
                const zip = new JSZip();

                for (const [filename, content] of Object.entries(this.results.output_files)) {
                    zip.file(filename, content);
                }

                const zipContent = await zip.generateAsync({ type: "blob" });
                const zipFilename = `solver_results_${this.executionId}.zip`;

                const element = document.createElement('a');
                const url = URL.createObjectURL(zipContent);

                element.setAttribute('href', url);
                element.setAttribute('download', zipFilename);

                element.style.display = 'none';
                document.body.appendChild(element);

                element.click();

                document.body.removeChild(element);
                URL.revokeObjectURL(url);

            } catch (error) {
                console.error("Error creating zip:", error);
                throw new Error("Failed to create ZIP file. See console for details.");
            }
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
