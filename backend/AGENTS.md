# AI Agent Instructions - Backend

Instructions for AI agents working on the Python/FastAPI backend.

---

## Build, Test, and Lint Commands

### Running Tests
```bash
# Run all tests
python -m pytest

# Run specific test file
python -m pytest tests/test_batch_jobs.py

# Run specific test function
python -m pytest tests/test_batch_jobs.py::test_batch_job_lifecycle_exposes_per_scenario_statuses

# Run with verbose output
python -m pytest -v

# Run with coverage
python -m pytest --cov=backend

# Run tests matching a pattern
python -m pytest -k "batch_job"
```

### Development Server
```bash
# Start FastAPI development server
python -c "from backend.src.api.main import app; import uvicorn; uvicorn.run(app, host='0.0.0.0', port=8000)"
```

### Linting and Formatting
```bash
# Lint with ruff
ruff check .

# Auto-fix lint issues
ruff check . --fix

# Format with black
black src/ tests/

# Type check with mypy (if configured)
mypy src/
```

---

## Code Style Guidelines

### Python (Backend)

**Imports:**
- Use absolute imports with the `backend` prefix: `from backend.src.api.models...`
- Group imports: stdlib first, third-party, then local modules
- Separate groups with blank lines

```python
import argparse
import os

from fastapi import FastAPI
from pydantic import BaseModel, Field

from backend.src.api.models.requests import SolverRequest
from backend.src.services.solver_service import solver_service
```

**Naming:**
- `snake_case` for variables, functions, modules
- `PascalCase` for classes (Pydantic models, exceptions)
- `UPPER_SNAKE_CASE` for constants
- Prefix private functions with `_`

**Type Hints:**
- Use type hints for function parameters and return types
- Use `Optional`, `List`, `Dict` from `typing` for Python <3.9

```python
from typing import Dict, Optional, List

def process_data(items: List[Dict[str, str]], limit: Optional[int] = None) -> Dict:
    """Process items and return results."""
    return {"count": len(items)}
```

**Pydantic Models:**
- All API request/response models use Pydantic BaseModel
- Use `Field()` with descriptions and validation constraints
- Use enums for constrained string values

```python
from pydantic import BaseModel, Field
from enum import Enum

class DebugLevel(str, Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"

class SolverRequest(BaseModel):
    time_limit: Optional[float] = Field(500.0, gt=0, description="Solver time limit")
    debug_level: Optional[DebugLevel] = Field(DebugLevel.INFO, description="Log level")
```

**Docstrings:**
- Use Google-style docstrings
- Include Args, Returns, Raises sections
- Document all public functions and classes

```python
def solve_model(model, data, time_limit=None):
    """Solve the CP-SAT optimization model.

    Args:
        model: The CP-SAT model instance
        data: Dictionary containing all planning data
        time_limit: Maximum solver time in seconds

    Returns:
        tuple: (solver, status, solve_time)

    Raises:
        RuntimeError: If solver fails to find a solution
    """
```

**Error Handling:**
- Use specific exception types (FileNotFoundError, ValueError, etc.)
- Provide meaningful error messages
- Log before raising exceptions
- Use FastAPI exception handlers for consistent API error responses

```python
if not os.path.exists(input_path):
    raise FileNotFoundError(f"Input folder not found: {input_path}")
```

### Testing

**Python Tests:**
- Use pytest with descriptive function names
- One test file per module in `tests/` directory
- Use fixtures for shared test data
- Use `monkeypatch` for mocking dependencies
- Import from `backend.src` not relative imports

```python
def test_load_data_valid_input():
    """Test data loading with valid CSV files."""
    from backend.src.utils import load_data
    data = load_data("fixtures/valid_input/")
    assert "tests" in data
    assert "resources" in data
```

### File Organization

```
backend/
  src/
    api/
      main.py         # FastAPI application entry
      routes/         # API route handlers
      models/         # Pydantic request/response models
    services/         # Business logic services
    utils/            # Helper utilities
  tests/              # Backend test files
```

---

## Technology Stack

- **Backend:** Python 3.8+, FastAPI, Pydantic, uvicorn
- **Solver:** Google OR-Tools, pandas
- **Testing:** pytest
- **Code Quality:** ruff (linting), black (formatting)
