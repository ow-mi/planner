from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Dict, List, Tuple, Optional

import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from ortools.sat.python import cp_model

UNITS_PER_DAY = 2


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
    uid: str
    test_id: str
    project_leg_id: str
    test_name: str
    sequence_index: int
    duration_units: int
    completion_pct: int
    fte_required: int
    fte_time_units: int
    equipment_required: int
    fte_assigned: str
    equipment_assigned: str
    force_start_week_iso: str


@dataclass
class ResourceWindow:
    resource_id: str
    start_monday: date
    end_monday_inclusive: date


def parse_iso_week(iso_week: str) -> date:
    iso_week = iso_week.strip()
    year_str, week_str = iso_week.split("-W")
    return date.fromisocalendar(int(year_str), int(week_str), 1)


def load_legs(path: str) -> Dict[str, Leg]:
    df = pd.read_csv(path)
    legs: Dict[str, Leg] = {}
    for _, row in df.iterrows():
        legs[str(row["project_leg_id"]).strip()] = Leg(
            project_id=str(row["project_id"]).strip(),
            project_name=str(row["project_name"]).strip(),
            project_leg_id=str(row["project_leg_id"]).strip(),
            leg_number=int(row["leg_number"]),
            leg_name=str(row["leg_name"]).strip(),
            priority=int(row["priority"]),
            start_monday=parse_iso_week(str(row["start_iso_week"]))
        )
    return legs


def load_tests(path: str) -> List[Test]:
    df = pd.read_csv(path)
    tests: List[Test] = []
    for idx, row in df.iterrows():
        duration_days = float(row["duration_days"]) if not pd.isna(row["duration_days"]) else 0.0
        duration_units = int(round(duration_days * UNITS_PER_DAY))
        fte_pct = float(row.get("fte_time_pct", 100))
        fte_time_units = int(round(duration_units * max(0.0, min(100.0, fte_pct)) / 100.0))
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
                fte_time_units=fte_time_units,
                equipment_required=int(row["equipment_required"]),
                fte_assigned=str(row.get("fte_assigned", "*")).strip(),
                equipment_assigned=str(row.get("equipment_assigned", "*")).strip(),
                force_start_week_iso=str(row.get("force_start_week_iso", "*")).strip(),
            )
        )
    return tests


def load_resource_windows(path: str, id_col: str) -> List[ResourceWindow]:
    df = pd.read_csv(path)
    windows: List[ResourceWindow] = []
    for _, row in df.iterrows():
        windows.append(
            ResourceWindow(
                resource_id=str(row[id_col]).strip(),
                start_monday=parse_iso_week(str(row["available_start_week_iso"])) ,
                end_monday_inclusive=parse_iso_week(str(row["available_end_week_iso"]))
            )
        )
    return windows


def compute_time_origin(legs: Dict[str, Leg], fte_windows: List[ResourceWindow], equip_windows: List[ResourceWindow]) -> date:
    dates = [leg.start_monday for leg in legs.values()] + [w.start_monday for w in fte_windows] + [w.start_monday for w in equip_windows]
    return min(dates)


def date_to_units(day0: date, d: date) -> int:
    return (d - day0).days * UNITS_PER_DAY


def units_to_datetime(day0: date, units: int) -> datetime:
    days = units // UNITS_PER_DAY
    rem = units % UNITS_PER_DAY
    dt = datetime.combine(day0 + timedelta(days=days), datetime.min.time())
    if rem:
        dt += timedelta(hours=12)
    return dt


