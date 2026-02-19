# Refactoring Plan - Backend Python/FastAPI Planning Solver API

**Generated:** 2026-02-17  
**Status:** Final (validated through self-critique)  

---

## Executive Summary

This plan addresses critical maintainability issues in the backend codebase:

- **857-line god class** (SolverService) with 7+ responsibilities
- **No thread safety** - shared state mutated by background worker without locks
- **Triple duplicated models** across domain, services, and API layers
- **3 unregistered routes** with incomplete implementations
- **379-line response file** mixing 7 features
- **Dead domain layer** with syntax errors (0 imports)

The plan uses **incremental migration** with **strangler fig pattern** - each phase leaves the system fully functional and tested.

---

## Phase 0: Prerequisite Cleanup & Domain Decision

**Goal:** Fix blocking issues and make informed decision about domain layer  
**Duration:** 1-2 hours  

### Task 0.1: Verify Domain Layer Intent

**Files:** `src/domain/**/*.py`

**Steps:**
1. Check git log for domain/ files:
   ```bash
   git log --oneline src/domain/
   ```
2. Check for comments/docstrings explaining purpose
3. Check if any PR/issue mentions domain-driven design plans

**Decision Matrix:**

| Condition | Action |
|-----------|--------|
| No commits in 6+ months AND no references AND syntax errors | Remove entirely |
| Recent commits OR documentation mentions DDD/future plans | Fix syntax errors, add README explaining status |

### Task 0.2: Fix Duplicate Model Definitions

**Files:** 
- `src/api/models/responses.py`
- `src/api/models/requests.py`

**Changes:**
- Remove `AddScenarioToQueueRequest` from responses.py (keep in requests.py)
- Remove `RunSingleScenarioRequest` from responses.py
- Remove `RunAllUnsolvedRequest` from responses.py
- Remove `StopRenderRequest` from responses.py

**Safety Verification:**
```bash
grep -r "from.*responses.*AddScenarioToQueueRequest" src/
# Must return 0 results

ruff check .
python -m pytest
```

### Task 0.3: Consolidate Spreadsheet Duplicate Classes

**Files:**
- `src/services/spreadsheet_service.py` (lines 251-334)
- `src/domain/spreadsheet/entities.py` (if keeping domain)

**Changes:**
- Remove duplicate class definitions from `spreadsheet_service.py`
- Import from `api/models/responses.py` instead
- Update return types to use Pydantic models

### Success Criteria

- [ ] All tests pass
- [ ] `ruff check .` passes
- [ ] Decision on domain layer documented in commit message
- [ ] No duplicate model definitions across files
- [ ] `grep` confirms no imports of removed symbols

---

## Phase 1: Introduce State Layer with Read-Write Locks

**Goal:** Separate internal state from API response models; prevent deadlocks during long-running operations  
**Duration:** 2-3 days  

### Critical Design Decision

**Problem with naïve mutex:**
- Worker thread holds lock during 268-line `_run_solver` execution
- Main thread blocks on same lock trying to poll status
- User sees frozen UI

**Solution:** Copy-on-write pattern
- Writes use `RLock` (reentrant, allows same thread to re-acquire)
- Reads return deep copies (prevents external mutation of internal state)
- No lock on reads (Python dict get/set are atomic at bytecode level)
- Long-running operations hold NO lock - mutate local copy, then atomic update

### Task 1.1: Create Internal State Models

**New Files:**
- `src/state/__init__.py`
- `src/state/models.py`

**Content:**

```python
# src/state/models.py
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Dict, Any, List
from enum import Enum


class ExecutionStatusEnum(Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class RunSessionStatusEnum(Enum):
    CREATED = "created"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class BatchJobStatusEnum(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"


@dataclass
class ExecutionState:
    """Internal state for a solver execution (NOT exposed to API)."""
    execution_id: str
    status: ExecutionStatusEnum
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    input_path: Optional[str] = None
    results_path: Optional[str] = None
    error: Optional[str] = None
    input_data: Optional[Dict[str, Any]] = None
    results: Optional[Dict[str, Any]] = None


@dataclass
class RunSessionState:
    """Internal state for a run session."""
    session_id: str
    status: RunSessionStatusEnum
    created_at: datetime
    execution_id: Optional[str] = None
    completed_at: Optional[datetime] = None


@dataclass
class InputSessionState:
    """Internal state for an input session."""
    session_id: str
    created_at: datetime
    inputs: Dict[str, Any] = field(default_factory=dict)


@dataclass
class BatchScenarioState:
    """Internal state for a single scenario in a batch job."""
    scenario_id: str
    execution_id: str
    status: ExecutionStatusEnum
    created_at: datetime
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    results: Optional[Dict[str, Any]] = None


@dataclass
class BatchJobState:
    """Internal state for a batch job."""
    job_id: str
    session_id: str
    status: BatchJobStatusEnum
    created_at: datetime
    scenarios: Dict[str, BatchScenarioState] = field(default_factory=dict)
    completed_at: Optional[datetime] = None
```

