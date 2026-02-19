# Simple Install & Run Distribution

This is the **simplified distribution approach** - no complex bundling, just install scripts that set up dependencies and provide easy launch commands.

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    User Experience                          │
├─────────────────────────────────────────────────────────────┤
│  1. Download/extract the project                            │
│  2. Double-click install.bat (Win) or ./install.sh (Linux)  │
│  3. Double-click start.bat (Win) or ./start.sh (Linux)      │
│  4. Open browser to http://localhost:3000                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  What Install Script Does                   │
├─────────────────────────────────────────────────────────────┤
│  ✓ Creates Python virtual environment (.venv/)              │
│  ✓ Installs Python dependencies (pip install)               │
│  ✓ Installs Node.js dependencies (npm install)              │
│  ✓ Downloads CDN libs to frontend/deps/ (offline-capable)   │
│  ✓ Creates offline-capable index.html                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    After Installation                       │
├─────────────────────────────────────────────────────────────┤
│  .venv/          → Python environment with all deps         │
│  frontend/deps/  → Downloaded CDN libraries                 │
│  frontend/node_modules/ → NPM dependencies                  │
│  index.html      → Modified to use local deps (offline)     │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

Before running `install.sh` or `install.bat`, users need:

| Software | Windows | Linux/Mac | Download |
|----------|---------|-----------|----------|
| Python 3.8+ | ✓ Required | ✓ Required | https://python.org |
| Node.js 18+ | ✓ Required | ✓ Required | https://nodejs.org |
| pip | Included with Python | Included with Python | - |
| npm | Included with Node | Included with Node | - |

**One-line checks:**
```bash
# Check if prerequisites are installed
python --version && node --version && pip --version && npm --version
```

## Installation

### Windows

```powershell
# 1. Download and extract the project
# 2. Open Command Prompt or PowerShell in the project folder
# 3. Run:
install.bat

# That's it! Now you can start with:
start.bat
```

### Linux / Mac

```bash
# 1. Download and extract the project
cd planner_redesign

# 2. Make scripts executable and run install
chmod +x install.sh start.sh
./install.sh

# 3. Start the application
./start.sh
```

## What Gets Installed

### Python Dependencies (in `.venv/`)
- FastAPI (web framework)
- Uvicorn (ASGI server)
- Pydantic (data validation)
- Pandas (data processing)
- python-multipart (file uploads)

### Node.js Dependencies (in `frontend/node_modules/`)
- serve (static file server)
- jest (testing framework)
- jest-environment-jsdom (DOM testing)

### CDN Dependencies (in `frontend/deps/`)
All downloaded for offline use:
- HTMX 2.0.0
- Alpine.js 3.14.3
- D3.js v7
- PapaParse 5.3.2
- JSZip 3.10.1
- Tailwind CSS (standalone)
- DaisyUI 4.10.1 CSS

## Usage After Installation

### Starting the Application

```bash
# Linux/Mac - starts both frontend and backend
./start.sh

# Windows - starts both frontend and backend
start.bat

# Or specify custom ports
./start.sh 8080 9000  # frontend on 8080, backend on 9000
```

### Accessing the Application

Once started, open your browser to:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/docs

### Stopping the Application

**Linux/Mac:**
- Press `CTRL+C` in the terminal running `start.sh`

**Windows:**
- Close the "Frontend Server" and "Backend Server" windows
- Or run: `taskkill /FI "WINDOWTITLE eq *Server" /F /T`

### Updating

To update to a new version:

```bash
# 1. Pull latest changes
git pull

# 2. Re-run install to update dependencies
./install.sh  # or install.bat on Windows

# 3. Start as normal
./start.sh
```

## Directory Structure After Install

```
planner_redesign/
├── install.sh / install.bat      # One-time setup scripts
├── start.sh / start.bat          # Launch scripts
├── .venv/                        # Python virtual environment
│   ├── bin/python (or Scripts\python.exe on Windows)
│   └── lib/python3.x/site-packages/...
├── frontend/
│   ├── node_modules/            # NPM packages
│   ├── deps/                    # Downloaded CDN libs
│   │   ├── htmx.min.js
│   │   ├── alpinejs.min.js
│   │   ├── d3.v7.min.js
│   │   ├── papaparse.min.js
│   │   ├── jszip.min.js
│   │   ├── tailwindcss.js
│   │   └── daisyui.css
│   ├── index.html               # Modified for offline use
│   └── index-online.html        # Original (backup)
├── backend/
│   └── src/...
└── solver/
    └── ...
```

## Troubleshooting

### "Python is not installed"
**Solution:** Install Python 3.8+ from https://python.org and make sure it's added to PATH

### "Node.js is not installed"
**Solution:** Install Node.js 18+ from https://nodejs.org

### Port already in use
**Solution:** Use different ports:
```bash
./start.sh 8080 9000  # Try ports 8080 and 9000
```

### Permission denied (Linux/Mac)
**Solution:** Make scripts executable:
```bash
chmod +x install.sh start.sh
```

### "Cannot find module" errors
**Solution:** Re-run the install script:
```bash
./install.sh  # or install.bat on Windows
```

### Backend not connecting
**Solution:** Check if backend started correctly:
```bash
# Test backend
curl http://localhost:8000/docs

# Check backend logs
# (Look at the terminal window on Windows, or scroll up on Linux/Mac)
```

## For Distributors

### Creating a Release Package

To distribute this to users:

```bash
# 1. Clean up any dev files
cd planner_redesign
rm -rf .venv frontend/node_modules frontend/deps

# 2. Create archive (exclude .git and other dev files)
zip -r pv-planner-v1.0.0.zip . -x "*.git*" -x "__pycache__/*" -x "*.pyc"

# 3. Test the archive
unzip pv-planner-v1.0.0.zip -d test_install
cd test_install
./install.sh
./start.sh
```

### What to Include in Distribution

**Required:**
- `install.sh` / `install.bat`
- `start.sh` / `start.bat`
- `frontend/` directory (all source files)
- `backend/` directory (all source files)
- `solver/` directory (all source files)
- `backend/requirements.txt`
- `README.md`

**Not Required (will be created by install script):**
- `.venv/` (will be created)
- `frontend/node_modules/` (will be created)
- `frontend/deps/` (will be downloaded)

## Comparison with Other Approaches

| Approach | Complexity | Pros | Cons |
|----------|------------|------|------|
| **Simple Install (this)** | Low | Easy to maintain, users get source code, simple updates | Users need Python + Node installed |
| Tauri Desktop App | High | Native .exe/.app, no prerequisites | Complex build process, harder to debug |
| Docker | Medium | One container, consistent environment | Users need Docker, heavier resource use |
| PyInstaller | Medium | Single .exe file | Large file size, slower startup, antivirus flags |

## Why This Approach?

1. **Maintainer-friendly:** No complex build pipelines or native compilation
2. **User-friendly:** One command to install, one command to run
3. **Debuggable:** Users have actual source code they can read and modify
4. **Updatable:** Just `git pull` and re-run install
5. **Offline-capable:** All CDN deps downloaded locally
6. **Cross-platform:** Works on Windows, Linux, and Mac

## Next Steps

If you want to proceed with this approach:

1. ✅ Review the `install.sh` and `install.bat` scripts
2. ✅ Review the `start.sh` and `start.bat` scripts (already exist)
3. Test on your system
4. Create a test distribution package
5. Have a user test the install process

**Estimated time to implement:** 1-2 hours (mostly testing)
