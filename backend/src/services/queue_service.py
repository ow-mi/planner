from typing import Dict, Optional

from backend.src.api.models.responses import SolverExecution
from backend.src.state import ExecutionState, ExecutionStatusEnum, StateStore
from backend.src.state.mappers import execution_state_to_response


class ExecutionQueueService:
    MAX_QUEUE_SIZE = 10

    def __init__(self, state_store: StateStore):
        if state_store is None:
            raise ValueError("state_store is required")
        self._state_store = state_store

    @property
    def active_execution(self) -> Optional[SolverExecution]:
        active_execution_id = self._state_store.get_active_execution()
        if not active_execution_id:
            return None

        execution_state = self._state_store.get_execution(active_execution_id)
        if not execution_state:
            return None

        return self._to_response(execution_state)

    def enqueue(self, execution: SolverExecution) -> int:
        """
        Add execution to queue. Returns queue position (0 for active/running, >0 for queued).
        Raises RuntimeError if queue is full.
        """
        # Cleanup old completed executions if needed (simplistic garbage collection)
        # For now, we just enforce queue limit on pending items

        if self._state_store.get_queue_size() >= self.MAX_QUEUE_SIZE:
            raise RuntimeError(
                f"Queue is full (max {self.MAX_QUEUE_SIZE} pending executions)"
            )

        execution_state = ExecutionState(
            execution_id=execution.execution_id,
            status=ExecutionStatusEnum(execution.status.value),
            created_at=execution.created_at,
            started_at=execution.started_at,
            completed_at=execution.completed_at,
            progress_percentage=execution.progress_percentage,
            elapsed_time_seconds=execution.elapsed_time_seconds,
            current_phase=execution.current_phase,
            error=execution.error.model_dump() if execution.error else None,
            results=execution.results.model_dump() if execution.results else None,
            queue_position=execution.queue_position,
        )
        self._state_store.set_execution(execution_state)

        if self._state_store.get_active_execution() is None:
            self._state_store.set_active_execution(execution.execution_id)
            self._state_store.update_execution_status(
                execution.execution_id,
                execution_state.status,
                queue_position=0,
            )
            return 0

        position = self._state_store.enqueue(execution.execution_id)
        self._state_store.update_execution_status(
            execution.execution_id,
            execution_state.status,
            queue_position=position,
        )
        return position

    def get_execution(self, execution_id: str) -> Optional[SolverExecution]:
        execution_state = self._state_store.get_execution(execution_id)
        if not execution_state:
            return None

        return self._to_response(execution_state)

    def complete_execution(self, execution_id: str):
        """
        Mark execution as complete (or failed/timeout) and prepare next execution.
        """
        active_execution_id = self._state_store.get_active_execution()
        if active_execution_id == execution_id:
            self._state_store.set_active_execution(None)
            execution_state = self._state_store.get_execution(execution_id)
            if execution_state:
                self._state_store.update_execution_status(
                    execution_id,
                    execution_state.status,
                    queue_position=None,
                )
            # We don't automatically start next here, the worker loop should pick it up
            # or we return the next one to start.

    def get_next_execution(self) -> Optional[SolverExecution]:
        """
        Get the next execution from the queue if no active execution.
        Sets the next execution as active.
        """
        if self._state_store.get_active_execution() is None:
            next_execution_id = self._state_store.dequeue()
            if not next_execution_id:
                return None

            self._state_store.set_active_execution(next_execution_id)
            next_execution_state = self._state_store.get_execution(next_execution_id)
            if not next_execution_state:
                return None

            self._state_store.update_execution_status(
                next_execution_id,
                next_execution_state.status,
                queue_position=0,
            )
            return self.get_execution(next_execution_id)
        return None

    def get_queue_status(self) -> Dict:
        return {
            "queue_size": self._state_store.get_queue_size(),
            "active_executions": 1 if self._state_store.get_active_execution() else 0,
            "total_executions": len(self._state_store.get_all_executions()),
            "max_queue_size": self.MAX_QUEUE_SIZE,
        }

    def _to_response(self, execution_state: ExecutionState) -> SolverExecution:
        execution_copy = execution_state

        if execution_copy.status == ExecutionStatusEnum.PENDING:
            active_execution_id = self._state_store.get_active_execution()
            if active_execution_id == execution_copy.execution_id:
                execution_copy.queue_position = 0
            else:
                execution_copy.queue_position = self._get_pending_queue_position(
                    execution_copy.execution_id
                )
        else:
            execution_copy.queue_position = None

        return execution_state_to_response(execution_copy)

    def _get_pending_queue_position(self, execution_id: str) -> Optional[int]:
        return self._state_store.get_queue_position(execution_id)
