# Implementation Plan: Electron Offline Installer

## Scope
This plan converts the approved proposal into a concrete implementation sequence for a fully offline Windows desktop installer.

This is still pre-implementation planning. It fixes the major build and runtime decisions so coding can proceed without ambiguity.

## Fixed Decisions
### Desktop Packaging Stack
- Electron for the desktop shell
- `electron-builder` for Windows packaging
- `nsis` target for the primary installer
- Per-user install by default, avoiding administrator elevation unless machine-wide install is explicitly chosen later

### Bundled Runtime Strategy
- The shipped application includes:
  - Electron runtime
  - Renderer assets
  - A frozen Python backend executable
  - All Python runtime libraries required by the backend and solver
  - All local browser/runtime libraries required by the renderer
- End users do not run `install.bat`, `start.bat`, `pip`, `npm`, or PowerShell

### Python Packaging Strategy
- Use PyInstaller in one-folder mode for the backend bundle
- Freeze a backend launcher entrypoint that starts FastAPI/uvicorn from the packaged runtime
- Bundle the solver package inside the frozen backend payload
- Add explicit verification for:
  - OR-Tools native libraries
  - any retained Matplotlib data files
  - any hidden imports required by FastAPI/Pydantic/Uvicorn

### Version Targets
These are target implementation versions unless compatibility testing forces an adjustment:

- Python: `3.11.x`
- Node.js for build environment: `20.x LTS`
- Electron: pin a single major compatible with Node 20 build tooling
- `electron-builder`: pin exact version in `package.json`
- PyInstaller: pin exact version in Python lockfiles

The implementation must lock exact patch versions in build artifacts, not leave these as broad ranges.

### Runtime Path Layout
The packaged app will derive a writable per-user root from Electron and create these subdirectories:

- `logs/`
- `checkpoints/`
- `runs/`
- `state/`
- `temp/`

The backend will receive these paths through launch configuration. It must not infer writable locations from `os.getcwd()` or use `/tmp`.

### Backend Endpoint Contract
- Electron main process starts the bundled backend on loopback
- The backend uses a preferred loopback port, but Electron resolves conflicts if that port is unavailable
- Electron passes the resolved API base URL to the renderer through preload
- The renderer reads the backend URL from runtime configuration rather than hardcoding `http://localhost:8000`
- Electron launches the frozen backend by explicit packaged executable path from installed resources, not by resolving `python`, `py`, or any command through `PATH`

### Renderer Asset Strategy
The current app depends on:
- mirrored CDN files in `frontend/deps`
- direct module imports from `frontend/node_modules`

Implementation direction:
- Preserve a packaged local asset tree for first pass
- Keep import paths working by shipping the required runtime asset files deliberately
- Avoid introducing a large frontend bundler refactor during the initial packaging effort
- Resolve the packaged renderer asset root by explicit installed-resource path at startup rather than by relying on a source checkout working directory

This is the lowest-risk path because it preserves the current renderer structure. A later change can replace it with a formal bundling pipeline if desired.

### Sample Data Policy
- Ship a curated demo/sample dataset only if it materially improves offline onboarding
- Do not ship test baselines, test fixtures, or internal-only solver test assets

## Required New Artifacts
### Root / Desktop
- Electron app manifest and build config in root `package.json`
- Electron main process file
- Electron preload file
- Desktop build scripts

### Python Packaging
- `backend/requirements-lock.txt`
- `solver/requirements-lock.txt`
- PyInstaller spec file or equivalent deterministic configuration
- A packaging script that builds the frozen backend before the Electron installer

### Validation
- A packaging validation script that checks:
  - frozen backend executable exists
  - OR-Tools native files are present
  - required renderer assets are present
  - startup smoke test passes

## Dependency Lock Strategy
### Python
- Keep human-edited `requirements.txt` if useful for development
- Generate exact-version `requirements-lock.txt` files for packaging
- Lock transitive dependencies, not just direct dependencies
- The installer build uses only the lockfiles

### JavaScript / Electron
- Pin exact versions for Electron and packaging dependencies in `package.json`
- Commit the corresponding lockfile used by the project
- Ensure the packaging build does not use floating version ranges for shipped desktop dependencies

## Matplotlib Decision Gate
Current evidence indicates `matplotlib` may not be needed by the shipped runtime.

Before freezing the backend:
1. Confirm whether any shipped runtime path imports `matplotlib`
2. If no, remove it from the packaged dependency set
3. If yes, bundle only the required non-GUI runtime assets

The first implementation pass should avoid shipping unnecessary plotting backends.

## Build Host Requirements
These are build-machine requirements, not end-user requirements:

- Python `3.11.x`
- Node.js `20.x`
- Windows build environment compatible with PyInstaller and packaged native wheels
- Any Windows-native toolchain prerequisites only if a dependency cannot be satisfied by prebuilt wheels

The build documentation must clearly separate build-host prerequisites from customer runtime prerequisites.

## Phased Execution
### Phase 1: Lock and Freeze Python Runtime
- Create exact-version Python lockfiles
- Remove or justify `matplotlib`
- Add PyInstaller configuration
- Produce a frozen backend executable locally
- Verify backend can start standalone from the frozen output

### Phase 2: Add Electron Shell
- Add Electron main/preload process
- Launch the frozen backend as a child process
- Launch the frozen backend via explicit packaged executable path and controlled child-process environment
- Pass writable paths and backend endpoint into the renderer
- Open the renderer window directly
- Validate backend health before marking the app ready

### Phase 3: Package Renderer Assets
- Assemble `frontend/deps` runtime assets in the packaged output
- Include the exact CodeMirror/Lezer runtime files needed by the current import paths
- Remove any packaged renderer dependency on a source checkout layout that is not intentionally reproduced
- Verify packaged renderer asset resolution works even when system `PATH`, `PYTHONPATH`, or `NODE_PATH` contain conflicting values

### Phase 4: Installer Assembly
- Configure `electron-builder`
- Package the frozen backend as extra resources
- Produce an `nsis` installer
- Ensure the installed app creates standard desktop entrypoints

### Phase 5: Offline Validation
- Test on a clean Windows machine or clean VM
- Confirm:
  - no system Python installed
  - no system Node.js or npm installed
  - no internet connectivity
  - installer completes
  - app launches
  - backend becomes healthy
  - solver run completes
  - outputs are written under the per-user writable root

## First Coding Pass Priorities
When implementation starts, the first code changes should be:

1. Add Python lockfiles and choose/remove `matplotlib`
2. Make backend runtime paths configurable
3. Replace hardcoded frontend API URL with runtime injection
4. Add PyInstaller build for backend
5. Add Electron main/preload startup shell

This order removes the highest-risk unknowns first.

## Definition of Ready for Implementation
Implementation should begin only when these are accepted:

- PyInstaller is the chosen freezing tool
- Python `3.11.x` is accepted as the bundle target
- Node `20.x` is accepted as the build target
- Per-user install is accepted as the default
- The first-pass renderer strategy is to preserve a packaged local asset tree rather than rewrite the frontend build system

If any of those decisions change, this plan should be updated before coding begins.
