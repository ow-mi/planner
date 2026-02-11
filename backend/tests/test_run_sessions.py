from fastapi.testclient import TestClient

from backend.src.api.main import app
from backend.src.api.models.requests import SolverRequest
from backend.src.api.models.responses import (
    ExecutionStatusEnum,
    SolverExecution,
    SolverResults,
    SolverStatusEnum,
)
from backend.src.api.routes import solver as solver_routes


client = TestClient(app)


def _sample_results(execution_id: str) -> SolverResults:
    return SolverResults(
        execution_id=execution_id,
        status=SolverStatusEnum.OPTIMAL,
        makespan=12.0,
        test_schedule=[],
        resource_utilization={},
        output_files={"schedule.csv": "test_id,start_day\nT1,1"},
        solver_stats={"solve_time": 1.2, "objective_value": 42},
    )


def test_create_run_session_returns_created_state(monkeypatch):
    monkeypatch.setattr(
        solver_routes.solver_service,
        "create_run_session",
        lambda: {
            "run_id": "run-123",
            "status": "CREATED",
            "has_inputs": False,
            "execution_id": None,
        },
        raising=False,
    )

    response = client.post("/api/solver/runs")

    assert response.status_code == 201
    assert response.json() == {
        "run_id": "run-123",
        "status": "CREATED",
        "has_inputs": False,
        "execution_id": None,
        "execution_status": None,
    }


def test_upload_run_session_inputs_endpoint_is_removed():
    response = client.post(
        "/api/solver/runs/run-123/upload",
        json={
            "csv_files": {"data.csv": "id\n1"},
            "priority_config": {"mode": "makespan"},
        },
    )

    assert response.status_code == 404


def test_start_run_session_solver_creates_execution(monkeypatch):
    execution = SolverExecution(
        execution_id="exec-123",
        status=ExecutionStatusEnum.PENDING,
        created_at="2026-01-01T00:00:00Z",
        queue_position=1,
    )
    monkeypatch.setattr(
        solver_routes.solver_service,
        "start_run_session_execution",
        lambda run_id, request: execution,
        raising=False,
    )

    response = client.post(
        "/api/solver/runs/run-123/solve",
        json={"time_limit": 120.0, "debug_level": "INFO"},
    )

    assert response.status_code == 202
    assert response.json()["run_id"] == "run-123"
    assert response.json()["execution_id"] == "exec-123"
    assert response.json()["status"] == "PENDING"


def test_get_run_session_status_returns_composite_status(monkeypatch):
    monkeypatch.setattr(
        solver_routes.solver_service,
        "get_run_session_status",
        lambda run_id: {
            "run_id": run_id,
            "status": "RUNNING",
            "has_inputs": True,
            "execution_id": "exec-123",
            "execution_status": "RUNNING",
        },
        raising=False,
    )

    response = client.get("/api/solver/runs/run-123/status")

    assert response.status_code == 200
    payload = response.json()
    assert payload["run_id"] == "run-123"
    assert payload["status"] == "RUNNING"
    assert payload["execution_status"] == "RUNNING"


def test_get_run_session_results_returns_solver_results(monkeypatch):
    monkeypatch.setattr(
        solver_routes.solver_service,
        "get_run_session_status",
        lambda run_id: {
            "run_id": run_id,
            "status": "COMPLETED",
            "has_inputs": True,
            "execution_id": "exec-123",
            "execution_status": "COMPLETED",
        },
        raising=False,
    )
    monkeypatch.setattr(
        solver_routes.solver_service,
        "get_run_session_results",
        lambda run_id: _sample_results("exec-123"),
        raising=False,
    )

    response = client.get("/api/solver/runs/run-123/results")

    assert response.status_code == 200
    assert response.json()["execution_id"] == "exec-123"
    assert response.json()["status"] == "OPTIMAL"


def test_execute_endpoint_keeps_backward_compatibility(monkeypatch):
    execution = SolverExecution(
        execution_id="exec-legacy",
        status=ExecutionStatusEnum.PENDING,
        created_at="2026-01-01T00:00:00Z",
        queue_position=0,
    )
    monkeypatch.setattr(
        solver_routes.solver_service,
        "create_execution",
        lambda request: execution,
    )

    response = client.post(
        "/api/solver/execute",
        json=SolverRequest(
            csv_files={"data.csv": "id\n1"},
            priority_config={"mode": "makespan"},
            time_limit=120.0,
            debug_level="INFO",
        ).model_dump(),
    )

    assert response.status_code == 202
    payload = response.json()
    assert payload["execution_id"] == "exec-legacy"
    assert payload["status"] == "PENDING"
