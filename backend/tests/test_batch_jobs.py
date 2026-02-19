import csv
from datetime import datetime, timezone
from pathlib import Path

from fastapi.testclient import TestClient

from backend.src.api.main import app, get_factory
from backend.src.api.models.responses import (
    ExecutionStatusEnum,
    SolverExecution,
    SolverResults,
    SolverStatusEnum,
)


client = TestClient(app)


def _get_solver_service():
    """Get the current solver service instance from the factory."""
    return get_factory().solver_service


def _result_for_execution(execution_id: str, makespan: float) -> SolverResults:
    return SolverResults(
        execution_id=execution_id,
        status=SolverStatusEnum.OPTIMAL,
        makespan=makespan,
        test_schedule=[],
        resource_utilization={},
        output_files={"schedule.csv": "test_id,start_day\nT1,1"},
        solver_stats={"solve_time": 1.5, "objective_value": 42.0},
    )


def _write_required_inputs(folder: Path) -> None:
    (folder / "data_legs.csv").write_text("leg_id\nLEG-1\n", encoding="utf-8")
    (folder / "data_test.csv").write_text("test_id\nT1\n", encoding="utf-8")
    (folder / "data_fte.csv").write_text("fte_id\nF1\n", encoding="utf-8")
    (folder / "data_equipment.csv").write_text("equipment_id\nE1\n", encoding="utf-8")
    (folder / "data_test_duts.csv").write_text(
        "test_id,dut_id\nT1,D1\n", encoding="utf-8"
    )


def _create_session_and_import_folder(folder: Path) -> str:
    session_response = client.post(
        "/api/runs/sessions", json={"name": "Batch Session", "source": "ui_v2_exp"}
    )
    assert session_response.status_code == 201
    session_id = session_response.json()["session_id"]

    import_response = client.post(
        f"/api/runs/sessions/{session_id}/inputs/import-folder",
        json={"folder_path": str(folder)},
    )
    assert import_response.status_code == 200
    assert import_response.json()["status"] == "READY"
    return session_id


