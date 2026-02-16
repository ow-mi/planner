# Backend Refactoring Task

Read the plan in `backend/docs/plans/2026-02-12-backend-refactoring.md` and OpenSpec requirements in `openspec/changes/csv-driven-config-tab-redesign/specs/backend/spec.md`.

## Current State
The backend has an 857-line monolithic solver_service.py that needs to be refactored into Clean Architecture.

## Your Tasks (in order):

### Phase 1: Extract Domain Models
1. Create backend/src/domain/models/__init__.py (if not exists)
2. Create backend/src/domain/models/execution.py with ExecutionStatusEnum, SolverStatusEnum, SolverExecution dataclass, SolverResults dataclass
3. Create backend/src/domain/models/session.py with RunSessionStatusEnum, RunSessionRecord, InputSessionRecord
4. Create backend/src/domain/models/batch.py with BatchJobStatusEnum, BatchScenarioRecord, BatchJobRecord

### Phase 2: Create Application Ports
5. Create backend/src/application/__init__.py
6. Create backend/src/application/ports/__init__.py
7. Create backend/src/application/ports/queue_port.py (Protocol interface)
8. Create backend/src/application/ports/solver_port.py (Protocol interface)

### Phase 3: Create Application Services
9. Create backend/src/application/services/__init__.py
10. Create backend/src/application/services/execution_service.py
11. Create backend/src/application/services/session_service.py
12. Create backend/src/application/services/batch_job_service.py

### Phase 4: Add New Contracts (from spec.md)
13. Create backend/src/application/ports/spreadsheet_port.py for discovering candidate files, validating headers, extracting entities
14. Create backend/src/application/ports/scenario_queue_port.py for add-to-queue, run-one, run-all-unsolved, status/progress stream, stop-render

### Phase 5: Infrastructure Implementation
15. Create backend/src/infrastructure/__init__.py
16. Move/refactor queue_service.py to backend/src/infrastructure/queue/execution_queue.py implementing QueuePort interface

### Phase 6: Shared Configuration
17. Create backend/src/shared/__init__.py
18. Create backend/src/shared/config.py with BackendSettings

## Important Notes:
- Keep the existing backend/src/api/models/responses.py imports working by re-exporting from domain
- Use proper Python dataclasses and Enums
- Add type hints everywhere
- The existing solver_service.py should be gradually refactored, not deleted until migration is complete

Read the plan file for detailed code examples.