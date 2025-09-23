# D3.js Visualizations - Refactored Project Structure

This document describes the refactored structure of the D3.js interactive visualizations for the Planning Test Program.

## Project Overview

The project has been restructured to improve maintainability, modularity, and code organization. The original monolithic HTML file (1540 lines) has been split into smaller, focused modules.

## New File Structure

```
web_page/
├── css/
│   └── styles.css                 # All CSS styles
├── js/
│   ├── charts/
│   │   ├── tests-chart.js        # Tests by Leg Gantt chart
│   │   ├── equipment-chart.js    # Equipment utilization chart
│   │   ├── fte-chart.js          # FTE utilization chart
│   │   └── concurrency-chart.js  # Active tests vs capacity line chart
│   ├── utils/
│   │   ├── data-loader.js        # Data loading and management
│   │   └── download-utils.js     # Download functionality
│   └── ui/
│       └── ui-controls.js        # UI controls and event handlers
├── docs/
│   ├── README.md                 # This file
│   ├── charts-README.md          # Chart modules documentation
│   ├── utils-README.md           # Utility modules documentation
│   └── ui-README.md               # UI modules documentation
├── d3_visualizations_refactored.html  # Main HTML file (refactored)
├── d3_visualizations.html             # Original monolithic HTML file
└── js_code.js                         # Legacy JavaScript file
```

## Module Descriptions

### CSS Module (`css/styles.css`)
- **Purpose**: Contains all styling for the visualization interface
- **Features**:
  - Responsive design with mobile breakpoints
  - Modern, clean interface styling
  - Chart-specific styling (grid lines, loading states, etc.)
  - Consistent color schemes and typography

### Chart Modules (`js/charts/`)
Individual modules for each chart type:

#### Tests Chart (`tests-chart.js`)
- **Function**: `createD3GanttTests(raw)`
- **Purpose**: Creates Gantt chart showing scheduled tests organized by project leg
- **Data Source**: `output/data/tests_schedule.csv`
- **Features**:
  - Time-based x-axis (weeks)
  - Project legs on y-axis
  - Equipment color coding
  - Force-directed label positioning
  - Current date indicator

#### Equipment Chart (`equipment-chart.js`)
- **Function**: `createD3GanttEquipment(raw)`
- **Purpose**: Shows equipment usage over time with test assignments
- **Data Source**: `output/data/equipment_usage.csv`
- **Features**:
  - Equipment-specific color coding
  - Test name labels with collision avoidance
  - Duration and assignment information

#### FTE Chart (`fte-chart.js`)
- **Function**: `createD3GanttFTE(raw)`
- **Purpose**: Shows FTE resource usage over time
- **Data Source**: `output/data/fte_usage.csv`
- **Features**:
  - FTE-specific color coding
  - Interactive labels and tooltips
  - Timeline visualization

#### Concurrency Chart (`concurrency-chart.js`)
- **Function**: `createD3ConcurrencyLine(raw)`
- **Purpose**: Line chart showing active test count vs capacity over time
- **Data Source**: `output/data/concurrency_timeseries.csv`
- **Features**:
  - Dual-axis visualization
  - Step function for capacity
  - Smooth curve for active tests

### Utility Modules (`js/utils/`)

#### Data Loader (`data-loader.js`)
- **Purpose**: Handles CSV data loading, caching, and chart orchestration
- **Key Functions**:
  - `showChart(chartType, redrawOnly)` - Main chart display function
  - `loadCSVFromFolder(filename)` - Load CSV from selected folder
  - `getCachedData(chartType)` - Data caching management
  - `updateChartInfo(chartType)` - Update information display

#### Download Utils (`download-utils.js`)
- **Purpose**: Handles chart downloads as PNG and ZIP files
- **Key Functions**:
  - `downloadChartAsPNG()` - Download current chart as PNG
  - `downloadAllChartsAsZIP()` - Download all charts as ZIP
  - `sanitizeFilename(filename)` - Clean filenames for downloads

### UI Module (`js/ui/ui-controls.js`)
- **Purpose**: Manages all user interface controls and event handlers
- **Key Functions**:
  - `initUIControls()` - Initialize all UI components
  - `updateNavigationButtons(activeChartType)` - Navigation state management
  - `showLoadingState()` / `showErrorState()` - UI state management
  - `debouncedResize()` - Responsive resize handling

## Main HTML File (`d3_visualizations_refactored.html`)
- **Purpose**: Main entry point for the application
- **Features**:
  - References external CSS and JS modules
  - Clean, minimal HTML structure
  - Proper module loading order
  - Global variable initialization

## Benefits of Refactored Structure

### 1. **Modularity**
- Each module has a single responsibility
- Easy to maintain and update individual components
- Clear separation of concerns

### 2. **Maintainability**
- Smaller, focused files (no 1540-line monolith)
- Comprehensive documentation for each module
- Consistent code organization

### 3. **Reusability**
- Chart modules can be used independently
- Utility functions can be shared across components
- Clean interfaces between modules

### 4. **Testing**
- Individual modules can be tested in isolation
- Easier to mock dependencies
- Clear function boundaries

### 5. **Performance**
- Better caching of CSS and JS files
- Lazy loading potential
- Reduced initial page load size

## Usage

### Development
1. Open `d3_visualizations_refactored.html` in a web browser
2. Use browser developer tools to debug individual modules
3. Modify CSS in `css/styles.css`
4. Update chart logic in respective chart modules

### Production
1. Ensure all file paths are correct
2. Test on different browsers and screen sizes
3. Verify all external dependencies load correctly
4. Check download functionality works properly

## Migration from Original

The original `d3_visualizations.html` file is preserved for reference. To migrate:

1. **Data Loading**: Updated to use new data loader module
2. **Chart Functions**: Moved to individual chart modules
3. **UI Controls**: Centralized in UI controls module
4. **Downloads**: Enhanced with better error handling

## Dependencies

### External Libraries
- **D3.js v7**: Core visualization library
- **JSZip**: ZIP file creation for batch downloads
- **FileSaver.js**: File download functionality

### Browser Support
- Chrome 70+
- Firefox 65+
- Safari 12+
- Edge 79+

## Future Enhancements

1. **Additional Chart Types**: Easy to add new chart modules
2. **Configuration Files**: Move chart configurations to external files
3. **Testing Framework**: Add unit tests for individual modules
4. **Build Process**: Add minification and optimization
5. **Accessibility**: Enhanced ARIA support and keyboard navigation

