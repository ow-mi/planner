from datetime import date, datetime, timezone
import json
from pathlib import Path

from backend.src.api.models.requests import SolverRequest
from backend.src.api.models.responses import ExecutionStatusEnum, SolverExecution
from backend.src.services.execution_orchestrator import ExecutionOrchestrator
from backend.src.services.file_operations_service import FileOperationsService
from backend.src.state import (
    ExecutionState,
    ExecutionStatusEnum as StateExecutionStatusEnum,
)
from backend.src.state import StateStore


class _FakeQueueService:
    def __init__(self):
        self.completed_ids = []
        self._next_item = None

    @property
    def active_execution(self):
        return None

    def enqueue(self, execution: SolverExecution) -> int:
        self._next_item = execution
        return 0

    def complete_execution(self, execution_id: str) -> None:
        self.completed_ids.append(execution_id)

    def get_next_execution(self):
        item = self._next_item
        self._next_item = None
        return item


def _build_request(
    output_folder: str | None = None,
    input_folder: str | None = None,
    debug_level: str = "INFO",
):
    return SolverRequest(
        csv_files={
            "data_legs.csv": "leg_id\nLEG-1",
            "data_test.csv": "test_id\nT1",
            "data_fte.csv": "fte_id\nF1",
            "data_equipment.csv": "equipment_id\nE1",
            "data_test_duts.csv": "test_id,dut_id\nT1,D1",
        },
        priority_config={"mode": "makespan", "weights": {"makespan_weight": 1.0}},
        debug_level=debug_level,
        output_folder=output_folder,
        input_folder=input_folder,
    )


def _build_json_input_request():
    return SolverRequest(
        input_data={
            "schema_version": "1.0",
            "tables": {
                "legs": {"headers": ["leg_id"], "rows": [["LEG-1"]]},
                "tests": {"headers": ["test_id"], "rows": [["T1"]]},
                "fte": {"headers": ["fte_id"], "rows": [["F1"]]},
                "equipment": {"headers": ["equipment_id"], "rows": [["E1"]]},
                "test_duts": {
                    "headers": ["test_id", "dut_id"],
                    "rows": [["T1", "D1"]],
                },
            },
        },
        priority_config={"mode": "makespan", "weights": {"makespan_weight": 1.0}},
        output_folder=None,
        input_folder=None,
    )


def test_create_execution_enqueues_and_persists_request_payload():
    state_store = StateStore()
    queue = _FakeQueueService()
    orchestrator = ExecutionOrchestrator(
        state_store=state_store,
        file_ops=FileOperationsService(),
        queue_service=queue,
    )

    execution = orchestrator.create_execution(_build_request())

    assert execution.status == ExecutionStatusEnum.PENDING
    assert execution.queue_position == 0
    persisted = state_store.get_execution(execution.execution_id)
    assert persisted is not None
    assert persisted.request_payload is not None


def test_create_execution_accepts_json_input_tables_and_persists_csv_bundle():
    state_store = StateStore()
    queue = _FakeQueueService()
    orchestrator = ExecutionOrchestrator(
        state_store=state_store,
        file_ops=FileOperationsService(),
        queue_service=queue,
    )

    execution = orchestrator.create_execution(_build_json_input_request())

    persisted = state_store.get_execution(execution.execution_id)
    assert persisted is not None
    assert persisted.request_payload is not None
    payload_csv_files = persisted.request_payload.get("csv_files") or {}
    assert set(payload_csv_files.keys()) == {
        "data_legs.csv",
        "data_test.csv",
        "data_fte.csv",
        "data_equipment.csv",
        "data_test_duts.csv",
    }


def test_run_solver_uses_injected_solver_runner(monkeypatch, tmp_path):
    state_store = StateStore()
    queue = _FakeQueueService()
    seen_calls = []

    def fake_solver_runner(**kwargs):
        seen_calls.append(kwargs)

        class _Solution:
            status = "OPTIMAL"
            makespan_days = 2
            test_schedules = []
            resource_utilization = {}
            solve_time_seconds = 0.1
            objective_value = 1

        return _Solution()

    orchestrator = ExecutionOrchestrator(
        state_store=state_store,
        file_ops=FileOperationsService(),
        queue_service=queue,
        solver_runner=fake_solver_runner,
    )
    monkeypatch.setattr(
        "backend.src.services.execution_orchestrator.load_priority_config_from_dict",
        lambda config: config,
    )

    request = _build_request(
        output_folder=str(tmp_path / "output"),
        input_folder=str(tmp_path / "input"),
    )
    (tmp_path / "input").mkdir(parents=True, exist_ok=True)

    execution_id = "exec-injected"
    state_store.set_execution(
        ExecutionState(
            execution_id=execution_id,
            status=StateExecutionStatusEnum.PENDING,
            created_at=datetime(2026, 2, 17, tzinfo=timezone.utc),
            request_payload=request.model_dump(),
        )
    )

    orchestrator.run_solver(execution_id)

    final_state = state_store.get_execution(execution_id)
    assert final_state is not None
    assert final_state.status == StateExecutionStatusEnum.COMPLETED
    assert final_state.results is not None
    assert seen_calls
    assert queue.completed_ids == [execution_id]


