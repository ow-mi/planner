# ADR-002: Thread-Safe Copy-on-Write State Pattern

## Status

Accepted

## Context

The application maintains in-memory state for:
- Execution requests and results
- Run sessions
- Batch jobs

A background worker thread processes the execution queue while HTTP handlers read state.

## Decision

StateStore uses `threading.RLock()` with a **copy-on-write** pattern:
- Reads return `deepcopy()` of state
- Writes acquire lock before mutation

## Rationale

### Why Copy-on-Write?

1. **Safety**: External code cannot mutate state directly
2. **Consistency**: Reads see consistent snapshots
3. **Simplicity**: No complex locking at call sites

### Why RLock?

Reentrant lock allows recursive calls within same thread (e.g., orchestrator calling back into state during same operation).

## Consequences

### Positive

- Thread-safe without requiring callers to manage locks
- Prevents accidental state corruption
- Clear ownership: StateStore owns all state mutations

### Negative

- Memory overhead from deep copies
- Not suitable for very large state objects

## Alternatives Considered

1. **Database (SQLite)**: Deferred to future phase - persistence is a feature
2. **Message queue**: Over-engineering for current scale
3. **Thread-local storage**: Would break shared state requirement