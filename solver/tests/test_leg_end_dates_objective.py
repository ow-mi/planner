import os
import sys
from datetime import date, timedelta

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from solver.config.priority_modes import load_priority_config_from_dict
from solver.data_loader import Leg, PlanningData, ResourceWindow, Test as PlannerTest
from solver.model_builder import build_model
from solver.solver import solve_model


def _resource_window(resource_id: str, start: date) -> ResourceWindow:
    return ResourceWindow(
        resource_id=resource_id,
        start_iso_week="2026-W02.0",
        end_iso_week="2026-W20.0",
        start_monday=start,
        end_monday=start + timedelta(days=140),
    )


def _base_leg(leg_id: str, start: date) -> Leg:
    return Leg(
        project_id="proj",
        project_name="Project",
        project_leg_id=leg_id,
        leg_number="1",
        leg_name=leg_id,
        priority=1,
        start_iso_week="2026-W02.0",
        start_monday=start,
    )


def _build_data_single_leg(tests: list[PlannerTest], start: date) -> PlanningData:
    return PlanningData(
        legs={"leg_1": _base_leg("leg_1", start)},
        tests=tests,
        fte_windows=[_resource_window("fte_a", start)],
        equipment_windows=[_resource_window("setup_a", start)],
        priority_config={},
        test_duts={test.test_id: 1 for test in tests},
        leg_dependencies=[],
    )


def _solve_with_config(data: PlanningData, priority_config: dict):
    config = load_priority_config_from_dict(priority_config)
    model = build_model(data, config)
    solution, _ = solve_model(model, data, time_limit_seconds=20)
    assert solution.status in ("OPTIMAL", "FEASIBLE")
    return solution


def test_leg_deadline_penalty_per_day_applies_late_days_per_leg():
    start = date(2026, 1, 5)
    data = _build_data_single_leg(
        [
            PlannerTest(
                test_id="t1",
                project_leg_id="leg_1",
                sequence_index=1,
                test_name="T1",
                test_description="",
                duration_days=2,
                fte_required=1,
                equipment_required=1,
                fte_assigned="fte_a",
                equipment_assigned="setup_a",
            )
        ],
        start,
    )
    deadline = (start + timedelta(days=1)).isoformat()
    solution = _solve_with_config(
        data,
        {
            "mode": "leg_end_dates",
            "weights": {"makespan_weight": 0.0, "priority_weight": 1.0},
            "leg_deadlines": {"leg_1": deadline},
            "deadline_penalty_per_day": 10.0,
            "leg_compactness_penalty_per_day": 0.0,
        },
    )
    schedule = solution.test_schedules[0]
    expected_late_days = max(0, schedule.end_day - 1)
    assert pytest.approx(solution.objective_value, rel=1e-6) == 10.0 * expected_late_days


def test_leg_compactness_penalty_per_day_applies_internal_idle_gap():
    start = date(2026, 1, 5)
    data = _build_data_single_leg(
        [
            PlannerTest(
                test_id="t1",
                project_leg_id="leg_1",
                sequence_index=1,
                test_name="T1",
                test_description="",
                duration_days=1,
                fte_required=1,
                equipment_required=1,
                fte_assigned="fte_a",
                equipment_assigned="setup_a",
            ),
            PlannerTest(
                test_id="t2",
                project_leg_id="leg_1",
                sequence_index=2,
                test_name="T2",
                test_description="",
                duration_days=1,
                fte_required=1,
                equipment_required=1,
                fte_assigned="fte_a",
                equipment_assigned="setup_a",
                force_start_week_iso="2026-W02.4",
            ),
        ],
        start,
    )

    solution = _solve_with_config(
        data,
        {
            "mode": "leg_end_dates",
            "weights": {"makespan_weight": 0.0, "priority_weight": 1.0},
            "leg_deadlines": {"leg_1": (start + timedelta(days=100)).isoformat()},
            "deadline_penalty_per_day": 0.0,
            "leg_compactness_penalty_per_day": 7.0,
        },
    )
    schedules = sorted(solution.test_schedules, key=lambda item: item.sequence_index if hasattr(item, "sequence_index") else item.start_day)
    gap_days = schedules[1].start_day - schedules[0].end_day
    assert gap_days >= 0
    assert pytest.approx(solution.objective_value, rel=1e-6) == 7.0 * gap_days


