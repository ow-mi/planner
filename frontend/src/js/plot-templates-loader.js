window.PlotTemplateCodes = window.PlotTemplateCodes || {};

(function loadExternalPlotTemplates() {
    const templateFiles = {
        'gantt-tests': 'gantt-tests.js',
        equipment: 'equipment.js',
        fte: 'fte.js',
        concurrency: 'concurrency.js'
    };

    const basePaths = [
        'plot_templates/',
        '/plot_templates/',
        '../plot_templates/'
    ];

    const loadTextSync = (url) => {
        try {
            const request = new XMLHttpRequest();
            request.open('GET', url, false);
            request.send(null);
            if (request.status >= 200 && request.status < 300) {
                return request.responseText || '';
            }
        } catch (_) {
            // Try next path.
        }
        return '';
    };

    Object.entries(templateFiles).forEach(([templateId, filename]) => {
        let source = '';
        for (let i = 0; i < basePaths.length && !source; i += 1) {
            source = loadTextSync(`${basePaths[i]}${filename}`);
        }

        if (!source) {
            console.warn(`[plot-templates-loader] Failed to load template: ${templateId}`);
            return;
        }

        window.PlotTemplateCodes[templateId] = source;
    });
})();
