# Frontend Offline Distribution Plan (Simple Installer Approach)

> Goal: ship a source-based package users can install once online, then run fully offline on Windows/Linux using `install.sh` / `install.bat` and `start.sh` / `start.bat`.

## Review Of Previous Plan

The previous version was over-scoped and drifted from the real repository state.

Key issues identified:
- It mixed three packaging strategies (Tauri, Docker, portable web) into one track, which delayed delivery.
- `install.sh` content had been replaced by markdown text, so Linux/macOS install was not executable.
- Offline HTML generation used a hand-written template that dropped the import map and could break CodeMirror.
- Script output and docs were inconsistent on ports, startup commands, and expected files.

## Updated Distribution Strategy

Use one practical path first:
- Install runtime dependencies locally (`.venv`, `frontend/node_modules`, `frontend/deps`).
- Convert `frontend/index.html` to offline mode by rewriting CDN/import-map URLs to local paths.
- Keep `frontend/index-online.html` as a backup source of truth.
- Start frontend/backend with existing `start.sh` / `start.bat`.

This keeps maintenance low and does not require native packaging toolchains.

## Installer Contract

### `install.sh` / `install.bat` must:
1. Validate prerequisites (`python`, `node`, `npm`, plus `curl` on Unix; use `python -m pip` for installs).
2. Create/activate `.venv`.
3. Install backend + solver Python requirements.
4. Ensure `frontend/package.json` exists and install Node dependencies.
5. Download non-module browser assets to `frontend/deps/`:
   - `htmx.min.js`
   - `alpinejs.min.js`
   - `d3.v7.min.js`
   - `papaparse.min.js`
   - `jszip.min.js`
   - `tailwindcss.js`
   - `daisyui.css`
6. Build offline `frontend/index.html` from `frontend/index-online.html` by deterministic URL replacement:
   - CDN JS/CSS -> `./deps/*`
   - `esm.sh` import-map entries -> `./node_modules/*`

### Invariants after install
- `frontend/index-online.html` exists and remains online-source baseline.
- `frontend/index.html` is offline-capable.
- `frontend/node_modules` includes CodeMirror/Lezer dependencies used by import map.
- App can start without internet.

## Implementation Notes

### Why rewrite from `index-online.html` instead of templating
- Preserves future structural changes to `frontend/index.html`.
- Avoids accidental omission of scripts/components.
- Keeps offline transformation explicit and auditable.

### Why import map points to `node_modules`
- CodeMirror stack is ES module based.
- Using installed packages avoids brittle CDN/module bundling steps.
- Keeps offline runtime compatible with current `editor-setup.js` imports.

## Verification Checklist

Run after installer changes:

```bash
# Linux/macOS
bash -n install.sh
./install.sh
./start.sh
```

```bat
:: Windows
install.bat
start.bat
```

Manual checks in browser:
- Open app at frontend URL and verify tabs load.
- Open config editor and verify CodeMirror initializes.
- Disable network and hard-refresh:
  - No CDN fetches should appear in devtools network panel.
  - App still loads with local `deps` + `node_modules` resources.

## Troubleshooting

### `npm install` fails on restricted network
- Install on a connected machine first.
- Ship package including `frontend/node_modules`.

### CodeMirror import errors
- Confirm `frontend/index.html` import map points to existing `./node_modules/...` files.
- Re-run installer to regenerate offline index.

### Want to restore online mode
- Copy `frontend/index-online.html` over `frontend/index.html`.

## Future Enhancements (Optional)

After this simple path is stable, optional next steps:
1. Add a lockfile policy + CI check for deterministic frontend dependency versions.
2. Add script test harnesses for `install.sh`/`install.bat` in CI containers/VMs.
3. Add optional native packaging (Tauri/PyInstaller) as a separate document and workflow, not mixed into base installer path.
