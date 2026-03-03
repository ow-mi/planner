import logging
import os
import threading
import time
import traceback
import uuid
from datetime import datetime
from typing import Any, Callable, Dict, Optional, Set

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
        self._cancelled_execution_ids: Set[str] = set()
        self._cancel_lock = threading.RLock()

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
        resolved_csv_files: Dict[str, str] = {}
        if request.csv_files:
            resolved_csv_files = request.csv_files
        elif request.input_data and request.input_data.tables:
            fte_table = request.input_data.tables.get("fte")
            equipment_table = request.input_data.tables.get("equipment")
            if fte_table:
                logging.info(
                    "[execution] Received FTE input table: rows=%s headers=%s",
                    len(fte_table.rows or []),
                    fte_table.headers,
                )
            if equipment_table:
                logging.info(
                    "[execution] Received equipment input table: rows=%s headers=%s",
                    len(equipment_table.rows or []),
                    equipment_table.headers,
                )
            resolved_csv_files = ValidationUtils.convert_input_tables_to_csv_files(
                request.input_data.model_dump().get("tables", {})
            )

        requires_input_bundle_validation = not bool(request.input_folder)
        if requires_input_bundle_validation:
            csv_errors = ValidationUtils.validate_csv_files(resolved_csv_files)
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

        execution_state.request_payload = request.model_copy(
            update={"csv_files": resolved_csv_files}
        ).model_dump()
        execution_state.queue_position = queue_position
        execution_state.progress_data = {
            "progress_interval_seconds": request.progress_interval_seconds or 10
        }
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

    def request_cancellation(self, execution_id: str) -> str:
        """Request execution cancellation, returning state code for API handling."""
        execution = self._state.get_execution(execution_id)
        if not execution:
            return "not_found"

        if execution.status in (
            StateExecutionStatusEnum.CANCELLED,
            StateExecutionStatusEnum.COMPLETED,
            StateExecutionStatusEnum.FAILED,
            StateExecutionStatusEnum.TIMEOUT,
        ):
            return "already_terminal"

        if execution.status == StateExecutionStatusEnum.CANCELLATION_REQUESTED:
            return "already_requested"

        with self._cancel_lock:
            self._cancelled_execution_ids.add(execution_id)

        self._state.update_execution_status(
            execution_id,
            StateExecutionStatusEnum.CANCELLATION_REQUESTED,
            current_phase="Cancellation requested",
            progress_data={
                **(execution.progress_data or {}),
                "cancel_requested_at": datetime.utcnow().isoformat(),
            },
        )
        return "accepted"

    def is_cancellation_requested(self, execution_id: str) -> bool:
        with self._cancel_lock:
            if execution_id in self._cancelled_execution_ids:
                return True
        execution = self._state.get_execution(execution_id)
        return bool(
            execution
            and execution.status == StateExecutionStatusEnum.CANCELLATION_REQUESTED
        )

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

        if self.is_cancellation_requested(execution_id):
            self._mark_execution_cancelled(execution_id, "Cancelled before execution start")
            self._queue.complete_execution(execution_id)
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
            priority_payload = request.priority_config or {}
            mode = priority_payload.get("mode")
            leg_deadlines = priority_payload.get("leg_deadlines") or {}
            leg_start_deadlines = priority_payload.get("leg_start_deadlines") or {}
            leg_deadline_penalties = (
                priority_payload.get("leg_deadline_penalties") or {}
            )
            leg_compactness_penalties = (
                priority_payload.get("leg_compactness_penalties") or {}
            )
            logging.info(
                "Execution %s priority config: mode=%s deadlines=%d start_deadlines=%d deadline_penalty_per_day=%s leg_compactness_penalty_per_day=%s leg_deadline_penalties=%d leg_compactness_penalties=%d",
                execution_id,
                mode,
                len(leg_deadlines),
                len(leg_start_deadlines),
                priority_payload.get("deadline_penalty_per_day"),
                priority_payload.get("leg_compactness_penalty_per_day"),
                len(leg_deadline_penalties),
                len(leg_compactness_penalties),
            )
            if leg_deadlines:
                logging.info(
                    "Execution %s deadline keys sample: %s",
                    execution_id,
                    list(leg_deadlines.keys())[:10],
                )
            elif leg_deadline_penalties:
                logging.warning(
                    "Execution %s has per-leg deadline penalties but no leg_deadlines; late penalties cannot apply without end dates",
                    execution_id,
                )
            if leg_start_deadlines:
                logging.info(
                    "Execution %s start deadline keys sample: %s",
                    execution_id,
                    list(leg_start_deadlines.items())[:10],
                )
            if leg_deadline_penalties:
                logging.info(
                    "Execution %s deadline penalty keys sample: %s",
                    execution_id,
                    list(leg_deadline_penalties.items())[:10],
                )
            if leg_compactness_penalties:
                logging.info(
                    "Execution %s compactness penalty keys sample: %s",
                    execution_id,
                    list(leg_compactness_penalties.items())[:10],
                )
            run_context = self._prepare_run_context(execution_id, exec_state, request)
            artifact_paths = run_context["artifact_paths"]
            input_effective_path = run_context["input_effective_path"]
            output_path = run_context["output_path"]

            if self.is_cancellation_requested(execution_id):
                self._mark_execution_cancelled(
                    execution_id,
                    "Cancelled before solver start",
                    output_path=output_path,
                )
                return

            solution = self._invoke_solver(
                execution_id, request, input_effective_path, output_path
            )

            results = self._process_results(
                execution_id, solution, output_path, artifact_paths
            )

            if self.is_cancellation_requested(execution_id):
                self._mark_execution_cancelled(
                    execution_id,
                    "Cancelled after solver run (latest plan preserved)",
                    output_path=output_path,
                    partial_results=results.model_dump(),
                )
                return

            completed_at = datetime.utcnow()
            latest_state = self._state.get_execution(execution_id)
            if latest_state:
                latest_state.status = StateExecutionStatusEnum.COMPLETED
                latest_state.completed_at = completed_at
                latest_state.progress_percentage = 100
                latest_state.current_phase = "Completed"
                latest_state.results = results.model_dump()
                latest_state.request_payload = None
                latest_state.progress_data = {
                    **(latest_state.progress_data or {}),
                    "makespan": results.makespan,
                    "objective_value": (
                        (results.solver_stats or {}).get("objective_value")
                        if results.solver_stats
                        else None
                    ),
                    "progress_interval_seconds": request.progress_interval_seconds
                    if request
                    else 10,
                }
                self._state.set_execution(latest_state)

        except Exception as exc:
            traceback.print_exc()
            if self.is_cancellation_requested(execution_id):
                self._mark_execution_cancelled(execution_id, "Cancelled due to user request")
                return
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
            with self._cancel_lock:
                self._cancelled_execution_ids.discard(execution_id)

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
            self._persist_debug_request_payload_artifact(
                execution_id=execution_id,
                request=request,
                output_path=output_path,
                artifact_paths=None,
            )
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
        run_name = self._derive_run_name(
            output_folder=request.output_folder,
            scenario_name=request.scenario_name,
        )
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
        self._persist_debug_request_payload_artifact(
            execution_id=execution_id,
            request=request,
            output_path=output_path,
            artifact_paths=artifact_paths,
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
        solver_kwargs = {
            "input_folder": input_effective_path,
            "output_folder": output_path,
            "debug_level": request.debug_level.value if request.debug_level else "INFO",
            "time_limit": request.time_limit,
            "priority_config": priority_config,
            "progress_callback": self._build_solver_progress_callback(
                execution_id, request
            ),
        }
        try:
            return runner(**solver_kwargs)
        except TypeError:
            solver_kwargs.pop("progress_callback", None)
            return runner(**solver_kwargs)

    def _build_solver_progress_callback(
        self, execution_id: str, request: SolverRequest
    ):
        interval_seconds = max(1, int(request.progress_interval_seconds or 10))
        state = {"last_emit_monotonic": 0.0, "last_schedule_hash": None, "last_makespan": None}

        def on_progress(update: Dict[str, Any]) -> None:
            schedule_hash = update.get("schedule_hash")
            now = time.monotonic()
            makespan = update.get("makespan")
            changed = (schedule_hash and schedule_hash != state["last_schedule_hash"]) or (
                makespan != state["last_makespan"]
            )
            if not changed:
                return
            if (now - state["last_emit_monotonic"]) < interval_seconds:
                return
            state["last_emit_monotonic"] = now
            state["last_schedule_hash"] = schedule_hash
            state["last_makespan"] = makespan

            objective_value = update.get("objective_value")
            best_bound = update.get("best_bound")
            schedule_preview = update.get("schedule_preview") or []
            gap_percent = None
            if (
                isinstance(objective_value, (int, float))
                and isinstance(best_bound, (int, float))
                and objective_value not in (0, None)
            ):
                try:
                    gap_percent = abs(objective_value - best_bound) / max(
                        abs(objective_value), 1e-9
                    ) * 100.0
                except Exception:
                    gap_percent = None

            execution = self._state.get_execution(execution_id)
            if not execution:
                return
            merged_progress = {
                **(execution.progress_data or {}),
                "makespan": makespan,
                "objective_value": objective_value,
                "best_bound": best_bound,
                "gap_percent": gap_percent,
                "last_solution_count": update.get("solution_count"),
                "progress_interval_seconds": interval_seconds,
                "latest_test_schedule_preview": schedule_preview,
                "latest_schedule_hash": schedule_hash,
            }
            current_phase = (
                f"Running solver (best makespan: {makespan})"
                if makespan is not None
                else "Running solver"
            )
            logging.info(
                "[execution:%s] Stream progress update sent: makespan=%s solutions=%s preview_rows=%s",
                execution_id,
                makespan,
                update.get("solution_count"),
                len(schedule_preview) if isinstance(schedule_preview, list) else 0,
            )
            self._state.update_execution_status(
                execution_id,
                StateExecutionStatusEnum.RUNNING,
                current_phase=current_phase,
                progress_data=merged_progress,
            )

        return on_progress

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
        execution_state = self._state.get_execution(execution_id)
        request_payload_path = (
            (execution_state.progress_data or {}).get("request_payload_path")
            if execution_state
            else None
        )
        if request_payload_path and os.path.exists(request_payload_path):
            try:
                with open(request_payload_path, "r", encoding="utf-8") as artifact_file:
                    output_files["solver_request_payload.json"] = artifact_file.read()
                written_output_paths["solver_request_payload.json"] = request_payload_path
            except Exception as exc:
                logging.warning(
                    "Failed to read request payload artifact for %s: %s",
                    execution_id,
                    exc,
                )

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

    def _persist_debug_request_payload_artifact(
        self,
        execution_id: str,
        request: SolverRequest,
        output_path: str,
        artifact_paths: Optional[Dict[str, str]],
    ) -> None:
        if not request.debug_level or request.debug_level.value != "DEBUG":
            return

        request_payload_path = (
            os.path.join(artifact_paths["run_root"], "solver_request_payload.json")
            if artifact_paths and artifact_paths.get("run_root")
            else os.path.join(output_path, "solver_request_payload.json")
        )
        self._file_ops.write_json(request_payload_path, request.model_dump(mode="json"))

        latest_state = self._state.get_execution(execution_id)
        if not latest_state:
            return
        latest_state.progress_data = {
            **(latest_state.progress_data or {}),
            "request_payload_path": request_payload_path,
            "request_payload_saved_at": datetime.utcnow().isoformat(),
        }
        self._state.set_execution(latest_state)

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
            "run_name": self._derive_run_name(
                output_folder=request.output_folder,
                scenario_name=request.scenario_name,
            ),
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

    def _build_partial_results_payload(
        self,
        execution_id: str,
        output_path: str,
        solution: Optional[Any] = None,
    ) -> Dict[str, Any]:
        makespan = getattr(solution, "makespan_days", None) if solution else None
        objective = getattr(solution, "objective_value", None) if solution else None
        return {
            "execution_id": execution_id,
            "status": SolverStatusEnum.NO_SOLUTION.value,
            "makespan": makespan,
            "test_schedule": [],
            "resource_utilization": {},
            "output_files": {},
            "output_root": output_path,
            "written_output_paths": {},
            "solver_stats": {
                "partial": True,
                "objective_value": objective,
            },
        }

    def _mark_execution_cancelled(
        self,
        execution_id: str,
        phase: str,
        output_path: Optional[str] = None,
        partial_results: Optional[Dict[str, Any]] = None,
    ) -> None:
        execution = self._state.get_execution(execution_id)
        if not execution:
            return

        checkpoint = {
            "execution_id": execution_id,
            "cancelled_at": datetime.utcnow().isoformat(),
            "phase": phase,
            "output_root": output_path,
        }
        merged_progress = {
            **(execution.progress_data or {}),
            "checkpoint": checkpoint,
        }
        if partial_results:
            merged_progress["partial_results"] = partial_results
            if partial_results.get("makespan") is not None:
                merged_progress["makespan"] = partial_results.get("makespan")
        execution.status = StateExecutionStatusEnum.CANCELLED
        execution.completed_at = datetime.utcnow()
        execution.current_phase = phase
        execution.request_payload = None
        execution.progress_data = merged_progress
        self._state.set_execution(execution)

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

        lower_message = str(message or "").lower()
        guidance = "Check input data and configuration."
        if "requires" in lower_message and "compatible option" in lower_message:
            guidance = (
                "Resource assignment failed. Assign FTE/equipment options for each required "
                "test, or set required counts to 0 for tests that should not consume resources."
            )

        error_details = details or {}
        error_details = {
            **error_details,
            "execution_id": execution_id,
            "current_phase": execution.current_phase,
            "progress_data": execution.progress_data or {},
            "timestamp": datetime.utcnow().isoformat(),
        }

        logging.error(
            "Execution failed",
            extra={
                "execution_id": execution_id,
                "category": category,
                "error_message": message,
                "phase": execution.current_phase,
            },
        )

        execution.status = StateExecutionStatusEnum.FAILED
        execution.completed_at = datetime.utcnow()
        execution.error = ErrorDetails(
            category=ErrorCategory(category)
            if category in ErrorCategory.__members__
            else ErrorCategory.SystemError,
            message=message,
            guidance=guidance,
            error_code=category.upper(),
            details=error_details,
        ).model_dump()
        execution.request_payload = None
        self._state.set_execution(execution)

    def _derive_run_name(
        self,
        output_folder: Optional[str],
        scenario_name: Optional[str] = None,
    ) -> str:
        """
        Derive a human-readable run name from output folder path.

        Args:
            output_folder: The requested output folder path (may be None).
            scenario_name: Human-readable scenario name (may be None).

        Returns:
            A run name string, defaulting to "run" if not derivable.
        """
        if output_folder:
            normalized = os.path.basename(output_folder.rstrip("/"))
            if normalized:
                return normalized

        if scenario_name and scenario_name.strip():
            return scenario_name.strip()

        return "run"
