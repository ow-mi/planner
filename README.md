# Planner Redesign

Web-based planning tool with a static frontend, FastAPI backend, and Python solver.

## What This Repo Contains

| Directory | Description |
|-----------|-------------|
| `frontend/` | Browser UI (Alpine.js, D3.js, served as static files) |
| `backend/` | FastAPI REST API and orchestration services |
| `solver/` | CP-SAT optimization engine and reporting pipeline |
| `sample_data/` | Example input datasets |
| `docs/` | Comprehensive architecture and API documentation |
| `input_data/` | User data storage |
| `runs/` | Solver execution outputs |

## Quick Start

### 1. Install dependencies

Linux/Mac:

```bash
./install.sh
```

Windows:

```cmd
install.bat
```

### 2. Start frontend + backend

Linux/Mac:

```bash
./start.sh
```

Windows:

```cmd
start.bat
```

Defaults:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`

Stop services:

- Linux/Mac: `./stop.sh`
- Windows: `stop.bat`

---

## Windows Quick Start (Reliable Launcher)

This section covers Windows-specific reliability features for the startup system.

### Installation

```cmd
install.bat
```

This script:
- Creates a Python virtual environment (`.venv/`)
- Installs Python dependencies from `backend/requirements.txt` and `solver/requirements.txt`
- Installs Node.js dependencies for the frontend
- Downloads browser dependencies (Alpine.js, D3.js, htmx, etc.) for offline use
- Generates the offline-ready `frontend/index.html`

**Installation log:** `.runlogs\install.log`

### Starting Services

```cmd
start.bat
```

**What happens:**
1. Runs preflight checks (execution policy, path length, cloud sync detection)
2. Detects Python installations and selects the best candidate
3. Finds available ports if defaults (3000, 8000) are in use
4. Launches frontend and backend as background processes
5. Validates services are healthy before exiting

**Available flags:**

| Flag | Description |
|------|-------------|
| `-FrontendPort 3000` | Custom frontend port (default: 3000) |
| `-BackendPort 8000` | Custom backend port (default: 8000) |
| `-Headless` | Run without opening browser (not yet implemented) |
| `-NoInstall` | Skip automatic dependency installation |
| `-RestartOnCrash` | Auto-restart services if they crash during startup window |

**Example with custom ports:**

```cmd
REM PowerShell-style flags passed through start.bat
start.bat -FrontendPort 8080 -BackendPort 8888
```

**Example with crash recovery:**

```cmd
start.bat -RestartOnCrash
```

> **Note:** `-RestartOnCrash` is **off by default**. When enabled, the launcher monitors services for 25-30 seconds and attempts up to 2 restarts with exponential backoff if a crash is detected.

### Stopping Services

```cmd
stop.bat
```

This script:
- Reads process IDs from `.run\state.json`
- Terminates frontend and backend process trees
- Falls back to port-based termination if state file is missing

### Diagnostics

```cmd
diagnose.bat
```

Comprehensive environment check that verifies:

- **PowerShell version** (5.1+ required)
- **Operating system** and architecture
- **Execution policy** (scripts must be runnable)
- **Long path support** (Windows 260-char limit check)
- **Cloud sync detection** (OneDrive, Dropbox, etc. — warns about performance risks)
- **Proxy configuration** (may affect npm/pip/git)
- **Firewall and port reachability** (checks if ports 3000/8000 are accessible)
- **Windows Defender status** (suggests exclusions for faster dev)
- **Python detection** (venv, py launcher, python, python3, common paths)
- **Node.js/npm** availability
- **Port availability** (checks if 3000/8000 are in use)
- **Directory structure** (backend/, frontend/, .venv/, frontend/deps/)
- **Python packages** (uvicorn, fastapi, pandas, pydantic)

Run this if `start.bat` fails or before reporting issues.

### Log Files

All logs are stored in the `.runlogs/` directory:

| Log File | Contents |
|----------|----------|
| `install.log` | Installation progress and errors |
| `startup.log` | Main startup sequence, port resolution, process launches |
| `start-bootstrap.log` | Bootstrap wrapper output |
| `frontend.log` | Frontend (Python http.server) stdout/stderr |
| `backend.log` | Backend (uvicorn) stdout/stderr |

**Viewing logs:**

```cmd
type .runlogs\startup.log
type .runlogs\backend.log
type .runlogs\frontend.log
```

### Port Conflict Handling

If default ports (3000/8000) are in use, the launcher **automatically finds the next available port**:

1. Checks if requested port is available
2. If in use, increments and tries next port
3. Continues until a free port is found (max 200 attempts)
4. Resolved ports are recorded in `.run\state.json`

**Example output when ports are in use:**

```
[WARN] Frontend requested port 3000 is unavailable; using fallback port 3001.
[WARN] Backend requested port 8000 is unavailable; using fallback port 8001.
```

**Resolved ports are saved to:** `.run\state.json`

```json
{
  "frontend_port": 3001,
  "backend_port": 8001,
  "frontend_pid": 12345,
  "backend_pid": 12346
}
```

### Single-Orchestrator Launcher

The Windows launcher uses a **single-window design**:

- **No extra PowerShell windows** spawned for each service
- Services run as background processes with output redirected to log files
- CMD wrapper uses `CreateNoWindow=true` for clean operation
- All output consolidated in `.runlogs/`

This means you won't see separate windows for frontend/backend — check the log files for output.

### Troubleshooting

**Startup fails immediately:**

1. Run `diagnose.bat` to check environment
2. Check `.runlogs\startup.log` for error details
3. Check `.runlogs\backend.log` for dependency errors

**"Python not found":**

- Ensure Python 3.8+ is installed
- Check if `py` launcher is available (`py --version`)
- Add Python to PATH or reinstall from https://python.org

**"Execution policy is Restricted":**

```cmd
powershell -ExecutionPolicy Bypass -File start.bat
```

Or permanently fix:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

**Port already in use:**

- Let the launcher auto-resolve (it finds the next available port)
- Or specify custom ports: `start.bat -FrontendPort 8080 -BackendPort 8888`
- Check what's using the port: `netstat -ano | findstr :3000`

**Services crash on startup:**

1. Check `.runlogs\frontend.log` and `.runlogs\backend.log`
2. Run `diagnose.bat` to check dependencies
3. Try with crash recovery: `start.bat -RestartOnCrash`

**Virtual environment issues:**

- Delete `.venv/` folder and re-run `install.bat`
- Ensure no other virtual environment is active in your shell

**Cloud-synced folder warnings:**

If your project is in OneDrive/Dropbox/Google Drive:

- Move to a non-synced location (e.g., `C:\dev\planner_redesign`)
- Or exclude `.venv/`, `node_modules/`, `.run/`, `.runlogs/` from sync

**Long path errors:**

- Enable Windows long path support (requires admin):
  ```
  fsutil behavior set disablepathcachelength 0
  ```
- Or move project to a shorter path

---

## Documentation

Comprehensive documentation is available in the `docs/` directory:

| Document | Description |
|----------|-------------|
| [1. Project Overview](docs/1.%20Project%20Overview.md) | Technology stack, core features, architecture summary |
| [2. Architecture Overview](docs/2.%20Architecture%20Overview.md) | C4 model diagrams, design patterns, key decisions |
| [3. Workflow Overview](docs/3.%20Workflow%20Overview.md) | User workflows, data flow, state management |

### Deep Dive Guides

| Guide | Description |
|-------|-------------|
| [Frontend Architecture](docs/4.%20Deep%20Dive/Frontend%20Architecture.md) | Alpine.js components, stores, services, testing |
| [Backend Architecture](docs/4.%20Deep%20Dive/Backend%20Architecture.md) | FastAPI routes, SSE streaming, dependency injection |
| [Solver Architecture](docs/4.%20Deep%20Dive/Solver%20Architecture.md) | CP-SAT model, pipeline stages, optimization |
| [Configuration & Priority Modes](docs/4.%20Deep%20Dive/Configuration%20%26%20Priority%20Modes.md) | Priority modes, constraints, YAML/JSON config |

### Technology Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | JavaScript ES6+, Alpine.js 3.x, D3.js v7, CodeMirror 6, Tailwind CSS |
| **Backend** | FastAPI, Python 3.8+, Pydantic, Uvicorn |
| **Solver** | Google OR-Tools (CP-SAT), pandas, matplotlib |
| **Build** | Vite, Jest, pytest, Playwright |
| **Tracking** | beads_rust (`br`/`bd`) |

## Running Tests

Frontend tests:

```bash
npm test
```

Backend tests:

```bash
cd backend && python -m pytest
```

Solver tests:

```bash
cd solver && python -m pytest
```

## Notes

- `frontend/index.html` is the offline-ready entrypoint.
- `frontend/index-online.html` is kept as the online baseline used by installer rewrites.
