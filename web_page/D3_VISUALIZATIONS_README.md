# D3.js Visualizations for Planning Test Program

This document describes the D3.js interactive visualizations created for the Planning Test Program, including both the original monolithic version and the new refactored modular structure.

## Overview

The D3 visualizations provide interactive, web-based alternatives to the matplotlib plots, offering:

- **Interactive charts** with hover tooltips and responsive design
- **Multiple chart types** accessible through a tabbed interface
- **Modern web interface** that works in any modern browser
- **Responsive design** that adapts to different screen sizes
- **Modular architecture** for better maintainability and extensibility

## Project Structure

### Original Version (Monolithic)
- **File**: `d3_visualizations.html` (1540 lines)
- **Structure**: All code embedded in single HTML file
- **Use Case**: Quick deployment, simple maintenance

### Refactored Version (Modular)
- **Main File**: `d3_visualizations_refactored.html`
- **Structure**: Organized into separate modules for maintainability
- **Use Case**: Long-term development, team collaboration, extensibility

## Available Visualizations

### 1. Tests by Leg (Gantt Chart)
- **Data Source**: `output/data/tests_schedule.csv`
- **Description**: Shows scheduled tests organized by project leg with timeline view
- **Expected Columns**: `test_id`, `project_leg_id`, `test_name`, `start_date`/`start_time` or `start`, `end_date`/`end_time` or `end`, `assigned_equipment`, `assigned_fte`
- **Features**:
  - Color-coded equipment assignments
  - Interactive tooltips with test details
  - Repelling labels to avoid overlap
  - Current date indicator

### 2. Equipment Utilization (Gantt Chart)
- **Data Source**: `output/data/equipment_usage.csv`
- **Description**: Shows equipment usage over time with test assignments
- **Expected Columns**: `equipment_id`, `test_id`, `test_name`, `start`/`end` (combined datetime format)
- **Features**:
  - Equipment-specific color coding
  - Test name labels with collision avoidance
  - Duration and assignment information in tooltips

### 3. FTE Utilization (Gantt Chart)
- **Data Source**: `output/data/fte_usage.csv`
- **Description**: Shows FTE (Full-Time Equivalent) resource usage over time
- **Expected Columns**: `fte_id`, `test_id`, `test_name`, `start`/`end` (combined datetime format)
- **Features**:
  - FTE-specific color coding
  - Interactive labels and tooltips
  - Timeline visualization

### 4. Active Tests vs Capacity (Line Chart)
- **Data Source**: `output/data/concurrency_timeseries.csv`
- **Description**: Shows active test count compared to available capacity over time
- **Expected Columns**: `timestamp`, `active_tests`, `available_fte`, `available_equipment`, `capacity_min`
- **Features**:
  - Dual-axis line chart
  - Step function for capacity
  - Smooth curve for active tests
  - Interactive data points with tooltips

## Usage

### Quick Start (Original Version)
1. Run the planner to generate output data:
   ```bash
   python run_planner.py
   ```

2. Open `d3_visualizations.html` in a web browser

3. Use the navigation tabs to switch between different visualizations

### Using Refactored Version
1. Run the planner to generate output data:
   ```bash
   python run_planner.py
   ```

2. Open `d3_visualizations_refactored.html` in a web browser

3. Use the navigation tabs to switch between different visualizations

### Individual Chart Functions
You can also use the individual D3 functions directly:

```javascript
// Load and display tests Gantt chart
d3.csv('output/data/tests_schedule.csv', d3.autoType)
  .then(createD3GanttTests);

// Load and display equipment utilization
d3.csv('output/data/equipment_usage.csv', d3.autoType)
  .then(createD3GanttEquipment);

// Load and display FTE utilization
d3.csv('output/data/fte_usage.csv', d3.autoType)
  .then(createD3GanttFTE);

// Load and display concurrency chart
d3.csv('output/data/concurrency_timeseries.csv', d3.autoType)
  .then(createD3ConcurrencyLine);
```

## Files Structure

### Original Files (Preserved)
- `d3_visualizations.html` - Complete web interface with all charts embedded
- `js_code.js` - Legacy JavaScript file (may contain duplicate code)

