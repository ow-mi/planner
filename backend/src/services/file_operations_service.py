import csv
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.src.api.models.responses import (
    BatchScenarioResultItem,
    BatchSummaryArtifact,
)
from backend.src.utils.file_handler import FileHandler


class FileOperationsService:
    """Handles file I/O for solver and batch operations."""

    _DEFAULT_OUTPUT_FILES = [
        "schedule.csv",
        "tests_schedule.csv",
        "resource_utilization.csv",
        "fte_usage.csv",
        "equipment_usage.csv",
        "concurrency_timeseries.csv",
    ]

    def __init__(self, file_handler: Optional[FileHandler] = None):
        self._file_handler = file_handler or FileHandler()

    def create_run_workspace(
        self,
        execution_id: str,
        run_name: str,
        created_at: datetime,
        base_path: Optional[str] = None,
    ) -> Dict[str, str]:
        """Create artifact workspace directories for a run."""
        return self._file_handler.create_run_artifact_workspace(
            run_id=execution_id,
            run_name=run_name,
            created_at=created_at,
            runs_root=base_path,
        )

    def save_input_files(
        self,
        workspace_path: str,
        csv_files: Dict[str, str],
        config: Dict[str, Any],
    ) -> None:
        """Save CSV inputs and priority config into a workspace."""
        self._file_handler.save_input_files(workspace_path, csv_files)
        priority_config_path = str(Path(workspace_path) / "priority_config.json")
        self._file_handler.write_json(priority_config_path, config)

    def read_output_files(self, workspace_path: str) -> Dict[str, Any]:
        """Read generated output and log files for a solver run."""
        output_root = Path(workspace_path)
        data_path = output_root / "data"

        output_files = self._file_handler.read_output_files(
            str(data_path),
            self._DEFAULT_OUTPUT_FILES,
        )
        written_output_paths = {
            filename: str(data_path / filename) for filename in output_files.keys()
        }

        if "tests_schedule.csv" not in output_files and "schedule.csv" in output_files:
            output_files["tests_schedule.csv"] = output_files["schedule.csv"]

        log_files: List[str] = []
        logs_dir = output_root / "logs"
        if logs_dir.exists():
            log_files = [
                f"logs/{entry.name}"
                for entry in logs_dir.iterdir()
                if entry.suffix == ".log"
            ]

        log_contents = self._file_handler.read_output_files(str(output_root), log_files)
        output_files.update(log_contents)
        for filename in log_contents.keys():
            written_output_paths[filename] = str(output_root / filename)

        return {
            "output_files": output_files,
            "written_output_paths": written_output_paths,
        }

    def copy_directory(self, source_dir: str, target_dir: str) -> None:
        """Copy directory recursively if source exists."""
        self._file_handler.copy_directory(source_dir, target_dir)

    def write_json(self, path: str, payload: Dict[str, Any]) -> None:
        """Write JSON payload to disk."""
        self._file_handler.write_json(path, payload)

    def write_batch_summary_artifacts(
        self,
        batch_id: str,
        items: List[BatchScenarioResultItem],
        output_root: Optional[str] = None,
    ) -> List[BatchSummaryArtifact]:
        """Write batch summary CSV and return artifact metadata."""
        if output_root:
            output_dir = Path(output_root) / "batch_summaries" / batch_id
        else:
            output_dir = Path(os.getcwd()) / "runs" / "batch_summaries" / batch_id
        output_dir.mkdir(parents=True, exist_ok=True)

        summary_csv_path = output_dir / "batch_summary.csv"
        csv_columns = [
            "scenario_id",
            "scenario_name",
            "status",
            "makespan",
            "objective_value",
            "solve_time_seconds",
            "scenario_results_endpoint",
            "scenario_status_endpoint",
            "output_files_keys",
        ]

        with summary_csv_path.open("w", newline="", encoding="utf-8") as csv_file:
            writer = csv.DictWriter(csv_file, fieldnames=csv_columns)
            writer.writeheader()

            for item in items:
                solver_stats = item.results.solver_stats if item.results else {}
                output_files = item.results.output_files if item.results else {}
                writer.writerow(
                    {
                        "scenario_id": item.scenario_id,
                        "scenario_name": item.scenario_name,
                        "status": item.status.value,
                        "makespan": item.results.makespan if item.results else "",
                        "objective_value": solver_stats.get("objective_value", ""),
                        "solve_time_seconds": solver_stats.get("solve_time", ""),
                        "scenario_results_endpoint": f"/api/results/{item.execution_id}"
                        if item.execution_id
                        else "",
                        "scenario_status_endpoint": f"/api/status/{item.execution_id}"
                        if item.execution_id
                        else "",
                        "output_files_keys": ";".join(sorted(output_files.keys())),
                    }
                )

        return [
            BatchSummaryArtifact(
                artifact_name="batch_summary.csv",
                artifact_path=str(summary_csv_path),
                content_type="text/csv",
            )
        ]
