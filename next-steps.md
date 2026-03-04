# Next Steps

## Immediate Windows Work

1. Install the required build tools on the Windows machine:
   - Python 3.11.x
   - Node.js 20.x
   - project root npm dependencies (`npm install` in the repo root)
   - frontend runtime dependencies (`npm --prefix frontend ci --omit=dev` if needed)

2. Run the first real Windows desktop build:
   - `npm run build:desktop`

3. If the build fails during PyInstaller:
   - inspect missing hidden imports
   - inspect missing native binaries, especially OR-Tools artifacts
   - update `pyinstaller/backend.spec` and rerun

4. If the build fails during `electron-builder`:
   - inspect missing packaged resources
   - confirm `dist/backend` exists
   - confirm required `frontend/deps` and `frontend/node_modules` runtime files exist
   - rerun `npm run verify:desktop-package`

## Windows Validation

5. Validate on a clean Windows machine or VM with:
   - no system Python
   - no system Node.js or npm
   - no internet connection

6. Install the generated NSIS installer and verify:
   - the app launches from the installed entrypoint
   - no `.bat` files are needed by the end user
   - the Electron window opens correctly
   - the backend starts and becomes healthy
   - the frontend can call the API

7. Test folder import and solver execution:
   - use the new desktop folder picker
   - import a valid input folder
   - run a solver job
   - verify logs, checkpoints, and run outputs are written under the per-user app data directory

8. Confirm offline behavior:
   - no downloads at startup
   - no dependency on `PATH`, `PYTHONPATH`, or `NODE_PATH`
   - no dependency on system Python, Node.js, npm, or PowerShell

## Likely Follow-Up Fixes

9. If the packaged backend fails to start:
   - check the backend log under the app data `logs` directory
   - confirm the frozen executable path is correct
   - confirm the allowed-origin settings are correct for packaged mode

10. If runtime assets fail in the renderer:
   - verify the packaged asset tree includes the required `frontend/deps` files
   - verify the packaged asset tree includes the required CodeMirror/Lezer module files
   - confirm relative paths still match the current `frontend/index.html` import structure

11. If Windows validation succeeds:
   - add automated packaged smoke tests
   - add an offline functional test path
   - consider removing the legacy `.bat` installer/startup path from the packaged-user workflow entirely
