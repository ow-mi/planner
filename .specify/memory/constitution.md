<!--
Sync Impact Report
==================
Version change: 1.0.0 → 2.0.0 (MAJOR)
Modified principles: Complete rewrite - all 7 principles replaced
  - Old: Reactive UI Architecture (Alpine.js First) → New: Constraint-Driven Scheduling (NON-NEGOTIABLE)
  - Old: Component-First Design → New: Resource Integrity & Conflict Prevention
  - Old: Data-Driven Visualizations → New: Temporal Sequence Enforcement
  - Old: Progressive Enhancement → New: Priority-Aware Allocation
  - Old: Event-Driven Architecture → New: Dependency Resolution First
  - Old: Template-Based Configuration → New: Auditability & Traceability
  - Old: Performance & Optimization → New: Scalability & Performance
Added sections:
  - Domain Model Standards (Leg, Test, Equipment, FTE entities)
  - Scheduling Algorithm Requirements
  - Data Integrity & Validation Standards
  - Testing & Verification Requirements
Removed sections:
  - All Alpine.js-specific guidance
  - D3.js visualization requirements
  - UI component structure guidelines
Templates requiring updates:
  ✅ plan-template.md - Constitution Check section updated for scheduling domain
  ✅ spec-template.md - User stories should reference scheduling constraints
  ✅ tasks-template.md - Task categorization updated for resource allocation tasks
  ✅ agent-file-template.md - Updated for test planning domain
  ✅ checklist-template.md - Updated for scheduling validation checklist
Follow-up TODOs:
  - None - all placeholders resolved
-->

# Test Program Planner Constitution
<!-- Resource-constrained test scheduling system with multi-leg sequencing -->

## Core Principles

### I. Constraint-Driven Scheduling (NON-NEGOTIABLE)
All scheduling decisions MUST respect hard constraints: equipment exclusivity (one test at a time per equipment), FTE availability (no double-booking), and leg sequence enforcement (tests within a leg MUST execute in order). The system MUST reject or flag any schedule violating these constraints.

<!-- Rationale: Safety and resource integrity are paramount in test programs. A schedule that double-books critical equipment or violates sequence dependencies is not just suboptimal—it is invalid. -->

### II. Resource Integrity & Conflict Prevention
Equipment and FTE resources MUST be treated as non-shareable during test execution. The scheduling engine MUST detect and prevent all resource conflicts before schedule finalization. No schedule may be committed with unresolved conflicts.

<!-- Rationale: Physical equipment and personnel cannot be in two places simultaneously. Silent conflicts lead to missed deadlines and program delays. -->

### III. Temporal Sequence Enforcement
Tests within each leg MUST execute in their defined sequence. Predecessor completion gates successor start. The system MUST support explicit dependencies and implicit leg-level sequencing without exception.

<!-- Rationale: Test sequences often represent logical or safety dependencies (e.g., calibration before measurement, setup before execution). Out-of-order execution risks invalid results or hazardous conditions. -->

### IV. Priority-Aware Allocation
When constraints create scheduling contention, the system MUST apply user-defined leg priorities to resolve conflicts. Higher priority legs receive preferred time slots. Priority violations MUST be explicitly acknowledged and justified.

<!-- Rationale: Not all tests are equal—some are on the critical path for program milestones. Priority-based allocation ensures strategic objectives take precedence over convenience. -->

### V. Dependency Resolution First
All explicit and implicit dependencies MUST be resolved before scheduling begins. The system MUST construct a complete dependency graph (leg sequences + test dependencies) and validate it for cycles and unreachable nodes.

<!-- Rationale: Scheduling without complete dependency knowledge leads to invalid plans that require costly rework. Early validation prevents cascading schedule failures. -->

### VI. Auditability & Traceability
Every scheduling decision MUST be traceable to its inputs: constraints, priorities, dependencies, and resource availability. The system MUST record why each test was scheduled at its specific time and provide justification on demand.

<!-- Rationale: Test programs require accountability. When schedules slip or conflicts arise, stakeholders need to understand the reasoning behind allocations to negotiate changes effectively. -->

