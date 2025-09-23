# Planner V2 - Solver Objective

The **objective function** defines the goal of the optimization process. While the constraints define what makes a schedule *valid*, the objective function defines what makes a schedule *good*. The solver's job is to find a valid schedule that results in the best possible objective value.

## Primary Objective: Minimize Makespan

The primary goal of the planner is to complete the entire testing program as quickly as possible.

-   **Objective**: Minimize the completion time of the last test to finish in the entire schedule. This is known as the "makespan".
-   **Implementation**:
    1.  A special variable, `makespan`, is created in the model.
    2.  Constraints are added to ensure that the value of `makespan` is greater than or equal to the end time of *every* test in the schedule.
    3.  The solver is instructed to minimize the value of this `makespan` variable.

This single, clear objective guides the solver to produce the most time-efficient schedule that still respects all of the hard constraints.

## Secondary Objectives (Soft Constraints)

While minimizing the makespan is the main goal, we can also introduce secondary objectives, or "soft constraints," to guide the solver toward more desirable schedules when multiple optimal solutions exist.

For example, a common secondary objective is to **improve the compactness of the schedule**.

-   **Objective**: Minimize the total amount of idle time between consecutive tests within the longest project leg.
-   **Implementation**: This is achieved by adding the idle times to the main objective function with a small weight. The solver is primarily incentivized to reduce the makespan, but it will also try to reduce idle time if doing so does not compromise the primary goal.

By combining a primary objective with one or more secondary objectives, we can guide the solver to produce schedules that are not only fast but also efficient and logically structured.
