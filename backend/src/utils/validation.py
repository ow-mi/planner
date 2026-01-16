from typing import Dict, List, Any
import pandas as pd
import io
import json

class ValidationUtils:
    REQUIRED_CSV_FILES = [
        "data_legs.csv",
        "data_test.csv",
        "data_fte.csv",
        "data_equipment.csv",
        "data_test_duts.csv"
    ]

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
            if len(content.encode('utf-8')) > MAX_BYTES:
                errors.append(f"File {filename} exceeds size limit of {MAX_FILE_SIZE_MB}MB")
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
        
        return errors

