@echo off
setlocal EnableDelayedExpansion

:: ===================================
:: PV Planner - Installation Script
:: Bulletproof version with TLS and retries
:: ===================================

:: Set up logging first
set "LOG_DIR=%~dp0.runlogs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
set "INSTALL_LOG=%LOG_DIR%\install.log"
echo [%DATE% %TIME%] Starting installation... > "%INSTALL_LOG%"

set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"

:: Best-effort TLS 1.2 setup for this process; download commands still set TLS explicitly
powershell.exe -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12" 2>nul

echo ===================================
echo PV Planner - Installation Script
echo ===================================
echo.

call :log "[INFO] Installation started from: %PROJECT_ROOT%"

set "PYTHON_CMD="
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    set "PYTHON_CMD=python"
) else (
    where python3 >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        set "PYTHON_CMD=python3"
    )
)

:: Also check for py launcher
if "%PYTHON_CMD%"=="" (
    where py >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        set "PYTHON_CMD=py -3"
    )
)

if "%PYTHON_CMD%"=="" (
    call :log "[ERROR] Python is not installed"
    echo [ERROR] Python is not installed.
    echo Please install Python 3.8+ from https://python.org
    echo.
    echo Run diagnose.bat to check your environment.
    echo See log: "%INSTALL_LOG%"
    echo.
    pause
    exit /b 1
)

call :log "[INFO] Using Python: %PYTHON_CMD%"
echo.

call :log "[INFO] Step 1/6: Checking prerequisites..."
echo [1/6] Checking prerequisites...
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    call :log "[ERROR] Node.js is not installed"
    echo [ERROR] Node.js is not installed.
    echo Please install Node.js LTS from https://nodejs.org
    echo See log: "%INSTALL_LOG%"
    echo.
    pause
    exit /b 1
)

where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    call :log "[ERROR] npm is not available in PATH"
    echo [ERROR] npm is not available in PATH.
    echo Please reinstall Node.js from https://nodejs.org
    echo See log: "%INSTALL_LOG%"
    echo.
    pause
    exit /b 1
)

call :log "[OK] Prerequisites found"
echo [OK] Prerequisites found

echo.
call :log "[INFO] Step 2/6: Creating virtual environment..."
echo [2/6] Creating virtual environment...
if not exist ".venv" (
    %PYTHON_CMD% -m venv .venv
    if %ERRORLEVEL% neq 0 (
        call :log "[ERROR] Failed to create virtual environment"
        echo [ERROR] Failed to create virtual environment
        echo Make sure you have the venv module installed.
        echo See log: "%INSTALL_LOG%"
        echo.
        pause
        exit /b 1
    )
    call :log "[OK] Virtual environment created"
)

:: Validate virtual environment before activation
if not exist "%~dp0.venv\Scripts\activate.bat" (
    call :log "[ERROR] Virtual environment activation script not found"
    echo.
    echo [ERROR] Virtual environment activation script not found.
    echo Make sure you ran the Python venv creation step successfully.
    echo See log: "%INSTALL_LOG%"
    pause
    exit /b 1
)

call "%~dp0.venv\Scripts\activate.bat"

:: Verify virtual environment activation succeeded
call :log "[INFO] Verifying virtual environment activation..."
set "VENV_ACTIVATED=0"

:: Method 1: Check VIRTUAL_ENV environment variable
if defined VIRTUAL_ENV (
    call :log "[INFO] VIRTUAL_ENV is set to: %VIRTUAL_ENV%"
    :: Normalize paths: remove trailing backslashes before comparison
    call :trim_backslash "%VIRTUAL_ENV%"
    set "NORM_VIRTUAL_ENV=%RESULT%"
    call :trim_backslash "%PROJECT_ROOT%.venv"
    set "NORM_PROJECT_VENV=%RESULT%"
    
    if /I "%NORM_VIRTUAL_ENV%"=="%NORM_PROJECT_VENV%" (
        set "VENV_ACTIVATED=1"
        call :log "[OK] VIRTUAL_ENV matches project .venv"
    ) else (
        call :log "[WARN] VIRTUAL_ENV does not match project .venv: %VIRTUAL_ENV%"
    )
)

