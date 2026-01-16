# planner_v4/reports/csv_reports.py

"""
CSV Report Generation for Test Planner V4

This module provides comprehensive CSV report generation from scheduling solutions.
It creates detailed reports for analysis, visualization, and integration with
external systems.

Report Types:
- Test Schedule: Detailed test-by-test scheduling results
- Resource Utilization: Resource usage statistics and percentages
- FTE Usage Timeseries: Daily FTE resource allocation over time
- Equipment Usage Timeseries: Daily equipment allocation over time
- Concurrency Timeseries: Test concurrency patterns over time

All reports are generated in CSV format for easy import into Excel, databases,
or visualization tools. Reports include comprehensive metadata and are optimized
for both human readability and automated processing.

Usage:
    from planner_v4.reports.csv_reports import generate_schedule_csv

    # Generate all reports after solving
    generate_schedule_csv(solution, "output/data")
    generate_resource_utilization_csv(solution, "output/data")
    generate_fte_usage_csv(solution, "output/data", project_start, makespan)

Functions:
    generate_schedule_csv: Main test schedule report
    generate_resource_utilization_csv: Resource usage summary
    generate_fte_usage_csv: FTE usage timeseries
    generate_equipment_usage_csv: Equipment usage timeseries
    generate_concurrency_timeseries_csv: Test concurrency analysis

Output Files:
    tests_schedule.csv: Complete test scheduling details
    resource_utilization.csv: Resource efficiency metrics
    fte_usage_timeseries.csv: Daily FTE allocation data
    equipment_usage_timeseries.csv: Daily equipment allocation data
    test_concurrency_timeseries.csv: Parallel test execution patterns
"""

import csv
import os
from datetime import date, timedelta
from typing import List, Dict, Any
from ..solver import SolutionResult, TestSchedule
from ..data_loader import PlanningData


def generate_schedule_csv(solution: SolutionResult, output_folder: str) -> str:
    """
    Generate the main test schedule CSV report with detailed scheduling results.

    Creates a comprehensive CSV file containing all test scheduling information,
    including dates, durations, and resource assignments. This is the primary
    output file for analyzing the optimization results.

    Args:
        solution (SolutionResult): Complete solution result from the solver
        output_folder (str): Output folder path where CSV will be saved

    Returns:
        str: Path to the generated CSV file (tests_schedule.csv)

    Output Format:
        CSV file named "tests_schedule.csv" with columns:
        - test_id: Unique test identifier
        - project_leg_id: Parent leg identifier
        - test_name: Human-readable test name
        - start_date: Test start date (YYYY-MM-DD)
        - start_time: Test start time (HH:MM:SS, currently always 00:00:00)
        - end_date: Test end date (YYYY-MM-DD)
        - end_time: Test end time (HH:MM:SS, currently always 00:00:00)
        - duration_days: Actual scheduled duration in days
        - assigned_fte: Semicolon-separated list of assigned FTE resources
        - assigned_equipment: Semicolon-separated list of assigned equipment resources

    Example:
        >>> from planner_v4 import main
        >>> solution = main(input_folder="input_data/gen3_pv/senario_1")
        >>> csv_path = generate_schedule_csv(solution, "output/data")
        >>> print(f"Schedule report saved to: {csv_path}")

    Note:
        Time fields currently show 00:00:00 as the system works with day-level granularity.
        Multiple resources are separated by semicolons for easy parsing.
        The CSV file is always named "tests_schedule.csv" in the output folder.
    """
    output_path = os.path.join(output_folder, "tests_schedule.csv")
    
    with open(output_path, 'w', newline='') as f:
        writer = csv.writer(f)
        
        # Header
        writer.writerow([
            "test_id", "project_leg_id", "test_name", 
            "start_date", "start_time", "end_date", "end_time", "duration_days",
            "assigned_fte", "assigned_equipment"
        ])
        
        # Data rows
        for schedule in solution.test_schedules:
            writer.writerow([
                schedule.test_id,
                schedule.project_leg_id,
                schedule.test_name,
                schedule.start_date.strftime("%Y-%m-%d"),
                schedule.start_date.strftime("%H:%M:%S"),
                schedule.end_date.strftime("%Y-%m-%d"),
                schedule.end_date.strftime("%H:%M:%S"),
                schedule.duration_days,
                ";".join(schedule.assigned_fte),
                ";".join(schedule.assigned_equipment)
            ])
    
    return output_path


def generate_resource_utilization_csv(solution: SolutionResult, output_folder: str) -> str:
    """
    Generate resource utilization summary CSV report.

    Creates a CSV file showing utilization percentages for all resources
    (FTE and equipment) used in the solution. This helps identify resource
    bottlenecks and overall efficiency.

    Args:
        solution (SolutionResult): Complete solution result with resource utilization data
        output_folder (str): Output folder path where CSV will be saved

    Returns:
        str: Path to the generated CSV file (resource_utilization.csv)

    Output Format:
        CSV file named "resource_utilization.csv" with columns:
        - resource_id: Unique resource identifier
        - utilization_percent: Resource utilization as percentage (0.00-100.00)

    Calculation:
        Utilization = (time_used / time_available) * 100
        Where time_available is based on resource windows and project duration

    Example:
        >>> solution = main(input_folder="input_data")
        >>> csv_path = generate_resource_utilization_csv(solution, "output/data")
        >>> print(f"Utilization report saved to: {csv_path}")

        Output CSV:
        resource_id,utilization_percent
        fte_sofia,85.50
        fte_hengelo,72.30
        EQUIP_SOLAR_001,90.75

    Note:
        High utilization (>80%) may indicate resource constraints.
        Low utilization (<30%) may indicate under-utilized resources.
    """
    output_path = os.path.join(output_folder, "resource_utilization.csv")
    
    with open(output_path, 'w', newline='') as f:
        writer = csv.writer(f)
        
        # Header
        writer.writerow(["resource_id", "utilization_percent"])
        
        # Data rows
        for resource_id, utilization in solution.resource_utilization.items():
            writer.writerow([resource_id, f"{utilization:.2f}"])
    
    return output_path


