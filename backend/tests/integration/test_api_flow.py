"""Integration tests for API request flow.

These tests verify the complete request lifecycle from HTTP endpoint
through service layer to response.
"""

import pytest
from fastapi.testclient import TestClient

from backend.src.api.main import app


@pytest.fixture
def client():
    """Create test client with app."""
    return TestClient(app)


class TestHealthEndpoints:
    """Tests for health check endpoints."""

    def test_health_check_returns_healthy(self, client):
        """Health endpoint should return 200 with healthy status."""
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"


class TestRunsEndpoints:
    """Tests for runs/sessions API endpoints."""

    def test_create_session_with_valid_input(self, client):
        """Create session should accept valid input."""
        response = client.post(
            "/api/runs/sessions",
            json={
                "name": "test-session",
                "description": "Test session for integration test",
            },
        )
        # Should succeed with 201
        assert response.status_code == 201
        data = response.json()
        assert "session_id" in data
        assert data["name"] == "test-session"


class TestDependencyInjection:
    """Tests to verify dependency injection via factory."""

    def test_app_has_service_factory(self):
        """App should have service factory configured."""
        from backend.src.api.main import get_service_factory

        factory = get_service_factory()
        assert factory is not None

    def test_factory_provides_solver_service(self):
        """Factory should provide solver service."""
        from backend.src.api.main import get_service_factory

        factory = get_service_factory()
        solver = factory.solver_service
        assert solver is not None
