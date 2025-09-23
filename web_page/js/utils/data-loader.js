/**
 * Data Loading and Management Module
 *
 * This module handles loading CSV data from files, managing data caching,
 * and orchestrating the display of different chart types.
 */

// Global variables for data management
// Note: We're using window.currentData and window.selectedFiles instead of local variables
// to ensure they're accessible across all functions and event handlers

/**
 * Initialize folder selection handler
 * Sets up event listener for folder input changes
 */
function initFolderSelection() {
  console.log('Initializing folder selection handler');
  
  document.getElementById('folder-input').addEventListener('change', function(event) {
    console.log('Folder selection changed');
    // Always set the global window.selectedFiles variable
    window.selectedFiles = event.target.files;
    
    if (!window.selectedFiles || window.selectedFiles.length === 0) {
      console.error('No files selected');
      return;
    }
    
    console.log('Files selected:', window.selectedFiles.length);
    const folderPath = window.selectedFiles[0].webkitRelativePath.split('/')[0];
    document.getElementById('folder-name').textContent = folderPath;
    console.log('Selected folder path:', folderPath);

    // Check if output/data directory exists
    let hasOutputData = false;
    let dataFiles = [];
    
    for (let i = 0; i < window.selectedFiles.length; i++) {
      const path = window.selectedFiles[i].webkitRelativePath;
      if (path.includes('output/data/')) {
        hasOutputData = true;
        dataFiles.push(path);
      }
    }
    
    console.log('Has output/data directory:', hasOutputData);
    if (dataFiles.length > 0) {
      console.log('Found data files:', dataFiles.slice(0, 5)); // Log first 5 files
    }

    if (!hasOutputData) {
      console.error('No output/data directory found');
      d3.select('#plot').html('<div class="error">Selected folder does not contain an output/data directory. Please select a folder containing output/data/.</div>');
      return;
    }
    
    // Clear current data and reload chart
    console.log('Clearing cached data and showing chart');
    window.currentData = null;
    showChart(getCurrentChartType());
    
    // Log the global variable state
    console.log('Global state after folder selection:');
    console.log('- window.selectedFiles:', window.selectedFiles ? window.selectedFiles.length + ' files' : 'null');
    console.log('- window.currentData:', window.currentData);
  });
}

/**
 * Load CSV data from selected folder
 * @param {string} filename - Name of the CSV file to load
 * @returns {Promise} Promise that resolves to parsed CSV data
 */
