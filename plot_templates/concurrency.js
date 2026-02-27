// Active Tests vs Capacity Chart
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
    .attr('transform', `translate(${margin.left},${margin.top})`);

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
    
    // Vertical grid lines (time)
    const vGridLines = gridGroup.append('g')
        .attr('class', 'grid-vertical')
        .attr('transform', `translate(0,${height})`);
    
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
        .attr('transform', `translate(0,${height + 20})`);
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
    .attr('transform', `translate(${availableWidth - margin.right + 10}, ${margin.top})`);

legend.append('text')
    .attr('x', 0)
    .attr('y', 0)
    .style('font-size', '12px')
    .style('font-weight', 'bold')
    .text('Series:');

seriesConfig.forEach((series, i) => {
    const legendItem = legend.append('g')
        .attr('class', 'legend-item')
        .attr('transform', `translate(0, ${20 + i * 25})`)
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
            .attr('class', `area-${series.key}`)
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
            .attr('class', `line-${series.key}`)
            .attr('fill', 'none')
            .attr('stroke', series.color)
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', series.dashArray === 'none' ? null : series.dashArray)
            .attr('d', line);

        // Interactive points (for tooltips)
        pointsGroup.selectAll(`.point-${series.key}`)
            .data(processed)
            .enter()
            .append('circle')
            .attr('class', `point-${series.key}`)
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
            .text(d => `${d3.timeFormat('%Y-%m-%d %H:%M')(d.timestamp)}\\n${series.label}: ${d[series.key]}`);
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
    .text('Active Tests vs Capacity Over Time');