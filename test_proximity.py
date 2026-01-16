#!/usr/bin/env python3
"""
Test script for Test Proximity Constraints implementation.
"""

import sys
import os
sys.path.append('planner_v4')

from planner_v4.config.priority_modes import load_priority_config_from_dict, create_priority_config, PriorityMode
from planner_v4.data_loader import load_priority_config

def test_basic_functionality():
    """Test that basic functionality works without proximity rules."""

    # Test configuration without proximity rules (basic leg_end_dates)
    config_dict = {
        "mode": "leg_end_dates",
        "weights": {
            "makespan_weight": 0.2,
            "priority_weight": 0.8
        },
        "leg_deadlines": {
            "mwcu_b10_2.1": "2028-12-01",
        },
        "deadline_penalty_per_day": 1000.0
    }

    print("Testing basic configuration loading...")
    config = load_priority_config_from_dict(config_dict)

    print(f"Config type: {type(config)}")
    print(f"Config mode: {config.mode}")
    print(f"Has test_proximity_rules: {hasattr(config, 'test_proximity_rules')}")

    # Test validation
    errors = config.validate()
    print(f"Validation errors: {errors}")

    if not errors:
        print("✓ Basic configuration test passed!")
    else:
        print("✗ Basic configuration test failed!")
        return False

    return True

def test_proximity_config():
    """Test that proximity configuration is loaded correctly."""

    # Test configuration with proximity rules
    config_dict = {
        "mode": "leg_end_dates",
        "weights": {
            "makespan_weight": 0.2,
            "priority_weight": 0.8
        },
        "leg_deadlines": {
            "mwcu_b10_2.1": "2028-12-01",
        },
        "deadline_penalty_per_day": 1000.0,
        "test_proximity_rules": {
            "patterns": ["p-02", "p-03"],
            "max_gap_days": 30,
            "proximity_penalty_per_day": 50.0,
            "enforce_sequence_order": True
        }
    }

    print("\nTesting proximity configuration loading...")
    config = load_priority_config_from_dict(config_dict)

    print(f"Config type: {type(config)}")
    print(f"Config mode: {config.mode}")
    print(f"Has test_proximity_rules: {hasattr(config, 'test_proximity_rules')}")

    if hasattr(config, 'test_proximity_rules'):
        rules = config.test_proximity_rules
        print(f"Patterns: {rules['patterns']}")
        print(f"Max gap days: {rules['max_gap_days']}")
        print(f"Penalty per day: {rules['proximity_penalty_per_day']}")
        print(f"Enforce sequence: {rules['enforce_sequence_order']}")

    # Test validation
    errors = config.validate()
    print(f"Validation errors: {errors}")

    if not errors:
        print("✓ Proximity configuration test passed!")
    else:
        print("✗ Proximity configuration test failed!")
        return False

    return True

def test_load_from_file():
    """Test loading config from the actual file."""

    input_folder = "input_data/gen3_pv/senario_3b_fte_8_sofia_hengelo_project_mw"
    print(f"\nTesting loading from folder: {input_folder}")

    try:
        config_dict = load_priority_config(input_folder)
        config = load_priority_config_from_dict(config_dict)

        print(f"Loaded config type: {type(config)}")
        print(f"Config mode: {config.mode}")
        print(f"Has test_proximity_rules: {hasattr(config, 'test_proximity_rules')}")

        # Test validation
        errors = config.validate()
        print(f"Validation errors: {errors}")

        if not errors:
            print("✓ Successfully loaded configuration from file!")
            return True
        else:
            print("✗ Configuration validation failed!")
            return False

    except Exception as e:
        print(f"✗ Error loading config: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success1 = test_basic_functionality()
    success2 = test_proximity_config()
    success3 = test_load_from_file()

    if success1 and success2 and success3:
        print("\n🎉 All tests passed!")
    else:
        print("\n❌ Some tests failed!")