def build_and_solve(
    legs: Dict[str, Leg],
    tests: List[Test],
    fte_windows: List[ResourceWindow],
    equip_windows: List[ResourceWindow],
):
    day0 = compute_time_origin(legs, fte_windows, equip_windows)

    fte_bounds = {}
    for idx, w in enumerate(fte_windows):
        fte_bounds[idx] = (date_to_units(day0, w.start_monday), date_to_units(day0, w.end_monday_inclusive + timedelta(days=7)))

    equip_bounds = {}
    for idx, w in enumerate(equip_windows):
        equip_bounds[idx] = (date_to_units(day0, w.start_monday), date_to_units(day0, w.end_monday_inclusive + timedelta(days=7)))

    sched_tests = [t for t in tests if t.completion_pct < 100]

    total_units = sum(t.duration_units for t in sched_tests)
    latest_leg_start = max(date_to_units(day0, legs[t.project_leg_id].start_monday) for t in sched_tests) if sched_tests else 0
    max_resource_end = max([b for _, (_, b) in fte_bounds.items()] + [b for _, (_, b) in equip_bounds.items()]) if (fte_bounds or equip_bounds) else 0
    horizon = max(max_resource_end, latest_leg_start + total_units + 1)

    model = cp_model.CpModel()

    start_vars: Dict[str, cp_model.IntVar] = {}
    end_vars: Dict[str, cp_model.IntVar] = {}

    for t in sched_tests:
        earliest_start = date_to_units(day0, legs[t.project_leg_id].start_monday)
        # Apply forced start if provided
        if t.force_start_week_iso and t.force_start_week_iso != "*":
            try:
                forced_date = parse_iso_week(t.force_start_week_iso)
                forced_units = date_to_units(day0, forced_date)
            except Exception:
                forced_units = earliest_start
            start = model.NewIntVar(forced_units, forced_units, f"start_{t.uid}")
        else:
            start = model.NewIntVar(earliest_start, horizon, f"start_{t.uid}")
        end = model.NewIntVar(earliest_start, horizon + t.duration_units, f"end_{t.uid}")
        model.NewIntervalVar(start, t.duration_units, end, f"ivl_{t.uid}")
        start_vars[t.uid] = start
        end_vars[t.uid] = end

    # sequencing
    by_leg: Dict[str, List[Test]] = {}
    for t in sched_tests:
        by_leg.setdefault(t.project_leg_id, []).append(t)
    for leg_id, leg_tests in by_leg.items():
        leg_tests_sorted = sorted(leg_tests, key=lambda x: x.sequence_index)
        for prev, nxt in zip(leg_tests_sorted, leg_tests_sorted[1:]):
            model.Add(end_vars[prev.uid] <= start_vars[nxt.uid])

    # equipment assignment
    equip_nooverlap = {i: [] for i in range(len(equip_windows))}
    equip_nooverlap_by_resource: Dict[str, List[cp_model.IntervalVar]] = {}
    equip_assign: Dict[Tuple[str, int], cp_model.BoolVar] = {}
    for t in sched_tests:
        lits = []
        for r_idx, (a, b) in equip_bounds.items():
            eq_id = equip_windows[r_idx].resource_id
            allowed = (t.equipment_assigned == "*") or (t.equipment_assigned.lower() in eq_id.lower())
            x = model.NewBoolVar(f"xeq_{t.uid}_{r_idx}")
            opt_ivl = model.NewOptionalIntervalVar(start_vars[t.uid], t.duration_units, end_vars[t.uid], x, f"ivleq_{t.uid}_{r_idx}")
            model.Add(start_vars[t.uid] >= a).OnlyEnforceIf(x)
            model.Add(end_vars[t.uid] <= b).OnlyEnforceIf(x)
            equip_nooverlap[r_idx].append(opt_ivl)
            equip_nooverlap_by_resource.setdefault(eq_id, []).append(opt_ivl)
            equip_assign[(t.uid, r_idx)] = x
            if allowed:
                lits.append(x)
        model.Add(sum(lits) == max(0, t.equipment_required))
    for ivls in equip_nooverlap.values():
        model.AddNoOverlap(ivls)
    # Ensure single capacity across all windows belonging to the same physical equipment
    for eq_id, ivls in equip_nooverlap_by_resource.items():
        if len(ivls) > 1:
            model.AddNoOverlap(ivls)

    # fte assignment
    fte_nooverlap = {i: [] for i in range(len(fte_windows))}
    fte_nooverlap_by_resource: Dict[str, List[cp_model.IntervalVar]] = {}
    fte_assign: Dict[Tuple[str, int], cp_model.BoolVar] = {}
    fte_sub_start_vars: Dict[Tuple[str, int], cp_model.IntVar] = {}
    fte_sub_end_vars: Dict[Tuple[str, int], cp_model.IntVar] = {}
    for t in sched_tests:
        lits = []
        for r_idx, (a, b) in fte_bounds.items():
            fte_id = fte_windows[r_idx].resource_id
            allowed = (t.fte_assigned == "*") or (t.fte_assigned.lower() in fte_id.lower())
            x = model.NewBoolVar(f"xft_{t.uid}_{r_idx}")
            work_dur = max(0, t.fte_time_units)
            # Model FTE usage for only a portion of the test: place an optional sub-interval inside [start,end]
            # sub_start >= start; sub_end = sub_start + work_dur; and sub_end <= end
            sub_start = model.NewIntVar(0, horizon, f"ft_sub_start_{t.uid}_{r_idx}")
            sub_end = model.NewIntVar(0, horizon, f"ft_sub_end_{t.uid}_{r_idx}")
            model.Add(sub_end == sub_start + work_dur).OnlyEnforceIf(x)
            model.Add(sub_start >= start_vars[t.uid]).OnlyEnforceIf(x)
            model.Add(sub_end <= end_vars[t.uid]).OnlyEnforceIf(x)
            opt_ivl_ft = model.NewOptionalIntervalVar(sub_start, work_dur, sub_end, x, f"ivlft_{t.uid}_{r_idx}")
            model.Add(start_vars[t.uid] >= a).OnlyEnforceIf(x)
            model.Add(end_vars[t.uid] <= b).OnlyEnforceIf(x)
            # NoOverlap uses the sub-interval (actual work) rather than full test duration
            fte_nooverlap[r_idx].append(opt_ivl_ft)
            fte_nooverlap_by_resource.setdefault(fte_id, []).append(opt_ivl_ft)
            fte_assign[(t.uid, r_idx)] = x
            fte_sub_start_vars[(t.uid, r_idx)] = sub_start
            fte_sub_end_vars[(t.uid, r_idx)] = sub_end
            if allowed:
                lits.append(x)
        model.Add(sum(lits) == max(0, t.fte_required))
    for ivls in fte_nooverlap.values():
        model.AddNoOverlap(ivls)
    for ft_id, ivls in fte_nooverlap_by_resource.items():
        if len(ivls) > 1:
            model.AddNoOverlap(ivls)

    # objective
    max_priority = max(leg.priority for leg in legs.values()) if legs else 0
    model.Minimize(sum(((max_priority + 1) - legs[t.project_leg_id].priority) * end_vars[t.uid] for t in sched_tests))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30.0
    solver.parameters.num_search_workers = 8
    status = solver.Solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        raise RuntimeError(f"No feasible solution: {solver.StatusName(status)}")

    # build outputs
    equip_index_to_id = {idx: w.resource_id for idx, w in enumerate(equip_windows)}
    fte_index_to_id = {idx: w.resource_id for idx, w in enumerate(fte_windows)}

    assigned_equipment_index: Dict[str, Optional[int]] = {}
    assigned_fte_index: Dict[str, Optional[int]] = {}
    for t in sched_tests:
        eq = None
        for r_idx in range(len(equip_windows)):
            if solver.Value(equip_assign[(t.uid, r_idx)]) == 1:
                eq = r_idx
                break
        ft = None
        for r_idx in range(len(fte_windows)):
            if solver.Value(fte_assign[(t.uid, r_idx)]) == 1:
                ft = r_idx
                break
        assigned_equipment_index[t.uid] = eq
        assigned_fte_index[t.uid] = ft

    return (
        day0,
        solver,
        sched_tests,
        start_vars,
        end_vars,
        assigned_equipment_index,
        assigned_fte_index,
        equip_index_to_id,
        fte_index_to_id,
        fte_sub_start_vars,
        fte_sub_end_vars,
    )


