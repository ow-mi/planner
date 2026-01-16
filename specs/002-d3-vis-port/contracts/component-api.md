# API Contract: Visualization Component

**Type**: Internal JavaScript API (Alpine.js Component)

## Stores / Events

### `solver-solution-updated`
Dispatched by the main application when a new solution is available.

**Payload**:
```typescript
{
  detail: {
    solution: SolutionResult // See data-model.md
  }
}
```

## Component API

The `visualizationComponent` exposes the following methods to the UI template:

### `updateData(newData: Object)`
Updates the internal `solverData` state and triggers a re-run if `autoRun` is true.

### `loadTemplate(templateId: String)`
Resets the editor code to the default code for the specified template ID.

### `runCode()`
Executes the current editor content.
- **Inputs**: `data` (State), `container` (DOM Node).
- **Side Effects**: Clears `container`, appends new DOM elements, sets `error` state if exception occurs.

### `uploadTemplate(file: File)`
Reads a user-uploaded file and sets the editor content to its text.



