from datetime import datetime, timezone

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


def _build_request(output_folder: str | None = None, input_folder: str | None = None):
    return SolverRequest(
        csv_files={
            "data_legs.csv": "leg_id\nLEG-1",
            "data_test.csv": "test_id\nT1",
            "data_fte.csv": "fte_id\nF1",
            "data_equipment.csv": "equipment_id\nE1",
            "data_test_duts.csv": "test_id,dut_id\nT1,D1",
        },
        priority_config={"mode": "makespan", "weights": {"makespan_weight": 1.0}},
        output_folder=output_folder,
        input_folder=input_folder,
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
