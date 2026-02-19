import os
import sys
from datetime import date
from types import SimpleNamespace

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from solver import main as planner_main_fn
from solver.solver import SolutionResult, TestSchedule as ScheduleEntry


def _make_solution(status: str) -> SolutionResult:
    schedules = []
    if status in {"OPTIMAL", "FEASIBLE"}:
        schedules = [
            ScheduleEntry(
                test_id="T1",
                project_leg_id="LEG1",
                test_name="Smoke",
                start_day=0,
                end_day=2,
                duration_days=2,
                start_date=date(2026, 1, 5),
                end_date=date(2026, 1, 7),
                assigned_fte=["fte_a"],
                assigned_equipment=["eq_a"],
            )
        ]

    return SolutionResult(
        status=status,
        makespan_days=2 if schedules else 0,
        objective_value=2 if schedules else 0,
        solve_time_seconds=0.12,
        test_schedules=schedules,
        resource_utilization={"fte_a": 50.0} if schedules else {},
    )


@pytest.mark.parametrize("status", ["OPTIMAL", "INFEASIBLE"])
def test_main_emits_plot_artifacts_for_success_and_failure(
    status, tmp_path, monkeypatch
):
    data = SimpleNamespace(
        legs={"LEG1": SimpleNamespace(start_monday=date(2026, 1, 5))},
        tests=[SimpleNamespace(test_id="T1")],
        fte_windows=[SimpleNamespace(resource_id="fte_a")],
        equipment_windows=[SimpleNamespace(resource_id="eq_a")],
    )

    monkeypatch.setitem(planner_main_fn.__globals__, "load_data", lambda _: data)
    monkeypatch.setitem(
        planner_main_fn.__globals__,
        "build_model",
        lambda *_: SimpleNamespace(test_vars={}, resource_assignments={}, horizon=10),
    )
    monkeypatch.setitem(
        planner_main_fn.__globals__,
        "solve_model",
        lambda *_: (_make_solution(status), date(2026, 1, 5)),
    )
    monkeypatch.setitem(
        planner_main_fn.__globals__, "generate_schedule_csv", lambda *_: None
    )
    monkeypatch.setitem(
        planner_main_fn.__globals__,
        "generate_resource_utilization_csv",
        lambda *_: None,
    )
    monkeypatch.setitem(
        planner_main_fn.__globals__, "generate_fte_usage_csv", lambda *_: None
    )
    monkeypatch.setitem(
        planner_main_fn.__globals__, "generate_equipment_usage_csv", lambda *_: None
    )
    monkeypatch.setitem(
        planner_main_fn.__globals__,
        "generate_concurrency_timeseries_csv",
        lambda *_: None,
    )

    output_dir = tmp_path / "out"
    planner_main_fn(
        input_folder=str(tmp_path),
        output_folder=str(output_dir),
        debug_level="ERROR",
        time_limit=1,
    )

    plot_html = output_dir / "plots" / "plot.html"
    plot_png = output_dir / "plots" / "plot.png"

    assert plot_html.exists()
    assert plot_png.exists()

    html_text = plot_html.read_text(encoding="utf-8")
    assert f"Status: {status}" in html_text
    if status == "INFEASIBLE":
        assert "Diagnostics" in html_text
