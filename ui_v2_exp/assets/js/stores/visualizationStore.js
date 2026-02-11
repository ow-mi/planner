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

         // Template renderer map - safe, static implementations
         getTemplateRenderer() {
             const templateId = this.currentTemplateId;
             
             // Only allow allowlisted templates
             const allowlistedTemplates = ['gantt-tests', 'equipment', 'fte', 'concurrency'];
             if (!allowlistedTemplates.includes(templateId)) {
                 throw new Error(`Invalid template: ${templateId}. Only built-in templates are allowed.`);
             }
             
             // Verify template exists in templates object
             if (!this.templates || !this.templates[templateId]) {
                 throw new Error(`Template not found: ${templateId}`);
             }
             
             // Return the appropriate renderer based on template ID
             switch (templateId) {
                 case 'gantt-tests':
                     return this.renderGanttTests;
                 case 'equipment':
                     return this.renderEquipment;
                 case 'fte':
                     return this.renderFTE;
                 case 'concurrency':
                     return this.renderConcurrency;
                 default:
                     throw new Error(`Unsupported template: ${templateId}`);
             }
         },

         // Gantt chart renderer - Tests by Leg
         renderGanttTests(data, container) {
             if (!data || !data.test_schedules || data.test_schedules.length === 0) {
                 const text = d3.select(container).append('text')
                     .attr('x', 400)
                     .attr('y', 200)
                     .attr('text-anchor', 'middle')
                     .style('font-size', '18px')
                     .style('fill', '#666')
                     .text('No test schedule data available');
                 return;
             }

             const processed = data.test_schedules.map(d => {
                 const start = d.start_date ? new Date(d.start_date) : new Date();
                 const end = d.end_date ? new Date(d.end_date) : new Date();
                 return {
                     id: `${d.project_leg_id}-${d.test_name || d.test_id}`,
                     leg: d.project_leg_id || 'Unknown',
                     test: d.test_name || d.test_id || 'Test',
                     start,
                     end,
                     equipment: d.assigned_equipment_id || '',
                     fte: d.assigned_fte_id || ''
                 };
             });

             const rect = container.getBoundingClientRect();
             const availableWidth = Math.max(400, rect.width - 40);
             const availableHeight = Math.max(300, rect.height - 40);

             const margin = { top: 100, right: 80, bottom: 80, left: 150 };
             const width = availableWidth - margin.left - margin.right;
             const height = availableHeight - margin.top - margin.bottom;

             const svg = d3.select(container)
                 .append('svg')
                 .attr('width', availableWidth)
                 .attr('height', availableHeight);

             const g = svg.append('g')
                 .attr('transform', `translate(${margin.left},${margin.top})`);

             const legs = [...new Set(processed.map(d => d.leg))].sort();
             const yScale = d3.scaleBand()
                 .domain(legs)
                 .range([0, height])
                 .padding(0.1);

             const minStart = d3.min(processed, d => d.start);
             const maxEnd = d3.max(processed, d => d.end);
             const xScale = d3.scaleTime()
                 .domain([minStart, maxEnd])
                 .range([0, width])
                 .nice();

             g.selectAll('rect.bar')
                 .data(processed)
                 .enter()
                 .append('rect')
                 .attr('class', 'bar')
                 .attr('x', d => xScale(d.start))
                 .attr('y', d => yScale(d.leg))
                 .attr('width', d => Math.max(1, xScale(d.end) - xScale(d.start)))
                 .attr('height', yScale.bandwidth())
                 .attr('fill', '#4a90e2')
                 .attr('stroke', '#333')
                 .attr('stroke-width', 1)
                 .append('title')
                 .text(d => `${d.test}\n${d.leg}\nDuration: ${Math.round((d.end - d.start) / 86400000)} days`);

             g.append('g')
                 .attr('class', 'x-axis')
                 .attr('transform', `translate(0,${height})`)
                 .call(d3.axisBottom(xScale));

             g.append('g')
                 .attr('class', 'y-axis')
                 .call(d3.axisLeft(yScale));

             svg.append('text')
                 .attr('x', availableWidth / 2)
                 .attr('y', 30)
                 .attr('text-anchor', 'middle')
                 .style('font-size', '20px')
                 .style('font-weight', 'bold')
                 .text('Tests by Leg - Gantt Chart');
         },

         // Equipment utilization renderer
         renderEquipment(data, container) {
             if (!data || !data.equipment_usage || data.equipment_usage.length === 0) {
                 const text = d3.select(container).append('text')
                     .attr('x', 400)
                     .attr('y', 200)
                     .attr('text-anchor', 'middle')
                     .style('font-size', '18px')
                     .style('fill', '#666')
                     .text('No equipment usage data available');
                 return;
             }

             const processed = data.equipment_usage.map(d => {
                 const start = d.start_date ? new Date(d.start_date) : new Date();
                 const end = d.end_date ? new Date(d.end_date) : new Date();
                 return {
                     equipment: d.equipment_id || 'Unknown',
                     test: d.test_name || d.test_id || 'Test',
                     start,
                     end
                 };
             });

             const rect = container.getBoundingClientRect();
             const availableWidth = Math.max(400, rect.width - 40);
             const availableHeight = Math.max(300, rect.height - 40);

             const margin = { top: 50, right: 80, bottom: 100, left: 120 };
             const width = availableWidth - margin.left - margin.right;
             const height = availableHeight - margin.top - margin.bottom;

             const svg = d3.select(container)
                 .append('svg')
                 .attr('width', availableWidth)
                 .attr('height', availableHeight);

             const g = svg.append('g')
                 .attr('transform', `translate(${margin.left},${margin.top})`);

             const equipmentList = [...new Set(processed.map(d => d.equipment))];
             const yScale = d3.scaleBand()
                 .domain(equipmentList)
                 .range([0, height])
                 .padding(0.2);

             const minStart = d3.min(processed, d => d.start);
             const maxEnd = d3.max(processed, d => d.end);
             const xScale = d3.scaleTime()
                 .domain([minStart, maxEnd])
                 .range([0, width])
                 .nice();

             const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

             g.selectAll('rect.bar')
                 .data(processed)
                 .enter()
                 .append('rect')
                 .attr('class', 'bar')
                 .attr('x', d => xScale(d.start))
                 .attr('y', d => yScale(d.equipment))
                 .attr('width', d => Math.max(1, xScale(d.end) - xScale(d.start)))
                 .attr('height', yScale.bandwidth())
                 .attr('fill', d => colorScale(d.equipment))
                 .attr('stroke', '#333')
                 .attr('stroke-width', 1)
                 .append('title')
                 .text(d => `${d.test}\nEquipment: ${d.equipment}`);

             g.append('g')
                 .attr('transform', `translate(0,${height})`)
                 .call(d3.axisBottom(xScale));

             g.append('g')
                 .call(d3.axisLeft(yScale));

             svg.append('text')
                 .attr('x', availableWidth / 2)
                 .attr('y', 28)
                 .attr('text-anchor', 'middle')
                 .style('font-size', '18px')
                 .style('font-weight', 'bold')
                 .text('Equipment Utilization');
         },

         // FTE utilization renderer
         renderFTE(data, container) {
             if (!data || !data.fte_usage || data.fte_usage.length === 0) {
                 const text = d3.select(container).append('text')
                     .attr('x', 400)
                     .attr('y', 200)
                     .attr('text-anchor', 'middle')
                     .style('font-size', '18px')
                     .style('fill', '#666')
                     .text('No FTE usage data available');
                 return;
             }

             const processed = data.fte_usage.map(d => {
                 const start = d.start_date ? new Date(d.start_date) : new Date();
                 const end = d.end_date ? new Date(d.end_date) : new Date();
                 return {
                     fte: d.fte_id || 'Unknown',
                     test: d.test_name || d.test_id || 'Test',
                     start,
                     end
                 };
             });

             const rect = container.getBoundingClientRect();
             const availableWidth = Math.max(400, rect.width - 40);
             const availableHeight = Math.max(300, rect.height - 40);

             const margin = { top: 50, right: 80, bottom: 100, left: 120 };
             const width = availableWidth - margin.left - margin.right;
             const height = availableHeight - margin.top - margin.bottom;

             const svg = d3.select(container)
                 .append('svg')
                 .attr('width', availableWidth)
                 .attr('height', availableHeight);

             const g = svg.append('g')
                 .attr('transform', `translate(${margin.left},${margin.top})`);

             const ftes = [...new Set(processed.map(d => d.fte))];
             const yScale = d3.scaleBand()
                 .domain(ftes)
                 .range([0, height])
                 .padding(0.2);

             const minStart = d3.min(processed, d => d.start);
             const maxEnd = d3.max(processed, d => d.end);
             const xScale = d3.scaleTime()
                 .domain([minStart, maxEnd])
                 .range([0, width])
                 .nice();

             const colorScale = d3.scaleOrdinal(d3.schemeSet2);

             g.selectAll('rect.bar')
                 .data(processed)
                 .enter()
                 .append('rect')
                 .attr('class', 'bar')
                 .attr('x', d => xScale(d.start))
                 .attr('y', d => yScale(d.fte))
                 .attr('width', d => Math.max(1, xScale(d.end) - xScale(d.start)))
                 .attr('height', yScale.bandwidth())
                 .attr('fill', d => colorScale(d.fte))
                 .attr('stroke', '#333')
                 .attr('stroke-width', 1)
                 .append('title')
                 .text(d => `${d.test}\nFTE: ${d.fte}`);

             g.append('g')
                 .attr('transform', `translate(0,${height})`)
                 .call(d3.axisBottom(xScale));

             g.append('g')
                 .call(d3.axisLeft(yScale));

             svg.append('text')
                 .attr('x', availableWidth / 2)
                 .attr('y', 28)
                 .attr('text-anchor', 'middle')
                 .style('font-size', '18px')
                 .style('font-weight', 'bold')
                 .text('FTE Utilization');
         },

         // Concurrency timeseries renderer
         renderConcurrency(data, container) {
             if (!data || !data.concurrency_timeseries || data.concurrency_timeseries.length === 0) {
                 const text = d3.select(container).append('text')
                     .attr('x', 400)
                     .attr('y', 200)
                     .attr('text-anchor', 'middle')
                     .style('font-size', '18px')
                     .style('fill', '#666')
                     .text('No concurrency data available');
                 return;
             }

             const processed = data.concurrency_timeseries.map(d => ({
                 timestamp: d.timestamp ? new Date(d.timestamp) : new Date(),
                 active_tests: +d.active_tests || 0,
                 capacity_min: +d.capacity_min || 0
             }));

             const rect = container.getBoundingClientRect();
             const availableWidth = Math.max(400, rect.width - 40);
             const availableHeight = Math.max(300, rect.height - 40);

             const margin = { top: 50, right: 80, bottom: 100, left: 120 };
             const width = availableWidth - margin.left - margin.right;
             const height = availableHeight - margin.top - margin.bottom;

             const svg = d3.select(container)
                 .append('svg')
                 .attr('width', availableWidth)
                 .attr('height', availableHeight);

             const g = svg.append('g')
                 .attr('transform', `translate(${margin.left},${margin.top})`);

             const minTime = d3.min(processed, d => d.timestamp);
             const maxTime = d3.max(processed, d => d.timestamp);
             const maxValue = d3.max(processed, d => Math.max(d.active_tests, d.capacity_min)) * 1.1;

             const xScale = d3.scaleTime()
                 .domain([minTime, maxTime])
                 .range([0, width])
                 .nice();

             const yScale = d3.scaleLinear()
                 .domain([0, maxValue])
                 .range([height, 0])
                 .nice();

             const capacityLine = d3.line()
                 .x(d => xScale(d.timestamp))
                 .y(d => yScale(d.capacity_min))
                 .curve(d3.curveStepAfter);

             g.append('path')
                 .datum(processed)
                 .attr('class', 'capacity-line')
                 .attr('fill', 'none')
                 .attr('stroke', '#ff0000')
                 .attr('stroke-width', 2)
                 .attr('stroke-dasharray', '5,5')
                 .attr('d', capacityLine);

             const activeLine = d3.line()
                 .x(d => xScale(d.timestamp))
                 .y(d => yScale(d.active_tests))
                 .curve(d3.curveMonotoneX);

             g.append('path')
                 .datum(processed)
                 .attr('class', 'active-line')
                 .attr('fill', 'none')
                 .attr('stroke', '#1f77b4')
                 .attr('stroke-width', 2)
                 .attr('d', activeLine);

             g.append('g')
                 .attr('transform', `translate(0,${height})`)
                 .call(d3.axisBottom(xScale));

             g.append('g')
                 .call(d3.axisLeft(yScale));

             const legend = g.append('g')
                 .attr('transform', `translate(${width - 120}, 20)`);

             legend.append('line')
                 .attr('x1', 0)
                 .attr('x2', 20)
                 .attr('y1', 0)
                 .attr('y2', 0)
                 .attr('stroke', '#1f77b4')
                 .attr('stroke-width', 2);

             legend.append('text')
                 .attr('x', 25)
                 .attr('y', 0)
                 .attr('dy', '0.35em')
                 .style('font-size', '12px')
                 .text('Active Tests');

             legend.append('line')
                 .attr('x1', 0)
                 .attr('x2', 20)
                 .attr('y1', 20)
                 .attr('y2', 20)
                 .attr('stroke', '#ff0000')
                 .attr('stroke-width', 2)
                 .attr('stroke-dasharray', '5,5');

             legend.append('text')
                 .attr('x', 25)
                 .attr('y', 20)
                 .attr('dy', '0.35em')
                 .style('font-size', '12px')
                 .text('Capacity');

             svg.append('text')
                 .attr('x', availableWidth / 2)
                 .attr('y', 28)
                 .attr('text-anchor', 'middle')
                 .style('font-size', '18px')
                 .style('font-weight', 'bold')
                 .text('Active Tests vs Capacity Over Time');
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
          runCode(containerElement) {
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

             // 2. Validate container
             if (!containerElement) {
                 this.error = { message: 'No container element provided for rendering.', line: 0 };
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

             // 5. Safe template renderer dispatch
             try {
                 const renderer = this.getTemplateRenderer();
                 renderer.call(this, transformedData, containerElement);
                 this.error = null; // Clear any previous errors on success
             } catch (err) {
                 this.error = {
                     message: err.message || 'Visualization rendering failed',
                     line: 0,
                     stack: err.stack
                 };
                 console.error('Rendering error:', err);
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