def test_run_solver_honors_cancellation_request_before_start(monkeypatch, tmp_path):
    state_store = StateStore()
    queue = _FakeQueueService()

    def fake_solver_runner(**kwargs):
        raise AssertionError("solver should not run when cancellation is requested")

    orchestrator = ExecutionOrchestrator(
        state_store=state_store,
        file_ops=FileOperationsService(),
        queue_service=queue,
        solver_runner=fake_solver_runner,
    )
    monkeypatch.setattr(
        "backend.src.services.execution_orchestrator.load_priority_config_from_dict",
        lambda config: config,
    )

    request = _build_request(
        output_folder=str(tmp_path / "output"),
        input_folder=str(tmp_path / "input"),
    )
    (tmp_path / "input").mkdir(parents=True, exist_ok=True)

    execution_id = "exec-cancelled"
    state_store.set_execution(
        ExecutionState(
            execution_id=execution_id,
            status=StateExecutionStatusEnum.PENDING,
            created_at=datetime(2026, 2, 17, tzinfo=timezone.utc),
            request_payload=request.model_dump(),
        )
    )

    request_state = orchestrator.request_cancellation(execution_id)
    assert request_state == "accepted"

    orchestrator.run_solver(execution_id)

    final_state = state_store.get_execution(execution_id)
    assert final_state is not None
    assert final_state.status == StateExecutionStatusEnum.CANCELLED
    assert final_state.progress_data is not None
    assert "checkpoint" in final_state.progress_data
    assert queue.completed_ids == [execution_id]


def test_run_solver_saves_debug_request_payload_before_solver_starts(monkeypatch, tmp_path):
    state_store = StateStore()
    queue = _FakeQueueService()
    seen_calls = []
    output_dir = tmp_path / "output"
    input_dir = tmp_path / "input"
    input_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    def fake_solver_runner(**kwargs):
        seen_calls.append(kwargs)
        payload_path = Path(kwargs["output_folder"]) / "solver_request_payload.json"
        assert payload_path.exists()
        payload = json.loads(payload_path.read_text(encoding="utf-8"))
        assert payload.get("debug_level") == "DEBUG"

        class _Solution:
            status = "OPTIMAL"
            makespan_days = 2
            test_schedules = []
            resource_utilization = {}
            solve_time_seconds = 0.1
            objective_value = 1

        return _Solution()

    orchestrator = ExecutionOrchestrator(
        state_store=state_store,
        file_ops=FileOperationsService(),
        queue_service=queue,
        solver_runner=fake_solver_runner,
    )
    monkeypatch.setattr(
        "backend.src.services.execution_orchestrator.load_priority_config_from_dict",
        lambda config: config,
    )

    request = _build_request(
        output_folder=str(output_dir),
        input_folder=str(input_dir),
        debug_level="DEBUG",
    )

    execution_id = "exec-debug-payload"
    state_store.set_execution(
        ExecutionState(
            execution_id=execution_id,
            status=StateExecutionStatusEnum.PENDING,
            created_at=datetime(2026, 2, 17, tzinfo=timezone.utc),
            request_payload=request.model_dump(),
        )
    )

    orchestrator.run_solver(execution_id)

    final_state = state_store.get_execution(execution_id)
    assert final_state is not None
    assert final_state.status == StateExecutionStatusEnum.COMPLETED
    assert seen_calls


def test_run_solver_stop_preserves_latest_plan_results(monkeypatch, tmp_path):
    state_store = StateStore()
    queue = _FakeQueueService()

    execution_id = "exec-stop-preserve"
    output_dir = tmp_path / "output"
    input_dir = tmp_path / "input"
    input_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    class _Schedule:
        test_id = "T1"
        project_leg_id = "LEG-1"
        test_name = "Test 1"
        start_day = 0
        end_day = 2
        duration_days = 2
        start_date = date(2026, 2, 17)
        end_date = date(2026, 2, 19)
        assigned_fte = ["F1"]
        assigned_equipment = ["E1"]

    def fake_solver_runner(**kwargs):
        orchestrator.request_cancellation(execution_id)

        class _Solution:
            status = "FEASIBLE"
            makespan_days = 2
            test_schedules = [_Schedule()]
            resource_utilization = {"F1": 1.0}
            solve_time_seconds = 0.2
            objective_value = 5.0

        return _Solution()

    orchestrator = ExecutionOrchestrator(
        state_store=state_store,
        file_ops=FileOperationsService(),
        queue_service=queue,
        solver_runner=fake_solver_runner,
    )
    monkeypatch.setattr(
        "backend.src.services.execution_orchestrator.load_priority_config_from_dict",
        lambda config: config,
    )

    request = _build_request(
        output_folder=str(output_dir),
        input_folder=str(input_dir),
    )

    state_store.set_execution(
        ExecutionState(
            execution_id=execution_id,
            status=StateExecutionStatusEnum.PENDING,
            created_at=datetime(2026, 2, 17, tzinfo=timezone.utc),
            request_payload=request.model_dump(),
        )
    )

    orchestrator.run_solver(execution_id)

    final_state = state_store.get_execution(execution_id)
    assert final_state is not None
    assert final_state.status == StateExecutionStatusEnum.CANCELLED
    assert final_state.progress_data is not None
    partial = final_state.progress_data.get("partial_results") or {}
    assert partial.get("status") == "FEASIBLE"
    assert partial.get("makespan") == 2
    schedules = partial.get("test_schedule") or []
    assert len(schedules) == 1
    assert schedules[0].get("test_id") == "T1"
    assert queue.completed_ids == [execution_id]
