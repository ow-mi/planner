# Test Planner V2

This document outlines the architecture and implementation of the second version of the Test Planner, a constraint-based scheduling tool designed to optimize test schedules based on resource availability and project priorities.

## 1. Overview

The Test Planner V2 is a complete rewrite of the original planner, designed with a focus on modularity, testability, and maintainability. It uses the Google OR-Tools constraint solver to find optimal schedules for a set of tests, considering various constraints such as resource availability (both personnel and equipment), test sequencing, and project deadlines.

The core goal of the planner is to generate a feasible and optimized schedule that minimizes the overall project duration while adhering to all specified constraints.

## 2. Architecture

The planner is designed with a modular architecture, separating the distinct concerns of data loading, model building, solving, and reporting into individual components. This separation makes the system easier to understand, maintain, and test.

The main components are:

-   **`main.py`**: The entry point of the application. It orchestrates the entire planning process, calling the other modules in sequence.
-   **`data_loader.py`**: Responsible for loading all input data from CSV files, validating the data integrity, and transforming it into a structured format that the rest of the application can use.
-   **`model_builder.py`**: Contains the logic for building the constraint programming model using Google OR-Tools. It defines the variables, constraints, and objective function based on the input data.
-   **`solver.py`**: This module takes the constructed model, runs the solver, and processes the results. It includes logic for handling different solver statuses (e.g., optimal, feasible, no solution).
-   **`reporter.py`**: Responsible for generating all output files, including the final schedule in CSV format and various graphical representations of the plan (e.g., Gantt charts).
-   **`config.py`**: A centralized location for all configuration parameters, such as file paths, solver settings, and logging levels.
-   **`debug.py`**: A utility module for logging and debugging, providing a standardized way to output information at different levels of verbosity.

## 3. How to Rebuild and Run the Planner

To rebuild and run the planner from scratch, follow these steps:

### 3.1. Prerequisites

-   Python 3.8+
-   Pip (Python package installer)

### 3.2. Installation

1.  **Clone the repository**:
    ```bash
    git clone <repository_url>
    cd <repository_directory>
    ```

2.  **Set up a virtual environment** (recommended):
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
    ```

3.  **Install the required packages**:
    A `requirements.txt` file will be provided with all the necessary dependencies.
    ```bash
    pip install -r planner_v2/requirements.txt
    ```

### 3.3. Running the Planner

The planner is run from the command line, specifying the input data directory and the desired debug level.

```bash
python planner_v2/main.py --input-folder <path_to_input_data> --debug-level <DEBUG|INFO|WARNING|ERROR>
```

For example, to run the planner on `senario_1`:

```bash
python planner_v2/main.py --input-folder input_data/gen3_pv/senario_1 --debug-level DEBUG
```

## 4. Testing

The `planner_v2` directory will include a `tests` subdirectory with a suite of automated tests to ensure the correctness and stability of the planner. The tests will cover each of the scenarios provided in the `input_data/gen3_pv` directory.

To run the tests, a test runner script will be provided.

This structure will ensure that the new planner is robust, easy to work with, and well-documented.

## 5. Solver Documentation

For a detailed explanation of the solver's logic, constraints, and objectives, please refer to the following documents:

-   [**Data Model**](./docs/data_model.md): An overview of the core data entities.
-   [**Solver Constraints**](./docs/constraints.md): A description of the hard rules the solver must follow.
-   [**Solver Objective**](./docs/objective.md): An explanation of the optimization goals.
