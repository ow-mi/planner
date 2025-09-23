# planner_v2/tests/test_runner.py

"""
Test runner for the planner scenarios.
"""

import os
import sys

# Add the parent directory to the path to allow imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import run_planner

def run_all_tests():
    """
    Runs the planner for all scenarios in the gen3_pv directory.
    """
    scenarios_path = "input_data/gen3_pv"
    scenarios = [s for s in os.listdir(scenarios_path) if os.path.isdir(os.path.join(scenarios_path, s))]

    for scenario in scenarios:
        print(f"--- Running test for scenario: {scenario} ---")
        input_folder = os.path.join(scenarios_path, scenario)
        try:
            run_planner(input_folder, "INFO")
            print(f"--- Scenario {scenario}: SUCCESS ---")
        except Exception as e:
            print(f"--- Scenario {scenario}: FAILED ---")
            print(f"Error: {e}")
        print("\\n")

if __name__ == "__main__":
    run_all_tests()
