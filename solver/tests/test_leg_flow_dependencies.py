import os
import sys
from datetime import date

import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from solver.data_loader import (
    Leg,
    PlanningData,
    ResourceWindow,
    Test as PlannerTest,
    detect_leg_dependencies,
    load_tests,
    validate_data,
)


def _make_leg(project_leg_id: str) -> Leg:
    return Leg(
        project_id="proj",
        project_name="Project",
        project_leg_id=project_leg_id,
        leg_number="1",
        leg_name=project_leg_id,
        priority=1,
        start_iso_week="2026-W01.0",
        start_monday=date(2026, 1, 5),
    )


def test_load_tests_reads_next_leg_column(tmp_path):
    tests_path = tmp_path / "data_test.csv"
    pd.DataFrame(
        [
            {
                "project_leg_id": "leg_a",
                "test_id": "T1",
                "sequence_index": 1,
                "test": "Leak",
                "test_description": "Leak",
                "duration_days": 3.0,
                "fte_required": 1,
                "equipment_required": 1,
                "fte_assigned": "fte_a",
                "equipment_assigned": "setup_a",
                "next_leg": "leg_b;leg_c",
            }
        ]
    ).to_csv(tests_path, index=False)

    loaded_tests = load_tests(str(tmp_path))

    assert len(loaded_tests) == 1
    assert loaded_tests[0].next_leg == "leg_b;leg_c"


def test_detect_leg_dependencies_uses_last_test_next_leg_split_and_join():
    legs = {
        "leg_a": _make_leg("leg_a"),
        "leg_b": _make_leg("leg_b"),
        "leg_c": _make_leg("leg_c"),
        "leg_d": _make_leg("leg_d"),
        "leg_x": _make_leg("leg_x"),
    }

    tests = [
        PlannerTest(
            test_id="a_1",
            project_leg_id="leg_a",
            sequence_index=1,
            test_name="A1",
            test_description="",
            duration_days=1.0,
            fte_required=1,
            equipment_required=1,
            fte_assigned="fte_team",
            equipment_assigned="setup_lab",
            next_leg="leg_x",  # Should be ignored because this is not the last test in leg_a.
        ),
        PlannerTest(
            test_id="a_2",
            project_leg_id="leg_a",
            sequence_index=2,
            test_name="A2",
            test_description="",
            duration_days=1.0,
            fte_required=1,
            equipment_required=1,
            fte_assigned="fte_team",
            equipment_assigned="setup_lab",
            next_leg="leg_b; leg_c",
        ),
        PlannerTest(
            test_id="b_1",
            project_leg_id="leg_b",
            sequence_index=1,
            test_name="B1",
            test_description="",
            duration_days=1.0,
            fte_required=1,
            equipment_required=1,
            fte_assigned="fte_team",
            equipment_assigned="setup_lab",
            next_leg="leg_d",
        ),
        PlannerTest(
            test_id="c_1",
            project_leg_id="leg_c",
            sequence_index=1,
            test_name="C1",
            test_description="",
            duration_days=1.0,
            fte_required=1,
            equipment_required=1,
            fte_assigned="fte_team",
            equipment_assigned="setup_lab",
            next_leg="leg_d",
        ),
        PlannerTest(
            test_id="d_1",
            project_leg_id="leg_d",
            sequence_index=1,
            test_name="D1",
            test_description="",
            duration_days=1.0,
            fte_required=1,
            equipment_required=1,
            fte_assigned="fte_team",
            equipment_assigned="setup_lab",
        ),
    ]

    dependencies = detect_leg_dependencies(legs, tests)
    dependency_pairs = {
        (dependency.predecessor_leg_id, dependency.successor_leg_id)
        for dependency in dependencies
    }

    assert dependency_pairs == {
        ("leg_a", "leg_b"),
        ("leg_a", "leg_c"),
        ("leg_b", "leg_d"),
        ("leg_c", "leg_d"),
    }


def test_detect_leg_dependencies_no_longer_uses_legacy_naming_patterns():
    legs = {
        "proj_2": _make_leg("proj_2"),
        "proj_2_a": _make_leg("proj_2_a"),
    }
    tests = [
        PlannerTest(
            test_id="t_base",
            project_leg_id="proj_2",
            sequence_index=1,
            test_name="Base",
            test_description="",
            duration_days=1.0,
            fte_required=1,
            equipment_required=1,
            fte_assigned="fte_team",
            equipment_assigned="setup_lab",
        ),
        PlannerTest(
            test_id="t_split",
            project_leg_id="proj_2_a",
            sequence_index=1,
            test_name="Split",
            test_description="",
            duration_days=1.0,
            fte_required=1,
            equipment_required=1,
            fte_assigned="fte_team",
            equipment_assigned="setup_lab",
        ),
    ]

    dependencies = detect_leg_dependencies(legs, tests)
    assert dependencies == []


def test_validate_data_reports_next_leg_format_and_position_errors():
    legs = {
        "leg_a": _make_leg("leg_a"),
        "leg_b": _make_leg("leg_b"),
    }
    tests = [
        PlannerTest(
            test_id="a_1",
            project_leg_id="leg_a",
            sequence_index=1,
            test_name="A1",
            test_description="",
            duration_days=1.0,
            fte_required=1,
            equipment_required=1,
            fte_assigned="fte_team",
            equipment_assigned="setup_lab",
            next_leg="leg_b,leg_c",
        ),
        PlannerTest(
            test_id="a_2",
            project_leg_id="leg_a",
            sequence_index=2,
            test_name="A2",
            test_description="",
            duration_days=1.0,
            fte_required=1,
            equipment_required=1,
            fte_assigned="fte_team",
            equipment_assigned="setup_lab",
        ),
    ]

    data = PlanningData(
        legs=legs,
        tests=tests,
        fte_windows=[
            ResourceWindow(
                resource_id="fte_team",
                start_iso_week="2026-W01.0",
                end_iso_week="2026-W10.0",
                start_monday=date(2026, 1, 5),
                end_monday=date(2026, 3, 16),
            )
        ],
        equipment_windows=[
            ResourceWindow(
                resource_id="setup_lab",
                start_iso_week="2026-W01.0",
                end_iso_week="2026-W10.0",
                start_monday=date(2026, 1, 5),
                end_monday=date(2026, 3, 16),
            )
        ],
        priority_config={},
        test_duts={"a_1": 1, "a_2": 1},
        leg_dependencies=detect_leg_dependencies(legs, tests),
    )

    errors = validate_data(data)

    assert any("uses ',' in next_leg" in error for error in errors)
    assert any("only the last test of a leg can define next_leg" in error for error in errors)
    assert any("unknown next_leg target 'leg_b,leg_c'" in error for error in errors)
