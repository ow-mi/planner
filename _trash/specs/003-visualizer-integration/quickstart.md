# Quickstart Guide: Visualizer Integration

**Feature**: 003-visualizer-integration  
**Date**: 2024-12-19

## Overview

This guide provides step-by-step instructions for integrating the visualizer component into `config_editor.html`. The integration involves embedding the existing visualization component as an Alpine.js component within the Visualizer tab.

## Prerequisites

- Existing `config_editor.html` file
- Existing `visualizer.html` and related JavaScript/CSS files
- Alpine.js 3.x already loaded in config_editor.html
- Basic understanding of Alpine.js and D3.js

## Step 1: Add Required Dependencies

Add D3.js library to `config_editor.html` head section (if not already present):

```html
<!-- Add after Alpine.js script tag -->
<script src="https://d3js.org/d3.v7.min.js"></script>
```

## Step 2: Include Visualizer JavaScript Files

Add visualizer component scripts before the closing `</body>` tag in `config_editor.html`:

```html
<!-- Visualizer Component Scripts -->
<script src="js/legacy-templates.js"></script>
<script src="js/visualization-component.js"></script>
<!-- Note: editor-setup.js is optional and may be excluded -->
```

## Step 3: Include Visualizer CSS

Add visualization stylesheet to the head section:

```html
<link rel="stylesheet" href="css/visualization.css">
```

## Step 4: Update Visualizer Tab Content

Replace the placeholder content in the Visualizer tab (around line 494-498) with the integrated component:

```html
<div x-show="activeTab === 'visualizer'" class="tab-content" :class="{'active': activeTab === 'visualizer'}">
    <h2>Visualizer</h2>
    
    <!-- Visualizer Component -->
    <div x-data="visualizationComponent()" 
         x-effect="watchSolverData()"
         class="vis-container"
         style="height: calc(100vh - 300px);">
        
        <!-- Toolbar -->
        <div class="vis-toolbar">
            <select x-model="currentTemplateId" @change="loadTemplate(currentTemplateId)">
                <option value="gantt-tests">Tests by Leg</option>
                <option value="equipment">Equipment Utilization</option>
                <option value="fte">FTE Utilization</option>
                <option value="concurrency">Active Tests vs Capacity</option>
            </select>
            <button @click="runCode()">▶️ Run Code</button>
            <label>
                <input type="checkbox" x-model="autoRun"> Auto-run
            </label>
            <button @click="switchDataSource('solver')" x-show="solverData && activeDataSource !== 'solver'">Switch to Solver Data</button>
            <button @click="switchDataSource('csv')" x-show="csvData && activeDataSource !== 'csv'">Switch to CSV Data</button>
            <span x-show="activeDataSource" x-text="`Active: ${activeDataSource}`"></span>
        </div>
        
        <!-- CSV Upload Section -->
        <div class="section" style="margin: 1rem 0;">
            <h3>Upload CSV Data</h3>
            <input type="file" 
                   id="csv-visualizer-input" 
                   accept=".csv" 
                   @change="processCSVFile($event.target.files[0])"
                   style="display: none;">
            <button @click="$refs.csvInput.click()" class="btn" :disabled="isLoading">
                <span x-show="!isLoading">📂 Upload CSV</span>
                <span x-show="isLoading">Loading...</span>
            </button>
            <input type="file" x-ref="csvInput" id="csv-visualizer-input" accept=".csv" @change="processCSVFile($event.target.files[0])" style="display: none;">
            <div x-show="csvData" class="validation-error" style="color: green; margin-top: 0.5rem;">
                CSV data loaded successfully
            </div>
        </div>
        
        <!-- Error Display -->
        <div x-show="error" class="vis-error" x-cloak>
            <strong>Error:</strong>
            <pre x-text="error.message"></pre>
            <pre x-show="error.stack" x-text="error.stack" style="font-size: 10px; margin-top: 5px;"></pre>
        </div>
        
        <!-- Chart Output -->
        <div class="vis-output" x-ref="chartContainer" style="flex: 1; overflow: auto;">
            <div x-show="!solverData && !csvData" style="text-align: center; padding: 50px; color: #999;">
                <p>No data available. Run the solver or upload a CSV file.</p>
            </div>
        </div>
    </div>
</div>
```

## Step 5: Integrate Solver Results Data

Modify the `visualizationComponent()` function to accept solver data from parent component. Update `visualization-component.js` or create a wrapper:

```javascript
// In config_editor.html script section, add method to pass solver data:
function passSolverDataToVisualizer(component, solverResults) {
    if (component && solverResults) {
        component.updateData(solverResults);
        component.activeDataSource = 'solver';
    }
}

// Watch for solver results changes in configEditor()
// Add to configEditor() component:
$watch('solverState.results', (newResults) => {
    if (newResults && activeTab === 'visualizer') {
        const visComponent = Alpine.$data(document.querySelector('.vis-container'));
        if (visComponent) {
            passSolverDataToVisualizer(visComponent, newResults);
        }
    }
});
```

## Step 6: Add CSV Processing Method

