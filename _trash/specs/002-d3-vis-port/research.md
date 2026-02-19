# Research: D3 Visualization Port to Alpine.js

**Feature**: `002-d3-vis-port`
**Date**: 2025-11-19

## Decisions & Rationale

### 1. CodeMirror 6 via ESM/CDN
**Decision**: Use CodeMirror 6 loaded via ES Modules (ESM) from a CDN (e.g., esm.sh or unpkg) or a local ESM shim, rather than introducing a complex bundler (Webpack/Vite) into this simple project.
**Rationale**: The "Constraints" mentioned in the plan favor no build step. CodeMirror 6 is modular but can be loaded via `<script type="module">` and imports. This keeps the project lightweight and aligns with the "Alpine.js + static HTML" philosophy.
**Alternatives Considered**:
- **Monaco Editor**: Too heavy (multiple MBs), requires complex worker configuration.
- **Ace Editor**: Legacy technology, harder to integrate with modern reactive patterns than CM6.
- **Bundled CodeMirror**: Adds build toolchain complexity (Node.js, npm install, build script) which might be overkill for a single HTML file tool.

### 2. Raw JSON Data Contract
**Decision**: The visualization component will accept the raw `SolutionResult` JSON object.
**Rationale**: Maximizes flexibility. The backend format is stable (`tests_schedule`, `resource_utilization`). Converting to CSV-like arrays in the frontend adds an unnecessary processing step and "locks in" the legacy format. We can write adapter functions in JS if we really need to reuse exact legacy D3 code blocks.
**Alternatives Considered**:
- **Server-side Transformation**: Adds load to the backend, couples backend to frontend display needs.

### 3. Component Isolation via Shadow DOM or Scoped Selector
**Decision**: Use Scoped Selectors (Injecting a `container` DOM node).
**Rationale**: Shadow DOM might interfere with global D3 styles or event bubbling. Passing a specific `div` reference (`container`) to the D3 function is a standard, robust pattern that ensures the chart renders exactly where intended without global query selectors.

## Unknowns Resolved

- **CodeMirror Loading**: Validated that CM6 can be used with ES modules without a bundler.
- **Data Format**: Confirmed `SolutionResult` structure via codebase search.



