# AGENTS.md - Developer Guide for Test Planner V4

## Build/Lint/Test Commands

```bash
# Run all tests
pytest

# Run single test file
pytest tests/test_scenario_overrides.py

# Run single test function
pytest tests/test_scenario_overrides.py::test_apply_scenario_overrides_respects_precedence_order

# Run tests with verbose output
pytest -v

# Install dependencies
pip install -r requirements.txt
```

## Code Style Guidelines

### Imports
- **Standard library** first (e.g., `import os`, `from datetime import date`)
- **Third-party** second (e.g., `import pandas as pd`, `from ortools.sat.python import cp_model`)
- **Local modules** last using **relative imports** (e.g., `from .data_loader import PlanningData`)
- Never use absolute imports for local code (no `from planner_v4.xxx`)

### Docstrings
- Use **Google-style docstrings** with Args/Returns/Raises/Example sections
- Every public function and class must have a docstring
- Include usage examples for complex functions

### Type Hints
- Use **type hints** for all function parameters and return values
- Use `typing` module for complex types (e.g., `Dict[str, Leg]`, `List[Test]`)
- Use `Optional[T]` for nullable values
- Use dataclasses for data structures (e.g., `@dataclass class Leg:`)

### Naming Conventions
- **Classes**: PascalCase (e.g., `SolutionResult`, `ResourceWindow`)
- **Functions/variables**: snake_case (e.g., `load_data`, `test_schedules`)
- **Constants**: UPPER_CASE (e.g., `SOLVER_TIME_LIMIT_SECONDS`, `DEFAULT_DEBUG_LEVEL`)
- **Private**: Prefix with underscore (e.g., `_resolve_assignment_override`)

### Code Structure
- Keep functions under 50 lines when possible
- Use data classes with `from dataclasses import dataclass`
- Return comprehensive error messages with context

### Error Handling
- Raise specific exceptions: `FileNotFoundError`, `ValueError`, `KeyError`
- Use logging for non-fatal warnings: `logger.warning()`, `logger.info()`
- Provide context in error messages with field names and values
- Handle edge cases explicitly (e.g., empty DataFrames, missing files)

### Data Validation
- Validate ISO week formats: `YYYY-Www.f` (e.g., "2024-W01.0")
- Use regex patterns for format validation
- Normalize legacy formats to canonical form
- Check referential integrity between related data

### File Structure
- Keep related functionality in modules (e.g., `data_loader.py`, `solver.py`)
- Tests live in `tests/` directory with `test_*.py` naming
- Examples in `examples/` directory
- Configuration in `config/` package

### Testing
- Use pytest fixtures and parametrize where appropriate
- Test file naming: `test_<feature>.py`
- Test function naming: `test_<description_of_behavior>`
- Use `tmp_path` fixture for temporary test data
- Import test targets with `sys.path.insert(0, ...)` at test module level
