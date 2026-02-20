import json
from datetime import datetime, timezone

from backend.src.api.models.requests import SolverRequest
from backend.src.api.models.responses import ExecutionStatusEnum, SolverExecution
from backend.src.services.queue_service import ExecutionQueueService
from backend.src.services.solver_service import SolverService
from backend.src.state import ExecutionState as InternalExecutionState
from backend.src.state import ExecutionStatusEnum as InternalExecutionStatusEnum
from backend.src.state import StateStore
from backend.src.utils.file_handler import FileHandler


def _valid_csv_files() -> dict[str, str]:
    return {
        "data_legs.csv": "leg_id\nLEG-1",
        "data_test.csv": "test_id\nT1",
        "data_fte.csv": "fte_id\nF1",
        "data_equipment.csv": "equipment_id\nE1",
        "data_test_duts.csv": "test_id,dut_id\nT1,D1",
    }


def test_create_run_artifact_workspace_uses_deterministic_layout(tmp_path):
    created_at = datetime(2026, 2, 10, 9, 8, 7, tzinfo=timezone.utc)

    paths = FileHandler.create_run_artifact_workspace(
        run_id="run-001",
        run_name="Nightly Batch",
        created_at=created_at,
        runs_root=str(tmp_path),
    )

    expected_run_root = tmp_path / "runs" / "20260210_090807_nightly_batch" / "run-001"

    assert paths["run_root"] == str(expected_run_root)
    assert paths["input_original"] == str(expected_run_root / "input_original")
    assert paths["input_effective"] == str(expected_run_root / "input_effective")
    assert paths["output"] == str(expected_run_root / "output")
    assert paths["plots"] == str(expected_run_root / "plots")
    assert paths["settings_used"] == str(expected_run_root / "settings_used.json")


def test_run_solver_persists_artifacts_under_contract(monkeypatch, tmp_path):
    state_store = StateStore()
    queue_service = ExecutionQueueService(state_store=state_store)
    service = SolverService(state_store=state_store, queue_service=queue_service)
    service._orchestrator._stop_event.set()

    execution = SolverExecution(
        execution_id="run-abc",
        status=ExecutionStatusEnum.PENDING,
        created_at=datetime(2026, 2, 10, 1, 2, 3, tzinfo=timezone.utc),
        queue_position=0,
    )

    request = SolverRequest(
        csv_files=_valid_csv_files(),
        priority_config={"mode": "makespan", "weights": {"makespan_weight": 1.0}},
        time_limit=120.0,
        debug_level="DEBUG",
        output_folder="batch-run",
    )

    service._state_store.set_execution(
        InternalExecutionState(
            execution_id=execution.execution_id,
            status=InternalExecutionStatusEnum.PENDING,
            created_at=execution.created_at,
            request_payload=request.model_dump(),
        )
    )

    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(
        "backend.src.services.execution_orchestrator.load_priority_config_from_dict",
        lambda config: config,
    )

    def _fake_solver(
        input_folder, output_folder, debug_level, time_limit, priority_config
    ):
        output_data_dir = tmp_path / output_folder / "data"
        output_plot_dir = tmp_path / output_folder / "plots"
        output_log_dir = tmp_path / output_folder / "logs"

        output_data_dir.mkdir(parents=True, exist_ok=True)
        output_plot_dir.mkdir(parents=True, exist_ok=True)
        output_log_dir.mkdir(parents=True, exist_ok=True)

        (output_data_dir / "schedule.csv").write_text(
            "test_id,start_day\nT1,1", encoding="utf-8"
        )
        (output_data_dir / "resource_utilization.csv").write_text(
            "r,v\nR1,1", encoding="utf-8"
        )
        (output_data_dir / "fte_usage.csv").write_text("d,v\n1,1", encoding="utf-8")
        (output_data_dir / "equipment_usage.csv").write_text(
            "d,v\n1,1", encoding="utf-8"
        )
        (output_data_dir / "concurrency_timeseries.csv").write_text(
            "d,v\n1,1", encoding="utf-8"
        )
        (output_plot_dir / "gantt.png").write_bytes(b"PNG")
        (output_log_dir / "solver.log").write_text("ok", encoding="utf-8")

        class _Solution:
            status = "OPTIMAL"
            makespan_days = 5
            test_schedules = []
            resource_utilization = {}
            solve_time_seconds = 0.1
            objective_value = 1

        return _Solution()

    monkeypatch.setattr(
        "backend.src.services.execution_orchestrator.planner_main", _fake_solver
    )
    monkeypatch.setattr(
        service._orchestrator._queue, "complete_execution", lambda _: None
    )

    service._run_solver(execution.execution_id)

    final_state = service._state_store.get_execution(execution.execution_id)
    assert final_state is not None

    run_root = tmp_path / "runs" / "20260210_010203_batch-run" / "run-abc"
    settings_path = run_root / "settings_used.json"

    assert final_state.status.value == ExecutionStatusEnum.COMPLETED.value
    assert (run_root / "input_original").exists()
    assert (run_root / "input_effective").exists()
    assert (run_root / "output").exists()
    assert (run_root / "plots").exists()
    assert settings_path.exists()
    assert (run_root / "solver_request_payload.json").exists()
    assert (run_root / "output" / "data" / "schedule.csv").exists()
    assert (run_root / "plots" / "gantt.png").exists()
    assert final_state.results is not None
    assert "solver_request_payload.json" in final_state.results["output_files"]

    with open(settings_path, "r", encoding="utf-8") as settings_file:
        settings = json.load(settings_file)
    assert settings["status"] == "COMPLETED"
    assert settings["run_id"] == "run-abc"
    assert settings["run_name"] == "batch-run"
