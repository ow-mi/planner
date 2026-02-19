# Planning Test Program

HTMX + Alpine.js + DaisyUI frontend for test planning.

## Quick Start (Recommended)

Run both frontend and backend with a single command:

### Linux/Mac
```bash
./start.sh              # Default: Frontend on 3000, Backend on 8000
./start.sh 3000 8000    # Custom ports

# To stop:
./stop.sh
```

### Windows
```cmd
start.bat               # Default: Frontend on 3000, Backend on 8000
start.bat 3000 8000     # Custom ports

# To stop:
stop.bat
```

Then open:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## Manual Start

If you prefer to start services individually:

```bash
# Frontend only
./start.sh frontend-only
# Or
cd frontend && python -m http.server 3000

# Backend only
./start.sh backend-only
# Or
cd backend && python -m uvicorn src.api.main:app --reload
```

### Legacy (without backend)
```bash
# Serve the frontend only (using Python)
npm run serve

# Or using Node
npm run serve:node
```

Then open: http://localhost:5173

## Architecture

- **Frontend**: Pure HTML/JS, no build step
  - HTMX 2.x (CDN) - dynamic content loading
  - Alpine.js 3.x (CDN) - reactive UI
  - DaisyUI + Tailwind (CDN) - styling
  - CodeMirror 6 (esm.sh) - code editor
  - D3.js (CDN) - visualizations

- **Backend**: Node/TypeScript (see `implementation/backend/`)
- **Solver**: Python (see `solver/`)

## File Structure

```
frontend/src/
├── index.html          # Main entry point
├── styles/             # CSS files
├── js/                 # JavaScript modules
└── components/         # UI components

implementation/
├── backend/            # Node.js/TypeScript backend
├── solver/             # TypeScript solver utilities
└── frontend/           # Svelte components (future)

solver/                 # Python constraint solver
```
