@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "LOG_DIR=%SCRIPT_DIR%.runlogs"
set "BOOTSTRAP_LOG=%LOG_DIR%\start-bootstrap.log"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>&1

echo [%date% %time%] start.bat launching dev-start.ps1 with args: %*>> "%BOOTSTRAP_LOG%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\dev-start.ps1" %* >> "%BOOTSTRAP_LOG%" 2>&1
echo [%date% %time%] start.bat finished with exit code %ERRORLEVEL%.>> "%BOOTSTRAP_LOG%"
if not "%ERRORLEVEL%"=="0" (
    echo Startup failed. See "%BOOTSTRAP_LOG%" for bootstrap output.
)
exit /b %ERRORLEVEL%
