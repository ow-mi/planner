"""Service factory for dependency injection.

This module provides a factory pattern for creating and managing service
instances. It replaces global singletons with explicit dependency injection,
enabling better testability and clearer dependency graphs.

Usage:
    from backend.src.services.factory import ServiceFactory

    factory = ServiceFactory()
    solver_service = factory.solver_service
"""

from typing import Optional

from backend.src.state import StateStore
from backend.src.services.queue_service import ExecutionQueueService
from backend.src.services.solver_service import SolverService
from backend.src.services.execution_orchestrator import ExecutionOrchestrator
from backend.src.services.file_operations_service import FileOperationsService


class ServiceFactory:
    """Factory for creating and managing service instances.

    Uses lazy initialization to create services on-demand. Core services
    share the same StateStore instance for consistency.

    Note: SessionManager and BatchJobManager are created internally by
    SolverService with appropriate callback wiring, so they are not
    directly managed by this factory.

    This pattern replaces global singletons with explicit dependency injection,
    making the application more testable and the dependency graph more transparent.

    Attributes:
        solver_service: The main solver service facade
        queue_service: The execution queue service
        orchestrator: The execution orchestrator
        state_store: The shared state storage
        file_ops: The file operations service

    Example:
        >>> factory = ServiceFactory()
        >>> service = factory.solver_service
        >>> result = service.create_run_session()

        # For testing with mock state:
        >>> mock_store = StateStore()
        >>> factory = ServiceFactory(state_store=mock_store)
    """

    def __init__(self, state_store: Optional[StateStore] = None):
        """Initialize the factory.

        Args:
            state_store: Optional StateStore instance. If not provided,
                        a new one will be created on first access.
        """
        self._state_store = state_store
        self._queue_service: Optional[ExecutionQueueService] = None
        self._solver_service: Optional[SolverService] = None
        self._orchestrator: Optional[ExecutionOrchestrator] = None
        self._file_ops: Optional[FileOperationsService] = None

    @property
    def state_store(self) -> StateStore:
        """Get the shared StateStore instance.

        Creates a new StateStore on first access if not provided
        during initialization.

        Returns:
            The shared StateStore instance.
        """
        if self._state_store is None:
            self._state_store = StateStore()
        return self._state_store

    @property
    def file_ops(self) -> FileOperationsService:
        """Get the file operations service.

        Returns:
            The FileOperationsService instance.
        """
        if self._file_ops is None:
            self._file_ops = FileOperationsService()
        return self._file_ops

    @property
    def queue_service(self) -> ExecutionQueueService:
        """Get the execution queue service.

        The queue service requires a StateStore, which is automatically
        provided from the factory's shared state_store.

        Returns:
            The ExecutionQueueService instance.
        """
        if self._queue_service is None:
            self._queue_service = ExecutionQueueService(state_store=self.state_store)
        return self._queue_service

    @property
    def orchestrator(self) -> ExecutionOrchestrator:
        """Get the execution orchestrator.

        The orchestrator coordinates solver execution, queue processing,
        and result handling.

        Returns:
            The ExecutionOrchestrator instance.
        """
        if self._orchestrator is None:
            self._orchestrator = ExecutionOrchestrator(
                state_store=self.state_store,
                file_ops=self.file_ops,
                queue_service=self.queue_service,
            )
        return self._orchestrator

    @property
    def solver_service(self) -> SolverService:
        """Get the main solver service facade.

        The solver service is the primary entry point for API routes,
        delegating to specialized services for queue, session, and batch
        management. It creates SessionManager and BatchJobManager internally
        with appropriate callback wiring.

        Returns:
            The SolverService instance.
        """
        if self._solver_service is None:
            self._solver_service = SolverService(
                state_store=self.state_store,
                queue_service=self.queue_service,
                orchestrator=self.orchestrator,
                file_ops=self.file_ops,
            )
        return self._solver_service
