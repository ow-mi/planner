## Context
The repository is currently organized as a static frontend, a FastAPI backend, and a Python solver. The supported Windows workflow is a development launcher model:

- `install.bat` expects system Python, Node.js, and npm.
- `install.bat` installs Python dependencies from `backend/requirements.txt` and `solver/requirements.txt`.
- `install.bat` installs frontend dependencies and downloads browser assets for offline use.
- `start.bat` launches a static file server plus `uvicorn`.
- `start.bat` depends on PowerShell and delegates real startup behavior to `scripts/dev-start.ps1`.
- `scripts/dev-start.ps1` performs preflight checks, selects a Python interpreter, ensures `uvicorn` exists, chooses ports, starts services, waits for health, writes `.run/state.json`, and manages `.runlogs`.

That workflow is not an installable offline desktop product. The request is broader than "add Electron chrome around the frontend"; it requires a sealed runtime that includes:

- Electron runtime
- Embedded Node runtime provided by Electron
- Frontend assets
- Backend service
- Solver code
- Python interpreter
- Python libraries, including native dependencies
- A Windows installer that places everything correctly and works offline

## Goals
- Deliver a single Windows installer that installs a runnable desktop app with no system Python or Node prerequisite.
- Eliminate any runtime dependency on `install.bat`, `start.bat`, PowerShell, `pip`, `npm`, or CDN downloads for installed users.
- Preserve the current architecture boundary where the frontend talks to the backend API, instead of rewriting the backend into Node.
- Make runtime file writes safe on Windows by separating installed resources from mutable user data.
- Ensure the packaged app can launch and execute solver runs while fully offline.
- Add objective validation so missing runtime files are caught during build, not after shipment.
- Make offline builds reproducible by using exact-version dependency locks for both runtime and build-time tooling.

## Non-Goals
- Replacing the FastAPI backend with a Node-native implementation.
- Re-architecting the solver itself.
- Supporting macOS/Linux desktop packaging in this change.
- Building an auto-update channel.

## Current Gaps
### Packaging and Runtime
- No Electron main process, preload bridge, or packaging configuration exists.
- No installer definition exists.
- No bundled Python interpreter exists.
- No packaged replacement exists for the startup supervision currently handled by `start.bat` + `scripts/dev-start.ps1`.

### Frontend
- The frontend imports CodeMirror modules directly from `frontend/node_modules`.
- The frontend loads offline browser libraries from `frontend/deps`.
- The frontend hardcodes `http://localhost:8000/api` in the API service.

These are workable during development but fragile in packaged delivery unless the build explicitly assembles the renderer runtime layout.

### Backend
- CORS only allows `http://localhost` browser origins.
- File output defaults to `os.getcwd()/runs`.
- Temporary workspaces are OS-managed and fine, but checkpoint storage uses `/tmp/solver_checkpoints`, which is not portable.

### Operational Behavior Now Owned by Scripts
- `install.bat` currently installs and assembles the runtime on the target machine.
- `start.bat` and `scripts/dev-start.ps1` currently supervise service startup, health checks, port selection, and logging.

For the packaged desktop app, these are required operational behaviors that must be reimplemented inside the packaged product or the build pipeline.

### Dependency Reproducibility
- `backend/requirements.txt` and `solver/requirements.txt` are not version-pinned.
- There is no locked Python artifact set for offline builds.
- Native Python packages (especially OR-Tools, and likely parts of Matplotlib) need explicit inclusion checks.

### Build Toolchain Disclosure
- The current proposal did not yet require explicit version-pinning for the packaging toolchain itself.
- For a reliable offline Windows deliverable, the build must declare exact versions for:
  - bundled Python runtime
  - Electron
  - `electron-builder`
  - PyInstaller
  - supporting dependency lock tooling
- Some native Python dependencies may rely on Windows build prerequisites if compatible wheels are unavailable during release engineering. Those are build-host concerns and must be documented as such, not deferred to end users.

## Proposed Architecture
### 1. Keep the Existing Split Architecture
Use Electron as a desktop shell and process supervisor, not as a replacement backend. The app will consist of:

- Electron main process
- Electron renderer (current frontend, adapted for packaged runtime)
- A packaged Python backend executable started as a child process by Electron

The Electron main process becomes the packaged replacement for the responsibilities currently split across `start.bat` and `scripts/dev-start.ps1`.

This is the least disruptive path because it preserves the existing frontend-to-API contract and the Python solver implementation.

