@echo off
setlocal EnableDelayedExpansion

set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"

echo ===================================
echo PV Planner - Installation Script
echo ===================================
echo.

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

if "%PYTHON_CMD%"=="" (
    echo Error: Python is not installed. Install Python 3.8+ from https://python.org
    exit /b 1
)

echo [1/6] Checking prerequisites...
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: Node.js is not installed. Install Node.js LTS from https://nodejs.org
    exit /b 1
)

where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: npm is not available in PATH
    exit /b 1
)

echo [OK] Prerequisites found

echo.
echo [2/6] Creating virtual environment...
if not exist ".venv" (
    %PYTHON_CMD% -m venv .venv
    if %ERRORLEVEL% neq 0 (
        echo Error: Failed to create virtual environment
        exit /b 1
    )
)
call .venv\Scripts\activate.bat

echo [OK] Virtual environment ready

echo.
echo [3/6] Installing Python dependencies...
python -m pip install --upgrade pip
if %ERRORLEVEL% neq 0 exit /b 1
python -m pip install -r backend\requirements.txt
if %ERRORLEVEL% neq 0 exit /b 1
if exist solver\requirements.txt (
    python -m pip install -r solver\requirements.txt
    if %ERRORLEVEL% neq 0 exit /b 1
)

echo [OK] Python dependencies installed

echo.
echo [4/6] Installing Node dependencies...
cd frontend

if not exist package.json (
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

call npm install
if %ERRORLEVEL% neq 0 (
    echo Error: npm install failed
    exit /b 1
)

echo [OK] Node dependencies installed

echo.
echo [5/6] Downloading browser dependencies for offline use...
if not exist deps mkdir deps
cd deps

powershell -NoProfile -Command "Invoke-WebRequest -UseBasicParsing -Uri 'https://unpkg.com/htmx.org@2.0.0/dist/htmx.min.js' -OutFile 'htmx.min.js'"
powershell -NoProfile -Command "Invoke-WebRequest -UseBasicParsing -Uri 'https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js' -OutFile 'alpinejs.min.js'"
powershell -NoProfile -Command "Invoke-WebRequest -UseBasicParsing -Uri 'https://d3js.org/d3.v7.min.js' -OutFile 'd3.v7.min.js'"
powershell -NoProfile -Command "Invoke-WebRequest -UseBasicParsing -Uri 'https://cdn.jsdelivr.net/npm/papaparse@5.3.2/papaparse.min.js' -OutFile 'papaparse.min.js'"
powershell -NoProfile -Command "Invoke-WebRequest -UseBasicParsing -Uri 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js' -OutFile 'jszip.min.js'"
powershell -NoProfile -Command "Invoke-WebRequest -UseBasicParsing -Uri 'https://cdn.tailwindcss.com' -OutFile 'tailwindcss.js'"
powershell -NoProfile -Command "Invoke-WebRequest -UseBasicParsing -Uri 'https://cdn.jsdelivr.net/npm/daisyui@4.10.1/dist/full.min.css' -OutFile 'daisyui.css'"
if %ERRORLEVEL% neq 0 (
    echo Error: Failed downloading browser dependencies
    exit /b 1
)

cd ..
echo [OK] Browser dependencies downloaded

echo.
echo [6/6] Creating offline frontend index...
if not exist index-online.html (
    copy index.html index-online.html >nul
)

powershell -NoProfile -Command "$c=Get-Content -Raw index-online.html; $c=$c.Replace('https://unpkg.com/htmx.org@2.0.0','./deps/htmx.min.js').Replace('https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js','./deps/alpinejs.min.js').Replace('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js','./deps/jszip.min.js').Replace('https://d3js.org/d3.v7.min.js','./deps/d3.v7.min.js').Replace('https://cdn.jsdelivr.net/npm/papaparse@5.3.2/papaparse.min.js','./deps/papaparse.min.js').Replace('https://cdn.tailwindcss.com','./deps/tailwindcss.js').Replace('https://cdn.jsdelivr.net/npm/daisyui@4.10.1/dist/full.min.css','./deps/daisyui.css').Replace('https://esm.sh/@codemirror/view@6.26.0?external=*','./node_modules/@codemirror/view/dist/index.js').Replace('https://esm.sh/@codemirror/state@6.4.0?external=*','./node_modules/@codemirror/state/dist/index.js').Replace('https://esm.sh/@codemirror/language@6.10.0?external=*','./node_modules/@codemirror/language/dist/index.js').Replace('https://esm.sh/@codemirror/commands@6.5.0?external=*','./node_modules/@codemirror/commands/dist/index.js').Replace('https://esm.sh/@codemirror/search@6.5.5?external=*','./node_modules/@codemirror/search/dist/index.js').Replace('https://esm.sh/@codemirror/autocomplete@6.11.0?external=*','./node_modules/@codemirror/autocomplete/dist/index.js').Replace('https://esm.sh/@codemirror/lint@6.4.0?external=*','./node_modules/@codemirror/lint/dist/index.js').Replace('https://esm.sh/@codemirror/lang-javascript@6.2.2?external=*','./node_modules/@codemirror/lang-javascript/dist/index.js').Replace('https://esm.sh/@codemirror/theme-one-dark@6.1.2?external=*','./node_modules/@codemirror/theme-one-dark/dist/index.js').Replace('https://esm.sh/@lezer/common@1.2.1?external=*','./node_modules/@lezer/common/dist/index.js').Replace('https://esm.sh/@lezer/highlight@1.2.0?external=*','./node_modules/@lezer/highlight/dist/index.js').Replace('https://esm.sh/@lezer/lr@1.4.0?external=*','./node_modules/@lezer/lr/dist/index.js').Replace('https://esm.sh/@lezer/javascript@1.4.13?external=*','./node_modules/@lezer/javascript/dist/index.js').Replace('https://esm.sh/@marijn/find-cluster-break@1.0.2?external=*','./node_modules/@marijn/find-cluster-break/src/index.js').Replace('https://esm.sh/style-mod@4.1.2?external=*','./node_modules/style-mod/src/style-mod.js').Replace('https://esm.sh/w3c-keyname@2.2.8?external=*','./node_modules/w3c-keyname/index.js').Replace('https://esm.sh/crelt@1.0.6?external=*','./node_modules/crelt/index.js'); if($c -notmatch '\"@marijn/find-cluster-break\"'){ $c=$c -replace '\"@lezer/javascript\": \"\\./node_modules/@lezer/javascript/dist/index.js\",','\"@lezer/javascript\": \"./node_modules/@lezer/javascript/dist/index.js\",`n            \"@marijn/find-cluster-break\": \"./node_modules/@marijn/find-cluster-break/src/index.js\",' }; [System.IO.File]::WriteAllText('index.html',$c)"
if %ERRORLEVEL% neq 0 (
    echo Error: Failed generating offline index.html
    exit /b 1
)

cd /d "%PROJECT_ROOT%"

echo [OK] Offline index generated at frontend\index.html

echo.
echo ===================================
echo Installation complete
echo ===================================
echo Start the app with: start.bat
echo.
