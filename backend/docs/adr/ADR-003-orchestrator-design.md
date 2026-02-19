# ADR-003: ExecutionOrchestrator Internal Organization

## Status

Accepted

## Context

ExecutionOrchestrator is a 445-line class handling:
- Validation
- Queue Processing
- Solver Execution
- Result Processing
- Error Handling

An earlier refactoring plan proposed extracting ValidationService and ResultProcessingService.

## Decision

We chose **internal reorganization** over extraction into separate services.

## Rationale

### Why Not Extract Services?

An orchestrator's purpose is to **coordinate** multiple steps. Extracting all steps into separate services would leave the orchestrator as a thin pass-through:

```
Orchestrator:
    validate() → ValidationService.validate()
    execute() → ExecutionService.execute()  
    process() → ResultService.process()
```

This adds complexity without benefit.

### Why Section Headers?

- Logical grouping without artificial service boundaries
- Clear navigation in code
- Each section documented with purpose
- Easier to find related code

## Consequences

### Positive

- Orchestrator remains a cohesive unit
- No unnecessary service proliferation
- Clear code organization

### Negative

- Large file (445 lines) requires scrolling
- Could benefit from more inline documentation

## Alternatives Considered

1. **Extract ValidationService**: Would make orchestrator thin
2. **Extract ResultProcessingService**: No reuse benefit elsewhere
3. **Split into multiple orchestrators**: Would complicate coordination