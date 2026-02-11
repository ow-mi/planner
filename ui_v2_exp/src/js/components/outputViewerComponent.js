/**
 * Output Viewer Component - Alpine.js Component
 *
 * This file defines the Alpine.js component for the output viewer.
 * It must be loaded BEFORE Alpine.js initializes to ensure x-data works correctly.
 */

function outputViewerComponent() {
    return {
        helpers: window.helpers,
        init() {
            console.log('Output viewer component initialized');
        },

        // Access store properties
        get results() {
            return this.$store.solver.getResults();
        },

        get hasResults() {
            return this.$store.solver.hasResults();
        },

        writtenPath(filename) {
            const explicitPath = this.results?.written_output_paths?.[filename];
            if (explicitPath) {
                return explicitPath;
            }
            const root = this.results?.output_root;
            if (!root) {
                return 'N/A';
            }
            return `${root}/data/${filename}`;
        },
    };
}
