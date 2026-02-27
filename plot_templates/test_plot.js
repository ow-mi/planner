// Tests by Leg Gantt Chart
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

// --- Controls row (HTML) ----------------------------------------------------
const controls = d3.select(container)
  .append('div')
  .style('display', 'flex')
  .style('gap', '16px')
  .style('align-items', 'center')
  .style('padding', '8px 4px 0 4px')
  .style('font-family', 'sans-serif');

controls.append('label')
  .style('font-size', '12px')
  .style('display', 'flex')
  .style('align-items', 'center')
  .style('gap', '8px')
  .html(`
    <span style="font-weight:600;">Color by</span>
    <select id="colorModeSelect" style="font-size:12px; padding:2px 6px;">
      <option value="equipment" selected>Equipment</option>
      <option value="fte">FTE</option>
      <option value="leg">Leg</option>
    </select>
  `);

controls.append('label')
  .style('font-size', '12px')
  .style('display', 'flex')
  .style('align-items', 'center')
  .style('gap', '6px')
  .html(`<input id="legendToggle" type="checkbox" checked /> Show legend`);

// Process and parse data - handle both snake_case and camelCase field names
const processed = testSchedules.map(d => {
  const parseDateTime = (dateVal, timeVal) => {
    if (!dateVal) return new Date();
    const timePart = (timeVal && String(timeVal).trim()) ? String(timeVal).trim() : '00:00:00';
    const datePart = dateVal instanceof Date
      ? d3.timeFormat('%Y-%m-%d')(dateVal)
      : String(dateVal).trim();
    return new Date(`${datePart}T${timePart}`);
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
    id: `${d.project_leg_id ?? d.projectLegId ?? 'unknown'}-${d.test_name ?? d.testName ?? d.test_id ?? d.testId}`,
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
  top: 120,
  right: 360, // space for start/end columns + legend (adjusted dynamically)
  bottom: 80,
  left: 150
};
const legendWidth = 260;
const dateColWidth = 100;

// reserve space for BOTH date columns + minimal padding
const dateColsReserve = 120; // Start at 10, End at 70, leaves room for end text (~40px)

let legendVisible = true; // must be declared before rightReserve() which closes over it

// right reserve depends on legend visibility
const rightReserve = () => (legendVisible ? (dateColsReserve + legendWidth) : dateColsReserve);

// width calculation uses rightReserve
const getWidth = () => availableWidth - margin.left - rightReserve();
let width = getWidth();

const startColX = () => width + 10;
const endColX   = () => width + 70; // 60px gap from start column (matches original)

const height = availableHeight - margin.top - margin.bottom;

const svg = d3.select(container)
  .append('svg')
  .attr('width', availableWidth)
  .attr('height', availableHeight);

const g = svg.append('g')
  .attr('transform', `translate(${margin.left},${margin.top})`);

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
// 9. COLOR MODE + LEGEND (equipment / fte / leg) + FILTERING + TOGGLE
// ============================================================================

let colorMode = 'equipment'; // 'equipment' | 'fte' | 'leg'

// Label for items with no assigned category in current mode
const NONE_LABEL = 'None';

const categoryValue = (d) => {
  if (colorMode === 'fte') return (d.fte && String(d.fte).trim()) ? d.fte : NONE_LABEL;
  if (colorMode === 'leg') return (d.leg && String(d.leg).trim()) ? d.leg : NONE_LABEL;
  return (d.equipment && String(d.equipment).trim()) ? d.equipment : NONE_LABEL;
};

const categoryLabel = () => {
  if (colorMode === 'fte') return 'FTE:';
  if (colorMode === 'leg') return 'Leg:';
  return 'Equipment:';
};

const categoriesForMode = () => {
  const vals = processed.map(categoryValue); // now includes NONE_LABEL
  return [...new Set(vals)];
};

// active filter set (changes when mode changes)
let activeCategories = new Set(categoriesForMode());

// color scale (re-built when mode changes)
let colorScale = d3.scaleOrdinal(d3.schemeTableau10).domain(categoriesForMode());

// Legend container (kept, re-rendered)
const legend = svg.append('g')
  .attr('class', 'legend')
  // legend to the right of the two date columns
.attr('transform', `translate(${margin.left + width + dateColsReserve}, ${margin.top})`);

const renderLegend = () => {
  legend.selectAll('*').remove();

  if (!legendVisible) {
    legend.style('display', 'none');
    return;
  }
  legend.style('display', null);

  const values = categoriesForMode();
  if (values.length === 0) return;

  legend.append('text')
    .attr('x', 0)
    .attr('y', 10)
    .style('font-size', '12px')
    .style('font-weight', 'bold')
    .text(categoryLabel());

  values.forEach((val, i) => {
    const item = legend.append('g')
      .attr('class', 'legend-item')
      .attr('transform', `translate(0, ${20 + i * 22})`)
      .style('cursor', 'pointer')
      .style('opacity', activeCategories.has(val) ? 1 : 0.3)
      .on('click', function() {
        if (activeCategories.has(val)) activeCategories.delete(val);
        else activeCategories.add(val);

        d3.select(this).style('opacity', activeCategories.has(val) ? 1 : 0.3);
        updateBars();
        updateLabels();
      });

    item.append('rect')
      .attr('width', 14)
      .attr('height', 14)
      .attr('fill', colorScale(val))
      .attr('stroke', '#333')
      .attr('stroke-width', 1);

    item.append('text')
      .attr('x', 20)
      .attr('y', 11)
      .style('font-size', '11px')
      .text(val);
  });
};

// Hook up HTML controls
d3.select(container).select('#colorModeSelect').on('change', function() {
  colorMode = this.value;

  // rebuild scale + active set for new mode
  const vals = categoriesForMode();
  colorScale = d3.scaleOrdinal(d3.schemeTableau10).domain(vals);
  activeCategories = new Set(vals);

  renderLegend();
  updateBars();
  updateLabels();
});

d3.select(container).select('#legendToggle').on('change', function() {
  legendVisible = !!this.checked;
  resizeChart();
  renderLegend();
});

// initial render
renderLegend();

// ============================================================================
// 10. DATA BARS
// ============================================================================

const barsGroup = g.append('g').attr('class', 'bars-group');

// Resize chart when legend visibility changes
const resizeChart = () => {
  width = getWidth();
  xScale.range([0, width]);

  // Update stripes
  stripes.selectAll('.zebra-stripe')
    .attr('width', width);

  // Update group header separator lines
  headers.selectAll('line')
    .attr('x2', width);

  // Update year marks
  yearsG.selectAll('.year-mark')
    .attr('x1', d => xScale(d.date))
    .attr('x2', d => xScale(d.date));

  // Update today line
  if (now >= minStart && now <= maxEnd) {
    g.select('.today-line')
      .attr('x1', xScale(now))
      .attr('x2', xScale(now));
    g.select('.today-label')
      .attr('x', xScale(now) + 5);
  }

  // Update legend position
  legend.attr('transform', `translate(${margin.left + width + dateColsReserve}, ${margin.top})`);

  // Update date column positions
  legDateCols.select('.date-header-start').attr('x', startColX());
  legDateCols.select('.date-header-end').attr('x', endColX());
  legDateCols.selectAll('.leg-start-label').attr('x', startColX());
  legDateCols.selectAll('.leg-end-label').attr('x', endColX());

  // Re-render axes
  updateTimeAxis(xScale, currentZoomLevel);

  // Update bars
  barsGroup.selectAll('rect.bar')
    .attr('x', d => xScale(d.start))
    .attr('width', d => Math.max(1, xScale(d.end) - xScale(d.start)));

  // Update labels
  if (labelsVisible) {
    labelsGroup.selectAll('.task-label')
      .attr('transform', d => {
        const x = xScale(new Date((d.start.getTime() + d.end.getTime()) / 2));
        const y = legPositions[d.leg];
        return `translate(${x},${y - 15})`;
      });
  }
};

const updateBars = () => {
  const filteredData = processed.filter(d => activeCategories.has(categoryValue(d)));

  const bars = barsGroup.selectAll('rect.bar')
    .data(filteredData, d => d.id)
    .join('rect')
    .attr('class', 'bar')
    .attr('x', d => xScale(d.start))
    .attr('y', d => legPositions[d.leg] - rowHeight / 4)
    .attr('width', d => Math.max(1, xScale(d.end) - xScale(d.start)))
    .attr('height', rowHeight / 2)
    .attr('fill', d => {
      const cat = categoryValue(d);
      return (cat === NONE_LABEL) ? '#e0e0e0' : colorScale(cat);
    })
    .attr('stroke', '#333')
    .attr('stroke-width', 1.5)
    .attr('rx', 3);

  bars.selectAll('title').remove();
  bars.append('title')
    .text(d => {
      const durDays = Math.round((d.end - d.start) / 86400000);
      return [
        `${d.test}`,
        `Duration: ${durDays} days`,
        `Leg: ${d.leg}`,
        `Equipment: ${d.equipment || 'N/A'}`,
        `FTE: ${d.fte || 'N/A'}`
      ].join('\n');
    });
};

updateBars();

// ============================================================================
// 11. TASK LABELS
// ============================================================================

const labelsGroup = g.append('g').attr('class', 'labels-group');
let labelsVisible = true;

const updateLabels = () => {
  const filteredData = labelsVisible
    ? processed.filter(d => activeCategories.has(categoryValue(d)))
    : [];

  const labels = labelsGroup.selectAll('g.task-label')
    .data(filteredData, d => d.id)
    .join(
      enter => {
        const g0 = enter.append('g')
          .attr('class', 'task-label');

        g0.attr('transform', d => {
          const x = xScale(new Date((d.start.getTime() + d.end.getTime()) / 2));
          const y = legPositions[d.leg];
          return `translate(${x},${y - 15})`;
        });

        g0.append('text')
          .attr('text-anchor', 'middle')
          .style('font-size', '10px')
          .style('font-weight', 'bold')
          .text(d => d.test_short);

        g0.each(function() {
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

        return g0;
      },
      update => update,
      exit => exit.remove()
    );
};

updateLabels();

// ============================================================================
// 12. LEG START + END DATE LABELS (two columns)
// ============================================================================

const legStart = new Map();
const legEnd = new Map();

processed.forEach(d => {
  const s0 = legStart.get(d.leg);
  const e0 = legEnd.get(d.leg);
  if (!s0 || d.start < s0) legStart.set(d.leg, d.start);
  if (!e0 || d.end > e0) legEnd.set(d.leg, d.end);
});

const weekFormat = d3.timeFormat('%Y-%U');

const legDateCols = g.append('g').attr('class', 'leg-date-cols');

// column headers
legDateCols.append('text')
  .attr('class', 'date-header-start')
  .attr('x', startColX())
  .attr('y', -25)
  .attr('text-anchor', 'start')
  .style('font-size', '11px')
  .style('font-weight', 'bold')
  .style('fill', '#333')
  .text('Start');

legDateCols.append('text')
  .attr('class', 'date-header-end')
  .attr('x', endColX())
  .attr('y', -25)
  .attr('text-anchor', 'start')
  .style('font-size', '11px')
  .style('font-weight', 'bold')
  .style('fill', '#333')
  .text('End');

// per-leg values
legs.forEach(leg => {
  const s = legStart.get(leg);
  const e = legEnd.get(leg);
  if (!s || !e) return;

  legDateCols.append('text')
    .attr('class', 'leg-start-label')
    .attr('x', startColX())
    .attr('y', legPositions[leg] + 5)
    .attr('text-anchor', 'start')
    .attr('alignment-baseline', 'middle')
    .style('font-size', '11px')
    .style('fill', '#555')
    .text(weekFormat(s));

  legDateCols.append('text')
    .attr('class', 'leg-end-label')
    .attr('x', endColX())
    .attr('y', legPositions[leg] + 5)
    .attr('text-anchor', 'start')
    .attr('alignment-baseline', 'middle')
    .style('font-size', '11px')
    .style('fill', '#555')
    .text(weekFormat(e));
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
          return `translate(${x},${y - 15})`;
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

// Toggle labels button (SVG)
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
  });
