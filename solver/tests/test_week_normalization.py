import os
import sys

import pandas as pd
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from solver.data_loader import (
    load_legs,
    load_resource_windows,
    load_tests,
    normalize_week_value,
    parse_iso_week,
    load_test_duts,
)
from solver.utils.data_validation import validate_iso_week_format


@pytest.mark.parametrize(
    "raw_value, expected",
    [
        ("2025-W02", "2025-W02.0"),
        ("2025-W2", "2025-W02.0"),
        ("2025-02", "2025-W02.0"),
        ("2025-W02.0", "2025-W02.0"),
        (" 2025-W9 ", "2025-W09.0"),
    ],
)
def test_accepts_legacy_formats(raw_value, expected):
    assert normalize_week_value(raw_value, "week_field") == expected
    assert validate_iso_week_format(raw_value)


@pytest.mark.parametrize(
    "raw_value",
    ["", "*", "2025-W00", "2025-W54", "2025-W2.x", "2025-W02.7", "bogus"],
)
def test_rejects_invalid_week_values(raw_value):
    with pytest.raises(ValueError, match="Invalid week value"):
        normalize_week_value(raw_value, "week_field")
    assert not validate_iso_week_format(raw_value)


@pytest.mark.parametrize(
    "iso_week, expected_iso_date",
    [
        ("2025-W02.0", "2025-01-06"),
        ("2025-W02.1", "2025-01-07"),
        ("2025-W02.6", "2025-01-12"),
    ],
)
def test_parse_iso_week_fraction_maps_to_monday_day_offsets(
    iso_week, expected_iso_date
):
    assert parse_iso_week(iso_week).isoformat() == expected_iso_date


def test_loader_paths_store_canonical_week_values(tmp_path):
    pd.DataFrame(
        [
            {
                "project_id": "proj",
                "project_name": "Project",
                "project_leg_id": "leg_1",
                "leg_number": "1",
                "leg_name": "Leg",
                "priority": 1,
                "start_iso_week": "2026-2",
            }
        ]
    ).to_csv(tmp_path / "data_legs.csv", index=False)

    pd.DataFrame(
        [
            {
                "test_id": "T1",
                "project_leg_id": "leg_1",
                "sequence_index": 1,
                "test": "Test",
                "test_description": "desc",
                "duration_days": 1.0,
                "fte_required": 1,
                "equipment_required": 1,
                "fte_assigned": "fte_a",
                "equipment_assigned": "setup_a",
                "force_start_week_iso": "2026-W03",
            }
        ]
    ).to_csv(tmp_path / "data_test.csv", index=False)

    pd.DataFrame(
        [
            {
                "fte_id": "fte_a",
                "available_start_week_iso": "2026-W3",
                "available_end_week_iso": "2026-10",
            }
        ]
    ).to_csv(tmp_path / "data_fte.csv", index=False)

    pd.DataFrame(
        [
            {
                "equipment_id": "setup_a",
                "available_start_week_iso": "2026-W3.0",
                "available_end_week_iso": "2026-W10",
            }
        ]
    ).to_csv(tmp_path / "data_equipment.csv", index=False)

    legs = load_legs(str(tmp_path))
    tests = load_tests(str(tmp_path))
    fte_windows = load_resource_windows(str(tmp_path), "fte")
    equipment_windows = load_resource_windows(str(tmp_path), "equipment")

    assert legs["leg_1"].start_iso_week == "2026-W02.0"
    assert tests[0].force_start_week_iso == "2026-W03.0"
    assert fte_windows[0].start_iso_week == "2026-W03.0"
    assert fte_windows[0].end_iso_week == "2026-W10.0"
    assert equipment_windows[0].start_iso_week == "2026-W03.0"
    assert equipment_windows[0].end_iso_week == "2026-W10.0"


def test_rejects_duplicate_dut_entries(tmp_path):
    # Create test data with duplicate DUT entries for same test_id
    pd.DataFrame(
        [
            {
                "project_id": "proj",
                "project_name": "Project",
                "project_leg_id": "leg_1",
                "leg_number": "1",
                "leg_name": "Leg",
                "priority": 1,
                "start_iso_week": "2026-2",
            }
        ]
    ).to_csv(tmp_path / "data_legs.csv", index=False)

    pd.DataFrame(
        [
            {
                "test_id": "T1",
                "project_leg_id": "leg_1",
                "sequence_index": 1,
                "test": "Test",
                "test_description": "desc",
                "duration_days": 1.0,
                "fte_required": 1,
                "equipment_required": 1,
                "fte_assigned": "fte_a",
                "equipment_assigned": "setup_a",
            }
        ]
    ).to_csv(tmp_path / "data_test.csv", index=False)

    pd.DataFrame(
        [
            {
                "fte_id": "fte_a",
                "available_start_week_iso": "2026-W3",
                "available_end_week_iso": "2026-10",
            }
        ]
    ).to_csv(tmp_path / "data_fte.csv", index=False)

    pd.DataFrame(
        [
            {
                "equipment_id": "setup_a",
                "available_start_week_iso": "2026-W3.0",
                "available_end_week_iso": "2026-W10",
            }
        ]
    ).to_csv(tmp_path / "data_equipment.csv", index=False)

    # Create data_test_duts.csv with duplicate entries
    pd.DataFrame(
        [
            {"test_id": "T1", "dut_id": 1},
            {"test_id": "T1", "dut_id": 2},  # Duplicate test_id
        ]
    ).to_csv(tmp_path / "data_test_duts.csv", index=False)

    with pytest.raises(
        ValueError, match="data_test_duts.csv has duplicate test_id entries"
    ):
        load_test_duts(str(tmp_path), load_tests(str(tmp_path)))
