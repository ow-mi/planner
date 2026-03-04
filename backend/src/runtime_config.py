"""Runtime configuration helpers for desktop and packaged execution."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import List


_DEFAULT_LOCALHOST_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
_DEFAULT_LOCALHOST_ORIGIN_REGEX = r"^http://(localhost|127\\.0\\.0\\.1)(:\\d+)?$"


def _ensure_dir(path_value: str) -> str:
    path = Path(path_value).expanduser().resolve()
    path.mkdir(parents=True, exist_ok=True)
    return str(path)


def get_app_data_root() -> str:
    configured = os.environ.get("PLANNER_APP_DATA_ROOT")
    if configured:
        return _ensure_dir(configured)
    return _ensure_dir(str(Path.cwd()))


def get_logs_dir() -> str:
    configured = os.environ.get("PLANNER_LOG_DIR")
    if configured:
        return _ensure_dir(configured)
    return _ensure_dir(str(Path(get_app_data_root()) / "logs"))


def get_runs_root() -> str:
    configured = os.environ.get("PLANNER_RUNS_ROOT")
    if configured:
        return _ensure_dir(configured)
    return _ensure_dir(str(Path(get_app_data_root()) / "runs"))


def get_state_dir() -> str:
    configured = os.environ.get("PLANNER_STATE_DIR")
    if configured:
        return _ensure_dir(configured)
    return _ensure_dir(str(Path(get_app_data_root()) / "state"))


def get_checkpoint_dir() -> str:
    configured = os.environ.get("PLANNER_CHECKPOINT_DIR")
    if configured:
        return _ensure_dir(configured)
    return _ensure_dir(str(Path(get_app_data_root()) / "checkpoints"))


def get_temp_root() -> str:
    configured = os.environ.get("PLANNER_TEMP_ROOT")
    if configured:
        return _ensure_dir(configured)
    return _ensure_dir(str(Path(tempfile.gettempdir()) / "planner_redesign"))


def get_allowed_origins() -> List[str]:
    configured = os.environ.get("PLANNER_ALLOWED_ORIGINS", "").strip()
    if not configured:
        return [* _DEFAULT_LOCALHOST_ORIGINS, "null"]

    origins: List[str] = []
    for item in configured.split(","):
        normalized = item.strip()
        if normalized and normalized not in origins:
            origins.append(normalized)
    return origins or [* _DEFAULT_LOCALHOST_ORIGINS, "null"]


def get_allowed_origin_regex() -> str:
    configured = os.environ.get("PLANNER_ALLOWED_ORIGIN_REGEX", "").strip()
    return configured or _DEFAULT_LOCALHOST_ORIGIN_REGEX