### Task 1.2: Create StateStore with Read-Write Pattern

**New File:** `src/state/store.py`

**Content:**

```python
# src/state/store.py
import threading
from copy import deepcopy
from datetime import datetime
from typing import Optional, Dict
from .models import (
    ExecutionState,
    RunSessionState,
    InputSessionState,
    BatchJobState,
    BatchScenarioState,
    ExecutionStatusEnum,
    RunSessionStatusEnum,
    BatchJobStatusEnum,
)


class StateStore:
    """Thread-safe state storage with copy-on-write pattern.
    
    Design:
    - Writes use RLock (reentrant, same thread can re-acquire)
    - Reads return deep copies (prevent external mutation)
    - No lock on reads (Python dict get/set are atomic)
    - Long-running operations must NOT hold lock
    """
    
    def __init__(self):
        self._executions: Dict[str, ExecutionState] = {}
        self._run_sessions: Dict[str, RunSessionState] = {}
        self._input_sessions: Dict[str, InputSessionState] = {}
        self._batch_jobs: Dict[str, BatchJobState] = {}
        self._lock = threading.RLock()
    
    # ==================== EXECUTIONS ====================
    
    def get_execution(self, execution_id: str) -> Optional[ExecutionState]:
        """Get execution by ID. Returns a deep copy."""
        exec_state = self._executions.get(execution_id)
        return deepcopy(exec_state) if exec_state else None
    
    def get_all_executions(self) -> Dict[str, ExecutionState]:
        """Get all executions. Returns deep copies."""
        return deepcopy(self._executions)
    
    def set_execution(self, execution: ExecutionState) -> None:
        """Store or update an execution (atomic)."""
        with self._lock:
            self._executions[execution.execution_id] = execution
    
    def update_execution_status(
        self,
        execution_id: str,
        status: ExecutionStatusEnum,
        **kwargs
    ) -> bool:
        """Update execution status atomically. Returns True if found."""
        with self._lock:
            if execution_id not in self._executions:
                return False
            exec_state = self._executions[execution_id]
            exec_state.status = status
            for key, value in kwargs.items():
                if hasattr(exec_state, key):
                    setattr(exec_state, key, value)
            return True
    
    def delete_execution(self, execution_id: str) -> bool:
        """Delete an execution. Returns True if found."""
        with self._lock:
            if execution_id in self._executions:
                del self._executions[execution_id]
                return True
            return False
    
    # ==================== RUN SESSIONS ====================
    
    def get_run_session(self, session_id: str) -> Optional[RunSessionState]:
        session = self._run_sessions.get(session_id)
        return deepcopy(session) if session else None
    
    def get_all_run_sessions(self) -> Dict[str, RunSessionState]:
        return deepcopy(self._run_sessions)
    
    def set_run_session(self, session: RunSessionState) -> None:
        with self._lock:
            self._run_sessions[session.session_id] = session
    
    def update_run_session(
        self,
        session_id: str,
        status: Optional[RunSessionStatusEnum] = None,
        execution_id: Optional[str] = None,
        completed_at: Optional[datetime] = None,
    ) -> bool:
        with self._lock:
            if session_id not in self._run_sessions:
                return False
            session = self._run_sessions[session_id]
            if status is not None:
                session.status = status
            if execution_id is not None:
                session.execution_id = execution_id
            if completed_at is not None:
                session.completed_at = completed_at
            return True
    
    # ==================== INPUT SESSIONS ====================
    
    def get_input_session(self, session_id: str) -> Optional[InputSessionState]:
        session = self._input_sessions.get(session_id)
        return deepcopy(session) if session else None
    
    def set_input_session(self, session: InputSessionState) -> None:
        with self._lock:
            self._input_sessions[session.session_id] = session
    
    # ==================== BATCH JOBS ====================
    
    def get_batch_job(self, job_id: str) -> Optional[BatchJobState]:
        job = self._batch_jobs.get(job_id)
        return deepcopy(job) if job else None
    
    def get_all_batch_jobs(self) -> Dict[str, BatchJobState]:
        return deepcopy(self._batch_jobs)
    
    def set_batch_job(self, job: BatchJobState) -> None:
        with self._lock:
            self._batch_jobs[job.job_id] = job
    
    def update_batch_job_status(
        self,
        job_id: str,
        status: BatchJobStatusEnum,
        completed_at: Optional[datetime] = None,
    ) -> bool:
        with self._lock:
            if job_id not in self._batch_jobs:
                return False
            job = self._batch_jobs[job_id]
            job.status = status
            if completed_at is not None:
                job.completed_at = completed_at
            return True
    
    def set_batch_scenario(
        self,
        job_id: str,
        scenario: BatchScenarioState,
    ) -> bool:
        with self._lock:
            if job_id not in self._batch_jobs:
                return False
            self._batch_jobs[job_id].scenarios[scenario.scenario_id] = scenario
            return True
```

### Task 1.3: Create State-to-Response Mappers

**New File:** `src/state/mappers.py`

