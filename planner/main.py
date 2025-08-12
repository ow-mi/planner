import os
from .planner_impl import plan_and_output
from .validate import validate_inputs, write_report


def main() -> None:
    # new output structure
    base_out = os.path.join("output")
    data_out = os.path.join(base_out, "data")
    plots_out = os.path.join(base_out, "plots")
    os.makedirs(data_out, exist_ok=True)
    os.makedirs(plots_out, exist_ok=True)

    # input folder renamed
    sample_dir = "input_data"

    # validate inputs first
    issues = validate_inputs(sample_dir)
    write_report(issues, data_out)

    # run planner, writing csvs to data_out and plots to plots_out
    plan_and_output(sample_dir=sample_dir, outputs_dir_data=data_out, outputs_dir_plots=plots_out)



