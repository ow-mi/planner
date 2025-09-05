# D3.js Visualizations for Planning Test Program

This document describes the new D3.js interactive visualizations created for the Planning Test Program.

## Overview

The D3 visualizations provide interactive, web-based alternatives to the matplotlib plots, offering:

- **Interactive charts** with hover tooltips and responsive design
- **Multiple chart types** accessible through a tabbed interface
- **Modern web interface** that works in any modern browser
- **Responsive design** that adapts to different screen sizes

## Available Visualizations

### 1. Tests by Leg (Gantt Chart)
- **Data Source**: `output/data/tests_schedule.csv`
- **Description**: Shows scheduled tests organized by project leg with timeline view
- **Features**:
  - Color-coded equipment assignments
  - Interactive tooltips with test details
  - Repelling labels to avoid overlap
  - Current date indicator

### 2. Equipment Utilization (Gantt Chart)
- **Data Source**: `output/data/equipment_usage.csv`
- **Description**: Shows equipment usage over time with test assignments
- **Features**:
  - Equipment-specific color coding
  - Test name labels with collision avoidance
  - Duration and assignment information in tooltips

### 3. FTE Utilization (Gantt Chart)
- **Data Source**: `output/data/fte_usage.csv`
- **Description**: Shows FTE (Full-Time Equivalent) resource usage over time
- **Features**:
  - FTE-specific color coding
  - Interactive labels and tooltips
  - Timeline visualization

### 4. Active Tests vs Capacity (Line Chart)
- **Data Source**: `output/data/concurrency_timeseries.csv`
- **Description**: Shows active test count compared to available capacity over time
- **Features**:
  - Dual-axis line chart
  - Step function for capacity
  - Smooth curve for active tests
  - Interactive data points with tooltips

## Usage

### Method 1: Open HTML File Directly
1. Run the planner to generate output data:
   ```bash
   python run_planner.py
   ```

2. Open `d3_visualizations.html` in a web browser

3. Use the navigation tabs to switch between different visualizations

### Method 2: Individual Chart Functions
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

## Files Created

### `d3_visualizations.html`
- Complete web interface with all charts
- Responsive design
- Navigation between chart types
- Embedded D3.js library

### `planner/d3_code.js` (Updated)
- Contains all D3 chart functions
- Modular design for easy reuse
- Comprehensive documentation

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

### Visual Design
- **Consistent color schemes**: Equipment and FTE specific colors
- **Grid lines**: For better readability
- **Professional styling**: Clean, modern interface
- **Accessibility**: Proper contrast and readable fonts

## Technical Details

### Dependencies
- **D3.js v7**: Core visualization library
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

## Comparison with Matplotlib Plots

| Feature | Matplotlib | D3.js |
|---------|------------|-------|
| Interactivity | Limited | High |
| Web deployment | Requires conversion | Native |
| Responsiveness | Static | Dynamic |
| Tooltips | Basic | Rich |
| Navigation | Separate files | Tabbed interface |
| Browser support | N/A | Universal |

## Future Enhancements

The remaining matplotlib plots that could be converted to D3:

1. **Resource availability vs utilization charts** for equipment and FTE
   - Would show availability windows alongside utilization
   - Dual-row charts with availability and usage

These would require additional data processing to combine availability windows with utilization data.

## Troubleshooting

### Common Issues

1. **Charts not loading**: Ensure output CSV files exist and are properly formatted
2. **Data not displaying**: Check browser console for JavaScript errors
3. **Styling issues**: Ensure D3.js library is loaded properly

### Browser Compatibility
- Chrome 70+
- Firefox 65+
- Safari 12+
- Edge 79+

## Contributing

To add new chart types or modify existing ones:

1. Add the chart function to `planner/d3_code.js`
2. Update the HTML interface in `d3_visualizations.html`
3. Add navigation button and data loading logic
4. Update this README with new chart information