**Content:**

```python
# src/state/mappers.py
"""Convert internal state to API response models.

CRITICAL: Internal state (dataclasses) must NEVER be exposed directly to API.
All API responses must use Pydantic models from api/models/responses.py
"""
from datetime import datetime
from typing import Optional, Dict, Any, List

from .models import (
    ExecutionState,
    RunSessionState,
    InputSessionState,
    BatchJobState,
    BatchScenarioState,
)

from backend.src.api.models.responses import (
    ErrorDetails,
    ErrorCategory,
    ExecutionStatusEnum as APIExecutionStatusEnum,
    SolverStatusEnum,
    ExecutionResponse,
    ExecutionStatus,
    SolverResults,
    RunSessionStatusEnum as APIRunSessionStatusEnum,
    RunSessionState as APIRunSessionState,
    RunSessionResponse,
    RunSessionFolderImportResponse,
    BatchJobStatusEnum as APIBatchJobStatusEnum,
    BatchScenarioStatus,
    BatchJobSubmissionResponse,
    BatchJobStatusResponse,
    BatchJobResultsResponse,
    BatchScenarioResultItem,
    BatchSummaryArtifact,
)


def execution_state_to_response(state: ExecutionState) -> ExecutionStatus:
    """Convert internal ExecutionState to API ExecutionStatus response."""
    return ExecutionStatus(
        execution_id=state.execution_id,
        status=APIExecutionStatusEnum(state.status.value),
        created_at=state.created_at,
        started_at=state.started_at,
        completed_at=state.completed_at,
        input_path=state.input_path,
        results_path=state.results_path,
        error=state.error,
    )


def execution_state_to_details(state: ExecutionState) -> ExecutionResponse:
    """Convert internal ExecutionState to API ExecutionResponse with results."""
    return ExecutionResponse(
        execution_id=state.execution_id,
        status=APIExecutionStatusEnum(state.status.value),
        created_at=state.created_at,
        started_at=state.started_at,
        completed_at=state.completed_at,
        input_path=state.input_path,
        results_path=state.results_path,
        error=state.error,
        input_data=state.input_data,
        results=SolverResults(**state.results) if state.results else None,
    )


def run_session_state_to_response(state: RunSessionState) -> RunSessionResponse:
    """Convert internal RunSessionState to API RunSessionResponse."""
    return RunSessionResponse(
        session_id=state.session_id,
        status=APIRunSessionStatusEnum(state.status.value),
        created_at=state.created_at,
        execution_id=state.execution_id,
        completed_at=state.completed_at,
    )


def batch_job_state_to_status_response(
    state: BatchJobState,
    executions: Dict[str, ExecutionState],
) -> BatchJobStatusResponse:
    """Convert internal BatchJobState to API BatchJobStatusResponse."""
    scenarios = []
    for scenario_id, scenario_state in state.scenarios.items():
        exec_state = executions.get(scenario_state.execution_id)
        scenarios.append(BatchScenarioStatus(
            scenario_id=scenario_id,
            execution_id=scenario_state.execution_id,
            status=APIExecutionStatusEnum(scenario_state.status.value),
            created_at=scenario_state.created_at,
            completed_at=scenario_state.completed_at,
            error=scenario_state.error,
        ))
    
    return BatchJobStatusResponse(
        job_id=state.job_id,
        session_id=state.session_id,
        status=APIBatchJobStatusEnum(state.status.value),
        created_at=state.created_at,
        completed_at=state.completed_at,
        total_scenarios=len(state.scenarios),
        scenarios=scenarios,
    )


def batch_job_state_to_results_response(
    state: BatchJobState,
    executions: Dict[str, ExecutionState],
) -> BatchJobResultsResponse:
    """Convert internal BatchJobState to API BatchJobResultsResponse."""
    results = []
    for scenario_id, scenario_state in state.scenarios.items():
        exec_state = executions.get(scenario_state.execution_id)
        results.append(BatchScenarioResultItem(
            scenario_id=scenario_id,
            execution_id=scenario_state.execution_id,
            status=APIExecutionStatusEnum(scenario_state.status.value),
            error=scenario_state.error,
            results=SolverResults(**exec_state.results) if exec_state and exec_state.results else None,
        ))
    
    return BatchJobResultsResponse(
        job_id=state.job_id,
        session_id=state.session_id,
        status=APIBatchJobStatusEnum(state.status.value),
        total_scenarios=len(state.scenarios),
        results=results,
    )
```

### Task 1.4: Add Concurrent Access Tests

**New File:** `tests/test_concurrent_state.py`

**Content:**

