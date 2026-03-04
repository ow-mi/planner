# Change: Package the planner as an offline Windows Electron app

## Why
The current product is a development-style web application that requires a user-managed Python installation, Node.js, npm, PowerShell scripts, and internet-backed dependency installation. That does not satisfy the requirement for a single Windows installer that runs fully offline.

The codebase also has multiple runtime assumptions that will break in a packaged desktop environment unless they are addressed explicitly: the frontend hardcodes `http://localhost:8000`, the backend only allows `http://localhost` browser origins, runtime data defaults to the current working directory, and some temporary/checkpoint paths are Unix-specific.

## What Changes
- Add a first-class desktop distribution target built on Electron for Windows.
- Bundle the frontend, backend, solver, Python runtime, and required native/library assets into a single Windows installer.
- Bundle the Electron runtime itself (including its embedded Node runtime) so no separate Node.js installation is required on the target machine.
- Replace the current "user installs Python/Node and runs scripts" model with an installer-managed runtime.
- Replace the operational responsibilities of `install.bat` and `start.bat` with installer-time packaging and app-managed startup supervision.
- Add exact-version lockfiles for bundled Python runtime dependencies and version-pinned build tooling inputs so offline builds are reproducible.
- Define a packaging layout that keeps immutable app assets in installed resources and writable run data in a per-user application data directory.
- Add explicit offline guarantees and validation requirements so the installed app can launch, solve, and export results without network access.
- Add packaging-time verification for required runtime assets, including native Python dependencies such as OR-Tools and Matplotlib.

## Impact
- Affected specs: `desktop-distribution`
- Affected code:
  - Electron main/preload process and packaging config (new)
  - [frontend/index.html](/home/omv/.openclaw/workspace/projects/planner_redesign/frontend/index.html)
  - [frontend/src/js/services/apiService.js](/home/omv/.openclaw/workspace/projects/planner_redesign/frontend/src/js/services/apiService.js)
  - [backend/src/api/main.py](/home/omv/.openclaw/workspace/projects/planner_redesign/backend/src/api/main.py)
  - [backend/src/services/file_operations_service.py](/home/omv/.openclaw/workspace/projects/planner_redesign/backend/src/services/file_operations_service.py)
  - [backend/src/services/solver_service.py](/home/omv/.openclaw/workspace/projects/planner_redesign/backend/src/services/solver_service.py)
  - [backend/src/utils/file_handler.py](/home/omv/.openclaw/workspace/projects/planner_redesign/backend/src/utils/file_handler.py)
  - dependency manifests and build scripts

## Deep Review Findings Driving This Proposal
- There is no Electron code or Windows installer configuration in the repository today.
- The current Windows setup still depends on online installation via `pip install`, `npm install`, and CDN asset download during `install.bat`, so it is not an offline distribution path.
- `install.bat` currently performs environment discovery, `.venv` creation, `pip install`, `npm install`, CDN downloads into `frontend/deps`, and offline index generation; the desktop proposal must absorb each of those responsibilities into the build pipeline or packaged payload instead of preserving them as end-user steps.
- `start.bat` currently depends on PowerShell to launch `scripts/dev-start.ps1`; a packaged desktop app must not depend on PowerShell being present to start.
- The frontend currently loads browser assets from local `deps/` and `frontend/node_modules/`, which are development filesystem conventions and must be deliberately included or rebuilt for packaged delivery.
- `scripts/generate-offline-index.ps1` depends on a specific set of CDN and `node_modules` assets; those assets need an explicit packaged-bundle strategy rather than implicit dev-time filesystem assumptions.
- The frontend API layer hardcodes `http://localhost:8000/api`, so a packaged desktop app needs either a stable embedded backend port contract or a runtime-discovered backend endpoint.
- The backend CORS configuration only trusts `http://localhost` origins, which is incompatible with a `file://` or custom Electron protocol origin.
- Run artifacts default to `os.getcwd()/runs`, which is unsafe for a Windows app installed under `Program Files` because the install directory is not a writable runtime workspace.
- Cancellation checkpoints are currently written to `/tmp/solver_checkpoints`, which is Unix-centric and must be replaced with a Windows-safe writable app data location.
- `scripts/dev-start.ps1` currently owns backend health checks, automatic port fallback, `.run` state files, `.runlogs` logging, and optional restart-on-crash behavior; the packaged desktop runtime must take over those responsibilities internally.
- Python dependency manifests are not fully pinned, and there is no locked Python artifact set (wheelhouse, frozen executable, or equivalent), so reproducible offline packaging is not guaranteed.
- OR-Tools and Matplotlib introduce native/runtime packaging risk and require explicit validation in the frozen Python bundle.
- `matplotlib` is listed in `solver/requirements.txt`, but the current runtime code scan does not show it being imported in `solver/` or `backend/`; the desktop packaging work must verify whether it is truly needed and remove it from the bundled runtime if it is not.
