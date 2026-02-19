/**
 * Alpine.js Visualization Component
 * 
 * Main component for D3 visualization with code editing capabilities
 */

function visualizationComponent() {
    return {
        solverData: null,
        csvData: null,
        activeDataSource: 'solver', // 'solver' or 'csv' - default to 'solver' for primary workflow
        currentTemplateId: 'gantt-tests',
        code: '',
        error: null,
        autoRun: false,
        isEditorVisible: false, // Default: editor hidden
        isLoading: false,
        editor: null,
        editorInitialized: false,
        // solverState: null, // Removed to allow scope inheritance from parent
        
        async init() {
            // Load saved template preference from localStorage
            const savedTemplateId = localStorage.getItem('vis-current-template');
            if (savedTemplateId && typeof legacyTemplates !== 'undefined' && legacyTemplates[savedTemplateId]) {
                this.currentTemplateId = savedTemplateId;
            }
            
            // Load saved template code from localStorage or default template
            const savedCode = localStorage.getItem(`vis-code-${this.currentTemplateId}`);
            if (savedCode) {
                this.code = savedCode;
            } else {
                this.loadTemplate(this.currentTemplateId);
            }
            
            // Use local watcher instead of accessing $parent directly if possible, or use getter
            // Note: $parent access in Alpine v3 depends on scope inheritance.
            // We will rely on watchSolverData (via x-effect) to pull data.
            
            // Initialize editor when editor section becomes visible
            this.$watch('isEditorVisible', (visible) => {
                if (visible && !this.editorInitialized) {
                    this.$nextTick(() => {
                        this.initEditor();
                    });
                }
            });
            
            // Watch for template changes to update editor
            this.$watch('currentTemplateId', (newId) => {
                if (this.editor && this.editor.setValue) {
                    // Load code for new template
                    const savedCode = localStorage.getItem(`vis-code-${newId}`);
                    const templateCode = (typeof legacyTemplates !== 'undefined' && legacyTemplates[newId]) 
                        ? legacyTemplates[newId].code 
                        : '';
                    this.code = savedCode || templateCode;
                    this.editor.setValue(this.code);
                } else {
                     // If editor not active, still update local code state
                    const savedCode = localStorage.getItem(`vis-code-${newId}`);
                    const templateCode = (typeof legacyTemplates !== 'undefined' && legacyTemplates[newId]) 
                        ? legacyTemplates[newId].code 
                        : '';
                    this.code = savedCode || templateCode;
                }
            });
        },
        
        toggleEditor() {
            this.isEditorVisible = !this.isEditorVisible;
            if (this.isEditorVisible && !this.editorInitialized) {
                // Wait for DOM to update, then initialize editor
                setTimeout(() => {
                    this.initEditor();
                }, 50);
            }
        },
        
        async initEditor() {
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
            
            // Wait for DOM to be ready
            await this.$nextTick();
            
            const container = this.$refs.codeEditorContainer;
            if (!container) {
                console.warn('Code editor container not found, retrying...');
                // Retry after a short delay
                setTimeout(() => {
                    if (this.$refs.codeEditorContainer) {
                        this.initEditor();
                    }
                }, 100);
                return;
            }
            
            if (typeof window.initCodeEditor === 'function') {
                try {
                    this.editor = await window.initCodeEditor(container);
                    if (this.editor) {
                        this.editorInitialized = true;
                        this.editor.setValue(this.code || '');
                        // Watch for changes
                        this.editor.onChange = (newCode) => {
                            this.code = newCode;
                            localStorage.setItem(`vis-code-${this.currentTemplateId}`, this.code);
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
        
        // Watch for solverData changes from parent
        // This function is called via x-effect="watchSolverData()" in the HTML
        watchSolverData(externalResults = null) {
            console.log('watchSolverData called with:', externalResults);
            
            // Accept results passed in via x-effect
            // Because we removed solverState: null, 'this.solverState' might reference the parent's solverState 
            // if Alpine scope inheritance is working, but passing it explicitly is safer.
            const parentSolverResults = externalResults;

            // Update local solverData if parent has new results (and it's different from current)
            if (parentSolverResults && parentSolverResults !== this.solverData) {
                const wasDataEmpty = !this.solverData;
                this.solverData = parentSolverResults;
                // Automatically switch to solver data when new results arrive
                this.activeDataSource = 'solver';
                console.log('New solver data received, switched active source to Solver', parentSolverResults);
                
                // Auto-render if solver is selected and we have code ready
                if (wasDataEmpty && this.code && this.code.trim() !== '') {
                    // Use $nextTick to ensure DOM is ready, then trigger render
                    this.$nextTick(() => {
                        console.log('Auto-rendering with new solver data');
                        this.runCode();
                    });
                }
            } else if (!parentSolverResults && this.solverData) {
                // Clear solver data when parent data is cleared (e.g., new run or reset)
                this.solverData = null;
                if (this.activeDataSource === 'solver' && this.csvData) {
                    this.activeDataSource = 'csv';
                } else if (this.activeDataSource === 'solver') {
                    this.activeDataSource = null;
                }
            }
        },
        
        loadTemplate(templateId) {
            if (typeof legacyTemplates !== 'undefined' && legacyTemplates[templateId]) {
                this.currentTemplateId = templateId;
                
                // Load saved code for this template, or use default template code
                const savedCode = localStorage.getItem(`vis-code-${templateId}`);
                if (savedCode) {
                    this.code = savedCode;
                } else {
                    this.code = legacyTemplates[templateId].code;
                }
                
                this.error = null;
                
                // Save template preference and code to localStorage
                localStorage.setItem('vis-current-template', this.currentTemplateId);
                localStorage.setItem(`vis-code-${this.currentTemplateId}`, this.code);
                
                // Update editor if available (even if not visible)
                if (this.editor && this.editor.setValue) {
                    this.editor.setValue(this.code);
                }
                
                // Don't auto-run - user will click Render button
            }
        },
        
        runCode() {
            // 1. Sync Code State: Get latest code from editor if active
            if (this.editor && this.editor.getValue) {
                try {
                    const editorCode = this.editor.getValue();
                    if (editorCode) {
                        this.code = editorCode;
                        localStorage.setItem(`vis-code-${this.currentTemplateId}`, this.code);
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
            
            // 4. Get Container
            const container = this.$refs.chartContainer;
            if (!container) {
                this.error = { message: 'Chart container not found in DOM', line: 0 };
                return;
            }
            
            // 5. Prepare Execution Environment
            this.error = null;
            container.innerHTML = ''; // Clear previous plot
            
            try {
                // 6. Transform Data if needed
                // Solver data always needs transformation to match the expected schema for templates
                let transformedData = dataToUse;
                
                if (this.activeDataSource === 'solver') {
                     transformedData = this.transformSolutionResult(dataToUse);
                }
                
                console.log(`Rendering plot with ${this.activeDataSource} data`, transformedData);

                // 7. Execute Code
                // Wrap in IIFE-like structure with Function constructor
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
        
        transformSolutionResult(solutionResult) {
            console.log('transformSolutionResult input:', solutionResult);

            // Error handling for malformed solver results
            if (!solutionResult) {
                throw new Error('Solver results data is null or undefined');
            }
            
            // Backend sends 'test_schedule' (singular) but we need 'test_schedules' (plural)
            // Handle both field names for compatibility
            const testSchedulesArray = solutionResult.test_schedules || solutionResult.test_schedule || [];
            
            if (!Array.isArray(testSchedulesArray)) {
                // If test_schedules/test_schedule is missing or not an array, return empty structure
                console.warn('Solver results missing test_schedules/test_schedule array, using empty array', solutionResult);
                return {
                    test_schedules: [],
                    equipment_usage: [],
                    fte_usage: [],
                    concurrency_timeseries: []
                };
            }
            
            // Transform SolutionResult JSON to match legacy CSV format
            // This allows templates to work with both formats
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
        
        generateConcurrencyTimeseries(solutionResult, testSchedulesArray = null) {
            // Simplified concurrency timeseries - in production this would be more sophisticated
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
                    available_fte: 10, // Placeholder - would need resource data
                    available_equipment: 10, // Placeholder
                    capacity_min: 10 // Placeholder
                });
            }
            
            return timeseries;
        },
        
        switchDataSource(source) {
            console.log('Switching data source to:', source);
            if (source === 'solver') {
                // Allow switching to solver even without data (user may be waiting for solver to complete)
                this.activeDataSource = 'solver';
                this.error = null;
                // Auto-render if solver data is available
                if (this.solverData && this.code && this.code.trim() !== '') {
                    this.$nextTick(() => {
                        this.runCode();
                    });
                }
            } else if (source === 'csv') {
                // Allow switching to CSV even without data (user may want to upload)
                this.activeDataSource = 'csv';
                this.error = null;
                // Auto-render if CSV data is available
                if (this.csvData && this.code && this.code.trim() !== '') {
                    this.$nextTick(() => {
                        this.runCode();
                    });
                }
            }
            // Note: Auto-render only happens if data exists, otherwise user will upload/run solver first
        },
        
        async processCSVFile(file) {
            if (!file) return;
            
            // Check file size (10MB limit with warning)
            const fileSizeMB = file.size / (1024 * 1024);
            if (fileSizeMB > 10) {
                console.warn(`File size (${fileSizeMB.toFixed(2)}MB) exceeds recommended 10MB limit`);
            }
            
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
                
                // Transform CSV data to TransformedVisualizationData format
                const transformedData = this.transformCSVData(parseResult.data);
                
                // Update state
                this.csvData = transformedData;
                this.activeDataSource = 'csv';
                console.log('CSV data loaded, switched active source to CSV');
                
                // Don't auto-run - user will click Render button
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
        
        transformCSVData(csvRows) {
            // Transform CSV rows to TransformedVisualizationData format
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
        }
    };
}