function loadCSVFromFolder(filename) {
  return new Promise((resolve, reject) => {
    // Always use the global window.selectedFiles variable
    if (!window.selectedFiles) {
      reject('No folder selected');
      return;
    }

    console.log('Looking for file:', filename);
    console.log('Selected files count:', window.selectedFiles.length);

    // Find the requested file in the output/data subdirectory
    let file = null;
    const targetPath = 'output/data/' + filename;
    
    for (let i = 0; i < window.selectedFiles.length; i++) {
      const filePath = window.selectedFiles[i].webkitRelativePath;
      console.log('Checking file:', filePath);
      
      if (filePath.endsWith(targetPath)) {
        file = window.selectedFiles[i];
        console.log('Found matching file:', filePath);
        break;
      }
    }

    if (!file) {
      reject(`File ${filename} not found in output/data directory. Please select a folder containing the output/data subdirectory.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      console.log('File loaded, parsing CSV data...');
      const text = e.target.result;
      try {
        let data = d3.csvParse(text, d3.autoType);

        // Special handling for tests_schedule.csv with separate date/time columns
        if (filename === 'tests_schedule.csv' && data[0]?.start_date && data[0]?.start_time) {
          data = data.map(row => {
            if (row.start_date && row.start_time) {
              row.start = new Date(`${row.start_date}T${row.start_time}`);
            }
            if (row.end_date && row.end_time) {
              row.end = new Date(`${row.end_date}T${row.end_time}`);
            }
            return row;
          });
        }

        resolve(data);
      } catch (error) {
        console.error('Error parsing CSV:', error);
        reject('Error parsing CSV data: ' + error.message);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

/**
 * Get current chart type from active navigation button
 * @returns {string} Current chart type ('tests', 'equipment', 'fte', 'concurrency')
 */
function getCurrentChartType() {
  const activeBtn = document.querySelector('.nav button.active');
  return activeBtn ? activeBtn.id.replace('btn-', '') : 'tests';
}

/**
 * Show the specified chart type
 * @param {string} chartType - Type of chart to display
 * @param {boolean} redrawOnly - If true, use cached data without reloading
 */
function showChart(chartType, redrawOnly = false) {
  console.log('Showing chart:', chartType, 'redrawOnly:', redrawOnly);
  console.log('Global state at showChart start:');
  console.log('- window.selectedFiles:', window.selectedFiles ? window.selectedFiles.length + ' files' : 'null');
  console.log('- window.currentData:', window.currentData);
  
  // Update navigation buttons
  document.querySelectorAll('.nav button').forEach(btn => btn.classList.remove('active'));
  document.getElementById('btn-' + chartType).classList.add('active');

  // Update filename suggestion based on chart type
  const filenameInput = document.getElementById('filename-input');
  const chartNames = {
    'tests': 'tests_gantt',
    'equipment': 'equipment_utilization',
    'fte': 'fte_utilization',
    'concurrency': 'active_tests_capacity'
  };
  filenameInput.value = chartNames[chartType] || 'chart';

  // Update chart info
  updateChartInfo(chartType);

  // If we're just redrawing and have data, use cached data
  if (redrawOnly && window.currentData && window.currentData[chartType]) {
    const createFunctions = {
      'tests': createD3GanttTests,
      'equipment': createD3GanttEquipment,
      'fte': createD3GanttFTE,
      'concurrency': createD3ConcurrencyLine
    };
    createFunctions[chartType](window.currentData[chartType]);
    return;
  }

  // Show loading state
  d3.select('#plot').html('<div class="loading">Loading visualization...</div>');

  // Define data files
  const dataFiles = {
    'tests': 'tests_schedule.csv',
    'equipment': 'equipment_usage.csv',
    'fte': 'fte_usage.csv',
    'concurrency': 'concurrency_timeseries.csv'
  };

  const createFunctions = {
    'tests': function(data) {
      console.log('Calling createD3GanttTests with data:', data.length, 'rows');
      try {
        createD3GanttTests(data);
        console.log('createD3GanttTests completed successfully');
      } catch (error) {
        console.error('Error in createD3GanttTests:', error);
        d3.select('#plot').html(`<div class="error">Error creating tests chart: ${error.message}</div>`);
      }
    },
    'equipment': function(data) {
      console.log('Calling createD3GanttEquipment with data:', data.length, 'rows');
      try {
        createD3GanttEquipment(data);
        console.log('createD3GanttEquipment completed successfully');
      } catch (error) {
        console.error('Error in createD3GanttEquipment:', error);
        d3.select('#plot').html(`<div class="error">Error creating equipment chart: ${error.message}</div>`);
      }
    },
    'fte': function(data) {
      console.log('Calling createD3GanttFTE with data:', data.length, 'rows');
      try {
        createD3GanttFTE(data);
        console.log('createD3GanttFTE completed successfully');
      } catch (error) {
        console.error('Error in createD3GanttFTE:', error);
        d3.select('#plot').html(`<div class="error">Error creating FTE chart: ${error.message}</div>`);
      }
    },
    'concurrency': function(data) {
      console.log('Calling createD3ConcurrencyLine with data:', data.length, 'rows');
      try {
        createD3ConcurrencyLine(data);
        console.log('createD3ConcurrencyLine completed successfully');
      } catch (error) {
        console.error('Error in createD3ConcurrencyLine:', error);
        d3.select('#plot').html(`<div class="error">Error creating concurrency chart: ${error.message}</div>`);
      }
    }
  };

  // Require folder selection
  if (!window.selectedFiles) {
    console.error('No files selected (window.selectedFiles is null)');
    d3.select('#plot').html('<div class="error">Please select a data folder using the "Choose Folder" button above.</div>');
    return;
  }

  loadCSVFromFolder(dataFiles[chartType])
    .then(data => {
      if (!window.currentData) window.currentData = {};
      window.currentData[chartType] = data;
      createFunctions[chartType](data);
    })
    .catch(error => {
      console.error('Error loading data:', error);
      d3.select('#plot').html(`<div class="error">${error}</div>`);
    });
}

/**
 * Update chart information display
 * @param {string} chartType - Type of chart being displayed
 */
function updateChartInfo(chartType) {
  const infoDiv = document.getElementById('chart-info');
  switch(chartType) {
    case 'tests':
      infoDiv.innerHTML = '<p><strong>Tests by Leg:</strong> Gantt chart showing scheduled tests organized by project leg with timeline view (weeks).</p>';
      break;
    case 'equipment':
      infoDiv.innerHTML = '<p><strong>Equipment Utilization:</strong> Gantt chart showing equipment usage over time with test assignments (weeks).</p>';
      break;
    case 'fte':
      infoDiv.innerHTML = '<p><strong>FTE Utilization:</strong> Gantt chart showing FTE (Full-Time Equivalent) resource usage over time (weeks).</p>';
      break;
    case 'concurrency':
      infoDiv.innerHTML = '<p><strong>Active Tests vs Capacity:</strong> Line chart showing active test count compared to available capacity over time (weeks).</p>';
      break;
  }
}

/**
 * Get cached data for a specific chart type
 * @param {string} chartType - Type of chart
 * @returns {Array|null} Cached data or null if not available
 */
function getCachedData(chartType) {
  return currentData && currentData[chartType] ? currentData[chartType] : null;
}

/**
 * Set cached data for a specific chart type
 * @param {string} chartType - Type of chart
 * @param {Array} data - Data to cache
 */
function setCachedData(chartType, data) {
  if (!currentData) currentData = {};
  currentData[chartType] = data;
}

/**
 * Clear all cached data
 */
function clearCachedData() {
  currentData = null;
}

/**
 * Check if data is cached for a specific chart type
 * @param {string} chartType - Type of chart
 * @returns {boolean} True if data is cached
 */
function hasCachedData(chartType) {
  return currentData && currentData[chartType] !== undefined;
}

/**
 * Test function to verify file access
 * Attempts to directly access CSV files and display results
 */
function testFileAccess() {
  console.log('Testing file access...');
  
  // Use window.selectedFiles to ensure we're using the globally shared variable
  const files = window.selectedFiles || selectedFiles;
  
  if (!files || files.length === 0) {
    alert('Please select a folder first');
    return;
  }
  
  console.log('Using files collection with', files.length, 'files');
  
  // Display test in progress
  d3.select('#plot').html('<div class="loading">Testing file access, please check console for details...</div>');
  
  // Try to find the required CSV files
  const requiredFiles = [
    'tests_schedule.csv',
    'equipment_usage.csv',
    'fte_usage.csv',
    'concurrency_timeseries.csv'
  ];
  
  const results = {
    totalFiles: files.length,
    foundFiles: [],
    missingFiles: []
  };
  
  // Check for each required file
  requiredFiles.forEach(filename => {
    const targetPath = 'output/data/' + filename;
    let found = false;
    
    for (let i = 0; i < files.length; i++) {
      const filePath = files[i].webkitRelativePath;
      console.log('Checking:', filePath, 'against target:', targetPath);
      
      if (filePath.endsWith(targetPath)) {
        found = true;
        results.foundFiles.push({
          name: filename,
          path: filePath
        });
        
        // Try to read the file
        const reader = new FileReader();
        reader.onload = function(e) {
          console.log(`Successfully read ${filename}:`, e.target.result.substring(0, 100) + '...');
        };
        reader.onerror = function(e) {
          console.error(`Error reading ${filename}:`, e);
        };
        reader.readAsText(files[i]);
        
        break;
      }
    }
    
    if (!found) {
      results.missingFiles.push(filename);
    }
  });
  
  // Log and display results
  console.log('File access test results:', results);
  
  // Display results in the plot area
  let html = '<div class="test-results">';
  html += '<h3>File Access Test Results</h3>';
  
  if (results.foundFiles.length > 0) {
    html += '<h4>Found Files:</h4>';
    html += '<ul>';
    results.foundFiles.forEach(file => {
      html += `<li>${file.name} (${file.path})</li>`;
    });
    html += '</ul>';
  }
  
  if (results.missingFiles.length > 0) {
    html += '<h4>Missing Files:</h4>';
    html += '<ul class="missing-files">';
    results.missingFiles.forEach(file => {
      html += `<li>${file}</li>`;
    });
    html += '</ul>';
    html += '<p>Please make sure you select a folder containing the output/data directory with these files.</p>';
  }
  
  html += '</div>';
  d3.select('#plot').html(html);
}

/**
 * Force load a specific CSV file
 * Attempts to directly load and display a CSV file
 */
function loadSpecificFile() {
  console.log('Attempting to force load CSV file...');
  
  // Use window.selectedFiles to ensure we're using the globally shared variable
  const files = window.selectedFiles || selectedFiles;
  
  if (!files || files.length === 0) {
    alert('Please select a folder first');
    return;
  }
  
  // Display loading state
  d3.select('#plot').html('<div class="loading">Attempting to load CSV file directly...</div>');
  
  // Try to find tests_schedule.csv first
  const targetFiles = [
    'tests_schedule.csv',
    'equipment_usage.csv',
    'fte_usage.csv',
    'concurrency_timeseries.csv'
  ];
  
  let foundFile = null;
  let foundFilePath = '';
  
  // First try to find in output/data directory
  for (const filename of targetFiles) {
    const targetPath = 'output/data/' + filename;
    
    for (let i = 0; i < files.length; i++) {
      const filePath = files[i].webkitRelativePath;
      if (filePath.endsWith(targetPath)) {
        foundFile = files[i];
        foundFilePath = filePath;
        break;
      }
    }
    
    if (foundFile) break;
  }
  
  // If not found in output/data, try to find any CSV
  if (!foundFile) {
    for (let i = 0; i < files.length; i++) {
      if (files[i].name.endsWith('.csv')) {
        foundFile = files[i];
        foundFilePath = files[i].webkitRelativePath;
        break;
      }
    }
  }
  
  if (!foundFile) {
    d3.select('#plot').html('<div class="error">Could not find any CSV files in the selected folder.</div>');
    return;
  }
  
  console.log('Found file to load:', foundFilePath);
  
  // Try to read and display the file
  const reader = new FileReader();
  
  reader.onload = function(e) {
    const text = e.target.result;
    console.log('File loaded, content length:', text.length);
    
    try {
      // Try to parse as CSV
      const data = d3.csvParse(text, d3.autoType);
      console.log('CSV parsed successfully:', data.length, 'rows');
      
      // Display the data as a simple table
      let html = '<div class="csv-preview">';
      html += `<h3>CSV Preview: ${foundFilePath}</h3>`;
      
      if (data.length > 0) {
        // Get columns from first row
        const columns = Object.keys(data[0]);
        
        html += '<table border="1">';
        
        // Header row
        html += '<tr>';
        columns.forEach(col => {
          html += `<th>${col}</th>`;
        });
        html += '</tr>';
        
        // Data rows (max 10)
        const maxRows = Math.min(10, data.length);
        for (let i = 0; i < maxRows; i++) {
          html += '<tr>';
          columns.forEach(col => {
            html += `<td>${data[i][col]}</td>`;
          });
          html += '</tr>';
        }
        
        html += '</table>';
        
        if (data.length > maxRows) {
          html += `<p>Showing ${maxRows} of ${data.length} rows</p>`;
        }
      } else {
        html += '<p>CSV file is empty</p>';
      }
      
      html += '</div>';
      d3.select('#plot').html(html);
      
    } catch (error) {
      console.error('Error parsing CSV:', error);
      d3.select('#plot').html(`<div class="error">Error parsing CSV file: ${error.message}</div>`);
    }
  };
  
  reader.onerror = function(e) {
    console.error('Error reading file:', e);
    d3.select('#plot').html('<div class="error">Error reading file.</div>');
  };
  
  reader.readAsText(foundFile);
}

/**
 * Test chart creation with sample data
 * Creates a simple chart to verify D3 is working
 */
function testChartCreation() {
  console.log('Testing chart creation with sample data');
  
  // Display loading state
  d3.select('#plot').html('<div class="loading">Creating test chart...</div>');
  
  try {
    // Create a simple bar chart with D3
    const sampleData = [
      { name: 'Test 1', value: 10 },
      { name: 'Test 2', value: 20 },
      { name: 'Test 3', value: 15 },
      { name: 'Test 4', value: 25 },
      { name: 'Test 5', value: 18 }
    ];
    
    const container = document.getElementById('plot');
    const rect = container.getBoundingClientRect();
    
    const width = rect.width - 40;
    const height = rect.height - 40;
    const margin = { top: 30, right: 30, bottom: 40, left: 50 };
    
    const svg = d3.select('#plot')
      .html('') // Clear previous content
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .style('background', '#f9f9f9')
      .style('border', '1px solid #ddd');
    
    const chart = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // X scale
    const x = d3.scaleBand()
      .domain(sampleData.map(d => d.name))
      .range([0, width - margin.left - margin.right])
      .padding(0.2);
    
    // Y scale
    const y = d3.scaleLinear()
      .domain([0, d3.max(sampleData, d => d.value) * 1.2])
      .range([height - margin.top - margin.bottom, 0]);
    
    // Add X axis
    chart.append('g')
      .attr('transform', `translate(0,${height - margin.top - margin.bottom})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .style('font-size', '12px');
    
    // Add Y axis
    chart.append('g')
      .call(d3.axisLeft(y))
      .selectAll('text')
      .style('font-size', '12px');
    
    // Add bars
    chart.selectAll('rect')
      .data(sampleData)
      .enter()
      .append('rect')
      .attr('x', d => x(d.name))
      .attr('y', d => y(d.value))
      .attr('width', x.bandwidth())
      .attr('height', d => height - margin.top - margin.bottom - y(d.value))
      .attr('fill', '#3498db')
      .attr('stroke', '#2980b9')
      .attr('stroke-width', 1);
    
    // Add title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 15)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      .text('Test Chart - D3.js Working Correctly');
    
    console.log('Test chart created successfully');
  } catch (error) {
    console.error('Error creating test chart:', error);
    d3.select('#plot').html(`<div class="error">Error creating test chart: ${error.message}</div>`);
  }
}

/**
 * Initialize charts with direct access to global variables
 * This function directly accesses the global variables and forces chart creation
 */
function initializeCharts() {
  console.log('Manually initializing charts');
  console.log('Global state at initialization:');
  console.log('- window.selectedFiles:', window.selectedFiles ? window.selectedFiles.length + ' files' : 'null');
  console.log('- window.currentData:', window.currentData);
  
  if (!window.selectedFiles) {
    alert('Please select a folder first');
    return;
  }
  
  // Display initialization message
  d3.select('#plot').html('<div class="loading">Initializing charts...</div>');
  
  // Define data files
  const dataFiles = {
    'tests': 'tests_schedule.csv',
    'equipment': 'equipment_usage.csv',
    'fte': 'fte_usage.csv',
    'concurrency': 'concurrency_timeseries.csv'
  };
  
  // Get current chart type
  const chartType = getCurrentChartType();
  console.log('Current chart type:', chartType);
  
  // Directly load the CSV file
  const filename = dataFiles[chartType];
  console.log('Loading file:', filename);
  
  // Find the file in the selected files
  let file = null;
  const targetPath = 'output/data/' + filename;
  
  for (let i = 0; i < window.selectedFiles.length; i++) {
    const filePath = window.selectedFiles[i].webkitRelativePath;
    if (filePath.endsWith(targetPath)) {
      file = window.selectedFiles[i];
      console.log('Found matching file:', filePath);
      break;
    }
  }
  
  if (!file) {
    d3.select('#plot').html(`<div class="error">File ${filename} not found in output/data directory.</div>`);
    return;
  }
  
  // Read the file directly
  const reader = new FileReader();
  
  reader.onload = function(e) {
    console.log('File loaded, parsing CSV data...');
    const text = e.target.result;
    
    try {
      const data = d3.csvParse(text, d3.autoType);
      console.log('CSV parsed successfully:', data.length, 'rows');
      
      // Cache the data
      if (!window.currentData) window.currentData = {};
      window.currentData[chartType] = data;
      
      // Create the chart
      console.log('Creating chart:', chartType);
      
      switch(chartType) {
        case 'tests':
          createD3GanttTests(data);
          break;
        case 'equipment':
          createD3GanttEquipment(data);
          break;
        case 'fte':
          createD3GanttFTE(data);
          break;
        case 'concurrency':
          createD3ConcurrencyLine(data);
          break;
        default:
          d3.select('#plot').html(`<div class="error">Unknown chart type: ${chartType}</div>`);
      }
      
      console.log('Chart creation completed');
      
    } catch (error) {
      console.error('Error creating chart:', error);
      d3.select('#plot').html(`<div class="error">Error creating chart: ${error.message}</div>`);
    }
  };
  
  reader.onerror = function(e) {
    console.error('Error reading file:', e);
    d3.select('#plot').html('<div class="error">Error reading file.</div>');
  };
  
  reader.readAsText(file);
}

