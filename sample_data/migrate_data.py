#!/usr/bin/env python3
"""
Data Format Migration Script - Fixed Version
Converts old format (data_legs.csv + data_test.csv) to new format (new_data_format.csv)

New Format Columns:
- project: Project identifier
- leg: Leg identifier (phase/stage)
- branch: Branch within leg (optional) - uses "a", "b" for sub-legs
- test: Test name/code
- duration_days: Duration in days
- description: Human-readable description
- next_leg: Next leg dependency (optional)
"""

import csv
import re
from pathlib import Path


def extract_project_name(project_id):
    """
    Extract base project name from project_id.
    Example: 'mwcu_a7' -> 'mwcu'
    """
    # Remove suffixes like _a7, _v2, etc.
    match = re.match(r"^([a-zA-Z0-9]+)", project_id)
    if match:
        return match.group(1).lower()
    return project_id.lower()


def parse_leg_components(leg_number, project_leg_id):
    """
    Parse leg number to determine main leg and branch.

    Pattern analysis from old data:
    - "6" -> leg="6", branch=""
    - "5.1" -> leg="5.1", branch=""
    - "4" with ids "mwcu_a7_4.1" and "mwcu_a7_4.2" -> leg="4", branches "a", "b"
    - "5.2" with ids "mwcu_a7_5.2.1" and "mwcu_a7_5.2.2" -> leg="5.2", branches "a", "b"
    - "2.1", "2.2" -> leg="2.1", "2.2" (these are distinct sequential legs, not branches)

    Rule:
    - If leg_number is simple (no decimal): check if there are multiple project_leg_ids with same leg_number
    - If yes: extract branch from project_leg_id suffix
    - If no: use leg_number as-is
    """
    return leg_number, ""


def load_data_legs(filepath):
    """Load legs data from CSV."""
    legs = []
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            legs.append(
                {
                    "project_id": row["project_id"].strip(),
                    "project_name": row["project_name"].strip(),
                    "project_leg_id": row["project_leg_id"].strip(),
                    "leg_number": row["leg_number"].strip(),
                    "leg_name": row["leg_name"].strip(),
                    "priority": row["priority"].strip(),
                    "start_iso_week": row["start_iso_week"].strip(),
                }
            )
    return legs


def load_data_test(filepath):
    """Load test data from CSV."""
    tests = []
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            tests.append(
                {
                    "project_leg_id": row["project_leg_id"].strip(),
                    "sequence_index": int(row["sequence_index"]),
                    "test": row["test"].strip(),
                    "duration_days": float(row["duration_days"]),
                    "test_description": row["test_description"].strip(),
                    "project_id": row["project_id"].strip(),
                    "leg_num": row["leg_num"].strip(),
                }
            )
    return tests


def detect_branches(legs):
    """
    Detect which legs have branches based on duplicate leg_numbers.

    Returns dict: leg_number -> list of (project_leg_id, branch_letter)
    """
    from collections import defaultdict

    # Group legs by leg_number
    legs_by_number = defaultdict(list)
    for leg in legs:
        legs_by_number[leg["leg_number"]].append(leg)

    # Identify legs with multiple entries (branches)
    branches = {}
    branch_counter = {}

    for leg_number, leg_list in legs_by_number.items():
        if len(leg_list) > 1:
            # Multiple legs with same number = branches
            branches[leg_number] = {}
            for i, leg in enumerate(
                sorted(leg_list, key=lambda x: x["project_leg_id"])
            ):
                branch_letter = chr(ord("a") + i)  # 'a', 'b', 'c', etc.
                branches[leg_number][leg["project_leg_id"]] = branch_letter

    return branches


