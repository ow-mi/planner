import os
import math
import csv
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Dict, List, Tuple, Optional

import pandas as pd
from ortools.sat.python import cp_model
import matplotlib.pyplot as plt
import matplotlib.dates as mdates


UNITS_PER_DAY = 2  # half-day granularity


@dataclass
class Leg:
    project_id: str
    project_name: str
    project_leg_id: str
    leg_number: int
    leg_name: str
    priority: int
    start_monday: date


@dataclass
class Test:
    uid: str  # unique per row for modeling
    test_id: str
    project_leg_id: str
    test_name: str
    sequence_index: int
    duration_units: int
    completion_pct: int
    fte_required: int
    equipment_required: int


@dataclass
class ResourceWindow:
    resource_id: str
    start_monday: date
    end_monday_inclusive: date

    @property
    def start_units(self) -> int:
        return 0  # placeholder, filled after global origin is set

    @property
    def end_units_exclusive(self) -> int:
        return 0  # placeholder, filled after global origin is set


def parse_iso_week(iso_week: str) -> date:
    # Expect formats like '2025-W14'
    iso_week = iso_week.strip()
    if not iso_week:
        raise ValueError("Empty ISO week string")
    try:
        year_str, week_str = iso_week.split("-W")
        year = int(year_str)
        week = int(week_str)
        return date.fromisocalendar(year, week, 1)
    except Exception as exc:
        raise ValueError(f"Invalid ISO week '{iso_week}': {exc}")


def load_legs(path: str) -> Dict[str, Leg]:
    df = pd.read_csv(path)
    legs: Dict[str, Leg] = {}
    for _, row in df.iterrows():
        start_monday = parse_iso_week(str(row["start_iso_week"]))
        leg = Leg(
            project_id=str(row["project_id"]).strip(),
            project_name=str(row["project_name"]).strip(),
            project_leg_id=str(row["project_leg_id"]).strip(),
            leg_number=int(row["leg_number"]),
            leg_name=str(row["leg_name"]).strip(),
            priority=int(row["priority"]),
            start_monday=start_monday,
        )
        legs[leg.project_leg_id] = leg
    return legs


def load_tests(path: str) -> List[Test]:
    df = pd.read_csv(path)
    tests: List[Test] = []
    for idx, row in df.iterrows():
        duration_days = float(row["duration_days"]) if not pd.isna(row["duration_days"]) else 0.0
        duration_units = int(round(duration_days * UNITS_PER_DAY))
        tests.append(
            Test(
                uid=f"{str(row['test_id']).strip()}__{idx}",
                test_id=str(row["test_id"]).strip(),
                project_leg_id=str(row["project_leg_id"]).strip(),
                test_name=str(row["test"]).strip(),
                sequence_index=int(row["sequence_index"]),
                duration_units=duration_units,
                completion_pct=int(row["completion_pct"]),
                fte_required=int(row["fte_required"]),
                equipment_required=int(row["equipment_required"]),
            )
        )
    return tests


def load_resource_windows(path: str, id_col: str) -> List[ResourceWindow]:
    df = pd.read_csv(path)
    windows: List[ResourceWindow] = []
    for _, row in df.iterrows():
        start_monday = parse_iso_week(str(row["available_start_week_iso"]))
        end_monday = parse_iso_week(str(row["available_end_week_iso"]))
        windows.append(
            ResourceWindow(
                resource_id=str(row[id_col]).strip(),
                start_monday=start_monday,
                end_monday_inclusive=end_monday,
            )
        )
    return windows


def compute_time_origin(
    legs: Dict[str, Leg], fte_windows: List[ResourceWindow], equip_windows: List[ResourceWindow]
) -> date:
    dates: List[date] = []
    dates.extend(leg.start_monday for leg in legs.values())
    dates.extend(w.start_monday for w in fte_windows)
    dates.extend(w.start_monday for w in equip_windows)
    if not dates:
        raise ValueError("No dates available to compute time origin")
    return min(dates)


def date_to_units(day0: date, d: date) -> int:
    delta_days = (d - day0).days
    return delta_days * UNITS_PER_DAY


