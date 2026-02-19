# Data Model: Visualizer Integration

**Feature**: 003-visualizer-integration  
**Date**: 2024-12-19

## Overview

This document describes the data structures used by the visualizer integration feature. The visualizer consumes solver results and CSV data, transforming them into a unified format for visualization.

## Core Entities

### SolverResults

Represents the complete output from the solver API execution.

**Source**: `solverState.results` in configEditor() Alpine.js component  
**Structure**:
```typescript
{
  status: string;                    // "OPTIMAL", "FEASIBLE", "INFEASIBLE", "NO_SOLUTION", "TIMEOUT"
  makespan?: number;                  // Total project duration in days (optional)
  solver_stats?: {                    // Solver performance statistics (optional)
    solve_time?: number;              // Solve time in seconds
    objective_value?: number;          // Objective function value
  };
  test_schedules?: TestSchedule[];    // Array of test schedule objects
  resource_utilization?: {            // Resource usage statistics (optional)
    [resourceId: string]: number;      // Utilization percentage (0-100)
  };
  output_files?: {                    // Output files map (optional)
    [filename: string]: string;       // File content as string
  };
}
```

**Validation Rules**:
- `status` is required and must be one of the valid status values
- `test_schedules` array is required for visualization (may be empty)
- Date fields in `test_schedules` may be ISO date strings or Date objects

### TestSchedule

Represents a single test schedule entry from solver results.

**Structure**:
```typescript
{
  test_id: string;                    // Unique test identifier
  project_leg_id: string;            // Parent leg identifier
  test_name?: string;                 // Human-readable test name (optional)
  start_date: string | Date;         // Start date (ISO string or Date object)
  end_date: string | Date;            // End date (ISO string or Date object)
  assigned_equipment: string[];      // Array of equipment resource IDs
  assigned_fte: string[];             // Array of FTE resource IDs
}
```

**Validation Rules**:
- `test_id` is required and must be non-empty
- `project_leg_id` is required and must be non-empty
- `start_date` and `end_date` are required
- `assigned_equipment` and `assigned_fte` are arrays (may be empty)

### CSVScheduleData

Represents CSV file data uploaded by user.

**Source**: User file upload, parsed via PapaParse  
**Format**: Matches solver output CSV format (test_schedules.csv structure)

**Required Columns**:
- `test_id` (string): Unique test identifier
- `project_leg_id` (string): Parent leg identifier
- `test_name` (string, optional): Human-readable test name
- `start_date` (string): Start date in ISO format (YYYY-MM-DD)
- `end_date` (string): End date in ISO format (YYYY-MM-DD)
- `assigned_equipment` (string): Comma or semicolon-separated equipment IDs
- `assigned_fte` (string): Comma or semicolon-separated FTE IDs

**Validation Rules**:
- All required columns must be present
- Date columns must be valid ISO date format (YYYY-MM-DD)
- Equipment and FTE columns parsed as comma/semicolon-separated lists
- File size warning displayed for files over 10MB (not rejected)

### TransformedVisualizationData

Unified data format used by visualization templates.

**Source**: Transformed from SolverResults or CSVScheduleData via `transformSolutionResult()`  
**Structure**:
```typescript
{
  test_schedules: TransformedTestSchedule[];
  equipment_usage: EquipmentUsage[];
  fte_usage: FTEUsage[];
  concurrency_timeseries: ConcurrencyDataPoint[];
}
```

**Transformation Logic**:
- Dates normalized to ISO date strings
- Equipment/FTE arrays converted to semicolon-separated strings for legacy compatibility
- Additional derived data generated (equipment_usage, fte_usage, concurrency_timeseries)

### TransformedTestSchedule

Transformed test schedule for visualization templates.

**Structure**:
```typescript
{
  test_id: string;
  project_leg_id: string;
  test_name: string;
  start_date: string;                // ISO date string (YYYY-MM-DD)
  start_time: string;                // Time string (HH:MM:SS)
  end_date: string;                   // ISO date string (YYYY-MM-DD)
  end_time: string;                   // Time string (HH:MM:SS)
  assigned_equipment_id: string;      // First equipment ID (legacy compatibility)
  assigned_fte_id: string;            // First FTE ID (legacy compatibility)
  assigned_equipment: string;         // Semicolon-separated equipment IDs
  assigned_fte: string;               // Semicolon-separated FTE IDs
}
```

### EquipmentUsage

Equipment utilization data point.

**Structure**:
```typescript
{
  equipment_id: string;
  test_id: string;
  test_name: string;
  start_date: string;                 // ISO date string
  end_date: string;                   // ISO date string
}
```

### FTEUsage

FTE utilization data point.

