# Backend Refactoring Implementation Plan

> **For Claude:** Use this plan to implement the refactoring task-by-task with TDD discipline.

**Goal:** Restructure the backend from a monolithic service into Clean Architecture with separated concerns, making it testable, maintainable, and extensible.

**Architecture:** Clean Architecture with domain, application, infrastructure, and API layers. Extract responsibilities from the 857-line `solver_service.py` into focused, single-responsibility services.

**Tech Stack:** FastAPI, Pydantic, Python asyncio

---

## Phase 1: Extract Domain Models

### Task 1: Create Domain Models - Execution

**Files:**
- Create: `backend/src/domain/__init__.py`
- Create: `backend/src/domain/models/__init__.py`
- Create: `backend/src/domain/models/execution.py`

**Step 1: Create the domain model**

```python
# backend/src/domain/models/execution.py
from datetime import datetime
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field
from enum import Enum


class ExecutionStatusEnum(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    TIMEOUT = "TIMEOUT"


class SolverStatusEnum(str, Enum):
    OPTIMAL = "OPTIMAL"
    FEASIBLE = "FEASIBLE"
    INFEASIBLE = "INFEASIBLE"
    NO_SOLUTION = "NO_SOLUTION"


@dataclass
class SolverExecution:
    execution_id: str
    status: ExecutionStatusEnum
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    progress_percentage: int = field(default=0)
    elapsed_time_seconds: float = 0.0
    current_phase: Optional[str] = None
    error: Optional[Any] = None
    results: Optional[Any] = None
    queue_position: Optional[int] = None
```

**Step 2: Verify the file was created**

Run: `ls -la backend/src/domain/models/`
Expected: Directory exists with __init__.py and execution.py

---

### Task 2: Create Domain Models - Session

**Files:**
- Create: `backend/src/domain/models/session.py`

**Step 1: Create session domain models**

```python
# backend/src/domain/models/session.py
from typing import Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum


class RunSessionStatusEnum(str, Enum):
    CREATED = "CREATED"
    READY = "READY"
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    TIMEOUT = "TIMEOUT"


@dataclass
class RunSessionRecord:
    run_id: str
    csv_files: Optional[Dict[str, str]] = None
    priority_config: Optional[Dict] = None
    execution_id: Optional[str] = None


@dataclass
class InputSessionRecord:
    session_id: str
    name: Optional[str] = None
    source: Optional[str] = None
    files: Optional[Dict[str, str]] = None
    base_folder: Optional[str] = None
    priority_config: Optional[Dict[str, Any]] = None
```

**Step 2: Verify**

Run: `python -c "from backend.src.domain.models.session import RunSessionRecord, InputSessionRecord; print('OK')"`

---

### Task 3: Create Domain Models - Batch

**Files:**
- Create: `backend/src/domain/models/batch.py`

**Step 1: Create batch domain models**

```python
# backend/src/domain/models/batch.py
from typing import Optional, List
from dataclasses import dataclass
from enum import Enum
from backend.src.domain.models.execution import ExecutionStatusEnum


class BatchJobStatusEnum(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


@dataclass
class BatchScenarioRecord:
    scenario_id: str
    scenario_name: str
    execution_id: str
    status: ExecutionStatusEnum
    error: Optional[str] = None


@dataclass
class BatchJobRecord:
    batch_id: str
    session_id: str
    status: BatchJobStatusEnum
    scenarios: List[BatchScenarioRecord]
```

**Step 2: Verify**

Run: `python -c "from backend.src.domain.models.batch import BatchJobRecord; print('OK')"`

---

### Task 4: Create Value Objects - Priority Config

**Files:**
- Create: `backend/src/domain/value_objects/__init__.py`
- Create: `backend/src/domain/value_objects/priority_config.py`

**Step 1: Create priority config validation**

```python
# backend/src/domain/value_objects/priority_config.py
from typing import Dict, Any, List


class PriorityConfigValidator:
    REQUIRED_FIELDS = ["mode"]
    VALID_MODES = ["leg_end_dates", "test_priority", "balanced"]
    
    @staticmethod
    def validate(config: Dict[str, Any]) -> List[str]:
        errors = []
        
        if "mode" not in config:
            errors.append("Missing 'mode' in priority config")
        elif config["mode"] not in PriorityConfigValidator.VALID_MODES:
            errors.append(f"Invalid mode: {config['mode']}")
        
        if "weights" in config:
            weights = config["weights"]
            for weight_key in ["makespan_weight", "priority_weight"]:
                if weight_key in weights:
                    w = weights[weight_key]
                    if not (0 <= w <= 1):
                        errors.append(f"{weight_key} must be between 0 and 1")
        
        return errors
```

---

## Phase 2: Create Application Services

### Task 5: Create Application Ports - Queue Port

**Files:**
- Create: `backend/src/application/ports/__init__.py`
- Create: `backend/src/application/ports/queue_port.py`

**Step 1: Define queue port interface**

