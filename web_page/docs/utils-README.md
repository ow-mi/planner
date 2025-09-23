# Utility Modules Documentation

This document describes the utility modules that provide supporting functionality for the D3.js visualizations.

## Overview

Utility modules handle common functionality that is shared across multiple chart modules. They provide services for data management, downloads, and other supporting features.

## 1. Data Loader Module (`js/utils/data-loader.js`)

### Purpose
Manages CSV data loading, caching, and orchestrates the display of different chart types.

### Key Functions

#### `showChart(chartType, redrawOnly = false)`
Main function for displaying charts.

**Parameters**:
- `chartType` (string): Type of chart ('tests', 'equipment', 'fte', 'concurrency')
- `redrawOnly` (boolean): If true, use cached data without reloading

**Features**:
- Updates navigation buttons
- Sets appropriate filename suggestions
- Updates chart information display
- Handles data loading vs. cached data display

#### `loadCSVFromFolder(filename)`
Loads CSV data from selected folder.

**Parameters**:
- `filename` (string): Name of CSV file to load

**Returns**: Promise that resolves to parsed CSV data

**Features**:
- Searches selected files for matching filename
- Uses FileReader API for client-side file processing
- Automatic data type conversion with `d3.autoType`

#### `getCurrentChartType()`
Gets current chart type from active navigation button.

**Returns**: String representing current chart type

#### `updateChartInfo(chartType)`
Updates the chart information display based on chart type.

**Parameters**:
- `chartType` (string): Type of chart being displayed

### Data Management

#### Global Variables
- `window.currentData`: Cached data for all chart types
- `window.selectedFiles`: FileList from folder selection

#### Caching Strategy
- Data is cached by chart type to avoid redundant loading
- Cache is cleared when new folder is selected
- Individual chart data can be retrieved and updated

### Error Handling
- Graceful handling of missing files
- User-friendly error messages
- Fallback to original file loading method if folder not selected

### Integration
Works closely with:
- Chart modules for data delivery
- UI module for state management
- Download module for data availability

## 2. Download Utilities Module (`js/utils/download-utils.js`)

### Purpose
Handles downloading charts as PNG images and ZIP files with batch download functionality.

### Key Functions

#### `downloadChartAsPNG()`
Downloads current chart as PNG image.

**Features**:
- Converts SVG to canvas
- Creates blob from canvas
- Triggers file download with proper filename
- Error handling for conversion failures
- Button state management during download

**Process**:
1. Gets SVG element from DOM
2. Creates canvas with matching dimensions
3. Converts SVG to image data
4. Draws image on canvas
5. Converts canvas to PNG blob
6. Creates download link and triggers download

#### `downloadAllChartsAsZIP()`
Downloads all available charts as a ZIP file.

**Features**:
- Creates ZIP file containing all chart SVGs
- Temporary chart switching for capture
- Proper cleanup and restoration of original state
- Progress indication during ZIP creation

**Process**:
1. Checks for available chart data
2. Creates JSZip instance
3. Iterates through available chart types
4. Temporarily switches to each chart
5. Captures SVG and adds to ZIP
6. Restores original chart state
7. Generates and downloads ZIP file

#### `initDownloadHandlers()`
Initializes download event handlers.

**Features**:
- Sets up click handlers for download buttons
- Adds keyboard support (Enter key) for PNG download
- Provides centralized event management

#### Utility Functions

#### `isChartAvailable()`
Checks if a chart is currently loaded and ready for download.

**Returns**: Boolean indicating chart availability

#### `getSuggestedFilename(chartType)`
Gets suggested filename based on chart type.

**Parameters**:
- `chartType` (string): Type of chart

**Returns**: String with appropriate filename

#### `sanitizeFilename(filename)`
Removes invalid characters from filename.

**Parameters**:
- `filename` (string): Original filename

**Returns**: Sanitized filename safe for file systems

### Error Handling
- Validation of chart availability before download
- User alerts for download failures
- Proper cleanup of temporary resources
- Button state restoration after errors

### Dependencies
- **JSZip**: For ZIP file creation
- **FileSaver.js**: For file download functionality
- **XMLSerializer**: For SVG to string conversion
- **Canvas API**: For image conversion

### Integration
Works with:
- Chart modules for SVG capture
- UI module for button state management
- Data loader for chart availability checking

## Common Features

### Error Handling
Both utility modules include comprehensive error handling:
- User-friendly error messages
- Graceful degradation
- Proper resource cleanup
- State restoration after errors

### Performance
- Debounced operations where appropriate
- Efficient resource management
- Minimal DOM manipulation
- Cached data usage

### Browser Compatibility
- Uses modern browser APIs
- Proper fallbacks for older browsers
- Cross-browser file handling

## Usage Examples

### Data Loading
```javascript
// Load data from folder
loadCSVFromFolder('tests_schedule.csv')
  .then(data => {
    console.log('Data loaded:', data);
    createD3GanttTests(data);
  })
  .catch(error => {
    console.error('Loading failed:', error);
  });

// Display chart with cached data
showChart('equipment', true);

// Check available data
if (getCachedData('tests')) {
  console.log('Tests data is cached');
}
```

### Downloads
```javascript
// Download current chart
downloadChartAsPNG();

// Download all charts
downloadAllChartsAsZIP();

// Check if download is available
if (isChartAvailable()) {
  console.log('Chart ready for download');
}
```

## Troubleshooting

### Data Loading Issues
1. **File not found**: Check that file exists in selected folder
2. **Parsing errors**: Verify CSV format and column names
3. **Permission errors**: Ensure folder access permissions

### Download Issues
1. **Canvas conversion fails**: Check SVG validity and browser compatibility
2. **ZIP creation fails**: Verify JSZip and FileSaver libraries are loaded
3. **Large files**: Consider performance impact for very large datasets

### Performance Issues
1. **Slow data loading**: Consider data size and parsing complexity
2. **Memory usage**: Monitor for memory leaks in complex operations
3. **Resize handling**: Debounced resize should prevent excessive redraws

## Future Enhancements

### Data Loader
1. **Async data processing**: Streaming CSV parsing for large files
2. **Data validation**: Schema validation before processing
3. **Export functionality**: Save processed data for reuse
4. **Offline support**: Cache data for offline usage

### Download Utils
1. **Multiple formats**: SVG, PDF, and other export formats
2. **Image optimization**: Compression and quality settings
3. **Batch processing**: Progress indicators for large downloads
4. **Custom templates**: Chart styling and layout customization

