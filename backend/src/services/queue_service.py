from typing import Optional, Dict, List
from collections import deque
from backend.src.api.models.responses import SolverExecution, ExecutionStatusEnum

class ExecutionQueueService:
    MAX_QUEUE_SIZE = 10

    def __init__(self):
        self.queue: deque[SolverExecution] = deque()
        self.active_execution: Optional[SolverExecution] = None
        self.executions: Dict[str, SolverExecution] = {}

    def enqueue(self, execution: SolverExecution) -> int:
        """
        Add execution to queue. Returns queue position (0 for active/running, >0 for queued).
        Raises RuntimeError if queue is full.
        """
        # Cleanup old completed executions if needed (simplistic garbage collection)
        # For now, we just enforce queue limit on pending items
        
        if len(self.queue) >= self.MAX_QUEUE_SIZE:
            raise RuntimeError(f"Queue is full (max {self.MAX_QUEUE_SIZE} pending executions)")

        self.executions[execution.execution_id] = execution
        
        if self.active_execution is None:
            self.active_execution = execution
            execution.queue_position = 0
            return 0
        else:
            self.queue.append(execution)
            position = len(self.queue)
            execution.queue_position = position
            return position

    def get_execution(self, execution_id: str) -> Optional[SolverExecution]:
        execution = self.executions.get(execution_id)
        if execution:
             # Update queue position dynamically
             if execution.status == ExecutionStatusEnum.PENDING:
                 if self.active_execution and execution.execution_id == self.active_execution.execution_id:
                      execution.queue_position = 0
                 elif execution in self.queue:
                      execution.queue_position = self.queue.index(execution) + 1
             else:
                  execution.queue_position = None
        return execution

    def complete_execution(self, execution_id: str):
        """
        Mark execution as complete (or failed/timeout) and prepare next execution.
        """
        if self.active_execution and self.active_execution.execution_id == execution_id:
            self.active_execution = None
            # We don't automatically start next here, the worker loop should pick it up
            # or we return the next one to start.
            
    def get_next_execution(self) -> Optional[SolverExecution]:
        """
        Get the next execution from the queue if no active execution.
        Sets the next execution as active.
        """
        if self.active_execution is None and self.queue:
            next_execution = self.queue.popleft()
            self.active_execution = next_execution
            next_execution.queue_position = 0
            return next_execution
        return None

    def get_queue_status(self) -> Dict:
        return {
            "queue_size": len(self.queue),
            "active_executions": 1 if self.active_execution else 0,
            "total_executions": len(self.executions),
            "max_queue_size": self.MAX_QUEUE_SIZE
        }

# Global instance
queue_service = ExecutionQueueService()