def generate_fte_usage_csv(
    solution: SolutionResult, 
    data: PlanningData, 
    start_date: date, 
    output_folder: str
) -> str:
    """Generate FTE usage CSV file with detailed resource assignments over time."""
    output_path = os.path.join(output_folder, "fte_usage.csv")
    
    fte_assignments = []
    
    # Create lookup map for tests
    tests_map = {t.test_id: t for t in data.tests}

    # Group schedules by FTE resource
    for schedule in solution.test_schedules:
        test = tests_map.get(schedule.test_id)
        
        for fte_id in schedule.assigned_fte:
            # Calculate actual FTE duration
            duration_days = float(schedule.duration_days)
            if test and test.fte_time_pct < 100.0:
                duration_days = duration_days * test.fte_time_pct / 100.0
            
            fte_assignments.append({
                'fte_id': fte_id,
                'test_id': schedule.test_id,
                'test_name': schedule.test_name,
                'start': start_date + timedelta(days=schedule.start_day),
                'end': start_date + timedelta(days=schedule.start_day + duration_days)
            })
    
    # Sort by FTE ID and start date
    fte_assignments.sort(key=lambda x: (x['fte_id'], x['start']))
    
    with open(output_path, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['fte_id', 'test_id', 'test_name', 'start', 'end'])
        
        for assignment in fte_assignments:
            writer.writerow([
                assignment['fte_id'],
                assignment['test_id'], 
                assignment['test_name'],
                assignment['start'].strftime('%Y-%m-%dT%H:%M:%S'),
                assignment['end'].strftime('%Y-%m-%dT%H:%M:%S')
            ])
    
    return output_path


def generate_equipment_usage_csv(
    solution: SolutionResult, 
    data: PlanningData, 
    start_date: date, 
    output_folder: str
) -> str:
    """Generate equipment usage CSV file with detailed resource assignments over time."""
    output_path = os.path.join(output_folder, "equipment_usage.csv")
    
    equipment_assignments = []
    
    # Group schedules by equipment resource
    for schedule in solution.test_schedules:
        for eq_id in schedule.assigned_equipment:
            equipment_assignments.append({
                'equipment_id': eq_id,
                'test_id': schedule.test_id,
                'test_name': schedule.test_name,
                'start': start_date + timedelta(days=schedule.start_day),
                'end': start_date + timedelta(days=schedule.start_day + schedule.duration_days)
            })
    
    # Sort by equipment ID and start date
    equipment_assignments.sort(key=lambda x: (x['equipment_id'], x['start']))
    
    with open(output_path, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['equipment_id', 'test_id', 'test_name', 'start', 'end'])
        
        for assignment in equipment_assignments:
            writer.writerow([
                assignment['equipment_id'],
                assignment['test_id'],
                assignment['test_name'], 
                assignment['start'].strftime('%Y-%m-%dT%H:%M:%S'),
                assignment['end'].strftime('%Y-%m-%dT%H:%M:%S')
            ])
    
    return output_path


def generate_concurrency_timeseries_csv(
    solution: SolutionResult, 
    data: PlanningData, 
    start_date: date, 
    output_folder: str
) -> str:
    """Generate concurrency time series CSV showing active tests and resource availability over time."""
    output_path = os.path.join(output_folder, "concurrency_timeseries.csv")
    
    if not solution.test_schedules:
        return output_path
    
    # Calculate the time range
    max_end_day = max(s.start_day + s.duration_days for s in solution.test_schedules)
    
    # Generate time series data (12-hour intervals)
    timeseries_data = []
    
    # Calculate availability from resource windows
    fte_availability_by_day = {}
    equipment_availability_by_day = {}
    
    for day in range(max_end_day + 1):
        current_date = start_date + timedelta(days=day)
        
        # Count available FTE
        available_fte = sum(1 for w in data.fte_windows 
                          if w.start_monday <= current_date <= w.end_monday)
        
        # Count available equipment
        available_equipment = sum(1 for w in data.equipment_windows 
                                if w.start_monday <= current_date <= w.end_monday)
        
        fte_availability_by_day[day] = available_fte
        equipment_availability_by_day[day] = available_equipment
    
    # Generate time series (12-hour intervals)
    for day in range(max_end_day + 1):
        for hour in [0, 12]:  # 00:00 and 12:00
            timestamp = start_date + timedelta(days=day, hours=hour)
            
            # Count active tests at this time
            active_tests = sum(1 for s in solution.test_schedules
                             if s.start_day <= day < s.start_day + s.duration_days)
            
            # Get resource availability for this day
            available_fte = fte_availability_by_day.get(day, 0)
            available_equipment = equipment_availability_by_day.get(day, 0)
            capacity_min = min(available_fte, available_equipment)
            
            timeseries_data.append({
                'timestamp': timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                'active_tests': active_tests,
                'available_fte': available_fte,
                'available_equipment': available_equipment,
                'capacity_min': capacity_min
            })
    
    # Write to CSV
    with open(output_path, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['timestamp', 'active_tests', 'available_fte', 'available_equipment', 'capacity_min'])
        
        for row in timeseries_data:
            writer.writerow([
                row['timestamp'],
                row['active_tests'],
                row['available_fte'],
                row['available_equipment'],
                row['capacity_min']
            ])
    
    return output_path