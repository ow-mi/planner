# planner_v2/reporter.py

"""
Generates reports and visualizations from the solved schedule.
"""

import os
import csv
from datetime import date, timedelta
from typing import List
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from .solver import SolutionResult, TestSchedule
from .data_loader import PlanningData


def generate_schedule_csv(solution: SolutionResult, output_folder: str):
    """Generate the main schedule CSV file."""
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
    
    print(f"Generated schedule CSV: {output_path}")


def generate_resource_utilization_csv(solution: SolutionResult, output_folder: str):
    """Generate resource utilization CSV file."""
    output_path = os.path.join(output_folder, "resource_utilization.csv")
    
    with open(output_path, 'w', newline='') as f:
        writer = csv.writer(f)
        
        # Header
        writer.writerow(["resource_id", "utilization_percent"])
        
        # Data rows
        for resource_id, utilization in solution.resource_utilization.items():
            writer.writerow([resource_id, f"{utilization:.2f}"])
    
    print(f"Generated resource utilization CSV: {output_path}")


def generate_summary_report(solution: SolutionResult, data: PlanningData, output_folder: str):
    """Generate a summary text report."""
    output_path = os.path.join(output_folder, "validation_summary.txt")
    
    with open(output_path, 'w') as f:
        f.write("Test Planner V2 - Solution Summary\n")
        f.write("=" * 40 + "\n\n")
        
        f.write(f"Solver Status: {solution.status}\n")
        f.write(f"Solve Time: {solution.solve_time_seconds:.2f} seconds\n")
        f.write(f"Makespan: {solution.makespan_days} days\n")
        f.write(f"Objective Value: {solution.objective_value}\n\n")
        
        f.write(f"Total Tests Scheduled: {len(solution.test_schedules)}\n")
        f.write(f"Total Project Legs: {len(data.legs)}\n\n")
        
        # Leg summary
        f.write("Leg Summary:\n")
        leg_test_counts = {}
        for schedule in solution.test_schedules:
            leg_id = schedule.project_leg_id
            if leg_id not in leg_test_counts:
                leg_test_counts[leg_id] = 0
            leg_test_counts[leg_id] += 1
        
        for leg_id, count in leg_test_counts.items():
            leg = data.legs[leg_id]
            f.write(f"  {leg_id} ({leg.leg_name}): {count} tests\n")
        
        f.write("\n")
        
        # Resource utilization summary
        f.write("Resource Utilization:\n")
        fte_utils = {rid: util for rid, util in solution.resource_utilization.items() if rid.startswith("fte_")}
        eq_utils = {rid: util for rid, util in solution.resource_utilization.items() if rid.startswith("setup_")}
        
        if fte_utils:
            avg_fte_util = sum(fte_utils.values()) / len(fte_utils)
            f.write(f"  Average FTE Utilization: {avg_fte_util:.2f}%\n")
            f.write(f"  FTE Range: {min(fte_utils.values()):.2f}% - {max(fte_utils.values()):.2f}%\n")
        
        if eq_utils:
            avg_eq_util = sum(eq_utils.values()) / len(eq_utils)
            f.write(f"  Average Equipment Utilization: {avg_eq_util:.2f}%\n")
            f.write(f"  Equipment Range: {min(eq_utils.values()):.2f}% - {max(eq_utils.values()):.2f}%\n")
    
    print(f"Generated summary report: {output_path}")


def generate_gantt_chart(solution: SolutionResult, output_folder: str, chart_type: str = "tests"):
    """Generate Gantt chart visualization."""
    if not solution.test_schedules:
        print("No test schedules to plot")
        return
    
    fig, ax = plt.subplots(figsize=(15, 10))
    
    if chart_type == "tests":
        # Group by project leg for better visualization
        leg_schedules = {}
        for schedule in solution.test_schedules:
            leg_id = schedule.project_leg_id
            if leg_id not in leg_schedules:
                leg_schedules[leg_id] = []
            leg_schedules[leg_id].append(schedule)
        
        y_pos = 0
        y_labels = []
        colors = plt.cm.Set3(range(len(leg_schedules)))
        
        for i, (leg_id, schedules) in enumerate(leg_schedules.items()):
            color = colors[i % len(colors)]
            
            for schedule in schedules:
                # Plot the test as a horizontal bar
                ax.barh(y_pos, schedule.duration_days, 
                       left=schedule.start_day, height=0.8,
                       color=color, alpha=0.7, 
                       label=leg_id if schedule == schedules[0] else "")
                
                # Add test name annotation
                mid_point = schedule.start_day + schedule.duration_days / 2
                ax.text(mid_point, y_pos, schedule.test_name, 
                       ha='center', va='center', fontsize=8, rotation=0)
                
                y_labels.append(f"{schedule.test_id}")
                y_pos += 1
        
        ax.set_yticks(range(len(y_labels)))
        ax.set_yticklabels(y_labels, fontsize=8)
        ax.set_ylabel("Tests")
        
    ax.set_xlabel("Days from Start")
    ax.set_title(f"Test Schedule Gantt Chart - {chart_type.title()}")
    ax.grid(True, alpha=0.3)
    ax.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
    
    plt.tight_layout()
    
    output_path = os.path.join(output_folder, f"gantt_{chart_type}.png")
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    plt.close()
    
    print(f"Generated Gantt chart: {output_path}")


