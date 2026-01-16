import os
import shutil
import tempfile
from typing import Dict, List
import pandas as pd
import io

class FileHandler:
    @staticmethod
    def create_temp_workspace(execution_id: str) -> str:
        """
        Create a temporary directory for the execution.
        """
        temp_dir = tempfile.mkdtemp(prefix=f"solver_{execution_id}_")
        return temp_dir

    @staticmethod
    def save_input_files(workspace_path: str, csv_files: Dict[str, str]):
        """
        Save CSV content strings to files in the workspace.
        """
        os.makedirs(workspace_path, exist_ok=True)
        for filename, content in csv_files.items():
            file_path = os.path.join(workspace_path, filename)
            with open(file_path, 'w', newline='', encoding='utf-8') as f:
                f.write(content)

    @staticmethod
    def cleanup_workspace(workspace_path: str):
        """
        Remove the temporary workspace.
        """
        if os.path.exists(workspace_path):
            shutil.rmtree(workspace_path)

    @staticmethod
    def read_output_files(workspace_path: str, expected_files: List[str]) -> Dict[str, str]:
        """
        Read output files from workspace and return as content strings.
        """
        results = {}
        for filename in expected_files:
            file_path = os.path.join(workspace_path, filename)
            if os.path.exists(file_path):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        results[filename] = f.read()
                except UnicodeDecodeError:
                    # Handle binary files or encoding issues if necessary
                    pass
        return results





