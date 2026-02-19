# ADR-001: Service Factory Pattern for Dependency Injection

## Status

Accepted

## Context

The application initially used global singletons for service instances (`solver_service`, `queue_service`). This created several problems:

1. **Testing difficulty**: Tests couldn't easily swap implementations
2. **Hidden dependencies**: Services accessed private attributes of other services
3. **Circular dependencies**: Services created their own StateStore instances
4. **Encapsulation breaks**: Direct access to `_state_store` across module boundaries

## Decision

We implemented a **Service Factory pattern** (`src/services/factory.py`) instead of a full DI container library.

## Rationale

### Why Service Factory over DI Container?

- **Simplicity**: Only 7 services, stable dependency graph
- **No runtime overhead**: Lazy initialization only when needed
- **Testability**: Tests can create factory with mock StateStore
- **Explicit**: Dependencies visible in factory code

### Why Not Global Singletons?

- Made testing difficult
- Hidden dependencies complicated debugging
- Violated dependency injection principle

## Consequences

### Positive

- Clear dependency graph visible in factory
- Easy to test with custom StateStore
- Services created on-demand (lazy)
- Single StateStore ensures consistent state

### Negative

- Factory becomes a "god object" knowing all services
- Adding new services requires modifying factory

## Alternatives Considered

1. **Full DI Container (dependency-injector)**: Over-engineering for 7 services
2. **Manual wiring in main.py**: Less testable, harder to manage