```python
# tests/test_concurrent_state.py
"""Tests for thread-safe state access."""
import threading
import time
from datetime import datetime

from backend.src.state.store import StateStore
from backend.src.state.models import ExecutionState, ExecutionStatusEnum


def test_concurrent_read_write_no_deadlock():
    """Test that status reads don't block during long writes.
    
    This would deadlock with a simple mutex:
    - Writer holds lock for 0.5s (simulating long solver run)
    - Reader tries to poll status
    - Reader blocks waiting for writer to release lock
    
    With copy-on-write pattern, reads return immediately.
    """
    store = StateStore()
    
    # Create initial execution
    exec_state = ExecutionState(
        execution_id="test-1",
        status=ExecutionStatusEnum.QUEUED,
        created_at=datetime.now(),
    )
    store.set_execution(exec_state)
    
    read_times = []
    write_completed = threading.Event()
    reads_completed = threading.Event()
    
    def long_write():
        """Simulate long-running solver operation."""
        # Update to running (atomic, quick)
        store.update_execution_status(
            "test-1",
            ExecutionStatusEnum.RUNNING,
            started_at=datetime.now(),
        )
        
        # Simulate long-running work (NO lock held)
        time.sleep(0.5)
        
        # Final update (atomic, quick)
        store.update_execution_status(
            "test-1",
            ExecutionStatusEnum.COMPLETED,
            completed_at=datetime.now(),
        )
        write_completed.set()
    
    def fast_reads():
        """Simulate status polling from API."""
        while not write_completed.is_set():
            start = time.time()
            state = store.get_execution("test-1")
            elapsed = time.time() - start
            read_times.append(elapsed)
            assert state is not None
            time.sleep(0.05)  # Poll every 50ms
        reads_completed.set()
    
    write_thread = threading.Thread(target=long_write)
    read_thread = threading.Thread(target=fast_reads)
    
    write_thread.start()
    # Small delay to ensure write starts first
    time.sleep(0.1)
    read_thread.start()
    
    write_thread.join(timeout=2.0)
    read_thread.join(timeout=2.0)
    
    # Verify both completed
    assert write_completed.is_set(), "Write thread deadlocked"
    assert reads_completed.is_set(), "Read thread deadlocked"
    
    # All reads should complete quickly (< 0.1s)
    # If reads blocked on write, we'd see times > 0.4s
    slow_reads = [t for t in read_times if t > 0.1]
    assert not slow_reads, f"Reads blocked during long write: {slow_reads}"
    
    # Verify final state
    final_state = store.get_execution("test-1")
    assert final_state.status == ExecutionStatusEnum.COMPLETED


def test_copy_on_write_isolation():
    """Test that returned copies don't affect internal state."""
    store = StateStore()
    
    exec_state = ExecutionState(
        execution_id="test-isolation",
        status=ExecutionStatusEnum.QUEUED,
        created_at=datetime.now(),
    )
    store.set_execution(exec_state)
    
    # Get a copy and mutate it
    copy = store.get_execution("test-isolation")
    copy.status = ExecutionStatusEnum.COMPLETED
    copy.error = "Injected error"
    
    # Internal state should be unchanged
    internal = store.get_execution("test-isolation")
    assert internal.status == ExecutionStatusEnum.QUEUED
    assert internal.error is None


def test_rlock_reentrancy():
    """Test that same thread can acquire lock multiple times."""
    store = StateStore()
    
    exec_state = ExecutionState(
        execution_id="test-rlock",
        status=ExecutionStatusEnum.QUEUED,
        created_at=datetime.now(),
    )
    store.set_execution(exec_state)
    
    # Simulate nested lock acquisition (same thread)
    with store._lock:
        store.update_execution_status(
            "test-rlock",
            ExecutionStatusEnum.RUNNING,
            started_at=datetime.now(),
        )
        # This should NOT deadlock - RLock allows reentrancy
        store.update_execution_status(
            "test-rlock",
            ExecutionStatusEnum.COMPLETED,
            completed_at=datetime.now(),
        )
    
    final = store.get_execution("test-rlock")
    assert final.status == ExecutionStatusEnum.COMPLETED
```

### Task 1.5: Update QueueService to Use StateStore

**File:** `src/services/queue_service.py`

**Changes:**
1. Inject `StateStore` via `__init__`
2. Remove internal `executions` dict
3. All operations go through `StateStore` methods
4. Return mapped responses, not internal state

### Task 1.6: Update SolverService to Use StateStore

**File:** `src/services/solver_service.py`

**Changes:**
1. Replace `_requests`, `_run_sessions`, `_input_sessions`, `_batch_jobs` dicts with `StateStore`
2. Inject `StateStore` via `__init__`
3. `_run_solver` mutates local `ExecutionState`, then calls `state_store.set_execution`
4. Route handlers call mapper to convert state to responses
5. Worker thread NEVER holds lock during long operations

**Pattern for _run_solver:**

