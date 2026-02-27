// Equipment Utilization Gantt Chart
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
        return new Date(`${datePart}T${timePart}`);
    };
    
    const startDate = d.start_date ?? d.startDate;
    const startTime = d.start_time ?? d.startTime;
    const endDate = d.end_date ?? d.endDate;
    const endTime = d.end_time ?? d.endTime;
    
    const start = startDate instanceof Date ? startDate : parseDateTime(startDate, startTime || '00:00:00');
    const end = endDate instanceof Date ? endDate : parseDateTime(endDate, endTime || '23:59:59');
    
    return {
        id: `${d.equipment_id ?? d.equipmentId ?? 'unknown'}-${d.test_name ?? d.testName ?? d.test_id ?? d.testId}-${start.getTime()}`,
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
    .attr('transform', `translate(${margin.left},${margin.top})`);

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
        .text('â  Chart clipped - some data not visible');
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
        bottomFormat = d => `Q${Math.floor(d.getMonth() / 3) + 1}`;
        gridTicks = d3.timeMonth.every(3);
    } else if (zoomLevel < 8) {
        topFormat = d => d3.timeFormat('%Y')(d);
        bottomFormat = d => d3.timeFormat('%b')(d);
        gridTicks = d3.timeMonth.every(1);
    } else {
        topFormat = d => d3.timeFormat('%b %Y')(d);
        bottomFormat = d => `W${d3.timeFormat('%U')(d)}`;
        gridTicks = d3.timeWeek.every(1);
    }

    // Grid lines
    const gridGroup = g.append('g').attr('class', 'grid-group');
    const gridLines = gridGroup.append('g')
        .attr('class', 'grid-minor')
        .attr('transform', `translate(0,${effectiveHeight})`);

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
        .attr('transform', `translate(0,${effectiveHeight + 20})`);
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
        .attr('transform', `translate(${availableWidth - margin.right + 10}, ${margin.top})`);

    legend.append('text')
        .attr('x', 0)
        .attr('y', 0)
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .text('Equipment:');

    equipment.forEach((equip, i) => {
        const legendItem = legend.append('g')
            .attr('class', 'legend-item')
            .attr('transform', `translate(0, ${20 + i * 25})`)
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
        .text(d => `${d.test}\\nEquipment: ${d.equipment}\\nDuration: ${Math.round((d.end - d.start) / 86400000)} days`);
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
    .text('Equipment Utilization - Gantt Chart');