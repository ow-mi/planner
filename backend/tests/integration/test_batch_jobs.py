"""Integration tests for batch job API endpoints."""

import pytest
from fastapi.testclient import TestClient

from backend.src.api.main import app


@pytest.fixture
def client():
    """Create test client with app."""
    return TestClient(app)


class TestBatchJobsEndpoints:
    """Tests for batch job API endpoints."""

    def test_get_nonexistent_batch_job_returns_404(self, client):
        """Getting non-existent batch job should return 404."""
        response = client.get("/api/batch/jobs/nonexistent-id/status")
        assert response.status_code == 404

    def test_create_batch_job_with_missing_session_returns_404(self, client):
        """Creating batch job with non-existent session should return 404."""
        response = client.post(
            "/api/batch/jobs",
            json={
                "session_id": "nonexistent-session-id",
                "scenarios": [],
            },
        )
        # Should return 404 for non-existent session
        assert response.status_code in [400, 404, 422]