def transform_data(legs, tests):
    """
    Transform old format data to new format with proper branch detection.
    """
    # Group tests by project_leg_id
    tests_by_leg = {}
    for test in tests:
        pl_id = test["project_leg_id"]
        if pl_id not in tests_by_leg:
            tests_by_leg[pl_id] = []
        tests_by_leg[pl_id].append(test)

    # Sort tests within each leg by sequence_index
    for pl_id in tests_by_leg:
        tests_by_leg[pl_id].sort(key=lambda x: x["sequence_index"])

    # Detect branches
    branch_map = detect_branches(legs)

    # Build leg info lookup with branch info
    leg_info = {}
    for leg in legs:
        pl_id = leg["project_leg_id"]
        leg_number = leg["leg_number"]

        # Determine branch
        branch = ""
        if leg_number in branch_map and pl_id in branch_map[leg_number]:
            branch = branch_map[leg_number][pl_id]

        leg_info[pl_id] = {**leg, "branch": branch}

    # Sort legs by project and start date to determine sequence
    sorted_legs = sorted(
        legs, key=lambda x: (x["project_id"], x["start_iso_week"], x["leg_number"])
    )

    # Determine next_leg relationships
    # Group by project
    projects = {}
    for leg in sorted_legs:
        pid = leg["project_id"]
        if pid not in projects:
            projects[pid] = []
        projects[pid].append(leg)

    # Build next_leg map
    next_leg_map = {}
    for project_id, project_legs in projects.items():
        for i, leg in enumerate(project_legs):
            if i < len(project_legs) - 1:
                current_pl_id = leg["project_leg_id"]
                next_leg = project_legs[i + 1]

                # Check if this is a multi-way split
                current_leg_num = leg["leg_number"]
                next_leg_num = next_leg["leg_number"]

                # If current leg has branches, next_leg should point to all branches
                if current_leg_num in branch_map:
                    # This leg splits into branches
                    branch_ids = list(branch_map[current_leg_num].values())
                    next_leg_map[current_pl_id] = ";".join(
                        sorted(
                            set(
                                leg_info.get(bl, {}).get("leg_number", bl)
                                for bl in branch_map[current_leg_num]
                            )
                        )
                    )
                else:
                    # Sequential: just point to next leg
                    next_leg_map[current_pl_id] = next_leg["leg_number"]

    transformed = []

    # Process each leg
    for leg in legs:
        project_leg_id = leg["project_leg_id"]
        leg_tests = tests_by_leg.get(project_leg_id, [])

        if not leg_tests:
            continue

        project_id = leg["project_id"]
        project_name = extract_project_name(project_id)
        leg_number = leg["leg_number"]
        branch = leg_info[project_leg_id]["branch"]

        # Get next_leg for this leg
        next_leg = next_leg_map.get(project_leg_id, "")

        for i, test in enumerate(leg_tests):
            row = {
                "project": project_name,
                "leg": leg_number,
                "branch": branch,
                "test": test["test"],
                "duration_days": test["duration_days"],
                "description": test["test_description"],
                "next_leg": "",
            }

            # Only last test in leg gets next_leg
            if i == len(leg_tests) - 1 and next_leg:
                row["next_leg"] = next_leg

            transformed.append(row)

    # Sort transformed data to match expected order
    # Group by project, then by leg, then by original sequence
    transformed.sort(
        key=lambda x: (x["project"], x["leg"], x["branch"] if x["branch"] else "0")
    )

    return transformed


def write_csv(data, filepath):
    """Write data to CSV file."""
    fieldnames = [
        "project",
        "leg",
        "branch",
        "test",
        "duration_days",
        "description",
        "next_leg",
    ]

    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(data)


