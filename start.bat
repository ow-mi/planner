@echo off
setlocal EnableDelayedExpansion

:: ===================================
:: PV Planner - Startup Script
:: Bulletproof version with error display
:: ===================================

:: 1. Validate PowerShell is available
where powershell.exe >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] PowerShell is not installed or not in PATH.
    echo Please install PowerShell 5.1 or later.
    echo.
    pause
    exit /b 1
)

:: 2. Set up directories and logs
set "SCRIPT_DIR=%~dp0"
set "LOG_DIR=%SCRIPT_DIR%.runlogs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
set "BOOTSTRAP_LOG=%LOG_DIR%\start-bootstrap.log"

:: 3. Clear previous bootstrap log and start fresh
echo [%date% %time%] start.bat launching... > "%BOOTSTRAP_LOG%"
echo Args: %* >> "%BOOTSTRAP_LOG%"
echo. >> "%BOOTSTRAP_LOG%"

:: 4. Run PowerShell script with output visible to user AND logged
echo.
echo ==================================
echo PV Planner - Starting...
echo ==================================
echo.

:: Stream output live to the console while also appending it to the bootstrap log
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
    "& { & powershell.exe -NoProfile -ExecutionPolicy Bypass -File '%SCRIPT_DIR%scripts\dev-start.ps1' %* 2>&1 | Tee-Object -FilePath '%BOOTSTRAP_LOG%' -Append; exit $LASTEXITCODE }"
set PS_EXIT_CODE=%ERRORLEVEL%

:: 5. Check exit code and display appropriate message
echo.
if %PS_EXIT_CODE% neq 0 (
    echo ==================================
    echo [ERROR] Startup failed with exit code %PS_EXIT_CODE%
    echo ==================================
    echo.
    echo Details have been logged to:
    echo   "%BOOTSTRAP_LOG%"
    echo.
    echo Run diagnose.bat to check your environment.
    echo.
    pause
    exit /b %PS_EXIT_CODE%
)

echo.
echo ==================================
echo Startup completed successfully
echo ==================================
echo.
echo Use the Frontend URL shown above to open the app in your browser.
echo If you did not override the port, the default frontend address is:
echo   http://localhost:3000
echo.
pause
exit /b 0