def units_to_datetime(day0: date, units: int) -> datetime:
    days = units // UNITS_PER_DAY
    rem = units % UNITS_PER_DAY
    dt = datetime.combine(day0 + timedelta(days=days), datetime.min.time())
    if rem:
        # half-day as 12h for UNITS_PER_DAY=2
        dt += timedelta(hours=24 // UNITS_PER_DAY * rem)
    return dt


def build_and_solve(
    legs: Dict[str, Leg],
    tests: List[Test],
    fte_windows: List[ResourceWindow],
    equip_windows: List[ResourceWindow],
) -> Tuple[
    cp_model.CpSolver,
    Dict[str, cp_model.IntVar],
    Dict[str, cp_model.IntVar],
    Dict[str, Optional[int]],
    Dict[str, Optional[int]],
]:
    # Prepare time origin and window unit bounds
    day0 = compute_time_origin(legs, fte_windows, equip_windows)

    # Convert resource windows to unit bounds
    fte_bounds: Dict[int, Tuple[int, int]] = {}
    for idx, w in enumerate(fte_windows):
        start_units = date_to_units(day0, w.start_monday)
        # end is end of the stated ISO week; we set exclusive bound as next Monday
        next_monday = w.end_monday_inclusive + timedelta(days=7)
        end_units_exclusive = date_to_units(day0, next_monday)
        fte_bounds[idx] = (start_units, end_units_exclusive)

    equip_bounds: Dict[int, Tuple[int, int]] = {}
    for idx, w in enumerate(equip_windows):
        start_units = date_to_units(day0, w.start_monday)
        next_monday = w.end_monday_inclusive + timedelta(days=7)
        end_units_exclusive = date_to_units(day0, next_monday)
        equip_bounds[idx] = (start_units, end_units_exclusive)

    # Filter tests to schedule (exclude 100% complete)
    sched_tests = [t for t in tests if t.completion_pct < 100]

    # Horizon large enough to cover latest leg start and resource windows
    total_units = sum(t.duration_units for t in sched_tests)
    latest_leg_start = 0
    for t in sched_tests:
        earliest_start = date_to_units(day0, legs[t.project_leg_id].start_monday)
        if earliest_start > latest_leg_start:
            latest_leg_start = earliest_start
    max_resource_end = 0
    for _, (_, end_ex) in fte_bounds.items():
        max_resource_end = max(max_resource_end, end_ex)
    for _, (_, end_ex) in equip_bounds.items():
        max_resource_end = max(max_resource_end, end_ex)
    horizon = max(max_resource_end, latest_leg_start + total_units + 1)

    model = cp_model.CpModel()

    # Variables per test
    start_vars: Dict[str, cp_model.IntVar] = {}
    end_vars: Dict[str, cp_model.IntVar] = {}
    intervals: Dict[str, cp_model.IntervalVar] = {}

    # Master interval per test
    for t in sched_tests:
        leg = legs[t.project_leg_id]
        earliest_start = date_to_units(day0, leg.start_monday)
        start = model.NewIntVar(earliest_start, horizon, f"start_{t.uid}")
        end = model.NewIntVar(earliest_start, horizon + t.duration_units, f"end_{t.uid}")
        interval = model.NewIntervalVar(start, t.duration_units, end, f"ivl_{t.uid}")
        start_vars[t.uid] = start
        end_vars[t.uid] = end
        intervals[t.uid] = interval

    # Sequence constraints within each leg (consider only sched_tests)
    by_leg: Dict[str, List[Test]] = {}
    for t in sched_tests:
        by_leg.setdefault(t.project_leg_id, []).append(t)
    for leg_id, leg_tests in by_leg.items():
        leg_tests_sorted = sorted(leg_tests, key=lambda x: x.sequence_index)
        for prev, nxt in zip(leg_tests_sorted, leg_tests_sorted[1:]):
            model.Add(end_vars[prev.uid] <= start_vars[nxt.uid])

    # Resource assignment: equipment
    equip_nooverlap: Dict[int, List[cp_model.IntervalVar]] = {i: [] for i in range(len(equip_windows))}
    equip_assign: Dict[Tuple[str, int], cp_model.IntVar] = {}
    for t in sched_tests:
        literals: List[cp_model.IntVar] = []
        for r_idx, (r_start, r_end_excl) in equip_bounds.items():
            x = model.NewBoolVar(f"xeq_{t.uid}_{r_idx}")
            # Optional interval with shared start/end
            opt_ivl = model.NewOptionalIntervalVar(
                start_vars[t.uid], t.duration_units, end_vars[t.uid], x, f"ivl_eq_{t.uid}_{r_idx}"
            )
            equip_nooverlap[r_idx].append(opt_ivl)
            # Availability windows
            model.Add(start_vars[t.uid] >= r_start).OnlyEnforceIf(x)
            model.Add(end_vars[t.uid] <= r_end_excl).OnlyEnforceIf(x)
            equip_assign[(t.uid, r_idx)] = x
            literals.append(x)
        model.Add(sum(literals) == max(0, t.equipment_required))

    for r_idx, ivls in equip_nooverlap.items():
        model.AddNoOverlap(ivls)

    # Resource assignment: FTE
    fte_nooverlap: Dict[int, List[cp_model.IntervalVar]] = {i: [] for i in range(len(fte_windows))}
    fte_assign: Dict[Tuple[str, int], cp_model.IntVar] = {}
    for t in sched_tests:
        literals_ft: List[cp_model.IntVar] = []
        for r_idx, (r_start, r_end_excl) in fte_bounds.items():
            xft = model.NewBoolVar(f"xft_{t.uid}_{r_idx}")
            opt_ivl_ft = model.NewOptionalIntervalVar(
                start_vars[t.uid], t.duration_units, end_vars[t.uid], xft, f"ivl_ft_{t.uid}_{r_idx}"
            )
            fte_nooverlap[r_idx].append(opt_ivl_ft)
            model.Add(start_vars[t.uid] >= r_start).OnlyEnforceIf(xft)
            model.Add(end_vars[t.uid] <= r_end_excl).OnlyEnforceIf(xft)
            fte_assign[(t.uid, r_idx)] = xft
            literals_ft.append(xft)
        model.Add(sum(literals_ft) == max(0, t.fte_required))

    for r_idx, ivls in fte_nooverlap.items():
        model.AddNoOverlap(ivls)

    # Objective: minimize weighted sum of end times by leg priority (lower priority number = higher importance)
    max_priority = max(leg.priority for leg in legs.values()) if legs else 0
    terms: List[cp_model.LinearExpr] = []
    for t in sched_tests:
        leg = legs[t.project_leg_id]
        weight = (max_priority + 1) - leg.priority
        terms.append(weight * end_vars[t.uid])
    if terms:
        model.Minimize(sum(terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30.0
    solver.parameters.num_search_workers = 8
    status = solver.Solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        raise RuntimeError(f"No feasible solution found. Status: {solver.StatusName(status)}")

    # Build maps for assignments: test_id -> assigned resource indices
    assigned_equipment_index: Dict[str, Optional[int]] = {}
    assigned_fte_index: Dict[str, Optional[int]] = {}
    for t in sched_tests:
        # equipment
        eq_idx_sel: Optional[int] = None
        for r_idx in range(len(equip_windows)):
            lit = equip_assign[(t.uid, r_idx)]
            if solver.Value(lit) == 1:
                eq_idx_sel = r_idx
                break
        assigned_equipment_index[t.uid] = eq_idx_sel
        # fte
        ft_idx_sel: Optional[int] = None
        for r_idx in range(len(fte_windows)):
            lit = fte_assign[(t.uid, r_idx)]
            if solver.Value(lit) == 1:
                ft_idx_sel = r_idx
                break
        assigned_fte_index[t.uid] = ft_idx_sel

    return solver, start_vars, end_vars, assigned_equipment_index, assigned_fte_index


def plan_and_output(sample_dir: str = "input_data", outputs_dir: str = "outputs") -> None:
    os.makedirs(outputs_dir, exist_ok=True)

    legs = load_legs(os.path.join(sample_dir, "data_legs.csv"))
    tests = load_tests(os.path.join(sample_dir, "data_test.csv"))
    fte_windows = load_resource_windows(os.path.join(sample_dir, "data_fte.csv"), id_col="fte_id")
    equip_windows = load_resource_windows(os.path.join(sample_dir, "data_equipment.csv"), id_col="equipment_id")

    # Compute time origin
    day0 = compute_time_origin(legs, fte_windows, equip_windows)

    # Solve
    solver, start_vars, end_vars, assigned_equipment_index, assigned_fte_index = build_and_solve(
        legs, tests, fte_windows, equip_windows
    )

    # Helper maps for output
    def to_units(d: date) -> int:
        return date_to_units(day0, d)

    def to_dt(units: int) -> datetime:
        return units_to_datetime(day0, units)

    # Build index mapping for resources
    equip_index_to_id = {idx: w.resource_id for idx, w in enumerate(equip_windows)}
    fte_index_to_id = {idx: w.resource_id for idx, w in enumerate(fte_windows)}

    # Prepare test schedules
    sched_rows: List[Dict[str, str]] = []
    equip_usage: Dict[str, List[Tuple[datetime, datetime, str]]] = {}
    fte_usage: Dict[str, List[Tuple[datetime, datetime, str]]] = {}

    # Determine scheduled tests
    sched_tests = [t for t in tests if t.completion_pct < 100]
    completed_tests = [t for t in tests if t.completion_pct >= 100]

    # Create mapping from test_id to test_name for CSV output
    test_id_to_name = {t.test_id: t.test_name for t in tests}

    for t in sched_tests:
        s_units = solver.Value(start_vars[t.uid])
        e_units = solver.Value(end_vars[t.uid])
        start_dt = to_dt(s_units)
        end_dt = to_dt(e_units)
        eq_idx = assigned_equipment_index.get(t.uid)
        ft_idx = assigned_fte_index.get(t.uid)
        equip_id = equip_index_to_id[eq_idx] if eq_idx is not None else ""
        fte_id = fte_index_to_id[ft_idx] if ft_idx is not None else ""

        sched_rows.append(
            {
                "test_id": t.test_id,
                "project_leg_id": t.project_leg_id,
                "test_name": t.test_name,
                "sequence_index": str(t.sequence_index),
                "duration_units": str(t.duration_units),
                "duration_days": f"{t.duration_units / UNITS_PER_DAY:.2f}",
                "start": start_dt.isoformat(),
                "end": end_dt.isoformat(),
                "assigned_equipment_id": equip_id,
                "assigned_fte_id": fte_id,
            }
        )

        if equip_id:
            equip_usage.setdefault(equip_id, []).append((start_dt, end_dt, t.test_id))
        if fte_id:
            fte_usage.setdefault(fte_id, []).append((start_dt, end_dt, t.test_id))

    # Add completed tests with status only
    for t in completed_tests:
        sched_rows.append(
            {
                "test_id": t.test_id,
                "project_leg_id": t.project_leg_id,
                "test_name": t.test_name,
                "sequence_index": str(t.sequence_index),
                "duration_units": str(t.duration_units),
                "duration_days": f"{t.duration_units / UNITS_PER_DAY:.2f}",
                "start": "",
                "end": "",
                "assigned_equipment_id": "",
                "assigned_fte_id": "",
            }
        )

    # Write CSVs
    sched_csv = os.path.join(outputs_dir, "tests_schedule.csv")
    pd.DataFrame(sched_rows).to_csv(sched_csv, index=False)

    equip_rows: List[Dict[str, str]] = []
    for eq_id, intervals in equip_usage.items():
        for s_dt, e_dt, test_id in sorted(intervals, key=lambda x: x[0]):
            equip_rows.append({
                "equipment_id": eq_id,
                "test_id": test_id,
                "test_name": test_id_to_name.get(test_id, ""),
                "start": s_dt.isoformat(),
                "end": e_dt.isoformat(),
            })
    pd.DataFrame(equip_rows).to_csv(os.path.join(outputs_dir, "equipment_usage.csv"), index=False)

    fte_rows: List[Dict[str, str]] = []
    for ft_id, intervals in fte_usage.items():
        for s_dt, e_dt, test_id in sorted(intervals, key=lambda x: x[0]):
            fte_rows.append({
                "fte_id": ft_id,
                "test_id": test_id,
                "test_name": test_id_to_name.get(test_id, ""),
                "start": s_dt.isoformat(),
                "end": e_dt.isoformat(),
            })
    pd.DataFrame(fte_rows).to_csv(os.path.join(outputs_dir, "fte_usage.csv"), index=False)

    # Charts
    def plot_gantt(data: List[Tuple[str, datetime, datetime, str]], title: str, fname: str) -> None:
        # data tuples: (row_label, start_dt, end_dt, color_key)
        if not data:
            return
        # Map row labels to y positions
        rows = sorted(set(lbl for lbl, *_ in data))
        row_to_y = {lbl: i for i, lbl in enumerate(rows)}
        fig, ax = plt.subplots(figsize=(12, max(4, 0.4 * len(rows))))

        for lbl, s_dt, e_dt, color_key in data:
            y = row_to_y[lbl]
            width_days = (e_dt - s_dt).total_seconds() / 86400.0
            ax.barh(y, width_days, left=mdates.date2num(s_dt), height=0.35, align='center')
            # annotate short test name for fte/equipment charts
            if 'FTE' in title or 'Equipment' in title:
                txt = color_key[:5]
                ax.text(mdates.date2num(s_dt) + width_days/2, y, txt, va='center', ha='center', fontsize=7, color='white')

        ax.set_yticks(range(len(rows)))
        ax.set_yticklabels(rows)
        ax.xaxis.set_major_locator(mdates.MonthLocator(interval=1))
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m'))
        ax.set_title(title)
        ax.set_xlabel('Date')
        ax.set_ylabel('')
        fig.autofmt_xdate()
        plt.tight_layout()
        plt.savefig(os.path.join(outputs_dir, fname))
        plt.close(fig)

    # Gantt: tests by leg
    test_bars: List[Tuple[str, datetime, datetime, str]] = []
    for row in sched_rows:
        if not row["start"]:
            continue
        s_dt = datetime.fromisoformat(row["start"])  # type: ignore[arg-type]
        e_dt = datetime.fromisoformat(row["end"])  # type: ignore[arg-type]
        label = f"{row['project_leg_id']}"
        test_bars.append((label, s_dt, e_dt, row["project_leg_id"]))
    plot_gantt(test_bars, "Gantt - Tests by Leg", "gantt_tests.png")

    # Gantt: equipment usage (annotate first 5 chars of test_id)
    equip_bars: List[Tuple[str, datetime, datetime, str]] = []
    for eq_id, intervals in equip_usage.items():
        for s_dt, e_dt, test_id in intervals:
            equip_bars.append((eq_id, s_dt, e_dt, test_id))
    plot_gantt(equip_bars, "Equipment Utilization", "gantt_equipment.png")

    # Gantt: fte usage (annotate first 5 chars of test_id)
    fte_bars: List[Tuple[str, datetime, datetime, str]] = []
    for ft_id, intervals in fte_usage.items():
        for s_dt, e_dt, test_id in intervals:
            fte_bars.append((ft_id, s_dt, e_dt, test_id))
    plot_gantt(fte_bars, "FTE Utilization", "gantt_fte.png")

    # Concurrency line chart and combined figure
    active_intervals = [(datetime.fromisoformat(r["start"]), datetime.fromisoformat(r["end"])) for r in sched_rows if r["start"]]
    if active_intervals:
        start_min = min(s for s, _ in active_intervals)
        end_max = max(e for _, e in active_intervals)
        step_hours = 24 // UNITS_PER_DAY
        ts: List[datetime] = []
        vals: List[int] = []
        tcur = start_min
        while tcur <= end_max:
            c = sum(1 for s, e in active_intervals if s <= tcur < e)
            ts.append(tcur)
            vals.append(c)
            tcur = tcur + timedelta(hours=step_hours)

        # Concurrency line
        fig, ax = plt.subplots(figsize=(12, 3))
        ax.plot(ts, vals, label="active tests")
        ax.axhline(2, color="red", linestyle="--", label="capacity=2")
        ax.set_ylim(bottom=0)
        ax.xaxis.set_major_locator(mdates.MonthLocator(interval=1))
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m'))
        ax.set_title("Active tests over time")
        ax.legend(loc="upper left")
        fig.autofmt_xdate()
        plt.tight_layout()
        plt.savefig(os.path.join(outputs_dir, "concurrency_line.png"))
        plt.close(fig)

        # Combined figure: tests-by-leg + concurrency line
        rows = sorted(set(lbl for lbl, *_ in test_bars))
        row_to_y = {lbl: i for i, lbl in enumerate(rows)}
        fig, (ax_top, ax_bot) = plt.subplots(2, 1, figsize=(12, max(6, 0.6 * len(rows) + 2)), sharex=True, gridspec_kw={'height_ratios':[3,1]})
        for lbl, s_dt, e_dt, _ in test_bars:
            y = row_to_y[lbl]
            width_days = (e_dt - s_dt).total_seconds() / 86400.0
            ax_top.barh(y, width_days, left=mdates.date2num(s_dt), height=0.35, align='center', alpha=0.9)
        ax_top.set_yticks(range(len(rows)))
        ax_top.set_yticklabels(rows)
        ax_top.set_title("Gantt - Tests by Leg (with concurrency)")
        ax_top.set_ylabel("")
        ax_bot.plot(ts, vals, label="active tests")
        ax_bot.axhline(2, color="red", linestyle="--", label="capacity=2")
        ax_bot.set_ylim(bottom=0)
        ax_bot.set_xlabel("Date")
        ax_bot.set_ylabel("# active")
        ax_bot.legend(loc="upper left")
        ax_bot.xaxis.set_major_locator(mdates.MonthLocator(interval=1))
        ax_bot.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m'))
        fig.autofmt_xdate()
        plt.tight_layout()
        plt.savefig(os.path.join(outputs_dir, "gantt_tests_with_concurrency.png"))
        plt.close(fig)

    # Also write a small manifest file
    with open(os.path.join(outputs_dir, "MANIFEST.txt"), "w", encoding="utf-8") as f:
        f.write("Generated files:\n")
        f.write("- tests_schedule.csv\n")
        f.write("- equipment_usage.csv\n")
        f.write("- fte_usage.csv\n")
        f.write("- gantt_tests.png\n")
        f.write("- gantt_equipment.png\n")
        f.write("- gantt_fte.png\n")

    # Concurrency timeseries (half-day granularity)
    active = [(datetime.fromisoformat(r["start"]), datetime.fromisoformat(r["end"])) for r in sched_rows if r["start"]]
    if active:
        start_min = min(s for s, _ in active)
        end_max = max(e for _, e in active)
        step_hours = 24 // UNITS_PER_DAY
        t = start_min
        series: List[Tuple[datetime, int]] = []
        while t <= end_max:
            c = sum(1 for s, e in active if s <= t < e)
            series.append((t, c))
            t = t + timedelta(hours=step_hours)
        max_c = max(c for _, c in series)
        when_max = [ts.isoformat() for ts, c in series if c == max_c][:5]
        pd.DataFrame([(ts, c) for ts, c in series], columns=["timestamp", "num_active_tests"]).to_csv(
            os.path.join(outputs_dir, "concurrency_timeseries.csv"), index=False
        )
        with open(os.path.join(outputs_dir, "concurrency_summary.txt"), "w", encoding="utf-8") as f:
            f.write(f"max_active_tests={max_c}\n")
            f.write("examples_at=\n")
            for w in when_max:
                f.write(f"- {w}\n")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Run the planning system")
    parser.add_argument(
        "--input-folder", 
        "-i", 
        type=str, 
        default="input_data",
        help="Path to the input data folder (default: input_data)"
    )
    parser.add_argument(
        "--output-folder", 
        "-o", 
        type=str, 
        default="outputs",
        help="Path to the output folder (default: outputs)"
    )
    
    args = parser.parse_args()
    
    # Validate that the input folder exists
    if not os.path.exists(args.input_folder):
        print(f"Error: Input folder '{args.input_folder}' does not exist.")
        exit(1)
    
    plan_and_output(sample_dir=args.input_folder, outputs_dir=args.output_folder)


