/**
 * Solver Controls Component - Alpine.js Component
 *
 * This file defines the Alpine.js component for the solver controls.
 * It must be loaded BEFORE Alpine.js initializes to ensure x-data works correctly.
 */

function solverControlsComponent() {
    return {
        init() {
            console.log('Solver controls component initialized');
            this.$watch(() => JSON.stringify(this.$store.solver.config), () => {
                if (this.$store?.solver?.saveToLocalStorage) {
                    this.$store.solver.saveToLocalStorage();
                }
            });
        },

        // Access store properties
        get solverConfig() {
            return this.$store.solver.config;
        },

        get isRunning() {
            return this.$store.solver.isRunning();
        },

        get isCompleted() {
            return this.$store.solver.isCompleted();
        },

        get isFailed() {
            return this.$store.solver.isFailed();
        },

        get statusMessage() {
            return this.$store.solver.message;
        },

        get progress() {
            return this.$store.solver.progress;
        },

        get elapsedTime() {
            return this.$store.solver.elapsedTime;
        },

        get errorMessage() {
            return this.$store.solver.error?.message || this.$store.solver.error || 'Unknown error';
        },

        get errorGuidance() {
            return this.$store.solver.error?.guidance || '';
        },

        get canReset() {
            return this.isCompleted || this.isFailed;
        },

        runSolver() {
            this.$store.solver.executeSolver();
        },

        resetSolver() {
            if (confirm('Are you sure you want to reset the solver state?')) {
                this.$store.solver.reset();
            }
        },

        showOutputTab() {
            // Dispatch event to switch to output tab
            document.dispatchEvent(new CustomEvent('switchTab', {
                detail: { tab: 'output_data' }
            }));
        }
    };
}
