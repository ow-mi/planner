#!/usr/bin/env python3
"""
Basic Usage Example for Test Planner V4

This example demonstrates the simplest way to use Test Planner V4
to solve a test planning problem.
"""

from planner_v4 import main


def basic_example():
    """
    Run a basic planning example with default settings.
    """
    print("Test Planner V4 - Basic Usage Example")
    print("=" * 40)

    # Run the planner with default settings
    # This will look for data in input_data/gen3_pv/senario_1
    solution = main()

    # Check the results
    print(f"Solution Status: {solution['status']}")

    if solution['status'] in ['OPTIMAL', 'FEASIBLE']:
        print(f"Project Duration: {solution['makespan']} days")
        print(f"Tests Scheduled: {len(solution['test_schedule'])}")

        # Show first few test schedules
        print("\nFirst 5 Test Schedules:")
        for i, test in enumerate(solution['test_schedule'][:5]):
            print(f"  {test.test_name}: {test.start_date} - {test.end_date}")

        # Show resource utilization
        print("\nResource Utilization:")
        for resource, utilization in solution['resource_utilization'].items():
            print("8.1f")

    else:
        print("No feasible solution found.")
        print("Check input data and constraints.")

    return solution


def custom_input_example():
    """
    Run planning with custom input folder and settings.
    """
    print("\nCustom Input Example")
    print("=" * 20)

    # Use custom input folder and settings
    solution = main(
        input_folder="input_data/gen3_pv/senario_2",
        debug_level="INFO",
        time_limit=120.0,  # 2 minute timeout
        output_folder="results/basic_example"
    )

    print(f"Custom run completed with status: {solution['status']}")

    return solution


if __name__ == "__main__":
    # Run basic example
    basic_result = basic_example()

    # Run custom example
    custom_result = custom_example()

    print("\nExamples completed successfully!")