### Refactored Structure
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
│   ├── README.md                 # Main project documentation
│   ├── charts-README.md          # Chart modules documentation
│   ├── utils-README.md           # Utility modules documentation
│   └── ui-README.md               # UI modules documentation
└── d3_visualizations_refactored.html  # Main HTML file (refactored)
```

## Features

### Interactive Elements
- **Hover tooltips**: Detailed information on hover
- **Responsive design**: Adapts to screen size
- **Navigation**: Easy switching between charts
- **Current date indicator**: Shows today's date on timeline charts

### Data Handling
- **Automatic data type conversion**: Handles CSV dates and numbers
- **Error handling**: Graceful handling of missing data
- **Data validation**: Checks for data availability
- **Folder selection**: Load data from user-selected folders
- **Data caching**: Avoid redundant loading of the same data
- **Multiple datetime formats**: Supports both combined datetime columns (e.g., `start`, `end`) and separate date/time columns (e.g., `start_date`/`start_time`, `end_date`/`end_time`)

### Visual Design
- **Consistent color schemes**: Equipment and FTE specific colors
- **Grid lines**: For better readability
- **Professional styling**: Clean, modern interface
- **Accessibility**: Proper contrast and readable fonts

### Download Features
- **PNG Export**: Download individual charts as PNG images
- **ZIP Export**: Download all charts as a single ZIP file
- **Custom filenames**: User-defined filenames for downloads
- **Batch processing**: Efficient handling of multiple charts

## Technical Details

### Dependencies
- **D3.js v7**: Core visualization library
- **JSZip**: ZIP file creation for batch downloads
- **FileSaver.js**: File download functionality
- **Modern browser**: Chrome, Firefox, Safari, Edge

### Data Format Requirements
The visualizations expect CSV files with specific column structures:

#### tests_schedule.csv
- `test_id`, `project_leg_id`, `test_name`, `sequence_index`, `duration_days`, `start`, `end`, `assigned_equipment_id`, `assigned_fte_id`

#### equipment_usage.csv
- `equipment_id`, `test_id`, `test_name`, `start`, `end`

#### fte_usage.csv
- `fte_id`, `test_id`, `test_name`, `start`, `end`

#### concurrency_timeseries.csv
- `timestamp`, `active_tests`, `available_fte`, `available_equipment`, `capacity_min`

## Recent Updates

### Test Name Column Added (Latest)
The `equipment_usage.csv` and `fte_usage.csv` files now include a `test_name` column that provides the human-readable test name (e.g., "P-03l", "Leak test") in addition to the `test_id`. This makes the data more user-friendly for analysis and visualization.

### Project Refactoring
The original monolithic HTML file has been split into modular components:

1. **CSS extracted** to separate stylesheet
2. **Chart functions** moved to individual modules
3. **Data loading** centralized in utility module
4. **UI controls** organized in dedicated module
5. **Download functionality** separated into utility module
6. **Comprehensive documentation** for each module

## Comparison with Matplotlib Plots

| Feature | Matplotlib | D3.js |
|---------|------------|-------|
| Interactivity | Limited | High |
| Web deployment | Requires conversion | Native |
| Responsiveness | Static | Dynamic |
| Tooltips | Basic | Rich |
| Navigation | Separate files | Tabbed interface |
| Browser support | N/A | Universal |
| Maintainability | Good | Excellent (modular) |
| Extensibility | Limited | High |

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

### 6. **Team Development**
- Multiple developers can work on different modules
- Clear module boundaries prevent conflicts
- Easy to onboard new team members

## Migration Guide

### From Original to Refactored
1. **Data Loading**: Updated to use new data loader module
2. **Chart Functions**: Moved to individual chart modules
3. **UI Controls**: Centralized in UI controls module
4. **Downloads**: Enhanced with better error handling

### For Developers
1. **Adding New Charts**: Create new module in `js/charts/`
2. **Modifying Styles**: Update `css/styles.css`
3. **Adding Features**: Extend utility modules as needed

## Troubleshooting

### Common Issues

1. **Charts not loading**:
   - Ensure output CSV files exist and are properly formatted
   - Check browser console for JavaScript errors
   - Verify all external dependencies load correctly

2. **Data not displaying**:
   - Check that folder selection contains required CSV files
   - Verify CSV parsing with `d3.autoType`
   - Ensure data format matches expected schema

3. **Styling issues**:
   - Ensure CSS file is properly linked
   - Check for CSS specificity conflicts
   - Verify responsive breakpoints work correctly

4. **Download problems**:
   - Check that JSZip and FileSaver libraries load
   - Verify SVG elements exist before conversion
   - Ensure proper filename sanitization

### Browser Compatibility
- Chrome 70+
- Firefox 65+
- Safari 12+
- Edge 79+

### Debug Tips
1. Use browser developer tools to inspect individual modules
2. Check network tab for loading issues
3. Use console.log to debug data flow
4. Test with sample data files

## Contributing

### Adding New Chart Types
1. Create new module in `js/charts/` following the existing pattern
2. Add function to `js/utils/data-loader.js` for data handling
3. Update UI navigation in `js/ui/ui-controls.js`
4. Add documentation to `docs/charts-README.md`
5. Update this main README

### Modifying Existing Charts
1. Edit the appropriate chart module in `js/charts/`
2. Test changes with sample data
3. Update documentation as needed
4. Ensure responsive design works correctly

### Adding New Features
1. Determine which module (chart, utility, or UI) should handle the feature
2. Follow the existing code patterns and documentation standards
3. Add appropriate error handling and user feedback
4. Update relevant documentation files

## Future Enhancements

1. **Additional Chart Types**: Resource availability charts, comparative analysis views
2. **Advanced Features**: Zoom and pan, filtering options, date range selection
3. **Export Options**: SVG export, PDF generation, data export functionality
4. **Performance**: Data streaming for large files, virtualization for large datasets
5. **Accessibility**: Enhanced ARIA support, keyboard navigation, screen reader support