### 2. Package the Python Backend as a Frozen Executable
Freeze the backend and solver into a distributable Windows-friendly Python runtime artifact using PyInstaller, preferably as a one-folder packaged executable rather than relying on a `.venv` inside the installed app.

Rationale:
- The current install flow requires internet access and system Python.
- A frozen backend avoids shipping a mutable virtualenv under the installation directory.
- Native library inclusion can be audited during packaging.

PyInstaller is preferred here because the work specifically needs a concrete packaging path for Python plus native dependency verification. If implementation later proves PyInstaller unsuitable, changing tools should require updating this design.

### 3. Use Electron Builder for the Windows Installer
Use `electron-builder` with an `nsis` target by default.

Rationale:
- It is the common Electron path for self-contained Windows installers.
- It supports bundling extra resources (frozen backend runtime, static assets, sample data if retained).
- It supports post-build validation hooks.

Electron already carries the application's runtime Node environment, so the installer does not need to ask the user to install Node.js or npm separately.

If organizational requirements later demand MSI specifically, the packaging layer can be swapped without changing the desktop runtime contract.

### 4. Separate Installed Resources from Writable App Data
Adopt two runtime roots:

- Install/resource root: frontend assets, backend executable, immutable bundled resources
- User data root: logs, run artifacts, checkpoints, temp exports, state snapshots

On Windows, mutable files must not default to the application install directory. The effective writable root should be derived from Electron's per-user application data path and passed into the backend at launch time.

Recommended subpaths under the writable root:

- `logs/`
- `checkpoints/`
- `runs/`
- `state/`
- `temp/`

These do not need to be hardcoded to a specific `%APPDATA%` or `%LOCALAPPDATA%` string in the spec, but the implementation must map them to a Windows-safe per-user location.

### 5. Make the Renderer Discover the Backend at Runtime
The frontend must stop hardcoding `http://localhost:8000/api`.

Preferred contract:
- Electron starts the backend on a deterministic loopback port or an ephemeral port it selects.
- Electron exposes the resolved API base URL to the renderer via preload.
- The renderer reads that runtime configuration instead of embedding a compile-time localhost constant.

This avoids brittle port assumptions and allows startup retries or fallback ports without breaking the UI.

This also absorbs the existing port-selection behavior from `scripts/dev-start.ps1` into the packaged desktop shell.

### 6. Handle Electron Origin Compatibility
The backend must explicitly support the Electron origin model:

- If loading via `file://`, CORS must allow a null/file origin pattern compatible with the chosen request strategy.
- If using a custom app protocol, that protocol must be allowed.
- An alternative is to serve the renderer over a loopback HTTP endpoint instead of `file://`, but that increases moving parts.

The implementation should choose one model and standardize it; the spec requires the backend and renderer to be compatible in packaged mode.

### 7. Add Build-Time Offline Verification
The distribution pipeline must verify that all required runtime dependencies are physically present in the installer payload, including:

- Frontend HTML, JS, CSS, and local library assets
- Packaged backend executable
- Python runtime resources needed by the backend
- Native OR-Tools libraries
- Any Matplotlib data files required by runtime code paths

This replaces the current end-user `install.bat` behavior of:
- creating `.venv`
- running `pip install`
- running `npm install`
- downloading CDN-hosted browser assets into `frontend/deps`
- generating the offline frontend index

All of those steps must happen before shipping, not during customer installation.

This must be validated before the installer is considered releasable.

### 8. Bundle Renderer Assets Deliberately
The current browser/offline story depends on two asset classes:

- CDN-downloaded browser libraries currently mirrored into `frontend/deps`
- CodeMirror/Lezer and related packages currently loaded directly from `frontend/node_modules`

The packaged app must choose and document one deliberate strategy:

- either preserve a packaged runtime asset tree that satisfies these imports exactly
- or replace that layout with a renderer build step that emits an equivalent bundled asset set

The important requirement is that packaged startup does not depend on a development checkout structure.

### 9. Replace Script-Level Startup Guarantees in the Desktop Shell
The packaged application must provide the startup guarantees currently implemented by `start.bat` and `scripts/dev-start.ps1`:

- direct launch from the installed executable, with no PowerShell requirement
- backend child-process spawn and lifecycle management
- backend health check before exposing the UI as ready
- deterministic or discoverable endpoint wiring into the renderer
- log file creation in the writable user data directory
- failure reporting when backend startup or health checks fail
- cleanup of child processes on startup failure or app exit

