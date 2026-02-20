/**
 * Visualizer Component - Alpine.js Component
 *
 * This file defines the Alpine.js component for the visualization panel.
 * It must be loaded BEFORE Alpine.js initializes to ensure x-data works correctly.
 */

function visualizerComponent() {
    return {
        plotTabs: [
            { id: 'gantt-tests', label: 'Gantt Tests' },
            { id: 'equipment', label: 'Equipment' },
            { id: 'fte', label: 'FTE' },
            { id: 'concurrency', label: 'Concurrency' }
        ],

        init() {
            console.log('Visualizer component initialized');

            this.$nextTick(() => {
                this.registerPlotContainers();
                this.applySelectedSolverRun();
            });

            // Watch for solver data changes
            this.$watch('$store.solver.results', (newResults) => {
                if (newResults) {
                    this.syncSelectedSolverRunWithStore();
                    if (!this.selectedSolverRunId) {
                        this.$store.visualization.solverData = newResults;
                        this.$store.visualization.activeDataSource = 'solver';
                    }

                    // Auto-render if we have code
                    if (this.$store.visualization.code && this.$store.visualization.code.trim() !== '') {
                        this.runCode();
                    }
                }
            });
            this.$watch('$store.solver.scenarios', () => {
                this.syncSelectedSolverRunWithStore();
            });

             // Watch for template changes to re-initialize editor
             this.$watch('currentTemplateId', () => {
                 if (this.isEditorVisible && this.$refs.editorContainer) {
                     this.$nextTick(() => {
                         this.initializeEditor();
                     });
                 }
             });

             // Watch for editor visibility changes
             this.$watch('$store.visualization.isEditorVisible', (isVisible) => {
                  if (isVisible && this.$refs.editorContainer) {
                      // Ensure editor is properly initialized
                      this.$nextTick(() => {
                          this.initializeEditor();
                      });
                  }
              });

             this.$watch('$store.visualization.currentTemplateId', (templateId) => {
                 if (templateId) {
                     this.$store.visualization.setActivePlotTab(templateId);
                 }
             });
        },

        registerPlotContainers() {
            this.plotTabs.forEach((tab) => {
                const refName = this.getPlotRefName(tab.id);
                const container = this.$refs[refName];
                if (container) {
                    this.$store.visualization.registerPlotContainer(tab.id, container);
                }
            });
        },

        getPlotRefName(templateId) {
            switch (templateId) {
                case 'gantt-tests':
                    return 'chartContainerGantt';
                case 'equipment':
                    return 'chartContainerEquipment';
                case 'fte':
                    return 'chartContainerFte';
                case 'concurrency':
                    return 'chartContainerConcurrency';
                default:
                    return 'chartContainerGantt';
            }
        },

        selectPlotTab(templateId) {
            this.$store.visualization.setActivePlotTab(templateId);
            if (this.currentTemplateId !== templateId) {
                this.loadTemplate(templateId);
            }
        },

        isPlotRendered(templateId) {
            return this.$store.visualization.isPlotRendered(templateId);
        },

        getPlotTabLabel(templateId, label) {
            return `${label}${this.isPlotRendered(templateId) ? ' ✓' : ''}`;
        },

        // Initialize editor (Called when editor is shown or template changes)
        initializeEditor() {
            // Always try to initialize - initEditor in store handles cleanup
            const editorContainer = this.$refs.editorContainer;
            if (editorContainer) {
                this.$store.visualization.initEditor(editorContainer);
            }
        },

        // Access store properties
        get currentTemplateId() {
            return this.$store.visualization.currentTemplateId;
        },

        set currentTemplateId(value) {
            this.$store.visualization.currentTemplateId = value;
        },

        get activeDataSource() {
            return this.$store.visualization.activeDataSource;
        },

        get selectedSolverRunId() {
            return this.$store.visualization.selectedSolverRunId || '';
        },

        set selectedSolverRunId(value) {
            this.$store.visualization.selectedSolverRunId = value || '';
            this.$store.visualization.saveToLocalStorage();
        },

        get solverRunOptions() {
            const scenarios = Array.isArray(this.$store?.solver?.scenarios)
                ? this.$store.solver.scenarios
                : [];
            return scenarios
                .filter((scenario) => scenario && (scenario.results || scenario.liveResults || scenario.runId))
                .map((scenario) => ({
                    id: scenario.id,
                    label: `${scenario.name}${scenario.runId ? ` (${String(scenario.runId).slice(0, 8)})` : ''} [${scenario.status}]`
                }));
        },

        get isLoading() {
            return this.$store.visualization.isLoading;
        },

        get error() {
            return this.$store.visualization.error;
        },

        get hasData() {
            return this.$store.visualization.hasData();
        },

        get hasCsvData() {
            return this.$store.visualization.hasCsvData();
        },

        get isEditorVisible() {
            return this.$store.visualization.isEditorVisible;
        },

        get activePlotTab() {
            return this.$store.visualization.activePlotTab;
        },

        loadTemplate(templateId) {
            this.$store.visualization.loadTemplate(templateId);
        },

        switchDataSource(source) {
            this.$store.visualization.switchDataSource(source);
            if (source === 'solver') {
                this.applySelectedSolverRun();
            }
        },

        async processCSVFile(file) {
            await this.$store.visualization.processCSVFile(file);
        },

        runCode() {
            const refName = this.getPlotRefName(this.currentTemplateId);
            const container = this.$refs[refName] || this.$store.visualization.getPlotContainer(this.currentTemplateId);
            this.$store.visualization.runCode(container, this.currentTemplateId);
        },

        toggleEditor() {
            this.$store.visualization.toggleEditor();
        },

        getScenarioById(scenarioId) {
            if (!scenarioId) return null;
            const scenarios = Array.isArray(this.$store?.solver?.scenarios)
                ? this.$store.solver.scenarios
                : [];
            return scenarios.find((scenario) => scenario.id === scenarioId) || null;
        },

        syncSelectedSolverRunWithStore() {
            if (!this.selectedSolverRunId) {
                return;
            }
            const scenario = this.getScenarioById(this.selectedSolverRunId);
            const selectedResults = scenario?.results || scenario?.liveResults || null;
            if (!scenario || !selectedResults) {
                if (scenario?.runId) {
                    console.info('[visualizer] Selected run has no schedule payload yet; waiting for stream data', {
                        scenarioId: scenario.id,
                        status: scenario.status
                    });
                    this.$store.visualization.solverData = null;
                    return;
                }
                this.selectedSolverRunId = '';
                this.$store.visualization.solverData = this.$store.solver.results || null;
                return;
            }
            this.$store.visualization.solverData = selectedResults;
        },

        applySelectedSolverRun() {
            if (!this.selectedSolverRunId) {
                this.$store.visualization.solverData = this.$store.solver.results || null;
                return;
            }
            const scenario = this.getScenarioById(this.selectedSolverRunId);
            const selectedResults = scenario?.results || scenario?.liveResults || null;
            if (!scenario || !selectedResults) {
                if (scenario?.runId) {
                    console.info('[visualizer] Selected run has no schedule payload yet; waiting for stream data', {
                        scenarioId: scenario.id,
                        status: scenario.status
                    });
                    this.$store.visualization.solverData = null;
                    return;
                }
                this.selectedSolverRunId = '';
                this.$store.visualization.solverData = this.$store.solver.results || null;
                return;
            }
            console.info('[visualizer] Applying selected solver run', {
                scenarioId: scenario.id,
                status: scenario.status,
                hasFinalResults: !!scenario.results,
                hasLiveResults: !!scenario.liveResults
            });
            this.$store.visualization.solverData = selectedResults;
        }
    };
}
