# Backend Architecture

## Overview

This backend implements a solver service API using FastAPI with a layered service-oriented architecture. The system provides endpoints for running optimization jobs, managing sessions, and handling batch operations.

## Architecture Layers

### 1. API Layer (`src/api/`)

FastAPI routes that handle HTTP requests/responses.

| File | Purpose |
|------|---------|
| `main.py` | App initialization, CORS, route registration |
| `routes/solver.py` | Solver execution endpoints |
| `routes/runs_batch.py` | Session and batch job management |
| `routes/validation.py` | Configuration validation |
| `routes/health.py` | Health check endpoints |

### 2. Service Layer (`src/services/`)

Business logic orchestration with dependency injection.

| Service | Purpose |
|---------|---------|
| `SolverService` | Facade coordinating all solver operations |
| `ExecutionOrchestrator` | Core solver execution lifecycle |
| `ExecutionQueueService` | Execution queue management |
| `SessionManager` | Run session lifecycle |
| `BatchJobManager` | Batch job and scenario management |
| `FileOperationsService` | File I/O operations |

### 3. State Layer (`src/state/`)

Thread-safe in-memory state management.

| Component | Purpose |
|-----------|---------|
| `StateStore` | Thread-safe state with copy-on-write pattern |
| `mappers` | Convert internal state to API models |

### 4. Factory Layer (`src/services/factory.py`)

Dependency injection via ServiceFactory pattern.

## Dependency Injection

The application uses a Service Factory pattern for dependency injection:

```
ServiceFactory
    └── StateStore (singleton)
    └── ExecutionQueueService(state_store)
    └── ExecutionOrchestrator(state_store, queue_service)
    └── SolverService(state_store, queue_service, orchestrator)
```

All services share the same `StateStore` instance, ensuring consistent state across the application.

## Request Flow

```
HTTP Request → FastAPI Route → SolverService (Facade)
    → ExecutionOrchestrator / SessionManager / BatchJobManager
    → ExecutionQueueService → StateStore
    → Background Worker Thread
```

## Thread Safety

The application uses a background worker thread to process solver executions. Thread safety is ensured through:

1. `threading.RLock()` in StateStore
2. Copy-on-write pattern for state reads
3. Atomic operations for queue management

## Testing

Tests are organized into:

- `tests/` - Core component tests
- `tests/integration/` - Full API flow tests

## Key Design Decisions

See `docs/adr/` for Architecture Decision Records.