```python
# backend/src/application/ports/queue_port.py
from typing import Optional, Protocol
from backend.src.domain.models.execution import SolverExecution


class QueuePort(Protocol):
    def enqueue(self, execution: SolverExecution) -> int: ...
    def get_execution(self, execution_id: str) -> Optional[SolverExecution]: ...
    def complete_execution(self, execution_id: str) -> None: ...
    def get_next_execution(self) -> Optional[SolverExecution]: ...
    def get_queue_status(self) -> dict: ...
    @property
    def active_execution(self) -> Optional[SolverExecution]: ...
```

---

### Task 6: Create Application Ports - Solver Port

**Files:**
- Create: `backend/src/application/ports/solver_port.py`

**Step 1: Define solver port interface**

```python
# backend/src/application/ports/solver_port.py
from typing import Protocol, Any, Dict
from backend.src.domain.models.execution import SolverExecution


class SolverPort(Protocol):
    def solve(
        self,
        input_folder: str,
        output_folder: str,
        debug_level: str,
        time_limit: float,
        priority_config: Any,
    ) -> Any: ...
```

---

### Task 7: Create Execution Service

**Files:**
- Create: `backend/src/application/services/__init__.py`
- Create: `backend/src/application/services/execution_service.py`

**Step 1: Create execution service**

```python
# backend/src/application/services/execution_service.py
import uuid
from datetime import datetime
from typing import Optional, Dict, Any

from backend.src.domain.models.execution import (
    SolverExecution,
    ExecutionStatusEnum,
    SolverStatusEnum,
)
from backend.src.domain.models.execution import SolverResults  # Will need to create
from backend.src.application.ports.queue_port import QueuePort
from backend.src.application.ports.solver_port import SolverPort
from backend.src.domain.value_objects.priority_config import PriorityConfigValidator


class ExecutionService:
    def __init__(self, queue: QueuePort, solver: SolverPort):
        self._queue = queue
        self._solver = solver
        self._requests: Dict[str, Dict[str, Any]] = {}

    def create_execution(self, request: Dict[str, Any]) -> SolverExecution:
        # Validate
        errors = []
        if "csv_files" in request:
            # Use validation utils
            pass
        
        priority_errors = PriorityConfigValidator.validate(request.get("priority_config", {}))
        if priority_errors:
            raise ValueError(f"Priority Config Validation Error: {'; '.join(priority_errors)}")

        execution_id = str(uuid.uuid4())
        execution = SolverExecution(
            execution_id=execution_id,
            status=ExecutionStatusEnum.PENDING,
            created_at=datetime.utcnow(),
        )
        self._requests[execution_id] = request
        self._queue.enqueue(execution)
        return execution

    def get_execution_status(self, execution_id: str) -> Optional[SolverExecution]:
        return self._queue.get_execution(execution_id)

    def get_execution_results(self, execution_id: str) -> Optional[SolverResults]:
        execution = self._queue.get_execution(execution_id)
        if execution and execution.status == ExecutionStatusEnum.COMPLETED:
            return execution.results
        return None

    def get_request_data(self, execution_id: str) -> Optional[Dict[str, Any]]:
        return self._requests.get(execution_id)
```

---

### Task 8: Create Session Service

**Files:**
- Create: `backend/src/application/services/session_service.py`

**Step 1: Create session service**

```python
# backend/src/application/services/session_service.py
import uuid
import os
from typing import Optional, Dict, Any

from backend.src.domain.models.session import (
    RunSessionRecord,
    InputSessionRecord,
    RunSessionStatusEnum,
)


class SessionService:
    def __init__(self):
        self._run_sessions: Dict[str, RunSessionRecord] = {}
        self._input_sessions: Dict[str, InputSessionRecord] = {}

    def create_run_session(self) -> RunSessionRecord:
        run_id = str(uuid.uuid4())
        session = RunSessionRecord(run_id=run_id)
        self._run_sessions[run_id] = session
        return session

    def get_run_session(self, run_id: str) -> Optional[RunSessionRecord]:
        return self._run_sessions.get(run_id)

    def create_input_session(
        self, name: Optional[str] = None, source: Optional[str] = None
    ) -> InputSessionRecord:
        session_id = str(uuid.uuid4())
        session = InputSessionRecord(
            session_id=session_id,
            name=name,
            source=source,
            files={},
        )
        self._input_sessions[session_id] = session
        return session

    def get_input_session(self, session_id: str) -> Optional[InputSessionRecord]:
        return self._input_sessions.get(session_id)
```

---

### Task 9: Create Batch Job Service

**Files:**
- Create: `backend/src/application/services/batch_job_service.py`

**Step 1: Create batch job service**

