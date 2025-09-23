/**
 * Active Tests vs Capacity Line Chart Module
 *
 * This module creates a D3 line chart showing active test count compared
 * to available capacity over time.
 *
 * Data Source: output/data/concurrency_timeseries.csv
 * Expected columns: timestamp, active_tests, available_fte, available_equipment, capacity_min
 *
 * @param {Array} raw - Raw data from CSV file
 */

function createD3ConcurrencyLine(raw) {
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
      .text('No concurrency data available');
    return;
  }

  const processed = raw.map((d) => ({
    timestamp: typeof d.timestamp === 'string' ? new Date(d.timestamp) : d.timestamp,
    active_tests: +d.active_tests || 0,
    available_fte: +d.available_fte || 0,
    available_equipment: +d.available_equipment || 0,
    capacity_min: +d.capacity_min || 0,
  }));

  const minTime = d3.min(processed, (d) => d.timestamp);
  const maxTime = d3.max(processed, (d) => d.timestamp);
  const maxValue = d3.max(processed, (d) => Math.max(d.active_tests, d.capacity_min)) * 1.1;

  const xScale = d3.scaleTime().domain([minTime, maxTime]).range([0, width]).nice();
  const yScale = d3.scaleLinear().domain([0, maxValue]).range([height, 0]).nice();

  // Responsive tick count based on available width
  const tickCount = Math.max(4, Math.floor(width / Math.max(100, width * 0.05)));
  const xAxis = d3.axisBottom(xScale).ticks(d3.timeWeek.every(4)).tickFormat(d => {
    const year = d.getFullYear();
    const weekNum = d3.timeFormat('%U')(d); // Get week number (0-53)
    const week = String(parseInt(weekNum) + 1).padStart(2, '0'); // Convert to 1-based and pad
    return `${year}-W${week}`;
  });
  const yAxis = d3.axisLeft(yScale).ticks(10);

  const xGrid = d3.axisBottom(xScale).ticks(d3.timeWeek.every(4)).tickSize(-height).tickFormat('');
  const yGrid = d3.axisLeft(yScale).ticks(10).tickSize(-width).tickFormat('');

  g.append('g').attr('class', 'grid-x').attr('transform', `translate(0,${height})`).call(xGrid).selectAll('line').style('stroke', '#f0f0f0').style('stroke-width', 1).style('opacity', 0.8);
  g.append('g').attr('class', 'grid-y').call(yGrid).selectAll('line').style('stroke', '#f0f0f0').style('stroke-width', 1).style('opacity', 0.8);

  // Add new year indicators
  const startYear = minTime.getFullYear();
  const endYear = maxTime.getFullYear();
  for (let year = startYear; year <= endYear; year++) {
    const yearStart = new Date(year, 0, 1); // January 1st of the year
    if (yearStart >= minTime && yearStart <= maxTime) {
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

  const xAxisG = g.append('g').attr('class', 'axis-x').attr('transform', `translate(0,${height})`).call(xAxis).selectAll('text').style('text-anchor', 'end').attr('dx', '-.8em').attr('dy', '.15em').attr('transform', 'rotate(-45)').style('font-size', Math.max(8, Math.min(12, width / 100)) + 'px').style('font-weight', 'bold');
  const yAxisG = g.append('g').attr('class', 'axis-y').call(yAxis).selectAll('text').style('font-size', Math.max(8, Math.min(13, width / 90)) + 'px');

  // Add capacity line (step function)
  const capacityLine = d3.line()
    .x((d) => xScale(d.timestamp))
    .y((d) => yScale(d.capacity_min))
    .curve(d3.curveStepAfter);

  content.append('path')
    .datum(processed)
    .attr('class', 'capacity-line')
    .attr('fill', 'none')
    .attr('stroke', '#ff0000')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '5,5')
    .attr('d', capacityLine)
    .append('title')
    .text('Capacity (min of available FTE and Equipment)');

  // Add active tests line
  const activeLine = d3.line()
    .x((d) => xScale(d.timestamp))
    .y((d) => yScale(d.active_tests))
    .curve(d3.curveMonotoneX);

  const activePath = content.append('path')
    .datum(processed)
    .attr('class', 'active-line')
    .attr('fill', 'none')
    .attr('stroke', '#1f77b4')
    .attr('stroke-width', 2)
    .attr('d', activeLine)
    .append('title')
    .text('Active Tests');

  // Add data points for active tests
  content.selectAll('.active-point')
    .data(processed)
    .enter()
    .append('circle')
    .attr('class', 'active-point')
    .attr('cx', (d) => xScale(d.timestamp))
    .attr('cy', (d) => yScale(d.active_tests))
    .attr('r', 3)
    .attr('fill', '#1f77b4')
    .attr('stroke', '#fff')
    .attr('stroke-width', 1)
    .append('title')
    .text((d) => `Active Tests: ${d.active_tests}\nTime: ${d.timestamp.toISOString().split('T')[0]}`);

  // Add legend
  const legend = g.append('g').attr('transform', `translate(${width - 120}, 20)`);

  legend.append('line').attr('x1', 0).attr('x2', 20).attr('y1', 0).attr('y2', 0).attr('stroke', '#1f77b4').attr('stroke-width', 2);
  legend.append('text').attr('x', 25).attr('y', 0).attr('dy', '0.35em').style('font-size', '12px').text('Active Tests');

  legend.append('line').attr('x1', 0).attr('x2', 20).attr('y1', 20).attr('y2', 20).attr('stroke', '#ff0000').attr('stroke-width', 2).attr('stroke-dasharray', '5,5');
  legend.append('text').attr('x', 25).attr('y', 20).attr('dy', '0.35em').style('font-size', '12px').text('Capacity');

  // Add current date line
  const now = new Date();
  if (now >= minTime && now <= maxTime) {
    const xNow = xScale(now);
    var todayLine = content.append('line').attr('class', 'today-line').attr('x1', xNow).attr('x2', xNow).attr('y1', 0).attr('y2', height).attr('stroke', '#ff0000').attr('stroke-width', 2).attr('stroke-dasharray', '5,5').attr('opacity', 0.8);
    var todayText = content.append('text').attr('class', 'today-text').attr('x', xNow + 6).attr('y', height - 10).attr('fill', '#ff0000').attr('font-weight', 'bold').attr('font-size', '12px').text('Today');
  }

  svg.append('text')
    .attr('x', availableWidth / 2)
    .attr('y', 28)
    .attr('text-anchor', 'middle')
    .style('font-size', Math.max(12, Math.min(20, width / 60)) + 'px')
    .style('font-weight', 'bold')
    .text('Active Tests vs Capacity Over Time - Weeks');

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('y', 16)
    .attr('x', 0 - availableHeight / 2)
    .attr('dy', '1em')
    .style('text-anchor', 'middle')
    .style('font-size', Math.max(10, Math.min(16, width / 75)) + 'px')
    .text('Count');

  svg.append('text')
    .attr('transform', `translate(${availableWidth / 2}, ${availableHeight - 20})`)
    .style('text-anchor', 'middle')
    .style('font-size', Math.max(10, Math.min(16, width / 75)) + 'px')
    .text('Date');

  // Zoom and pan (x-axis)
  const zoomed = (event) => {
    const zx = event.transform.rescaleX(xScale);
    // Update axes
    const xAxisNew = d3.axisBottom(zx).ticks(d3.timeWeek.every(4)).tickFormat(d => {
      const year = d.getFullYear();
      const weekNum = d3.timeFormat('%U')(d);
      const week = String(parseInt(weekNum) + 1).padStart(2, '0');
      return `${year}-W${week}`;
    });
    g.select('.axis-x').call(xAxisNew).selectAll('text').style('text-anchor', 'end').attr('dx', '-.8em').attr('dy', '.15em').attr('transform', 'rotate(-45)').style('font-size', Math.max(8, Math.min(12, width / 100)) + 'px').style('font-weight', 'bold');
    const xGridNew = d3.axisBottom(zx).ticks(d3.timeWeek.every(4)).tickSize(-height).tickFormat('');
    g.select('.grid-x').call(xGridNew).selectAll('line').style('stroke', '#f0f0f0').style('stroke-width', 1).style('opacity', 0.8);

    // Update lines and points
    const capacityLineZ = d3.line().x(d => zx(d.timestamp)).y(d => yScale(d.capacity_min)).curve(d3.curveStepAfter);
    g.select('path.capacity-line').attr('d', capacityLineZ(processed));
    const activeLineZ = d3.line().x(d => zx(d.timestamp)).y(d => yScale(d.active_tests)).curve(d3.curveMonotoneX);
    g.select('path.active-line').attr('d', activeLineZ(processed));
    content.selectAll('circle.active-point').attr('cx', d => zx(d.timestamp));

    // Update today line
    if (todayLine) {
      const xNowZ = zx(now);
      todayLine.attr('x1', xNowZ).attr('x2', xNowZ);
      if (todayText) todayText.attr('x', xNowZ + 6);
    }
  };

  const zoom = d3.zoom().scaleExtent([0.5, 24]).translateExtent([[0, 0], [width, height]]).extent([[0, 0], [width, height]]).on('zoom', zoomed);
  svg.call(zoom);
}

