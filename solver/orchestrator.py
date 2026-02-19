"""Planning pipeline orchestration for Test Planner V4."""

from __future__ import annotations

import logging
import os
from datetime import date
from typing import Callable, Optional, Union

from .config.priority_modes import BasePriorityConfig
from .data_loader import PlanningData, load_data
from .model_builder import ScheduleModel, build_model
from .reports.csv_reports import (
    generate_concurrency_timeseries_csv,
    generate_equipment_usage_csv,
    generate_fte_usage_csv,
    generate_resource_utilization_csv,
    generate_schedule_csv,
)
from .reports.plot_reports import generate_solution_artifacts
from .solver import SolutionResult, solve_model


def run_planning_pipeline(
    input_folder: str,
    output_folder: str,
    time_limit: float,
    priority_config: Optional[BasePriorityConfig] = None,
    *,
    setup_logging_fn: Optional[Callable[[str, str], None]] = None,
    debug_level: Optional[str] = None,
    load_data_fn: Callable[[str], PlanningData] = load_data,
    build_model_fn: Callable[
        [PlanningData, Optional[BasePriorityConfig]], ScheduleModel
    ] = build_model,
    solve_model_fn: Callable[
        [ScheduleModel, PlanningData, float],
        Union[SolutionResult, tuple[SolutionResult, date]],
    ] = solve_model,
    generate_solution_artifacts_fn: Callable[
        [SolutionResult, str, Optional[date]], tuple[str, str]
    ] = generate_solution_artifacts,
    generate_schedule_csv_fn: Callable[
        [SolutionResult, str], str
    ] = generate_schedule_csv,
    generate_resource_utilization_csv_fn: Callable[
        [SolutionResult, str], str
    ] = generate_resource_utilization_csv,
    generate_fte_usage_csv_fn: Callable[
        [SolutionResult, PlanningData, date, str], str
    ] = generate_fte_usage_csv,
    generate_equipment_usage_csv_fn: Callable[
        [SolutionResult, PlanningData, date, str], str
    ] = generate_equipment_usage_csv,
    generate_concurrency_timeseries_csv_fn: Callable[
        [SolutionResult, PlanningData, date, str], str
    ] = generate_concurrency_timeseries_csv,
) -> SolutionResult:
    """Run load->build->solve->report planning pipeline."""
    os.makedirs(output_folder, exist_ok=True)
    data_dir = os.path.join(output_folder, "data")
    plots_dir = os.path.join(output_folder, "plots")
    os.makedirs(data_dir, exist_ok=True)
    os.makedirs(plots_dir, exist_ok=True)

    if setup_logging_fn and debug_level:
        setup_logging_fn(debug_level, output_folder)

    logger = logging.getLogger(__name__)
    logger.info("=" * 60)
    logger.info("Test Planner V2 - Starting")
    logger.info("=" * 60)
    logger.info(f"Input folder: {input_folder}")
    logger.info(f"Output folder: {output_folder}")
    logger.info(f"Debug level: {debug_level}")
    logger.info(f"Time limit: {time_limit} seconds")

    try:
        logger.info("Step 1: Loading and validating input data...")
        data = load_data_fn(input_folder)
        logger.info("Successfully loaded:")
        logger.info(f"  - {len(data.legs)} project legs")
        logger.info(f"  - {len(data.tests)} tests")
        logger.info(f"  - {len(data.fte_windows)} FTE availability windows")
        logger.info(f"  - {len(data.equipment_windows)} equipment availability windows")

        logger.info("Step 2: Building constraint programming model...")
        if priority_config:
            logger.info(f"Using priority mode: {priority_config.mode.value}")
            logger.info(
                f"Priority config source: {priority_config.config_source or 'unknown'}"
            )

            if hasattr(priority_config, "bottleneck_threshold"):
                logger.info("Resource bottleneck config:")
                logger.info(
                    f"  - Bottleneck threshold: {priority_config.bottleneck_threshold}"
                )
                logger.info(
                    f"  - Resource balance weight: {priority_config.resource_balance_weight}"
                )
                logger.info(
                    f"  - Utilization target: {priority_config.utilization_target}"
                )
            elif hasattr(priority_config, "target_completion_date"):
                logger.info("Sticky end date config:")
                logger.info(
                    f"  - Target completion date: {priority_config.target_completion_date}"
                )
                logger.info(
                    f"  - Penalty per day late: {priority_config.penalty_per_day_late}"
                )
            elif hasattr(priority_config, "leg_deadlines"):
                logger.info("Leg end dates config:")
                logger.info(
                    f"  - Leg deadlines: {len(priority_config.leg_deadlines)} legs"
                )
                logger.info(
                    f"  - Deadline penalty per day: {priority_config.deadline_penalty_per_day}"
                )
                if hasattr(priority_config, "leg_compactness_penalty_per_day"):
                    logger.info(
                        "  - Leg compactness penalty per day: "
                        f"{priority_config.leg_compactness_penalty_per_day}"
                    )

            logger.info(f"  - Weights: {priority_config.weights}")
        else:
            logger.info("Using default priority mode: end_date_priority")

        model = build_model_fn(data, priority_config)
        logger.info("Model built with:")
        logger.info(f"  - {len(model.test_vars)} test variables")
        logger.info(
            f"  - {len(model.resource_assignments)} resource assignment variables"
        )
        logger.info(f"  - Time horizon: {model.horizon} days")

        logger.info("Step 3: Solving optimization problem...")
        solve_output = solve_model_fn(model, data, time_limit)
        if isinstance(solve_output, tuple):
            solution = solve_output[0]
        else:
            solution = solve_output
        start_date = solution.start_date
        logger.info(f"Solver completed with status: {solution.status}")
        logger.info(f"Solve time: {solution.solve_time_seconds:.2f} seconds")

        if solution.status in ["OPTIMAL", "FEASIBLE"]:
            logger.info("Solution found:")
            logger.info(f"  - Makespan: {solution.makespan_days} days")
            logger.info(f"  - Tests scheduled: {len(solution.test_schedules)}")
            logger.info(f"  - Objective value: {solution.objective_value}")
        else:
            logger.warning(f"No solution found - status: {solution.status}")

        logger.info("Step 4: Generating reports and visualizations...")
        plot_html_path, plot_png_path = generate_solution_artifacts_fn(
            solution, plots_dir, start_date
        )
        logger.info(f"Generated plot artifacts: {plot_html_path}, {plot_png_path}")

        if solution.status in ["OPTIMAL", "FEASIBLE"] and solution.test_schedules:
            generate_schedule_csv_fn(solution, data_dir)
            generate_resource_utilization_csv_fn(solution, data_dir)
            if start_date:
                generate_fte_usage_csv_fn(solution, data, start_date, data_dir)
                generate_equipment_usage_csv_fn(solution, data, start_date, data_dir)
                generate_concurrency_timeseries_csv_fn(
                    solution, data, start_date, data_dir
                )
            logger.info("All reports generated successfully!")
        else:
            logger.info(
                f"Generated summary for failed solution (status: {solution.status})"
            )

        logger.info("=" * 60)
        logger.info("Test Planner V2 - Completed Successfully")
        logger.info("=" * 60)
        return solution
    except Exception as exc:
        logger.error(f"Error during planning process: {exc}", exc_info=True)
        raise