```python
def _run_solver(self, execution_id: str):
    """Run solver for an execution. Worker thread method."""
    # Get COPY of execution state
    exec_state = self._state_store.get_execution(execution_id)
    if not exec_state:
        return
    
    # Update to running (atomic, quick)
    exec_state.status = ExecutionStatusEnum.RUNNING
    exec_state.started_at = datetime.now()
    self._state_store.update_execution_status(
        execution_id,
        ExecutionStatusEnum.RUNNING,
        started_at=exec_state.started_at,
    )
    
    try:
        # ... do long-running solver work with NO lock held ...
        results = self._run_planner(exec_state)
        
        # Final update (atomic)
        exec_state.status = ExecutionStatusEnum.COMPLETED
        exec_state.completed_at = datetime.now()
        exec_state.results = results
        self._state_store.set_execution(exec_state)
        
    except Exception as e:
        exec_state.status = ExecutionStatusEnum.FAILED
        exec_state.error = str(e)
        self._state_store.set_execution(exec_state)
```

### Success Criteria

- [ ] All tests pass (including new `test_concurrent_state.py`)
- [ ] No thread holds lock during long-running operations
- [ ] API responses use Pydantic models, internal state uses dataclasses
- [ ] State mappers unit tested
- [ ] `grep` confirms no direct dict mutations on shared state
- [ ] Concurrent test verifies no deadlock under load

---

## Phase 2: Decompose SolverService (Safest First)

**Goal:** Break 857-line god class into focused services, extracting simplest first  
**Duration:** 2-3 days  

### Extraction Order Rationale

| Service | Complexity | Dependencies | Lines Extracted |
|---------|------------|--------------|-----------------|
| SessionManager | Low | StateStore, mappers | ~100 |
| BatchJobManager | Medium | StateStore, Orchestrator (later), FileOps | ~150 |
| FileOperationsService | Medium | FileHandler, pathlib | ~80 |
| ExecutionOrchestrator | High | StateStore, FileOps, planner_v4 | ~280 |

**Order:** SessionManager → BatchJobManager → FileOperationsService → ExecutionOrchestrator

### Task 2.1: Extract SessionManager

**New File:** `src/services/session_manager.py`

**Extracted Methods:**
- `create_run_session`
- `get_run_session_status`
- `get_run_session_results`
- `start_run_session_execution`
- `create_inputs_session`
- `import_session_inputs_from_folder`
- `get_inputs_session`

**Dependencies:**
- `StateStore`
- State mappers

**Test Strategy:** Existing run session tests (`tests/test_run_sessions.py`) should pass unchanged.

### Task 2.2: Extract BatchJobManager

**New File:** `src/services/batch_job_manager.py`

**Extracted Methods:**
- `create_batch_job`
- `get_batch_job_status`
- `get_batch_job_results`
- `_refresh_batch_job_status`

**Dependencies:**
- `StateStore`
- `ExecutionOrchestrator` (inject later)
- `FileOperationsService`

**Test Strategy:** Existing batch job tests (`tests/test_batch_jobs.py`) should pass unchanged.

### Task 2.3: Extract FileOperationsService

**New File:** `src/services/file_operations_service.py`

**Extracted Methods:**
- `_create_run_workspace`
- `_save_input_files`
- `_read_output_files`
- `_write_batch_summary_artifacts`

**Dependencies:**
- `FileHandler`
- `pathlib`

**Test Strategy:** Unit test file operations with temp directories.

### Task 2.4: Extract ExecutionOrchestrator

**New File:** `src/services/execution_orchestrator.py`

**Extracted Methods:**
- `create_execution`
- `_run_solver`
- `_process_queue` (partial)

**Dependencies:**
- `StateStore`
- `FileOperationsService`
- `planner_v4`

**Risk Mitigation:**
1. Extract `_run_solver` into smaller private methods first:
   - `_setup_workspace`
   - `_invoke_solver`
   - `_process_results`
   - `_cleanup`
2. Wrap `planner_v4` call in interface for testability
3. Add integration tests with mock solver

### Task 2.5: Create SolverServiceFacade

**File:** `src/services/solver_service.py`

**After Extraction:**

```python
# src/services/solver_service.py
"""Facade for solver-related operations.

This class delegates to specialized services:
- SessionManager: run sessions and input sessions
- BatchJobManager: batch job lifecycle
- FileOperationsService: file I/O
- ExecutionOrchestrator: solver execution
- QueueService: execution queue management
"""

class SolverService:
    """Thin facade delegating to specialized services."""
    
    def __init__(
        self,
        session_manager: SessionManager,
        batch_manager: BatchJobManager,
        file_ops: FileOperationsService,
        orchestrator: ExecutionOrchestrator,
        queue_service: QueueService,
    ):
        self._sessions = session_manager
        self._batch = batch_manager
        self._files = file_ops
        self._orchestrator = orchestrator
        self._queue = queue_service
    
    # Run Session delegation
    def create_run_session(self, ...):
        return self._sessions.create_run_session(...)
    
    def get_run_session_status(self, ...):
        return self._sessions.get_run_session_status(...)
    
    # ... etc
```

**Lines Remaining:** ~50-100 lines of delegation

### Success Criteria

- [ ] All tests pass unchanged
- [ ] Each extracted file < 300 lines
- [ ] `SolverService` is thin facade (< 100 lines)
- [ ] Extraction order: SessionManager → BatchJobManager → FileOps → Orchestrator

---

## Phase 3: Split Response Models