def test_leg_end_dates_zero_penalties_when_on_time_and_no_gap():
    start = date(2026, 1, 5)
    data = _build_data_single_leg(
        [
            PlannerTest(
                test_id="t1",
                project_leg_id="leg_1",
                sequence_index=1,
                test_name="T1",
                test_description="",
                duration_days=1,
                fte_required=1,
                equipment_required=1,
                fte_assigned="fte_a",
                equipment_assigned="setup_a",
            ),
            PlannerTest(
                test_id="t2",
                project_leg_id="leg_1",
                sequence_index=2,
                test_name="T2",
                test_description="",
                duration_days=1,
                fte_required=1,
                equipment_required=1,
                fte_assigned="fte_a",
                equipment_assigned="setup_a",
            ),
        ],
        start,
    )
    solution = _solve_with_config(
        data,
        {
            "mode": "leg_end_dates",
            "weights": {"makespan_weight": 0.0, "priority_weight": 1.0},
            "leg_deadlines": {"leg_1": (start + timedelta(days=2)).isoformat()},
            "deadline_penalty_per_day": 11.0,
            "leg_compactness_penalty_per_day": 5.0,
        },
    )
    assert pytest.approx(solution.objective_value, rel=1e-6) == 0.0


def test_leg_end_dates_multi_leg_per_leg_penalties_sum_correctly():
    start = date(2026, 1, 5)
    legs = {"leg_1": _base_leg("leg_1", start), "leg_2": _base_leg("leg_2", start)}
    tests = [
        PlannerTest(
            test_id="l1_t1",
            project_leg_id="leg_1",
            sequence_index=1,
            test_name="L1",
            test_description="",
            duration_days=2,
            fte_required=1,
            equipment_required=1,
            fte_assigned="fte_a",
            equipment_assigned="setup_a",
        ),
        PlannerTest(
            test_id="l2_t1",
            project_leg_id="leg_2",
            sequence_index=1,
            test_name="L2",
            test_description="",
            duration_days=2,
            fte_required=1,
            equipment_required=1,
            fte_assigned="fte_b",
            equipment_assigned="setup_b",
        ),
    ]
    data = PlanningData(
        legs=legs,
        tests=tests,
        fte_windows=[_resource_window("fte_a", start), _resource_window("fte_b", start)],
        equipment_windows=[
            _resource_window("setup_a", start),
            _resource_window("setup_b", start),
        ],
        priority_config={},
        test_duts={test.test_id: 1 for test in tests},
        leg_dependencies=[],
    )
    solution = _solve_with_config(
        data,
        {
            "mode": "leg_end_dates",
            "weights": {"makespan_weight": 0.0, "priority_weight": 1.0},
            "leg_deadlines": {
                "leg_1": (start + timedelta(days=1)).isoformat(),
                "leg_2": (start + timedelta(days=1)).isoformat(),
            },
            "deadline_penalty_per_day": 0.0,
            "leg_deadline_penalties": {"leg_1": 10.0, "leg_2": 20.0},
            "leg_compactness_penalty_per_day": 0.0,
        },
    )

    by_leg = {}
    for schedule in solution.test_schedules:
        by_leg.setdefault(schedule.project_leg_id, []).append(schedule)
    leg_1_late = max(0, max(item.end_day for item in by_leg["leg_1"]) - 1)
    leg_2_late = max(0, max(item.end_day for item in by_leg["leg_2"]) - 1)
    expected = 10.0 * leg_1_late + 20.0 * leg_2_late
    assert pytest.approx(solution.objective_value, rel=1e-6) == expected


def test_leg_start_deadline_blocks_tests_before_configured_start():
    start = date(2026, 1, 5)
    data = _build_data_single_leg(
        [
            PlannerTest(
                test_id="t1",
                project_leg_id="leg_1",
                sequence_index=1,
                test_name="T1",
                test_description="",
                duration_days=1,
                fte_required=1,
                equipment_required=1,
                fte_assigned="fte_a",
                equipment_assigned="setup_a",
            )
        ],
        start,
    )
    configured_start = start + timedelta(days=10)
    solution = _solve_with_config(
        data,
        {
            "mode": "leg_end_dates",
            "weights": {"makespan_weight": 1.0, "priority_weight": 0.0},
            "leg_start_deadlines": {"leg_1": configured_start.isoformat()},
            "leg_deadlines": {"leg_1": (start + timedelta(days=200)).isoformat()},
            "deadline_penalty_per_day": 0.0,
            "leg_compactness_penalty_per_day": 0.0,
        },
    )
    scheduled = next(item for item in solution.test_schedules if item.test_id == "t1")
    assert scheduled.start_day >= 10
