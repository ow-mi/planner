import json
import os
import re
import shutil
import tempfile
from datetime import datetime, timezone
from typing import Dict, List, Optional

from backend.src.runtime_config import get_app_data_root


class FileHandler:
    @staticmethod
    def create_temp_workspace(execution_id: str) -> str:
        """
        Create a temporary directory for the execution.
        """
        temp_dir = tempfile.mkdtemp(prefix=f"solver_{execution_id}_")
        return temp_dir

    @staticmethod
    def create_run_artifact_workspace(
        run_id: str,
        run_name: Optional[str],
        created_at: datetime,
        runs_root: Optional[str] = None,
    ) -> Dict[str, str]:
        timestamp = FileHandler._format_timestamp(created_at)
        normalized_run_name = FileHandler._normalize_run_name(run_name)

        root = runs_root or get_app_data_root()
        run_root = os.path.join(
            root,
            "runs",
            f"{timestamp}_{normalized_run_name}",
            run_id,
        )

        paths = {
            "run_root": run_root,
            "input_original": os.path.join(run_root, "input_original"),
            "input_effective": os.path.join(run_root, "input_effective"),
            "output": os.path.join(run_root, "output"),
            "plots": os.path.join(run_root, "plots"),
            "settings_used": os.path.join(run_root, "settings_used.json"),
        }

        for directory_key in (
            "run_root",
            "input_original",
            "input_effective",
            "output",
            "plots",
        ):
            os.makedirs(paths[directory_key], exist_ok=True)

        return paths

    @staticmethod
    def save_input_files(workspace_path: str, csv_files: Dict[str, str]):
        """
        Save CSV content strings to files in the workspace.
        """
        os.makedirs(workspace_path, exist_ok=True)
        for filename, content in csv_files.items():
            file_path = os.path.join(workspace_path, filename)
            with open(file_path, "w", newline="", encoding="utf-8") as file:
                file.write(content)

    @staticmethod
    def write_json(path: str, payload: Dict):
        parent_dir = os.path.dirname(path)
        if parent_dir:
            os.makedirs(parent_dir, exist_ok=True)
        with open(path, "w", encoding="utf-8") as file:
            json.dump(payload, file, indent=2)

    @staticmethod
    def copy_directory(source_dir: str, target_dir: str):
        if not os.path.isdir(source_dir):
            return

        os.makedirs(target_dir, exist_ok=True)
        for entry in os.listdir(source_dir):
            source_path = os.path.join(source_dir, entry)
            target_path = os.path.join(target_dir, entry)
            if os.path.isdir(source_path):
                shutil.copytree(source_path, target_path, dirs_exist_ok=True)
            else:
                shutil.copy2(source_path, target_path)

    @staticmethod
    def cleanup_workspace(workspace_path: str):
        """
        Remove the temporary workspace.
        """
        if os.path.exists(workspace_path):
            shutil.rmtree(workspace_path)

    @staticmethod
    def read_output_files(
        workspace_path: str, expected_files: List[str]
    ) -> Dict[str, str]:
        """
        Read output files from workspace and return as content strings.
        """
        results = {}
        for filename in expected_files:
            file_path = os.path.join(workspace_path, filename)
            if os.path.exists(file_path):
                try:
                    with open(file_path, "r", encoding="utf-8") as file:
                        results[filename] = file.read()
                except UnicodeDecodeError:
                    pass
        return results

    @staticmethod
    def _format_timestamp(created_at: datetime) -> str:
        normalized = (
            created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
        )
        return normalized.astimezone(timezone.utc).strftime("%Y%m%d_%H%M%S")

    @staticmethod
    def _normalize_run_name(run_name: Optional[str]) -> str:
        if not run_name:
            return "run"

        cleaned = run_name.strip().lower().replace(" ", "_")
        cleaned = os.path.basename(cleaned)
        cleaned = re.sub(r"[^a-z0-9_-]+", "_", cleaned)
        cleaned = re.sub(r"_+", "_", cleaned).strip("_")
        return cleaned or "run"
