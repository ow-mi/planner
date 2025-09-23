/**
 * Chart Download Utilities Module
 *
 * This module handles downloading charts as PNG images and ZIP files.
 * Provides functionality for individual chart downloads and batch downloads.
 */

/**
 * Download current chart as PNG image
 */
function downloadChartAsPNG() {
  const filenameInput = document.getElementById('filename-input');
  const downloadBtn = document.getElementById('download-btn');
  let filename = filenameInput.value.trim() || 'chart';

  // Sanitize filename - remove invalid characters
  filename = filename.replace(/[^a-zA-Z0-9\-_\.]/g, '_');

  // Disable button during download
  downloadBtn.disabled = true;
  downloadBtn.textContent = '⏳ Downloading...';

  try {
    // Get the SVG element
    const svgElement = document.querySelector('#plot svg');
    if (!svgElement) {
      alert('No chart available to download. Please load a chart first.');
      downloadBtn.disabled = false;
      downloadBtn.innerHTML = '📥 Download PNG';
      return;
    }

    // Create a canvas element
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Get SVG dimensions
    const svgRect = svgElement.getBoundingClientRect();
    const svgWidth = svgRect.width;
    const svgHeight = svgRect.height;

    // Set canvas size to match SVG
    canvas.width = svgWidth;
    canvas.height = svgHeight;

    // Create an image from the SVG
    const svgString = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
    const svgUrl = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = function() {
      // Draw the image onto the canvas
      ctx.drawImage(img, 0, 0, svgWidth, svgHeight);

      // Convert canvas to PNG blob
      canvas.toBlob(function(blob) {
        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.png`;

        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up
        URL.revokeObjectURL(url);
        URL.revokeObjectURL(svgUrl);

        // Re-enable button
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = '📥 Download PNG';
      }, 'image/png');
    };

    img.onerror = function() {
      alert('Error converting chart to image. Please try again.');
      downloadBtn.disabled = false;
      downloadBtn.innerHTML = '📥 Download PNG';
      URL.revokeObjectURL(svgUrl);
    };

    img.src = svgUrl;

  } catch (error) {
    console.error('Download error:', error);
    alert('Error downloading chart. Please try again.');
    downloadBtn.disabled = false;
    downloadBtn.innerHTML = '📥 Download PNG';
  }
}

/**
 * Download all charts as a ZIP file
 */
function downloadAllChartsAsZIP() {
  const downloadAllBtn = document.getElementById('download-all-btn');
  const titleInput = document.getElementById('title-input');
  let baseFilename = titleInput.value.trim() || 'project_timeline';

  // Sanitize filename - remove invalid characters
  baseFilename = baseFilename.replace(/[^a-zA-Z0-9\-_\.]/g, '_');

  // Disable button during download
  downloadAllBtn.disabled = true;
  downloadAllBtn.textContent = '⏳ Creating ZIP...';

  if (!window.currentData || !Object.keys(window.currentData).length) {
    alert('No charts available to download. Please load charts first.');
    downloadAllBtn.disabled = false;
    downloadAllBtn.innerHTML = '📦 Download All Charts (ZIP)';
    return;
  }

  const zip = new JSZip();
  const chartTypes = ['tests', 'equipment', 'fte', 'concurrency'];
  const chartNames = {
    'tests': 'tests_gantt',
    'equipment': 'equipment_utilization',
    'fte': 'fte_utilization',
    'concurrency': 'active_tests_capacity'
  };

  let chartsProcessed = 0;
  const totalCharts = chartTypes.length;

  chartTypes.forEach(chartType => {
    if (window.currentData[chartType]) {
      // Save current chart type and data
      const originalChart = window.currentChartType || 'tests';
      const originalData = window.currentData;

      // Temporarily switch to this chart
      window.currentChartType = chartType;
      showChart(chartType, true);

      // Wait for chart to render
      setTimeout(() => {
        const svgElement = document.querySelector('#plot svg');
        if (svgElement) {
          const svgString = new XMLSerializer().serializeToString(svgElement);
          const filename = `${baseFilename}_${chartNames[chartType]}.svg`;
          zip.file(filename, svgString);
        }

        chartsProcessed++;

        // When all charts are processed, generate ZIP
        if (chartsProcessed === totalCharts) {
          zip.generateAsync({type: 'blob'})
            .then(function(content) {
              saveAs(content, `${baseFilename}_charts.zip`);

              // Restore original chart
              window.currentChartType = originalChart;
              window.currentData = originalData;
              showChart(originalChart, true);

              // Re-enable button
              downloadAllBtn.disabled = false;
              downloadAllBtn.innerHTML = '📦 Download All Charts (ZIP)';
            })
            .catch(error => {
              console.error('ZIP creation error:', error);
              alert('Error creating ZIP file. Please try again.');
              downloadAllBtn.disabled = false;
              downloadAllBtn.innerHTML = '📦 Download All Charts (ZIP)';
            });
        }
      }, 100);
    } else {
      chartsProcessed++;
    }
  });
}

/**
 * Initialize download event handlers
 */
function initDownloadHandlers() {
  // Add keyboard support for download
  document.getElementById('filename-input').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
      downloadChartAsPNG();
    }
  });
}

/**
 * Check if a chart is currently available for download
 * @returns {boolean} True if a chart is loaded and ready for download
 */
function isChartAvailable() {
  const svgElement = document.querySelector('#plot svg');
  return svgElement !== null;
}

/**
 * Get suggested filename based on current chart type
 * @param {string} chartType - Type of chart ('tests', 'equipment', 'fte', 'concurrency')
 * @returns {string} Suggested filename
 */
function getSuggestedFilename(chartType) {
  const chartNames = {
    'tests': 'tests_gantt',
    'equipment': 'equipment_utilization',
    'fte': 'fte_utilization',
    'concurrency': 'active_tests_capacity'
  };
  return chartNames[chartType] || 'chart';
}

/**
 * Sanitize filename by removing invalid characters
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9\-_\.]/g, '_');
}

