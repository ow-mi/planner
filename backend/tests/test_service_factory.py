"""Tests for ServiceFactory dependency injection."""

import pytest
from backend.src.services.factory import ServiceFactory
from backend.src.state import StateStore


def test_factory_creates_shared_state_store():
    """Factory should create and reuse single StateStore."""
    factory = ServiceFactory()

    store1 = factory.state_store
    store2 = factory.state_store

    assert store1 is store2
    assert isinstance(store1, StateStore)


def test_factory_injects_state_store_to_core_services():
    """Core services should share the same StateStore instance."""
    factory = ServiceFactory()

    # Access services
    queue = factory.queue_service
    solver = factory.solver_service
    orchestrator = factory.orchestrator

    # All should have same state_store
    assert queue._state_store is factory.state_store
    assert solver._state_store is factory.state_store
    assert orchestrator._state is factory.state_store


def test_factory_accepts_injected_state_store():
    """Factory should accept pre-created StateStore for testing."""
    custom_store = StateStore()
    factory = ServiceFactory(state_store=custom_store)

    assert factory.state_store is custom_store
    assert factory.queue_service._state_store is custom_store


def test_factory_lazy_initialization():
    """Services should only be created when accessed."""
    factory = ServiceFactory()

    # No services created yet
    assert factory._queue_service is None
    assert factory._solver_service is None

    # Access one service
    _ = factory.queue_service

    # That service is created, others still None
    assert factory._queue_service is not None
    assert factory._solver_service is None


def test_factory_creates_all_services():
    """Factory should be able to create all service types."""
    factory = ServiceFactory()

    # Access all managed services
    assert factory.state_store is not None
    assert factory.file_ops is not None
    assert factory.queue_service is not None
    assert factory.orchestrator is not None
    assert factory.solver_service is not None


def test_factory_services_share_core_dependencies():
    """Services should have consistent dependency wiring."""
    factory = ServiceFactory()

    # Get solver_service (which depends on orchestrator and queue)
    solver = factory.solver_service

    # Verify solver's dependencies match factory's instances
    assert solver._queue is factory.queue_service
    assert solver._orchestrator is factory.orchestrator
    assert solver._files is factory.file_ops


def test_multiple_factories_have_separate_state():
    """Different factory instances should have separate state."""
    factory1 = ServiceFactory()
    factory2 = ServiceFactory()

    assert factory1.state_store is not factory2.state_store
    assert factory1.queue_service is not factory2.queue_service


def test_solver_service_creates_session_and_batch_managers():
    """SolverService should internally create its session and batch managers."""
    factory = ServiceFactory()
    solver = factory.solver_service

    # SessionManager and BatchJobManager are created by SolverService
    assert solver._sessions is not None
    assert solver._batch is not None
