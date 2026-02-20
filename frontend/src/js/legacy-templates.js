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

// Handle both snake_case (backend) and camelCase (transformed) data formats
const testSchedules = data.test_schedules || data.testSchedules || [];
if (!data || testSchedules.length === 0) {
    d3.select(container).append('text')
        .attr('x', 400)
        .attr('y', 200)
        .attr('text-anchor', 'middle')
        .style('font-size', '18px')
        .style('fill', '#666')
        .text('No test schedule data available');
    return;
}

// Clear any existing content
d3.select(container).selectAll('*').remove();

// Process and parse data - handle both snake_case and camelCase field names
const processed = testSchedules.map(d => {
    const parseDateTime = (dateVal, timeVal) => {
        if (!dateVal) return new Date();
        
        const timePart = (timeVal && String(timeVal).trim()) ? String(timeVal).trim() : '00:00:00';
        const datePart = dateVal instanceof Date ?
            d3.timeFormat('%Y-%m-%d')(dateVal) :
            String(dateVal).trim();
        return new Date(\`\${datePart}T\${timePart}\`);
    };

    // Handle both snake_case and camelCase field names
    const startDate = d.start_date ?? d.startDate;
    const startTime = d.start_time ?? d.startTime;
    const endDate = d.end_date ?? d.endDate;
    const endTime = d.end_time ?? d.endTime;
    
    const start = startDate instanceof Date ? startDate : 
                 parseDateTime(startDate, startTime || '00:00:00');
    const end = endDate instanceof Date ? endDate : 
               parseDateTime(endDate, endTime || '23:59:59');

    return {
        id: \`\${d.project_leg_id ?? d.projectLegId ?? 'unknown'}-\${d.test_name ?? d.testName ?? d.test_id ?? d.testId}\`,
        leg: d.project_leg_id ?? d.projectLegId ?? 'Unknown',
        test: d.test_name ?? d.testName ?? d.test_id ?? d.testId ?? 'Test',
        start,
        end,
        equipment: d.assigned_equipment_id ?? d.assignedEquipmentId ?? '',
        fte: d.assigned_fte_id ?? d.assignedFteId ?? '',
        test_short: (d.test_name ?? d.testName ?? d.test_id ?? d.testId ?? 'Test')
    };
});

// ============================================================================
// 2. DIMENSIONS AND LAYOUT SETUP
// ============================================================================

const rect = container.getBoundingClientRect();
const availableWidth = Math.max(1200, rect.width - 40);
const availableHeight = Math.max(900, rect.height - 40);

const margin = {
    top: 100,
    right: 150,
    bottom: 80,
    left: 150
};
const width = availableWidth - margin.left - margin.right;
const height = availableHeight - margin.top - margin.bottom;

const svg = d3.select(container)
    .append('svg')
    .attr('width', availableWidth)
    .attr('height', availableHeight);

const g = svg.append('g')
    .attr('transform', \`translate(\${margin.left},\${margin.top})\`);

// ============================================================================
// 3. HIERARCHICAL GROUPING AND POSITIONING
// ============================================================================

const getGroupName = leg => {
    if (typeof leg !== 'string') return 'Other';
    if (leg.startsWith('mwcu_b10_')) return 'MWCU B10';
    if (leg.startsWith('mwcu_a7_')) return 'MWCU A7';
    if (leg.startsWith('dcc_')) return 'DCC';
    return 'Other';
};

// Sort legs by group and then naturally
const legs = [...new Set(processed.map(d => d.leg))].sort((a, b) => {
    const groupA = getGroupName(a);
    const groupB = getGroupName(b);
    if (groupA !== groupB) {
        const order = ['MWCU B10', 'MWCU A7', 'DCC', 'Other'];
        return order.indexOf(groupA) - order.indexOf(groupB);
    }
    return a.localeCompare(b, undefined, { numeric: true });
});

// Create group structure
const groups = [];
let currentGroup = null;
legs.forEach(leg => {
    const group = getGroupName(leg);
    if (group !== currentGroup) {
        groups.push({ name: group, legs: [leg] });
        currentGroup = group;
    } else {
        groups[groups.length - 1].legs.push(leg);
    }
});

// Calculate positions with adaptive sizing
const totalLegs = legs.length;
const availableContentHeight = height - 20;
let rowHeight = 35;
let groupHeaderHeight = 25;

if (totalLegs > 0) {
    const neededHeight = totalLegs * rowHeight + groups.length * (groupHeaderHeight + 10);
    if (neededHeight > availableContentHeight) {
        const availableRowSpace = (availableContentHeight - groups.length * groupHeaderHeight - groups.length * 10) / totalLegs;
        rowHeight = Math.max(20, Math.min(35, availableRowSpace));
        groupHeaderHeight = Math.max(18, Math.min(25, groupHeaderHeight * 0.8));
    }
}

let yPosition = 0;
const legPositions = {};
const groupPositions = [];

groups.forEach(group => {
    groupPositions.push({ name: group.name, y: yPosition });
    yPosition += groupHeaderHeight;

    group.legs.forEach(leg => {
        legPositions[leg] = yPosition;
        yPosition += rowHeight;
    });

    yPosition += 10;
});

const totalHeight = yPosition;
const effectiveHeight = Math.min(totalHeight, height);

// Add clipping warning if needed
if (totalHeight > height) {
    svg.append('text')
        .attr('x', availableWidth - 10)
        .attr('y', 20)
        .attr('text-anchor', 'end')
        .style('font-size', '12px')
        .style('fill', '#ff6b35')
        .style('font-weight', 'bold')
        .text('⚠ Chart clipped - some data not visible');
}

// ============================================================================
// 4. TIME SCALE
// ============================================================================

const minStart = d3.min(processed, d => d.start);
const maxEnd = d3.max(processed, d => d.end);
const xScale = d3.scaleTime()
    .domain([minStart, maxEnd])
    .range([0, width])
    .nice();

// ============================================================================
// 5. VISUAL BACKGROUND ELEMENTS
// ============================================================================

// Zebra striping
const stripes = g.append('g').attr('class', 'stripes');
legs.forEach((leg, i) => {
    if (i % 2 === 1) {
        stripes.append('rect')
            .attr('class', 'zebra-stripe')
            .attr('x', 0)
            .attr('y', legPositions[leg] - rowHeight / 2)
            .attr('width', width)
            .attr('height', rowHeight)
            .attr('fill', '#f5f5f5');
    }
});

// Group headers and separators
const headers = g.append('g').attr('class', 'group-headers');
groupPositions.forEach((group, i) => {
    headers.append('text')
        .attr('class', 'group-header')
        .attr('x', -10)
        .attr('y', group.y + 15)
        .attr('text-anchor', 'end')
        .style('font-size', '14px')
        .style('font-weight', 'bold')
        .text(group.name);

    if (i > 0) {
        headers.append('line')
            .attr('x1', -margin.left + 20)
            .attr('x2', width)
            .attr('y1', group.y - 5)
            .attr('y2', group.y - 5)
            .attr('stroke', '#ccc')
            .attr('stroke-width', 2);
    }
});

// ============================================================================
// 6. ADAPTIVE TIME AXES
// ============================================================================

let currentZoomLevel = 1;

const updateTimeAxis = (scale, zoomLevel) => {
    g.selectAll('.x-axis-top, .x-axis-bottom, .grid-group').remove();
    
    let topFormat, bottomFormat, gridTicks;
    if (zoomLevel < 2) {
        topFormat = d => d3.timeFormat('%Y')(d);
        bottomFormat = d => \`Q\${Math.floor(d.getMonth() / 3) + 1}\`;
        gridTicks = d3.timeMonth.every(3);
    } else if (zoomLevel < 8) {
        topFormat = d => d3.timeFormat('%Y')(d);
        bottomFormat = d => d3.timeFormat('%b')(d);
        gridTicks = d3.timeMonth.every(1);
    } else {
        topFormat = d => d3.timeFormat('%b %Y')(d);
        bottomFormat = d => \`W\${d3.timeFormat('%U')(d)}\`;
        gridTicks = d3.timeWeek.every(1);
    }

    // Grid lines
    const gridGroup = g.append('g').attr('class', 'grid-group');
    const gridLines = gridGroup.append('g')
        .attr('class', 'grid-minor')
        .attr('transform', \`translate(0,\${effectiveHeight})\`);

    gridLines.selectAll('line')
        .data(scale.ticks(gridTicks))
        .enter()
        .append('line')
        .attr('x1', d => scale(d))
        .attr('x2', d => scale(d))
        .attr('y1', 0)
        .attr('y2', -effectiveHeight)
        .attr('stroke', '#f0f0f0')
        .attr('stroke-width', 0.5);

    // Top axis
    const topAxis = g.append('g')
        .attr('class', 'x-axis-top axis-major')
        .attr('transform', 'translate(0,-10)');
    const topTicks = zoomLevel < 2 ? d3.timeYear.every(1) : (zoomLevel < 8 ? d3.timeMonth.every(3) : d3.timeMonth.every(1));
    topAxis.call(d3.axisTop(scale).ticks(topTicks).tickFormat(topFormat));

    // Bottom axis
    const bottomAxis = g.append('g')
        .attr('class', 'x-axis-bottom axis-major')
        .attr('transform', \`translate(0,\${effectiveHeight + 20})\`);
    const bottomTicks = zoomLevel < 2 ? d3.timeMonth.every(3) : (zoomLevel < 8 ? d3.timeMonth.every(1) : d3.timeWeek.every(1));
    bottomAxis.call(d3.axisBottom(scale).ticks(bottomTicks).tickFormat(bottomFormat));
};

updateTimeAxis(xScale, 1);

// ============================================================================
// 7. Y AXIS (LEG LABELS)
// ============================================================================

const yAxis = g.append('g').attr('class', 'y-axis');
legs.forEach(leg => {
    yAxis.append('text')
        .attr('x', -20)
        .attr('y', legPositions[leg] + 5)
        .attr('text-anchor', 'end')
        .style('font-size', '12px')
        .text(leg);
});

// ============================================================================
// 8. REFERENCE LINES (YEAR MARKS AND TODAY)
// ============================================================================

// Year marks
const yearMarks = [];
for (let year = minStart.getFullYear(); year <= maxEnd.getFullYear(); year++) {
    const yearStart = new Date(year, 0, 1);
    if (yearStart >= minStart && yearStart <= maxEnd) {
        yearMarks.push({ year, date: yearStart });
    }
}

const yearsG = g.append('g').attr('class', 'year-marks');
yearsG.selectAll('.year-mark')
    .data(yearMarks)
    .enter()
    .append('line')
    .attr('class', 'year-mark')
    .attr('x1', d => xScale(d.date))
    .attr('x2', d => xScale(d.date))
    .attr('y1', 0)
    .attr('y2', effectiveHeight)
    .attr('stroke', '#999')
    .attr('stroke-width', 2)
    .attr('opacity', 0.5);

// Today line
const now = new Date();
if (now >= minStart && now <= maxEnd) {
    g.append('line')
        .attr('class', 'today-line')
        .attr('x1', xScale(now))
        .attr('x2', xScale(now))
        .attr('y1', 0)
        .attr('y2', effectiveHeight)
        .attr('stroke', '#ff4444')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5');

    g.append('text')
        .attr('class', 'today-label')
        .attr('x', xScale(now) + 5)
        .attr('y', -20)
        .attr('fill', '#ff4444')
        .attr('font-weight', 'bold')
        .text('Today');
}

// ============================================================================
// 9. EQUIPMENT COLOR SCALE AND LEGEND
// ============================================================================

const equipValues = [...new Set(processed.map(d => d.equipment))].filter(Boolean);
const equipColor = d3.scaleOrdinal(d3.schemeTableau10).domain(equipValues);
const activeEquipment = new Set(equipValues);

// Legend
if (equipValues.length > 0) {
    const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', \`translate(\${availableWidth - margin.right + 10}, \${margin.top})\`);

    legend.append('text')
        .attr('x', 0)
        .attr('y', 0)
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .text('Equipment:');

    equipValues.forEach((equip, i) => {
        const legendItem = legend.append('g')
            .attr('class', 'legend-item')
            .attr('transform', \`translate(0, \${20 + i * 25})\`)
            .style('cursor', 'pointer')
            .on('click', function() {
                if (activeEquipment.has(equip)) {
                    activeEquipment.delete(equip);
                    d3.select(this).style('opacity', 0.3);
                } else {
                    activeEquipment.add(equip);
                    d3.select(this).style('opacity', 1);
                }
                updateBars();
                updateLabels();
            });

        legendItem.append('rect')
            .attr('width', 15)
            .attr('height', 15)
            .attr('fill', equipColor(equip))
            .attr('stroke', '#333')
            .attr('stroke-width', 1);

        legendItem.append('text')
            .attr('x', 20)
            .attr('y', 12)
            .style('font-size', '11px')
            .text(equip);
    });
}

// ============================================================================
// 10. DATA BARS
// ============================================================================

const barsGroup = g.append('g').attr('class', 'bars-group');

const updateBars = () => {
    const filteredData = processed.filter(d =>
        !d.equipment || activeEquipment.has(d.equipment)
    );

    const bars = barsGroup.selectAll('rect.bar')
        .data(filteredData, d => d.id)
        .join('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(d.start))
        .attr('y', d => legPositions[d.leg] - rowHeight / 4)
        .attr('width', d => Math.max(1, xScale(d.end) - xScale(d.start)))
        .attr('height', rowHeight / 2)
        .attr('fill', '#e0e0e0')
        .attr('stroke', d => d.equipment ? equipColor(d.equipment) : '#999')
        .attr('stroke-width', 2)
        .attr('rx', 3);

    bars.append('title')
        .text(d => \`\${d.test}\\nDuration: \${Math.round((d.end - d.start) / 86400000)} days\\nEquipment: \${d.equipment || 'N/A'}\`);
};

updateBars();

// ============================================================================
// 11. TASK LABELS
// ============================================================================

const labelsGroup = g.append('g').attr('class', 'labels-group');
let labelsVisible = true;

const updateLabels = () => {
    const filteredData = labelsVisible ? processed.filter(d =>
        !d.equipment || activeEquipment.has(d.equipment)
    ) : [];

    const labels = labelsGroup.selectAll('g.task-label')
        .data(filteredData, d => d.id)
        .join(
            enter => {
                const g = enter.append('g')
                    .attr('class', 'task-label');

                g.attr('transform', d => {
                    const x = xScale(new Date((d.start.getTime() + d.end.getTime()) / 2));
                    const y = legPositions[d.leg];
                    return \`translate(\${x},\${y - 15})\`;
                });
                
                const text = g.append('text')
                    .attr('text-anchor', 'middle')
                    .style('font-size', '10px')
                    .style('font-weight', 'bold')
                    .text(d => d.test_short);
                
                g.each(function() {
                    const textNode = d3.select(this).select('text').node();
                    if (textNode) {
                        const bbox = textNode.getBBox();
                        d3.select(this).insert('rect', 'text')
                            .attr('x', bbox.x - 3)
                            .attr('y', bbox.y - 2)
                            .attr('width', bbox.width + 6)
                            .attr('height', bbox.height + 4)
                            .attr('rx', 3)
                            .attr('fill', 'white')
                            .attr('stroke', '#ddd')
                            .attr('stroke-width', 1);
                    }
                });

                return g;
            },
            update => update,
            exit => exit.remove()
        );
};

updateLabels();

// ============================================================================
// 12. END-OF-LEG DATE LABELS
// ============================================================================

const latestEndDates = new Map();
processed.forEach(d => {
    const existingDate = latestEndDates.get(d.leg);
    if (!existingDate || d.end > existingDate) {
        latestEndDates.set(d.leg, d.end);
    }
});

const weekFormat = d3.timeFormat('%Y-%U');
const endLabels = g.append('g').attr('class', 'end-labels');

legs.forEach(leg => {
    const endDate = latestEndDates.get(leg);
    if (endDate) {
        endLabels.append('text')
            .attr('class', 'leg-end-label')
            .attr('x', width + 10)
            .attr('y', legPositions[leg] + 5)
            .attr('text-anchor', 'start')
            .attr('alignment-baseline', 'middle')
            .style('font-size', '11px')
            .style('fill', '#555')
            .text(weekFormat(endDate));
    }
});

// ============================================================================
// 13. ZOOM AND PAN BEHAVIOR
// ============================================================================

const zoom = d3.zoom()
    .scaleExtent([0.5, 24])
    .on('zoom', (event) => {
        currentZoomLevel = event.transform.k;
        const newXScale = event.transform.rescaleX(xScale);

        // Update time axes
        updateTimeAxis(newXScale, currentZoomLevel);

        // Update bars
        barsGroup.selectAll('rect.bar')
            .attr('x', d => newXScale(d.start))
            .attr('width', d => Math.max(1, newXScale(d.end) - newXScale(d.start)));

        // Update year marks
        yearsG.selectAll('.year-mark')
            .attr('x1', d => newXScale(d.date))
            .attr('x2', d => newXScale(d.date));

        // Update today line
        if (now >= minStart && now <= maxEnd) {
            g.select('.today-line')
                .attr('x1', newXScale(now))
                .attr('x2', newXScale(now));
            g.select('.today-label')
                .attr('x', newXScale(now) + 5);
        }

        // Update labels
        if (labelsVisible) {
            labelsGroup.selectAll('.task-label')
                .attr('transform', d => {
                    const x = newXScale(new Date((d.start.getTime() + d.end.getTime()) / 2));
                    const y = legPositions[d.leg];
                    return \`translate(\${x},\${y - 15})\`;
                });
        }
    });

svg.call(zoom);

// ============================================================================
// 14. TITLE AND CONTROLS
// ============================================================================

const chartTitle = 'Tests by Leg - Gantt Chart';
svg.append('text')
    .attr('x', availableWidth / 2)
    .attr('y', 30)
    .attr('text-anchor', 'middle')
    .style('font-size', '20px')
    .style('font-weight', 'bold')
    .text(chartTitle);

// Toggle labels button
svg.append('text')
    .attr('x', margin.left)
    .attr('y', 60)
    .attr('text-anchor', 'start')
    .style('font-size', '12px')
    .style('cursor', 'pointer')
    .style('text-decoration', 'underline')
    .style('fill', '#0066cc')
    .text('Toggle Labels')
    .on('click', function() {
        labelsVisible = !labelsVisible;
        updateLabels();
    });`
    },
    
    'equipment': {
        id: 'equipment',
        name: 'Equipment Utilization',
        code: `// Equipment Utilization Gantt Chart
// Expects data.equipment_usage array with: equipment_id, test_id, test_name, start_date, end_date
// Also supports camelCase format: equipmentUsage, equipmentId, testName, startDate, endDate

const equipmentUsage = data.equipment_usage || data.equipmentUsage || [];
if (!data || equipmentUsage.length === 0) {
    d3.select(container).append('text')
        .attr('x', 400)
        .attr('y', 200)
        .attr('text-anchor', 'middle')
        .style('font-size', '18px')
        .style('fill', '#666')
        .text('No equipment usage data available');
    return;
}

// Clear any existing content
d3.select(container).selectAll('*').remove();

// Process and parse data
const processed = equipmentUsage.map(d => {
    const parseDateTime = (dateVal, timeVal) => {
        if (!dateVal) return new Date();
        const timePart = (timeVal && String(timeVal).trim()) ? String(timeVal).trim() : '00:00:00';
        const datePart = dateVal instanceof Date ? d3.timeFormat('%Y-%m-%d')(dateVal) : String(dateVal).trim();
        return new Date(\`\${datePart}T\${timePart}\`);
    };
    
    const startDate = d.start_date ?? d.startDate;
    const startTime = d.start_time ?? d.startTime;
    const endDate = d.end_date ?? d.endDate;
    const endTime = d.end_time ?? d.endTime;
    
    const start = startDate instanceof Date ? startDate : parseDateTime(startDate, startTime || '00:00:00');
    const end = endDate instanceof Date ? endDate : parseDateTime(endDate, endTime || '23:59:59');
    
    return {
        id: \`\${d.equipment_id ?? d.equipmentId ?? 'unknown'}-\${d.test_name ?? d.testName ?? d.test_id ?? d.testId}-\${start.getTime()}\`,
        equipment: d.equipment_id ?? d.equipmentId ?? 'Unknown',
        test: d.test_name ?? d.testName ?? d.test_id ?? d.testId ?? 'Test',
        start,
        end,
        test_short: (d.test_name ?? d.testName ?? d.test_id ?? d.testId ?? 'Test').substring(0, 20)
    };
});

// ============================================================================
// DIMENSIONS AND LAYOUT SETUP
// ============================================================================

const rect = container.getBoundingClientRect();
const availableWidth = Math.max(1200, rect.width - 40);
const availableHeight = Math.max(900, rect.height - 40);

const margin = { top: 100, right: 150, bottom: 80, left: 150 };
const width = availableWidth - margin.left - margin.right;
const height = availableHeight - margin.top - margin.bottom;

const svg = d3.select(container)
    .append('svg')
    .attr('width', availableWidth)
    .attr('height', availableHeight);

const g = svg.append('g')
    .attr('transform', \`translate(\${margin.left},\${margin.top})\`);

// ============================================================================
// EQUIPMENT GROUPING AND POSITIONING
// ============================================================================

// Sort equipment naturally
const equipment = [...new Set(processed.map(d => d.equipment))].sort((a, b) => 
    a.localeCompare(b, undefined, { numeric: true })
);

// Calculate positions with adaptive sizing
const totalEquipment = equipment.length;
const availableContentHeight = height - 20;
let rowHeight = 35;

if (totalEquipment > 0) {
    const neededHeight = totalEquipment * rowHeight + 20;
    if (neededHeight > availableContentHeight) {
        rowHeight = Math.max(20, availableContentHeight / totalEquipment);
    }
}

const equipmentPositions = {};
equipment.forEach((equip, i) => {
    equipmentPositions[equip] = i * rowHeight + rowHeight / 2;
});

const totalHeight = totalEquipment * rowHeight;
const effectiveHeight = Math.min(totalHeight, height);

// Clipping warning
if (totalHeight > height) {
    svg.append('text')
        .attr('x', availableWidth - 10)
        .attr('y', 20)
        .attr('text-anchor', 'end')
        .style('font-size', '12px')
        .style('fill', '#ff6b35')
        .style('font-weight', 'bold')
        .text('⚠ Chart clipped - some data not visible');
}

// ============================================================================
// TIME SCALE
// ============================================================================

const minStart = d3.min(processed, d => d.start);
const maxEnd = d3.max(processed, d => d.end);
const xScale = d3.scaleTime()
    .domain([minStart, maxEnd])
    .range([0, width])
    .nice();

// ============================================================================
// VISUAL BACKGROUND ELEMENTS
// ============================================================================

// Zebra striping
const stripes = g.append('g').attr('class', 'stripes');
equipment.forEach((equip, i) => {
    if (i % 2 === 1) {
        stripes.append('rect')
            .attr('class', 'zebra-stripe')
            .attr('x', 0)
            .attr('y', equipmentPositions[equip] - rowHeight / 2)
            .attr('width', width)
            .attr('height', rowHeight)
            .attr('fill', '#f5f5f5');
    }
});

// ============================================================================
// ADAPTIVE TIME AXES
// ============================================================================

let currentZoomLevel = 1;

const updateTimeAxis = (scale, zoomLevel) => {
    g.selectAll('.x-axis-top, .x-axis-bottom, .grid-group').remove();
    
    let topFormat, bottomFormat, gridTicks;
    if (zoomLevel < 2) {
        topFormat = d => d3.timeFormat('%Y')(d);
        bottomFormat = d => \`Q\${Math.floor(d.getMonth() / 3) + 1}\`;
        gridTicks = d3.timeMonth.every(3);
    } else if (zoomLevel < 8) {
        topFormat = d => d3.timeFormat('%Y')(d);
        bottomFormat = d => d3.timeFormat('%b')(d);
        gridTicks = d3.timeMonth.every(1);
    } else {
        topFormat = d => d3.timeFormat('%b %Y')(d);
        bottomFormat = d => \`W\${d3.timeFormat('%U')(d)}\`;
        gridTicks = d3.timeWeek.every(1);
    }

    // Grid lines
    const gridGroup = g.append('g').attr('class', 'grid-group');
    const gridLines = gridGroup.append('g')
        .attr('class', 'grid-minor')
        .attr('transform', \`translate(0,\${effectiveHeight})\`);

    gridLines.selectAll('line')
        .data(scale.ticks(gridTicks))
        .enter()
        .append('line')
        .attr('x1', d => scale(d))
        .attr('x2', d => scale(d))
        .attr('y1', 0)
        .attr('y2', -effectiveHeight)
        .attr('stroke', '#f0f0f0')
        .attr('stroke-width', 0.5);

    // Top axis
    const topAxis = g.append('g')
        .attr('class', 'x-axis-top axis-major')
        .attr('transform', 'translate(0,-10)');
    const topTicks = zoomLevel < 2 ? d3.timeYear.every(1) : (zoomLevel < 8 ? d3.timeMonth.every(3) : d3.timeMonth.every(1));
    topAxis.call(d3.axisTop(scale).ticks(topTicks).tickFormat(topFormat));

    // Bottom axis
    const bottomAxis = g.append('g')
        .attr('class', 'x-axis-bottom axis-major')
        .attr('transform', \`translate(0,\${effectiveHeight + 20})\`);
    const bottomTicks = zoomLevel < 2 ? d3.timeMonth.every(3) : (zoomLevel < 8 ? d3.timeMonth.every(1) : d3.timeWeek.every(1));
    bottomAxis.call(d3.axisBottom(scale).ticks(bottomTicks).tickFormat(bottomFormat));
};

updateTimeAxis(xScale, 1);

// ============================================================================
// Y AXIS (EQUIPMENT LABELS)
// ============================================================================

const yAxis = g.append('g').attr('class', 'y-axis');
equipment.forEach(equip => {
    yAxis.append('text')
        .attr('x', -20)
        .attr('y', equipmentPositions[equip] + 5)
        .attr('text-anchor', 'end')
        .style('font-size', '12px')
        .text(equip);
});

// ============================================================================
// REFERENCE LINES (YEAR MARKS AND TODAY)
// ============================================================================

// Year marks
const yearMarks = [];
for (let year = minStart.getFullYear(); year <= maxEnd.getFullYear(); year++) {
    const yearStart = new Date(year, 0, 1);
    if (yearStart >= minStart && yearStart <= maxEnd) {
        yearMarks.push({ year, date: yearStart });
    }
}

const yearsG = g.append('g').attr('class', 'year-marks');
yearsG.selectAll('.year-mark')
    .data(yearMarks)
    .enter()
    .append('line')
    .attr('class', 'year-mark')
    .attr('x1', d => xScale(d.date))
    .attr('x2', d => xScale(d.date))
    .attr('y1', 0)
    .attr('y2', effectiveHeight)
    .attr('stroke', '#999')
    .attr('stroke-width', 2)
    .attr('opacity', 0.5);

// Today line
const now = new Date();
if (now >= minStart && now <= maxEnd) {
    g.append('line')
        .attr('class', 'today-line')
        .attr('x1', xScale(now))
        .attr('x2', xScale(now))
        .attr('y1', 0)
        .attr('y2', effectiveHeight)
        .attr('stroke', '#ff4444')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5');

    g.append('text')
        .attr('class', 'today-label')
        .attr('x', xScale(now) + 5)
        .attr('y', -20)
        .attr('fill', '#ff4444')
        .attr('font-weight', 'bold')
        .text('Today');
}

// ============================================================================
// COLOR SCALE AND INTERACTIVE LEGEND
// ============================================================================

const colorScale = d3.scaleOrdinal(d3.schemeTableau10).domain(equipment);
const activeEquipment = new Set(equipment);

// Legend
if (equipment.length > 0) {
    const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', \`translate(\${availableWidth - margin.right + 10}, \${margin.top})\`);

    legend.append('text')
        .attr('x', 0)
        .attr('y', 0)
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .text('Equipment:');

    equipment.forEach((equip, i) => {
        const legendItem = legend.append('g')
            .attr('class', 'legend-item')
            .attr('transform', \`translate(0, \${20 + i * 25})\`)
            .style('cursor', 'pointer')
            .on('click', function() {
                if (activeEquipment.has(equip)) {
                    activeEquipment.delete(equip);
                    d3.select(this).style('opacity', 0.3);
                } else {
                    activeEquipment.add(equip);
                    d3.select(this).style('opacity', 1);
                }
                updateBars();
            });

        legendItem.append('rect')
            .attr('width', 15)
            .attr('height', 15)
            .attr('fill', colorScale(equip))
            .attr('stroke', '#333')
            .attr('stroke-width', 1);

        const labelText = equip.length > 15 ? equip.substring(0, 12) + '...' : equip;
        legendItem.append('text')
            .attr('x', 20)
            .attr('y', 12)
            .style('font-size', '11px')
            .text(labelText);
    });
}

// ============================================================================
// DATA BARS
// ============================================================================

const barsGroup = g.append('g').attr('class', 'bars-group');

const updateBars = () => {
    const filteredData = processed.filter(d => activeEquipment.has(d.equipment));

    const bars = barsGroup.selectAll('rect.bar')
        .data(filteredData, d => d.id)
        .join('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(d.start))
        .attr('y', d => equipmentPositions[d.equipment] - rowHeight / 4)
        .attr('width', d => Math.max(1, xScale(d.end) - xScale(d.start)))
        .attr('height', rowHeight / 2)
        .attr('fill', d => colorScale(d.equipment))
        .attr('stroke', '#333')
        .attr('stroke-width', 1)
        .attr('rx', 3);

    bars.append('title')
        .text(d => \`\${d.test}\\nEquipment: \${d.equipment}\\nDuration: \${Math.round((d.end - d.start) / 86400000)} days\`);
};

updateBars();

// ============================================================================
// ZOOM AND PAN BEHAVIOR
// ============================================================================

const zoom = d3.zoom()
    .scaleExtent([0.5, 24])
    .on('zoom', (event) => {
        currentZoomLevel = event.transform.k;
        const newXScale = event.transform.rescaleX(xScale);

        updateTimeAxis(newXScale, currentZoomLevel);

        barsGroup.selectAll('rect.bar')
            .attr('x', d => newXScale(d.start))
            .attr('width', d => Math.max(1, newXScale(d.end) - newXScale(d.start)));

        yearsG.selectAll('.year-mark')
            .attr('x1', d => newXScale(d.date))
            .attr('x2', d => newXScale(d.date));

        if (now >= minStart && now <= maxEnd) {
            g.select('.today-line')
                .attr('x1', newXScale(now))
                .attr('x2', newXScale(now));
            g.select('.today-label')
                .attr('x', newXScale(now) + 5);
        }
    });

svg.call(zoom);

// ============================================================================
// TITLE
// ============================================================================

svg.append('text')
    .attr('x', availableWidth / 2)
    .attr('y', 30)
    .attr('text-anchor', 'middle')
    .style('font-size', '20px')
    .style('font-weight', 'bold')
    .text('Equipment Utilization - Gantt Chart');`
    },
    
    'fte': {
        id: 'fte',
        name: 'FTE Utilization',
        code: `// FTE Utilization Gantt Chart
// Expects data.fte_usage array with: fte_id, test_id, test_name, start_date, end_date
// Also supports camelCase format: fteUsage, fteId, testName, startDate, endDate

const fteUsage = data.fte_usage || data.fteUsage || [];
if (!data || fteUsage.length === 0) {
    d3.select(container).append('text')
        .attr('x', 400)
        .attr('y', 200)
        .attr('text-anchor', 'middle')
        .style('font-size', '18px')
        .style('fill', '#666')
        .text('No FTE usage data available');
    return;
}

// Clear any existing content
d3.select(container).selectAll('*').remove();

// Process and parse data
const processed = fteUsage.map(d => {
    const parseDateTime = (dateVal, timeVal) => {
        if (!dateVal) return new Date();
        const timePart = (timeVal && String(timeVal).trim()) ? String(timeVal).trim() : '00:00:00';
        const datePart = dateVal instanceof Date ? d3.timeFormat('%Y-%m-%d')(dateVal) : String(dateVal).trim();
        return new Date(\`\${datePart}T\${timePart}\`);
    };
    
    const startDate = d.start_date ?? d.startDate;
    const startTime = d.start_time ?? d.startTime;
    const endDate = d.end_date ?? d.endDate;
    const endTime = d.end_time ?? d.endTime;
    
    const start = startDate instanceof Date ? startDate : parseDateTime(startDate, startTime || '00:00:00');
    const end = endDate instanceof Date ? endDate : parseDateTime(endDate, endTime || '23:59:59');
    
    return {
        id: \`\${d.fte_id ?? d.fteId ?? 'unknown'}-\${d.test_name ?? d.testName ?? d.test_id ?? d.testId}-\${start.getTime()}\`,
        fte: d.fte_id ?? d.fteId ?? 'Unknown',
        test: d.test_name ?? d.testName ?? d.test_id ?? d.testId ?? 'Test',
        start,
        end,
        test_short: (d.test_name ?? d.testName ?? d.test_id ?? d.testId ?? 'Test').substring(0, 20)
    };
});

// ============================================================================
// DIMENSIONS AND LAYOUT SETUP
// ============================================================================

const rect = container.getBoundingClientRect();
const availableWidth = Math.max(1200, rect.width - 40);
const availableHeight = Math.max(900, rect.height - 40);

const margin = { top: 100, right: 150, bottom: 80, left: 150 };
const width = availableWidth - margin.left - margin.right;
const height = availableHeight - margin.top - margin.bottom;

const svg = d3.select(container)
    .append('svg')
    .attr('width', availableWidth)
    .attr('height', availableHeight);

const g = svg.append('g')
    .attr('transform', \`translate(\${margin.left},\${margin.top})\`);

// ============================================================================
// FTE GROUPING AND POSITIONING
// ============================================================================

// Sort FTEs naturally
const ftes = [...new Set(processed.map(d => d.fte))].sort((a, b) => 
    a.localeCompare(b, undefined, { numeric: true })
);

// Calculate positions with adaptive sizing
const totalFtes = ftes.length;
const availableContentHeight = height - 20;
let rowHeight = 35;

if (totalFtes > 0) {
    const neededHeight = totalFtes * rowHeight + 20;
    if (neededHeight > availableContentHeight) {
        rowHeight = Math.max(20, availableContentHeight / totalFtes);
    }
}

const ftePositions = {};
ftes.forEach((fte, i) => {
    ftePositions[fte] = i * rowHeight + rowHeight / 2;
});

const totalHeight = totalFtes * rowHeight;
const effectiveHeight = Math.min(totalHeight, height);

// Clipping warning
if (totalHeight > height) {
    svg.append('text')
        .attr('x', availableWidth - 10)
        .attr('y', 20)
        .attr('text-anchor', 'end')
        .style('font-size', '12px')
        .style('fill', '#ff6b35')
        .style('font-weight', 'bold')
        .text('⚠ Chart clipped - some data not visible');
}

// ============================================================================
// TIME SCALE
// ============================================================================

const minStart = d3.min(processed, d => d.start);
const maxEnd = d3.max(processed, d => d.end);
const xScale = d3.scaleTime()
    .domain([minStart, maxEnd])
    .range([0, width])
    .nice();

// ============================================================================
// VISUAL BACKGROUND ELEMENTS
// ============================================================================

// Zebra striping
const stripes = g.append('g').attr('class', 'stripes');
ftes.forEach((fte, i) => {
    if (i % 2 === 1) {
        stripes.append('rect')
            .attr('class', 'zebra-stripe')
            .attr('x', 0)
            .attr('y', ftePositions[fte] - rowHeight / 2)
            .attr('width', width)
            .attr('height', rowHeight)
            .attr('fill', '#f5f5f5');
    }
});

// ============================================================================
// ADAPTIVE TIME AXES
// ============================================================================

let currentZoomLevel = 1;

const updateTimeAxis = (scale, zoomLevel) => {
    g.selectAll('.x-axis-top, .x-axis-bottom, .grid-group').remove();
    
    let topFormat, bottomFormat, gridTicks;
    if (zoomLevel < 2) {
        topFormat = d => d3.timeFormat('%Y')(d);
        bottomFormat = d => \`Q\${Math.floor(d.getMonth() / 3) + 1}\`;
        gridTicks = d3.timeMonth.every(3);
    } else if (zoomLevel < 8) {
        topFormat = d => d3.timeFormat('%Y')(d);
        bottomFormat = d => d3.timeFormat('%b')(d);
        gridTicks = d3.timeMonth.every(1);
    } else {
        topFormat = d => d3.timeFormat('%b %Y')(d);
        bottomFormat = d => \`W\${d3.timeFormat('%U')(d)}\`;
        gridTicks = d3.timeWeek.every(1);
    }

    // Grid lines
    const gridGroup = g.append('g').attr('class', 'grid-group');
    const gridLines = gridGroup.append('g')
        .attr('class', 'grid-minor')
        .attr('transform', \`translate(0,\${effectiveHeight})\`);

    gridLines.selectAll('line')
        .data(scale.ticks(gridTicks))
        .enter()
        .append('line')
        .attr('x1', d => scale(d))
        .attr('x2', d => scale(d))
        .attr('y1', 0)
        .attr('y2', -effectiveHeight)
        .attr('stroke', '#f0f0f0')
        .attr('stroke-width', 0.5);

    // Top axis
    const topAxis = g.append('g')
        .attr('class', 'x-axis-top axis-major')
        .attr('transform', 'translate(0,-10)');
    const topTicks = zoomLevel < 2 ? d3.timeYear.every(1) : (zoomLevel < 8 ? d3.timeMonth.every(3) : d3.timeMonth.every(1));
    topAxis.call(d3.axisTop(scale).ticks(topTicks).tickFormat(topFormat));

    // Bottom axis
    const bottomAxis = g.append('g')
        .attr('class', 'x-axis-bottom axis-major')
        .attr('transform', \`translate(0,\${effectiveHeight + 20})\`);
    const bottomTicks = zoomLevel < 2 ? d3.timeMonth.every(3) : (zoomLevel < 8 ? d3.timeMonth.every(1) : d3.timeWeek.every(1));
    bottomAxis.call(d3.axisBottom(scale).ticks(bottomTicks).tickFormat(bottomFormat));
};

updateTimeAxis(xScale, 1);

// ============================================================================
// Y AXIS (FTE LABELS)
// ============================================================================

const yAxis = g.append('g').attr('class', 'y-axis');
ftes.forEach(fte => {
    yAxis.append('text')
        .attr('x', -20)
        .attr('y', ftePositions[fte] + 5)
        .attr('text-anchor', 'end')
        .style('font-size', '12px')
        .text(fte);
});

// ============================================================================
// REFERENCE LINES (YEAR MARKS AND TODAY)
// ============================================================================

// Year marks
const yearMarks = [];
for (let year = minStart.getFullYear(); year <= maxEnd.getFullYear(); year++) {
    const yearStart = new Date(year, 0, 1);
    if (yearStart >= minStart && yearStart <= maxEnd) {
        yearMarks.push({ year, date: yearStart });
    }
}

const yearsG = g.append('g').attr('class', 'year-marks');
yearsG.selectAll('.year-mark')
    .data(yearMarks)
    .enter()
    .append('line')
    .attr('class', 'year-mark')
    .attr('x1', d => xScale(d.date))
    .attr('x2', d => xScale(d.date))
    .attr('y1', 0)
    .attr('y2', effectiveHeight)
    .attr('stroke', '#999')
    .attr('stroke-width', 2)
    .attr('opacity', 0.5);

// Today line
const now = new Date();
if (now >= minStart && now <= maxEnd) {
    g.append('line')
        .attr('class', 'today-line')
        .attr('x1', xScale(now))
        .attr('x2', xScale(now))
        .attr('y1', 0)
        .attr('y2', effectiveHeight)
        .attr('stroke', '#ff4444')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5');

    g.append('text')
        .attr('class', 'today-label')
        .attr('x', xScale(now) + 5)
        .attr('y', -20)
        .attr('fill', '#ff4444')
        .attr('font-weight', 'bold')
        .text('Today');
}

// ============================================================================
// COLOR SCALE AND INTERACTIVE LEGEND
// ============================================================================

const colorScale = d3.scaleOrdinal(d3.schemeSet2).domain(ftes);
const activeFtes = new Set(ftes);

// Legend
if (ftes.length > 0) {
    const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', \`translate(\${availableWidth - margin.right + 10}, \${margin.top})\`);

    legend.append('text')
        .attr('x', 0)
        .attr('y', 0)
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .text('FTE:');

    ftes.forEach((fte, i) => {
        const legendItem = legend.append('g')
            .attr('class', 'legend-item')
            .attr('transform', \`translate(0, \${20 + i * 25})\`)
            .style('cursor', 'pointer')
            .on('click', function() {
                if (activeFtes.has(fte)) {
                    activeFtes.delete(fte);
                    d3.select(this).style('opacity', 0.3);
                } else {
                    activeFtes.add(fte);
                    d3.select(this).style('opacity', 1);
                }
                updateBars();
            });

        legendItem.append('rect')
            .attr('width', 15)
            .attr('height', 15)
            .attr('fill', colorScale(fte))
            .attr('stroke', '#333')
            .attr('stroke-width', 1);

        const labelText = fte.length > 15 ? fte.substring(0, 12) + '...' : fte;
        legendItem.append('text')
            .attr('x', 20)
            .attr('y', 12)
            .style('font-size', '11px')
            .text(labelText);
    });
}

// ============================================================================
// DATA BARS
// ============================================================================

const barsGroup = g.append('g').attr('class', 'bars-group');

const updateBars = () => {
    const filteredData = processed.filter(d => activeFtes.has(d.fte));

    const bars = barsGroup.selectAll('rect.bar')
        .data(filteredData, d => d.id)
        .join('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(d.start))
        .attr('y', d => ftePositions[d.fte] - rowHeight / 4)
        .attr('width', d => Math.max(1, xScale(d.end) - xScale(d.start)))
        .attr('height', rowHeight / 2)
        .attr('fill', d => colorScale(d.fte))
        .attr('stroke', '#333')
        .attr('stroke-width', 1)
        .attr('rx', 3);

    bars.append('title')
        .text(d => \`\${d.test}\\nFTE: \${d.fte}\\nDuration: \${Math.round((d.end - d.start) / 86400000)} days\`);
};

updateBars();

// ============================================================================
// ZOOM AND PAN BEHAVIOR
// ============================================================================

const zoom = d3.zoom()
    .scaleExtent([0.5, 24])
    .on('zoom', (event) => {
        currentZoomLevel = event.transform.k;
        const newXScale = event.transform.rescaleX(xScale);

        updateTimeAxis(newXScale, currentZoomLevel);

        barsGroup.selectAll('rect.bar')
            .attr('x', d => newXScale(d.start))
            .attr('width', d => Math.max(1, newXScale(d.end) - newXScale(d.start)));

        yearsG.selectAll('.year-mark')
            .attr('x1', d => newXScale(d.date))
            .attr('x2', d => newXScale(d.date));

        if (now >= minStart && now <= maxEnd) {
            g.select('.today-line')
                .attr('x1', newXScale(now))
                .attr('x2', newXScale(now));
            g.select('.today-label')
                .attr('x', newXScale(now) + 5);
        }
    });

svg.call(zoom);

// ============================================================================
// TITLE
// ============================================================================

svg.append('text')
    .attr('x', availableWidth / 2)
    .attr('y', 30)
    .attr('text-anchor', 'middle')
    .style('font-size', '20px')
    .style('font-weight', 'bold')
    .text('FTE Utilization - Gantt Chart');`
    },
    
    'concurrency': {
        id: 'concurrency',
        name: 'Active Tests vs Capacity',
        code: `// Active Tests vs Capacity Chart
// Expects data.concurrency_timeseries array with: timestamp, active_tests, available_fte, available_equipment, capacity_min
// Also supports camelCase format: concurrencyTimeseries, activeTests, availableFte, availableEquipment, capacityMin

const concurrencyTimeseries = data.concurrency_timeseries || data.concurrencyTimeseries || [];
if (!data || concurrencyTimeseries.length === 0) {
    d3.select(container).append('text')
        .attr('x', 400)
        .attr('y', 200)
        .attr('text-anchor', 'middle')
        .style('font-size', '18px')
        .style('fill', '#666')
        .text('No concurrency data available');
    return;
}

// Clear any existing content
d3.select(container).selectAll('*').remove();

// Process and parse data
const processed = concurrencyTimeseries.map(d => ({
    timestamp: d.timestamp ? new Date(d.timestamp) : new Date(),
    active_tests: +(d.active_tests ?? d.activeTests) || 0,
    capacity_min: +(d.capacity_min ?? d.capacityMin) || 0,
    available_fte: +(d.available_fte ?? d.availableFte) || 0,
    available_equipment: +(d.available_equipment ?? d.availableEquipment) || 0
}));

// ============================================================================
// DIMENSIONS AND LAYOUT SETUP
// ============================================================================

const rect = container.getBoundingClientRect();
const availableWidth = Math.max(1200, rect.width - 40);
const availableHeight = Math.max(900, rect.height - 40);

const margin = { top: 100, right: 150, bottom: 80, left: 80 };
const width = availableWidth - margin.left - margin.right;
const height = availableHeight - margin.top - margin.bottom;

const svg = d3.select(container)
    .append('svg')
    .attr('width', availableWidth)
    .attr('height', availableHeight);

const g = svg.append('g')
    .attr('transform', \`translate(\${margin.left},\${margin.top})\`);

// ============================================================================
// TIME SCALE AND Y SCALE
// ============================================================================

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

// ============================================================================
// ADAPTIVE TIME AXES
// ============================================================================

let currentZoomLevel = 1;

const updateTimeAxis = (scale, zoomLevel) => {
    g.selectAll('.x-axis-top, .x-axis-bottom, .grid-group').remove();
    
    let topFormat, bottomFormat, gridTicks;
    if (zoomLevel < 2) {
        topFormat = d => d3.timeFormat('%Y')(d);
        bottomFormat = d => \`Q\${Math.floor(d.getMonth() / 3) + 1}\`;
        gridTicks = d3.timeMonth.every(3);
    } else if (zoomLevel < 8) {
        topFormat = d => d3.timeFormat('%Y')(d);
        bottomFormat = d => d3.timeFormat('%b')(d);
        gridTicks = d3.timeMonth.every(1);
    } else {
        topFormat = d => d3.timeFormat('%b %Y')(d);
        bottomFormat = d => \`W\${d3.timeFormat('%U')(d)}\`;
        gridTicks = d3.timeWeek.every(1);
    }

    // Grid lines
    const gridGroup = g.append('g').attr('class', 'grid-group');
    
    // Vertical grid lines (time)
    const vGridLines = gridGroup.append('g')
        .attr('class', 'grid-vertical')
        .attr('transform', \`translate(0,\${height})\`);
    
    vGridLines.selectAll('line')
        .data(scale.ticks(gridTicks))
        .enter()
        .append('line')
        .attr('x1', d => scale(d))
        .attr('x2', d => scale(d))
        .attr('y1', 0)
        .attr('y2', -height)
        .attr('stroke', '#f0f0f0')
        .attr('stroke-width', 0.5);

    // Horizontal grid lines
    const hGridLines = gridGroup.append('g').attr('class', 'grid-horizontal');
    hGridLines.selectAll('line')
        .data(yScale.ticks(10))
        .enter()
        .append('line')
        .attr('x1', 0)
        .attr('x2', width)
        .attr('y1', d => yScale(d))
        .attr('y2', d => yScale(d))
        .attr('stroke', '#f0f0f0')
        .attr('stroke-width', 0.5);

    // Top axis
    const topAxis = g.append('g')
        .attr('class', 'x-axis-top axis-major')
        .attr('transform', 'translate(0,-10)');
    const topTicks = zoomLevel < 2 ? d3.timeYear.every(1) : (zoomLevel < 8 ? d3.timeMonth.every(3) : d3.timeMonth.every(1));
    topAxis.call(d3.axisTop(scale).ticks(topTicks).tickFormat(topFormat));

    // Bottom axis
    const bottomAxis = g.append('g')
        .attr('class', 'x-axis-bottom axis-major')
        .attr('transform', \`translate(0,\${height + 20})\`);
    const bottomTicks = zoomLevel < 2 ? d3.timeMonth.every(3) : (zoomLevel < 8 ? d3.timeMonth.every(1) : d3.timeWeek.every(1));
    bottomAxis.call(d3.axisBottom(scale).ticks(bottomTicks).tickFormat(bottomFormat));
};

updateTimeAxis(xScale, 1);

// ============================================================================
// Y AXIS
// ============================================================================

const yAxis = g.append('g')
    .attr('class', 'y-axis')
    .call(d3.axisLeft(yScale));

// Y axis label
svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2 - margin.top)
    .attr('y', 20)
    .attr('text-anchor', 'middle')
    .style('font-size', '14px')
    .text('Count');

// ============================================================================
// REFERENCE LINES (YEAR MARKS AND TODAY)
// ============================================================================

// Year marks
const yearMarks = [];
for (let year = minTime.getFullYear(); year <= maxTime.getFullYear(); year++) {
    const yearStart = new Date(year, 0, 1);
    if (yearStart >= minTime && yearStart <= maxTime) {
        yearMarks.push({ year, date: yearStart });
    }
}

const yearsG = g.append('g').attr('class', 'year-marks');
yearsG.selectAll('.year-mark')
    .data(yearMarks)
    .enter()
    .append('line')
    .attr('class', 'year-mark')
    .attr('x1', d => xScale(d.date))
    .attr('x2', d => xScale(d.date))
    .attr('y1', 0)
    .attr('y2', height)
    .attr('stroke', '#999')
    .attr('stroke-width', 2)
    .attr('opacity', 0.5);

// Today line
const now = new Date();
if (now >= minTime && now <= maxTime) {
    g.append('line')
        .attr('class', 'today-line')
        .attr('x1', xScale(now))
        .attr('x2', xScale(now))
        .attr('y1', 0)
        .attr('y2', height)
        .attr('stroke', '#ff4444')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5');

    g.append('text')
        .attr('class', 'today-label')
        .attr('x', xScale(now) + 5)
        .attr('y', -20)
        .attr('fill', '#ff4444')
        .attr('font-weight', 'bold')
        .text('Today');
}

// ============================================================================
// INTERACTIVE LEGEND
// ============================================================================

const seriesConfig = [
    { key: 'active_tests', label: 'Active Tests', color: '#1f77b4', dashArray: 'none' },
    { key: 'capacity_min', label: 'Capacity', color: '#ff0000', dashArray: '5,5' }
];

const activeSeries = new Set(seriesConfig.map(s => s.key));

// Legend
const legend = svg.append('g')
    .attr('class', 'legend')
    .attr('transform', \`translate(\${availableWidth - margin.right + 10}, \${margin.top})\`);

legend.append('text')
    .attr('x', 0)
    .attr('y', 0)
    .style('font-size', '12px')
    .style('font-weight', 'bold')
    .text('Series:');

seriesConfig.forEach((series, i) => {
    const legendItem = legend.append('g')
        .attr('class', 'legend-item')
        .attr('transform', \`translate(0, \${20 + i * 25})\`)
        .style('cursor', 'pointer')
        .on('click', function() {
            if (activeSeries.has(series.key)) {
                activeSeries.delete(series.key);
                d3.select(this).style('opacity', 0.3);
            } else {
                activeSeries.add(series.key);
                d3.select(this).style('opacity', 1);
            }
            updateLines();
        });

    legendItem.append('line')
        .attr('x1', 0)
        .attr('x2', 20)
        .attr('y1', 7)
        .attr('y2', 7)
        .attr('stroke', series.color)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', series.dashArray);

    legendItem.append('text')
        .attr('x', 25)
        .attr('y', 12)
        .style('font-size', '11px')
        .text(series.label);
});

// ============================================================================
// DATA LINES AND AREAS
// ============================================================================

const linesGroup = g.append('g').attr('class', 'lines-group');
const areasGroup = g.append('g').attr('class', 'areas-group');
const pointsGroup = g.append('g').attr('class', 'points-group');

const updateLines = () => {
    // Clear existing
    linesGroup.selectAll('*').remove();
    areasGroup.selectAll('*').remove();
    pointsGroup.selectAll('*').remove();

    seriesConfig.forEach(series => {
        if (!activeSeries.has(series.key)) return;

        // Area fill
        const area = d3.area()
            .x(d => xScale(d.timestamp))
            .y0(height)
            .y1(d => yScale(d[series.key]))
            .curve(series.key === 'capacity_min' ? d3.curveStepAfter : d3.curveMonotoneX);

        areasGroup.append('path')
            .datum(processed)
            .attr('class', \`area-\${series.key}\`)
            .attr('fill', series.color)
            .attr('fill-opacity', 0.1)
            .attr('d', area);

        // Line
        const line = d3.line()
            .x(d => xScale(d.timestamp))
            .y(d => yScale(d[series.key]))
            .curve(series.key === 'capacity_min' ? d3.curveStepAfter : d3.curveMonotoneX);

        linesGroup.append('path')
            .datum(processed)
            .attr('class', \`line-\${series.key}\`)
            .attr('fill', 'none')
            .attr('stroke', series.color)
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', series.dashArray === 'none' ? null : series.dashArray)
            .attr('d', line);

        // Interactive points (for tooltips)
        pointsGroup.selectAll(\`.point-\${series.key}\`)
            .data(processed)
            .enter()
            .append('circle')
            .attr('class', \`point-\${series.key}\`)
            .attr('cx', d => xScale(d.timestamp))
            .attr('cy', d => yScale(d[series.key]))
            .attr('r', 4)
            .attr('fill', series.color)
            .attr('stroke', '#fff')
            .attr('stroke-width', 1)
            .attr('opacity', 0)
            .style('cursor', 'pointer')
            .on('mouseover', function(event, d) {
                d3.select(this).attr('opacity', 1).attr('r', 6);
            })
            .on('mouseout', function() {
                d3.select(this).attr('opacity', 0).attr('r', 4);
            })
            .append('title')
            .text(d => \`\${d3.timeFormat('%Y-%m-%d %H:%M')(d.timestamp)}\\n\${series.label}: \${d[series.key]}\`);
    });
};

updateLines();

// ============================================================================
// TOOLTIP TRACKING LINE
// ============================================================================

const tooltipLine = g.append('line')
    .attr('class', 'tooltip-line')
    .attr('y1', 0)
    .attr('y2', height)
    .attr('stroke', '#333')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '2,2')
    .attr('opacity', 0);

const tooltipBox = svg.append('g')
    .attr('class', 'tooltip-box')
    .attr('opacity', 0);

tooltipBox.append('rect')
    .attr('fill', 'white')
    .attr('stroke', '#333')
    .attr('rx', 4);

const bisect = d3.bisector(d => d.timestamp).left;

svg.on('mousemove', function(event) {
    const [mx] = d3.pointer(event, g.node());
    const x0 = xScale.invert(mx);
    const i = bisect(processed, x0, 1);
    const d0 = processed[i - 1];
    const d1 = processed[i];
    const d = d0 && d1 ? (x0 - d0.timestamp > d1.timestamp - x0 ? d1 : d0) : d0 || d1;

    if (d) {
        tooltipLine
            .attr('x1', xScale(d.timestamp))
            .attr('x2', xScale(d.timestamp))
            .attr('opacity', 1);
    }
}).on('mouseout', function() {
    tooltipLine.attr('opacity', 0);
    tooltipBox.attr('opacity', 0);
});

// ============================================================================
// ZOOM AND PAN BEHAVIOR
// ============================================================================

const zoom = d3.zoom()
    .scaleExtent([0.5, 24])
    .on('zoom', (event) => {
        currentZoomLevel = event.transform.k;
        const newXScale = event.transform.rescaleX(xScale);

        updateTimeAxis(newXScale, currentZoomLevel);

        // Update lines and areas
        updateLines();

        // Update year marks
        yearsG.selectAll('.year-mark')
            .attr('x1', d => newXScale(d.date))
            .attr('x2', d => newXScale(d.date));

        // Update today line
        if (now >= minTime && now <= maxTime) {
            g.select('.today-line')
                .attr('x1', newXScale(now))
                .attr('x2', newXScale(now));
            g.select('.today-label')
                .attr('x', newXScale(now) + 5);
        }
    });

svg.call(zoom);

// ============================================================================
// TITLE
// ============================================================================

svg.append('text')
    .attr('x', availableWidth / 2)
    .attr('y', 30)
    .attr('text-anchor', 'middle')
    .style('font-size', '20px')
    .style('font-weight', 'bold')
    .text('Active Tests vs Capacity Over Time');`
    }
};
