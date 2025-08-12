from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import List, Dict, Any

import pandas as pd


ISO_WEEK_RE = re.compile(r"^\d{4}-W\d{1,2}$")


@dataclass
class Issue:
    severity: str  # ERROR or WARN
    file: str
    row: int | None
    field: str | None
    message: str

    def to_row(self) -> Dict[str, Any]:
        return {
            "severity": self.severity,
            "file": self.file,
            "row": self.row if self.row is not None else "",
            "field": self.field or "",
            "message": self.message,
        }


def _require_columns(df: pd.DataFrame, required: List[str], file: str, issues: List[Issue]) -> bool:
    ok = True
    for col in required:
        if col not in df.columns:
            issues.append(Issue("ERROR", file, None, col, "Missing required column"))
            ok = False
    return ok


def _valid_iso_week(value: str) -> bool:
    return value == "*" or (isinstance(value, str) and ISO_WEEK_RE.match(value) is not None)


def validate_inputs(input_dir: str) -> List[Issue]:
    issues: List[Issue] = []

    # Load CSVs
    legs_path = os.path.join(input_dir, "data_legs.csv")
    tests_path = os.path.join(input_dir, "data_test.csv")
    fte_path = os.path.join(input_dir, "data_fte.csv")
    eq_path = os.path.join(input_dir, "data_equipment.csv")
    duts_path = os.path.join(input_dir, "data_test_duts.csv")

    try:
        legs = pd.read_csv(legs_path)
    except Exception as e:
        issues.append(Issue("ERROR", "data_legs.csv", None, None, f"Failed to read: {e}"))
        legs = pd.DataFrame()
    try:
        tests = pd.read_csv(tests_path)
    except Exception as e:
        issues.append(Issue("ERROR", "data_test.csv", None, None, f"Failed to read: {e}"))
        tests = pd.DataFrame()
    try:
        fte = pd.read_csv(fte_path)
    except Exception as e:
        issues.append(Issue("ERROR", "data_fte.csv", None, None, f"Failed to read: {e}"))
        fte = pd.DataFrame()
    try:
        eq = pd.read_csv(eq_path)
    except Exception as e:
        issues.append(Issue("ERROR", "data_equipment.csv", None, None, f"Failed to read: {e}"))
        eq = pd.DataFrame()
    try:
        duts = pd.read_csv(duts_path)
    except Exception as e:
        issues.append(Issue("WARN", "data_test_duts.csv", None, None, f"Failed to read (optional): {e}"))
        duts = pd.DataFrame()

    # Legs checks
    if not legs.empty:
        req_legs = [
            "project_id",
            "project_name",
            "project_leg_id",
            "leg_number",
            "leg_name",
            "priority",
            "start_iso_week",
        ]
        if _require_columns(legs, req_legs, "data_legs.csv", issues):
            # unique project_leg_id
            if legs["project_leg_id"].duplicated().any():
                dups = legs[legs["project_leg_id"].duplicated()]["project_leg_id"].unique()
                issues.append(Issue("ERROR", "data_legs.csv", None, "project_leg_id", f"Duplicate IDs: {', '.join(map(str, dups))}"))
            # types and ranges
            for i, row in legs.iterrows():
                if not _valid_iso_week(str(row["start_iso_week"])):
                    issues.append(Issue("ERROR", "data_legs.csv", i + 2, "start_iso_week", "Invalid ISO week, expected YYYY-Www"))
                try:
                    ln = int(row["leg_number"])  # noqa
                except Exception:
                    issues.append(Issue("ERROR", "data_legs.csv", i + 2, "leg_number", "Not an integer"))
                try:
                    pr = int(row["priority"])  # noqa
                except Exception:
                    issues.append(Issue("ERROR", "data_legs.csv", i + 2, "priority", "Not an integer"))

    # Tests checks
    if not tests.empty:
        req_tests = [
            "test_id",
            "project_leg_id",
            "test",
            "sequence_index",
            "duration_days",
            "completion_pct",
            "fte_required",
            "fte_time_pct",
            "fte_assigned",
            "equipment_required",
            "equipment_assigned",
            "force_start_week_iso",
        ]
        if _require_columns(tests, req_tests, "data_test.csv", issues):
            # project_leg_id reference
            if not legs.empty:
                leg_ids = set(legs["project_leg_id"].astype(str))
                for i, row in tests.iterrows():
                    pl = str(row["project_leg_id"]).strip()
                    if pl not in leg_ids:
                        issues.append(Issue("ERROR", "data_test.csv", i + 2, "project_leg_id", f"Unknown leg '{pl}'"))

            # sequence uniqueness within leg
            grouped = tests.groupby("project_leg_id")["sequence_index"]
            for leg_id, series in grouped:
                dups = series[series.duplicated(keep=False)]
                if not dups.empty:
                    issues.append(Issue("WARN", "data_test.csv", None, "sequence_index", f"Duplicate sequence_index in leg '{leg_id}'"))

            # numeric ranges and formats
            for i, row in tests.iterrows():
                # duration
                try:
                    dur = float(row["duration_days"])  # noqa
                    if dur < 0:
                        raise ValueError
                except Exception:
                    issues.append(Issue("ERROR", "data_test.csv", i + 2, "duration_days", "Must be a non-negative number"))
                # completion_pct
                try:
                    cp = float(row["completion_pct"])  # noqa
                    if not (0 <= cp <= 100):
                        raise ValueError
                except Exception:
                    issues.append(Issue("ERROR", "data_test.csv", i + 2, "completion_pct", "Must be between 0 and 100"))
                # fte_required / equipment_required
                for fld in ("fte_required", "equipment_required"):
                    try:
                        val = int(row[fld])  # noqa
                        if val < 0:
                            raise ValueError
                    except Exception:
                        issues.append(Issue("ERROR", "data_test.csv", i + 2, fld, "Must be a non-negative integer"))
                # fte_time_pct
                try:
                    pct = float(row["fte_time_pct"])  # noqa
                    if not (0 <= pct <= 100):
                        raise ValueError
                except Exception:
                    issues.append(Issue("ERROR", "data_test.csv", i + 2, "fte_time_pct", "Must be between 0 and 100"))
                # force_start_week_iso
                fs = str(row.get("force_start_week_iso", "*")).strip()
                if not _valid_iso_week(fs):
                    issues.append(Issue("ERROR", "data_test.csv", i + 2, "force_start_week_iso", "Must be '*' or ISO week YYYY-Www"))

            # Assigned filters match something
            if not eq.empty:
                eq_ids = [str(x) for x in eq["equipment_id"].unique()]
                for i, row in tests.iterrows():
                    s = str(row.get("equipment_assigned", "*")).strip()
                    if s != "*" and not any(s.lower() in eid.lower() for eid in eq_ids):
                        issues.append(Issue("WARN", "data_test.csv", i + 2, "equipment_assigned", f"No equipment id contains '{s}'"))
            if not fte.empty:
                fte_ids = [str(x) for x in fte["fte_id"].unique()]
                for i, row in tests.iterrows():
                    s = str(row.get("fte_assigned", "*")).strip()
                    if s != "*" and not any(s.lower() in fid.lower() for fid in fte_ids):
                        issues.append(Issue("WARN", "data_test.csv", i + 2, "fte_assigned", f"No fte id contains '{s}'"))

    # FTE windows
    if not fte.empty:
        req = ["fte_id", "available_start_week_iso", "available_end_week_iso"]
        if _require_columns(fte, req, "data_fte.csv", issues):
            for i, row in fte.iterrows():
                s = str(row["available_start_week_iso"]).strip()
                e = str(row["available_end_week_iso"]).strip()
                if not _valid_iso_week(s):
                    issues.append(Issue("ERROR", "data_fte.csv", i + 2, "available_start_week_iso", "Invalid ISO week"))
                if not _valid_iso_week(e):
                    issues.append(Issue("ERROR", "data_fte.csv", i + 2, "available_end_week_iso", "Invalid ISO week"))
            # overlap detection per fte
            for fte_id, grp in fte.groupby("fte_id"):
                weeks = grp[["available_start_week_iso", "available_end_week_iso"]].values.tolist()
                # naive overlap check by sorting
                try:
                    parsed = []
                    for s, e in weeks:
                        sv = int(str(s).split('-W')[1])
                        ev = int(str(e).split('-W')[1])
                        parsed.append((sv, ev))
                    parsed.sort()
                    last = None
                    for sv, ev in parsed:
                        if last and sv <= last:
                            issues.append(Issue("WARN", "data_fte.csv", None, "fte_id", f"Overlapping windows for '{fte_id}'"))
                        last = max(last or 0, ev)
                except Exception:
                    pass

    # Equipment windows
    if not eq.empty:
        req = ["equipment_id", "available_start_week_iso", "available_end_week_iso"]
        if _require_columns(eq, req, "data_equipment.csv", issues):
            for i, row in eq.iterrows():
                s = str(row["available_start_week_iso"]).strip()
                e = str(row["available_end_week_iso"]).strip()
                if not _valid_iso_week(s):
                    issues.append(Issue("ERROR", "data_equipment.csv", i + 2, "available_start_week_iso", "Invalid ISO week"))
                if not _valid_iso_week(e):
                    issues.append(Issue("ERROR", "data_equipment.csv", i + 2, "available_end_week_iso", "Invalid ISO week"))
            for eq_id, grp in eq.groupby("equipment_id"):
                weeks = grp[["available_start_week_iso", "available_end_week_iso"]].values.tolist()
                try:
                    parsed = []
                    for s, e in weeks:
                        sv = int(str(s).split('-W')[1])
                        ev = int(str(e).split('-W')[1])
                        parsed.append((sv, ev))
                    parsed.sort()
                    last = None
                    for sv, ev in parsed:
                        if last and sv <= last:
                            issues.append(Issue("WARN", "data_equipment.csv", None, "equipment_id", f"Overlapping windows for '{eq_id}'"))
                        last = max(last or 0, ev)
                except Exception:
                    pass

    # DUT mapping
    if not duts.empty and not tests.empty and "test_id" in duts.columns:
        known = set(tests["test_id"].astype(str))
        for i, row in duts.iterrows():
            tid = str(row.get("test_id", "")).strip()
            if tid and tid not in known:
                issues.append(Issue("WARN", "data_test_duts.csv", i + 2, "test_id", f"Unknown test_id '{tid}'"))

    return issues


def write_report(issues: List[Issue], output_dir: str) -> None:
    os.makedirs(output_dir, exist_ok=True)
    df = pd.DataFrame([it.to_row() for it in issues])
    df.to_csv(os.path.join(output_dir, "validation_report.csv"), index=False)
    # Summary
    errors = sum(1 for it in issues if it.severity == "ERROR")
    warns = sum(1 for it in issues if it.severity == "WARN")
    with open(os.path.join(output_dir, "validation_summary.txt"), "w", encoding="utf-8") as f:
        f.write(f"errors={errors}\n")
        f.write(f"warnings={warns}\n")