:: Method 2: Check Python prefix points to venv (backup verification)
if "%VENV_ACTIVATED%"=="0" (
    for /f "delims=" %%i in ('python -c "import sys; print(sys.prefix)" 2^>nul') do set "PYTHON_PREFIX=%%i"
    call :log "[INFO] Python prefix: %PYTHON_PREFIX%"
    if defined PYTHON_PREFIX (
        echo "%PYTHON_PREFIX%" | findstr /C:".venv" >nul
        if !ERRORLEVEL! EQU 0 (
            set "VENV_ACTIVATED=1"
            call :log "[OK] Python prefix contains .venv"
        )
    )
)

if "%VENV_ACTIVATED%"=="0" (
    call :log "[ERROR] Virtual environment activation verification failed"
    echo.
    echo [ERROR] Virtual environment activation verification failed.
    echo.
    echo Expected: Python should use %PROJECT_ROOT%.venv
    echo Got: VIRTUAL_ENV=%VIRTUAL_ENV%
    if defined PYTHON_PREFIX echo     Python prefix: %PYTHON_PREFIX%
    echo.
    echo Remediation steps:
    echo   1. Delete the .venv directory and re-run install.bat
    echo   2. Ensure no other virtual environment is active in your shell
    echo   3. Run install.bat from a fresh command prompt
    echo.
    echo See log: "%INSTALL_LOG%"
    echo.
    pause
    exit /b 1
)

call :log "[OK] Virtual environment ready"
echo [OK] Virtual environment ready

echo.
call :log "[INFO] Step 3/6: Installing Python dependencies..."
echo [3/6] Installing Python dependencies...
echo Python package installer output will be shown below.
python -m pip install --upgrade pip
if %ERRORLEVEL% neq 0 (
    call :log "[ERROR] Failed to upgrade pip"
    echo [ERROR] Failed to upgrade pip
    echo See log: "%INSTALL_LOG%"
    pause
    exit /b 1
)
python -m pip install -r backend\requirements.txt
if %ERRORLEVEL% neq 0 (
    call :log "[ERROR] Failed to install backend dependencies"
    echo [ERROR] Failed to install backend dependencies
    echo See log: "%INSTALL_LOG%"
    pause
    exit /b 1
)
if exist solver\requirements.txt (
    python -m pip install -r solver\requirements.txt
    if %ERRORLEVEL% neq 0 (
        call :log "[ERROR] Failed to install solver dependencies"
        echo [ERROR] Failed to install solver dependencies
        echo See log: "%INSTALL_LOG%"
        pause
        exit /b 1
    )
)

call :log "[OK] Python dependencies installed"
echo [OK] Python dependencies installed

echo.
call :log "[INFO] Step 4/6: Installing Node dependencies..."
echo [4/6] Installing Node dependencies...

:: Validate frontend directory before cd
if not exist "%~dp0frontend" (
    call :log "[ERROR] frontend directory not found"
    echo.
    echo [ERROR] frontend directory not found. Are you running from the project root?
    echo See log: "%INSTALL_LOG%"
    pause
    exit /b 1
)

cd frontend

