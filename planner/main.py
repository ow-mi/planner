import os
import argparse
import logging
from .planner_impl import plan_and_output
from .validate import validate_inputs, write_report
from .debug import configure_logging, info, warning, error, exception, set_debug_options


def main(input_folder: str = "input_data", debug_level: str = "INFO", log_to_file: bool = True) -> None:
    """
    Run the planning system with the given input folder.
    
    Args:
        input_folder: Path to the input data folder
        debug_level: Debug level (DEBUG, INFO, WARNING, ERROR)
        log_to_file: Whether to log to a file
    """
    # Initialize debugging system
    log_level = getattr(logging, debug_level.upper(), logging.INFO)
    log_dir = os.path.join(input_folder, "output", "logs")
    os.makedirs(log_dir, exist_ok=True)
    
    configure_logging(
        level=log_level,
        log_to_file=log_to_file,
        log_to_console=True,
        log_dir=log_dir,
        log_file="planner_debug.log"
    )
    
    info(f"Starting planning system with input folder: {input_folder}")
    info(f"Debug level: {debug_level}")
    
    # Setup output directories
    base_out = os.path.join(input_folder, "output")
    data_out = os.path.join(base_out, "data")
    plots_out = os.path.join(base_out, "plots")
    os.makedirs(data_out, exist_ok=True)
    os.makedirs(plots_out, exist_ok=True)
    
    info(f"Output directories: data={data_out}, plots={plots_out}")

    # Validate inputs first
    info("Validating input data")
    try:
        issues = validate_inputs(input_folder)
        write_report(issues, data_out)
        
        errors = sum(1 for it in issues if it.severity == "ERROR")
        warnings = sum(1 for it in issues if it.severity == "WARN")
        
        info(f"Validation complete: {errors} errors, {warnings} warnings")
        if errors > 0:
            error(f"Found {errors} validation errors - check validation_report.csv for details")
    except Exception as e:
        exception(f"Error during validation", {"error": str(e)})
        return

    # Run planner
    info("Running planner")
    try:
        plan_and_output(sample_dir=input_folder, outputs_dir_data=data_out, outputs_dir_plots=plots_out)
        info("Planning complete")
    except Exception as e:
        exception(f"Error during planning", {"error": str(e)})


