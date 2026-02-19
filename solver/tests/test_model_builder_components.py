import os
import sys
from datetime import date

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from solver.data_loader import Leg, PlanningData, ResourceWindow, Test as PlannerTest
from solver.model_builder import (
    ScheduleModel,
    add_resource_availability_constraints,
    add_resource_nonoverlap_constraints,
    build_resource_assignments,
)


@pytest.fixture
def start_date() -> date:
    return date(2026, 1, 5)


def _build_planning_data(test_count: int, start_date: date) -> PlanningData:
    tests = [
        PlannerTest(
            test_id=f"t{i}",
            project_leg_id="leg_1",
            sequence_index=i,
            test_name=f"T{i}",
            test_description="",
            duration_days=5 if i == 1 else 3,
            fte_required=1,
            equipment_required=1,
            fte_assigned="fte_team",
            equipment_assigned="setup_lab",
        )
        for i in range(1, test_count + 1)
    ]

    return PlanningData(
        legs={
            "leg_1": Leg(
                project_id="proj",
                project_name="Project",
                project_leg_id="leg_1",
                leg_number="1",
                leg_name="Leg 1",
                priority=1,
                start_iso_week="2026-W01.0",
                start_monday=start_date,
            )
        },
        tests=tests,
        fte_windows=[
            ResourceWindow(
                resource_id="fte_team",
                start_iso_week="2026-W01.0",
                end_iso_week="2026-W10.0",
                start_monday=start_date,
                end_monday=date(2026, 3, 16),
            )
        ],
        equipment_windows=[
            ResourceWindow(
                resource_id="setup_lab",
                start_iso_week="2026-W01.0",
                end_iso_week="2026-W10.0",
                start_monday=start_date,
                end_monday=date(2026, 3, 16),
            )
        ],
        priority_config={},
        test_duts={test.test_id: 1 for test in tests},
        leg_dependencies=[],
    )


def _build_schedule_model(data: PlanningData, start_date: date) -> ScheduleModel:
    schedule_model = ScheduleModel()

    for test in data.tests:
        start_var = schedule_model.model.NewIntVar(0, 100, f"start_{test.test_id}")
        end_var = schedule_model.model.NewIntVar(0, 100, f"end_{test.test_id}")
        schedule_model.test_vars[test.test_id] = (
            start_var,
            end_var,
            int(test.duration_days),
        )

    build_resource_assignments(schedule_model, data, start_date)
    return schedule_model


def test_add_resource_constraints_adds_expected_constraints_for_single_test(start_date):
    data = _build_planning_data(test_count=1, start_date=start_date)
    schedule_model = _build_schedule_model(data, start_date)

    before = len(schedule_model.model.Proto().constraints)
    add_resource_nonoverlap_constraints(schedule_model, data)
    add_resource_availability_constraints(schedule_model, data, start_date)
    after = len(schedule_model.model.Proto().constraints)

    assert after - before == 10


def test_add_resource_constraints_adds_expected_constraints_for_two_tests(start_date):
    data = _build_planning_data(test_count=2, start_date=start_date)
    schedule_model = _build_schedule_model(data, start_date)

    before = len(schedule_model.model.Proto().constraints)
    add_resource_nonoverlap_constraints(schedule_model, data)
    add_resource_availability_constraints(schedule_model, data, start_date)
    after = len(schedule_model.model.Proto().constraints)

    assert after - before == 18
