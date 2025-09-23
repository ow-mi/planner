# Planner V2 - Solver Constraints

This document details the constraints that the scheduling solver must adhere to when creating a valid test plan. Constraints are the hard rules that cannot be violated.

## 1. Sequencing Constraint

Tests that belong to the same **Leg** must be executed in a specific order, as defined by their `sequence_index`.

-   **Rule**: For any two consecutive tests, `Test A` and `Test B`, within the same leg, the start time of `Test B` must be greater than or equal to the end time of `Test A`.
-   **Implementation**: This is a classic precedence constraint, modeled as `end(A) <= start(B)`.

## 2. Resource Constraints

Each test requires a specific number of FTEs (personnel) and equipment units. These resources are finite and have limited capacity.

### 2.1. Resource Exclusivity

A single resource (e.g., `fte_hengelo_1` or `setup_sofia_2`) can only be used by one test at a time.

-   **Rule**: The time intervals of any two tests assigned to the same resource cannot overlap.
-   **Implementation**: This is modeled using a `NoOverlap` constraint in the OR-Tools solver. The solver ensures that for a given resource, no two tasks assigned to it are scheduled to run at the same time.

### 2.2. Resource Availability

Resources are only available during specific time windows (e.g., due to maintenance, holidays, or other projects).

-   **Rule**: A test can only be scheduled if all of its required resources are available for the entire duration of the test.
-   **Implementation**: The solver is given the availability windows for each resource. When a test is assigned to a resource, the solver adds a constraint that the test's entire duration must fall within one of that resource's availability windows.

## 3. Resource Assignment

Tests can require a specific type of resource (e.g., any FTE from "hengelo") or a specific resource instance (e.g., `fte_hengelo_2`).

-   **Rule**: The solver must assign resources to tests in a way that respects these assignment requirements. If a test requests a "hengelo" FTE, it cannot be assigned a "sofia" FTE.
-   **Implementation**: The solver creates a set of boolean variables for each possible test-resource assignment. Constraints are added to ensure that only valid assignments are chosen, and that the required number of resources (`fte_required`, `equipment_required`) is met.

These constraints collectively define what constitutes a "valid" or "feasible" schedule. The solver's first job is to find a schedule that satisfies all of these rules simultaneously.