if not exist package.json (
    call :log "[INFO] Creating package.json..."
    (
        echo {
        echo   "name": "planner-redesign-frontend",
        echo   "private": true,
        echo   "version": "1.0.0",
        echo   "type": "module",
        echo   "scripts": {
        echo     "serve": "npx serve . -l 5173",
        echo     "test": "NODE_OPTIONS=--experimental-vm-modules jest"
        echo   },
        echo   "dependencies": {
        echo     "@codemirror/autocomplete": "^6.18.6",
        echo     "@codemirror/commands": "^6.8.1",
        echo     "@codemirror/lang-javascript": "^6.2.4",
        echo     "@codemirror/language": "^6.11.3",
        echo     "@codemirror/lint": "^6.9.1",
        echo     "@codemirror/search": "^6.5.11",
        echo     "@codemirror/state": "^6.5.2",
        echo     "@codemirror/theme-one-dark": "^6.1.3",
        echo     "@codemirror/view": "^6.38.6",
        echo     "@lezer/common": "^1.3.0",
        echo     "@lezer/highlight": "^1.2.3",
        echo     "@lezer/javascript": "^1.5.4",
        echo     "@lezer/lr": "^1.4.3",
        echo     "@marijn/find-cluster-break": "^1.0.2",
        echo     "crelt": "^1.0.6",
        echo     "style-mod": "^4.1.2",
        echo     "w3c-keyname": "^2.2.8"
        echo   },
        echo   "devDependencies": {
        echo     "jest": "^29.7.0",
        echo     "jest-environment-jsdom": "^29.7.0",
        echo     "serve": "^14.2.4"
        echo   }
        echo }
    ) > package.json
)

call :log "[INFO] Running npm install..."
echo npm install output will be shown below.
call npm install
if %ERRORLEVEL% neq 0 (
    call :log "[ERROR] npm install failed"
    echo [ERROR] npm install failed
    echo Check your internet connection and npm configuration.
    echo See log: "%INSTALL_LOG%"
    echo.
    pause
    exit /b 1
)

call :log "[OK] Node dependencies installed"
echo [OK] Node dependencies installed

echo.
call :log "[INFO] Step 5/6: Downloading browser dependencies for offline use..."
echo [5/6] Downloading browser dependencies for offline use...
if not exist deps mkdir deps
cd deps

:: Helper function for downloads with retry
:: Force TLS 1.2 per call because each PowerShell invocation starts in a fresh process
set "DOWNLOAD_RETRIES=0"

:download_htmx
set /a DOWNLOAD_RETRIES+=1
call :log "[INFO] Downloading htmx.min.js (attempt %DOWNLOAD_RETRIES%)..."
echo Downloading htmx.min.js...
powershell.exe -NoProfile -Command "$ErrorActionPreference = 'Stop'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri 'https://unpkg.com/htmx.org@2.0.0/dist/htmx.min.js' -OutFile 'htmx.min.js'" >> "%INSTALL_LOG%" 2>&1
if errorlevel 1 (
    if %DOWNLOAD_RETRIES% lss 3 (
        call :log "[WARN] Download failed, retrying %DOWNLOAD_RETRIES%/3..."
        echo [WARN] Download failed, retrying %DOWNLOAD_RETRIES%/3...
        timeout /t 2 >nul
        goto download_htmx
    )
    call :log "[ERROR] Failed to download htmx.js after 3 attempts"
    echo [ERROR] Failed to download htmx.js after 3 attempts
    echo See log: "%INSTALL_LOG%"
    pause
    exit /b 1
)

set "DOWNLOAD_RETRIES=0"
:download_alpine
set /a DOWNLOAD_RETRIES+=1
call :log "[INFO] Downloading alpinejs.min.js (attempt %DOWNLOAD_RETRIES%)..."
echo Downloading alpinejs.min.js...
powershell.exe -NoProfile -Command "$ErrorActionPreference = 'Stop'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri 'https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js' -OutFile 'alpinejs.min.js'" >> "%INSTALL_LOG%" 2>&1
if errorlevel 1 (
    if %DOWNLOAD_RETRIES% lss 3 (
        call :log "[WARN] Download failed, retrying %DOWNLOAD_RETRIES%/3..."
        echo [WARN] Download failed, retrying %DOWNLOAD_RETRIES%/3...
        timeout /t 2 >nul
        goto download_alpine
    )
    call :log "[ERROR] Failed to download alpinejs after 3 attempts"
    echo [ERROR] Failed to download alpinejs after 3 attempts
    echo See log: "%INSTALL_LOG%"
    pause
    exit /b 1
)

