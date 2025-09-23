/**
 * Tests by Leg Gantt Chart Module
 *
 * This module creates a D3 Gantt chart for displaying scheduled tests
 * organized by project leg with a timeline view.
 *
 * Data Source: output/data/tests_schedule.csv
 * Expected columns: test_id, project_leg_id, test_name, sequence_index,
 *                   duration_days, start, end, assigned_equipment_id, assigned_fte_id
 *
 * @param {Array} raw - Raw data from CSV file
 */

function createD3GanttTests(raw) {
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
      .text('No test schedule data available');
    return;
  }

  const processed = raw.map((d) => {
    // Parse date/time strings into proper Date objects
    const parseDateTime = (dateVal, timeVal) => {
      const timePart = (timeVal && String(timeVal).trim()) ? String(timeVal).trim() : '00:00:00';
      let datePart;
      if (dateVal instanceof Date) {
        const y = dateVal.getFullYear();
        const m = String(dateVal.getMonth() + 1).padStart(2, '0');
        const d = String(dateVal.getDate()).padStart(2, '0');
        datePart = `${y}-${m}-${d}`;
      } else if (typeof dateVal === 'string' && dateVal.trim() !== '') {
        datePart = dateVal.trim();
      } else {
        return new Date(NaN);
      }
      return new Date(`${datePart}T${timePart}`);
    };
    
    const start = d.start instanceof Date ? d.start : parseDateTime(d.start_date, d.start_time);
    const end = d.end instanceof Date ? d.end : parseDateTime(d.end_date, d.end_time);
    
    const durationDays = (end - start) / 86400000;
    return {
      leg: d.project_leg_id || 'Unknown',
      test: d.test_name || d.test_id || 'Test',
      start,
      end,
      duration: durationDays / 7,
      equipment: d.assigned_equipment || '',
      fte: d.assigned_fte || '',
      seq: 0, // sequence_index not available in this CSV format
      test_short: (d.test_name || d.test_id || 'Test'),
    };
  });

  // Build custom-ordered legs list
  const getGroupPriority = (leg) => {
    if (typeof leg !== 'string') return 99;
    if (leg.startsWith('mwcu_b10_')) return 0;
    if (leg.startsWith('mwcu_a7_')) return 1;
    if (leg.startsWith('dcc_')) return 2;
    return 3;
  };

  const naturalKey = (str) => {
    // Split into sequences of digits and non-digits for natural sorting
    return String(str).split(/(\d+)/).map((s) => (s.match(/^\d+$/) ? parseInt(s, 10) : s));
  };

  const parseLeg = (leg) => {
    const parts = String(leg).split('_');
    const tail = parts.pop() || '';
    const middle = parts.join('_'); // e.g., mwcu_b10, mwcu_a7, dcc_21a
    const tailMatch = tail.match(/^([0-9]+)([a-zA-Z]*)$/);
    const tailNum = tailMatch ? parseInt(tailMatch[1], 10) : Number.MAX_SAFE_INTEGER;
    const tailSuffix = tailMatch ? (tailMatch[2] || '') : tail;
    return {
      priority: getGroupPriority(leg),
      middle,
      middleKey: naturalKey(middle),
      tailNum,
      tailSuffix
    };
  };

  const legs = [...new Set(processed.map((d) => d.leg))].sort((a, b) => {
    const A = parseLeg(a);
    const B = parseLeg(b);
    if (A.priority !== B.priority) return A.priority - B.priority;
    // Within dcc_ (or any same middle root), sort by middle naturally (so dcc_21a < dcc_21b < dcc_30, etc.)
    for (let i = 0; i < Math.max(A.middleKey.length, B.middleKey.length); i++) {
      const x = A.middleKey[i];
      const y = B.middleKey[i];
      if (x === undefined) break;
      if (y === undefined) break;
      if (x === y) continue;
      if (typeof x === 'number' && typeof y === 'number') return x - y;
      return String(x).localeCompare(String(y));
    }
    // Then sort by trailing numeric index
    if (A.tailNum !== B.tailNum) return A.tailNum - B.tailNum;
    // Then by suffix where '' < 'a' < 'b' < ...
    if (A.tailSuffix === B.tailSuffix) return 0;
    if (A.tailSuffix === '') return -1;
    if (B.tailSuffix === '') return 1;
    return A.tailSuffix.localeCompare(B.tailSuffix);
  });
  const yScale = d3.scaleBand().domain(legs).range([0, height]).padding(0.2);

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

  const gridMinorG = g.append('g')
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

  const axisMajorG = g.append('g')
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
  const yearMarks = [];
  for (let year = startYear; year <= endYear; year++) {
    const yearStart = new Date(year, 0, 1); // January 1st of the year
    if (yearStart >= minStart && yearStart <= maxEnd) {
      yearMarks.push({ year, date: yearStart });
    }
  }
  const yearsG = content.append('g').attr('class', 'year-marks');
  const yearLines = yearsG.selectAll('g.year')
    .data(yearMarks)
    .enter()
    .append('g')
    .attr('class', 'year');
  yearLines.append('line')
    .attr('y1', 0)
    .attr('y2', height)
    .attr('stroke', '#000000')
    .attr('stroke-width', 3)
    .attr('opacity', 0.8)
    .attr('x1', d => xScale(d.date))
    .attr('x2', d => xScale(d.date));
  yearLines.append('text')
    .attr('y', 15)
    .attr('fill', '#000000')
    .attr('font-weight', 'bold')
    .attr('font-size', '14px')
    .attr('x', d => xScale(d.date) + 5)
    .text(d => String(d.year));

  g.append('g').call(d3.axisLeft(yScale)).selectAll('text').style('font-size', Math.max(8, Math.min(13, width / 90)) + 'px').style('font-weight', 'normal');

  const now = new Date();
  if (now >= minStart && now <= maxEnd) {
    const xNow = xScale(now);
    var todayLine = content.append('line').attr('class', 'today-line').attr('x1', xNow).attr('x2', xNow).attr('y1', 0).attr('y2', height).attr('stroke', '#ff0000').attr('stroke-width', 2).attr('stroke-dasharray', '5,5').attr('opacity', 0.8);
    var todayText = content.append('text').attr('class', 'today-text').attr('x', xNow + 6).attr('y', -10).attr('fill', '#ff0000').attr('font-weight', 'bold').attr('font-size', '12px').text('Today');
  }

  const equipValues = [...new Set(processed.map((d) => d.equipment))].filter(Boolean);
  const equipColor = d3.scaleOrdinal(d3.schemeTableau10).domain(equipValues);

  content.selectAll('rect.bar')
    .data(processed)
    .enter()
    .append('rect')
    .attr('class', 'bar')
    .attr('x', (d) => xScale(d.start))
    .attr('y', (d) => yScale(d.leg) + yScale.bandwidth() * 0.2)
    .attr('width', (d) => Math.max(1, xScale(d.end) - xScale(d.start)))
    .attr('height', () => yScale.bandwidth() * 0.6)
    .attr('fill', '#e0e0e0')
    .attr('stroke', (d) => d.equipment ? equipColor(d.equipment) : '#999')
    .attr('stroke-width', 2)
    .append('title')
    .text((d) => `${d.test}\nLeg: ${d.leg}\nDuration: ${d.duration.toFixed(1)} weeks\nEquipment: ${d.equipment || 'any'}\nFTE: ${d.fte || 'any'}`);

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

  const labels = content.append('g').attr('class', 'task-labels').selectAll('.task-label-group').data(labelData).enter().append('g').attr('class', 'task-label-group').attr('transform', (d) => `translate(${d.x}, ${d.y})`);
  labels.append('line').attr('x1', 0).attr('y1', (d) => d.height / 2).attr('x2', (d) => d.initialX - d.x).attr('y2', (d) => d.barTopY - d.y).attr('stroke', '#555').attr('stroke-width', 1);
  labels.append('rect').attr('x', (d) => -d.width / 2 - 3).attr('y', -2).attr('width', (d) => d.width + 6).attr('height', (d) => d.height + 4).attr('rx', 4).attr('ry', 4).attr('fill', '#f9f9f9').attr('stroke', '#999');
  labels.append('text').attr('text-anchor', 'middle').attr('dy', '0.7em').style('font-size', '9px').style('font-weight', 'bold').style('fill', '#000').text((d) => d.text);

  // Add leg end date labels
  const legEndDates = Array.from(d3.group(processed, d => d.leg), ([leg, values]) => ({
    leg: leg,
    finalEnd: d3.max(values, d => d.end)
  }));

  const endLabels = content.selectAll(".end-label")
    .data(legEndDates)
    .enter()
    .append("text")
    .attr("class", "end-label")
    .attr("x", d => xScale(d.finalEnd) + 8)
    .attr("y", d => yScale(d.leg) + yScale.bandwidth() / 2)
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
    // Update axes
    const newGridMinor = d3.axisBottom(zx).ticks(d3.timeWeek.every(1)).tickSize(-height).tickFormat('');
    g.select('.grid-minor').call(newGridMinor).selectAll('line').style('stroke', '#e8e8e8').style('stroke-width', 0.5).style('opacity', 0.6);
    const newAxisMajor = d3.axisBottom(zx).ticks(d3.timeWeek.every(4)).tickFormat(d => {
      const year = d3.timeFormat('%Y')(d);
      const weekNum = d3.timeFormat('%U')(d);
      const week = String(parseInt(weekNum) + 1).padStart(2, '0');
      return `${year}-W${week}`;
    });
    g.select('.axis-major').call(newAxisMajor).selectAll('text').style('font-size', Math.max(9, Math.min(12, width / 120)) + 'px').style('fill', '#333').style('font-weight', 'bold');

    // Update bars
    content.selectAll('rect.bar')
      .attr('x', d => zx(d.start))
      .attr('width', d => Math.max(1, zx(d.end) - zx(d.start)));

    // Update labels (position at mid-point; keep simple vertical leader)
    labels.attr('transform', (d) => `translate(${zx(new Date((d.start.getTime() + d.end.getTime()) / 2))}, ${d.y})`);
    labels.select('line')
      .attr('x1', 0)
      .attr('x2', 0); // vertical pointer for simplicity on zoom

    // Update end labels
    content.selectAll('text.end-label')
      .attr('x', d => zx(d.finalEnd) + 8);

    // Update year markers
    yearsG.selectAll('g.year line')
      .attr('x1', d => zx(d.date))
      .attr('x2', d => zx(d.date));
    yearsG.selectAll('g.year text')
      .attr('x', d => zx(d.date) + 5);

    // Update today line
    if (todayLine) {
      const xNowZ = zx(now);
      todayLine.attr('x1', xNowZ).attr('x2', xNowZ);
      if (todayText) todayText.attr('x', xNowZ + 6);
    }
  };

  const zoom = d3.zoom()
    .scaleExtent([0.5, 24])
    .translateExtent([[0, 0], [width, height]])
    .extent([[0, 0], [width, height]])
    .on('zoom', zoomed);

  svg.call(zoom);

  // Title & axis labels
  // Define a default project name since selectedProject is not defined
  const projectName = 'All Projects';
  const titleInput = document.getElementById('title-input');
  const chartTitle = titleInput ? titleInput.value.trim() || 'Project Timeline' : 'Project Timeline';

  svg.append("text")
      .attr("x", availableWidth / 2)
      .attr("y", 30)
      .attr("text-anchor", "middle")
      .style("font-size", width > 1000 ? "18px" : "14px")
      .style("font-weight", "bold")
      .text(`${chartTitle}: ${projectName}`);
  svg.append('text').attr('transform', 'rotate(-90)').attr('y', 16).attr('x', 0 - availableHeight / 2).attr('dy', '1em').style('text-anchor', 'middle').style('font-size', Math.max(10, Math.min(16, width / 75)) + 'px').text('Project Legs');
  svg.append('text').attr('transform', `translate(${availableWidth / 2}, ${availableHeight - 15})`).style('text-anchor', 'middle').style('font-size', Math.max(10, Math.min(16, width / 75)) + 'px').text('Week');
}

