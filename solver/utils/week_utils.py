"""Week parsing and normalization helpers.

This module centralizes canonical week value handling to avoid cross-module
dependencies between data loading and model-building code.

Supported formats:
- Canonical: ``YYYY-Www.f``
- Legacy: ``YYYY-Www`` or ``YYYY-ww``

The canonical form encodes ISO week plus day offset where ``f`` is ``0..6``
and maps to Monday..Sunday.
"""

from datetime import date
import re
from typing import Optional


WEEK_VALUE_RE = re.compile(
    r"^(?P<year>\d{4})-(?:W)?(?P<week>\d{1,2})(?:\.(?P<fraction>[0-6]))?$"
)


def normalize_week_value(
    raw_value, field_name: str, allow_blank: bool = False
) -> Optional[str]:
    """Normalize legacy/canonical week values to canonical ``YYYY-Www.f`` format."""
    if raw_value is None:
        if allow_blank:
            return None
        raise ValueError(
            f"Invalid week value for {field_name}: {raw_value!r}. Expected YYYY-Www.f"
        )

    try:
        if raw_value != raw_value:
            if allow_blank:
                return None
            raise ValueError(
                f"Invalid week value for {field_name}: {raw_value!r}. Expected YYYY-Www.f"
            )
    except TypeError:
        pass

    value = str(raw_value).strip()
    if value in {"", "*", "nan", "None"}:
        if allow_blank:
            return None
        raise ValueError(
            f"Invalid week value for {field_name}: {raw_value!r}. Expected YYYY-Www.f"
        )

    match = WEEK_VALUE_RE.fullmatch(value)
    if not match:
        raise ValueError(
            f"Invalid week value for {field_name}: {raw_value!r}. Expected YYYY-Www.f"
        )

    year = int(match.group("year"))
    week = int(match.group("week"))
    fraction = int(match.group("fraction") or 0)

    if not (1900 <= year <= 2100):
        raise ValueError(
            f"Invalid week value for {field_name}: {raw_value!r}. Year must be between 1900 and 2100"
        )
    if not (1 <= week <= 53):
        raise ValueError(
            f"Invalid week value for {field_name}: {raw_value!r}. Week must be between 1 and 53"
        )
    if not (0 <= fraction <= 6):
        raise ValueError(
            f"Invalid week value for {field_name}: {raw_value!r}. Fraction must be between 0 and 6"
        )

    return f"{year:04d}-W{week:02d}.{fraction}"


def parse_iso_week(iso_week: str) -> Optional[date]:
    """Parse canonical/legacy ISO week to date, where fraction is Monday+offset.

    Canonical format is ``YYYY-Www.f`` where ``f`` is day offset ``0..6`` from
    Monday (0=Monday, 6=Sunday).
    """
    normalized_week = normalize_week_value(iso_week, "iso_week", allow_blank=True)
    if normalized_week is None:
        return None

    year_week, fraction = normalized_week.split(".")
    year_str, week_str = year_week.split("-W")
    return date.fromisocalendar(int(year_str), int(week_str), int(fraction) + 1)


__all__ = ["WEEK_VALUE_RE", "normalize_week_value", "parse_iso_week"]
