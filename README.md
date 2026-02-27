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
