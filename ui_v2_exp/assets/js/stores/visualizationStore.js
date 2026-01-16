/**
 * Visualization Store - Alpine.js Store for Visualization Management
 *
 * Manages visualization data, templates, and rendering
 */
document.addEventListener('alpine:init', () => {
    Alpine.store('visualization', {
        // State
        solverData: null,
        csvData: null,
        activeDataSource: 'solver', // 'solver' or 'csv'
        currentTemplateId: 'gantt-tests',
        code: '',
        error: null,
        autoRun: false,
        isEditorVisible: false,
        isLoading: false,
        editor: null,
        editorInitialized: false,
        templates: {},

        // Initialization
        init() {
            console.log('Visualization store initialized');
            this.loadTemplates();
            this.loadFromLocalStorage();
        },

        // Load visualization templates
        loadTemplates() {
            // Load legacy templates
            if (typeof legacyTemplates !== 'undefined') {
                this.templates = { ...legacyTemplates };
            }

            // Load saved template preference
            const savedTemplateId = localStorage.getItem('vis-current-template');
            if (savedTemplateId && this.templates[savedTemplateId]) {
                this.currentTemplateId = savedTemplateId;
            }

            // Load saved template code
            const savedCode = localStorage.getItem(`vis-code-${this.currentTemplateId}`);
            if (savedCode) {
                this.code = savedCode;
            } else if (this.templates[this.currentTemplateId]) {
                this.code = this.templates[this.currentTemplateId].code;
            }
        },

        // Load from localStorage
        loadFromLocalStorage() {
            try {
                const savedDataSource = localStorage.getItem('vis-active-data-source');
                if (savedDataSource) {
                    this.activeDataSource = savedDataSource;
                }
            } catch (error) {
                console.error('Failed to load visualization state from localStorage:', error);
            }
        },

        // Save to localStorage
        saveToLocalStorage() {
            try {
                localStorage.setItem('vis-active-data-source', this.activeDataSource);
                localStorage.setItem('vis-current-template', this.currentTemplateId);
                localStorage.setItem(`vis-code-${this.currentTemplateId}`, this.code);
            } catch (error) {
                console.error('Failed to save visualization state to localStorage:', error);
            }
        },

        // Watch for solver data changes
        watchSolverData(externalResults = null) {
            const parentSolverResults = externalResults;

            // Update local solverData if parent has new results
            if (parentSolverResults && parentSolverResults !== this.solverData) {
                const wasDataEmpty = !this.solverData;
                this.solverData = parentSolverResults;
                this.activeDataSource = 'solver';
                this.saveToLocalStorage();

                // Auto-render if solver is selected and we have code ready
                if (wasDataEmpty && this.code && this.code.trim() !== '') {
                    this.runCode();
                }
            } else if (!parentSolverResults && this.solverData) {
                // Clear solver data when parent data is cleared
                this.solverData = null;
                if (this.activeDataSource === 'solver' && this.csvData) {
                    this.activeDataSource = 'csv';
                } else if (this.activeDataSource === 'solver') {
                    this.activeDataSource = null;
                }
                this.saveToLocalStorage();
            }
        },

        // Load template
        loadTemplate(templateId) {
            if (this.templates[templateId]) {
                this.currentTemplateId = templateId;

                // Load saved code for this template, or use default template code
                const savedCode = localStorage.getItem(`vis-code-${templateId}`);
                if (savedCode) {
                    this.code = savedCode;
                } else {
                    this.code = this.templates[templateId].code;
                }

                this.error = null;
                this.saveToLocalStorage();

                // Update editor if available
                if (this.editor && this.editor.setValue) {
                    this.editor.setValue(this.code);
                }
            }
        },

        // Initialize code editor
        async initEditor(containerElement) {
            // Clean up existing editor before creating new one
            if (this.editor && this.editor.destroy) {
                try {
                    this.editor.destroy();
                } catch (err) {
                    console.warn('Error destroying existing editor:', err);
                }
                this.editor = null;
                this.editorInitialized = false;
            }

            if (typeof window.initCodeEditor === 'function') {
                try {
                    this.editor = await window.initCodeEditor(containerElement);
                    if (this.editor) {
                        this.editorInitialized = true;
                        this.editor.setValue(this.code || '');
                        // Watch for changes
                        this.editor.onChange = (newCode) => {
                            this.code = newCode;
                            this.saveToLocalStorage();
                        };
                        console.log('CodeMirror editor initialized successfully');
                    }
                } catch (err) {
                    console.error('Failed to initialize CodeMirror editor:', err);
                }
            } else {
                console.warn('initCodeEditor function not available. Make sure editor-setup.js is loaded.');
            }
        },

        // Toggle editor visibility
        toggleEditor() {
            this.isEditorVisible = !this.isEditorVisible;
        },

        // Run visualization code
        runCode() {
            // 1. Sync Code State: Get latest code from editor if active
            if (this.editor && this.editor.getValue) {
                try {
                    const editorCode = this.editor.getValue();
                    if (editorCode) {
                        this.code = editorCode;
                        this.saveToLocalStorage();
                    }
                } catch (err) {
                    console.warn('Failed to read code from editor, using stored code:', err);
                }
            }

            // 2. Validate Code
            if (!this.code || this.code.trim() === '') {
                this.error = { message: 'No code to execute. Please select a template or enter code.', line: 0 };
                return;
            }

            // 3. Determine Data Source
            let dataToUse = null;

            // Ensure activeDataSource is set if data is available but nothing selected
            if (!this.activeDataSource) {
                if (this.solverData) this.activeDataSource = 'solver';
                else if (this.csvData) this.activeDataSource = 'csv';
            }

            // Strict selection
            if (this.activeDataSource === 'solver' && this.solverData) {
                dataToUse = this.solverData;
            } else if (this.activeDataSource === 'csv' && this.csvData) {
                dataToUse = this.csvData;
            }

            if (!dataToUse) {
                this.error = { message: 'No data available for selected source. Please run the solver or upload a CSV file.', line: 0 };
                return;
            }

            // 4. Transform Data if needed
            let transformedData = dataToUse;

            if (this.activeDataSource === 'solver') {
                transformedData = this.transformSolutionResult(dataToUse);
            }

            console.log(`Rendering plot with ${this.activeDataSource} data`, transformedData);

            // 5. Execute Code
            try {
                const executeCode = new Function('d3', 'data', 'container', this.code);
                executeCode(d3, transformedData, container);
            } catch (err) {
                // Extract line number from error stack trace if available
                let lineNumber = 0;
                if (err.stack) {
                    const lineMatch = err.stack.match(/(?:<anonymous>:|@)(\d+):(\d+)/);
                    if (lineMatch) {
                        lineNumber = parseInt(lineMatch[1], 10);
                    }
                }

                this.error = {
                    message: err.message || 'Visualization code execution failed',
                    line: err.lineNumber || lineNumber || 0,
                    stack: err.stack
                };
                console.error('Code execution error:', err);
            }
        },

        // Transform solution result for visualization
        transformSolutionResult(solutionResult) {
            if (!solutionResult) {
                throw new Error('Solver results data is null or undefined');
            }

            // Handle both field names for compatibility
            const testSchedulesArray = solutionResult.test_schedules || solutionResult.test_schedule || [];

            if (!Array.isArray(testSchedulesArray)) {
                console.warn('Solver results missing test_schedules/test_schedule array, using empty array', solutionResult);
                return {
                    test_schedules: [],
                    equipment_usage: [],
                    fte_usage: [],
                    concurrency_timeseries: []
                };
            }

            // Transform SolutionResult JSON to match legacy CSV format
            const transformed = {
                test_schedules: testSchedulesArray.map(s => ({
                    test_id: s.test_id,
                    project_leg_id: s.project_leg_id,
                    test_name: s.test_name,
                    start_date: s.start_date ? (typeof s.start_date === 'string' ? s.start_date : s.start_date.toISOString().split('T')[0]) : null,
                    start_time: s.start_date ? (typeof s.start_date === 'string' ? s.start_date.split('T')[1]?.split('.')[0] || '00:00:00' : '00:00:00') : '00:00:00',
                    end_date: s.end_date ? (typeof s.end_date === 'string' ? s.end_date : s.end_date.toISOString().split('T')[0]) : null,
                    end_time: s.end_date ? (typeof s.end_date === 'string' ? s.end_date.split('T')[1]?.split('.')[0] || '00:00:00' : '00:00:00') : '00:00:00',
                    assigned_equipment_id: Array.isArray(s.assigned_equipment) ? s.assigned_equipment[0] : (s.assigned_equipment || ''),
                    assigned_fte_id: Array.isArray(s.assigned_fte) ? s.assigned_fte[0] : (s.assigned_fte || ''),
                    assigned_equipment: Array.isArray(s.assigned_equipment) ? s.assigned_equipment.join(';') : (s.assigned_equipment || ''),
                    assigned_fte: Array.isArray(s.assigned_fte) ? s.assigned_fte.join(';') : (s.assigned_fte || '')
                })),
                equipment_usage: this.generateEquipmentUsage(solutionResult, testSchedulesArray),
                fte_usage: this.generateFTEUsage(solutionResult, testSchedulesArray),
                concurrency_timeseries: this.generateConcurrencyTimeseries(solutionResult, testSchedulesArray)
            };
            return transformed;
        },

        // Generate equipment usage data
        generateEquipmentUsage(solutionResult, testSchedulesArray = null) {
            const usage = [];
            const schedules = testSchedulesArray || solutionResult.test_schedules || solutionResult.test_schedule || [];
            schedules.forEach(schedule => {
                const equipmentList = Array.isArray(schedule.assigned_equipment) ? schedule.assigned_equipment : [schedule.assigned_equipment].filter(Boolean);
                equipmentList.forEach(eqId => {
                    usage.push({
                        equipment_id: eqId,
                        test_id: schedule.test_id,
                        test_name: schedule.test_name,
                        start_date: schedule.start_date ? (typeof schedule.start_date === 'string' ? schedule.start_date : schedule.start_date.toISOString().split('T')[0]) : null,
                        end_date: schedule.end_date ? (typeof schedule.end_date === 'string' ? schedule.end_date : schedule.end_date.toISOString().split('T')[0]) : null
                    });
                });
            });
            return usage;
        },

        // Generate FTE usage data
        generateFTEUsage(solutionResult, testSchedulesArray = null) {
            const usage = [];
            const schedules = testSchedulesArray || solutionResult.test_schedules || solutionResult.test_schedule || [];
            schedules.forEach(schedule => {
                const fteList = Array.isArray(schedule.assigned_fte) ? schedule.assigned_fte : [schedule.assigned_fte].filter(Boolean);
                fteList.forEach(fteId => {
                    usage.push({
                        fte_id: fteId,
                        test_id: schedule.test_id,
                        test_name: schedule.test_name,
                        start_date: schedule.start_date ? (typeof schedule.start_date === 'string' ? schedule.start_date : schedule.start_date.toISOString().split('T')[0]) : null,
                        end_date: schedule.end_date ? (typeof schedule.end_date === 'string' ? schedule.end_date : schedule.end_date.toISOString().split('T')[0]) : null
                    });
                });
            });
            return usage;
        },

        // Generate concurrency timeseries data
        generateConcurrencyTimeseries(solutionResult, testSchedulesArray = null) {
            const timeseries = [];
            const schedules = testSchedulesArray || solutionResult.test_schedules || solutionResult.test_schedule || [];

            if (schedules.length === 0) return timeseries;

            // Get date range
            const dates = schedules.flatMap(s => [
                s.start_date ? (typeof s.start_date === 'string' ? new Date(s.start_date) : new Date(s.start_date)) : null,
                s.end_date ? (typeof s.end_date === 'string' ? new Date(s.end_date) : new Date(s.end_date)) : null
            ]).filter(Boolean);

            if (dates.length === 0) return timeseries;

            const minDate = new Date(Math.min(...dates));
            const maxDate = new Date(Math.max(...dates));

            // Generate daily timestamps
            for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
                const timestamp = new Date(d);
                let activeTests = 0;

                schedules.forEach(s => {
                    const start = s.start_date ? new Date(s.start_date) : null;
                    const end = s.end_date ? new Date(s.end_date) : null;
                    if (start && end && timestamp >= start && timestamp < end) {
                        activeTests++;
                    }
                });

                timeseries.push({
                    timestamp: timestamp.toISOString(),
                    active_tests: activeTests,
                    available_fte: 10, // Placeholder
                    available_equipment: 10, // Placeholder
                    capacity_min: 10 // Placeholder
                });
            }

            return timeseries;
        },

        // Process CSV file for visualization
        async processCSVFile(file) {
            if (!file) return;

            this.isLoading = true;
            this.error = null;

            try {
                // Parse CSV file using PapaParse
                const parseResult = await new Promise((resolve, reject) => {
                    Papa.parse(file, {
                        header: true,
                        skipEmptyLines: true,
                        complete: (results) => {
                            if (results.errors && results.errors.length > 0) {
                                reject(new Error(`CSV parsing error: ${results.errors[0].message}`));
                            } else {
                                resolve(results);
                            }
                        },
                        error: (error) => {
                            reject(new Error(`Failed to parse CSV: ${error.message}`));
                        }
                    });
                });

                // Validate required columns
                const requiredColumns = ['test_id', 'project_leg_id', 'start_date', 'end_date'];
                const headers = parseResult.meta.fields || [];
                const missingColumns = requiredColumns.filter(col => !headers.includes(col));

                if (missingColumns.length > 0) {
                    throw new Error(`CSV validation failed: Missing required columns: ${missingColumns.join(', ')}`);
                }

                // Transform CSV data
                this.csvData = this.transformCSVData(parseResult.data);
                this.activeDataSource = 'csv';
                this.saveToLocalStorage();

            } catch (err) {
                this.error = {
                    message: err.message,
                    line: 0
                };
                console.error('CSV processing error:', err);
            } finally {
                this.isLoading = false;
            }
        },

        // Transform CSV data for visualization
        transformCSVData(csvRows) {
            const testSchedules = csvRows.map(row => {
                // Parse dates and validate format
                let startDate = null;
                let endDate = null;

                try {
                    if (row.start_date) {
                        const start = new Date(row.start_date);
                        if (isNaN(start.getTime())) {
                            throw new Error(`Invalid start_date format: ${row.start_date}`);
                        }
                        startDate = start.toISOString().split('T')[0];
                    }
                } catch (err) {
                    throw new Error(`Date parsing error for start_date: ${err.message}`);
                }

                try {
                    if (row.end_date) {
                        const end = new Date(row.end_date);
                        if (isNaN(end.getTime())) {
                            throw new Error(`Invalid end_date format: ${row.end_date}`);
                        }
                        endDate = end.toISOString().split('T')[0];
                    }
                } catch (err) {
                    throw new Error(`Date parsing error for end_date: ${err.message}`);
                }

                // Parse equipment and FTE lists (comma or semicolon separated)
                const parseList = (str) => {
                    if (!str) return [];
                    return str.split(/[,;]/).map(s => s.trim()).filter(Boolean);
                };

                const equipmentList = parseList(row.assigned_equipment || '');
                const fteList = parseList(row.assigned_fte || '');

                return {
                    test_id: row.test_id || '',
                    project_leg_id: row.project_leg_id || '',
                    test_name: row.test_name || row.test_id || '',
                    start_date: startDate,
                    start_time: '00:00:00',
                    end_date: endDate,
                    end_time: '00:00:00',
                    assigned_equipment_id: equipmentList[0] || '',
                    assigned_fte_id: fteList[0] || '',
                    assigned_equipment: equipmentList.join(';'),
                    assigned_fte: fteList.join(';')
                };
            });

            // Generate equipment usage, FTE usage, and concurrency timeseries
            const equipmentUsage = [];
            const fteUsage = [];

            testSchedules.forEach(schedule => {
                const equipmentList = schedule.assigned_equipment ? schedule.assigned_equipment.split(';').filter(Boolean) : [];
                const fteList = schedule.assigned_fte ? schedule.assigned_fte.split(';').filter(Boolean) : [];

                equipmentList.forEach(eqId => {
                    equipmentUsage.push({
                        equipment_id: eqId,
                        test_id: schedule.test_id,
                        test_name: schedule.test_name,
                        start_date: schedule.start_date,
                        end_date: schedule.end_date
                    });
                });

                fteList.forEach(fteId => {
                    fteUsage.push({
                        fte_id: fteId,
                        test_id: schedule.test_id,
                        test_name: schedule.test_name,
                        start_date: schedule.start_date,
                        end_date: schedule.end_date
                    });
                });
            });

            // Generate concurrency timeseries
            const concurrencyTimeseries = this.generateConcurrencyTimeseriesFromSchedules(testSchedules);

            return {
                test_schedules: testSchedules,
                equipment_usage: equipmentUsage,
                fte_usage: fteUsage,
                concurrency_timeseries: concurrencyTimeseries
            };
        },

        // Generate concurrency timeseries from schedules
        generateConcurrencyTimeseriesFromSchedules(testSchedules) {
            const timeseries = [];

            if (testSchedules.length === 0) return timeseries;

            // Get date range
            const dates = testSchedules.flatMap(s => {
                const dates = [];
                if (s.start_date) dates.push(new Date(s.start_date));
                if (s.end_date) dates.push(new Date(s.end_date));
                return dates;
            }).filter(Boolean);

            if (dates.length === 0) return timeseries;

            const minDate = new Date(Math.min(...dates));
            const maxDate = new Date(Math.max(...dates));

            // Generate daily timestamps
            for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
                const timestamp = new Date(d);
                let activeTests = 0;

                testSchedules.forEach(s => {
                    const start = s.start_date ? new Date(s.start_date) : null;
                    const end = s.end_date ? new Date(s.end_date) : null;
                    if (start && end && timestamp >= start && timestamp < end) {
                        activeTests++;
                    }
                });

                timeseries.push({
                    timestamp: timestamp.toISOString(),
                    active_tests: activeTests,
                    available_fte: 10, // Placeholder
                    available_equipment: 10, // Placeholder
                    capacity_min: 10 // Placeholder
                });
            }

            return timeseries;
        },

        // Switch data source
        switchDataSource(source) {
            console.log('Switching data source to:', source);
            if (source === 'solver') {
                this.activeDataSource = 'solver';
                this.error = null;
                if (this.solverData && this.code && this.code.trim() !== '') {
                    this.runCode();
                }
            } else if (source === 'csv') {
                this.activeDataSource = 'csv';
                this.error = null;
                if (this.csvData && this.code && this.code.trim() !== '') {
                    this.runCode();
                }
            }
            this.saveToLocalStorage();
        },

        // Check if visualization data is available
        hasData() {
            return (this.activeDataSource === 'solver' && this.solverData) ||
                   (this.activeDataSource === 'csv' && this.csvData);
        },

        // Get current data for visualization
        getCurrentData() {
            if (this.activeDataSource === 'solver') {
                return this.solverData;
            } else if (this.activeDataSource === 'csv') {
                return this.csvData;
            }
            return null;
        }
    });
});