**Structure**:
```typescript
{
  fte_id: string;
  test_id: string;
  test_name: string;
  start_date: string;                 // ISO date string
  end_date: string;                   // ISO date string
}
```

### ConcurrencyDataPoint

Concurrency timeseries data point.

**Structure**:
```typescript
{
  timestamp: string;                   // ISO timestamp string
  active_tests: number;               // Number of active tests at this timestamp
  available_fte: number;              // Available FTE capacity (placeholder)
  available_equipment: number;        // Available equipment capacity (placeholder)
  capacity_min: number;               // Minimum capacity (placeholder)
}
```

## Visualizer Component State

### VisualizerState

Alpine.js component state for visualizer.

**Structure**:
```typescript
{
  solverData: SolverResults | null;           // Current solver data (null if not available)
  csvData: TransformedVisualizationData | null; // Current CSV data (null if not uploaded)
  activeDataSource: 'solver' | 'csv' | null;  // Currently active data source
  currentTemplateId: string;                   // Selected template ID ('gantt-tests', 'equipment', 'fte', 'concurrency')
  code: string;                                // Current visualization template code
  error: ErrorObject | null;                   // Current error state
  autoRun: boolean;                            // Auto-run visualization on data change
  isPanelOpen: boolean;                        // Code editor panel visibility
  isLoading: boolean;                         // CSV upload/parsing loading state
  editor: EditorInstance | null;               // Code editor instance (optional)
}
```

**State Transitions**:
1. **Initial State**: `solverData: null`, `csvData: null`, `activeDataSource: null`
2. **Solver Results Available**: `solverData: <results>`, `activeDataSource: 'solver'`
3. **CSV Upload**: `csvData: <parsed>`, `activeDataSource: 'csv'` (overrides solver)
4. **New Solver Results**: `solverData: <new>`, `activeDataSource: 'solver'` (overrides CSV)
5. **User Switch**: `activeDataSource` toggles between 'solver' and 'csv' if both available

### ErrorObject

Error state structure.

**Structure**:
```typescript
{
  message: string;                    // Error message
  line?: number;                      // Code line number (if applicable)
  stack?: string;                     // Error stack trace (if available)
}
```

## Data Flow

### Solver Results Flow
1. Solver API returns results → `solverState.results` updated
2. Alpine.js reactivity detects change → visualizer component watches `solverState.results`
3. Visualizer transforms data → `transformSolutionResult()` called
4. Visualization renders → D3.js code executes with transformed data

### CSV Upload Flow
1. User selects CSV file → File input event triggered
2. File parsed → PapaParse parses CSV content
3. Validation performed → Required columns checked
4. Data transformed → CSV rows converted to TransformedVisualizationData format
5. State updated → `csvData` set, `activeDataSource` set to 'csv'
6. Visualization renders → D3.js code executes with CSV data

### Data Source Switching Flow
1. User selects data source → Dropdown or button interaction
2. State updated → `activeDataSource` changed
3. Visualization re-renders → D3.js code executes with selected data source

## Validation Rules

### CSV File Validation
- **Required Columns**: test_id, project_leg_id, start_date, end_date
- **Date Format**: YYYY-MM-DD (ISO date format)
- **File Size**: Warning displayed for files > 10MB, but not rejected
- **Column Types**: All columns validated as strings, dates parsed and validated

### Solver Results Validation
- **Status**: Must be valid status string
- **Test Schedules**: Array must exist (may be empty)
- **Date Fields**: Must be valid dates (ISO strings or Date objects)

### Visualization Data Validation
- **Empty Data**: Empty state message displayed if no data available
- **Malformed Data**: Error message displayed with validation details
- **Missing Fields**: Default values used where possible, errors for critical missing fields

## Persistence

### LocalStorage
- **Template Preference**: `vis-code-${templateId}` stores template code
- **Component State**: Not persisted (resets on page reload)
- **Data**: Not persisted (solver results and CSV data not saved)

### In-Memory State
- **Alpine.js Component State**: Persists during page session
- **Tab Navigation**: State maintained when switching tabs
- **Page Reload**: State reset (solver results lost, CSV data lost)

## Relationships

```
SolverResults
  ├── contains TestSchedule[]
  └── transforms to TransformedVisualizationData

CSVScheduleData
  └── transforms to TransformedVisualizationData

TransformedVisualizationData
  ├── contains TransformedTestSchedule[]
  ├── contains EquipmentUsage[]
  ├── contains FTEUsage[]
  └── contains ConcurrencyDataPoint[]

VisualizerState
  ├── references SolverResults (solverData)
  ├── references TransformedVisualizationData (csvData)
  └── manages activeDataSource selection
```



