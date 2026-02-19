# Refactoring Plan - Test Planner V4 Solver

**Generated:** 2026-02-17  
**Approach:** Incremental, behavior-preserving refactoring with verification gates  
**Estimated Effort:** 12-18 hours

---

## Index

1. [System Understanding Report](#system-understanding-report)
2. [Initial Refactoring Plan](#initial-refactoring-plan)
3. [Validation Review](#validation-review)
4. [Final Refactoring Plan](#final-refactoring-plan)

---

## System Understanding Report

### Subsystems and Responsibilities

| Module | Type | Core Responsibility |
|--------|------|---------------------|
| `main.py` | Entry Point | Orchestration - coordinates entire planning pipeline |
| `data_loader.py` | Domain | Data loading, validation, and domain models |
| `model_builder.py` | Optimization | CP-SAT optimization model construction |
| `solver.py` | Execution | Solver execution and solution extraction |
| `config/` | Configuration | Configuration management and priority modes |
| `reports/` | Output | Generate CSV and HTML reports from solutions |
| `utils/` | Utilities | Supporting utilities and helpers |

### Data Flow

```
CSV Input Files
       │
       ▼
┌─────────────────┐
│  data_loader    │ ─── PlanningData (dataclass)
│  load_data()    │
└─────────────────┘
       │
       ▼
┌─────────────────┐
│  model_builder  │ ─── ScheduleModel (CP-SAT model)
│  build_model()  │
└─────────────────┘
       │
       ▼
┌─────────────────┐
│     solver      │ ─── SolutionResult
│  solve_model()  │
└─────────────────┘
       │
       ▼
┌─────────────────┐
│    reports      │ ─── CSV files + HTML report
│  generate_*()   │
└─────────────────┘
```

### Architectural Patterns

- **Dataclass Domain Models** - Domain objects for type safety (Leg, Test, PlanningData, etc.)
- **Pipeline Orchestration** - Sequential stages: load → build → solve → report
- **Strategy Pattern** - Multiple priority mode implementations with common base
- **Container/Model Pattern** - ScheduleModel encapsulates CP-SAT model and variables
- **Factory Pattern** - `create_priority_config()` for priority mode creation

### Coupling Issues

| ID | Severity | Issue | Location |
|---|---|---|---|
| 1 | HIGH | Circular import risk | `model_builder.py:392` |
| 2 | HIGH | Cross-module state sharing | `main.py:238, 580` |
| 3 | MEDIUM | Implicit dependency | `solver.py:45` |
| 4 | MEDIUM | Mixed responsibility function | `model_builder.py:261-359` |
| 5 | LOW | God function (200+ lines) | `main.py:130-333` |
| 6 | MEDIUM | Unused AppConfig | `config/settings.py:73-189` |

### Maintainability Risks (Priority Order)

| Priority | Risk | Impact |
|---|---|---|
| CRITICAL | Circular import vulnerability in model_builder | Any refactoring of data_loader breaks model_builder |
| HIGH | God function in main.py | Hard to test, modify, and understand |
| HIGH | Mixed resource constraints | Complex function, hard to modify |
| HIGH | Unused AppConfig code | Dead code creates confusion |
| MEDIUM | Duplicate week normalization | Potential inconsistency |
| MEDIUM | Encapsulation violation | Fragile if attributes change |
| MEDIUM | Duplicate config loading | Maintenance burden |
| MEDIUM | Inconsistent return types | Caller complexity |
| LOW | Duplicate CSV functions | Code duplication |
| LOW | Hard-coded column names | Error-prone schema changes |

---

## Initial Refactoring Plan

**6 Phases Proposed:**

1. **Foundation** - Resolve critical import issue (extract week utilities)
2. **Structure** - Split god function (main.py → orchestrator.py + cli.py)
3. **Constraints** - Separate mixed responsibilities (split add_resource_constraints)
4. **Consolidation** - Eliminate duplication
5. **Integrity** - Fix encapsulation issues
6. **Cleanup** - Remove dead code

**Initial Effort Estimate:** 8-13 hours

---

## Validation Review

### Critical Questions and Findings

| Q# | Question | Finding | Severity |
|---|---|---|---|
| Q1 | Entry point configuration verified? | No - could break package installation | MEDIUM |
| Q2 | Constant dependencies in week utils? | Missing WEEK_VALUE_RE from extraction list | LOW |
| Q3 | Are priority config loaders duplicates? | Unverified - different line counts suggest different functionality | HIGH |
| Q4 | Test coverage for model_builder? | Limited tests - risky to refactor without characterization tests | HIGH |
| Q5 | Is effort estimate accurate? | Underestimated - should be 12-18 hours | LOW |

### Discovered Weaknesses

| ID | Title | Phase Affected | Mitigation |
|---|---|---|---|
| W1 | Missing entry point verification | Phase 2 | Check pyproject.toml before Phase 2 |
| W2 | Missing constant dependency | Phase 1 | Explicitly list WEEK_VALUE_RE in tasks |
| W3 | Unverified duplication | Phase 4 | Compare implementations before consolidation |
| W4 | No test coverage strategy | Phase 3 | Add characterization tests first |
| W5 | Underestimated effort | All | Revise to 12-18 hours |

---

## Final Refactoring Plan

### Overview

| Phase | Name | Effort | Risk | Depends On |
|---|---|---|---|---|
| 0 | Verification & Test Foundation | 2-3h | LOW | - |
| 1 | Resolve Import Issue | 1-2h | LOW | Phase 0 |
| 2 | Split God Function | 2-4h | MEDIUM | Phase 0, 1 |
| 3 | Separate Constraints | 1-2h | LOW | Phase 0, 2 |
| 4 | Eliminate Duplication | 1-2h | LOW | Phase 0, 2 |
| 5 | Fix Encapsulation | 1-2h | LOW | Phase 2 |
| 6 | Remove Dead Code | 30m-1h | LOW | Phase 0 |
| 7 | Final Verification | 1h | N/A | All |

---

### Phase 0: Verification & Test Foundation

**Goal:** Verify current state and establish test safety net  
**Effort:** 2-3 hours | **Risk:** LOW

#### Tasks

- [x] **P0-1:** Verify package entry points configuration
  - Locate pyproject.toml or setup.py
  - Document current entry_points configuration
  - Identify which function is registered as console_script
  - Verify how `python -m planner_v4` works
  
- [x] **P0-2:** Generate baseline test outputs
  - Run solver on sample input
  - Save output CSVs as baseline
  - Document baseline generation command
  
- [x] **P0-3:** Add characterization tests for model_builder
  - Create `tests/test_model_builder_components.py`
  - Test `add_resource_constraints()` with sample data
  - Add assertions for expected constraint counts
  
- [x] **P0-4:** Compare priority config loading implementations
  - Read both implementations
  - Document differences in functionality
  - Determine if true duplication or different purposes

#### Success Criteria
- [x] Entry point configuration documented
- [x] Baseline output files exist
- [x] Characterization tests passing
- [x] Go/no-go decision for consolidation documented

---

### Phase 1: Resolve Critical Import Issue

**Goal:** Eliminate circular import vulnerability  
**Effort:** 1-2 hours | **Risk:** LOW | **Depends On:** Phase 0

#### Tasks

- [x] **P1-1:** Create `utils/week_utils.py` module
  - Move `WEEK_VALUE_RE` regex (`data_loader.py:247`)
  - Move `normalize_week_value()` function (`data_loader.py:267-314`)
  - Move `parse_iso_week()` function (`data_loader.py:317-329`)
  - Add module docstring and `__all__` exports
  
- [x] **P1-2:** Update imports in all consumers
  - Update `data_loader.py` to import from `utils.week_utils`
  - Replace function-level import in `model_builder.py:392`
  - Add top-level import

#### Files Affected
- `utils/week_utils.py` (NEW)
- `utils/__init__.py`
- `data_loader.py`
- `model_builder.py`

#### Success Criteria
- [x] All tests pass
- [x] No function-level imports in model_builder.py
- [x] Week normalization works identically
- [x] Baseline outputs unchanged

---

### Phase 2: Split God Function

**Goal:** Decompose main() into focused components  
**Effort:** 2-4 hours | **Risk:** MEDIUM | **Depends On:** Phase 0, 1

#### Tasks

- [x] **P2-1:** Create `orchestrator.py` module
  - Extract `run_planning_pipeline()` function
  - Move core orchestration logic from `main.py:130-333`
  
- [x] **P2-2:** Extract setup and config functions
  - Keep `setup_logging()` in main.py
  - Move/keep `load_priority_config_from_file()` based on P0-4 decision
  - Create `validate_input_folder()` helper if needed
  
- [x] **P2-3:** Refactor CLI structure
  - **Option A** (if cli() is NOT console_script entry):
    - Create `cli.py`
    - Move `cli()` from main.py
    - Update `pyproject.toml` entry_points
  - **Option B** (if cli() IS console_script entry):
    - Keep `cli()` in main.py
    - Move helpers to `cli_helpers.py`
    - Update `cli()` to call orchestrator
  
- [x] **P2-4:** Simplify main.py entry point
  - Reduce to ~30-50 lines
  - Keep only essential imports and entry logic

#### Files Affected
- `orchestrator.py` (NEW)
- `cli.py` or `cli_helpers.py` (NEW)
- `main.py`
- `pyproject.toml` (potentially)

#### Success Criteria
- [x] All tests pass
- [x] main.py reduced to ~50 lines
- [x] CLI works: `python -m planner_v4 --help`
- [x] Entry point configuration correct
- [x] Baseline outputs unchanged

---

### Phase 3: Separate Mixed Responsibilities

**Goal:** Split add_resource_constraints() into focused functions  
**Effort:** 1-2 hours | **Risk:** LOW | **Depends On:** Phase 0, 2

#### Precondition
⚠️ Characterization tests from P0-3 must pass before proceeding.

#### Tasks

- [x] **P3-0:** Verify characterization tests pass
  - Run `tests/test_model_builder_components.py`
  - If failing, fix tests or defer phase
  
- [x] **P3-1:** Create `add_resource_nonoverlap_constraints()`
  - Extract lines 261-290 from `add_resource_constraints()`
  - Add docstring explaining non-overlap constraint purpose
  
- [x] **P3-2:** Create `add_resource_availability_constraints()`
  - Extract lines 291-359
  - Add docstring explaining availability constraint purpose
  
- [x] **P3-3:** Update `build_model()` caller
  - Replace single call with two focused calls
  - Keep same order as original
  
- [x] **P3-4:** Deprecate old function
  - Mark `add_resource_constraints()` as deprecated OR
  - Keep as wrapper calling two new functions

#### Files Affected
- `model_builder.py`

#### Success Criteria
- [x] All tests pass
- [x] Characterization tests pass
- [x] Each function < 50 lines
- [x] Baseline outputs unchanged

---

### Phase 4: Eliminate Duplication

**Goal:** Remove code duplication  
**Effort:** 1-2 hours | **Risk:** LOW | **Depends On:** Phase 0, 2

#### Precondition
⚠️ P0-4 comparison must confirm safe consolidation. If P0-4 shows functional differences, skip consolidation tasks.

#### Tasks

- [x] **P4-0:** Verify P0-4 comparison results
  - Review comparison document
  - Go/no-go decision for consolidation
  
- [x] **P4-1:** Consolidate priority config loading *(OPTIONAL - only if P0-4 confirms)*
  - Merge missing functionality from main.py version
  - Remove `load_priority_config_from_file()` from main.py
  - Update callers to use `data_loader.load_priority_config()`
  
- [x] **P4-2:** Consolidate required files list
  - Define `REQUIRED_FILES` constant in `config/settings.py`
  - Remove duplicate from `data_loader.py`
  
- [x] **P4-3:** Template CSV report functions
  - Create `_generate_resource_usage_csv(resource_type, ...)` helper
  - Refactor `generate_fte_usage_csv()` to use helper
  - Refactor `generate_equipment_usage_csv()` to use helper

#### Files Affected
- `config/settings.py`
- `data_loader.py`
- `main.py`
- `orchestrator.py`
- `reports/csv_reports.py`

#### Success Criteria
- [x] All tests pass
- [x] Single source of truth for required files
- [x] Reduced code in csv_reports.py (~40 lines)
- [x] Baseline outputs unchanged

---

### Phase 5: Fix Encapsulation

**Goal:** Eliminate private attribute access  
**Effort:** 1-2 hours | **Risk:** LOW | **Depends On:** Phase 2

#### Tasks

- [x] **P5-1:** Add config_source parameter to priority configs
  - Add `config_source: str = None` to `BasePriorityConfig.__init__`
  - Update factory `create_priority_config()` signature
  - Replace `priority_config._config_source = ...` with proper parameter
  
- [x] **P5-2:** Standardize solve_model() return type
  - Add `start_date: Optional[date]` to `SolutionResult` dataclass
  - Update `extract_solution()` to populate start_date
  - Update callers to use `solution.start_date`

#### Files Affected
- `config/priority_modes.py`
- `solver.py`
- `main.py`
- `orchestrator.py`

#### Success Criteria
- [x] All tests pass
- [x] No `._*` attribute access outside class definitions
- [x] `SolutionResult.start_date` accessible
- [x] Baseline outputs unchanged

---

### Phase 6: Remove Dead Code

**Goal:** Remove unused AppConfig class  
**Effort:** 30 min - 1 hour | **Risk:** LOW | **Depends On:** Phase 0

#### Tasks

- [x] **P6-1:** Verify AppConfig is unused
  - Grep for `AppConfig` usage
  - Document all findings
  
- [x] **P6-2:** Remove AppConfig and related code
  - Remove `AppConfig` class from `settings.py`
  - Update `config/__init__.py` exports

#### Files Affected
- `config/settings.py`
- `config/__init__.py`

#### Success Criteria
- [x] All tests pass
- [x] No references to AppConfig
- [x] Config module exports correct

---

### Phase 7: Final Verification

**Goal:** Comprehensive verification  
**Effort:** 1 hour | **Risk:** N/A | **Depends On:** All phases

#### Tasks

- [x] **P7-1:** Run full test suite
  - `pytest tests/ -v`
  
- [x] **P7-2:** Verify output equivalence
  - Run solver on multiple test inputs
  - Compare all outputs with baselines
  
- [x] **P7-3:** Code quality check
  - `ruff check .` (if configured)
  - Verify all imports correct
  
- [x] **P7-4:** Documentation update
  - Update docstrings for new modules
  - Update AGENTS.md if architecture changed

#### Files Affected
- `AGENTS.md`
- Any new modules

#### Success Criteria
- [x] All tests pass
- [x] Outputs equivalent to baseline
- [x] No linting errors
- [x] Documentation updated

---

## Files Summary

### New Files Created
| File | Purpose |
|---|---|
| `utils/week_utils.py` | Week parsing utilities |
| `orchestrator.py` | Core planning pipeline |
| `cli.py` or `cli_helpers.py` | CLI utilities |
| `tests/test_model_builder_components.py` | Characterization tests |
| `tests/baseline/` | Baseline output directory |

### Modified Files
| File | Changes |
|---|---|
| `data_loader.py` | Remove week utilities, import from utils |
| `model_builder.py` | Import week_utils, split constraint function |
| `solver.py` | Add start_date to SolutionResult |
| `main.py` | Reduce to thin entry point |
| `config/settings.py` | Add REQUIRED_FILES, remove AppConfig |
| `config/priority_modes.py` | Add config_source parameter |
| `reports/csv_reports.py` | Template duplicate functions |
| `utils/__init__.py` | Export week_utils |
| `config/__init__.py` | Update exports |
| `pyproject.toml` | Update entry_points (if needed) |

---

## Behavior Preservation Guarantees

- All CLI interfaces unchanged
- All function signatures preserved (except deprecated ones)
- All outputs equivalent to baseline
- All existing tests pass at each phase
- No functional changes, only structural improvements

---

## Execution Checklist

Before starting each phase:

- [x] Verify previous phase completed successfully
- [x] All tests passing
- [x] Baseline outputs available for comparison
- [x] Git working tree clean (can create branch)

After completing each phase:

- [x] Run `pytest tests/`
- [x] Compare outputs with baseline
- [x] Commit changes with descriptive message
- [x] Update this plan with completion status
