#!/usr/bin/env python3
"""
Custom Data Processing Example for Test Planner V4

This example demonstrates how to create custom data processing pipelines,
validate data programmatically, and integrate with external systems.
"""

import os
import sys
import pandas as pd
from datetime import date, timedelta
from typing import List, Dict

# Add planner_v4 to path if running as script
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from planner_v4.data_loader import PlanningData, Leg, Test, ResourceWindow
from planner_v4 import main


def create_sample_data():
    """
    Create a minimal sample dataset for demonstration.
    """
    print("Creating sample dataset...")

    # Create sample legs
    legs = [
        Leg(
            project_id="SAMPLE_001",
            project_name="Sample Project",
            project_leg_id="LEG_SAMPLE_1",
            leg_number="1",
            leg_name="Phase 1 Testing",
            priority=5,
            start_iso_week="2024-01",
            start_monday=date(2024, 1, 1)
        ),
        Leg(
            project_id="SAMPLE_001",
            project_name="Sample Project",
            project_leg_id="LEG_SAMPLE_2",
            leg_number="2",
            leg_name="Phase 2 Validation",
            priority=7,
            start_iso_week="2024-06",
            start_monday=date(2024, 2, 5)
        )
    ]

    # Create sample tests
    tests = [
        Test(
            test_id="TEST_SAMPLE_001",
            project_leg_id="LEG_SAMPLE_1",
            sequence_index=1,
            test_name="Basic Functionality Test",
            test_description="Test basic system functionality",
            duration_days=2.0,
            fte_required=1,
            equipment_required=1,
            fte_assigned="fte_engineer",
            equipment_assigned="EQUIP_TEST_RIG_001"
        ),
        Test(
            test_id="TEST_SAMPLE_002",
            project_leg_id="LEG_SAMPLE_1",
            sequence_index=2,
            test_name="Performance Test",
            test_description="Measure system performance metrics",
            duration_days=1.5,
            fte_required=2,
            equipment_required=1,
            fte_assigned="fte_engineer",
            equipment_assigned="EQUIP_TEST_RIG_001"
        ),
        Test(
            test_id="TEST_SAMPLE_003",
            project_leg_id="LEG_SAMPLE_2",
            sequence_index=1,
            test_name="Integration Test",
            test_description="Test system integration",
            duration_days=3.0,
            fte_required=1,
            equipment_required=2,
            fte_assigned="fte_senior_engineer",
            equipment_assigned="EQUIP_TEST_RIG_002"
        )
    ]

    # Create resource windows
    fte_windows = [
        ResourceWindow(
            resource_id="fte_engineer",
            start_iso_week="2024-01",
            end_iso_week="2024-26",
            start_monday=date(2024, 1, 1),
            end_monday=date(2024, 7, 1)
        ),
        ResourceWindow(
            resource_id="fte_senior_engineer",
            start_iso_week="2024-01",
            end_iso_week="2024-26",
            start_monday=date(2024, 1, 1),
            end_monday=date(2024, 7, 1)
        )
    ]

    equipment_windows = [
        ResourceWindow(
            resource_id="EQUIP_TEST_RIG_001",
            start_iso_week="2024-01",
            end_iso_week="2024-26",
            start_monday=date(2024, 1, 1),
            end_monday=date(2024, 7, 1)
        ),
        ResourceWindow(
            resource_id="EQUIP_TEST_RIG_002",
            start_iso_week="2024-01",
            end_iso_week="2024-26",
            start_monday=date(2024, 1, 1),
            end_monday=date(2024, 7, 1)
        )
    ]

    # Create minimal planning data
    data = PlanningData(
        legs={leg.project_leg_id: leg for leg in legs},
        tests=tests,
        fte_windows=fte_windows,
        equipment_windows=equipment_windows,
        priority_config={"rules": [], "weights": {"makespan_weight": 0.5, "priority_weight": 0.5}},
        test_duts=[],  # Empty for this simple example
        leg_dependencies=[]
    )

    print(f"✓ Created {len(legs)} legs")
    print(f"✓ Created {len(tests)} tests")
    print(f"✓ Created {len(fte_windows)} FTE resources")
    print(f"✓ Created {len(equipment_windows)} equipment resources")

    return data


