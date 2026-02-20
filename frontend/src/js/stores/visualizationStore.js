/**
 * Visualization Store - Alpine.js Store for Visualization Management
 *
 * Manages visualization data, templates, and rendering
 */

// Storage key constants for consistency
const VIS_STORAGE_KEYS = {
    VIS_ACTIVE_DATA_SOURCE: 'ui_v2_exp__vis__activeDataSource',
    VIS_CURRENT_TEMPLATE: 'ui_v2_exp__vis__currentTemplate',
    VIS_SELECTED_SOLVER_RUN: 'ui_v2_exp__vis__selectedSolverRun'
};

// Get storage key for template code
function getVisCodeKey(templateId) {
    return `ui_v2_exp__vis__code__${templateId}`;
}

// Helper to migrate legacy storage keys to new namespaced format
function migrateLegacyVisualizationStorage() {
    const legacyMappings = {
        'vis-active-data-source': VIS_STORAGE_KEYS.VIS_ACTIVE_DATA_SOURCE,
        'vis-current-template': VIS_STORAGE_KEYS.VIS_CURRENT_TEMPLATE
    };

    Object.entries(legacyMappings).forEach(([oldKey, newKey]) => {
        const data = localStorage.getItem(oldKey);
        if (data && !localStorage.getItem(newKey)) {
            localStorage.setItem(newKey, data);
        }
    });

    // Migrate template code keys (vis-code-* to ui_v2_exp__vis__code__*)
    const visCodePrefix = 'vis-code-';
    const newPrefix = 'ui_v2_exp__vis__code__';
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(visCodePrefix)) {
            const templateId = key.substring(visCodePrefix.length);
            const newKey = newPrefix + templateId;
            if (!localStorage.getItem(newKey)) {
                const data = localStorage.getItem(key);
                if (data) {
                    localStorage.setItem(newKey, data);
                }
            }
        }
    }
}

