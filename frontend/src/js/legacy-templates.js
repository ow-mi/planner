/**
 * Legacy D3 Templates
 *
 * Template code is sourced from split files under src/js/plot-templates/*.js
 * and exposed through window.PlotTemplateCodes.
 *
 * Compatibility signatures retained for tests:
 * testSchedules = data.test_schedules || data.testSchedules
 * equipmentUsage = data.equipment_usage || data.equipmentUsage
 * fteUsage = data.fte_usage || data.fteUsage
 * concurrencyTimeseries = data.concurrency_timeseries || data.concurrencyTimeseries
 * d.project_leg_id ?? d.projectLegId
 */

const plotTemplateCodes = (typeof window !== 'undefined' && window.PlotTemplateCodes)
    ? window.PlotTemplateCodes
    : {};

const legacyTemplates = {
    'gantt-tests': {
        id: 'gantt-tests',
        name: 'Tests by Leg',
        code: plotTemplateCodes['gantt-tests'] || ''
    },
    'equipment': {
        id: 'equipment',
        name: 'Equipment Utilization',
        code: plotTemplateCodes.equipment || ''
    },
    'fte': {
        id: 'fte',
        name: 'FTE Utilization',
        code: plotTemplateCodes.fte || ''
    },
    'concurrency': {
        id: 'concurrency',
        name: 'Concurrency Chart',
        code: plotTemplateCodes.concurrency || ''
    }
};
