import json
import threading
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

TERMINAL_STATES = {"COMPLETED", "FAILED", "TIMEOUT", "CANCELLED"}
_EVENT_HISTORY: Dict[str, List[Dict[str, Any]]] = {}
_EVENT_SEQUENCE: Dict[str, int] = {}
_EVENT_LOCK = threading.RLock()
_MAX_EVENT_HISTORY = 256


def status_value(status_enum: Any) -> str:
    return status_enum.value if hasattr(status_enum, "value") else str(status_enum)


def _next_sequence(execution_id: str) -> int:
    with _EVENT_LOCK:
        seq = _EVENT_SEQUENCE.get(execution_id, 0) + 1
        _EVENT_SEQUENCE[execution_id] = seq
        return seq


def record_event(execution_id: str, event: Dict[str, Any]) -> Dict[str, Any]:
    sequence = _next_sequence(execution_id)
    event_payload = {
        **event,
        "event_version": "1.0",
        "sequence": sequence,
        "event_id": sequence,
    }
    with _EVENT_LOCK:
        history = _EVENT_HISTORY.setdefault(execution_id, [])
        history.append(event_payload)
        if len(history) > _MAX_EVENT_HISTORY:
            del history[: len(history) - _MAX_EVENT_HISTORY]
    return event_payload


def get_replay_events(
    execution_id: str, last_event_id: Optional[str]
) -> Tuple[List[Dict[str, Any]], bool]:
    if not last_event_id:
        return [], False
    try:
        last_seen = int(last_event_id)
    except (TypeError, ValueError):
        return [], True

    with _EVENT_LOCK:
        history = _EVENT_HISTORY.get(execution_id, [])
        if not history:
            current_seq = _EVENT_SEQUENCE.get(execution_id, 0)
            if last_seen > current_seq:
                return [], True
            return [], False
        first_seq = history[0]["sequence"]
        if last_seen < first_seq - 1:
            return [], True
        if last_seen > history[-1]["sequence"]:
            return [], True
        replay = [event for event in history if event["sequence"] > last_seen]
    return replay, False


def format_sse(event: Dict[str, Any]) -> str:
    return (
        f"id: {event['sequence']}\n"
        f"event: {event['type']}\n"
        "retry: 3000\n"
        f"data: {json.dumps(event)}\n\n"
    )


def build_progress_event(
    execution: Any, execution_id: str, run_id: Optional[str] = None
) -> Dict[str, Any]:
    normalized_status = status_value(execution.status)
    progress_data = execution.progress_data or {}
    objective_value = progress_data.get("objective_value")
    elapsed_seconds = execution.elapsed_time_seconds
    makespan = progress_data.get("makespan")
    if makespan is None and execution.results is not None:
        makespan = execution.results.makespan

    event = {
        "type": "progress",
        "execution_id": execution_id,
        "timestamp": datetime.now().isoformat(),
        "status": normalized_status,
        "progress": {
            "percent": execution.progress_percentage,
            "phase": execution.current_phase,
            "elapsed_seconds": elapsed_seconds,
        },
        "metrics": {
            "makespan": makespan,
            "objective_value": objective_value,
            "best_bound": progress_data.get("best_bound"),
            "gap_percent": progress_data.get("gap_percent"),
        },
        "plot_point": {
            "t_seconds": elapsed_seconds,
            "makespan": makespan,
            "objective": objective_value,
        },
        "schedule_preview": progress_data.get("latest_test_schedule_preview") or [],
        "schedule_hash": progress_data.get("latest_schedule_hash"),
    }
    if run_id:
        event["run_id"] = run_id
    return event


def progress_interval_seconds(execution: Any) -> int:
    progress_data = execution.progress_data or {}
    interval = progress_data.get("progress_interval_seconds", 10)
    try:
        interval_int = int(interval)
    except (TypeError, ValueError):
        return 10
    return max(1, min(interval_int, 60))
