"""Generate deterministic plot artifacts for planner runs."""

from __future__ import annotations

import base64
import html
import os
from datetime import date
from typing import Optional

from ..solver import SolutionResult


_PIXEL_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8"
    "/w8AAn8B9m9h7wAAAABJRU5ErkJggg=="
)


_STATUS_DIAGNOSTICS = {
    "INFEASIBLE": "The model constraints conflict and no valid schedule exists.",
    "UNKNOWN": "The solver could not prove feasibility in the allotted search.",
    "NO_SOLUTION": "No schedule was returned by the solver.",
    "TIMEOUT": "The solve attempt hit the configured time limit.",
}


def _render_schedule_rows(solution: SolutionResult) -> str:
    if not solution.test_schedules:
        return '<tr><td colspan="4">No scheduled tests.</td></tr>'

    rows = []
    for schedule in solution.test_schedules:
        rows.append(
            "<tr>"
            f"<td>{html.escape(schedule.test_id)}</td>"
            f"<td>{html.escape(schedule.test_name)}</td>"
            f"<td>{schedule.start_day}</td>"
            f"<td>{schedule.end_day}</td>"
            "</tr>"
        )
    return "".join(rows)


def generate_solution_artifacts(
    solution: SolutionResult,
    output_folder: str,
    start_date: Optional[date] = None,
) -> tuple[str, str]:
    """Write ``plot.html`` and ``plot.png`` for every run status."""

    os.makedirs(output_folder, exist_ok=True)
    html_path = os.path.join(output_folder, "plot.html")
    png_path = os.path.join(output_folder, "plot.png")

    diagnostics = ""
    if solution.status not in {"OPTIMAL", "FEASIBLE"}:
        detail = _STATUS_DIAGNOSTICS.get(
            solution.status, "The solver ended without a feasible schedule."
        )
        diagnostics = (
            "<section><h2>Diagnostics</h2>"
            f"<p>{html.escape(detail)}</p>"
            "<p>Review resource windows, required assignments, and dependency chains.</p>"
            "</section>"
        )

    start_date_text = start_date.isoformat() if start_date else "n/a"
    html_body = (
        '<!doctype html><html><head><meta charset="utf-8">'
        "<title>Planner Plot Artifact</title>"
        "<style>body{font-family:sans-serif;margin:24px;}"
        "table{border-collapse:collapse;width:100%;}"
        "th,td{border:1px solid #ddd;padding:6px;text-align:left;}"
        "h1,h2{margin:0 0 12px 0;}"
        "</style></head><body>"
        "<h1>Planner Plot Artifact</h1>"
        f"<p>Status: {html.escape(solution.status)}</p>"
        f"<p>Makespan: {solution.makespan_days}</p>"
        f"<p>Solve Time Seconds: {solution.solve_time_seconds:.2f}</p>"
        f"<p>Start Date: {html.escape(start_date_text)}</p>"
        "<h2>Schedule</h2>"
        "<table><thead><tr><th>Test ID</th><th>Name</th><th>Start Day</th><th>End Day</th>"
        "</tr></thead><tbody>"
        f"{_render_schedule_rows(solution)}"
        "</tbody></table>"
        f"{diagnostics}"
        "</body></html>"
    )

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_body)

    with open(png_path, "wb") as f:
        f.write(_PIXEL_PNG)

    return html_path, png_path
