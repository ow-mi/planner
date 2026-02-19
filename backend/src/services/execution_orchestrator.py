import logging
import os
import threading
import time
import traceback
import uuid
from datetime import datetime
from typing import Any, Callable, Dict, Optional

from backend.src.api.models.requests import SolverRequest
from backend.src.api.models.responses import (
    ErrorCategory,
    ErrorDetails,
    ExecutionStatusEnum,
    SolverExecution,
    SolverResults,
    SolverStatusEnum,
)
from backend.src.services.file_operations_service import FileOperationsService
from backend.src.services.queue_service import ExecutionQueueService
from backend.src.state import (
    ExecutionState,
    ExecutionStatusEnum as StateExecutionStatusEnum,
    StateStore,
)
from backend.src.state.mappers import execution_state_to_response
from backend.src.utils.validation import ValidationUtils
from solver.config.priority_modes import load_priority_config_from_dict
from solver.main import main as planner_main


class ExecutionOrchestrator:
    """
    Orchestrates the complete lifecycle of solver execution.

    This class coordinates validation, execution, result processing, and error handling
    for solver runs. It also manages a background worker thread for queue processing.

    Architecture Notes:
    - This orchestrator intentionally keeps validation, execution, and result processing
      together because they share the same "reason to change" - the solver execution flow.
    - The class is organized into logical sections (see section headers below).
    - Utility functions with no orchestrator context are delegated to FileOperationsService.

    Threading Model:
    - A background worker thread processes the execution queue (start_worker/stop_worker).
    - StateStore provides thread-safe state access via RLock.
    - The _stop_event coordinates graceful shutdown.
    """

    def __init__(
        self,
        state_store: StateStore,
        file_ops: FileOperationsService,
        queue_service: ExecutionQueueService,
        solver_runner: Optional[Callable[..., Any]] = None,
    ):
        self._state = state_store
        self._file_ops = file_ops
        self._solver_runner = solver_runner
        self._queue = queue_service
        self._stop_event = threading.Event()
        self._worker_thread: Optional[threading.Thread] = None

    # =========================================================================
    # SECTION: Public API
    # =========================================================================
    # Methods that are called by external clients (SolverService, routes).
    # These form the primary interface for execution lifecycle management.

    # -------------------------------------------------------------------------
    # create_execution: Entry point for new solver runs
    # Validates input, creates execution record, enqueues for processing.
    # -------------------------------------------------------------------------
    def create_execution(self, request: SolverRequest) -> SolverExecution:
        """
        Create a new execution and enqueue it for processing.

        This method validates the incoming request, creates an execution record
        with PENDING status, and places it in the execution queue.

        Args:
            request: The solver request containing CSV files and configuration.

        Returns:
            SolverExecution with execution_id, status, and queue position.

        Raises:
            ValueError: If CSV files or priority config fail validation.
        """
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
        queue_position = self._queue.enqueue(execution)

        execution_state = self._state.get_execution(execution_id)
        if not execution_state:
            execution_state = ExecutionState(
                execution_id=execution_id,
                status=StateExecutionStatusEnum.PENDING,
                created_at=execution.created_at,
            )

        execution_state.request_payload = request.model_dump()
        execution_state.queue_position = queue_position
        self._state.set_execution(execution_state)

        persisted = self._state.get_execution(execution_id)
        if not persisted:
            execution.queue_position = queue_position
            return execution
        return execution_state_to_response(persisted)

    def get_execution_status(self, execution_id: str) -> Optional[SolverExecution]:
        """Fetch execution status by ID."""
        return self._queue.get_execution(execution_id)

    def get_execution_results(self, execution_id: str) -> Optional[SolverResults]:
        """
        Fetch execution results when execution is completed.

        Args:
            execution_id: The UUID of the execution.

        Returns:
            SolverResults if execution is COMPLETED, None otherwise.
        """
        execution = self.get_execution_status(execution_id)
        if execution and execution.status == ExecutionStatusEnum.COMPLETED:
            return execution.results
        return None

    # =========================================================================
    # SECTION: Queue Processing & Worker Lifecycle
    # =========================================================================
    # Methods that manage the execution queue and background worker thread.
    # The worker thread continuously processes pending executions.

    def run_solver(self, execution_id: str) -> None:
        """
        Execute solver for a given execution ID.

        This method runs in the worker thread context. It:
        1. Loads the execution state
        2. Prepares the workspace
        3. Invokes the solver
        4. Processes results
        5. Handles any errors

        Args:
            execution_id: The UUID of the execution to run.
        """
        exec_state = self._state.get_execution(execution_id)
        if not exec_state:
            return

        started_at = datetime.utcnow()
        self._state.update_execution_status(
            execution_id,
            StateExecutionStatusEnum.RUNNING,
            started_at=started_at,
            progress_percentage=0,
            current_phase="Initializing",
        )

        request_payload = exec_state.request_payload
        if not request_payload:
            self._handle_error(execution_id, "SystemError", "Request data not found")
            self._queue.complete_execution(execution_id)
            return

        artifact_paths: Optional[Dict[str, str]] = None
        request: Optional[SolverRequest] = None

        try:
            request = SolverRequest(**request_payload)
            run_context = self._prepare_run_context(execution_id, exec_state, request)
            artifact_paths = run_context["artifact_paths"]
            input_effective_path = run_context["input_effective_path"]
            output_path = run_context["output_path"]

            solution = self._invoke_solver(
                execution_id, request, input_effective_path, output_path
            )
            results = self._process_results(
                execution_id, solution, output_path, artifact_paths
            )

            completed_at = datetime.utcnow()
            latest_state = self._state.get_execution(execution_id)
            if latest_state:
                latest_state.status = StateExecutionStatusEnum.COMPLETED
                latest_state.completed_at = completed_at
                latest_state.progress_percentage = 100
                latest_state.current_phase = "Completed"
                latest_state.results = results.model_dump()
                latest_state.request_payload = None
                self._state.set_execution(latest_state)

        except Exception as exc:
            traceback.print_exc()
            self._handle_error(
                execution_id,
                "SolverError",
                str(exc),
                details={"traceback": traceback.format_exc()},
            )
        finally:
            self._cleanup_logging_handlers()
            if artifact_paths and request is not None:
                self._write_run_metadata(execution_id, request, artifact_paths)
            self._queue.complete_execution(execution_id)

    def _run_solver(self, execution_id: str) -> None:
        """Backward-compatible alias for older callers."""
        self.run_solver(execution_id)

    def start_worker(self) -> None:
        """
        Start background worker thread if not already running.

        The worker thread processes the execution queue, running solver
        executions sequentially as they become available.
        """
        if self._worker_thread and self._worker_thread.is_alive():
            return
        self._stop_event.clear()
        self._worker_thread = threading.Thread(target=self._process_queue, daemon=True)
        self._worker_thread.start()

    def stop_worker(self) -> None:
        """
        Stop background worker thread gracefully.

        Signals the worker to stop and waits up to 2 seconds for completion.
        """
        self._stop_event.set()
        if self._worker_thread and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=2)

    def _process_queue(self) -> None:
        """
        Worker thread main loop.

        Continuously checks for pending executions and runs them.
        Implements exponential backoff on errors (5s delay vs 1s normal).
        """
        while not self._stop_event.is_set():
            try:
                if self._queue.active_execution is None:
                    execution = self._queue.get_next_execution()
                    if execution:
                        self.run_solver(execution.execution_id)
                elif self._queue.active_execution.status == ExecutionStatusEnum.PENDING:
                    self.run_solver(self._queue.active_execution.execution_id)

                time.sleep(1)
            except Exception as exc:
                logging.exception("Error in worker loop: %s", exc)
                time.sleep(5)

    # =========================================================================
    # SECTION: Workspace Preparation
    # =========================================================================
    # Methods that set up the execution environment before solver runs.
    # Creates directories, copies input files, and prepares output paths.

    def _prepare_run_context(
        self,
        execution_id: str,
        exec_state: ExecutionState,
        request: SolverRequest,
    ) -> Dict[str, Any]:
        direct_folder_mode = bool(request.input_folder)
        if direct_folder_mode:
            input_effective_path = request.input_folder
            output_path = request.output_folder or request.input_folder
            os.makedirs(output_path, exist_ok=True)
            return {
                "artifact_paths": None,
                "input_effective_path": input_effective_path,
                "output_path": output_path,
            }

        self._state.update_execution_status(
            execution_id,
            StateExecutionStatusEnum.RUNNING,
            current_phase="Setting up workspace",
        )
        run_name = self._derive_run_name(request.output_folder)
        artifact_paths = self._file_ops.create_run_workspace(
            execution_id=execution_id,
            run_name=run_name,
            created_at=exec_state.created_at,
        )
        input_original_path = artifact_paths["input_original"]
        input_effective_path = artifact_paths["input_effective"]
        output_path = artifact_paths["output"]

        self._state.update_execution_status(
            execution_id,
            StateExecutionStatusEnum.RUNNING,
            current_phase="Saving input files",
        )
        self._file_ops.save_input_files(
            input_original_path,
            request.csv_files,
            request.priority_config,
        )
        self._file_ops.save_input_files(
            input_effective_path,
            request.csv_files,
            request.priority_config,
        )
        return {
            "artifact_paths": artifact_paths,
            "input_effective_path": input_effective_path,
            "output_path": output_path,
        }

    # =========================================================================
    # SECTION: Solver Invocation
    # =========================================================================
    # Methods that call the external solver process.
    # The solver runner is configurable for testing (injectable via constructor).

    def _invoke_solver(
        self,
        execution_id: str,
        request: SolverRequest,
        input_effective_path: str,
        output_path: str,
    ) -> Any:
        priority_config = load_priority_config_from_dict(request.priority_config)
        self._state.update_execution_status(
            execution_id,
            StateExecutionStatusEnum.RUNNING,
            current_phase="Running solver",
            progress_percentage=10,
        )
        runner = self._solver_runner or planner_main
        return runner(
            input_folder=input_effective_path,
            output_folder=output_path,
            debug_level=request.debug_level.value if request.debug_level else "INFO",
            time_limit=request.time_limit,
            priority_config=priority_config,
        )

    # =========================================================================
    # SECTION: Result Processing
    # =========================================================================
    # Methods that transform solver output into API response models.
    # Parses output files, extracts test schedules, and builds SolverResults.

    def _process_results(
        self,
        execution_id: str,
        solution: Any,
        output_path: str,
        artifact_paths: Optional[Dict[str, str]],
    ) -> SolverResults:
        self._state.update_execution_status(
            execution_id,
            StateExecutionStatusEnum.RUNNING,
            current_phase="Processing results",
            progress_percentage=90,
        )
        status_map = {
            "OPTIMAL": SolverStatusEnum.OPTIMAL,
            "FEASIBLE": SolverStatusEnum.FEASIBLE,
            "INFEASIBLE": SolverStatusEnum.INFEASIBLE,
            "NO_SOLUTION": SolverStatusEnum.NO_SOLUTION,
            "UNKNOWN": SolverStatusEnum.NO_SOLUTION,
        }

        output_artifacts = self._file_ops.read_output_files(output_path)
        output_files = output_artifacts["output_files"]
        written_output_paths = output_artifacts["written_output_paths"]

        missing_files = {
            "tests_schedule.csv",
            "resource_utilization.csv",
            "fte_usage.csv",
            "equipment_usage.csv",
            "concurrency_timeseries.csv",
        } - set(output_files.keys())
        if missing_files:
            logging.warning(
                "Missing expected output files for execution %s: %s",
                execution_id,
                missing_files,
            )

        if artifact_paths:
            self._file_ops.copy_directory(
                f"{output_path}/plots", artifact_paths["plots"]
            )

        solution_status = solution.status if hasattr(solution, "status") else "UNKNOWN"
        test_schedule_data = self._extract_test_schedule(solution)
        return SolverResults(
            execution_id=execution_id,
            status=status_map.get(solution_status, SolverStatusEnum.NO_SOLUTION),
            makespan=solution.makespan_days
            if hasattr(solution, "makespan_days")
            else 0,
            test_schedule=test_schedule_data,
            resource_utilization=solution.resource_utilization
            if hasattr(solution, "resource_utilization")
            else {},
            output_files=output_files,
            output_root=output_path,
            written_output_paths=written_output_paths,
            solver_stats={
                "solve_time": solution.solve_time_seconds
                if hasattr(solution, "solve_time_seconds")
                else 0,
                "objective_value": solution.objective_value
                if hasattr(solution, "objective_value")
                else 0,
            },
        )

    def _extract_test_schedule(self, solution: Any) -> list[Dict[str, Any]]:
        rows = []
        if not hasattr(solution, "test_schedules") or not solution.test_schedules:
            return rows

        for schedule in solution.test_schedules:
            rows.append(
                {
                    "test_id": schedule.test_id,
                    "project_leg_id": schedule.project_leg_id,
                    "test_name": schedule.test_name,
                    "start_day": schedule.start_day,
                    "end_day": schedule.end_day,
                    "duration_days": schedule.duration_days,
                    "start_date": schedule.start_date.isoformat()
                    if schedule.start_date
                    else None,
                    "end_date": schedule.end_date.isoformat()
                    if schedule.end_date
                    else None,
                    "assigned_fte": schedule.assigned_fte,
                    "assigned_equipment": schedule.assigned_equipment,
                }
            )
        return rows

    # =========================================================================
    # SECTION: Metadata & Persistence
    # =========================================================================
    # Methods that write execution metadata and manage file artifacts.
    # Called after solver execution completes (success or failure).

    def _write_run_metadata(
        self,
        execution_id: str,
        request: SolverRequest,
        artifact_paths: Dict[str, str],
    ) -> None:
        final_state = self._state.get_execution(execution_id)
        if not final_state:
            return

        run_metadata = {
            "run_id": execution_id,
            "run_name": self._derive_run_name(request.output_folder),
            "status": final_state.status.value,
            "created_at": final_state.created_at.isoformat()
            if final_state.created_at
            else None,
            "started_at": final_state.started_at.isoformat()
            if final_state.started_at
            else None,
            "completed_at": final_state.completed_at.isoformat()
            if final_state.completed_at
            else None,
            "time_limit": request.time_limit,
            "debug_level": request.debug_level.value if request.debug_level else None,
            "requested_output_folder": request.output_folder,
            "artifact_paths": {
                "input_original": artifact_paths["input_original"],
                "input_effective": artifact_paths["input_effective"],
                "output": artifact_paths["output"],
                "plots": artifact_paths["plots"],
            },
        }
        try:
            self._file_ops.write_json(artifact_paths["settings_used"], run_metadata)
        except Exception as exc:
            logging.warning(
                "Failed to write run metadata for %s: %s", execution_id, exc
            )

    # =========================================================================
    # SECTION: Error Handling & Utilities
    # =========================================================================
    # Methods that handle execution failures and provide helper functions.
    # Errors are persisted to StateStore for client retrieval.

    def _cleanup_logging_handlers(self) -> None:
        """
        Clean up file-based logging handlers after execution.

        Prevents file handle leaks when multiple executions run sequentially.
        """
        root_logger = logging.getLogger()
        for handler in root_logger.handlers[:]:
            if isinstance(handler, logging.FileHandler):
                handler.close()
                root_logger.removeHandler(handler)

    def _handle_error(
        self,
        execution_id: str,
        category: str,
        message: str,
        details: Optional[dict] = None,
    ) -> None:
        """
        Handle execution failure by persisting error state.

        Updates the execution record with FAILED status and error details.
        The error is persisted to StateStore for client retrieval via API.

        Args:
            execution_id: The UUID of the failed execution.
            category: Error category (e.g., "SolverError", "SystemError").
            message: Human-readable error message.
            details: Optional dict with additional context (e.g., traceback).
        """
        execution = self._state.get_execution(execution_id)
        if not execution:
            return

        execution.status = StateExecutionStatusEnum.FAILED
        execution.completed_at = datetime.utcnow()
        execution.error = ErrorDetails(
            category=ErrorCategory(category)
            if category in ErrorCategory.__members__
            else ErrorCategory.SystemError,
            message=message,
            guidance="Check input data and configuration.",
            error_code=category.upper(),
            details=details,
        ).model_dump()
        execution.request_payload = None
        self._state.set_execution(execution)

    def _derive_run_name(self, output_folder: Optional[str]) -> str:
        """
        Derive a human-readable run name from output folder path.

        Args:
            output_folder: The requested output folder path (may be None).

        Returns:
            A run name string, defaulting to "run" if not derivable.
        """
        if not output_folder:
            return "run"
        normalized = os.path.basename(output_folder.rstrip("/"))
        return normalized or "run"