def generate_resource_chart(solution: SolutionResult, output_folder: str, resource_type: str = "fte"):
    """Generate resource utilization chart."""
    if not solution.resource_utilization:
        print("No resource utilization data to plot")
        return
    
    # Filter resources by type
    resources = {rid: util for rid, util in solution.resource_utilization.items() 
                if rid.startswith(f"{resource_type}_")}
    
    if not resources:
        print(f"No {resource_type} resources found")
        return
    
    fig, ax = plt.subplots(figsize=(12, 6))
    
    resource_ids = list(resources.keys())
    utilizations = list(resources.values())
    
    bars = ax.bar(range(len(resource_ids)), utilizations, 
                  color='skyblue', alpha=0.7)
    
    # Add value labels on bars
    for bar, util in zip(bars, utilizations):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height + 1,
                f'{util:.1f}%', ha='center', va='bottom')
    
    ax.set_xticks(range(len(resource_ids)))
    ax.set_xticklabels(resource_ids, rotation=45, ha='right')
    ax.set_ylabel("Utilization (%)")
    ax.set_title(f"{resource_type.upper()} Resource Utilization")
    ax.set_ylim(0, max(utilizations) * 1.1 + 5)
    ax.grid(True, alpha=0.3, axis='y')
    
    plt.tight_layout()
    
    output_path = os.path.join(output_folder, f"resource_{resource_type}.png")
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    plt.close()
    
    print(f"Generated {resource_type} resource chart: {output_path}")


def generate_validation_report(solution: SolutionResult, data: PlanningData, output_folder: str):
    """Generate detailed validation report CSV."""
    output_path = os.path.join(output_folder, "validation_report.csv")
    
    validation_results = []
    
    # Check sequencing within legs
    leg_schedules = {}
    for schedule in solution.test_schedules:
        leg_id = schedule.project_leg_id
        if leg_id not in leg_schedules:
            leg_schedules[leg_id] = []
        leg_schedules[leg_id].append(schedule)
    
    for leg_id, schedules in leg_schedules.items():
        # Sort by start time
        schedules.sort(key=lambda s: s.start_day)
        
        # Get original sequence from data
        leg_tests = [t for t in data.tests if t.project_leg_id == leg_id]
        leg_tests.sort(key=lambda t: t.sequence_index)
        
        # Check if scheduled order matches required sequence
        scheduled_test_ids = [s.test_id for s in schedules]
        required_test_ids = [t.test_id for t in leg_tests]
        
        sequence_correct = scheduled_test_ids == required_test_ids
        
        validation_results.append({
            "check_type": "sequence_order",
            "leg_id": leg_id,
            "status": "PASS" if sequence_correct else "FAIL",
            "details": f"Required: {required_test_ids}, Scheduled: {scheduled_test_ids}"
        })
    
    # Check resource assignments
    for schedule in solution.test_schedules:
        test = next(t for t in data.tests if t.test_id == schedule.test_id)
        
        # Check FTE assignment count
        fte_correct = len(schedule.assigned_fte) == test.fte_required
        validation_results.append({
            "check_type": "fte_assignment",
            "test_id": schedule.test_id,
            "status": "PASS" if fte_correct else "FAIL",
            "details": f"Required: {test.fte_required}, Assigned: {len(schedule.assigned_fte)}"
        })
        
        # Check equipment assignment count
        eq_correct = len(schedule.assigned_equipment) == test.equipment_required
        validation_results.append({
            "check_type": "equipment_assignment", 
            "test_id": schedule.test_id,
            "status": "PASS" if eq_correct else "FAIL",
            "details": f"Required: {test.equipment_required}, Assigned: {len(schedule.assigned_equipment)}"
        })
    
    # Write validation report
    with open(output_path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=["check_type", "test_id", "leg_id", "status", "details"])
        writer.writeheader()
        writer.writerows(validation_results)
    
    print(f"Generated validation report: {output_path}")