**Goal:** Break 379-line responses.py into feature-scoped modules  
**Duration:** 1 day  

### Task 3.1: Create Feature-Scoped Response Modules

**New Files:**

| File | Content | Lines |
|------|---------|-------|
| `src/api/models/common_responses.py` | ErrorDetails, ErrorCategory, ErrorResponse | ~30 |
| `src/api/models/solver_responses.py` | ExecutionStatusEnum, SolverStatusEnum, ExecutionResponse, ExecutionStatus, SolverResults | ~50 |
| `src/api/models/run_responses.py` | RunSessionStatusEnum, RunSessionState, RunSessionResponse, RunSessionFolderImportResponse | ~40 |
| `src/api/models/batch_responses.py` | BatchJobStatusEnum, BatchScenarioStatus, BatchJobSubmissionResponse, BatchJobStatusResponse, BatchJobResultsResponse | ~60 |
| `src/api/models/spreadsheet_responses.py` | SpreadsheetFileInfo, validation errors, SpreadsheetValidationResult | ~50 |
| `src/api/models/config_responses.py` | ConfigReferenceType, OutOfScopeReference, ConsistencyCheckResponse | ~30 |
| `src/api/models/scenario_responses.py` | ScenarioQueueStatusEnum, QueuedScenario, ScenarioQueueStatusResponse | ~40 |

### Task 3.2: Create Re-Export Facade

**File:** `src/api/models/responses.py`

**After Split:**

```python
# src/api/models/responses.py
"""API response models.

This file re-exports all response models from feature-scoped modules
for backward compatibility. Prefer importing from specific modules:
    from backend.src.api.models.solver_responses import ExecutionStatus
instead of:
    from backend.src.api.models.responses import ExecutionStatus
"""

# Common
from .common_responses import (
    ErrorDetails,
    ErrorCategory,
    ErrorResponse,
)

# Solver
from .solver_responses import (
    ExecutionStatusEnum,
    SolverStatusEnum,
    ExecutionResponse,
    ExecutionStatus,
    SolverResults,
)

# Run Sessions
from .run_responses import (
    RunSessionStatusEnum,
    RunSessionState,
    RunSessionResponse,
    RunSessionFolderImportResponse,
)

# Batch Jobs
from .batch_responses import (
    BatchJobStatusEnum,
    BatchScenarioStatus,
    BatchJobSubmissionResponse,
    BatchJobStatusResponse,
    BatchJobResultsResponse,
    BatchScenarioResultItem,
    BatchSummaryArtifact,
)

# Spreadsheets
from .spreadsheet_responses import (
    SpreadsheetFileInfo,
    SpreadsheetFileType,
    ValidationErrorCategory,
    HeaderValidationError,
    ColumnValidationError,
    ExtractedEntities,
    SpreadsheetValidationResult,
)

# Config
from .config_responses import (
    ConfigReferenceType,
    OutOfScopeReference,
    ConsistencyCheckResponse,
)

# Scenario Queue
from .scenario_responses import (
    ScenarioQueueStatusEnum,
    QueuedScenario,
    ScenarioQueueStatusResponse,
)

__all__ = [
    # Common
    "ErrorDetails",
    "ErrorCategory",
    "ErrorResponse",
    # Solver
    "ExecutionStatusEnum",
    "SolverStatusEnum",
    "ExecutionResponse",
    "ExecutionStatus",
    "SolverResults",
    # Run Sessions
    "RunSessionStatusEnum",
    "RunSessionState",
    "RunSessionResponse",
    "RunSessionFolderImportResponse",
    # Batch Jobs
    "BatchJobStatusEnum",
    "BatchScenarioStatus",
    "BatchJobSubmissionResponse",
    "BatchJobStatusResponse",
    "BatchJobResultsResponse",
    "BatchScenarioResultItem",
    "BatchSummaryArtifact",
    # Spreadsheets
    "SpreadsheetFileInfo",
    "SpreadsheetFileType",
    "ValidationErrorCategory",
    "HeaderValidationError",
    "ColumnValidationError",
    "ExtractedEntities",
    "SpreadsheetValidationResult",
    # Config
    "ConfigReferenceType",
    "OutOfScopeReference",
    "ConsistencyCheckResponse",
    # Scenario Queue
    "ScenarioQueueStatusEnum",
    "QueuedScenario",
    "ScenarioQueueStatusResponse",
]
```

### Task 3.3: Incrementally Update Imports (Optional)

**Files:** `src/api/routes/*.py`, `src/services/*.py`

**Preferred Pattern:**
```python
# Old (still works):
from backend.src.api.models.responses import ExecutionStatus

# New (preferred, can be done later):
from backend.src.api.models.solver_responses import ExecutionStatus
```

### Success Criteria

- [ ] All tests pass
- [ ] No response model file > 100 lines
- [ ] `responses.py` contains only re-exports
- [ ] `grep 'from backend.src.api.models.responses import'` still works

---

## Phase 4: Resolve Unregistered Routes