def test_batch_job_lifecycle_exposes_per_scenario_statuses(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    input_folder = tmp_path / "batch-session-inputs"
    input_folder.mkdir()
    _write_required_inputs(input_folder)

    executions_by_id = {}
    results_by_execution_id = {}

    def fake_create_execution(request):
        execution_id = f"exec-{len(executions_by_id) + 1}"
        execution = SolverExecution(
            execution_id=execution_id,
            status=ExecutionStatusEnum.PENDING,
            created_at=datetime.now(timezone.utc),
            queue_position=0,
        )
        executions_by_id[execution_id] = execution
        return execution

    solver_service = _get_solver_service()
    monkeypatch.setattr(
        solver_service,
        "create_execution",
        fake_create_execution,
    )
    monkeypatch.setattr(
        solver_service,
        "get_execution_status",
        lambda execution_id: executions_by_id.get(execution_id),
    )
    monkeypatch.setattr(
        solver_service,
        "get_execution_results",
        lambda execution_id: results_by_execution_id.get(execution_id),
    )

    session_id = _create_session_and_import_folder(input_folder)

    submit_response = client.post(
        "/api/batch/jobs",
        json={
            "session_id": session_id,
            "scenarios": [
                {
                    "name": "Scenario A",
                    "time_limit": 120,
                    "debug_level": "INFO",
                    "output_folder": "batch/scenario-a",
                },
                {
                    "name": "Scenario B",
                    "time_limit": 180,
                    "debug_level": "DEBUG",
                    "output_folder": "batch/scenario-b",
                },
            ],
        },
    )

    assert submit_response.status_code == 202
    submit_payload = submit_response.json()
    assert submit_payload["status"] == "PENDING"
    assert len(submit_payload["scenario_statuses"]) == 2
    assert submit_payload["scenario_statuses"][0]["scenario_name"] == "Scenario A"
    assert submit_payload["scenario_statuses"][1]["scenario_name"] == "Scenario B"

    batch_id = submit_payload["batch_id"]
    first_execution_id = submit_payload["scenario_statuses"][0]["execution_id"]
    second_execution_id = submit_payload["scenario_statuses"][1]["execution_id"]

    executions_by_id[first_execution_id].status = ExecutionStatusEnum.RUNNING
    executions_by_id[second_execution_id].status = ExecutionStatusEnum.COMPLETED
    results_by_execution_id[second_execution_id] = _result_for_execution(
        second_execution_id, makespan=14.0
    )

    status_response = client.get(f"/api/batch/jobs/{batch_id}/status")
    assert status_response.status_code == 200
    status_payload = status_response.json()
    assert status_payload["status"] == "RUNNING"
    assert len(status_payload["scenario_statuses"]) == 2
    assert status_payload["scenario_statuses"][0]["status"] == "RUNNING"
    assert status_payload["scenario_statuses"][1]["status"] == "COMPLETED"

    executions_by_id[first_execution_id].status = ExecutionStatusEnum.COMPLETED
    results_by_execution_id[first_execution_id] = _result_for_execution(
        first_execution_id, makespan=10.0
    )

    results_response = client.get(f"/api/batch/jobs/{batch_id}/results")
    assert results_response.status_code == 200
    results_payload = results_response.json()
    assert results_payload["batch_id"] == batch_id
    assert results_payload["status"] == "COMPLETED"
    assert len(results_payload["items"]) == 2
    assert results_payload["items"][0]["scenario_name"] == "Scenario A"
    assert results_payload["items"][0]["status"] == "COMPLETED"
    assert results_payload["items"][0]["results"]["execution_id"] == first_execution_id
    assert results_payload["items"][1]["scenario_name"] == "Scenario B"
    assert results_payload["items"][1]["status"] == "COMPLETED"
    assert len(results_payload["summary_artifacts"]) == 1
    summary_artifact = results_payload["summary_artifacts"][0]
    assert summary_artifact["artifact_name"] == "batch_summary.csv"
    assert summary_artifact["content_type"] == "text/csv"

    summary_path = Path(summary_artifact["artifact_path"])
    assert summary_path.exists()

    with summary_path.open("r", encoding="utf-8", newline="") as summary_file:
        rows = list(csv.DictReader(summary_file))

    assert len(rows) == 2
    assert rows[0]["scenario_id"] == results_payload["items"][0]["scenario_id"]
    assert rows[0]["scenario_name"] == "Scenario A"
    assert rows[0]["status"] == "COMPLETED"
    assert rows[0]["makespan"] == "10.0"
    assert rows[0]["objective_value"] == "42.0"
    assert rows[0]["solve_time_seconds"] == "1.5"
    assert rows[0]["scenario_results_endpoint"] == f"/api/results/{first_execution_id}"

    assert rows[1]["scenario_id"] == results_payload["items"][1]["scenario_id"]
    assert rows[1]["scenario_name"] == "Scenario B"
    assert rows[1]["status"] == "COMPLETED"
    assert rows[1]["scenario_results_endpoint"] == f"/api/results/{second_execution_id}"


def test_batch_status_and_results_return_404_for_unknown_batch():
    status_response = client.get("/api/batch/jobs/batch-unknown/status")
    assert status_response.status_code == 404

    results_response = client.get("/api/batch/jobs/batch-unknown/results")
    assert results_response.status_code == 404


def test_import_folder_normalizes_csv_content_for_batch_job(monkeypatch, tmp_path):
    captured_csv_files = []

    def fake_create_execution(request):
        captured_csv_files.append(request.csv_files)
        execution_id = f"exec-{len(captured_csv_files)}"
        return SolverExecution(
            execution_id=execution_id,
            status=ExecutionStatusEnum.PENDING,
            created_at=datetime.now(timezone.utc),
            queue_position=0,
        )

    solver_service = _get_solver_service()
    monkeypatch.setattr(
        solver_service,
        "create_execution",
        fake_create_execution,
    )

    folder = tmp_path / "canonical-folder"
    folder.mkdir()
    (folder / "data_legs.csv").write_text("\ufeffleg_id\r\nLEG-1\r\n", encoding="utf-8")
    (folder / "data_test.csv").write_text("test_id\r\nT1\r\n", encoding="utf-8")
    (folder / "data_fte.csv").write_text("fte_id\r\nF1\r\n", encoding="utf-8")
    (folder / "data_equipment.csv").write_text(
        "equipment_id\r\nE1\r\n", encoding="utf-8"
    )
    (folder / "data_test_duts.csv").write_text(
        "test_id,dut_id\r\nT1,D1\r\n", encoding="utf-8"
    )

    session_id = _create_session_and_import_folder(folder)

    submit_response = client.post(
        "/api/batch/jobs",
        json={
            "session_id": session_id,
            "scenarios": [{"name": "Scenario A", "time_limit": 120}],
        },
    )
    assert submit_response.status_code == 202
    assert len(captured_csv_files) == 1

    normalized_csv_files = captured_csv_files[0]
    assert set(normalized_csv_files.keys()) == {
        "data_legs.csv",
        "data_test.csv",
        "data_fte.csv",
        "data_equipment.csv",
        "data_test_duts.csv",
    }
    assert normalized_csv_files["data_legs.csv"] == "leg_id\nLEG-1\n"
    assert normalized_csv_files["data_test.csv"] == "test_id\nT1\n"


def test_import_session_inputs_returns_400_for_invalid_csv_bundle(tmp_path):
    folder = tmp_path / "missing-file-folder"
    folder.mkdir()
    (folder / "data_legs.csv").write_text("leg_id\nLEG-1\n", encoding="utf-8")
    (folder / "data_test.csv").write_text("test_id\nT1\n", encoding="utf-8")
    (folder / "data_fte.csv").write_text("fte_id\nF1\n", encoding="utf-8")
    (folder / "data_equipment.csv").write_text("equipment_id\nE1\n", encoding="utf-8")

    session_response = client.post(
        "/api/runs/sessions",
        json={"name": "Invalid Session", "source": "ui_v2_exp"},
    )
    assert session_response.status_code == 201
    session_id = session_response.json()["session_id"]

    import_response = client.post(
        f"/api/runs/sessions/{session_id}/inputs/import-folder",
        json={"folder_path": str(folder)},
    )

    assert import_response.status_code == 400
    assert (
        "Missing required file: data_test_duts.csv" in import_response.json()["detail"]
    )


def test_import_session_inputs_from_folder_returns_csv_bundle(tmp_path):
    folder = tmp_path / "session-inputs"
    folder.mkdir()
    _write_required_inputs(folder)
    (folder / "priority_config.json").write_text(
        '{"mode":"leg_end_dates","weights":{"makespan_weight":0.2,"priority_weight":0.8}}',
        encoding="utf-8",
    )

    session_response = client.post(
        "/api/runs/sessions",
        json={"name": "Folder Session", "source": "ui_v2_exp"},
    )
    assert session_response.status_code == 201
    session_id = session_response.json()["session_id"]

    import_response = client.post(
        f"/api/runs/sessions/{session_id}/inputs/import-folder",
        json={"folder_path": str(folder)},
    )

    assert import_response.status_code == 200
    payload = import_response.json()
    assert payload["status"] == "READY"
    assert payload["folder_path"] == str(folder)
    assert payload["has_inputs"] is True
    assert payload["file_count"] == 5
    assert set(payload["csv_files"].keys()) == {
        "data_legs.csv",
        "data_test.csv",
        "data_fte.csv",
        "data_equipment.csv",
        "data_test_duts.csv",
    }
    assert payload["priority_config"]["mode"] == "leg_end_dates"


def test_batch_submission_uses_imported_folder_for_io(monkeypatch, tmp_path):
    folder = tmp_path / "folder-io"
    folder.mkdir()
    _write_required_inputs(folder)

    captured_requests = []

    def fake_create_execution(request):
        captured_requests.append(request)
        return SolverExecution(
            execution_id="exec-io-1",
            status=ExecutionStatusEnum.PENDING,
            created_at=datetime.now(timezone.utc),
            queue_position=0,
        )

    solver_service = _get_solver_service()
    monkeypatch.setattr(
        solver_service,
        "create_execution",
        fake_create_execution,
    )

    session_response = client.post(
        "/api/runs/sessions",
        json={"name": "Folder Session", "source": "ui_v2_exp"},
    )
    assert session_response.status_code == 201
    session_id = session_response.json()["session_id"]

    import_response = client.post(
        f"/api/runs/sessions/{session_id}/inputs/import-folder",
        json={"folder_path": str(folder)},
    )
    assert import_response.status_code == 200

    submit_response = client.post(
        "/api/batch/jobs",
        json={
            "session_id": session_id,
            "scenarios": [{"name": "Scenario A", "time_limit": 120}],
        },
    )
    assert submit_response.status_code == 202
    assert len(captured_requests) == 1
    assert captured_requests[0].input_folder == str(folder)
    assert captured_requests[0].output_folder == str(folder)
