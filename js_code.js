// Enhanced Responsive Gantt Chart with Repelling Labels
d3.select("#plot").selectAll("*").remove();
        
// Get container dimensions for responsive sizing
const container = document.getElementById('plot');
const containerRect = container.getBoundingClientRect();
const availableWidth = Math.max(800, containerRect.width - 20);
const availableHeight = Math.max(400, containerRect.height - 20);

// Set responsive dimensions and margins
const margin = {top: 80, right: 150, bottom: 80, left: 150};
const width = availableWidth - margin.left - margin.right;
const height = availableHeight - margin.top - margin.bottom;

// Create SVG
const svg = d3.select("#plot")
    .append("svg")
    .attr("width", availableWidth)
    .attr("height", availableHeight)
    .style("max-width", "100%")
    .style("height", "auto");

const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

if (data && data.length > 0) {
    const projectSelector = document.getElementById('projectSelector');
    const selectedProject = projectSelector ? projectSelector.value : 'all';

    let projectData = data;
    if (selectedProject && selectedProject !== 'all') {
        projectData = data.filter(d => {
            const projectKey = `${d.client || 'Unknown'}_${d.project || 'Unknown'}`;
            return projectKey === selectedProject;
        });
    }

    if (projectData.length === 0) {
        svg.append("text")
            .attr("x", availableWidth / 2)
            .attr("y", availableHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-size", "18px")
            .style("fill", "#666")
            .text("No data available for selected project");
    } else {
        let processedData = projectData
            .filter(d => d.test !== undefined && d.test !== null && d.test.toLowerCase() !== 'empty')
            .map(d => ({
                ...d,
                start: +d.start,
                end: +d.end,
                done_end: +d.done_end,
                completion: +d.completion,
                duration: +d.duration,
                duts: d.duts,
                alt: +d.alt,
                test_short: (d.test && d.test.trim()) ? d.test.substring(0, 5).replace(/[-\s]/g, '') : 'Task'
            }));

        const legs = [...new Set(processedData.map(d => d.leg))];
        const dutValues = [...new Set(processedData.map(d => d.duts))].sort();

        const xScale = d3.scaleLinear()
            .domain([0, d3.max(processedData, d => d.end) + 10])
            .range([0, width]);

        const yScale = d3.scaleBand()
            .domain(legs)
            .range([0, height])
            .padding(0.1);

        const colorScale = d3.scaleSequential(d3.interpolateRdYlGn)
            .domain([0, 100]);

        const dutColorScale = d3.scaleOrdinal(d3.schemeCategory10)
            .domain(dutValues);

        const tickCount = Math.floor(width / 50);
        const xAxis = d3.axisBottom(xScale)
            .tickFormat(d => {
                const year = d <= 52 ? 2025 : 2026;
                const week = d <= 52 ? d : d - 52;
                return `${year}-W${week.toString().padStart(2, '0')}`;
            })
            .ticks(tickCount);

        const xGridMajor = d3.axisBottom(xScale)
            .tickFormat("")
            .ticks(tickCount)
            .tickSize(-height);
            // Define minor grid lines for every single week
const xGridMinor = d3.axisBottom(xScale)
.tickValues(d3.range(Math.floor(xScale.domain()[0]), Math.ceil(xScale.domain()[1]), 1))
.tickFormat("")
.tickSize(-height);

// Append the minor grid
g.append("g")
.attr("class", "grid-minor")
.attr("transform", `translate(0,${height})`)
.call(xGridMinor)
.selectAll("line")
.style("stroke", "#f0f0f0") // Use a very light color
.style("stroke-width", 0.5); // Make lines very thin

        g.append("g")
            .attr("class", "grid-major")
            .attr("transform", `translate(0,${height})`)
            .call(xGridMajor)
            .selectAll("line")
            .style("stroke", "#f0f0f0")
            .style("stroke-width", 1)
            .style("opacity", 0.7);

        g.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(xAxis)
            .selectAll("text")
            .style("text-anchor", "end")
            .attr("dx", "-.8em")
            .attr("dy", ".15em")
            .attr("transform", "rotate(-45)")
            .style("font-size", width > 1000 ? "10px" : "8px")
            .style("font-weight", "bold");

        g.append("g")
            .call(d3.axisLeft(yScale))
            .selectAll("text")
            .style("font-size", width > 1000 ? "10px" : "8px");

        function getCurrentWeekNumber() {
            const today = new Date();
            const onejan = new Date(today.getFullYear(), 0, 1);
            const dayOfYear = ((today.getTime() - onejan.getTime() + 86400000) / 86400000);
            return Math.ceil((dayOfYear + onejan.getDay() + 1) / 7);
        }

        const currentWeek = getCurrentWeekNumber();
        const currentWeekX = xScale(currentWeek);

        if (currentWeek >= xScale.domain()[0] && currentWeek <= xScale.domain()[1]) {
            g.append("line")
                .attr("x1", currentWeekX)
                .attr("x2", currentWeekX)
                .attr("y1", 0)
                .attr("y2", height)
                .attr("stroke", "#ff0000")
                .attr("stroke-width", 3)
                .attr("stroke-dasharray", "5,5")
                .attr("opacity", 0.8);

            g.append("text")
                .attr("x", currentWeekX + 5)
                .attr("y", -10)
                .attr("fill", "#ff0000")
                .attr("font-weight", "bold")
                .attr("font-size", "12px")
                .text("Current Week");
        }

        // Draw bars
        processedData.forEach(d => {
            const legY = yScale(d.leg);
            const barHeight = yScale.bandwidth() * 0.2;
            const barY = legY + (yScale.bandwidth() - barHeight) / 2;

            g.append("rect")
                .attr("x", xScale(d.start))
                .attr("y", barY)
                .attr("width", xScale(d.end) - xScale(d.start))
                .attr("height", barHeight)
                .attr("fill", d.alt === 0 ? "#e0e0e0" : "#b0b0b0")
                .attr("stroke", dutColorScale(d.duts))
                .attr("stroke-width", 2)
                .append("title")
                .text(`${d.test || 'Unnamed Test'}\nDuration: ${d.duration} weeks\nCompletion: ${d.completion}%\nDUTs: ${d.duts}`);

            if (d.done_end > d.start) {
                g.append("rect")
                    .attr("x", xScale(d.start))
                    .attr("y", barY)
                    .attr("width", Math.max(0, xScale(d.done_end) - xScale(d.start)))
                    .attr("height", barHeight)
                    .attr("fill", colorScale(d.completion))
                    .attr("stroke", dutColorScale(d.duts))
                    .attr("stroke-width", 2)
                    .append("title")
                    .text(`${d.test || 'Unnamed Test'}\nDuration: ${d.duration} weeks\nCompletion: ${d.completion}%\nDUTs: ${d.duts}`);
            }
        });

        // --- LABEL REPELLING (Force Simulation) ---
        const labelData = processedData.map(d => {
            const legY = yScale(d.leg);
            const barHeight = yScale.bandwidth() * 0.2;
            const barTopY = legY + (yScale.bandwidth() - barHeight) / 2;
            const initialX = xScale(d.start) + (xScale(d.end) - xScale(d.start)) / 2;
            const initialY = barTopY - 30;

            return {
                ...d,
                x: initialX,
                y: initialY,
                fy: initialY,
                initialX,
                barTopY,
                text: d.test_short
            };
        });

        const tempSvg = d3.select("body").append("svg").attr("class", "temp-svg").style("visibility", "hidden");
        labelData.forEach(d => {
            const textNode = tempSvg.append("text")
                .style("font-size", "8px")
                .style("font-weight", "bold")
                .text(d.text);
            const bbox = textNode.node().getBBox();
            d.width = bbox.width;
            d.height = bbox.height;
        });
        tempSvg.remove();

        const simulation = d3.forceSimulation(labelData)
            .force("x", d3.forceX(d => d.initialX).strength(0.5))
            .force("collide", d3.forceCollide(d => d.width / 2 + 4).strength(1))
            .stop();

        for (let i = 0; i < 120; ++i) simulation.tick();

        const labels = g.append("g")
            .attr("class", "task-labels")
            .selectAll(".task-label-group")
            .data(labelData)
            .enter()
            .append("g")
            .attr("class", "task-label-group")
            .attr("transform", d => `translate(${d.x}, ${d.y})`);

        labels.append("line")
            .attr("x1", 0)
            .attr("y1", d => d.height / 2)
            .attr("x2", d => d.initialX - d.x)
            .attr("y2", d => d.barTopY - d.y)
            .attr("stroke", "#555")
            .attr("stroke-width", 1);

        labels.append("rect")
            .attr("x", d => -d.width / 2 - 3)
            .attr("y", -2)
            .attr("width", d => d.width + 6)
            .attr("height", d => d.height + 4)
            .attr("rx", 4)
            .attr("ry", 4)
            .attr("fill", d => d.alt === 0 ? "#e0e0e0" : "#b0b0b0") // MODIFIED LINE
            .attr("stroke", "#999");

        labels.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "0.7em")
            .style("font-size", "8px")
            .style("font-weight", "bold")
            .style("fill", "#000")
            .text(d => d.text);
        // --- START: Add this code to display the final end date for each leg ---

// 1. Create a helper function to format the week number into YYYY-Www format
function formatWeek(weekValue) {
if (weekValue === null || isNaN(weekValue)) return "";
const year = weekValue <= 52 ? 2025 : 2026;
const week = weekValue <= 52 ? weekValue : weekValue - 52;
return `W${week.toString().padStart(2, '0')}`; // Shortened format for clarity
}

// 2. Calculate the latest end date for each leg
const legEndDates = Array.from(d3.group(processedData, d => d.leg), ([leg, values]) => {
return {
leg: leg,
finalEnd: d3.max(values, d => d.end)
};
});

// 3. Append the text labels to the chart
g.selectAll(".end-label")
.data(legEndDates)
.enter()
.append("text")
.attr("class", "end-label")
// Position the label slightly to the right of the last bar in the leg
.attr("x", d => xScale(d.finalEnd) + 8) 
// Center the label vertically within the leg's band
.attr("y", d => yScale(d.leg) + yScale.bandwidth() / 2) 
.attr("text-anchor", "start") // Anchor text to the left
.attr("dominant-baseline", "central") // Vertically align the text
.style("font-size", "10px")
.style("font-weight", "bold")
.style("fill", "darkred")
.text(d => formatWeek(d.finalEnd)); // Set the text content

// --- END: End date label code ---
        // Title & axis labels
        const projectName = selectedProject && selectedProject !== 'all' ? selectedProject.replace('_', ' / ') : 'All Projects';
        svg.append("text")
            .attr("x", availableWidth / 2)
            .attr("y", 30)
            .attr("text-anchor", "middle")
            .style("font-size", width > 1000 ? "18px" : "14px")
            .style("font-weight", "bold")
            .text(`Project Timeline: ${projectName}`);

        svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 15)
            .attr("x", 0 - (availableHeight / 2))
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .style("font-size", width > 1000 ? "14px" : "12px")
            .text("Project Legs");

        svg.append("text")
            .attr("transform", `translate(${availableWidth / 2}, ${availableHeight - 20})`)
            .style("text-anchor", "middle")
            .style("font-size", width > 1000 ? "14px" : "12px")
            .text("Week Number");
    }
} else {
    svg.append("text")
        .attr("x", availableWidth / 2)
        .attr("y", availableHeight / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "18px")
        .style("fill", "#666")
        .text("No data available for visualization");
}

console.log("Enhanced Gantt chart with repelling labels completed!");