import threading
from collections import deque
from copy import deepcopy
from typing import Dict, Optional

from .models import (
    BatchJobState,
    ExecutionState,
    ExecutionStatusEnum,
    InputSessionState,
    RunSessionState,
)


class StateStore:
    """Thread-safe state storage using copy-on-write reads.

    Writes are synchronized with an RLock, while reads return deep copies to
    avoid exposing mutable internals to callers.
    """

    def __init__(self):
        self._executions: Dict[str, ExecutionState] = {}
        self._run_sessions: Dict[str, RunSessionState] = {}
        self._input_sessions: Dict[str, InputSessionState] = {}
        self._batch_jobs: Dict[str, BatchJobState] = {}
        self._queue: deque[str] = deque()
        self._active_execution: Optional[str] = None
        self._lock = threading.RLock()

    def set_execution(self, execution: ExecutionState) -> None:
        with self._lock:
            self._executions[execution.execution_id] = execution

    def get_execution(self, execution_id: str) -> Optional[ExecutionState]:
        execution = self._executions.get(execution_id)
        return deepcopy(execution) if execution else None

    def update_execution_status(
        self,
        execution_id: str,
        status: ExecutionStatusEnum,
        **kwargs,
    ) -> None:
        with self._lock:
            if execution_id in self._executions:
                execution = self._executions[execution_id]
                execution.status = status
                for key, value in kwargs.items():
                    if hasattr(execution, key):
                        setattr(execution, key, value)

    def get_all_executions(self) -> Dict[str, ExecutionState]:
        return deepcopy(self._executions)

    def set_run_session(self, session: RunSessionState) -> None:
        with self._lock:
            self._run_sessions[session.session_id] = session

    def get_run_session(self, session_id: str) -> Optional[RunSessionState]:
        session = self._run_sessions.get(session_id)
        return deepcopy(session) if session else None

    def set_input_session(self, session: InputSessionState) -> None:
        with self._lock:
            self._input_sessions[session.session_id] = session

    def get_input_session(self, session_id: str) -> Optional[InputSessionState]:
        session = self._input_sessions.get(session_id)
        return deepcopy(session) if session else None

    def set_batch_job(self, job: BatchJobState) -> None:
        with self._lock:
            self._batch_jobs[job.job_id] = job

    def get_batch_job(self, job_id: str) -> Optional[BatchJobState]:
        job = self._batch_jobs.get(job_id)
        return deepcopy(job) if job else None

    def enqueue(self, execution_id: str) -> int:
        with self._lock:
            self._queue.append(execution_id)
            return len(self._queue)

    def dequeue(self) -> Optional[str]:
        with self._lock:
            if self._queue:
                return self._queue.popleft()
            return None

    def get_queue_size(self) -> int:
        return len(self._queue)

    def get_queue_position(self, execution_id: str) -> Optional[int]:
        with self._lock:
            try:
                return self._queue.index(execution_id) + 1
            except ValueError:
                return None

    def set_active_execution(self, execution_id: Optional[str]) -> None:
        with self._lock:
            self._active_execution = execution_id

    def get_active_execution(self) -> Optional[str]:
        return self._active_execution
