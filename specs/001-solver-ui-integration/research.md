# Research: Solver UI Integration

**Date**: 2024-12-19  
**Feature**: Solver UI Integration  
**Purpose**: Resolve technical decisions and patterns for backend API integration

## Backend API Framework Selection

**Decision**: Use FastAPI for backend API service

**Rationale**:
- FastAPI provides excellent async/await support for long-running solver executions
- Built-in request/response validation with Pydantic models
- Automatic OpenAPI documentation generation
- High performance with async capabilities
- Easy integration with existing Python solver module
- CORS support for web UI integration

**Alternatives considered**:
- Flask: Synchronous by default, requires additional setup for async
- Django: Overkill for API-only service, heavier framework
- Tornado: Lower-level async framework, more complex setup

## Async Execution Pattern

**Decision**: Use FastAPI BackgroundTasks with execution queue

**Rationale**:
- FastAPI BackgroundTasks suitable for fire-and-forget async execution
- Queue pattern ensures single active execution (FR-017)
- Allows progress tracking through status endpoints
- Prevents resource contention with concurrent requests
- Results returned via polling or WebSocket (polling chosen for simplicity)

**Alternatives considered**:
- Celery: Overkill for single-server deployment, requires Redis/RabbitMQ
- ThreadPoolExecutor: Simpler but less control over queue management
- WebSockets: Real-time but adds complexity, polling sufficient for this use case

## Queue Implementation

**Decision**: In-memory queue with single active execution

**Rationale**:
- Simple in-memory queue sufficient for single-user interface
- Thread-safe queue.Queue for Python thread safety
- Single active execution prevents resource contention
- Queue position tracking for user feedback
- No external dependencies required

**Alternatives considered**:
- Redis queue: Overkill for single-user scenario
- Database-backed queue: Adds persistence complexity not needed
- External task queue (Celery): Unnecessary infrastructure overhead

## Error Handling Pattern

**Decision**: Structured error responses with categories and actionable guidance

**Rationale**:
- Error categories: ValidationError, SolverError, TimeoutError, SystemError
- Each error includes: category, message, actionable guidance, error code
- Consistent error format across all endpoints
- Client-side error handling can display appropriate UI based on category
- Aligns with FR-009 requirement for specific error categories

**Error Categories**:
- **ValidationError**: Invalid CSV data, missing files, malformed JSON
- **SolverError**: Solver execution failures, infeasible solutions
- **TimeoutError**: Solver exceeded time limit (with partial results if available)
- **SystemError**: Backend failures, resource exhaustion

## File Handling Pattern

**Decision**: Temporary file storage during execution, return results as JSON/Base64

**Rationale**:
- Temporary files created in system temp directory during execution
- CSV files parsed and validated before solver execution
- Results converted to JSON format for API response
- Large files can be Base64 encoded or streamed
- Temporary files cleaned up after execution completes
- Results returned to UI for local export (no server persistence)

**Alternatives considered**:
- File upload/download endpoints: Adds complexity, results already in memory
- Persistent storage: Not needed per spec (results returned to UI)
- Streaming responses: Useful for large files but adds complexity

## Progress Tracking Pattern

**Decision**: Status endpoint with polling mechanism

**Rationale**:
- Simple polling pattern sufficient for progress updates
- Status endpoint returns: execution_id, status, progress_percentage, elapsed_time, current_phase
- Client polls every 1-2 seconds during execution
- Status values: PENDING, RUNNING, COMPLETED, FAILED, TIMEOUT
- No WebSocket complexity required

**Alternatives considered**:
- WebSockets: Real-time but adds complexity, polling sufficient
- Server-Sent Events (SSE): Simpler than WebSockets but still adds complexity
- Long polling: More efficient but polling pattern simpler to implement

## Alpine.js API Integration Pattern

**Decision**: Alpine.js component with fetch API and reactive state

**Rationale**:
- Alpine.js `x-data` manages API state (loading, error, results)
- `fetch` API for HTTP requests (native, no dependencies)
- Reactive updates trigger UI changes automatically
- Error handling integrated into Alpine.js component state
- Progress polling uses `setInterval` with Alpine.js reactivity

**Pattern Structure**:
```javascript
x-data="{
  executionId: null,
  status: 'idle',
  progress: 0,
  error: null,
  results: null,
  async runSolver() { ... },
  async pollStatus() { ... }
}"
```

## CSV Data Extraction Pattern

**Decision**: Extract CSV data from Alpine.js parsed data structures

**Rationale**:
- UI already parses CSV files using PapaParse library
- Extract data from `parsedCsvData` object in Alpine.js component
- Convert back to CSV format using PapaParse unparse
- Validate required columns before sending to backend
- Package all CSV files into multipart/form-data or JSON payload

**Alternatives considered**:
- Re-upload files: Unnecessary, data already in UI
- Direct file references: Not applicable for edited data
- JSON format: More efficient but requires backend CSV conversion

## Timeout Handling Pattern

**Decision**: Graceful timeout with partial results

**Rationale**:
- Solver time limit enforced by backend
- When timeout occurs, check if solver has partial solution
- Return partial results with TIMEOUT status
- Include makespan and schedule data if available
- Clear indication that solution is partial/incomplete
- Aligns with FR-016 requirement

## CORS Configuration

**Decision**: Configure CORS for local development and production

**Rationale**:
- FastAPI CORS middleware for cross-origin requests
- Allow credentials for cookie-based sessions if needed
- Configure allowed origins based on deployment environment
- Support localhost for development

## Testing Strategy

**Decision**: pytest for backend, browser testing for UI

**Rationale**:
- pytest standard for Python testing
- FastAPI TestClient for API endpoint testing
- Mock solver execution for unit tests
- Browser-based testing for Alpine.js components
- Integration tests for full workflow





