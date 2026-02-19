# Component API Contract: Visualizer Integration

**Feature**: 003-visualizer-integration  
**Date**: 2024-12-19  
**Type**: Alpine.js Component API

## Overview

This document defines the API contract for the visualizer component integration. The component follows Alpine.js patterns and integrates with the existing configEditor() component.

## Component Function: visualizationComponent()

### Signature
```javascript
function visualizationComponent() {
  return {
    // State properties
    // Methods
  };
}
```

### State Properties

#### solverData
- **Type**: `SolverResults | null`
- **Description**: Current solver results data
- **Source**: Passed from parent configEditor() component
- **Reactive**: Yes (watched via `x-effect` or `$watch`)
- **Default**: `null`

#### csvData
- **Type**: `TransformedVisualizationData | null`
- **Description**: Current CSV data from user upload
- **Source**: Parsed from uploaded CSV file
- **Reactive**: Yes
- **Default**: `null`

#### activeDataSource
- **Type**: `'solver' | 'csv' | null`
- **Description**: Currently active data source for visualization
- **Reactive**: Yes
- **Default**: `null`
- **Behavior**: 
  - `'solver'` when solver data is active
  - `'csv'` when CSV data is active
  - `null` when no data available

#### currentTemplateId
- **Type**: `string`
- **Description**: Selected visualization template ID
- **Valid Values**: `'gantt-tests'`, `'equipment'`, `'fte'`, `'concurrency'`
- **Reactive**: Yes
- **Default**: `'gantt-tests'`
- **Persistence**: Stored in localStorage as `vis-code-${templateId}`

#### code
- **Type**: `string`
- **Description**: Current visualization template code
- **Reactive**: Yes
- **Default**: Template code from `legacyTemplates[currentTemplateId]`

#### error
- **Type**: `ErrorObject | null`
- **Description**: Current error state
- **Reactive**: Yes
- **Default**: `null`

#### autoRun
- **Type**: `boolean`
- **Description**: Auto-run visualization when data changes
- **Reactive**: Yes
- **Default**: `false`

#### isPanelOpen
- **Type**: `boolean`
- **Description**: Code editor panel visibility
- **Reactive**: Yes
- **Default**: `true` (may be `false` in integrated version)

#### isLoading
- **Type**: `boolean`
- **Description**: CSV upload/parsing loading state
- **Reactive**: Yes
- **Default**: `false`

#### editor
- **Type**: `EditorInstance | null`
- **Description**: Code editor instance (optional)
- **Reactive**: No
- **Default**: `null`

### Methods

#### init()
- **Type**: `async () => void`
- **Description**: Component initialization logic
- **Behavior**:
  - Loads saved template code from localStorage
  - Initializes code editor if available
  - Auto-runs visualization if data exists and autoRun is enabled

#### watchSolverData()
- **Type**: `() => void`
- **Description**: Watches solverData changes and auto-runs if enabled
- **Behavior**:
  - Debounced execution (300ms)
  - Only runs if autoRun is true
  - Clears previous debounce timer

#### loadTemplate(templateId)
- **Type**: `(templateId: string) => void`
- **Parameters**:
  - `templateId`: Template ID to load
- **Description**: Loads visualization template
- **Behavior**:
  - Updates `currentTemplateId`
  - Loads template code from `legacyTemplates`
  - Saves to localStorage
  - Updates editor if available
  - Auto-runs if enabled

#### runCode()
- **Type**: `() => void`
- **Description**: Executes visualization code
- **Behavior**:
  - Validates data availability
  - Transforms data if needed
  - Executes D3.js code in isolated scope
  - Handles errors and displays error messages

#### transformSolutionResult(solutionResult)
- **Type**: `(solutionResult: SolverResults) => TransformedVisualizationData`
- **Parameters**:
  - `solutionResult`: Solver results to transform
- **Returns**: Transformed visualization data
- **Description**: Transforms solver results to visualization format
- **Behavior**:
  - Converts dates to ISO strings
  - Generates equipment usage data
  - Generates FTE usage data
  - Generates concurrency timeseries

#### updateData(newData)
- **Type**: `(newData: SolverResults) => void`
- **Parameters**:
  - `newData`: New solver data
- **Description**: Updates solver data and triggers visualization
- **Behavior**:
  - Updates `solverData`
  - Debounced auto-run if enabled
  - Sets `activeDataSource` to 'solver'