document.addEventListener('alpine:init', () => {
    Alpine.store('visualization', {
        // State
        solverData: null,
        selectedSolverRunId: '',
        csvData: null,
        activeDataSource: 'solver', // 'solver' or 'csv'
        currentTemplateId: 'gantt-tests',
        code: '',
        error: null,
        isInitialized: false,
        autoRun: false,
        isEditorVisible: false,
        isLoading: false,
        editor: null,
        editorInitialized: false,
        templates: {},
        activePlotTab: 'gantt-tests',
        renderedPlots: {
            'gantt-tests': false,
            'equipment': false,
            'fte': false,
            'concurrency': false
        },
        plotContainers: {},

        // Initialization
        init() {
            try {
                if (this.isInitialized) {
                    console.log('[visualizationStore] Already initialized, skipping');
                    return;
                }
                console.log('Visualization store initialized');
                migrateLegacyVisualizationStorage();
                this.loadTemplates();
                this.setActivePlotTab(this.currentTemplateId);
                this.loadFromLocalStorage();
                this.isInitialized = true;
            } catch (error) {
                console.error('VisualizationStore init failed:', error);
                this.error = 'Failed to initialize visualization storage';
            }
        },

        // Load visualization templates
        loadTemplates() {
            // Load legacy templates
            if (typeof legacyTemplates !== 'undefined') {
                this.templates = { ...legacyTemplates };
            }

            // Load saved template preference
            const savedTemplateId = localStorage.getItem(VIS_STORAGE_KEYS.VIS_CURRENT_TEMPLATE);
            if (savedTemplateId && this.templates[savedTemplateId]) {
                this.currentTemplateId = savedTemplateId;
            }

            // Load saved template code
            const savedCode = localStorage.getItem(getVisCodeKey(this.currentTemplateId));
            if (savedCode) {
                this.code = savedCode;
            } else if (this.templates[this.currentTemplateId]) {
                this.code = this.templates[this.currentTemplateId].code;
            }
        },

        // Load from localStorage
        loadFromLocalStorage() {
            try {
                const savedDataSource = localStorage.getItem(VIS_STORAGE_KEYS.VIS_ACTIVE_DATA_SOURCE);
                if (savedDataSource) {
                    this.activeDataSource = savedDataSource;
                }
                const savedSelectedSolverRun = localStorage.getItem(VIS_STORAGE_KEYS.VIS_SELECTED_SOLVER_RUN);
                if (savedSelectedSolverRun !== null) {
                    this.selectedSolverRunId = savedSelectedSolverRun;
                }
            } catch (error) {
                console.error('Failed to load visualization state from localStorage:', error);
            }
        },

        // Save to localStorage
        saveToLocalStorage() {
            try {
                localStorage.setItem(VIS_STORAGE_KEYS.VIS_ACTIVE_DATA_SOURCE, this.activeDataSource);
                localStorage.setItem(VIS_STORAGE_KEYS.VIS_CURRENT_TEMPLATE, this.currentTemplateId);
                localStorage.setItem(VIS_STORAGE_KEYS.VIS_SELECTED_SOLVER_RUN, this.selectedSolverRunId || '');
                localStorage.setItem(getVisCodeKey(this.currentTemplateId), this.code);
            } catch (error) {
                console.error('Failed to save visualization state to localStorage:', error);
            }
        },

        // Reset template code to default
        resetTemplateCode(templateId = this.currentTemplateId) {
            if (this.templates && this.templates[templateId]) {
                this.code = this.templates[templateId].code;
                this.saveToLocalStorage();
                
                // Update editor if initialized
                if (this.editor && this.editor.setValue) {
                    this.editor.setValue(this.code);
                }
                
                return true;
            }
            return false;
        },

         // Template renderer - executes template code with data and container
         getTemplateRenderer(templateId = this.currentTemplateId) {
             
             // Only allow allowlisted templates
             const allowlistedTemplates = ['gantt-tests', 'equipment', 'fte', 'concurrency'];
             if (!allowlistedTemplates.includes(templateId)) {
                 throw new Error(`Invalid template: ${templateId}. Only built-in templates are allowed.`);
             }
             
             // Verify template exists
             if (!this.templates || !this.templates[templateId]) {
                 throw new Error(`Template not found: ${templateId}`);
             }
             
             // Return renderer that executes template code
             return function(data, container) {
                 // Use edited code if available, otherwise fall back to template default
                 const code = this.code || this.templates[templateId]?.code || '';
                 if (!code) {
                     throw new Error(`No code available for template: ${templateId}`);
                 }
                 
                 try {
                     // Execute template code with data, container, and d3 in scope
                     const renderFn = new Function('data', 'container', 'd3', code);
                     renderFn(data, container, d3);
                 } catch (err) {
                     console.error(`Template execution error in ${templateId}:`, err);
                     // Display user-friendly error in container
                     d3.select(container).html('');
                     d3.select(container).append('div')
                         .attr('class', 'template-error')
                         .style('padding', '20px')
                         .style('color', '#cc0000')
                         .style('font-family', 'monospace')
                         .style('background', '#fff5f5')
                         .style('border', '1px solid #cc0000')
                         .style('border-radius', '4px')
                         .html(`<strong>Template Error:</strong><br><pre style="margin: 8px 0; white-space: pre-wrap;">${err.message}</pre>`);
                 }
             };
         },
         
         // Helper to escape HTML in error messages
         escapeHtml(str) {
             const div = document.createElement('div');
             div.textContent = str;
             return div.innerHTML;
         },

         registerPlotContainer(templateId, containerElement) {
             if (templateId && containerElement) {
                 this.plotContainers[templateId] = containerElement;
             }
         },

         getPlotContainer(templateId = this.currentTemplateId) {
             return this.plotContainers[templateId] || null;
         },

         setActivePlotTab(templateId) {
             const allowlistedTemplates = ['gantt-tests', 'equipment', 'fte', 'concurrency'];
             if (allowlistedTemplates.includes(templateId)) {
                 this.activePlotTab = templateId;
             }
         },

         markPlotRendered(templateId) {
             if (Object.prototype.hasOwnProperty.call(this.renderedPlots, templateId)) {
                 this.renderedPlots[templateId] = true;
             }
         },

         isPlotRendered(templateId) {
             return !!this.renderedPlots[templateId];
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
                this.setActivePlotTab(templateId);

                // Load saved code for this template, or use default template code
                const savedCode = localStorage.getItem(getVisCodeKey(templateId));
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
          runCode(containerElement, templateId = this.currentTemplateId) {
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

             const targetTemplateId = templateId || this.currentTemplateId;
             const targetContainer = containerElement || this.getPlotContainer(targetTemplateId);

             // 2. Validate container
             if (!targetContainer) {
                  this.error = { message: 'No container element provided for rendering.', line: 0 };
                  return false;
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
                  return false;
              }

             // 4. Transform Data if needed
             let transformedData = dataToUse;

             if (this.activeDataSource === 'solver') {
                 transformedData = this.transformSolutionResult(dataToUse);
             }

             console.log(`Rendering plot with ${this.activeDataSource} data`, transformedData);

             // 5. Safe template renderer dispatch
              try {
                  const renderer = this.getTemplateRenderer(targetTemplateId);
                  renderer.call(this, transformedData, targetContainer);
                  this.markPlotRendered(targetTemplateId);
                  this.setActivePlotTab(targetTemplateId);
                  this.error = null; // Clear any previous errors on success
                  return true;
              } catch (err) {
                  this.error = {
                      message: err.message || 'Visualization rendering failed',
                     line: 0,
                     stack: err.stack
                  };
                  console.error('Rendering error:', err);
                  return false;
              }
          },

        // Transform solution result for visualization
        transformSolutionResult(solutionResult) {
            if (!solutionResult) {
                throw new Error('Solver results data is null or undefined');
            }

            // Handle both field names for compatibility.
            // Backend responses are snake_case (`test_schedule`).
            const testSchedulesArray =
                solutionResult.test_schedule ||
                solutionResult.test_schedules ||
                solutionResult.testSchedules ||
                solutionResult.testSchedule ||
                [];

            if (!Array.isArray(testSchedulesArray)) {
                console.warn('Solver results missing testSchedules array, using empty array', solutionResult);
                return {
                    testSchedules: [],
                    equipmentUsage: [],
                    fteUsage: [],
                    concurrencyTimeseries: []
                };
            }

            const fallbackBaseDate = (() => {
                const candidates = testSchedulesArray
                    .map((row) => row?.start_date)
                    .filter((value) => typeof value === 'string' && value.trim().length > 0)
                    .map((value) => new Date(value))
                    .filter((value) => !Number.isNaN(value.getTime()));
                if (candidates.length > 0) {
                    candidates.sort((a, b) => a.getTime() - b.getTime());
                    return candidates[0];
                }
                return new Date();
            })();

            const toIsoDateFromDay = (dayValue) => {
                const day = Number(dayValue);
                if (!Number.isFinite(day)) {
                    return null;
                }
                const date = new Date(fallbackBaseDate);
                date.setDate(date.getDate() + day);
                return date.toISOString().split('T')[0];
            };

            // Transform SolutionResult JSON to match legacy CSV format (with camelCase)
            const concurrencyFromOutput = this.parseConcurrencyTimeseriesFromOutputFiles(solutionResult);
            const transformed = {
                testSchedules: testSchedulesArray.map(s => ({
                    testId: s.test_id,
                    projectLegId: s.project_leg_id,
                    testName: s.test_name,
                    startDate: s.start_date
                        ? (typeof s.start_date === 'string' ? s.start_date : s.start_date.toISOString().split('T')[0])
                        : toIsoDateFromDay(s.start_day),
                    startTime: s.start_date
                        ? (typeof s.start_date === 'string' ? s.start_date.split('T')[1]?.split('.')[0] || '00:00:00' : '00:00:00')
                        : '00:00:00',
                    endDate: s.end_date
                        ? (typeof s.end_date === 'string' ? s.end_date : s.end_date.toISOString().split('T')[0])
                        : toIsoDateFromDay(s.end_day),
                    endTime: s.end_date
                        ? (typeof s.end_date === 'string' ? s.end_date.split('T')[1]?.split('.')[0] || '00:00:00' : '00:00:00')
                        : '00:00:00',
                    assignedEquipmentId: Array.isArray(s.assigned_equipment) ? s.assigned_equipment[0] : (s.assigned_equipment || ''),
                    assignedFteId: Array.isArray(s.assigned_fte) ? s.assigned_fte[0] : (s.assigned_fte || ''),
                    assignedEquipment: Array.isArray(s.assigned_equipment) ? s.assigned_equipment.join(';') : (s.assigned_equipment || ''),
                    assignedFte: Array.isArray(s.assigned_fte) ? s.assigned_fte.join(';') : (s.assigned_fte || '')
                })),
                equipmentUsage: this.generateEquipmentUsage(solutionResult, testSchedulesArray),
                fteUsage: this.generateFTEUsage(solutionResult, testSchedulesArray),
                concurrencyTimeseries: concurrencyFromOutput.length > 0
                    ? concurrencyFromOutput
                    : this.generateConcurrencyTimeseries(solutionResult, testSchedulesArray)
            };
            const missingDateCount = testSchedulesArray.filter(
                (s) => !s?.start_date || !s?.end_date
            ).length;
            if (missingDateCount > 0) {
                console.info('[visualizationStore] Applied day->date fallback for schedules', {
                    missingDateCount,
                    total: testSchedulesArray.length
                });
            }
            return transformed;
        },

        parseConcurrencyTimeseriesFromOutputFiles(solutionResult) {
            const csvText = solutionResult?.output_files?.['concurrency_timeseries.csv'];
            if (!csvText || typeof csvText !== 'string') {
                return [];
            }
            const lines = csvText
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter((line) => line.length > 0);
            if (lines.length < 2) {
                return [];
            }

            const headers = lines[0].split(',').map((header) => String(header || '').trim().toLowerCase());
            const idx = {
                timestamp: headers.indexOf('timestamp'),
                activeTests: headers.indexOf('active_tests'),
                availableFte: headers.indexOf('available_fte'),
                availableEquipment: headers.indexOf('available_equipment'),
                capacityMin: headers.indexOf('capacity_min')
            };
            if (idx.timestamp < 0 || idx.activeTests < 0) {
                return [];
            }

            return lines.slice(1).map((line) => {
                const cells = line.split(',');
                return {
                    timestamp: String(cells[idx.timestamp] || '').trim(),
                    activeTests: Number(cells[idx.activeTests] || 0) || 0,
                    availableFte: idx.availableFte >= 0 ? (Number(cells[idx.availableFte] || 0) || 0) : 0,
                    availableEquipment: idx.availableEquipment >= 0 ? (Number(cells[idx.availableEquipment] || 0) || 0) : 0,
                    capacityMin: idx.capacityMin >= 0 ? (Number(cells[idx.capacityMin] || 0) || 0) : 0
                };
            });
        },

        // Generate equipment usage data
        generateEquipmentUsage(solutionResult, testSchedulesArray = null) {
            const usage = [];
            const schedules =
                testSchedulesArray ||
                solutionResult.test_schedule ||
                solutionResult.test_schedules ||
                solutionResult.testSchedules ||
                solutionResult.testSchedule ||
                [];
            schedules.forEach(schedule => {
                const equipmentList = Array.isArray(schedule.assigned_equipment) ? schedule.assigned_equipment : [schedule.assigned_equipment].filter(Boolean);
                equipmentList.forEach(eqId => {
                    usage.push({
                        equipmentId: eqId,
                        testId: schedule.test_id,
                        testName: schedule.test_name,
                        startDate: schedule.start_date ? (typeof schedule.start_date === 'string' ? schedule.start_date : schedule.start_date.toISOString().split('T')[0]) : null,
                        endDate: schedule.end_date ? (typeof schedule.end_date === 'string' ? schedule.end_date : schedule.end_date.toISOString().split('T')[0]) : null
                    });
                });
            });
            return usage;
        },

        // Generate FTE usage data
        generateFTEUsage(solutionResult, testSchedulesArray = null) {
            const usage = [];
            const schedules =
                testSchedulesArray ||
                solutionResult.test_schedule ||
                solutionResult.test_schedules ||
                solutionResult.testSchedules ||
                solutionResult.testSchedule ||
                [];
            schedules.forEach(schedule => {
                const fteList = Array.isArray(schedule.assigned_fte) ? schedule.assigned_fte : [schedule.assigned_fte].filter(Boolean);
                fteList.forEach(fteId => {
                    usage.push({
                        fteId: fteId,
                        testId: schedule.test_id,
                        testName: schedule.test_name,
                        startDate: schedule.start_date ? (typeof schedule.start_date === 'string' ? schedule.start_date : schedule.start_date.toISOString().split('T')[0]) : null,
                        endDate: schedule.end_date ? (typeof schedule.end_date === 'string' ? schedule.end_date : schedule.end_date.toISOString().split('T')[0]) : null
                    });
                });
            });
            return usage;
        },

        // Generate concurrency timeseries data
        generateConcurrencyTimeseries(solutionResult, testSchedulesArray = null) {
            const timeseries = [];
            const schedules =
                testSchedulesArray ||
                solutionResult.test_schedule ||
                solutionResult.test_schedules ||
                solutionResult.testSchedules ||
                solutionResult.testSchedule ||
                [];

            if (schedules.length === 0) return timeseries;

            // Get date range
            const dates = schedules.flatMap(s => [
                s.start_date ? (typeof s.start_date === 'string' ? new Date(s.start_date) : new Date(s.start_date)) : null,
                s.end_date ? (typeof s.end_date === 'string' ? new Date(s.end_date) : new Date(s.end_date)) : null
            ]).filter(Boolean);

            if (dates.length === 0) return timeseries;

            const minDate = new Date(Math.min(...dates));
            const maxDate = new Date(Math.max(...dates));
            const totalFteCapacity = new Set(
                schedules.flatMap((schedule) => {
                    const assigned = schedule.assigned_fte;
                    if (Array.isArray(assigned)) {
                        return assigned.map((id) => String(id || '').trim()).filter(Boolean);
                    }
                    return String(assigned || '')
                        .split(';')
                        .map((id) => id.trim())
                        .filter(Boolean);
                })
            ).size;
            const totalEquipmentCapacity = new Set(
                schedules.flatMap((schedule) => {
                    const assigned = schedule.assigned_equipment;
                    if (Array.isArray(assigned)) {
                        return assigned.map((id) => String(id || '').trim()).filter(Boolean);
                    }
                    return String(assigned || '')
                        .split(';')
                        .map((id) => id.trim())
                        .filter(Boolean);
                })
            ).size;

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
                    activeTests: activeTests,
                    availableFte: totalFteCapacity,
                    availableEquipment: totalEquipmentCapacity,
                    capacityMin: Math.min(totalFteCapacity, totalEquipmentCapacity)
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
                    testId: row.test_id || '',
                    projectLegId: row.project_leg_id || '',
                    testName: row.test_name || row.test_id || '',
                    startDate: startDate,
                    startTime: '00:00:00',
                    endDate: endDate,
                    endTime: '00:00:00',
                    assignedEquipmentId: equipmentList[0] || '',
                    assignedFteId: fteList[0] || '',
                    assignedEquipment: equipmentList.join(';'),
                    assignedFte: fteList.join(';')
                };
            });

            // Generate equipment usage, FTE usage, and concurrency timeseries
            const equipmentUsage = [];
            const fteUsage = [];

            testSchedules.forEach(schedule => {
                const equipmentList = schedule.assignedEquipment ? schedule.assignedEquipment.split(';').filter(Boolean) : [];
                const fteList = schedule.assignedFte ? schedule.assignedFte.split(';').filter(Boolean) : [];

                equipmentList.forEach(eqId => {
                    equipmentUsage.push({
                        equipmentId: eqId,
                        testId: schedule.testId,
                        testName: schedule.testName,
                        startDate: schedule.startDate,
                        endDate: schedule.endDate
                    });
                });

                fteList.forEach(fteId => {
                    fteUsage.push({
                        fteId: fteId,
                        testId: schedule.testId,
                        testName: schedule.testName,
                        startDate: schedule.startDate,
                        endDate: schedule.endDate
                    });
                });
            });

            // Generate concurrency timeseries
            const concurrencyTimeseries = this.generateConcurrencyTimeseriesFromSchedules(testSchedules);

            return {
                testSchedules: testSchedules,
                equipmentUsage: equipmentUsage,
                fteUsage: fteUsage,
                concurrencyTimeseries: concurrencyTimeseries
            };
        },

        // Generate concurrency timeseries from schedules
        generateConcurrencyTimeseriesFromSchedules(testSchedules) {
            const timeseries = [];

            if (testSchedules.length === 0) return timeseries;

            // Get date range
            const dates = testSchedules.flatMap(s => {
                const dates = [];
                if (s.startDate) dates.push(new Date(s.startDate));
                if (s.endDate) dates.push(new Date(s.endDate));
                return dates;
            }).filter(Boolean);

            if (dates.length === 0) return timeseries;

            const minDate = new Date(Math.min(...dates));
            const maxDate = new Date(Math.max(...dates));
            const fteCapacity = new Set(
                testSchedules.flatMap((schedule) =>
                    String(schedule.assigned_fte || '')
                        .split(';')
                        .map((id) => id.trim())
                        .filter(Boolean)
                )
            ).size;
            const equipmentCapacity = new Set(
                testSchedules.flatMap((schedule) =>
                    String(schedule.assigned_equipment || '')
                        .split(';')
                        .map((id) => id.trim())
                        .filter(Boolean)
                )
            ).size;

            // Generate daily timestamps
            for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
                const timestamp = new Date(d);
                let activeTests = 0;

                testSchedules.forEach(s => {
                    const start = s.startDate ? new Date(s.startDate) : null;
                    const end = s.endDate ? new Date(s.endDate) : null;
                    if (start && end && timestamp >= start && timestamp < end) {
                        activeTests++;
                    }
                });

                timeseries.push({
                    timestamp: timestamp.toISOString(),
                    activeTests: activeTests,
                    availableFte: fteCapacity,
                    availableEquipment: equipmentCapacity,
                    capacityMin: Math.min(fteCapacity, equipmentCapacity)
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

        hasCsvData() {
            return !!this.csvData;
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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        VIS_STORAGE_KEYS,
        getVisCodeKey
    };
}
