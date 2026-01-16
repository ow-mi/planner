import threading
import time
import uuid
import traceback
import os
from datetime import datetime
from typing import Dict, Optional

from backend.src.api.models.requests import SolverRequest
from backend.src.api.models.responses import (
    SolverExecution, ExecutionStatusEnum, SolverResults, ErrorDetails, ErrorCategory, SolverStatusEnum
)
from backend.src.services.queue_service import queue_service
from backend.src.utils.file_handler import FileHandler
from backend.src.utils.validation import ValidationUtils
from planner_v4.main import main as planner_main
from planner_v4.config.priority_modes import load_priority_config_from_dict

class SolverService:
    def __init__(self):
        self._requests: Dict[str, SolverRequest] = {}
        self._stop_event = threading.Event()
        self._worker_thread = threading.Thread(target=self._process_queue, daemon=True)
        self._worker_thread.start()

    def create_execution(self, request: SolverRequest) -> SolverExecution:
        # validation
        csv_errors = ValidationUtils.validate_csv_files(request.csv_files)
        if csv_errors:
            raise ValueError(f"CSV Validation Error: {'; '.join(csv_errors)}")
        
        priority_errors = ValidationUtils.validate_priority_config(request.priority_config)
        if priority_errors:
             raise ValueError(f"Priority Config Validation Error: {'; '.join(priority_errors)}")

        execution_id = str(uuid.uuid4())
        execution = SolverExecution(
            execution_id=execution_id,
            status=ExecutionStatusEnum.PENDING,
            created_at=datetime.utcnow()
        )
        self._requests[execution_id] = request
        queue_service.enqueue(execution)
        return execution

    def get_execution_status(self, execution_id: str) -> Optional[SolverExecution]:
        return queue_service.get_execution(execution_id)

    def get_execution_results(self, execution_id: str) -> Optional[SolverResults]:
        execution = queue_service.get_execution(execution_id)
        if execution and execution.status == ExecutionStatusEnum.COMPLETED:
            return execution.results
        return None

    def _process_queue(self):
        while not self._stop_event.is_set():
            try:
                # Check if there is an active execution that needs to be run
                # or if we need to pick next
                # In this simple integration, the queue service manages active/pending state conceptually,
                # but we need to drive the execution.
                
                # Check for next pending execution if none is running
                if queue_service.active_execution is None:
                     execution = queue_service.get_next_execution()
                     if execution:
                         self._run_solver(execution)
                elif queue_service.active_execution.status == ExecutionStatusEnum.PENDING:
                     # It was set as active but not started yet (should be handled by get_next_execution logic usually, but for safety)
                     self._run_solver(queue_service.active_execution)
                
                time.sleep(1)
            except Exception as e:
                print(f"Error in worker loop: {e}")
                time.sleep(5)

    def _run_solver(self, execution: SolverExecution):
        execution.status = ExecutionStatusEnum.RUNNING
        execution.started_at = datetime.utcnow()
        execution.progress_percentage = 0
        execution.current_phase = "Initializing"
        
        request = self._requests.get(execution.execution_id)
        if not request:
            self._handle_error(execution, "SystemError", "Request data not found")
            return

        workspace_path = None
        try:
            # 1. Setup Workspace
            execution.current_phase = "Setting up workspace"
            workspace_path = FileHandler.create_temp_workspace(execution.execution_id)
            input_path = f"{workspace_path}/input"
            output_path = f"{workspace_path}/output"
            
            # 2. Save Input Files
            execution.current_phase = "Saving input files"
            FileHandler.save_input_files(input_path, request.csv_files)
            
            # 3. Parse and Save Priority Config
            # We need to save it to disk because data_loader expects it to exist
            import json
            priority_config_path = f"{input_path}/priority_config.json"
            with open(priority_config_path, 'w') as f:
                json.dump(request.priority_config, f, indent=2)
            
            priority_config = load_priority_config_from_dict(request.priority_config)
            
            # 4. Run Solver
            execution.current_phase = "Running solver"
            execution.progress_percentage = 10
            
            # Note: planner_main is blocking, so we might want to run it in executor if we want better progress updates
            # But since this is the worker thread, blocking is fine for the thread. 
            # Real-time progress from within planner_main isn't easily accessible without modifying it 
            # or parsing logs. For now we update status before and after.
            
            solution = planner_main(
                input_folder=input_path,
                output_folder=output_path,
                debug_level=request.debug_level.value if request.debug_level else "INFO",
                time_limit=request.time_limit,
                priority_config=priority_config
            )
            
            execution.progress_percentage = 90
            execution.current_phase = "Processing results"
            
            # 5. Process Results
            status_map = {
                "OPTIMAL": SolverStatusEnum.OPTIMAL,
                "FEASIBLE": SolverStatusEnum.FEASIBLE,
                "INFEASIBLE": SolverStatusEnum.INFEASIBLE,
                "NO_SOLUTION": SolverStatusEnum.NO_SOLUTION,
                "UNKNOWN": SolverStatusEnum.NO_SOLUTION
            }
            
            # Collect output files
            expected_files = [
                "schedule.csv", "tests_schedule.csv", "resource_utilization.csv", 
                "fte_usage.csv", "equipment_usage.csv", 
                "concurrency_timeseries.csv"
            ]
            # Also check logs
            # Logs are in output_path/logs
            log_files = []
            logs_dir = f"{output_path}/logs"
            if os.path.exists(logs_dir):
                 log_files = [f"logs/{f}" for f in os.listdir(logs_dir) if f.endswith(".log")]
            
            output_files = FileHandler.read_output_files(f"{output_path}/data", expected_files)
            
            # Validation and Aliasing
            # Ensure tests_schedule.csv is present if schedule.csv exists
            if "tests_schedule.csv" not in output_files and "schedule.csv" in output_files:
                output_files["tests_schedule.csv"] = output_files["schedule.csv"]
                
            # Log missing files
            found_files = set(output_files.keys())
            # We don't strictly require schedule.csv if tests_schedule.csv is present
            required_for_frontend = {"tests_schedule.csv", "resource_utilization.csv", "fte_usage.csv", "equipment_usage.csv", "concurrency_timeseries.csv"}
            missing_files = required_for_frontend - found_files
            if missing_files:
                print(f"Warning: Missing expected output files for execution {execution.execution_id}: {missing_files}")

            # Add logs
            log_contents = FileHandler.read_output_files(output_path, log_files)
            output_files.update(log_contents)

            # Solution is a SolutionResult object, not a dict
            solution_status = solution.status if hasattr(solution, 'status') else "UNKNOWN"
            
            # Extract simple types for serialization
            test_schedule_data = []
            if hasattr(solution, 'test_schedules') and solution.test_schedules:
                for ts in solution.test_schedules:
                    # Convert dataclass to dict
                    test_schedule_data.append({
                        "test_id": ts.test_id,
                        "project_leg_id": ts.project_leg_id,
                        "test_name": ts.test_name,
                        "start_day": ts.start_day,
                        "end_day": ts.end_day,
                        "duration_days": ts.duration_days,
                        "start_date": ts.start_date.isoformat() if ts.start_date else None,
                        "end_date": ts.end_date.isoformat() if ts.end_date else None,
                        "assigned_fte": ts.assigned_fte,
                        "assigned_equipment": ts.assigned_equipment
                    })

            results = SolverResults(
                execution_id=execution.execution_id,
                status=status_map.get(solution_status, SolverStatusEnum.NO_SOLUTION),
                makespan=solution.makespan_days if hasattr(solution, 'makespan_days') else 0,
                test_schedule=test_schedule_data,
                resource_utilization=solution.resource_utilization if hasattr(solution, 'resource_utilization') else {},
                output_files=output_files,
                solver_stats={
                    "solve_time": solution.solve_time_seconds if hasattr(solution, 'solve_time_seconds') else 0,
                    "objective_value": solution.objective_value if hasattr(solution, 'objective_value') else 0
                }
            )
            
            execution.results = results
            execution.status = ExecutionStatusEnum.COMPLETED
            execution.completed_at = datetime.utcnow()
            execution.progress_percentage = 100
            execution.current_phase = "Completed"

        except Exception as e:
            traceback.print_exc()
            self._handle_error(execution, "SolverError", str(e), details={"traceback": traceback.format_exc()})
        finally:
            # Close logging handlers to release file locks
            # This is a bit of a hack because planner_v4 sets up logging on the root logger
            import logging
            root_logger = logging.getLogger()
            for handler in root_logger.handlers[:]:
                 # Only close file handlers to avoid messing up console logging too much, 
                 # or close all if we re-setup every time (which planner_v4 seems to do)
                 if isinstance(handler, logging.FileHandler):
                      handler.close()
                      root_logger.removeHandler(handler)

            # 6. Cleanup
            if workspace_path:
                try:
                    FileHandler.cleanup_workspace(workspace_path)
                except Exception as e:
                    print(f"Warning: Failed to cleanup workspace {workspace_path}: {e}")
            
            # Mark completion in queue service
            queue_service.complete_execution(execution.execution_id)
            
            # Clean up request data
            if execution.execution_id in self._requests:
                del self._requests[execution.execution_id]

    def _handle_error(self, execution: SolverExecution, category: str, message: str, details: dict = None):
        execution.status = ExecutionStatusEnum.FAILED
        execution.completed_at = datetime.utcnow()
        execution.error = ErrorDetails(
            category=ErrorCategory(category) if category in ErrorCategory.__members__ else ErrorCategory.SystemError,
            message=message,
            guidance="Check input data and configuration.",
            error_code=category.upper(),
            details=details
        )
        queue_service.complete_execution(execution.execution_id)

# Global instance
solver_service = SolverService()
