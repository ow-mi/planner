import json
import os
import sys
from datetime import date

import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from solver.data_loader import (
    Leg,
    Test as PlannerTest,
    apply_scenario_overrides,
    load_data,
)


def test_apply_scenario_overrides_respects_precedence_order():
    legs = {
        "leg_1": Leg(
            project_id="proj_a",
            project_name="Project A",
            project_leg_id="leg_1",
            leg_number="1",
            leg_name="Leg 1",
            priority=1,
            start_iso_week="2026-W01.0",
            start_monday=date(2026, 1, 5),
        ),
        "leg_2": Leg(
            project_id="proj_b",
            project_name="Project B",
            project_leg_id="leg_2",
            leg_number="1",
            leg_name="Leg 2",
            priority=1,
            start_iso_week="2026-W01.0",
            start_monday=date(2026, 1, 5),
        ),
    }

    tests = [
        PlannerTest(
            test_id="explicit_seq1",
            project_leg_id="leg_1",
            sequence_index=1,
            test_name="Explicit",
            test_description="",
            duration_days=1.0,
            fte_required=1,
            equipment_required=1,
            fte_assigned="fte_manual",
            equipment_assigned="setup_manual",
        ),
        PlannerTest(
            test_id="leg_wildcard_seq1",
            project_leg_id="leg_1",
            sequence_index=2,
            test_name="Leg wildcard",
            test_description="",
            duration_days=1.0,
            fte_required=1,
            equipment_required=1,
            fte_assigned="*",
            equipment_assigned="*",
        ),
        PlannerTest(
            test_id="project_wildcard_seq1",
            project_leg_id="leg_2",
            sequence_index=1,
            test_name="Project wildcard",
            test_description="",
            duration_days=1.0,
            fte_required=1,
            equipment_required=1,
            fte_assigned="*",
            equipment_assigned="*",
        ),
    ]

    overrides = {
        "project_overrides": {
            "proj_a": {
                "fte_assigned": "fte_project",
                "equipment_assigned": "setup_project",
            },
            "proj_b": {
                "fte_assigned": "fte_project_b",
                "equipment_assigned": "setup_project_b",
            },
        },
        "leg_overrides": {
            "leg_1": {"fte_assigned": "fte_leg", "equipment_assigned": "setup_leg"}
        },
    }

    updated_tests = apply_scenario_overrides(tests, legs, overrides)
    by_id = {test.test_id: test for test in updated_tests}

    assert by_id["explicit_seq1"].fte_assigned == "fte_manual"
    assert by_id["explicit_seq1"].equipment_assigned == "setup_manual"

    assert by_id["leg_wildcard_seq1"].fte_assigned == "fte_leg"
    assert by_id["leg_wildcard_seq1"].equipment_assigned == "setup_leg"

    assert by_id["project_wildcard_seq1"].fte_assigned == "fte_project_b"
    assert by_id["project_wildcard_seq1"].equipment_assigned == "setup_project_b"


def test_load_data_applies_overrides_only_to_wildcards(tmp_path):
    pd.DataFrame(
        [
            {
                "project_id": "proj_a",
                "project_name": "Project A",
                "project_leg_id": "leg_1",
                "leg_number": "1",
                "leg_name": "Leg 1",
                "priority": 1,
                "start_iso_week": "2026-W01",
            }
        ]
    ).to_csv(tmp_path / "data_legs.csv", index=False)

    pd.DataFrame(
        [
            {
                "test_id": "T_EXPLICIT",
                "project_leg_id": "leg_1",
                "sequence_index": 1,
                "test": "Explicit FTE",
                "test_description": "",
                "duration_days": 1.0,
                "fte_required": 1,
                "equipment_required": 1,
                "fte_assigned": "fte_fixed",
                "equipment_assigned": "*",
            },
            {
                "test_id": "T_WILDCARD",
                "project_leg_id": "leg_1",
                "sequence_index": 2,
                "test": "Wildcard both",
                "test_description": "",
                "duration_days": 1.0,
                "fte_required": 1,
                "equipment_required": 1,
                "fte_assigned": "*",
                "equipment_assigned": "*",
            },
        ]
    ).to_csv(tmp_path / "data_test.csv", index=False)

    pd.DataFrame(
        [
            {
                "fte_id": "fte_fixed",
                "available_start_week_iso": "2026-W01",
                "available_end_week_iso": "2026-W10",
            },
            {
                "fte_id": "fte_project",
                "available_start_week_iso": "2026-W01",
                "available_end_week_iso": "2026-W10",
            },
        ]
    ).to_csv(tmp_path / "data_fte.csv", index=False)

    pd.DataFrame(
        [
            {
                "equipment_id": "setup_leg",
                "available_start_week_iso": "2026-W01",
                "available_end_week_iso": "2026-W10",
            },
            {
                "equipment_id": "setup_default",
                "available_start_week_iso": "2026-W01",
                "available_end_week_iso": "2026-W10",
            },
        ]
    ).to_csv(tmp_path / "data_equipment.csv", index=False)

    pd.DataFrame(
        [{"test_id": "T_EXPLICIT", "dut_id": 1}, {"test_id": "T_WILDCARD", "dut_id": 1}]
    ).to_csv(tmp_path / "data_test_duts.csv", index=False)

    (tmp_path / "priority_config.json").write_text("{}", encoding="utf-8")
    (tmp_path / "scenario_overrides.json").write_text(
        json.dumps(
            {
                "project_overrides": {
                    "proj_a": {
                        "fte_assigned": "fte_project",
                        "equipment_assigned": "setup_default",
                    }
                },
                "leg_overrides": {"leg_1": {"equipment_assigned": "setup_leg"}},
            }
        ),
        encoding="utf-8",
    )

    data = load_data(str(tmp_path))
    tests_by_name = {test.test_name: test for test in data.tests}

    assert tests_by_name["Explicit FTE"].fte_assigned == "fte_fixed"
    assert tests_by_name["Explicit FTE"].equipment_assigned == "setup_leg"

    assert tests_by_name["Wildcard both"].fte_assigned == "fte_project"
    assert tests_by_name["Wildcard both"].equipment_assigned == "setup_leg"