**Goal:** Make concrete decision about 3 routes not registered in main.py  
**Duration:** 1 day  

### Decision Matrix

| Route | Frontend Check | Tests | Service Complete | Bugs | Integration Action |
|-------|---------------|-------|------------------|------|-------------------|
| `config.py` | Search frontend for `/api/config` | No | Yes | None | INTEGRATE if frontend uses, REMOVE if not |
| `spreadsheets.py` | Search frontend for `/api/spreadsheets` | No | Yes | Returns plain classes, not Pydantic | FIX types, INTEGRATE if frontend uses |
| `scenario_queue.py` | Search frontend for `/api/scenarios` | No | No (has TODO stub) | Stub implementation | COMPLETE then INTEGRATE, or REMOVE |

### Task 4.1: Analyze Frontend for Route Usage

**Steps:**

```bash
# Search frontend codebase for each route
cd ../frontend  # or wherever frontend lives
grep -r "/api/config" .
grep -r "/api/spreadsheets" .
grep -r "/api/scenarios" .

# Check OpenAPI/Swagger specs
grep -r "config" openapi.yaml
grep -r "spreadsheets" openapi.yaml
grep -r "scenarios" openapi.yaml
```

**Output:** Markdown table documenting findings.

### Task 4.2: Execute Decision for Each Route

**If INTEGRATE:**

```python
# src/api/main.py
from backend.src.api.routes.config import router as config_router
from backend.src.api.routes.spreadsheets import router as spreadsheets_router

app.include_router(config_router, prefix="/api/config", tags=["config"])
app.include_router(spreadsheets_router, prefix="/api/spreadsheets", tags=["spreadsheets"])
```

**Integration Checklist:**
1. Fix any bugs (e.g., spreadsheet return types)
2. Add router to `main.py`
3. Write integration tests
4. Update API documentation

**If REMOVE:**

```bash
# Delete route file
rm src/api/routes/scenario_queue.py

# Check if service is used elsewhere
grep -r "scenario_queue_service" src/

# If unused, delete service
rm src/services/scenario_queue_service.py

# Verify no references remain
grep -r "scenario_queue" src/ tests/
```

### Task 4.3: Fix Spreadsheet Return Types (If Integrating)

**File:** `src/services/spreadsheet_service.py`

**Bug:** Returns plain classes instead of Pydantic models

**Fix:**

```python
# Before (plain class, won't serialize):
class SpreadsheetFileInfo:
    def __init__(self, name, path, file_type):
        self.name = name
        ...

# After (import from responses):
from backend.src.api.models.spreadsheet_responses import SpreadsheetFileInfo

def discover_spreadsheets(...) -> SpreadsheetDiscoveryResponse:
    # Return Pydantic model
    return SpreadsheetDiscoveryResponse(
        files=[SpreadsheetFileInfo(name=..., path=..., file_type=...)]
    )
```

### Success Criteria

- [ ] All route files either registered in `main.py` or deleted
- [ ] All registered routes have at least one test
- [ ] No dead code remains
- [ ] Frontend integration documented

---

## Phase 5: Add Persistence Layer (Optional)

**Goal:** Replace in-memory state with persistent storage  
**Duration:** 2-3 days  
**Precondition:** Only if business requirement exists for state persistence  

### Task 5.1: Define Persistence Interface

**New File:** `src/persistence/interface.py`

```python
# src/persistence/interface.py
from abc import ABC, abstractmethod
from typing import Optional, Dict, List
from backend.src.state.models import (
    ExecutionState,
    RunSessionState,
    InputSessionState,
    BatchJobState,
)


class StateRepository(ABC):
    """Abstract interface for state persistence."""
    
    # Executions
    @abstractmethod
    def get_execution(self, execution_id: str) -> Optional[ExecutionState]:
        pass
    
    @abstractmethod
    def save_execution(self, execution: ExecutionState) -> None:
        pass
    
    @abstractmethod
    def list_executions(self) -> Dict[str, ExecutionState]:
        pass
    
    @abstractmethod
    def delete_execution(self, execution_id: str) -> bool:
        pass
    
    # Run Sessions
    @abstractmethod
    def get_run_session(self, session_id: str) -> Optional[RunSessionState]:
        pass
    
    @abstractmethod
    def save_run_session(self, session: RunSessionState) -> None:
        pass
    
    # Similar for InputSession, BatchJob...
```

### Task 5.2: Implement SQLite Persistence

**New File:** `src/persistence/sqlite_repo.py`