Add CSV processing method to `visualization-component.js`:

```javascript
async processCSVFile(file) {
    if (!file) return;
    
    this.isLoading = true;
    this.error = null;
    
    try {
        // Check file size
        if (file.size > 10 * 1024 * 1024) { // 10MB
            // Warning but continue
            console.warn('File exceeds 10MB, performance may be affected');
        }
        
        // Parse CSV
        const text = await file.text();
        const parsed = Papa.parse(text, {
            header: true,
            skipEmptyLines: true
        });
        
        // Validate required columns
        const requiredColumns = ['test_id', 'project_leg_id', 'start_date', 'end_date'];
        const missingColumns = requiredColumns.filter(col => !parsed.meta.fields.includes(col));
        
        if (missingColumns.length > 0) {
            throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
        }
        
        // Transform to visualization format
        const transformed = {
            test_schedules: parsed.data.map(row => ({
                test_id: row.test_id,
                project_leg_id: row.project_leg_id,
                test_name: row.test_name || row.test_id,
                start_date: row.start_date,
                end_date: row.end_date,
                assigned_equipment: row.assigned_equipment ? row.assigned_equipment.split(/[;,]/).map(s => s.trim()) : [],
                assigned_fte: row.assigned_fte ? row.assigned_fte.split(/[;,]/).map(s => s.trim()) : []
            }))
        };
        
        // Transform to visualization format using existing method
        const visualizationData = this.transformSolutionResult({
            test_schedules: transformed.test_schedules,
            status: 'CSV_DATA',
            makespan_days: 0
        });
        
        this.csvData = visualizationData;
        this.activeDataSource = 'csv';
        this.solverData = null; // Clear solver data when CSV is active
        
        // Auto-run if enabled
        if (this.autoRun) {
            this.runCode();
        }
    } catch (err) {
        this.error = {
            message: `CSV processing failed: ${err.message}`,
            line: 0
        };
    } finally {
        this.isLoading = false;
    }
}
```

## Step 7: Add Data Source Switching Method

Add method to switch between data sources:

```javascript
switchDataSource(source) {
    if (source === 'solver' && this.solverData) {
        this.activeDataSource = 'solver';
        if (this.autoRun) {
            this.runCode();
        }
    } else if (source === 'csv' && this.csvData) {
        this.activeDataSource = 'csv';
        if (this.autoRun) {
            this.runCode();
        }
    }
}
```

## Step 8: Update runCode() Method

Modify `runCode()` to use active data source:

```javascript
runCode() {
    // Determine which data to use
    let dataToUse = null;
    if (this.activeDataSource === 'solver' && this.solverData) {
        dataToUse = this.transformSolutionResult(this.solverData);
    } else if (this.activeDataSource === 'csv' && this.csvData) {
        dataToUse = this.csvData;
    }
    
    if (!dataToUse) {
        this.error = { message: 'No data available', line: 0 };
        return;
    }
    
    // Get container element
    const container = this.$refs.chartContainer;
    if (!container) {
        this.error = { message: 'Chart container not found', line: 0 };
        return;
    }
    
    // Clear previous error
    this.error = null;
    
    // Clear container
    container.innerHTML = '';
    
    try {
        // Create execution scope with injected variables
        const executeCode = new Function('d3', 'data', 'container', this.code);
        executeCode(d3, dataToUse, container);
    } catch (err) {
        this.error = {
            message: err.message,
            line: err.lineNumber || 0,
            stack: err.stack
        };
        console.error('Code execution error:', err);
    }
}
```

## Step 9: Test Integration

1. **Test Solver Results**:
   - Run solver in Solver tab
   - Navigate to Visualizer tab
   - Verify visualization displays automatically

2. **Test CSV Upload**:
   - Navigate to Visualizer tab
   - Upload a CSV file matching solver output format
   - Verify visualization updates

3. **Test Data Source Switching**:
   - Have both solver results and CSV data available
   - Switch between data sources
   - Verify visualization updates correctly

4. **Test Template Switching**:
   - Select different templates
   - Verify visualization re-renders

## Troubleshooting

### Visualization Not Displaying
- Check browser console for errors
- Verify D3.js is loaded
- Verify data is available (`solverData` or `csvData`)
- Check that `chartContainer` ref exists

### CSV Upload Failing
- Verify CSV file matches solver output format
- Check required columns are present
- Check browser console for parsing errors
- Verify PapaParse is loaded

### Performance Issues
- Check file size (warn if > 10MB)
- Reduce number of test schedules if possible
- Check browser performance tools

### Styling Conflicts
- Review `visualization.css` for conflicts with config_editor styles
- Use CSS specificity or namespacing if needed
- Check that `.vis-container` styles are applied

## Next Steps

After integration is complete:
1. Test all user scenarios from spec
2. Verify performance meets success criteria
3. Test error handling and edge cases
4. Review accessibility compliance
5. Update documentation if needed

## References

- [Specification](./spec.md)
- [Data Model](./data-model.md)
- [Component API](./contracts/component-api.md)
- [Research](./research.md)