### VII. Scalability & Performance
The scheduling algorithm MUST handle programs with 100+ legs, 1000+ tests, and 50+ resource types without degradation. Solution quality (makespan, resource utilization) SHOULD be optimized within reasonable computation time.

<!-- Rationale: Real test programs are large. A scheduler that works for toy problems but fails on realistic program sizes is not production-ready. Performance ensures iterative planning remains practical. -->

## Domain Model Standards

### Core Entities

**Leg**: A logical grouping of tests representing a test phase or location.
- MUST have a unique identifier and human-readable name
- MUST have a user-defined priority (P0=critical, P1=high, P2=medium, P3=low)
- MUST define an ordered sequence of tests
- MAY have fixed dates or deadlines (hard constraints)

**Test**: An individual test activity requiring resources and time.
- MUST have a unique identifier and description
- MUST specify duration (minimum, typical, maximum)
- MUST specify required equipment types and quantities
- MUST specify required FTE roles and effort
- MUST belong to exactly one leg
- MAY have explicit dependencies on tests in other legs
- MAY have fixed start/end dates or deadline constraints

**Equipment**: Physical test apparatus with availability constraints.
- MUST have a unique identifier and type classification
- MUST define availability windows (working hours, maintenance periods)
- MUST enforce single-test-at-a-time constraint during test execution
- MAY have calibration requirements affecting availability

**FTE (Full-Time Equivalent)**: Human resource roles with capacity constraints.
- MUST define role type and skill requirements
- MUST define availability calendar (working hours, vacation, other commitments)
- MUST enforce no-overlap constraint during test execution
- MAY have multiple individuals fulfilling the same role

### Scheduling Output

**Schedule**: A valid assignment of start times to all tests.
- MUST satisfy all hard constraints (resources, sequences, fixed dates)
- MUST respect all priorities where constraint-compatible
- SHOULD optimize for: minimized makespan, maximized resource utilization, minimized priority inversions
- MUST be serializable to standard formats (JSON, CSV, Gantt-compatible)

## Development Standards

### Algorithm Requirements

The scheduling engine MUST implement:

1. **Constraint Validation Layer**: Verify all inputs are well-formed (no cycles, no impossible constraints)
2. **Feasibility Check**: Determine if a valid schedule exists before optimization
3. **Conflict Detection**: Identify and report all resource and temporal conflicts
4. **Resolution Strategy**: Apply priority rules and user preferences to resolve resolvable conflicts
5. **Optimization Pass**: Improve schedule quality (reduce gaps, balance load) without violating constraints

### Data Integrity & Validation

- All duration inputs MUST accept ranges (min/typical/max) with validation
- Equipment requirements MUST be validated against available inventory
- FTE requirements MUST be validated against staffing levels
- Date constraints MUST be validated for consistency (start < end, within availability windows)
- Priority values MUST be normalized and validated against defined scale

### Testing Requirements

- **Unit Tests**: Core scheduling algorithms (conflict detection, priority sorting, dependency resolution)
- **Integration Tests**: End-to-end scheduling with realistic program sizes
- **Constraint Tests**: Verify each constraint type is enforced (equipment conflict, FTE overlap, sequence violation)
- **Edge Cases**: Empty programs, single-test programs, fully constrained programs, over-constrained programs
- **Performance Tests**: 100+ legs, 1000+ tests benchmark

## Governance

### Amendment Process

Constitution changes require:

1. Documentation of the proposed change in `/docs/constitution-amendments/`
2. Impact analysis on existing scheduling algorithms and test programs
3. Migration plan for programs using deprecated principles
4. Approval from program management and technical lead

### Versioning Policy

- **MAJOR**: Breaking changes to scheduling constraints, domain model, or constraint enforcement rules
- **MINOR**: New scheduling features, optimization strategies, or supported constraint types
- **PATCH**: Bug fixes in constraint validation, performance improvements, documentation clarifications

### Compliance Review

All pull requests MUST include:

- Verification of constraint enforcement (no hard constraint violations)
- Unit test coverage for new scheduling logic
- Integration test with sample test program data
- Performance benchmark comparison (if algorithm changes)
- Documentation update for any new constraint types or configuration options

**Version**: 2.0.0 | **Ratified**: 2025-11-19 | **Last Amended**: 2026-02-12
