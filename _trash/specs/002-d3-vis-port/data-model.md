# Data Model: D3 Visualization System

## Entities

### 1. VisualizationState (Alpine Component State)
The reactive state object managed by the Alpine.js component.

| Field | Type | Description |
|-------|------|-------------|
| `solverData` | `Object` | The raw `SolutionResult` from the solver. Null if no data. |
| `currentTemplateId` | `String` | ID of the currently selected template (e.g., 'gantt-tests'). |
| `code` | `String` | The current content of the code editor. |
| `error` | `Object` | Execution error object (null if valid). Contains `message`, `line`. |
| `autoRun` | `Boolean` | Toggle for automatic execution on data change. |
| `isPanelOpen` | `Boolean` | UI state for the collapsible editor panel. |

### 2. Template
A definition of a visualization type.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String` | Unique identifier (e.g., 'gantt-tests'). |
| `name` | `String` | Display name (e.g., "Tests by Leg"). |
| `code` | `String` | The default JavaScript code for this visualization. |

### 3. SolutionResult (Input Data)
The external data contract from the solver (Read-Only).

```json
{
  "status": "OPTIMAL",
  "makespan_days": 120,
  "test_schedules": [
    {
      "test_id": "T1",
      "start_date": "2024-01-01",
      "end_date": "2024-01-05",
      "assigned_fte": ["FTE1"],
      "assigned_equipment": ["EQ1"]
    }
  ],
  "resource_utilization": {
    "FTE1": 85.5
  }
}
```

## Validation Rules

1. **Code Safety**: Code execution is sandboxed only by function scope. Infinite loop protection is "best effort" (browser process limit).
2. **Data Integrity**: `solverData` must be a valid non-null object before "Run" is attempted.

## State Transitions

1. **Init**: Component loads -> Loads saved code from LocalStorage OR default template -> Renders.
2. **Data Update**: External `solverData` changes -> `autoRun` check -> If true, re-runs `code`.
3. **Template Switch**: User selects new template -> `code` updates to template default -> Renders.
4. **User Edit**: User types in editor -> `code` updates -> (Wait for Run click) -> Renders.



