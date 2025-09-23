# Planner V2 - Data Model

This document defines the core data entities used by the Test Planner. A clear data model is essential for understanding the inputs and outputs of the system.

## 1. Core Entities

The planning problem revolves around four main entities: **Legs**, **Tests**, **FTEs** (Full-Time Equivalents), and **Equipment**.

### 1.1. Leg

A **Leg** represents a distinct phase or sub-project within a larger project. It serves as a container for a sequence of tests.

-   **Attributes**:
    -   `project_leg_id`: A unique identifier for the leg (e.g., `mwcu_b10_3`).
    -   `project_id`: The identifier of the parent project.
    -   `leg_number`: The sequential number of the leg within the project.
    -   `priority`: A numerical value indicating the importance of the leg.
    -   `start_iso_week`: The earliest week the leg is allowed to start.

### 1.2. Test

A **Test** is an individual task that must be scheduled. Each test belongs to a single leg and has specific resource requirements.

-   **Attributes**:
    -   `test_id`: A unique identifier for the test.
    -   `project_leg_id`: The ID of the leg this test belongs to.
    -   `sequence_index`: The order in which this test must be performed within its leg.
    -   `duration_days`: The time required to complete the test.
    -   `fte_required`: The number of FTEs needed for the test.
    -   `equipment_required`: The number of equipment units needed for the test.
    -   `fte_assigned`: A specific FTE or type of FTE required (e.g., `fte_hengelo`).
    -   `equipment_assigned`: A specific piece of equipment or type required.

### 1.3. FTE (Full-Time Equivalent)

An **FTE** represents a person or a role that can be assigned to work on a test. FTEs are a finite resource.

-   **Attributes**:
    -   `fte_id`: A unique identifier for the FTE resource (e.g., `fte_hengelo_1`).
    -   `availability_windows`: A list of time periods during which the FTE is available to work.

### 1.4. Equipment

**Equipment** represents a physical resource required to perform a test, such as a test bench or a specific tool.

-   **Attributes**:
    -   `equipment_id`: A unique identifier for the equipment (e.g., `setup_sofia_1`).
    -   `availability_windows`: A list of time periods during which the equipment is available for use.

## 2. Relationships

-   A **Project** has one or more **Legs**.
-   A **Leg** has one or more **Tests**, which are performed in a specific sequence.
-   A **Test** requires one or more **FTEs** and one or more pieces of **Equipment**.
-   **FTEs** and **Equipment** are resources with limited availability.

This data model forms the basis for the constraints and objectives defined in the solver.