`RestartOnCrash` can be reinterpreted as internal child-process supervision, but the essential requirement is that the installed app does not silently half-start.

The desktop shell should also define:

- how it resolves backend port conflicts
- whether it retries backend launch after a crash during startup
- how long it waits for graceful backend shutdown
- how logs are rotated or trimmed over time

These replace operational behavior that is currently only implicit in the development scripts.

The desktop shell must also use a deterministic packaged path strategy:

- resolve the frozen backend executable from the installed application resources using an explicit path
- resolve renderer asset roots from the installed application resources using an explicit path
- avoid relying on ambient `PATH`, `PYTHONPATH`, or `NODE_PATH` discovery for bundled runtimes
- when spawning child processes, pass only the environment overrides needed for the packaged runtime instead of inheriting fragile development assumptions

### 10. Bundle Configuration and Demo Assets Explicitly
The runtime should include all configuration assets required by the shipped experience.

Based on the current codebase, that includes at minimum:

- the packaged frontend asset set
- the frozen backend runtime
- any shipped solver-side config assets that the packaged workflow actually references

There should also be an explicit product decision on `sample_data/`:

- include curated demo/sample data if onboarding benefits from it
- exclude test-only artifacts and internal test baselines from the installer payload

The present repository mixes examples, tests, and sample data; the installer should not blindly include all of them.

### 11. Matplotlib Verification
`matplotlib` is currently declared in `solver/requirements.txt`, but a direct runtime code scan does not show imports in the active `solver/` or `backend/` runtime code paths.

That creates two acceptable outcomes:

- remove `matplotlib` from the packaged runtime if it is not required
- or, if it is required by intended but currently indirect paths, explicitly bundle its non-GUI runtime assets and verify them during packaging

The goal is to avoid shipping unnecessary heavy dependencies while still guaranteeing offline completeness.

### 12. Windows Installer Behavior
To reduce friction and avoid false dependency assumptions, the installer should prefer a per-user installation mode that does not require administrator elevation by default unless a machine-wide install is intentionally selected.

The installer should also create a normal desktop application entrypoint (for example Start Menu shortcut) so end users do not interact with `.bat` launchers.

Code-signing and SmartScreen reputation are real release concerns, but they are release-hardening concerns rather than core offline-runtime dependency requirements for this change.

## Tradeoffs
### Frozen Python Executable vs Shipping an Embedded `.venv`
Frozen executable advantages:
- Cleaner install footprint
- No reliance on activation scripts
- Easier to launch from Electron

Embedded `.venv` advantages:
- Simpler conceptual mapping from current dev setup

Decision:
- Prefer a frozen executable because the requirement is a robust offline installer, not a transplanted development environment.

### `file://` Renderer vs Local HTTP Renderer
`file://` advantages:
- Fewer moving parts
- Natural fit for packaged assets

`file://` risks:
- CORS/origin edge cases
- Some libraries behave differently with file-origin fetches

Local HTTP advantages:
- Closer to the current browser-served model
- More predictable relative URL behavior

Decision:
- Leave the exact renderer transport open during implementation, but require a single documented contract with matching backend origin support and packaged asset verification.

## Required Implementation Notes
- All runtime filesystem writes must become configurable and flow from a single application data root.
- The backend must accept configuration for:
  - writable data root
  - checkpoint directory
  - temp/export root if distinct
  - allowed desktop origin(s)
  - selected listen port or socket contract
- The Electron main process must launch the bundled backend by explicit packaged executable path, not by command-name lookup on `PATH`.
- If child-process environment overrides are needed, they must be set deliberately and minimally so the packaged app prefers its bundled runtime assets over any conflicting system environment settings.
- The frontend must not rely on `frontend/node_modules` existing as an unpacked development tree unless the packaging process intentionally reproduces that layout.
- The packaging pipeline must fail loudly if required runtime assets are absent.

## Validation Strategy
- Smoke test on a packaged build:
  - installed executable starts directly
  - no PowerShell bootstrap is required
  - Electron process starts
  - backend child process starts
  - health endpoint succeeds
  - renderer can make API calls
- Functional offline test on a packaged build:
  - import bundled sample data or local user-selected data
  - run solver
  - verify output files are produced under the per-user writable directory
- Negative test:
  - run the packaged app with network disabled and confirm no startup/install-time dependency fetch occurs
  - run on a machine without system Python, Node.js, or npm and confirm the app still installs and launches
  - validate that the packaged backend can start with only its bundled runtime and bundled native libraries