set "DOWNLOAD_RETRIES=0"
:download_d3
set /a DOWNLOAD_RETRIES+=1
call :log "[INFO] Downloading d3.v7.min.js (attempt %DOWNLOAD_RETRIES%)..."
echo Downloading d3.v7.min.js...
powershell.exe -NoProfile -Command "$ErrorActionPreference = 'Stop'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri 'https://d3js.org/d3.v7.min.js' -OutFile 'd3.v7.min.js'" >> "%INSTALL_LOG%" 2>&1
if errorlevel 1 (
    if %DOWNLOAD_RETRIES% lss 3 (
        call :log "[WARN] Download failed, retrying %DOWNLOAD_RETRIES%/3..."
        echo [WARN] Download failed, retrying %DOWNLOAD_RETRIES%/3...
        timeout /t 2 >nul
        goto download_d3
    )
    call :log "[ERROR] Failed to download d3.js after 3 attempts"
    echo [ERROR] Failed to download d3.js after 3 attempts
    echo See log: "%INSTALL_LOG%"
    pause
    exit /b 1
)

set "DOWNLOAD_RETRIES=0"
:download_papaparse
set /a DOWNLOAD_RETRIES+=1
call :log "[INFO] Downloading papaparse.min.js (attempt %DOWNLOAD_RETRIES%)..."
echo Downloading papaparse.min.js...
powershell.exe -NoProfile -Command "$ErrorActionPreference = 'Stop'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri 'https://cdn.jsdelivr.net/npm/papaparse@5.3.2/papaparse.min.js' -OutFile 'papaparse.min.js'" >> "%INSTALL_LOG%" 2>&1
if errorlevel 1 (
    if %DOWNLOAD_RETRIES% lss 3 (
        call :log "[WARN] Download failed, retrying %DOWNLOAD_RETRIES%/3..."
        echo [WARN] Download failed, retrying %DOWNLOAD_RETRIES%/3...
        timeout /t 2 >nul
        goto download_papaparse
    )
    call :log "[ERROR] Failed to download papaparse after 3 attempts"
    echo [ERROR] Failed to download papaparse after 3 attempts
    echo See log: "%INSTALL_LOG%"
    pause
    exit /b 1
)

set "DOWNLOAD_RETRIES=0"
:download_jszip
set /a DOWNLOAD_RETRIES+=1
call :log "[INFO] Downloading jszip.min.js (attempt %DOWNLOAD_RETRIES%)..."
echo Downloading jszip.min.js...
powershell.exe -NoProfile -Command "$ErrorActionPreference = 'Stop'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js' -OutFile 'jszip.min.js'" >> "%INSTALL_LOG%" 2>&1
if errorlevel 1 (
    if %DOWNLOAD_RETRIES% lss 3 (
        call :log "[WARN] Download failed, retrying %DOWNLOAD_RETRIES%/3..."
        echo [WARN] Download failed, retrying %DOWNLOAD_RETRIES%/3...
        timeout /t 2 >nul
        goto download_jszip
    )
    call :log "[ERROR] Failed to download jszip after 3 attempts"
    echo [ERROR] Failed to download jszip after 3 attempts
    echo See log: "%INSTALL_LOG%"
    pause
    exit /b 1
)

set "DOWNLOAD_RETRIES=0"
:download_tailwind
set /a DOWNLOAD_RETRIES+=1
call :log "[INFO] Downloading tailwindcss.js (attempt %DOWNLOAD_RETRIES%)..."
echo Downloading tailwindcss.js...
powershell.exe -NoProfile -Command "$ErrorActionPreference = 'Stop'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri 'https://cdn.tailwindcss.com' -OutFile 'tailwindcss.js'" >> "%INSTALL_LOG%" 2>&1
if errorlevel 1 (
    if %DOWNLOAD_RETRIES% lss 3 (
        call :log "[WARN] Download failed, retrying %DOWNLOAD_RETRIES%/3..."
        echo [WARN] Download failed, retrying %DOWNLOAD_RETRIES%/3...
        timeout /t 2 >nul
        goto download_tailwind
    )
    call :log "[ERROR] Failed to download tailwindcss after 3 attempts"
    echo [ERROR] Failed to download tailwindcss after 3 attempts
    echo See log: "%INSTALL_LOG%"
    pause
    exit /b 1
)

