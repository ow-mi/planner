from datetime import datetime

from backend.src.api.models.responses import ExecutionStatusEnum, SolverExecution
from backend.src.api.routes import streaming_utils


def _mk_execution(status, progress=0, phase="Running", progress_data=None):
    return SolverExecution(
        execution_id="exec-stream",
        status=status,
        created_at=datetime.utcnow(),
        progress_percentage=progress,
        elapsed_time_seconds=12.5,
        current_phase=phase,
        progress_data=progress_data or {},
    )


def test_build_progress_event_contains_plot_and_metrics_payload():
    execution = _mk_execution(
        ExecutionStatusEnum.RUNNING,
        progress=45,
        progress_data={
            "makespan": 120,
            "objective_value": 8123,
            "best_bound": 8000,
            "gap_percent": 1.5,
        },
    )

    event = streaming_utils.build_progress_event(
        execution=execution,
        execution_id="exec-stream",
        run_id="run-1",
    )

    assert event["type"] == "progress"
    assert event["execution_id"] == "exec-stream"
    assert event["run_id"] == "run-1"
    assert event["progress"]["percent"] == 45
    assert event["metrics"]["makespan"] == 120
    assert event["plot_point"]["t_seconds"] == 12.5
    assert event["plot_point"]["makespan"] == 120


def test_progress_interval_respects_bounds_and_defaults():
    execution = _mk_execution(
        ExecutionStatusEnum.RUNNING,
        progress_data={"progress_interval_seconds": 99},
    )
    assert streaming_utils.progress_interval_seconds(execution) == 60

    execution.progress_data["progress_interval_seconds"] = 0
    assert streaming_utils.progress_interval_seconds(execution) == 1

    execution.progress_data = {}
    assert streaming_utils.progress_interval_seconds(execution) == 10


def test_replay_support_returns_events_and_detects_replay_gap():
    execution_id = "exec-replay"
    streaming_utils._EVENT_HISTORY.pop(execution_id, None)
    streaming_utils._EVENT_SEQUENCE.pop(execution_id, None)

    first = streaming_utils.record_event(
        execution_id,
        {"type": "state_changed", "status": "RUNNING", "timestamp": datetime.now().isoformat()},
    )
    second = streaming_utils.record_event(
        execution_id,
        {"type": "progress", "status": "RUNNING", "timestamp": datetime.now().isoformat()},
    )

    replay, replay_gap = streaming_utils.get_replay_events(execution_id, str(first["sequence"]))
    assert replay_gap is False
    assert [evt["sequence"] for evt in replay] == [second["sequence"]]

    replay, replay_gap = streaming_utils.get_replay_events(execution_id, "999")
    assert replay == []
    assert replay_gap is True
