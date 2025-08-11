// Gantt Chart for tests_schedule.csv (time scale, legs on Y)
// Expects rows shaped like output/data/tests_schedule.csv
// Usage: d3.csv('output/data/tests_schedule.csv', d3.autoType).then(createD3Visualization)
function createD3Visualization(raw) {
  d3.select('#plot').selectAll('*').remove();

  const container = document.getElementById('plot');
  const rect = container.getBoundingClientRect();
  const availableWidth = Math.max(900, rect.width - 20);
  const availableHeight = Math.max(420, rect.height - 20);

  const margin = { top: 70, right: 120, bottom: 80, left: 140 };
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

  if (!raw || raw.length === 0) {
    svg
      .append('text')
      .attr('x', availableWidth / 2)
      .attr('y', availableHeight / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '18px')
      .style('fill', '#666')
      .text('No data available for visualization');
    return;
  }

  const processed = raw.map((d) => {
    const start = typeof d.start === 'string' ? new Date(d.start) : d.start;
    const end = typeof d.end === 'string' ? new Date(d.end) : d.end;
    const durationDays = (end - start) / 86400000;
    return {
      leg: d.project_leg_id || 'Unknown',
      test: d.test_name || d.test_id || 'Test',
      start,
      end,
      duration: durationDays / 7,
      equipment: d.assigned_equipment_id || '',
      fte: d.assigned_fte_id || '',
      seq: +d.sequence_index || 0,
      test_short: (d.test_name || d.test_id || 'Test').substring(0, 8).replace(/[-\s]/g, ''),
    };
  });

  const legs = [...new Set(processed.map((d) => d.leg))];
  const yScale = d3.scaleBand().domain(legs).range([0, height]).padding(0.2);

  const minStart = d3.min(processed, (d) => d.start);
  const maxEnd = d3.max(processed, (d) => d.end);
  const xScale = d3.scaleTime().domain([minStart, maxEnd]).range([0, width]).nice();

  const tickCount = Math.max(6, Math.floor(width / 120));
  const xAxis = d3.axisBottom(xScale).ticks(tickCount).tickFormat(d3.timeFormat('%Y-%m'));
  const xGrid = d3.axisBottom(xScale).ticks(tickCount).tickSize(-height).tickFormat('');

  g.append('g').attr('class', 'grid').attr('transform', `translate(0,${height})`).call(xGrid).selectAll('line').style('stroke', '#f0f0f0').style('stroke-width', 1).style('opacity', 0.8);

  g.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(xAxis)
    .selectAll('text')
    .style('text-anchor', 'end')
    .attr('dx', '-.8em')
    .attr('dy', '.15em')
    .attr('transform', 'rotate(-45)')
    .style('font-size', width > 1000 ? '10px' : '9px')
    .style('font-weight', 'bold');

  g.append('g').call(d3.axisLeft(yScale)).selectAll('text').style('font-size', width > 1000 ? '11px' : '9px');

  const now = new Date();
  if (now >= minStart && now <= maxEnd) {
    const xNow = xScale(now);
    g.append('line').attr('x1', xNow).attr('x2', xNow).attr('y1', 0).attr('y2', height).attr('stroke', '#ff0000').attr('stroke-width', 2).attr('stroke-dasharray', '5,5').attr('opacity', 0.8);
    g.append('text').attr('x', xNow + 6).attr('y', -10).attr('fill', '#ff0000').attr('font-weight', 'bold').attr('font-size', '12px').text('Today');
  }

  const equipValues = [...new Set(processed.map((d) => d.equipment))].filter(Boolean);
  const equipColor = d3.scaleOrdinal(d3.schemeTableau10).domain(equipValues);

  processed.forEach((d) => {
    const y = yScale(d.leg) + yScale.bandwidth() * 0.2;
    const barH = yScale.bandwidth() * 0.6;
    const x0 = xScale(d.start);
    const w = Math.max(1, xScale(d.end) - x0);
    g.append('rect').attr('x', x0).attr('y', y).attr('width', w).attr('height', barH).attr('fill', '#e0e0e0').attr('stroke', d.equipment ? equipColor(d.equipment) : '#999').attr('stroke-width', 2).append('title').text(`${d.test}\nLeg: ${d.leg}\nDuration: ${d.duration.toFixed(1)} weeks\nEquipment: ${d.equipment || 'any'}\nFTE: ${d.fte || 'any'}`);
  });

  const labelData = processed.map((d) => {
    const y = yScale(d.leg) + yScale.bandwidth() * 0.2;
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

  const sim = d3.forceSimulation(labelData).force('x', d3.forceX((d) => d.initialX).strength(0.5)).force('collide', d3.forceCollide((d) => d.width / 2 + 4).strength(1)).stop();
  for (let i = 0; i < 120; ++i) sim.tick();

  const labels = g.append('g').attr('class', 'task-labels').selectAll('.task-label-group').data(labelData).enter().append('g').attr('class', 'task-label-group').attr('transform', (d) => `translate(${d.x}, ${d.y})`);
  labels.append('line').attr('x1', 0).attr('y1', (d) => d.height / 2).attr('x2', (d) => d.initialX - d.x).attr('y2', (d) => d.barTopY - d.y).attr('stroke', '#555').attr('stroke-width', 1);
  labels.append('rect').attr('x', (d) => -d.width / 2 - 3).attr('y', -2).attr('width', (d) => d.width + 6).attr('height', (d) => d.height + 4).attr('rx', 4).attr('ry', 4).attr('fill', '#f9f9f9').attr('stroke', '#999');
  labels.append('text').attr('text-anchor', 'middle').attr('dy', '0.7em').style('font-size', '9px').style('font-weight', 'bold').style('fill', '#000').text((d) => d.text);

  svg.append('text').attr('x', availableWidth / 2).attr('y', 28).attr('text-anchor', 'middle').style('font-size', width > 1000 ? '18px' : '14px').style('font-weight', 'bold').text('Project Timeline (by Leg)');
  svg.append('text').attr('transform', 'rotate(-90)').attr('y', 16).attr('x', 0 - availableHeight / 2).attr('dy', '1em').style('text-anchor', 'middle').style('font-size', width > 1000 ? '14px' : '12px').text('Project Legs');
  svg.append('text').attr('transform', `translate(${availableWidth / 2}, ${availableHeight - 20})`).style('text-anchor', 'middle').style('font-size', width > 1000 ? '14px' : '12px').text('Date');
}