def test_load_data_normalizes_legacy_weeks_and_applies_override_precedence(tmp_path):
    pd.DataFrame(
        [
            {
                "project_id": "proj_a",
                "project_name": "Project A",
                "project_leg_id": "leg_1",
                "leg_number": "1",
                "leg_name": "Leg 1",
                "priority": 1,
                "start_iso_week": "2026-1",
            }
        ]
    ).to_csv(tmp_path / "data_legs.csv", index=False)

    pd.DataFrame(
        [
            {
                "test_id": "T_WILDCARD",
                "project_leg_id": "leg_1",
                "sequence_index": 1,
                "test": "Wildcard with legacy week",
                "test_description": "",
                "duration_days": 1.0,
                "fte_required": 1,
                "equipment_required": 1,
                "fte_assigned": "*",
                "equipment_assigned": "*",
                "force_start_week_iso": "2026-W2",
            }
        ]
    ).to_csv(tmp_path / "data_test.csv", index=False)

    pd.DataFrame(
        [
            {
                "fte_id": "fte_leg",
                "available_start_week_iso": "2026-1",
                "available_end_week_iso": "2026-W10",
            },
            {
                "fte_id": "fte_project",
                "available_start_week_iso": "2026-W01",
                "available_end_week_iso": "2026-10",
            },
        ]
    ).to_csv(tmp_path / "data_fte.csv", index=False)

    pd.DataFrame(
        [
            {
                "equipment_id": "setup_leg",
                "available_start_week_iso": "2026-W1",
                "available_end_week_iso": "2026-W10",
            },
            {
                "equipment_id": "setup_project",
                "available_start_week_iso": "2026-1",
                "available_end_week_iso": "2026-10",
            },
        ]
    ).to_csv(tmp_path / "data_equipment.csv", index=False)

    pd.DataFrame([{"test_id": "T_WILDCARD", "dut_id": 1}]).to_csv(
        tmp_path / "data_test_duts.csv", index=False
    )

    (tmp_path / "priority_config.json").write_text("{}", encoding="utf-8")
    (tmp_path / "scenario_overrides.json").write_text(
        json.dumps(
            {
                "project_overrides": {
                    "proj_a": {
                        "fte_assigned": "fte_project",
                        "equipment_assigned": "setup_project",
                    }
                },
                "leg_overrides": {
                    "leg_1": {
                        "fte_assigned": "fte_leg",
                        "equipment_assigned": "setup_leg",
                    }
                },
            }
        ),
        encoding="utf-8",
    )

    data = load_data(str(tmp_path))
    loaded_test = data.tests[0]

    assert data.legs["leg_1"].start_iso_week == "2026-W01.0"
    assert loaded_test.force_start_week_iso == "2026-W02.0"
    assert {window.start_iso_week for window in data.fte_windows} == {"2026-W01.0"}
    assert {window.end_iso_week for window in data.fte_windows} == {"2026-W10.0"}
    assert {window.start_iso_week for window in data.equipment_windows} == {
        "2026-W01.0"
    }
    assert {window.end_iso_week for window in data.equipment_windows} == {"2026-W10.0"}

    assert loaded_test.fte_assigned == "fte_leg"
    assert loaded_test.equipment_assigned == "setup_leg"