def save_data_to_csv(data: PlanningData, output_folder: str):
    """
    Save planning data to CSV files for inspection or reuse.
    """
    print(f"Saving data to {output_folder}...")
    os.makedirs(output_folder, exist_ok=True)

    # Save legs
    legs_data = []
    for leg in data.legs.values():
        legs_data.append({
            'project_id': leg.project_id,
            'project_name': leg.project_name,
            'project_leg_id': leg.project_leg_id,
            'leg_number': leg.leg_number,
            'leg_name': leg.leg_name,
            'priority': leg.priority,
            'start_iso_week': leg.start_iso_week
        })

    pd.DataFrame(legs_data).to_csv(
        os.path.join(output_folder, 'data_legs.csv'),
        index=False
    )

    # Save tests
    tests_data = []
    for test in data.tests:
        tests_data.append({
            'test_id': test.test_id,
            'project_leg_id': test.project_leg_id,
            'sequence_index': test.sequence_index,
            'test_name': test.test_name,
            'test_description': test.test_description,
            'duration_days': test.duration_days,
            'fte_required': test.fte_required,
            'equipment_required': test.equipment_required,
            'fte_assigned': test.fte_assigned,
            'equipment_assigned': test.equipment_assigned,
            'force_start_week_iso': test.force_start_week_iso or ''
        })

    pd.DataFrame(tests_data).to_csv(
        os.path.join(output_folder, 'data_test.csv'),
        index=False
    )

    # Save FTE resources
    fte_data = []
    for window in data.fte_windows:
        fte_data.append({
            'resource_id': window.resource_id,
            'start_iso_week': window.start_iso_week,
            'end_iso_week': window.end_iso_week
        })

    pd.DataFrame(fte_data).to_csv(
        os.path.join(output_folder, 'data_fte.csv'),
        index=False
    )

    # Save equipment resources
    equipment_data = []
    for window in data.equipment_windows:
        equipment_data.append({
            'resource_id': window.resource_id,
            'start_iso_week': window.start_iso_week,
            'end_iso_week': window.end_iso_week
        })

    pd.DataFrame(equipment_data).to_csv(
        os.path.join(output_folder, 'data_equipment.csv'),
        index=False
    )

    # Save minimal priority config
    import json
    priority_config = {
        "rules": [
            {
                "name": "base_priority",
                "weight": 1.0,
                "function": "linear",
                "parameters": {"multiplier": 1.0}
            }
        ],
        "weights": {
            "makespan_weight": 0.5,
            "priority_weight": 0.5
        }
    }

    with open(os.path.join(output_folder, 'priority_config.json'), 'w') as f:
        json.dump(priority_config, f, indent=2)

    # Create empty test_duts file
    pd.DataFrame(columns=['test_id', 'dut_id']).to_csv(
        os.path.join(output_folder, 'data_test_duts.csv'),
        index=False
    )

    print("✓ Data saved to CSV files")


def validate_custom_data(data: PlanningData):
    """
    Perform custom validation on the planning data.
    """
    print("Validating custom data...")

    errors = []
    warnings = []

    # Check leg-test relationships
    leg_ids = set(data.legs.keys())
    test_leg_ids = set(test.project_leg_id for test in data.tests)

    orphaned_tests = test_leg_ids - leg_ids
    if orphaned_tests:
        errors.append(f"Tests reference non-existent legs: {orphaned_tests}")

    # Check resource availability
    fte_ids = set(window.resource_id for window in data.fte_windows)
    equipment_ids = set(window.resource_id for window in data.equipment_windows)

    required_fte = set(test.fte_assigned for test in data.tests if test.fte_assigned)
    required_equipment = set(test.equipment_assigned for test in data.tests if test.equipment_assigned and test.equipment_assigned != "*")

    missing_fte = required_fte - fte_ids
    missing_equipment = required_equipment - equipment_ids

    if missing_fte:
        errors.append(f"FTE resources not available: {missing_fte}")
    if missing_equipment:
        errors.append(f"Equipment resources not available: {missing_equipment}")

    # Check test sequences within legs
    for leg_id in leg_ids:
        leg_tests = [t for t in data.tests if t.project_leg_id == leg_id]
        sequences = sorted(set(t.sequence_index for t in leg_tests))

        if sequences != list(range(1, len(sequences) + 1)):
            warnings.append(f"Non-consecutive sequences in leg {leg_id}: {sequences}")

    # Report results
    if errors:
        print("❌ Validation errors:")
        for error in errors:
            print(f"  - {error}")
        return False

    if warnings:
        print("⚠️  Validation warnings:")
        for warning in warnings:
            print(f"  - {warning}")

    print("✓ Validation completed")
    return len(errors) == 0


def run_custom_data_example():
    """
    Complete example of creating, validating, and using custom data.
    """
    print("Test Planner V4 - Custom Data Processing Example")
    print("=" * 50)

    # Create custom data
    data = create_sample_data()
    print()

    # Validate the data
    is_valid = validate_custom_data(data)
    if not is_valid:
        print("Data validation failed. Please fix errors before proceeding.")
        return None
    print()

    # Save to CSV for inspection
    output_folder = "results/custom_data_example"
    save_data_to_csv(data, output_folder)
    print()

    # Run planning with the custom data
    print("Running planner with custom data...")
    solution = main(
        input_folder=output_folder,
        debug_level="INFO",
        time_limit=60.0,  # Short timeout for example
        output_folder="results/custom_planning_results"
    )

    print(f"\nPlanning completed with status: {solution['status']}")

    if solution['status'] in ['OPTIMAL', 'FEASIBLE']:
        print(f"Project makespan: {solution['makespan']} days")
        print(f"Tests scheduled: {len(solution['test_schedule'])}")

        print("\nTest Schedule:")
        for test in solution['test_schedule']:
            print(f"  {test.test_name}: {test.start_date} - {test.end_date}")

    return solution


def data_transformation_example():
    """
    Example of transforming existing data formats.
    """
    print("\nData Transformation Example")
    print("=" * 25)

    # Example: Convert from a different format
    # This could be reading from Excel, database, or other sources

    print("This example shows how to transform data from external sources...")
    print("(Actual transformation would depend on your data source)")

    # Simulate reading from external source
    external_data = {
        'projects': [
            {'id': 'EXT_001', 'name': 'External Project', 'priority': 6}
        ],
        'tasks': [
            {'id': 'TASK_001', 'project_id': 'EXT_001', 'name': 'External Task',
             'duration': 2.5, 'resources': ['Engineer', 'Lab']}
        ]
    }

    print("External data structure:")
    print(f"  Projects: {len(external_data['projects'])}")
    print(f"  Tasks: {len(external_data['tasks'])}")

    # Transformation logic would go here
    print("\nTransformation completed (simulated)")


if __name__ == "__main__":
    # Run custom data example
    solution = run_custom_data_example()

    # Run data transformation example
    data_transformation_example()

    print("\nCustom data examples completed!")
