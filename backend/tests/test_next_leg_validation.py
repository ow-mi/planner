import pandas as pd

from backend.src.services.file_upload_service import FileUploadService
from backend.src.services.spreadsheet_service import SpreadsheetService


def test_spreadsheet_service_validates_next_leg_format_and_targets():
    service = SpreadsheetService()
    df = pd.DataFrame(
        [
            {
                "project": "mwcu",
                "leg": "2.1",
                "branch": "",
                "test": "T1",
                "duration_days": 1.0,
                "description": "desc",
                "next_leg": "mwcu_2_2,mwcu_3_a",
            },
            {
                "project": "mwcu",
                "leg": "2.1",
                "branch": "",
                "test": "T2",
                "duration_days": 1.0,
                "description": "desc",
                "next_leg": "",
            },
            {
                "project": "mwcu",
                "leg": "2.2",
                "branch": "",
                "test": "T3",
                "duration_days": 1.0,
                "description": "desc",
                "next_leg": "",
            },
        ]
    )

    errors = service._validate_row_values(df)
    messages = [error.error_message for error in errors if error.column_name == "next_leg"]

    assert any("Use ';' (not ',')" in message for message in messages)
    assert any(
        "next_leg can only be set on the last test row of each leg branch" in message
        for message in messages
    )
    assert any("Unknown next_leg target" in message for message in messages)


def test_file_upload_service_surfaces_next_leg_validation_errors():
    service = FileUploadService()
    df = pd.DataFrame(
        [
            {
                "project": "mwcu",
                "leg": "3",
                "branch": "a",
                "test": "Leak",
                "duration_days": 3.6,
                "description": "Leak",
                "next_leg": "mwcu_4_a,mwcu_4_b",
            },
            {
                "project": "mwcu",
                "leg": "3",
                "branch": "a",
                "test": "P-04",
                "duration_days": 16.8,
                "description": "Physical Analysis",
                "next_leg": "",
            },
            {
                "project": "mwcu",
                "leg": "4",
                "branch": "a",
                "test": "Leak",
                "duration_days": 3.6,
                "description": "Leak",
                "next_leg": "",
            },
            {
                "project": "mwcu",
                "leg": "4",
                "branch": "b",
                "test": "Leak",
                "duration_days": 3.6,
                "description": "Leak",
                "next_leg": "",
            },
        ]
    )

    processed = service._process_dataframe(df, filename="sample.csv")
    validation_errors = processed["validation"]["errors"]

    assert any("column 'next_leg'" in message for message in validation_errors)
    assert any("Use ';' (not ',')" in message for message in validation_errors)
