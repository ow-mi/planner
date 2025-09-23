# Chart Modules Documentation

This document describes the individual chart modules that create the D3.js visualizations for the Planning Test Program.

## Overview

Each chart module is a self-contained JavaScript file that creates a specific type of visualization. The modules follow a consistent pattern and can be used independently or together.

## Common Pattern

All chart modules follow this structure:

```javascript
/**
 * Chart Title
 *
 * Description of what the chart shows and its purpose.
 *
 * Data Source: path/to/data.csv
 * Expected columns: column1, column2, column3
 *
 * @param {Array} raw - Raw data from CSV file
 */
function createChartName(raw) {
  // Chart implementation
}
```

## Individual Chart Modules

### 1. Tests Chart (`js/charts/tests-chart.js`)

**Function**: `createD3GanttTests(raw)`

**Purpose**: Creates a Gantt chart showing scheduled tests organized by project leg with a timeline view.

**Data Source**: `output/data/tests_schedule.csv`

**Expected Data Format**:
```javascript
{
  project_leg_id: "LEG_1",
  test_id: "TEST_001",
  test_name: "P-03l",
  sequence_index: 1,
  duration_days: 14,
  start: "2025-01-01",
  end: "2025-01-15",
  assigned_equipment_id: "EQ_001",
  assigned_fte_id: "FTE_001"
}
```

**Features**:
- Time-based x-axis showing weeks
- Project legs on y-axis
- Equipment color coding for easy identification
- Force-directed label positioning to avoid overlaps
- Current date indicator (red dashed line)
- Interactive tooltips with test details
- End date labels for each project leg

**Usage**:
```javascript
d3.csv('output/data/tests_schedule.csv', d3.autoType)
  .then(createD3GanttTests);
```

### 2. Equipment Chart (`js/charts/equipment-chart.js`)

**Function**: `createD3GanttEquipment(raw)`

**Purpose**: Shows equipment usage over time with test assignments.

**Data Source**: `output/data/equipment_usage.csv`

**Expected Data Format**:
```javascript
{
  equipment_id: "EQ_001",
  test_id: "TEST_001",
  test_name: "P-03l",
  start: "2025-01-01",
  end: "2025-01-15"
}
```

**Features**:
- Equipment-specific color coding
- Test name labels with collision avoidance
- Duration and assignment information in tooltips
- Current date indicator
- End date labels showing completion weeks

**Usage**:
```javascript
d3.csv('output/data/equipment_usage.csv', d3.autoType)
  .then(createD3GanttEquipment);
```

### 3. FTE Chart (`js/charts/fte-chart.js`)

**Function**: `createD3GanttFTE(raw)`

**Purpose**: Shows FTE (Full-Time Equivalent) resource usage over time.

**Data Source**: `output/data/fte_usage.csv`

**Expected Data Format**:
```javascript
{
  fte_id: "FTE_001",
  test_id: "TEST_001",
  test_name: "P-03l",
  start: "2025-01-01",
  end: "2025-01-15"
}
```

**Features**:
- FTE-specific color coding using Set2 scheme
- Interactive labels and tooltips
- Timeline visualization
- Current date indicator
- End date labels

**Usage**:
```javascript
d3.csv('output/data/fte_usage.csv', d3.autoType)
  .then(createD3GanttFTE);
```

### 4. Concurrency Chart (`js/charts/concurrency-chart.js`)

**Function**: `createD3ConcurrencyLine(raw)`

**Purpose**: Line chart showing active test count compared to available capacity over time.

**Data Source**: `output/data/concurrency_timeseries.csv`

**Expected Data Format**:
```javascript
{
  timestamp: "2025-01-01T00:00:00",
  active_tests: 5,
  available_fte: 10,
  available_equipment: 8,
  capacity_min: 8
}
```

**Features**:
- Dual-axis visualization
- Step function for capacity (red dashed line)
- Smooth curve for active tests (blue line)
- Interactive data points with tooltips
- Legend showing both metrics
- Current date indicator

**Usage**:
```javascript
d3.csv('output/data/concurrency_timeseries.csv', d3.autoType)
  .then(createD3ConcurrencyLine);
```

## Common Features

### Responsive Design
All charts automatically adjust to container size with:
- Dynamic margins based on screen size
- Responsive tick counts
- Adaptive font sizes
- Mobile-friendly layouts

### Error Handling
- Check for empty or invalid data
- Display appropriate error messages
- Graceful fallbacks for missing data

### Accessibility
- Descriptive tooltips on hover
- Proper color contrast
- Semantic HTML structure

### Performance
- Efficient D3.js rendering
- Debounced resize handling
- Data caching to avoid redundant loading

## Styling

Charts use consistent styling defined in `css/styles.css`:
- Grid lines: Light gray (#e8e8e8) with low opacity
- Axis labels: Responsive font sizes
- Loading states: Centered text with appropriate colors
- Error states: Red text with background highlight

## Integration

These chart modules are designed to work together in the main application:

1. **Data Loading**: Handled by `js/utils/data-loader.js`
2. **UI Controls**: Managed by `js/ui/ui-controls.js`
3. **Downloads**: Handled by `js/utils/download-utils.js`

## Customization

To customize a chart:

1. **Colors**: Modify color scales in the chart function
2. **Dimensions**: Adjust margin calculations for different layouts
3. **Styling**: Update CSS classes used by the chart
4. **Data Processing**: Modify the data transformation logic

## Troubleshooting

### Common Issues

1. **Chart not displaying**:
   - Check that data files exist and are properly formatted
   - Verify CSV parsing with `d3.autoType`
   - Check browser console for JavaScript errors

2. **Labels overlapping**:
   - Force-directed layout should handle most cases
   - Adjust collision detection parameters if needed
   - Consider reducing label font size

3. **Performance issues**:
   - Large datasets may require optimization
   - Consider data aggregation for very large time ranges
   - Check for memory leaks in complex interactions

### Debug Tips

1. **Test individual charts**:
   ```javascript
   // Load and test a single chart
   d3.csv('output/data/tests_schedule.csv', d3.autoType)
     .then(data => {
       console.log('Data loaded:', data);
       createD3GanttTests(data);
     });
   ```

2. **Check data format**:
   ```javascript
   d3.csv('output/data/tests_schedule.csv', d3.autoType)
     .then(data => console.log('Sample data:', data[0]));
   ```

3. **Verify DOM structure**:
   - Ensure `#plot` element exists
   - Check that SVG elements are being created
   - Verify CSS classes are applied correctly

## Future Enhancements

1. **Interactive Features**:
   - Zoom and pan capabilities
   - Filtering options
   - Date range selection

2. **Additional Chart Types**:
   - Resource availability charts
   - Comparative analysis views
   - Summary dashboards

3. **Export Options**:
   - SVG export in addition to PNG
   - PDF generation
   - Data export functionality

