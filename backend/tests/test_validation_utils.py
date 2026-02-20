from backend.src.utils.validation import ValidationUtils


def test_validate_priority_config_requires_deadlines_for_positive_leg_penalties():
    errors = ValidationUtils.validate_priority_config(
        {
            "mode": "leg_end_dates",
            "weights": {"makespan_weight": 0.2, "priority_weight": 0.8},
            "leg_deadline_penalties": {"mwcu__2.1": 500000},
        }
    )

    assert any(
        "leg_deadlines is required when leg_deadline_penalties contains positive values"
        in error
        for error in errors
    )


def test_validate_priority_config_accepts_matching_leg_deadlines_for_positive_penalties():
    errors = ValidationUtils.validate_priority_config(
        {
            "mode": "leg_end_dates",
            "weights": {"makespan_weight": 0.2, "priority_weight": 0.8},
            "leg_deadline_penalties": {"mwcu__2.1": 500000},
            "leg_deadlines": {"mwcu__2.1": "2026-02-01"},
        }
    )

    assert not any("leg_deadlines is required" in error for error in errors)
    assert not any("Missing leg_deadlines for penalty-enabled legs" in error for error in errors)
