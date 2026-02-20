import os
import sys

import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from solver.data_loader import load_tests


def test_load_tests_parses_semicolon_assignment_lists(tmp_path):
    tests_path = tmp_path / "data_test.csv"
    pd.DataFrame(
        [
            {
                "project_leg_id": "leg_1",
                "test_id": "T1",
                "sequence_index": 1,
                "test": "Leak",
                "test_description": "Leak",
                "duration_days": 3.0,
                "fte_required": 1,
                "equipment_required": 1,
                "fte_assigned": "fte_alice;fte_bob",
                "equipment_assigned": "setup_rig_1;setup_rig_2",
            }
        ]
    ).to_csv(tests_path, index=False)

    loaded_tests = load_tests(str(tmp_path))

    assert len(loaded_tests) == 1
    loaded = loaded_tests[0]
    assert loaded.fte_assigned == ["fte_alice", "fte_bob"]
    assert loaded.equipment_assigned == ["setup_rig_1", "setup_rig_2"]
