# Planner Redesign

Web-based planning tool with a static frontend, FastAPI backend, and Python solver.

## What This Repo Contains

- `frontend/`: browser UI (served as static files)
- `backend/`: FastAPI API and orchestration services
- `solver/`: optimization and reporting pipeline
- `sample_data/`: example input data
- `docs/`: setup and workflow docs

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
