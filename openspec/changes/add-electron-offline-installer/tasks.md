## 1. Packaging Foundation
- [x] 1.1 Add Electron application scaffolding (main process, preload, renderer bootstrap) and choose a Windows installer target (`nsis` via `electron-builder` unless a stricter MSI requirement emerges).
- [x] 1.2 Define the desktop runtime layout: immutable packaged assets vs per-user writable data directories for logs, runs, temp workspaces, checkpoints, and exported files.
- [x] 1.3 Add build orchestration that produces a distributable Electron app plus a packaged Python backend runtime in a single repeatable command, replacing all end-user responsibilities currently handled by `install.bat`.
- [ ] 1.4 Explicitly retire the end-user dependency on `install.bat`, `start.bat`, and PowerShell for packaged desktop usage, while preserving any dev-only scripts for source checkouts.
- [x] 1.5 Add exact-version dependency lockfiles for backend and solver Python dependencies (for example `backend/requirements-lock.txt` and `solver/requirements-lock.txt`) plus version-pinned Electron/Node build inputs.
- [x] 1.6 Document and pin the build toolchain used to create the installer, including Python version, Electron version, `electron-builder`, PyInstaller, and any required Windows-native build prerequisites.

## 2. Backend Runtime Hardening
- [x] 2.1 Remove assumptions that runtime state can be written under the current working directory; route all runtime writes through a configurable application data root.
- [x] 2.2 Replace Unix-specific temporary/checkpoint paths with cross-platform paths derived from the packaged app runtime configuration.
- [x] 2.3 Add backend startup configuration suitable for a packaged desktop environment, including origin handling for Electron and deterministic backend port selection or transport discovery.
- [x] 2.4 Preserve the operational guarantees currently provided by `scripts/dev-start.ps1`: backend health checks, startup failure detection, logging, and restart/cleanup behavior managed by the desktop shell.
- [x] 2.5 Define explicit runtime subpaths under the user data root for logs, checkpoints, temp workspaces, run outputs, and persisted state, and pass them into the bundled backend at launch.
- [x] 2.6 Define backend supervision behavior for packaged mode: port conflict handling, restart policy, shutdown timeout, and log retention/cleanup.
- [x] 2.7 Launch the bundled backend by explicit packaged executable path and use only the minimal child-process environment overrides needed so conflicting system `PATH`, `PYTHONPATH`, or `NODE_PATH` values cannot redirect runtime resolution.

## 3. Frontend Desktop Integration
- [x] 3.1 Replace hardcoded backend URLs with runtime-configured endpoints exposed through Electron.
- [x] 3.2 Ensure all frontend dependencies needed at runtime are bundled as packaged assets and do not rely on dev-only `node_modules` layout assumptions.
- [x] 3.3 Add desktop-native file and folder selection flows where the browser-only experience is insufficient or brittle in a packaged app.
- [x] 3.4 Replace the browser-open workflow currently announced by `start.bat` with direct desktop window launch and renderer startup validation.
- [x] 3.5 Define the packaged bundling strategy for the current CDN-backed browser assets and CodeMirror/Lezer module tree so renderer startup does not depend on dev-time `deps/` or `node_modules` conventions.
- [x] 3.6 Resolve the renderer asset root from packaged installed resources at startup and verify it does not depend on the process working directory or source checkout layout.

## 4. Offline Distribution Guarantees
- [ ] 4.1 Package a Python runtime plus all backend and solver dependencies, including native extensions and solver libraries, with no dependency on system Python.
- [ ] 4.2 Package the Electron runtime (and thus the runtime Node environment) so the installed app has no dependency on system Node.js, npm, or PowerShell.
- [x] 4.3 Lock and verify Node/Electron and Python dependency inputs so installer builds are reproducible.
- [x] 4.4 Add an offline readiness manifest or equivalent build-time verification that confirms required frontend assets, Python modules, native libraries, and generated offline resources are present in the installer payload.
- [x] 4.5 Verify whether `matplotlib` is actually required by the shipped runtime; if not, remove it from the packaged dependency set, and if it is required, explicitly bundle its runtime data files without relying on GUI backends.
- [x] 4.6 Define and bundle the runtime configuration assets required by the shipped app, and make an explicit decision on whether example/demo datasets from `sample_data/` are included while excluding test-only fixtures from the installer.

## 5. Validation
- [ ] 5.1 Add automated smoke tests for packaged startup: the installed executable launches directly, Electron starts, backend becomes healthy, and the UI can reach the API.
- [ ] 5.2 Add an offline functional test: import sample data, run the solver, and verify output artifacts are generated without network access.
- [ ] 5.3 Add a no-external-dependency validation on a clean Windows machine: no system Python, no system Node.js, no npm, and no network access.
- [x] 5.4 Document the packaging and release workflow, including how to build and validate the Windows installer in CI and on a clean Windows machine.
- [x] 5.5 Validate the frozen backend payload for native dependency completeness, including OR-Tools binaries and any retained plotting/reporting assets.
