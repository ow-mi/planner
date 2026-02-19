import csv

from backend.src.api.models.responses import (
    BatchScenarioResultItem,
    ExecutionStatusEnum,
    SolverResults,
    SolverStatusEnum,
)
from backend.src.services.file_operations_service import FileOperationsService


def test_read_output_files_includes_expected_files_and_logs(tmp_path):
    output_root = tmp_path / "output"
    data_dir = output_root / "data"
    logs_dir = output_root / "logs"
    data_dir.mkdir(parents=True)
    logs_dir.mkdir(parents=True)

    (data_dir / "schedule.csv").write_text(
        "test_id,start_day\nT1,1\n", encoding="utf-8"
    )
    (data_dir / "resource_utilization.csv").write_text(
        "resource,utilization\nF1,0.5\n", encoding="utf-8"
    )
    (logs_dir / "solver.log").write_text("solver started\n", encoding="utf-8")

    service = FileOperationsService()
    artifacts = service.read_output_files(str(output_root))

    output_files = artifacts["output_files"]
    written_paths = artifacts["written_output_paths"]

    assert "schedule.csv" in output_files
    assert "tests_schedule.csv" in output_files
    assert output_files["tests_schedule.csv"] == output_files["schedule.csv"]
    assert "logs/solver.log" in output_files
    assert written_paths["schedule.csv"].endswith("output/data/schedule.csv")
    assert written_paths["logs/solver.log"].endswith("output/logs/solver.log")


def test_write_batch_summary_artifacts_writes_batch_summary_csv(tmp_path):
    service = FileOperationsService()

    item = BatchScenarioResultItem(
        scenario_id="scenario-1",
        scenario_name="Scenario One",
        status=ExecutionStatusEnum.COMPLETED,
        execution_id="exec-1",
        results=SolverResults(
            execution_id="exec-1",
            status=SolverStatusEnum.OPTIMAL,
            makespan=10.0,
            test_schedule=[],
            resource_utilization={},
            output_files={"schedule.csv": "test_id,start_day\nT1,1\n"},
            solver_stats={"solve_time": 1.5, "objective_value": 42.0},
        ),
    )

    artifacts = service.write_batch_summary_artifacts(
        batch_id="batch-1",
        items=[item],
        output_root=str(tmp_path),
    )

    assert len(artifacts) == 1
    artifact = artifacts[0]
    assert artifact.artifact_name == "batch_summary.csv"

    with open(artifact.artifact_path, "r", encoding="utf-8", newline="") as csv_file:
        rows = list(csv.DictReader(csv_file))

    assert len(rows) == 1
    assert rows[0]["scenario_id"] == "scenario-1"
    assert rows[0]["status"] == "COMPLETED"
    assert rows[0]["objective_value"] == "42.0"
