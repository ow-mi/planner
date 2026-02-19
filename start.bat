@echo off
REM Start Planner Redesign - Frontend + Backend (Windows)
REM Usage: start.bat [frontend-port] [backend-port]
REM Default: Frontend on 3000, Backend on 8000

setlocal EnableDelayedExpansion

REM Get script directory
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM Parse ports
set "FRONTEND_PORT=%~1"
if "%~1"=="" set "FRONTEND_PORT=3000"

set "BACKEND_PORT=%~2"
if "%~2"=="" set "BACKEND_PORT=8000"

echo ========================================
echo   Planner Redesign Startup
echo ========================================
echo.
echo Frontend: http://localhost:%FRONTEND_PORT%
echo Backend:  http://localhost:%BACKEND_PORT%
echo.

REM Check Python availability
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    where python3 >nul 2>nul
    if %ERRORLEVEL% NEQ 0 (
        echo Error: Python is not installed or not in PATH
        exit /b 1
    ) else (
        set "PYTHON_CMD=python3"
    )
) else (
    set "PYTHON_CMD=python"
)

REM Check if ports are in use
netstat -ano | findstr ":%FRONTEND_PORT% " | findstr "LISTENING" >nul
if %ERRORLEVEL% EQU 0 (
    echo Error: Port %FRONTEND_PORT% is already in use. Frontend may already be running.
    exit /b 1
)

netstat -ano | findstr ":%BACKEND_PORT% " | findstr "LISTENING" >nul
if %ERRORLEVEL% EQU 0 (
    echo Error: Port %BACKEND_PORT% is already in use. Backend may already be running.
    exit /b 1
)

echo Starting services...
echo.

REM ========================================
REM Start Frontend (Python HTTP server)
REM ========================================
echo Starting Frontend on port %FRONTEND_PORT%...

start "Frontend Server" cmd /c "cd /d %SCRIPT_DIR%frontend && %PYTHON_CMD% -m http.server %FRONTEND_PORT%"
REM start does not reliably set ERRORLEVEL; avoid false negatives
echo [OK] Frontend started on port %FRONTEND_PORT%
echo.

REM Wait for frontend to initialize
timeout /t 1 /nobreak >nul

REM ========================================
REM Start Backend (Uvicorn)
REM ========================================
echo Starting Backend on port %BACKEND_PORT%...

REM Set PYTHONPATH so imports work correctly (backend is inside project root)
set "PYTHONPATH=%SCRIPT_DIR%;%PYTHONPATH%"

REM Check if virtual environment exists
if exist "%SCRIPT_DIR%\.venv\Scripts\activate.bat" (
    call "%SCRIPT_DIR%\.venv\Scripts\activate.bat"
    echo [OK] Activated virtual environment
) else if exist "%SCRIPT_DIR%\.venv\activate.bat" (
    call "%SCRIPT_DIR%\.venv\activate.bat"
    echo [OK] Activated virtual environment
)

REM Change to project root (not backend folder)
cd /d "%SCRIPT_DIR%"

REM Check for uvicorn
%PYTHON_CMD% -c "import uvicorn" 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Warning: Uvicorn not found. Installing dependencies...
    pip install -r backend\requirements.txt
    if %ERRORLEVEL% NEQ 0 (
        echo Error: Failed to install dependencies
        exit /b 1
    )
)

start "Backend Server" cmd /c "%PYTHON_CMD% -m uvicorn backend.src.api.main:app --host 0.0.0.0 --port %BACKEND_PORT% --reload --reload-dir backend/src"
REM start does not reliably set ERRORLEVEL; avoid false negatives
echo [OK] Backend started on port %BACKEND_PORT%
echo.

REM Wait for backend to initialize
timeout /t 2 /nobreak >nul

echo ========================================
echo   All services started successfully!
echo ========================================
echo.
echo Frontend:    http://localhost:%FRONTEND_PORT%
echo Backend API: http://localhost:%BACKEND_PORT%
echo API Docs:    http://localhost:%BACKEND_PORT%/docs
echo.
echo To stop services:
echo   - Close the Frontend Server and Backend Server windows
echo   - Or run: taskkill /FI "WINDOWTITLE eq *Server" /F /T
echo.

exit /b 0
