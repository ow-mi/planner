import threading
import time
import uuid
import traceback
import os
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Optional

from backend.src.api.models.requests import (
    SolverRequest,
    RunUploadRequest,
    RunSolveRequest,
    RunSessionCreateRequest,
    RunSessionInputsRequest,
    BatchJobCreateRequest,
)
from backend.src.api.models.responses import (
    SolverExecution,
    ExecutionStatusEnum,
    SolverResults,
    ErrorDetails,
    ErrorCategory,
    SolverStatusEnum,
    RunSessionState,
    RunSessionStatusEnum,
    RunSessionResponse,
    RunSessionInputsResponse,
    BatchJobSubmissionResponse,
    BatchJobStatusResponse,
    BatchJobResultsResponse,
    BatchScenarioStatus,
    BatchScenarioResultItem,
    BatchJobStatusEnum,
)
from backend.src.services.queue_service import queue_service
from backend.src.utils.file_handler import FileHandler
from backend.src.utils.validation import ValidationUtils
from planner_v4.main import main as planner_main
from planner_v4.config.priority_modes import load_priority_config_from_dict


class SolverService:
    def __init__(self):
        self._requests: Dict[str, SolverRequest] = {}
        self._run_sessions: Dict[str, "RunSessionRecord"] = {}
        self._input_sessions: Dict[str, "InputSessionRecord"] = {}
        self._batch_jobs: Dict[str, "BatchJobRecord"] = {}
        self._stop_event = threading.Event()
        self._worker_thread = threading.Thread(target=self._process_queue, daemon=True)
        self._worker_thread.start()

    def create_run_session(self) -> RunSessionState:
        run_id = str(uuid.uuid4())
        self._run_sessions[run_id] = RunSessionRecord(run_id=run_id)
        return RunSessionState(
            run_id=run_id,
            status=RunSessionStatusEnum.CREATED,
            has_inputs=False,
            execution_id=None,
            execution_status=None,
        )

    def upload_run_inputs(
        self, run_id: str, request: RunUploadRequest
    ) -> RunSessionState:
        run_session = self._run_sessions.get(run_id)
        if not run_session:
            raise KeyError("Run session not found")

        csv_errors = ValidationUtils.validate_csv_files(request.csv_files)
        if csv_errors:
            raise ValueError(f"CSV Validation Error: {'; '.join(csv_errors)}")

        priority_errors = ValidationUtils.validate_priority_config(
            request.priority_config
        )
        if priority_errors:
            raise ValueError(
                f"Priority Config Validation Error: {'; '.join(priority_errors)}"
            )

        run_session.csv_files = request.csv_files
        run_session.priority_config = request.priority_config

        current_execution = (
            self.get_execution_status(run_session.execution_id)
            if run_session.execution_id
            else None
        )
        execution_status = current_execution.status if current_execution else None
        status = self._derive_run_session_status(run_session, current_execution)

        return RunSessionState(
            run_id=run_id,
            status=status,
            has_inputs=True,
            execution_id=run_session.execution_id,
            execution_status=execution_status,
        )

    def start_run_session_execution(
        self, run_id: str, request: RunSolveRequest
    ) -> SolverExecution:
        run_session = self._run_sessions.get(run_id)
        if not run_session:
            raise KeyError("Run session not found")
        if not run_session.csv_files or run_session.priority_config is None:
            raise ValueError(
                "Run session inputs are missing. Upload inputs before solving"
            )

        execution = self.create_execution(
            SolverRequest(
                csv_files=run_session.csv_files,
                priority_config=run_session.priority_config,
                time_limit=request.time_limit,
                debug_level=request.debug_level,
                output_folder=request.output_folder,
            )
        )
        run_session.execution_id = execution.execution_id
        return execution

    def get_run_session_status(self, run_id: str) -> Optional[RunSessionState]:
        run_session = self._run_sessions.get(run_id)
        if not run_session:
            return None

        execution = (
            self.get_execution_status(run_session.execution_id)
            if run_session.execution_id
            else None
        )
        execution_status = execution.status if execution else None

        return RunSessionState(
            run_id=run_id,
            status=self._derive_run_session_status(run_session, execution),
            has_inputs=run_session.csv_files is not None
            and run_session.priority_config is not None,
            execution_id=run_session.execution_id,
            execution_status=execution_status,
        )

    def get_run_session_results(self, run_id: str) -> Optional[SolverResults]:
        run_session = self._run_sessions.get(run_id)
        if not run_session or not run_session.execution_id:
            return None
        return self.get_execution_results(run_session.execution_id)

    def create_inputs_session(
        self, request: Optional[RunSessionCreateRequest] = None
    ) -> RunSessionResponse:
        request = request or RunSessionCreateRequest()
        session_id = str(uuid.uuid4())
        self._input_sessions[session_id] = InputSessionRecord(
            session_id=session_id,
            name=request.name,
            source=request.source,
            files={},
        )
        return RunSessionResponse(
            session_id=session_id,
            status=RunSessionStatusEnum.CREATED,
            name=request.name,
            source=request.source,
        )

    def upload_session_inputs(
        self, session_id: str, request: RunSessionInputsRequest
    ) -> RunSessionInputsResponse:
        input_session = self._input_sessions.get(session_id)
        if not input_session:
            raise KeyError("Run session not found")

        files = {input_file.name: input_file.content for input_file in request.files}
        input_session.files = files

        return RunSessionInputsResponse(
            session_id=session_id,
            status=RunSessionStatusEnum.READY,
            has_inputs=len(files) > 0,
            file_count=len(files),
        )

    def create_batch_job(
        self, request: BatchJobCreateRequest
    ) -> BatchJobSubmissionResponse:
        input_session = self._input_sessions.get(request.session_id)
        if not input_session:
            raise KeyError("Run session not found")
        if not input_session.files:
            raise ValueError(
                "Run session inputs are missing. Upload inputs before batch run"
            )

        scenario_records = []
        for scenario in request.scenarios:
            execution = self.create_execution(
                SolverRequest(
                    csv_files=input_session.files,
                    priority_config=self._default_batch_priority_config(),
                    time_limit=scenario.time_limit,
                    debug_level=scenario.debug_level,
                    output_folder=scenario.output_folder,
                )
            )
            scenario_records.append(
                BatchScenarioRecord(
                    scenario_id=str(uuid.uuid4()),
                    scenario_name=scenario.name,
                    execution_id=execution.execution_id,
                    status=execution.status,
                )
            )

        batch_id = str(uuid.uuid4())
        self._batch_jobs[batch_id] = BatchJobRecord(
            batch_id=batch_id,
            session_id=request.session_id,
            status=BatchJobStatusEnum.PENDING,
            scenarios=scenario_records,
        )

        return self._build_batch_submission_response(self._batch_jobs[batch_id])

    def get_batch_job_status(self, batch_id: str) -> Optional[BatchJobStatusResponse]:
        batch_job = self._batch_jobs.get(batch_id)
        if not batch_job:
            return None

        self._refresh_batch_job_status(batch_job)
        return BatchJobStatusResponse(
            batch_id=batch_job.batch_id,
            status=batch_job.status,
            progress=self._batch_progress(batch_job),
            message=self._batch_status_message(batch_job.status),
            scenario_statuses=[
                BatchScenarioStatus(
                    scenario_id=scenario.scenario_id,
                    scenario_name=scenario.scenario_name,
                    status=scenario.status,
                    execution_id=scenario.execution_id,
                    error=scenario.error,
                )
                for scenario in batch_job.scenarios
            ],
        )

    def get_batch_job_results(self, batch_id: str) -> Optional[BatchJobResultsResponse]:
        batch_job = self._batch_jobs.get(batch_id)
        if not batch_job:
            return None

        self._refresh_batch_job_status(batch_job)
        items = []
        for scenario in batch_job.scenarios:
            items.append(
                BatchScenarioResultItem(
                    scenario_id=scenario.scenario_id,
                    scenario_name=scenario.scenario_name,
                    status=scenario.status,
                    execution_id=scenario.execution_id,
                    results=self.get_execution_results(scenario.execution_id),
                )
            )

        return BatchJobResultsResponse(
            batch_id=batch_job.batch_id,
            status=batch_job.status,
            items=items,
        )

    def create_execution(self, request: SolverRequest) -> SolverExecution:
        # validation
        csv_errors = ValidationUtils.validate_csv_files(request.csv_files)
        if csv_errors:
            raise ValueError(f"CSV Validation Error: {'; '.join(csv_errors)}")

        priority_errors = ValidationUtils.validate_priority_config(
            request.priority_config
        )
        if priority_errors:
            raise ValueError(
                f"Priority Config Validation Error: {'; '.join(priority_errors)}"
            )

        execution_id = str(uuid.uuid4())
        execution = SolverExecution(
            execution_id=execution_id,
            status=ExecutionStatusEnum.PENDING,
            created_at=datetime.utcnow(),
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
                elif (
                    queue_service.active_execution.status == ExecutionStatusEnum.PENDING
                ):
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
            with open(priority_config_path, "w", encoding="utf-8") as f:
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
                debug_level=request.debug_level.value
                if request.debug_level
                else "INFO",
                time_limit=request.time_limit,
                priority_config=priority_config,
            )

            execution.progress_percentage = 90
            execution.current_phase = "Processing results"

            # 5. Process Results
            status_map = {
                "OPTIMAL": SolverStatusEnum.OPTIMAL,
                "FEASIBLE": SolverStatusEnum.FEASIBLE,
                "INFEASIBLE": SolverStatusEnum.INFEASIBLE,
                "NO_SOLUTION": SolverStatusEnum.NO_SOLUTION,
                "UNKNOWN": SolverStatusEnum.NO_SOLUTION,
            }

            # Collect output files
            expected_files = [
                "schedule.csv",
                "tests_schedule.csv",
                "resource_utilization.csv",
                "fte_usage.csv",
                "equipment_usage.csv",
                "concurrency_timeseries.csv",
            ]
            # Also check logs
            # Logs are in output_path/logs
            log_files = []
            logs_dir = f"{output_path}/logs"
            if os.path.exists(logs_dir):
                log_files = [
                    f"logs/{f}" for f in os.listdir(logs_dir) if f.endswith(".log")
                ]

            output_files = FileHandler.read_output_files(
                f"{output_path}/data", expected_files
            )

            # Validation and Aliasing
            # Ensure tests_schedule.csv is present if schedule.csv exists
            if (
                "tests_schedule.csv" not in output_files
                and "schedule.csv" in output_files
            ):
                output_files["tests_schedule.csv"] = output_files["schedule.csv"]

            # Log missing files
            found_files = set(output_files.keys())
            # We don't strictly require schedule.csv if tests_schedule.csv is present
            required_for_frontend = {
                "tests_schedule.csv",
                "resource_utilization.csv",
                "fte_usage.csv",
                "equipment_usage.csv",
                "concurrency_timeseries.csv",
            }
            missing_files = required_for_frontend - found_files
            if missing_files:
                print(
                    f"Warning: Missing expected output files for execution {execution.execution_id}: {missing_files}"
                )

            # Add logs
            log_contents = FileHandler.read_output_files(output_path, log_files)
            output_files.update(log_contents)

            # Solution is a SolutionResult object, not a dict
            solution_status = (
                solution.status if hasattr(solution, "status") else "UNKNOWN"
            )

            # Extract simple types for serialization
            test_schedule_data = []
            if hasattr(solution, "test_schedules") and solution.test_schedules:
                for ts in solution.test_schedules:
                    # Convert dataclass to dict
                    test_schedule_data.append(
                        {
                            "test_id": ts.test_id,
                            "project_leg_id": ts.project_leg_id,
                            "test_name": ts.test_name,
                            "start_day": ts.start_day,
                            "end_day": ts.end_day,
                            "duration_days": ts.duration_days,
                            "start_date": ts.start_date.isoformat()
                            if ts.start_date
                            else None,
                            "end_date": ts.end_date.isoformat()
                            if ts.end_date
                            else None,
                            "assigned_fte": ts.assigned_fte,
                            "assigned_equipment": ts.assigned_equipment,
                        }
                    )

            results = SolverResults(
                execution_id=execution.execution_id,
                status=status_map.get(solution_status, SolverStatusEnum.NO_SOLUTION),
                makespan=solution.makespan_days
                if hasattr(solution, "makespan_days")
                else 0,
                test_schedule=test_schedule_data,
                resource_utilization=solution.resource_utilization
                if hasattr(solution, "resource_utilization")
                else {},
                output_files=output_files,
                solver_stats={
                    "solve_time": solution.solve_time_seconds
                    if hasattr(solution, "solve_time_seconds")
                    else 0,
                    "objective_value": solution.objective_value
                    if hasattr(solution, "objective_value")
                    else 0,
                },
            )

            execution.results = results
            execution.status = ExecutionStatusEnum.COMPLETED
            execution.completed_at = datetime.utcnow()
            execution.progress_percentage = 100
            execution.current_phase = "Completed"

        except Exception as e:
            traceback.print_exc()
            self._handle_error(
                execution,
                "SolverError",
                str(e),
                details={"traceback": traceback.format_exc()},
            )
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

    def _handle_error(
        self,
        execution: SolverExecution,
        category: str,
        message: str,
        details: dict = None,
    ):
        execution.status = ExecutionStatusEnum.FAILED
        execution.completed_at = datetime.utcnow()
        execution.error = ErrorDetails(
            category=ErrorCategory(category)
            if category in ErrorCategory.__members__
            else ErrorCategory.SystemError,
            message=message,
            guidance="Check input data and configuration.",
            error_code=category.upper(),
            details=details,
        )
        queue_service.complete_execution(execution.execution_id)

    def _derive_run_session_status(
        self, run_session: "RunSessionRecord", execution: Optional[SolverExecution]
    ) -> RunSessionStatusEnum:
        if execution:
            return RunSessionStatusEnum(execution.status.value)
        if (
            run_session.csv_files is not None
            and run_session.priority_config is not None
        ):
            return RunSessionStatusEnum.READY
        return RunSessionStatusEnum.CREATED

    def _default_batch_priority_config(self) -> Dict:
        return {
            "mode": "leg_end_dates",
            "description": "batch-default",
            "weights": {
                "makespan_weight": 0.2,
                "priority_weight": 0.8,
            },
        }

    def _refresh_batch_job_status(self, batch_job: "BatchJobRecord"):
        has_running = False
        has_failure = False
        all_completed = True

        for scenario in batch_job.scenarios:
            execution = self.get_execution_status(scenario.execution_id)
            if execution:
                scenario.status = execution.status
                scenario.error = execution.error.message if execution.error else None
            else:
                # Execution not found, mark as PENDING (or keep original if already completed/failed)
                # The default status when creating is PENDING, so if it's not completed/failed, use PENDING
                if scenario.status not in (
                    ExecutionStatusEnum.COMPLETED,
                    ExecutionStatusEnum.FAILED,
                    ExecutionStatusEnum.TIMEOUT,
                ):
                    scenario.status = ExecutionStatusEnum.PENDING
                    scenario.error = None

            if scenario.status == ExecutionStatusEnum.RUNNING:
                has_running = True
            elif scenario.status in (
                ExecutionStatusEnum.FAILED,
                ExecutionStatusEnum.TIMEOUT,
            ):
                has_failure = True

            if scenario.status != ExecutionStatusEnum.COMPLETED:
                all_completed = False

        if has_failure:
            batch_job.status = BatchJobStatusEnum.FAILED
        elif all_completed and batch_job.scenarios:
            batch_job.status = BatchJobStatusEnum.COMPLETED
        elif has_running:
            batch_job.status = BatchJobStatusEnum.RUNNING
        else:
            batch_job.status = BatchJobStatusEnum.PENDING

    def _build_batch_submission_response(
        self, batch_job: "BatchJobRecord"
    ) -> BatchJobSubmissionResponse:
        return BatchJobSubmissionResponse(
            batch_id=batch_job.batch_id,
            status=batch_job.status,
            message=self._batch_status_message(batch_job.status),
            scenario_statuses=[
                BatchScenarioStatus(
                    scenario_id=scenario.scenario_id,
                    scenario_name=scenario.scenario_name,
                    status=scenario.status,
                    execution_id=scenario.execution_id,
                    error=scenario.error,
                )
                for scenario in batch_job.scenarios
            ],
        )

    def _batch_progress(self, batch_job: "BatchJobRecord") -> int:
        if not batch_job.scenarios:
            return 0
        completed = sum(
            1
            for scenario in batch_job.scenarios
            if scenario.status == ExecutionStatusEnum.COMPLETED
        )
        return int((completed / len(batch_job.scenarios)) * 100)

    def _batch_status_message(self, status: BatchJobStatusEnum) -> str:
        if status == BatchJobStatusEnum.COMPLETED:
            return "Batch completed"
        if status == BatchJobStatusEnum.RUNNING:
            return "Batch running"
        if status == BatchJobStatusEnum.FAILED:
            return "Batch failed"
        return "Batch queued"


@dataclass
class RunSessionRecord:
    run_id: str
    csv_files: Optional[Dict[str, str]] = None
    priority_config: Optional[Dict] = None
    execution_id: Optional[str] = None


@dataclass
class InputSessionRecord:
    session_id: str
    name: Optional[str] = None
    source: Optional[str] = None
    files: Optional[Dict[str, str]] = None


@dataclass
class BatchScenarioRecord:
    scenario_id: str
    scenario_name: str
    execution_id: str
    status: ExecutionStatusEnum
    error: Optional[str] = None


@dataclass
class BatchJobRecord:
    batch_id: str
    session_id: str
    status: BatchJobStatusEnum
    scenarios: list[BatchScenarioRecord]


# Global instance
solver_service = SolverService()