set "DOWNLOAD_RETRIES=0"
:download_daisyui
set /a DOWNLOAD_RETRIES+=1
call :log "[INFO] Downloading daisyui.css (attempt %DOWNLOAD_RETRIES%)..."
echo Downloading daisyui.css...
powershell.exe -NoProfile -Command "$ErrorActionPreference = 'Stop'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri 'https://cdn.jsdelivr.net/npm/daisyui@4.10.1/dist/full.min.css' -OutFile 'daisyui.css'" >> "%INSTALL_LOG%" 2>&1
if errorlevel 1 (
    if %DOWNLOAD_RETRIES% lss 3 (
        call :log "[WARN] Download failed, retrying %DOWNLOAD_RETRIES%/3..."
        echo [WARN] Download failed, retrying %DOWNLOAD_RETRIES%/3...
        timeout /t 2 >nul
        goto download_daisyui
    )
    call :log "[ERROR] Failed to download daisyui after 3 attempts"
    echo [ERROR] Failed to download daisyui after 3 attempts
    echo See log: "%INSTALL_LOG%"
    pause
    exit /b 1
)

cd ..
call :log "[OK] Browser dependencies downloaded"
echo [OK] Browser dependencies downloaded

echo.
call :log "[INFO] Step 6/6: Creating offline frontend index..."
echo [6/6] Creating offline frontend index...
if not exist index-online.html (
    copy index.html index-online.html >nul
)

call :log "[INFO] Generating offline index..."

:: Check if the PowerShell script exists before calling it
if not exist "%~dp0scripts\generate-offline-index.ps1" (
    call :log "[WARN] generate-offline-index.ps1 not found - skipping offline index generation"
    echo.
    echo [WARN] generate-offline-index.ps1 not found in scripts/
    echo Skipping offline index generation. The frontend will use the online index.html.
    echo To enable offline functionality, re-download the latest release from the repository.
    echo Continuing with installation...
    echo.
    goto :skip_offline_index
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\generate-offline-index.ps1" -ProjectRoot "%PROJECT_ROOT:~0,-1%" >> "%INSTALL_LOG%" 2>&1
if %ERRORLEVEL% neq 0 (
    call :log "[WARN] Failed to generate offline index - continuing with online index"
    echo [WARN] Failed to generate offline index. Continuing with online index.html
    echo See log: "%INSTALL_LOG%" for details.
    echo.
    goto :skip_offline_index
)

call :log "[OK] Offline index generated at frontend\index.html"
echo [OK] Offline index generated at frontend\index.html
goto :index_done

:skip_offline_index
call :log "[INFO] Using online frontend/index.html (CDN-based dependencies)"
echo [INFO] Using online frontend/index.html (CDN-based dependencies)

:index_done

cd /d "%PROJECT_ROOT%"

echo.
echo ===================================
echo Installation complete
echo ===================================
call :log "[INFO] Installation completed successfully"
echo Start the app with: start.bat
echo Run diagnose.bat to check your environment
echo Log file: "%INSTALL_LOG%"
pause

exit /b 0

:: ========================================
:: SUBROUTINES (these are called with CALL)
:: ========================================

:log
echo [%DATE% %TIME%] %* >> "%INSTALL_LOG%"
echo %*
goto :eof

:trim_backslash
:: Removes trailing backslashes from a path
:: Usage: call :trim_backslash "path" - result in %RESULT%
set "RESULT=%~1"
:trim_loop
if "%RESULT:~-1%"=="\" (
    set "RESULT=%RESULT:~0,-1%"
    goto trim_loop
)
goto :eof
