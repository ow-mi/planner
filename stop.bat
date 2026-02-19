@echo off
REM Stop Planner Redesign - Frontend + Backend (Windows)

echo Stopping Planner Redesign services...
echo.

REM Stop Frontend (Python HTTP server on port 3000)
echo Stopping Frontend...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>nul
    if %ERRORLEVEL% EQU 0 echo [OK] Frontend stopped
)

REM Stop Backend (Uvicorn on port 8000)
echo Stopping Backend...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>nul
    if %ERRORLEVEL% EQU 0 echo [OK] Backend stopped
)

REM Also try to close the command windows by title
taskkill /FI "WINDOWTITLE eq Frontend Server" /F /T >nul 2>nul
taskkill /FI "WINDOWTITLE eq Backend Server" /F /T >nul 2>nul

echo.
echo All services stopped.