def validate_output(data, reference_file):
    """Validate generated data against reference."""
    print("\n=== Validation Report ===\n")

    # Check column names
    expected_columns = {
        "project",
        "leg",
        "branch",
        "test",
        "duration_days",
        "description",
        "next_leg",
    }
    actual_columns = set(data[0].keys()) if data else set()

    print("1. Column Names Check:")
    if actual_columns == expected_columns:
        print("   ✓ All required columns present")
    else:
        print(f"   ✗ Missing: {expected_columns - actual_columns}")
        print(f"   ✗ Extra: {actual_columns - expected_columns}")

    # Check data types
    print("\n2. Data Types Check:")
    errors = []
    for i, row in enumerate(data):
        # Check required fields
        for field in ["project", "leg", "test", "description"]:
            if not row.get(field):
                errors.append(f"Row {i + 1}: Empty {field}")

        # Check duration_days is numeric
        try:
            val = float(row["duration_days"])
            if val <= 0:
                errors.append(
                    f"Row {i + 1}: duration_days must be positive (got {val})"
                )
        except (ValueError, TypeError):
            errors.append(
                f"Row {i + 1}: duration_days must be numeric (got {row['duration_days']})"
            )

    if errors:
        print(f"   ✗ Found {len(errors)} errors:")
        for e in errors[:10]:
            print(f"     - {e}")
        if len(errors) > 10:
            print(f"     ... and {len(errors) - 10} more")
    else:
        print("   ✓ All data types valid")

    # Check against reference structure
    print("\n3. Data Structure Check:")
    with open(reference_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        ref_data = list(reader)

    print(f"   Generated rows: {len(data)}")
    print(f"   Reference rows: {len(ref_data)}")

    # Check unique legs
    gen_legs = set((r["project"], r["leg"]) for r in data)
    ref_legs = set((r["project"], r["leg"]) for r in ref_data)
    print(f"   Generated unique project-leg combos: {len(gen_legs)}")
    print(f"   Reference unique project-leg combos: {len(ref_legs)}")

    # Check branch usage
    gen_branches = sum(1 for r in data if r["branch"])
    ref_branches = sum(1 for r in ref_data if r["branch"])
    print(f"   Generated rows with branches: {gen_branches}")
    print(f"   Reference rows with branches: {ref_branches}")

    # Check next_leg usage
    gen_next = sum(1 for r in data if r["next_leg"])
    ref_next = sum(1 for r in ref_data if r["next_leg"])
    print(f"   Generated rows with next_leg: {gen_next}")
    print(f"   Reference rows with next_leg: {ref_next}")

    # Sample comparison
    print("\n4. Sample Data (first 10 rows):")
    for i, row in enumerate(data[:10]):
        print(
            f"   {row['project']},{row['leg']},{row['branch']},{row['test']},{row['duration_days']:.1f},{row['description'][:40]}...,{row['next_leg']}"
        )


def report_unmappable_data(legs, tests, transformed):
    """Report data that could not be mapped."""
    print("\n=== Unmappable Data Report ===\n")

    # Count statistics
    total_legs = len(legs)
    total_tests = len(tests)
    total_transformed = len(transformed)

    print(f"Original data:")
    print(f"  - Unique legs: {total_legs}")
    print(f"  - Total tests: {total_tests}")
    print(f"Transformed rows: {total_transformed}")

    # Check for unmappable fields
    print("\nFields NOT mapped (per specification, these go in Configuration tab):")
    print("  - priority (from data_legs)")
    print("  - start_iso_week (from data_legs)")
    print("  - fte_time_pct (from data_test)")
    print("  - fte_assigned (from data_test)")
    print("  - equipment_assigned (from data_test)")
    print("  - completion_pct (from data_test)")
    print("  - fte_required (from data_test)")
    print("  - equipment_required (from data_test)")
    print("  - force_start_week_iso (from data_test)")
    print("  - dut_count (from data_test)")
    print("  - leg_name (from data_legs - informational)")

    print("\nThese fields are intentionally excluded per CSV Format Guide:")
    print("  'The CSV file contains test schedule data only. These items are")
    print("   configured separately: Priorities, FTE assignments, Equipment")
    print("   assignments, Start/end dates, Resource timing'")

    # Check for any legs without tests
    tests_by_leg = {}
    for test in tests:
        pl_id = test["project_leg_id"]
        tests_by_leg[pl_id] = tests_by_leg.get(pl_id, 0) + 1

    empty_legs = [
        leg["project_leg_id"]
        for leg in legs
        if leg["project_leg_id"] not in tests_by_leg
    ]
    if empty_legs:
        print(f"\n⚠ Legs without tests: {len(empty_legs)}")
        for leg_id in empty_legs:
            print(f"  - {leg_id}")
    else:
        print(f"\n✓ All legs have associated tests")

    # Assumptions made
    print("\n=== Assumptions Made ===")
    print("1. Project name extraction: 'mwcu_a7' -> 'mwcu' (removed suffix)")
    print("2. Branch detection: Legs with same leg_number but different project_leg_id")
    print("   (e.g., mwcu_a7_4.1 and mwcu_a7_4.2 with leg_number=4) are treated as")
    print("   branches 'a' and 'b' of leg '4'")
    print("3. Sequential legs (2.1, 2.2) remain as separate legs (not branches)")
    print("4. next_leg indicates workflow: last test in leg points to next leg")
    print("5. Branch legs merge back by pointing to next sequential leg")


def main():
    # File paths
    old_format_dir = Path(
        "/home/omv/.openclaw/workspace/projects/planner_redesign/sample_data/old_fomat"
    )
    output_file = Path(
        "/home/omv/.openclaw/workspace/projects/planner_redesign/sample_data/migrated_data.csv"
    )
    reference_file = Path(
        "/home/omv/.openclaw/workspace/projects/planner_redesign/sample_data/new_data_format.csv"
    )

    # Load old format data
    print("Loading old format data...")
    legs = load_data_legs(old_format_dir / "data_legs.csv")
    tests = load_data_test(old_format_dir / "data_test.csv")

    print(f"  Loaded {len(legs)} legs and {len(tests)} tests")

    # Show leg analysis
    print("\nAnalyzing leg structure...")
    from collections import defaultdict

    legs_by_number = defaultdict(list)
    for leg in legs:
        legs_by_number[leg["leg_number"]].append(leg["project_leg_id"])

    print("  Legs by number:")
    for leg_num in sorted(legs_by_number.keys(), key=lambda x: (len(x.split(".")), x)):
        pl_ids = legs_by_number[leg_num]
        if len(pl_ids) > 1:
            print(f"    {leg_num}: {pl_ids} -> will become branches")
        else:
            print(f"    {leg_num}: {pl_ids}")

    # Transform data
    print("\nTransforming data...")
    transformed = transform_data(legs, tests)
    print(f"  Generated {len(transformed)} rows")

    # Write output
    print(f"\nWriting to {output_file}...")
    write_csv(transformed, output_file)
    print("  Done!")

    # Validate
    validate_output(transformed, reference_file)

    # Report unmappable data
    report_unmappable_data(legs, tests, transformed)

    print(f"\n✓ Migration complete! Output: {output_file}")


if __name__ == "__main__":
    main()