def plan_and_output(sample_dir: str, outputs_dir_data: str, outputs_dir_plots: str) -> None:
    legs = load_legs(os.path.join(sample_dir, "data_legs.csv"))
    tests = load_tests(os.path.join(sample_dir, "data_test.csv"))
    fte_windows = load_resource_windows(os.path.join(sample_dir, "data_fte.csv"), id_col="fte_id")
    equip_windows = load_resource_windows(os.path.join(sample_dir, "data_equipment.csv"), id_col="equipment_id")

    (
        day0,
        solver,
        sched_tests,
        start_vars,
        end_vars,
        assigned_equipment_index,
        assigned_fte_index,
        equip_index_to_id,
        fte_index_to_id,
        fte_sub_start_vars,
        fte_sub_end_vars,
    ) = build_and_solve(legs, tests, fte_windows, equip_windows)

    # assemble rows
    rows = []
    equip_usage = {}
    fte_usage = {}
    for t in sched_tests:
        s = solver.Value(start_vars[t.uid])
        e = solver.Value(end_vars[t.uid])
        s_dt = units_to_datetime(day0, s)
        e_dt = units_to_datetime(day0, e)
        eq_idx = assigned_equipment_index.get(t.uid)
        ft_idx = assigned_fte_index.get(t.uid)
        eq_id = equip_index_to_id[eq_idx] if eq_idx is not None else ""
        ft_id = fte_index_to_id[ft_idx] if ft_idx is not None else ""
        rows.append({
            "test_id": t.test_id,
            "project_leg_id": t.project_leg_id,
            "test_name": t.test_name,
            "sequence_index": t.sequence_index,
            "duration_days": t.duration_units/UNITS_PER_DAY,
            "start": s_dt.isoformat(),
            "end": e_dt.isoformat(),
            "assigned_equipment_id": eq_id,
            "assigned_fte_id": ft_id,
        })
        if eq_id:
            equip_usage.setdefault(eq_id, []).append((s_dt, e_dt, t.test_id))
        if ft_id:
            # Use actual FTE sub-interval from the solver for plotting and CSV
            key = (t.uid, ft_idx)
            if key in fte_sub_start_vars and key in fte_sub_end_vars:
                s_units = solver.Value(fte_sub_start_vars[key])
                e_units = solver.Value(fte_sub_end_vars[key])
                s_dt_ft = units_to_datetime(day0, s_units)
                e_dt_ft = units_to_datetime(day0, e_units)
            else:
                s_dt_ft, e_dt_ft = s_dt, e_dt
            fte_usage.setdefault(ft_id, []).append((s_dt_ft, e_dt_ft, t.test_id))

    # write csvs
    pd.DataFrame(rows).to_csv(os.path.join(outputs_dir_data, "tests_schedule.csv"), index=False)
    erows = []
    for eq_id, ivls in equip_usage.items():
        for s_dt, e_dt, test_id in sorted(ivls, key=lambda x: x[0]):
            erows.append({"equipment_id": eq_id, "test_id": test_id, "start": s_dt.isoformat(), "end": e_dt.isoformat()})
    pd.DataFrame(erows).to_csv(os.path.join(outputs_dir_data, "equipment_usage.csv"), index=False)
    frows = []
    for ft_id, ivls in fte_usage.items():
        for s_dt, e_dt, test_id in sorted(ivls, key=lambda x: x[0]):
            frows.append({"fte_id": ft_id, "test_id": test_id, "start": s_dt.isoformat(), "end": e_dt.isoformat()})
    pd.DataFrame(frows).to_csv(os.path.join(outputs_dir_data, "fte_usage.csv"), index=False)

    # plots
    def plot_gantt(data: List[Tuple[str, datetime, datetime, str]], title: str, fname: str) -> None:
        if not data:
            return
        rows_sorted = sorted(set(lbl for lbl, *_ in data))
        ymap = {lbl: i for i, lbl in enumerate(rows_sorted)}
        fig, ax = plt.subplots(figsize=(12, max(4, 0.4*len(rows_sorted))))
        for lbl, s_dt, e_dt, key in data:
            y = ymap[lbl]
            width_days = (e_dt - s_dt).total_seconds()/86400.0
            ax.barh(y, width_days, left=mdates.date2num(s_dt), height=0.35, align='center')
            # annotate
            if 'FTE' in title or 'Equipment' in title:
                ax.text(mdates.date2num(s_dt)+width_days/2, y, key[0:10], va='center', ha='center', fontsize=7, color='white')
            if 'Tests by Leg' in title:
                ax.text(mdates.date2num(s_dt)+0.1, y+0.18, key[0:14], va='center', ha='left', fontsize=7, color='black')
        ax.set_yticks(range(len(rows_sorted)))
        ax.set_yticklabels(rows_sorted)
        ax.xaxis.set_major_locator(mdates.MonthLocator(interval=1))
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m'))
        ax.set_title(title)
        fig.autofmt_xdate()
        plt.tight_layout()
        plt.savefig(os.path.join(outputs_dir_plots, fname))
        plt.close(fig)

    # tests by leg
    test_bars = []
    for r in rows:
        test_bars.append((r['project_leg_id'], datetime.fromisoformat(r['start']), datetime.fromisoformat(r['end']), r['test_name']))
    plot_gantt(test_bars, 'Gantt - Tests by Leg', 'gantt_tests.png')

    equip_bars = []
    for eq_id, ivls in equip_usage.items():
        for s_dt, e_dt, test_id in ivls:
            equip_bars.append((eq_id, s_dt, e_dt, test_id))
    plot_gantt(equip_bars, 'Equipment Utilization', 'gantt_equipment.png')

    fte_bars = []
    for ft_id, ivls in fte_usage.items():
        for s_dt, e_dt, test_id in ivls:
            fte_bars.append((ft_id, s_dt, e_dt, test_id))
    plot_gantt(fte_bars, 'FTE Utilization', 'gantt_fte.png')

    # Resource timelines: availability vs utilization under each resource
    def plot_availability_and_usage(resource_windows: List[ResourceWindow], usage_map: Dict[str, List[Tuple[datetime, datetime, str]]], title: str, fname: str) -> None:
        if not resource_windows:
            return
        # stable unique order of resource ids
        rows_sorted: List[str] = []
        for w in resource_windows:
            if w.resource_id not in rows_sorted:
                rows_sorted.append(w.resource_id)
        ymap = {rid: i*2 for i, rid in enumerate(rows_sorted)}  # double spacing for availability and usage rows
        fig, ax = plt.subplots(figsize=(12, max(4, 0.6*len(rows_sorted))))
        # availability bars (row y) – draw ALL windows per resource
        first_avail_drawn = False
        for w in resource_windows:
            rid = w.resource_id
            s_dt = datetime.combine(w.start_monday, datetime.min.time())
            e_dt = datetime.combine(w.end_monday_inclusive + timedelta(days=7), datetime.min.time())
            y = ymap[rid]
            width_days = (e_dt - s_dt).total_seconds()/86400.0
            ax.barh(y, width_days, left=mdates.date2num(s_dt), height=0.35, align='center', color='#c7e9c0', label='availability' if not first_avail_drawn else None)
            first_avail_drawn = True
            # annotate only once per resource at the beginning of its first window
            ax.text(mdates.date2num(s_dt)+0.1, y+0.18, f"{rid} avail", fontsize=7)
        # usage bars (row y+1)
        for rid in rows_sorted:
            y = ymap[rid] + 1
            for s_dt, e_dt, test_id in usage_map.get(rid, []):
                width_days = (e_dt - s_dt).total_seconds()/86400.0
                ax.barh(y, width_days, left=mdates.date2num(s_dt), height=0.35, align='center', color='#6baed6')
                ax.text(mdates.date2num(s_dt)+0.1, y+0.18, test_id[0:12], fontsize=7, color='white')
        ax.set_yticks([i for rid in rows_sorted for i in (ymap[rid], ymap[rid]+1)])
        ax.set_yticklabels([f"{rid} (avail)" if i%2==0 else f"{rid} (use)" for rid in rows_sorted for i in (0,1)])
        ax.xaxis.set_major_locator(mdates.MonthLocator(interval=1))
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m'))
        ax.set_title(title)
        fig.autofmt_xdate()
        plt.tight_layout()
        plt.savefig(os.path.join(outputs_dir_plots, fname))
        plt.close(fig)

    plot_availability_and_usage(fte_windows, fte_usage, 'Resource FTE (availability vs utilization)', 'resource_fte.png')
    plot_availability_and_usage(equip_windows, equip_usage, 'Resource Equipment (availability vs utilization)', 'resource_equipment.png')

    # Concurrency and capacity over time (half-day resolution)
    if rows:
        start_min = min(datetime.fromisoformat(r['start']) for r in rows)
        end_max = max(datetime.fromisoformat(r['end']) for r in rows)
        step = timedelta(hours=24//UNITS_PER_DAY)
        ts: List[datetime] = []
        active: List[int] = []
        avail_fte: List[int] = []
        avail_eq: List[int] = []
        t = start_min
        # Precompute availability windows as datetime
        fte_avail = [
            (
                datetime.combine(w.start_monday, datetime.min.time()),
                datetime.combine(w.end_monday_inclusive + timedelta(days=7), datetime.min.time()),
            )
            for w in fte_windows
        ]
        eq_avail = [
            (
                datetime.combine(w.start_monday, datetime.min.time()),
                datetime.combine(w.end_monday_inclusive + timedelta(days=7), datetime.min.time()),
            )
            for w in equip_windows
        ]

        intervals = [
            (datetime.fromisoformat(r['start']), datetime.fromisoformat(r['end'])) for r in rows
        ]
        while t <= end_max:
            ts.append(t)
            active.append(sum(1 for s,e in intervals if s <= t < e))
            avail_fte.append(sum(1 for a,b in fte_avail if a <= t < b))
            avail_eq.append(sum(1 for a,b in eq_avail if a <= t < b))
            t = t + step
        cap = [min(f,e) for f,e in zip(avail_fte, avail_eq)]
        dfc = pd.DataFrame({
            'timestamp': ts,
            'active_tests': active,
            'available_fte': avail_fte,
            'available_equipment': avail_eq,
            'capacity_min': cap,
        })
        dfc.to_csv(os.path.join(outputs_dir_data, 'concurrency_timeseries.csv'), index=False)

        # Plot concurrency vs capacity
        fig, ax = plt.subplots(figsize=(12, 3.5))
        ax.plot(ts, active, label='active tests')
        ax.step(ts, cap, where='post', label='capacity=min(FTE,Equipment)', linestyle='--', color='red')
        ax.set_ylim(bottom=0)
        ax.xaxis.set_major_locator(mdates.MonthLocator(interval=1))
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m'))
        ax.set_title('Active tests vs capacity')
        ax.legend(loc='upper left')
        fig.autofmt_xdate()
        plt.tight_layout()
        plt.savefig(os.path.join(outputs_dir_plots, 'concurrency_line.png'))
        plt.close(fig)