def generate_fte_usage_csv(solution: SolutionResult, data: PlanningData, start_date: date, output_folder: str):
    """Generate FTE usage CSV file with detailed resource assignments over time."""
    output_path = os.path.join(output_folder, "fte_usage.csv")
    
    fte_assignments = []
    
    # Group schedules by FTE resource
    for schedule in solution.test_schedules:
        for fte_id in schedule.assigned_fte:
            fte_assignments.append({
                'fte_id': fte_id,
                'test_id': schedule.test_id,
                'test_name': schedule.test_name,
                'start': start_date + timedelta(days=schedule.start_day),
                'end': start_date + timedelta(days=schedule.start_day + schedule.duration_days)
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
    
    print(f"Generated FTE usage CSV: {output_path}")


def generate_equipment_usage_csv(solution: SolutionResult, data: PlanningData, start_date: date, output_folder: str):
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
    
    print(f"Generated equipment usage CSV: {output_path}")


def generate_concurrency_timeseries_csv(solution: SolutionResult, data: PlanningData, start_date: date, output_folder: str):
    """Generate concurrency time series CSV showing active tests and resource availability over time."""
    output_path = os.path.join(output_folder, "concurrency_timeseries.csv")
    
    if not solution.test_schedules:
        print("No test schedules available for concurrency analysis")
        return
    
    # Calculate the time range
    max_end_day = max(s.start_day + s.duration_days for s in solution.test_schedules)
    
    # Generate time series data (12-hour intervals)
    timeseries_data = []
    
    # Get all unique FTE and equipment resources
    all_fte = set()
    all_equipment = set()
    
    for schedule in solution.test_schedules:
        all_fte.update(schedule.assigned_fte)
        all_equipment.update(schedule.assigned_equipment)
    
    # Calculate availability from resource windows
    fte_availability_by_day = {}
    equipment_availability_by_day = {}
    
    for day in range(max_end_day + 1):
        current_date = start_date + timedelta(days=day)
        
        # Count available FTE
        available_fte = 0
        for resource_window in data.fte_windows:
            if resource_window.start_monday <= current_date <= resource_window.end_monday:
                available_fte += 1
        
        # Count available equipment
        available_equipment = 0
        for resource_window in data.equipment_windows:
            if resource_window.start_monday <= current_date <= resource_window.end_monday:
                available_equipment += 1
        
        fte_availability_by_day[day] = available_fte
        equipment_availability_by_day[day] = available_equipment
    
    # Generate time series (12-hour intervals)
    for day in range(max_end_day + 1):
        for hour in [0, 12]:  # 00:00 and 12:00
            timestamp = start_date + timedelta(days=day, hours=hour)
            
            # Count active tests at this time
            active_tests = 0
            for schedule in solution.test_schedules:
                test_start_time = start_date + timedelta(days=schedule.start_day)
                test_end_time = start_date + timedelta(days=schedule.start_day + schedule.duration_days)
                
                if test_start_time <= timestamp < test_end_time:
                    active_tests += 1
            
            # Get resource availability for this day
            available_fte = fte_availability_by_day.get(day, 0)
            available_equipment = equipment_availability_by_day.get(day, 0)
            
            # Capacity is the minimum of available FTE and equipment
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
    
    print(f"Generated concurrency timeseries CSV: {output_path}")


def generate_reports(solution: SolutionResult, data: PlanningData, output_folder: str, start_date: date = None):
    """
    Generate all output files and reports from the solution.
    
    Args:
        solution: The solver solution result
        data: Original planning data  
        output_folder: Directory to save output files
        start_date: Project start date for time series calculations
    """
    # Create output directories
    data_dir = os.path.join(output_folder, "data")
    plots_dir = os.path.join(output_folder, "plots")
    os.makedirs(data_dir, exist_ok=True)
    os.makedirs(plots_dir, exist_ok=True)
    
    print(f"Generating reports to {output_folder}...")
    
    if solution.status in ["OPTIMAL", "FEASIBLE"] and solution.test_schedules:
        # Generate CSV files
        generate_schedule_csv(solution, data_dir)
        generate_resource_utilization_csv(solution, data_dir)
        generate_validation_report(solution, data, data_dir)
        
        # Generate additional CSV files for plotting
        if start_date:
            generate_fte_usage_csv(solution, data, start_date, data_dir)
            generate_equipment_usage_csv(solution, data, start_date, data_dir)
            generate_concurrency_timeseries_csv(solution, data, start_date, data_dir)
        
        # Generate summary
        generate_summary_report(solution, data, data_dir)
        
        # Generate visualizations
        generate_gantt_chart(solution, plots_dir, "tests")
        generate_resource_chart(solution, plots_dir, "fte") 
        generate_resource_chart(solution, plots_dir, "equipment")
        
        print("All reports generated successfully!")
    else:
        # Generate minimal report for failed solutions
        generate_summary_report(solution, data, data_dir)
        print(f"Generated summary for failed solution (status: {solution.status})")
