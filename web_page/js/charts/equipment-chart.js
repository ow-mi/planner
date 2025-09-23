/**
 * Equipment Utilization Gantt Chart Module
 *
 * This module creates a D3 Gantt chart for displaying equipment usage
 * over time with test assignments.
 *
 * Data Source: output/data/equipment_usage.csv
 * Expected columns: equipment_id, test_id, test_name, start, end
 *
 * @param {Array} raw - Raw data from CSV file
 */

function createD3GanttEquipment(raw) {
  d3.select('#plot').selectAll('*').remove();

  const container = document.getElementById('plot');
  const rect = container.getBoundingClientRect();
  // Make it more responsive by using the actual container size
  const availableWidth = Math.max(600, rect.width - 40); // Minimum width of 600px
  const availableHeight = Math.max(400, rect.height - 40); // Minimum height of 400px

  // Adjust margins based on screen size (extra space for minor week labels)
  const margin = {
    top: Math.max(50, availableHeight * 0.08),
    right: Math.max(80, availableWidth * 0.08),
    bottom: Math.max(100, availableHeight * 0.15), // Increased for minor labels
    left: Math.max(120, availableWidth * 0.15)
  };
  const width = availableWidth - margin.left - margin.right;
  const height = availableHeight - margin.top - margin.bottom;

  const svg = d3
    .select('#plot')
    .append('svg')
    .attr('width', availableWidth)
    .attr('height', availableHeight)
    .style('max-width', '100%')
    .style('height', 'auto');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const content = g.append('g').attr('class', 'content');

  if (!raw || raw.length === 0) {
    svg
      .append('text')
      .attr('x', availableWidth / 2)
      .attr('y', availableHeight / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '18px')
      .style('fill', '#666')
      .text('No equipment usage data available');
    return;
  }

  const processed = raw.map((d) => {
    // Handle both separate date/time columns (new format) and combined datetime columns (old format)
    let start, end;

    if (d.start_date && d.start_time) {
      // New format: separate date and time columns
      start = new Date(`${d.start_date}T${d.start_time}`);
    } else if (d.start) {
      // Old format: single datetime column
      start = typeof d.start === 'string' ? new Date(d.start) : d.start;
    } else {
      console.warn('No start date/time found for equipment test:', d.test_id);
      start = new Date(); // Fallback to current date
    }

    if (d.end_date && d.end_time) {
      // New format: separate date and time columns
      end = new Date(`${d.end_date}T${d.end_time}`);
    } else if (d.end) {
      // Old format: single datetime column
      end = typeof d.end === 'string' ? new Date(d.end) : d.end;
    } else {
      console.warn('No end date/time found for equipment test:', d.test_id);
      end = new Date(start.getTime() + 24 * 60 * 60 * 1000); // Fallback to 1 day later
    }

    const durationDays = (end - start) / 86400000;
    return {
      equipment: d.equipment_id || 'Unknown',
      test: d.test_name || d.test_id || 'Test',
      start,
      end,
      duration: durationDays / 7,
      test_short: (d.test_name || d.test_id || 'Test'),
    };
  });

  const equipment = [...new Set(processed.map((d) => d.equipment))];
  const yScale = d3.scaleBand().domain(equipment).range([0, height]).padding(0.2);

  const minStart = d3.min(processed, (d) => d.start);
  const maxEnd = d3.max(processed, (d) => d.end);
  const xScale = d3.scaleTime().domain([minStart, maxEnd]).range([0, width]).nice();

  // Responsive tick count based on available width
  const tickCount = Math.max(4, Math.floor(width / Math.max(100, width * 0.05)));


  // Add minor grid lines for every week (no ticks)
  const xGridMinor = d3.axisBottom(xScale)
    .ticks(d3.timeWeek.every(1)) // Every week
    .tickSize(-height)
    .tickFormat('');

  g.append('g')
    .attr('class', 'grid-minor')
    .attr('transform', `translate(0,${height})`)
    .call(xGridMinor)
    .selectAll('line')
    .style('stroke', '#e8e8e8')
    .style('stroke-width', 0.5)
    .style('opacity', 0.6);

  // Add major ticks for every 4 weeks
  const xAxisMajor = d3.axisBottom(xScale)
    .ticks(d3.timeWeek.every(4)) // Every 4 weeks
    .tickFormat(d => {
      const year = d3.timeFormat('%Y')(d);
      const weekNum = d3.timeFormat('%U')(d);
      const week = String(parseInt(weekNum) + 1).padStart(2, '0');
      return `${year}-W${week}`;
    });

  g.append('g')
    .attr('class', 'axis-major')
    .attr('transform', `translate(0,${height + 20})`)
    .call(xAxisMajor)
    .selectAll('text')
    .style('font-size', Math.max(9, Math.min(12, width / 120)) + 'px')
    .style('fill', '#333')
    .style('font-weight', 'bold');

  // Add new year indicators
  const startYear = minStart.getFullYear();
  const endYear = maxEnd.getFullYear();
  for (let year = startYear; year <= endYear; year++) {
    const yearStart = new Date(year, 0, 1); // January 1st of the year
    if (yearStart >= minStart && yearStart <= maxEnd) {
      const xYear = xScale(yearStart);
      // Add bold vertical line for new year
      g.append('line')
        .attr('x1', xYear)
        .attr('x2', xYear)
        .attr('y1', 0)
        .attr('y2', height)
        .attr('stroke', '#000000')
        .attr('stroke-width', 3)
        .attr('opacity', 0.8);
      // Add year label
      g.append('text')
        .attr('x', xYear + 5)
        .attr('y', 15)
        .attr('fill', '#000000')
        .attr('font-weight', 'bold')
        .attr('font-size', '14px')
        .text(year.toString());
    }
  }

  g.append('g').call(d3.axisLeft(yScale)).selectAll('text').style('font-size', Math.max(8, Math.min(13, width / 90)) + 'px').style('font-weight', 'normal');

  const now = new Date();
  if (now >= minStart && now <= maxEnd) {
    const xNow = xScale(now);
    g.append('line').attr('x1', xNow).attr('x2', xNow).attr('y1', 0).attr('y2', height).attr('stroke', '#ff0000').attr('stroke-width', 2).attr('stroke-dasharray', '5,5').attr('opacity', 0.8);
    g.append('text').attr('x', xNow + 6).attr('y', -10).attr('fill', '#ff0000').attr('font-weight', 'bold').attr('font-size', '12px').text('Today');
  }

  const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

  content.selectAll('rect.bar')
    .data(processed)
    .enter()
    .append('rect')
    .attr('class', 'bar')
    .attr('x', (d) => xScale(d.start))
    .attr('y', (d) => yScale(d.equipment) + yScale.bandwidth() * 0.2)
    .attr('width', (d) => Math.max(1, xScale(d.end) - xScale(d.start)))
    .attr('height', () => yScale.bandwidth() * 0.6)
    .attr('fill', (d) => colorScale(d.equipment))
    .attr('stroke', '#333')
    .attr('stroke-width', 1)
    .append('title')
    .text((d) => `${d.test}\nEquipment: ${d.equipment}\nDuration: ${d.duration.toFixed(1)} weeks`);

  // Add test labels
  const labelData = processed.map((d) => {
    const y = yScale(d.equipment) + yScale.bandwidth() * 0.2;
    const initialX = xScale(new Date((d.start.getTime() + d.end.getTime()) / 2));
    const initialY = y - 10;
    return { ...d, x: initialX, y: initialY, fy: initialY, initialX, barTopY: y, text: d.test_short };
  });

  const tmp = d3.select('body').append('svg').attr('class', 'tmp').style('visibility', 'hidden');
  labelData.forEach((d) => {
    const tn = tmp.append('text').style('font-size', '9px').style('font-weight', 'bold').text(d.text);
    const bb = tn.node().getBBox();
    d.width = bb.width;
    d.height = bb.height;
  });
  tmp.remove();

  const sim = d3.forceSimulation(labelData)
    .force('x', d3.forceX((d) => d.initialX).strength(0.5))
    .force('collide', d3.forceCollide((d) => d.width / 2 + 4).strength(1))
    .stop();
  for (let i = 0; i < 120; ++i) sim.tick();

  const labels = content.append('g')
    .attr('class', 'task-labels')
    .selectAll('.task-label-group')
    .data(labelData)
    .enter()
    .append('g')
    .attr('class', 'task-label-group')
    .attr('transform', (d) => `translate(${d.x}, ${d.y})`);

  labels.append('line')
    .attr('x1', 0)
    .attr('y1', (d) => d.height / 2)
    .attr('x2', (d) => d.initialX - d.x)
    .attr('y2', (d) => d.barTopY - d.y)
    .attr('stroke', '#555')
    .attr('stroke-width', 1);

  labels.append('rect')
    .attr('x', (d) => -d.width / 2 - 3)
    .attr('y', -2)
    .attr('width', (d) => d.width + 6)
    .attr('height', (d) => d.height + 4)
    .attr('rx', 4)
    .attr('ry', 4)
    .attr('fill', '#f9f9f9')
    .attr('stroke', '#999');

  labels.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '0.7em')
    .style('font-size', '9px')
    .style('font-weight', 'bold')
    .style('fill', '#000')
    .text((d) => d.text);

  // Add equipment end date labels
  const equipmentEndDates = Array.from(d3.group(processed, d => d.equipment), ([equipment, values]) => ({
    equipment: equipment,
    finalEnd: d3.max(values, d => d.end)
  }));

  content.selectAll(".end-label")
    .data(equipmentEndDates)
    .enter()
    .append("text")
    .attr("class", "end-label")
    .attr("x", d => xScale(d.finalEnd) + 8)
    .attr("y", d => yScale(d.equipment) + yScale.bandwidth() / 2)
    .attr("text-anchor", "start")
    .attr("dominant-baseline", "central")
    .style("font-size", Math.max(8, Math.min(12, width / 100)) + "px")
    .style("font-weight", "bold")
    .style("fill", "darkred")
    .text(d => {
      const weekNum = d3.timeFormat('%U')(d.finalEnd);
      const week = String(parseInt(weekNum) + 1).padStart(2, '0');
      return `W${week}`;
    });

  // Zoom and pan (x-axis)
  const zoomed = (event) => {
    const zx = event.transform.rescaleX(xScale);
    // Update grid
    const newGridMinor = d3.axisBottom(zx).ticks(d3.timeWeek.every(1)).tickSize(-height).tickFormat('');
    g.select('.grid-minor').call(newGridMinor).selectAll('line').style('stroke', '#e8e8e8').style('stroke-width', 0.5).style('opacity', 0.6);
    // Update minor axis labels
    const xAxisMinor = d3.axisBottom(zx).ticks(d3.timeWeek.every(1)).tickFormat(d => {
      const weekNum = d3.timeFormat('%U')(d);
      const week = String(parseInt(weekNum) + 1).padStart(2, '0');
      return `W${week}`;
    });
    g.select('.axis-minor').call(xAxisMinor).selectAll('text').style('font-size', Math.max(7, Math.min(10, width / 150)) + 'px').style('fill', '#666').style('font-weight', 'normal');
    // Update bars
    content.selectAll('rect.bar')
      .attr('x', d => zx(d.start))
      .attr('width', d => Math.max(1, zx(d.end) - zx(d.start)));
    // Update labels
    labels.attr('transform', (d) => `translate(${zx(new Date((d.start.getTime() + d.end.getTime()) / 2))}, ${d.y})`);
    labels.select('line').attr('x2', (d) => d.initialX - (zx(new Date((d.start.getTime() + d.end.getTime()) / 2))));
    // Update end labels
    content.selectAll('text.end-label').attr('x', d => zx(d.finalEnd) + 8);
  };

  const zoom = d3.zoom().scaleExtent([0.5, 24]).translateExtent([[0, 0], [width, height]]).extent([[0, 0], [width, height]]).on('zoom', zoomed);
  svg.call(zoom);

  svg.append('text')
    .attr('x', availableWidth / 2)
    .attr('y', 28)
    .attr('text-anchor', 'middle')
    .style('font-size', Math.max(12, Math.min(20, width / 60)) + 'px')
    .style('font-weight', 'bold')
    .text('Equipment Utilization - Weeks');

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('y', 16)
    .attr('x', 0 - availableHeight / 2)
    .attr('dy', '1em')
    .style('text-anchor', 'middle')
    .style('font-size', Math.max(10, Math.min(16, width / 75)) + 'px')
    .text('Equipment');

  svg.append('text')
    .attr('transform', `translate(${availableWidth / 2}, ${availableHeight - 20})`)
    .style('text-anchor', 'middle')
    .style('font-size', Math.max(10, Math.min(16, width / 75)) + 'px')
    .text('Date');
}

