# Desktop Build

This repository now includes a first-pass Electron desktop packaging flow for the offline Windows installer.

## Build Host

The release build is intended to run on Windows.

Reason:
- the backend is frozen with PyInstaller
- the PyInstaller output is host-native
- the final Windows installer must bundle a Windows backend executable

Cross-building from Linux can still be useful for experimentation, but it is not the default release path for this implementation.

## Prerequisites

Build-machine requirements:

- Python 3.11.x
- Node.js 20.x
- Root dependencies installed from the root `package.json`
- Frontend lockfile present (`frontend/package-lock.json`)

Runtime requirements for end users:

- none beyond the installed application

## Commands

Build the packaged backend only:

```bash
npm run package:backend
```

Run the desktop package verifier:

```bash
npm run verify:desktop-package
```

Build the Windows desktop installer:

```bash
npm run build:desktop
```

On non-Windows hosts, `build:desktop` exits by default because the bundled backend would not be a Windows executable. To force a cross-build experiment:

```bash
PLANNER_ALLOW_CROSS_BUILD=1 npm run build:desktop
```

That override is for experimentation only, not the primary release workflow.

## CI / Release Usage

For release automation:

- run the same `npm run build:desktop` flow on a Windows CI runner
- archive the generated installer artifact
- perform final manual validation on a clean Windows machine or VM before distribution

Do not treat a non-Windows cross-build as the primary release artifact for this implementation unless the frozen backend output has been explicitly proven equivalent.

## What The Build Does

1. Installs frontend runtime dependencies from `frontend/package-lock.json`
2. Builds the frozen backend with PyInstaller
3. Verifies required backend and frontend runtime assets exist
4. Builds the Electron NSIS installer with `electron-builder`

## Bundled Demo Assets

The current first-pass installer configuration bundles a small curated sample set:

- `sample_data/sample_data.csv`
- `sample_data/planner_configuration.json`

This is intentionally narrower than bundling the full repository `sample_data/` tree, and it excludes test fixtures and solver test baselines.

## Windows Validation

Final validation should be done on a clean Windows machine or VM:

- no system Python
- no system Node.js or npm
- no internet connection

Validate:

- installer launches and completes
- app starts directly from its installed entrypoint
- backend becomes healthy
- frontend can call the API
- solver runs complete
- logs and run artifacts are written under the per-user app data location
