import csv
import io
from datetime import datetime
from typing import Any, Dict, List, Optional

import pandas as pd


class ValidationUtils:
    REQUIRED_CSV_FILES = [
        "data_legs.csv",
        "data_test.csv",
        "data_fte.csv",
        "data_equipment.csv",
        "data_test_duts.csv",
    ]
    LOGICAL_TABLE_TO_CSV_FILE = {
        "legs": "data_legs.csv",
        "tests": "data_test.csv",
        "fte": "data_fte.csv",
        "equipment": "data_equipment.csv",
        "test_duts": "data_test_duts.csv",
    }
    TABLE_ALIASES = {
        "legs": {"legs", "leg", "data_legs", "data_legs.csv"},
        "tests": {"tests", "test", "data_test", "data_test.csv"},
        "fte": {"fte", "data_fte", "data_fte.csv"},
        "equipment": {"equipment", "data_equipment", "data_equipment.csv"},
        "test_duts": {"test_duts", "testduts", "data_test_duts", "data_test_duts.csv"},
    }

    @staticmethod
    def validate_csv_files(csv_files: Dict[str, str]) -> List[str]:
        """
        Validate presence and basic CSV structure of input files.
        Returns a list of error messages.
        """
        errors = []

        # Check presence
        for required in ValidationUtils.REQUIRED_CSV_FILES:
            if required not in csv_files:
                errors.append(f"Missing required file: {required}")

        # Check parsing and size
        MAX_FILE_SIZE_MB = 10
        MAX_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

        for filename, content in csv_files.items():
            if len(content.encode("utf-8")) > MAX_BYTES:
                errors.append(
                    f"File {filename} exceeds size limit of {MAX_FILE_SIZE_MB}MB"
                )
                continue

            try:
                if not content.strip():
                    errors.append(f"File is empty: {filename}")
                    continue
                pd.read_csv(io.StringIO(content))
            except Exception as e:
                errors.append(f"Invalid CSV format in {filename}: {str(e)}")

        return errors

    @staticmethod
    def validate_priority_config(config: Dict[str, Any]) -> List[str]:
        """
        Validate priority configuration structure.
        Returns a list of error messages.
        """
        errors = []

        # Basic schema check (can be expanded based on priority_config.json schema)
        if "mode" not in config:
            errors.append("Missing 'mode' in priority config")

        if "weights" in config:
            weights = config["weights"]
            if "makespan_weight" in weights:
                w = weights["makespan_weight"]
                if not (0 <= w <= 1):
                    errors.append("makespan_weight must be between 0 and 1")
            if "priority_weight" in weights:
                w = weights["priority_weight"]
                if not (0 <= w <= 1):
                    errors.append("priority_weight must be between 0 and 1")

        if "leg_compactness_penalty_per_day" in config:
            value = config["leg_compactness_penalty_per_day"]
            if not isinstance(value, (int, float)) or value < 0:
                errors.append(
                    "leg_compactness_penalty_per_day must be a non-negative number"
                )
        if "leg_deadline_penalties" in config:
            value = config["leg_deadline_penalties"]
            if not isinstance(value, dict):
                errors.append("leg_deadline_penalties must be an object map")
            else:
                for leg_id, penalty in value.items():
                    if not isinstance(penalty, (int, float)) or penalty < 0:
                        errors.append(
                            f"leg_deadline_penalties[{leg_id}] must be a non-negative number"
                        )
                configured_deadlines = config.get("leg_deadlines")
                positive_penalty_legs = [
                    leg_id
                    for leg_id, penalty in value.items()
                    if isinstance(penalty, (int, float)) and penalty > 0
                ]
                if positive_penalty_legs:
                    if not isinstance(configured_deadlines, dict) or len(configured_deadlines) == 0:
                        errors.append(
                            "leg_deadlines is required when leg_deadline_penalties contains positive values"
                        )
                    else:
                        missing_deadlines = [
                            leg_id
                            for leg_id in positive_penalty_legs
                            if leg_id not in configured_deadlines
                        ]
                        if missing_deadlines:
                            errors.append(
                                "Missing leg_deadlines for penalty-enabled legs: "
                                + ", ".join(missing_deadlines[:10])
                            )
        if "leg_compactness_penalties" in config:
            value = config["leg_compactness_penalties"]
            if not isinstance(value, dict):
                errors.append("leg_compactness_penalties must be an object map")
            else:
                for leg_id, penalty in value.items():
                    if not isinstance(penalty, (int, float)) or penalty < 0:
                        errors.append(
                            f"leg_compactness_penalties[{leg_id}] must be a non-negative number"
                        )
        if "leg_start_deadlines" in config:
            value = config["leg_start_deadlines"]
            if not isinstance(value, dict):
                errors.append("leg_start_deadlines must be an object map")
            else:
                for leg_id, date_value in value.items():
                    if not isinstance(date_value, str):
                        errors.append(
                            f"leg_start_deadlines[{leg_id}] must be an ISO date string"
                        )
                        continue
                    try:
                        datetime.fromisoformat(date_value)
                    except ValueError:
                        errors.append(
                            f"leg_start_deadlines[{leg_id}] must be an ISO date string"
                        )

        return errors

    @staticmethod
    def normalize_table_key(raw_key: str) -> Optional[str]:
        normalized = str(raw_key or "").strip().lower()
        if not normalized:
            return None
        normalized = normalized.replace("-", "_").replace(" ", "_")
        for logical_key, aliases in ValidationUtils.TABLE_ALIASES.items():
            if normalized in aliases:
                return logical_key
        return None

    @staticmethod
    def convert_input_tables_to_csv_files(
        input_tables: Dict[str, Dict[str, Any]],
    ) -> Dict[str, str]:
        """
        Convert JSON table payloads into solver-compatible CSV content keyed by
        canonical legacy file names.
        """
        csv_files: Dict[str, str] = {}
        for incoming_key, table_payload in input_tables.items():
            logical_key = ValidationUtils.normalize_table_key(incoming_key)
            if not logical_key:
                continue

            canonical_filename = ValidationUtils.LOGICAL_TABLE_TO_CSV_FILE[logical_key]
            headers = table_payload.get("headers") or []
            rows = table_payload.get("rows") or []
            if not isinstance(headers, list):
                continue
            if not isinstance(rows, list):
                continue

            buffer = io.StringIO()
            writer = csv.writer(buffer, lineterminator="\n")
            writer.writerow([str(column) for column in headers])
            for row in rows:
                if isinstance(row, list):
                    writer.writerow(list(row))
                else:
                    writer.writerow([row])
            csv_files[canonical_filename] = buffer.getvalue()

        return csv_files
