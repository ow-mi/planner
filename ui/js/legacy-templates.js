/**
 * Legacy D3 Templates
 * 
 * Ported templates from web_page_visualizer/d3_visualizations_refactored.html
 * These templates are adapted to work with SolutionResult JSON data format
 */

const legacyTemplates = {
    'gantt-tests': {
        id: 'gantt-tests',
        name: 'Tests by Leg',
        code: `// Tests by Leg Gantt Chart
// Expects data.test_schedules array with: test_id, project_leg_id, test_name, start_date, end_date, assigned_equipment_id, assigned_fte_id

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

// Process data
const processed = data.test_schedules.map(d => {
    const start = d.start_date ? new Date(d.start_date) : new Date();
    const end = d.end_date ? new Date(d.end_date) : new Date();
    return {
        id: \`\${d.project_leg_id}-\${d.test_name || d.test_id}\`,
        leg: d.project_leg_id || 'Unknown',
        test: d.test_name || d.test_id || 'Test',
        start,
        end,
        equipment: d.assigned_equipment_id || '',
        fte: d.assigned_fte_id || ''
    };
});

// Get container dimensions
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
    .attr('transform', \`translate(\${margin.left},\${margin.top})\`);

// Group legs
const legs = [...new Set(processed.map(d => d.leg))].sort();
const yScale = d3.scaleBand()
    .domain(legs)
    .range([0, height])
    .padding(0.1);

// Time scale
const minStart = d3.min(processed, d => d.start);
const maxEnd = d3.max(processed, d => d.end);
const xScale = d3.scaleTime()
    .domain([minStart, maxEnd])
    .range([0, width])
    .nice();

// Draw bars
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
    .text(d => \`\${d.test}\\n\${d.leg}\\nDuration: \${Math.round((d.end - d.start) / 86400000)} days\`);

// Add axes
g.append('g')
    .attr('class', 'x-axis')
    .attr('transform', \`translate(0,\${height})\`)
    .call(d3.axisBottom(xScale));

g.append('g')
    .attr('class', 'y-axis')
    .call(d3.axisLeft(yScale));

// Add title
svg.append('text')
    .attr('x', availableWidth / 2)
    .attr('y', 30)
    .attr('text-anchor', 'middle')
    .style('font-size', '20px')
    .style('font-weight', 'bold')
    .text('Tests by Leg - Gantt Chart');`
    },
    
    'equipment': {
        id: 'equipment',
        name: 'Equipment Utilization',
        code: `// Equipment Utilization Chart
// Expects data.equipment_usage array with: equipment_id, test_id, test_name, start_date, end_date

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
    .attr('transform', \`translate(\${margin.left},\${margin.top})\`);

const equipment = [...new Set(processed.map(d => d.equipment))];
const yScale = d3.scaleBand()
    .domain(equipment)
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
    .text(d => \`\${d.test}\\nEquipment: \${d.equipment}\`);

g.append('g')
    .attr('transform', \`translate(0,\${height})\`)
    .call(d3.axisBottom(xScale));

g.append('g')
    .call(d3.axisLeft(yScale));

svg.append('text')
    .attr('x', availableWidth / 2)
    .attr('y', 28)
    .attr('text-anchor', 'middle')
    .style('font-size', '18px')
    .style('font-weight', 'bold')
    .text('Equipment Utilization');`
    },
    
    'fte': {
        id: 'fte',
        name: 'FTE Utilization',
        code: `// FTE Utilization Chart
// Expects data.fte_usage array with: fte_id, test_id, test_name, start_date, end_date

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
    .attr('transform', \`translate(\${margin.left},\${margin.top})\`);

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
    .text(d => \`\${d.test}\\nFTE: \${d.fte}\`);

g.append('g')
    .attr('transform', \`translate(0,\${height})\`)
    .call(d3.axisBottom(xScale));

g.append('g')
    .call(d3.axisLeft(yScale));

svg.append('text')
    .attr('x', availableWidth / 2)
    .attr('y', 28)
    .attr('text-anchor', 'middle')
    .style('font-size', '18px')
    .style('font-weight', 'bold')
    .text('FTE Utilization');`
    },
    
    'concurrency': {
        id: 'concurrency',
        name: 'Active Tests vs Capacity',
        code: `// Active Tests vs Capacity Chart
// Expects data.concurrency_timeseries array with: timestamp, active_tests, available_fte, available_equipment, capacity_min

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
    .attr('transform', \`translate(\${margin.left},\${margin.top})\`);

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

// Capacity line (step function)
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

// Active tests line
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

// Add axes
g.append('g')
    .attr('transform', \`translate(0,\${height})\`)
    .call(d3.axisBottom(xScale));

g.append('g')
    .call(d3.axisLeft(yScale));

// Add legend
const legend = g.append('g')
    .attr('transform', \`translate(\${width - 120}, 20)\`);

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
    .text('Active Tests vs Capacity Over Time');`
    }
};



