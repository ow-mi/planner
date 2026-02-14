#!/usr/bin/env python3
"""
Advanced Configuration Example for Test Planner V4

This example demonstrates advanced usage with custom configuration,
step-by-step execution, and detailed result analysis.
"""

import os
import sys
from datetime import datetime

# Add planner_v4 to path if running as script
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from planner_v4.data_loader import load_data
from planner_v4.model_builder import build_model
from planner_v4.solver import solve_model
from planner_v4.reports.csv_reports import (
    generate_schedule_csv,
    generate_resource_utilization_csv,
    generate_fte_usage_csv,
    generate_equipment_usage_csv
)


def advanced_planning_example():
    """
    Complete step-by-step planning process with detailed analysis.
    """
    print("Test Planner V4 - Advanced Configuration Example")
    print("=" * 50)

    # Configuration
    input_folder = "input_data/gen3_pv/senario_1"
    output_folder = f"results/advanced_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    time_limit = 300.0  # 5 minutes

    print(f"Input folder: {input_folder}")
    print(f"Output folder: {output_folder}")
    print(f"Time limit: {time_limit} seconds")
    print()

    try:
        # Step 1: Load and validate data
        print("Step 1: Loading data...")
        data = load_data(input_folder)
        print(f"  ✓ Loaded {len(data.legs)} legs")
        print(f"  ✓ Loaded {len(data.tests)} tests")
        print(f"  ✓ Loaded {len(data.fte_windows)} FTE windows")
        print(f"  ✓ Loaded {len(data.equipment_windows)} equipment windows")
        print()

        # Step 2: Build optimization model
        print("Step 2: Building optimization model...")
        model = build_model(data)
        print(f"  ✓ Model built with horizon of {model.horizon} days")
        print(f"  ✓ Created {len(model.test_vars)} test variables")
        print()

        # Step 3: Solve the optimization problem
        print("Step 3: Solving optimization problem...")
        solution = solve_model(model, data, time_limit_seconds=time_limit)
        print(f"  ✓ Solution status: {solution.status}")
        print(f"  ✓ Solve time: {solution.solver_stats.get('solve_time', 'N/A'):.2f} seconds")
        print()

        # Step 4: Analyze results
        if solution.status in ['OPTIMAL', 'FEASIBLE']:
            print("Step 4: Analyzing results...")
            analyze_solution(solution, data, output_folder)
        else:
            print("Step 4: No feasible solution found")
            print(f"  Reason: {solution.status}")
            if solution.solver_stats:
                print(f"  Solver statistics: {solution.solver_stats}")

        return solution

    except Exception as e:
        print(f"Error during planning: {e}")
        raise


def analyze_solution(solution, data, output_folder):
    """
    Perform detailed analysis of the solution results.
    """
    os.makedirs(output_folder, exist_ok=True)

    # Basic statistics
    print(f"Project makespan: {solution.makespan} days")
    print(f"Total tests scheduled: {len(solution.test_schedule)}")

    # Date range analysis
    start_dates = [test.start_date for test in solution.test_schedule]
    end_dates = [test.end_date for test in solution.test_schedule]

    actual_start = min(start_dates)
    actual_end = max(end_dates)

    print(f"Project start: {actual_start}")
    print(f"Project end: {actual_end}")
    print(f"Calendar duration: {(actual_end - actual_start).days} days")
    print()

    # Resource utilization summary
    print("Resource Utilization Summary:")
    high_utilization = []
    for resource, utilization in solution.resource_utilization.items():
        status = "HIGH" if utilization > 80 else "OK"
        if utilization > 80:
            high_utilization.append(resource)
        print("6.1f")

    if high_utilization:
        print(f"\n⚠️  High utilization resources: {', '.join(high_utilization)}")
    print()

    # Generate detailed reports
    print("Generating detailed reports...")
    generate_reports(solution, data, output_folder)
    print("✓ Reports generated successfully")
    print(f"  Output directory: {output_folder}")


def generate_reports(solution, data, output_folder):
    """
    Generate comprehensive CSV reports.
    """
    # Schedule report
    schedule_file = os.path.join(output_folder, "test_schedule.csv")
    project_start = min(leg.start_monday for leg in data.legs.values())
    generate_schedule_csv(solution.test_schedule, schedule_file, project_start)

    # Resource utilization report
    utilization_file = os.path.join(output_folder, "resource_utilization.csv")
    generate_resource_utilization_csv(solution.resource_utilization, utilization_file)

    # Time series reports
    fte_usage_file = os.path.join(output_folder, "fte_usage_timeseries.csv")
    equipment_usage_file = os.path.join(output_folder, "equipment_usage_timeseries.csv")

    generate_fte_usage_csv(
        solution.test_schedule,
        project_start,
        fte_usage_file,
        solution.makespan
    )

    generate_equipment_usage_csv(
        solution.test_schedule,
        project_start,
        equipment_usage_file,
        solution.makespan
    )


def performance_comparison_example():
    """
    Compare performance with different time limits.
    """
    print("\nPerformance Comparison Example")
    print("=" * 30)

    input_folder = "input_data/gen3_pv/senario_1"
    time_limits = [30, 60, 120, 300]  # seconds

    results = []

    for time_limit in time_limits:
        print(f"\nTesting with {time_limit}s time limit...")
        try:
            data = load_data(input_folder)
            model = build_model(data)
            solution = solve_model(model, data, time_limit_seconds=time_limit)

            result = {
                'time_limit': time_limit,
                'status': solution.status,
                'solve_time': solution.solver_stats.get('solve_time', 0),
                'makespan': solution.makespan if solution.makespan else None
            }
            results.append(result)

            print(f"  Status: {result['status']}")
            print(f"  Solve time: {result['solve_time']:.2f}s")
            if result['makespan']:
                print(f"  Makespan: {result['makespan']} days")

        except Exception as e:
            print(f"  Error: {e}")

    # Summary
    print("\nPerformance Summary:")
    print("Time Limit | Status | Solve Time | Makespan")
    print("-----------|--------|------------|----------")
    for result in results:
        print("10s")


if __name__ == "__main__":
    # Run advanced example
    solution = advanced_planning_example()

    # Run performance comparison
    performance_comparison_example()

    print("\nAdvanced examples completed!")
