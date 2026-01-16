# Quickstart: D3 Visualization Component

## Integration Guide

To add the D3 Visualization component to a new page in the Solver UI:

### 1. Dependencies
Include the following in your HTML `<head>`:

```html
<!-- Alpine.js -->
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
<!-- D3.js -->
<script src="https://d3js.org/d3.v7.min.js"></script>
<!-- CodeMirror 6 Styles -->
<link rel="stylesheet" href="css/visualization.css">
```

### 2. Mount the Component
Add the component markup to your page. The `x-data` should initialize the `visualizationComponent`.

```html
<div x-data="visualizationComponent()" class="vis-container">
    <!-- Toolbar -->
    <div class="vis-toolbar">
        <select x-model="currentTemplateId" @change="loadTemplate">
            <option value="gantt-tests">Tests Gantt</option>
            <!-- ... -->
        </select>
        <button @click="runCode">Run</button>
    </div>

    <!-- Main Layout -->
    <div class="vis-layout">
        <!-- Editor Panel -->
        <div class="vis-editor" x-show="isPanelOpen">
            <div id="cm-editor"></div>
        </div>
        
        <!-- Chart Output -->
        <div class="vis-output" x-ref="chartContainer"></div>
    </div>
</div>
```

### 3. Initialize with Data
In your main page script, pass data to the component store:

```javascript
// Assuming you have a global store or event
document.addEventListener('solver-solution-updated', (e) => {
    const component = Alpine.$data(document.querySelector('.vis-container'));
    component.updateData(e.detail.solution);
});
```

## Usage Example

### Creating a Custom Template

1. **Access Data**: Use the injected `data` variable (which contains `test_schedules`, etc.).
2. **Draw**: Use `d3.select(container)` to start drawing.

```javascript
// Example Code
const svg = d3.select(container).append("svg")
    .attr("width", 800)
    .attr("height", 400);

svg.selectAll("rect")
    .data(data.test_schedules)
    .enter()
    .append("rect")
    .attr("x", d => d.start_day * 10)
    // ...
```