#### uploadTemplate(file)
- **Type**: `(file: File) => void`
- **Parameters**:
  - `file`: Template file to upload
- **Description**: Uploads custom template code
- **Behavior**:
  - Reads file content
  - Updates `code`
  - Updates editor if available
  - Saves to localStorage

#### togglePanel()
- **Type**: `() => void`
- **Description**: Toggles code editor panel visibility
- **Behavior**:
  - Toggles `isPanelOpen`

#### resetToDefault()
- **Type**: `() => void`
- **Description**: Resets to default template
- **Behavior**:
  - Reloads current template

#### processCSVFile(file)
- **Type**: `async (file: File) => Promise<void>`
- **Parameters**:
  - `file`: CSV file to process
- **Description**: Processes uploaded CSV file
- **Behavior**:
  - Sets `isLoading` to true
  - Parses CSV with PapaParse
  - Validates required columns
  - Transforms to visualization format
  - Updates `csvData` and `activeDataSource`
  - Sets `isLoading` to false
  - Displays errors if validation fails

#### switchDataSource(source)
- **Type**: `(source: 'solver' | 'csv') => void`
- **Parameters**:
  - `source`: Data source to switch to
- **Description**: Switches active data source
- **Behavior**:
  - Updates `activeDataSource`
  - Re-runs visualization with selected data

## Integration Contract with configEditor()

### Data Binding
```html
<div x-data="visualizationComponent()" 
     x-effect="watchSolverData()">
  <!-- Component content -->
</div>
```

### Solver Results Access
- **Method**: Pass `solverState.results` from configEditor() to visualizationComponent()
- **Pattern**: Use Alpine.js `$parent` or pass via props
- **Update Trigger**: Automatic via Alpine.js reactivity when `solverState.results` changes

### State Sharing
- **Solver State**: Read-only access to `solverState.results`
- **Visualizer State**: Isolated within visualizationComponent() scope
- **Communication**: Use Alpine.js `$dispatch` for events if needed

## Template API

### Template Structure
```javascript
const legacyTemplates = {
  'template-id': {
    id: 'template-id',
    name: 'Template Name',
    code: `// D3.js visualization code
    // Receives: d3, data, container
    `
  }
};
```

### Template Execution Context
- **d3**: D3.js library (v7)
- **data**: TransformedVisualizationData object
- **container**: DOM element reference (x-ref="chartContainer")

### Template Code Requirements
- Must be valid JavaScript
- Must use provided `d3`, `data`, and `container` parameters
- Should handle empty data gracefully
- Should display error messages for invalid data

## Error Handling Contract

### Error Display
- **Location**: Inline within component
- **Format**: Error message with optional stack trace
- **Visibility**: Controlled via `x-show="error"`
- **Clearance**: Error cleared when new visualization runs successfully

### Error Types
1. **No Data Error**: `{ message: 'No solver data available' }`
2. **Validation Error**: `{ message: 'CSV validation failed: ...' }`
3. **Parsing Error**: `{ message: 'Failed to parse CSV: ...' }`
4. **Rendering Error**: `{ message: 'Visualization error: ...', line: <number>, stack: <string> }`

## Performance Contract

### Response Times
- **CSV Parsing**: < 3 seconds for files up to 10MB
- **Visualization Rendering**: < 2 seconds for up to 1000 test schedules
- **Template Switching**: < 1 second

### Debouncing
- **Data Updates**: 300ms debounce for auto-run
- **Resize Events**: Debounced (if implemented)

### Memory Management
- **Large Files**: Warning displayed for files > 10MB
- **Data Cleanup**: Old data cleared when new data arrives
- **Chart Cleanup**: Previous chart cleared before rendering new one

## Accessibility Contract

### Keyboard Navigation
- **Template Selection**: Accessible via keyboard
- **File Upload**: Accessible via keyboard
- **Data Source Switching**: Accessible via keyboard

### Screen Reader Support
- **Loading States**: ARIA labels for loading indicators
- **Error Messages**: Accessible error announcements
- **Empty States**: Descriptive empty state messages

### Progressive Enhancement
- **Core Functionality**: Works without JavaScript (empty state message)
- **Visualization**: Degrades gracefully when JavaScript disabled

## Browser Compatibility

### Required Features
- **ES6+**: Arrow functions, template literals, destructuring
- **Fetch API**: For file reading (or FileReader API)
- **localStorage**: For template persistence
- **Alpine.js 3.x**: For reactivity

### Supported Browsers
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+