```python
# backend/src/application/services/batch_job_service.py
import uuid
from typing import List, Dict, Any, Optional

from backend.src.domain.models.batch import (
    BatchJobRecord,
    BatchScenarioRecord,
    BatchJobStatusEnum,
)
from backend.src.domain.models.execution import ExecutionStatusEnum
from backend.src.application.services.execution_service import ExecutionService


class BatchJobService:
    def __init__(self, execution_service: ExecutionService):
        self._execution_service = execution_service
        self._batch_jobs: Dict[str, BatchJobRecord] = {}

    def create_batch_job(
        self, session_id: str, scenarios: List[Dict[str, Any]]
    ) -> BatchJobRecord:
        scenario_records = []
        for scenario in scenarios:
            execution = self._execution_service.create_execution(scenario)
            scenario_records.append(
                BatchScenarioRecord(
                    scenario_id=str(uuid.uuid4()),
                    scenario_name=scenario.get("name", "unnamed"),
                    execution_id=execution.execution_id,
                    status=execution.status,
                )
            )

        batch_id = str(uuid.uuid4())
        batch_job = BatchJobRecord(
            batch_id=batch_id,
            session_id=session_id,
            status=BatchJobStatusEnum.PENDING,
            scenarios=scenario_records,
        )
        self._batch_jobs[batch_id] = batch_job
        return batch_job

    def get_batch_job(self, batch_id: str) -> Optional[BatchJobRecord]:
        return self._batch_jobs.get(batch_id)

    def refresh_batch_status(self, batch_id: str) -> BatchJobRecord:
        batch_job = self._batch_jobs.get(batch_id)
        if not batch_job:
            raise KeyError("Batch job not found")

        has_running = False
        has_failure = False
        all_completed = True

        for scenario in batch_job.scenarios:
            execution = self._execution_service.get_execution_status(scenario.execution_id)
            if execution:
                scenario.status = execution.status
                scenario.error = execution.error.message if execution.error else None

            if scenario.status == ExecutionStatusEnum.RUNNING:
                has_running = True
            elif scenario.status in (ExecutionStatusEnum.FAILED, ExecutionStatusEnum.TIMEOUT):
                has_failure = True
            if scenario.status != ExecutionStatusEnum.COMPLETED:
                all_completed = False

        if has_failure:
            batch_job.status = BatchJobStatusEnum.FAILED
        elif all_completed and batch_job.scenarios:
            batch_job.status = BatchJobStatusEnum.COMPLETED
        elif has_running:
            batch_job.status = BatchJobStatusEnum.RUNNING
        else:
            batch_job.status = BatchJobStatusEnum.PENDING

        return batch_job
```

---

## Phase 3: Refactor Infrastructure

### Task 10: Enhance Queue Infrastructure

**Files:**
- Modify: `backend/src/services/queue_service.py`

**Step 1: Refactor queue service**

Refactor to:
- Use proper state machine
- Add type hints
- Improve error handling

```python
# backend/src/infrastructure/queue/execution_queue.py
from typing import Optional, Dict
from collections import deque

from backend.src.domain.models.execution import SolverExecution, ExecutionStatusEnum
from backend.src.application.ports.queue_port import QueuePort


class ExecutionQueueService(QueuePort):
    MAX_QUEUE_SIZE = 10

    def __init__(self):
        self.queue: deque[SolverExecution] = deque()
        self.active_execution: Optional[SolverExecution] = None
        self.executions: Dict[str, SolverExecution] = {}

    # ... implement all QueuePort methods
```

---

## Phase 4: Wire Up API Layer

### Task 11: Update API Models

**Files:**
- Modify: `backend/src/api/models/responses.py`
- Modify: `backend/src/api/models/requests.py`

**Step 1: Update responses to import from domain**

```python
# Update imports in responses.py
from backend.src.domain.models.execution import (
    ExecutionStatusEnum,
    SolverStatusEnum,
    SolverExecution,
)
from backend.src.domain.models.session import RunSessionStatusEnum
from backend.src.domain.models.batch import BatchJobStatusEnum

# Keep API-specific responses here
```

---

### Task 12: Update Routes with Dependency Injection

**Files:**
- Modify: `backend/src/api/routes/solver.py`
- Modify: `backend/src/api/main.py`

**Step 1: Use dependency injection**

```python
# backend/src/api/routes/solver.py
from fastapi import APIRouter, Depends, HTTPException, status
from backend.src.application.services.execution_service import ExecutionService
from backend.src.application.services.session_service import SessionService


def get_execution_service() -> ExecutionService:
    # Get from app state
    pass


router = APIRouter()


@router.post("/runs/{run_id}/solve")
async def solve_run_session(
    run_id: str,
    request: RunSolveRequest,
    execution_service: ExecutionService = Depends(get_execution_service),
):
    # Use execution_service
    pass
```

---

## Phase 5: Final Polish

### Task 13: Add Configuration

**Files:**
- Create: `backend/src/shared/config.py`

**Step 1: Create config**

```python
# backend/src/shared/config.py
from pydantic_settings import BaseSettings


class BackendSettings(BaseSettings):
    max_queue_size: int = 10
    default_time_limit: float = 500.0
    cors_origins: list[str] = ["http://localhost:3000"]
    
    class Config:
        env_prefix = "BACKEND_"


settings = BackendSettings()
```

---

## Execution Options

**Plan complete.**

Two execution options:

1. **Subagent-Driven (this session)** - I dispatch a coder subagent for each task, review between tasks, fast iteration

2. **Parallel Execution** - You can start a new session and implement tasks in parallel

Which approach would you prefer?
