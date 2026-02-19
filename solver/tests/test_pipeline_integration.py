import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from solver.data_loader import load_data
from solver.model_builder import build_model
from solver.orchestrator import run_planning_pipeline
from solver.reports.csv_reports import generate_schedule_csv
from solver.solver import solve_model


def _write_minimal_input_files(input_dir) -> None:
    (input_dir / "data_legs.csv").write_text(
        "project_id,project_name,project_leg_id,leg_number,leg_name,priority,start_iso_week\n"
        "proj_1,Integration Project,leg_1,1,Leg 1,1,2026-W01.0\n",
        encoding="utf-8",
    )

    (input_dir / "data_test.csv").write_text(
        "project_leg_id,test_id,test,test_description,duration_days,fte_required,equipment_required,fte_assigned,equipment_assigned,sequence_index\n"
        "leg_1,T1,Smoke Test,Pipeline integration test,1,1,1,fte_team,setup_lab,1\n",
        encoding="utf-8",
    )

    (input_dir / "data_fte.csv").write_text(
        "fte_id,available_start_week_iso,available_end_week_iso\n"
        "fte_team,2026-W01.0,2026-W10.0\n",
        encoding="utf-8",
    )

    (input_dir / "data_equipment.csv").write_text(
        "equipment_id,available_start_week_iso,available_end_week_iso\n"
        "setup_lab,2026-W01.0,2026-W10.0\n",
        encoding="utf-8",
    )

    (input_dir / "data_test_duts.csv").write_text(
        "test_id,dut_id\nT1,1\n",
        encoding="utf-8",
    )

    (input_dir / "priority_config.json").write_text(
        json.dumps(
            {
                "mode": "end_date_priority",
                "weights": {"makespan_weight": 1.0, "priority_weight": 0.0},
            }
        ),
        encoding="utf-8",
    )


def _generate_stub_solution_artifacts(solution, plots_dir, start_date):
    html_path = os.path.join(plots_dir, "schedule_plot.html")
    png_path = os.path.join(plots_dir, "schedule_plot.png")
    with open(html_path, "w", encoding="utf-8") as handle:
        handle.write("<html><body>stub</body></html>")
    with open(png_path, "wb") as handle:
        handle.write(b"stub")
    return html_path, png_path


def test_pipeline_integration_end_to_end(tmp_path):
    input_dir = tmp_path / "input"
    input_dir.mkdir()
    _write_minimal_input_files(input_dir)

    data = load_data(str(input_dir))
    assert len(data.legs) == 1
    assert len(data.tests) == 1

    model = build_model(data)
    assert model.makespan_var is not None
    assert len(model.test_vars) == 1

    solution, _ = solve_model(model, data, time_limit_seconds=10)
    assert solution.status in {"OPTIMAL", "FEASIBLE"}
    assert len(solution.test_schedules) == 1

    manual_report_dir = tmp_path / "manual_reports"
    manual_report_dir.mkdir()
    schedule_csv_path = generate_schedule_csv(solution, str(manual_report_dir))
    assert os.path.exists(schedule_csv_path)
    assert os.path.basename(schedule_csv_path) == "tests_schedule.csv"

    orchestrator_output_dir = tmp_path / "orchestrator_output"
    orchestrated_solution = run_planning_pipeline(
        input_folder=str(input_dir),
        output_folder=str(orchestrator_output_dir),
        time_limit=10,
        generate_solution_artifacts_fn=_generate_stub_solution_artifacts,
    )
    assert orchestrated_solution.status in {"OPTIMAL", "FEASIBLE"}
    assert (orchestrator_output_dir / "data" / "tests_schedule.csv").exists()
