import os
from .planner_impl import plan_and_output


def main() -> None:
    # new output structure
    base_out = os.path.join("output")
    data_out = os.path.join(base_out, "data")
    plots_out = os.path.join(base_out, "plots")
    os.makedirs(data_out, exist_ok=True)
    os.makedirs(plots_out, exist_ok=True)

    # input folder renamed
    sample_dir = "input_data"

    # run planner, writing csvs to data_out and plots to plots_out
    plan_and_output(sample_dir=sample_dir, outputs_dir_data=data_out, outputs_dir_plots=plots_out)



