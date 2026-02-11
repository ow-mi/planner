/**
 * Visualizer Component - Alpine.js Component
 *
 * This file defines the Alpine.js component for the visualization panel.
 * It must be loaded BEFORE Alpine.js initializes to ensure x-data works correctly.
 */

function visualizerComponent() {
    return {
        init() {
            console.log('Visualizer component initialized');

            // Watch for solver data changes
            this.$watch('$store.solver.results', (newResults) => {
                if (newResults) {
                    this.$store.visualization.solverData = newResults;
                    this.$store.visualization.activeDataSource = 'solver';

                    // Auto-render if we have code
                    if (this.$store.visualization.code && this.$store.visualization.code.trim() !== '') {
                        this.runCode();
                    }
                }
            });

            // Watch for editor visibility changes
            this.$watch('$store.visualization.isEditorVisible', (isVisible) => {
                if (isVisible && this.$store.visualization.editorInitialized) {
                    // Ensure editor is properly initialized
                    this.$nextTick(() => {
                        this.initializeEditor();
                    });
                }
            });
        },

        // Initialize editor if needed
        initializeEditor() {
            if (this.$store.visualization.editorInitialized) {
                return;
            }

            // Get editor container reference
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

        loadTemplate(templateId) {
            this.$store.visualization.loadTemplate(templateId);
        },

        switchDataSource(source) {
            this.$store.visualization.switchDataSource(source);
        },

        async processCSVFile(file) {
            await this.$store.visualization.processCSVFile(file);
        },

        runCode() {
            this.$store.visualization.runCode(this.$refs.chartContainer);
        },

        toggleEditor() {
            this.$store.visualization.toggleEditor();
        }
    };
}