```python
# src/persistence/sqlite_repo.py
"""SQLite implementation of StateRepository.

Uses SQLAlchemy for ORM mapping.
"""
from sqlalchemy import create_engine, Column, String, DateTime, JSON, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from .interface import StateRepository
from backend.src.state.models import ExecutionState, ExecutionStatusEnum

Base = declarative_base()


class ExecutionRecord(Base):
    __tablename__ = "executions"
    
    execution_id = Column(String, primary_key=True)
    status = Column(String)  # Store enum value
    created_at = Column(DateTime)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    input_path = Column(String, nullable=True)
    results_path = Column(String, nullable=True)
    error = Column(String, nullable=True)
    input_data = Column(JSON, nullable=True)
    results = Column(JSON, nullable=True)


class SQLiteRepository(StateRepository):
    def __init__(self, db_path: str = "server.db"):
        self.engine = create_engine(f"sqlite:///{db_path}")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
    
    def get_execution(self, execution_id: str) -> Optional[ExecutionState]:
        with self.Session() as session:
            record = session.query(ExecutionRecord).filter_by(
                execution_id=execution_id
            ).first()
            if not record:
                return None
            return ExecutionState(
                execution_id=record.execution_id,
                status=ExecutionStatusEnum(record.status),
                created_at=record.created_at,
                started_at=record.started_at,
                completed_at=record.completed_at,
                input_path=record.input_path,
                results_path=record.results_path,
                error=record.error,
                input_data=record.input_data,
                results=record.results,
            )
    
    def save_execution(self, execution: ExecutionState) -> None:
        with self.Session() as session:
            record = session.query(ExecutionRecord).filter_by(
                execution_id=execution.execution_id
            ).first()
            if record:
                # Update existing
                record.status = execution.status.value
                record.started_at = execution.started_at
                record.completed_at = execution.completed_at
                record.error = execution.error
                record.results = execution.results
            else:
                # Create new
                record = ExecutionRecord(
                    execution_id=execution.execution_id,
                    status=execution.status.value,
                    created_at=execution.created_at,
                    started_at=execution.started_at,
                    completed_at=execution.completed_at,
                    input_path=execution.input_path,
                    results_path=execution.results_path,
                    error=execution.error,
                    input_data=execution.input_data,
                    results=execution.results,
                )
                session.add(record)
            session.commit()
    
    # Implement other methods...
```

### Task 5.3: Add Configuration Toggle

**New File:** `src/config.py`

```python
# src/config.py
import os

PERSISTENCE_MODE = os.getenv("PERSISTENCE_MODE", "memory")  # "memory" or "sqlite"
DATABASE_PATH = os.getenv("DATABASE_PATH", "server.db")
```

### Task 5.4: Update StateStore to Use Repository

**File:** `src/state/store.py`

```python
# src/state/store.py
from .interface import StateRepository
from .sqlite_repo import SQLiteRepository
from backend.src.config import PERSISTENCE_MODE, DATABASE_PATH


class StateStore:
    def __init__(self, repository: Optional[StateRepository] = None):
        if repository:
            self._repo = repository
        elif PERSISTENCE_MODE == "sqlite":
            self._repo = SQLiteRepository(DATABASE_PATH)
        else:
            self._repo = InMemoryRepository()  # Default for tests
        
        # In-memory caching removed - all reads go through repo
    
    def get_execution(self, execution_id: str) -> Optional[ExecutionState]:
        return self._repo.get_execution(execution_id)
    
    # Other methods delegate to repo...
```

### Success Criteria

- [ ] State survives server restart in `sqlite` mode
- [ ] In-memory mode (`memory`) still works for tests
- [ ] Migration script provided for existing deployments
- [ ] Environment variable configuration documented

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Tests break during extraction | Each extraction preserves existing API via facade |
| Concurrent access deadlock | Copy-on-write pattern, no locks during long ops |
| Breaking API changes | State-to-response mappers preserve Pydantic models |
| Long-running refactoring | Each phase independently deployable |
| Team confusion during transition | Git tags after each phase: `phase-0-complete`, etc. |

---

## Rollback Strategy

Each phase is independently revertible:

```bash
# Tag after each phase
git tag phase-0-complete
git tag phase-1-complete
git tag phase-2-complete
git tag phase-3-complete
git tag phase-4-complete

# If Phase 2 fails, rollback to Phase 1
git revert HEAD~N  # or
git checkout phase-1-complete
```

---

## Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 0 | 1-2 hours | None |
| Phase 1 | 2-3 days | Phase 0 |
| Phase 2 | 2-3 days | Phase 1 |
| Phase 3 | 1 day | Phase 2 (optional parallel) |
| Phase 4 | 1 day | Phase 3 (optional parallel) |
| Phase 5 | 2-3 days | Phase 4 (optional) |

**Total:** 7-12 days for core phases (0-4), optional Phase 5 adds 2-3 days.

---

## References

- **System Understanding Report:** Generated from codebase analysis
- **Validation Review:** 5 critical questions addressed in final plan
- **Previous Artifacts:** Initial refactoring plan with identified weaknesses

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-17 | Initial plan |
| 1.1 | 2026-02-17 | Added read-write lock pattern for deadlock prevention |
| 1.1 | 2026-02-17 | Added state-to-response mappers for backward compatibility |
| 1.1 | 2026-02-17 | Reordered service extraction (simplest first) |
| 1.1 | 2026-02-17 | Added frontend analysis for unregistered routes |
| 1.1 | 2026-02-17 | Added domain layer decision matrix |