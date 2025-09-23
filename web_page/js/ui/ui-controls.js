/**
 * UI Controls and Event Handlers Module
 *
 * This module handles all user interface controls, navigation,
 * and event handlers for the visualization application.
 */

// Global variables for UI state management
let currentChart = 'tests';
let resizeTimeout = null;

/**
 * Initialize all UI controls and event handlers
 */
function initUIControls() {
  // Initialize navigation buttons
  initNavigationButtons();

  // Initialize folder selection
  initFolderSelection();

  // Initialize download handlers
  initDownloadHandlers();

  // Initialize window resize handler
  initResizeHandler();

  // Load initial chart
  window.addEventListener('load', function() {
    showChart('tests');
  });
}

/**
 * Initialize navigation button event handlers
 */
function initNavigationButtons() {
  // Tests button
  document.getElementById('btn-tests').addEventListener('click', function() {
    showChart('tests');
  });

  // Equipment button
  document.getElementById('btn-equipment').addEventListener('click', function() {
    showChart('equipment');
  });

  // FTE button
  document.getElementById('btn-fte').addEventListener('click', function() {
    showChart('fte');
  });

  // Concurrency button
  document.getElementById('btn-concurrency').addEventListener('click', function() {
    showChart('concurrency');
  });
}

/**
 * Initialize window resize handler
 */
function initResizeHandler() {
  window.addEventListener('resize', debouncedResize);
}

/**
 * Debounced function to handle window resize
 */
function debouncedResize() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (window.currentData && window.currentChart) {
      showChart(window.currentChart, true); // Redraw without reloading data
    }
  }, 250); // Wait 250ms after resize stops
}

/**
 * Initialize folder selection handler
 * Sets up event listener for folder input changes
 */
function initFolderSelection() {
  document.getElementById('folder-input').addEventListener('change', function(event) {
    window.selectedFiles = event.target.files;
    if (window.selectedFiles.length > 0) {
      const folderPath = window.selectedFiles[0].webkitRelativePath.split('/')[0];
      document.getElementById('folder-name').textContent = folderPath;

      // Clear current data and reload chart
      window.currentData = null;
      showChart(getCurrentChartType());
    }
  });
}

/**
 * Initialize download event handlers
 */
function initDownloadHandlers() {
  // PNG download button
  document.getElementById('download-btn').addEventListener('click', function() {
    downloadChartAsPNG();
  });

  // ZIP download button
  document.getElementById('download-all-btn').addEventListener('click', function() {
    downloadAllChartsAsZIP();
  });

  // Add keyboard support for download
  document.getElementById('filename-input').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
      downloadChartAsPNG();
    }
  });
}

/**
 * Update navigation button states
 * @param {string} activeChartType - The currently active chart type
 */
function updateNavigationButtons(activeChartType) {
  document.querySelectorAll('.nav button').forEach(btn => btn.classList.remove('active'));
  document.getElementById('btn-' + activeChartType).classList.add('active');
  currentChart = activeChartType;
}

/**
 * Update filename input based on chart type
 * @param {string} chartType - Type of chart being displayed
 */
function updateFilenameInput(chartType) {
  const filenameInput = document.getElementById('filename-input');
  const chartNames = {
    'tests': 'tests_gantt',
    'equipment': 'equipment_utilization',
    'fte': 'fte_utilization',
    'concurrency': 'active_tests_capacity'
  };
  filenameInput.value = chartNames[chartType] || 'chart';
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
 * Show loading state in the plot area
 */
function showLoadingState() {
  d3.select('#plot').html('<div class="loading">Loading visualization...</div>');
}

/**
 * Show error state in the plot area
 * @param {string} errorMessage - Error message to display
 */
function showErrorState(errorMessage) {
  d3.select('#plot').html(`<div class="error">${errorMessage}</div>`);
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
 * Get chart display name for UI
 * @param {string} chartType - Chart type identifier
 * @returns {string} Human-readable chart name
 */
function getChartDisplayName(chartType) {
  const names = {
    'tests': 'Tests by Leg',
    'equipment': 'Equipment Utilization',
    'fte': 'FTE Utilization',
    'concurrency': 'Active Tests vs Capacity'
  };
  return names[chartType] || 'Chart';
}

/**
 * Update the document title based on current chart
 * @param {string} chartType - Current chart type
 */
function updateDocumentTitle(chartType) {
  const displayName = getChartDisplayName(chartType);
  document.title = `Planning Test Program - ${displayName}`;
}

/**
 * Check if the application is ready for downloads
 * @returns {boolean} True if charts are loaded and ready for download
 */
function isReadyForDownload() {
  return window.currentData && Object.keys(window.currentData).length > 0;
}

/**
 * Update download button states based on availability
 */
function updateDownloadButtonStates() {
  const downloadBtn = document.getElementById('download-btn');
  const downloadAllBtn = document.getElementById('download-all-btn');

  const hasCharts = isReadyForDownload();

  if (downloadBtn) {
    downloadBtn.disabled = !hasCharts;
  }

  if (downloadAllBtn) {
    downloadAllBtn.disabled = !hasCharts;
  }
}

