param(
    [int]$FrontendPort = 3000,
    [int]$BackendPort = 8000,
    [switch]$Headless,
    [switch]$NoInstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$RunDir = Join-Path $ProjectRoot ".run"
$LogDir = Join-Path $ProjectRoot ".runlogs"
$StatePath = Join-Path $RunDir "state.json"
$FrontendLog = Join-Path $LogDir "frontend.log"
$BackendLog = Join-Path $LogDir "backend.log"

function Write-Info([string]$Message) {
    Write-Host "[INFO] $Message"
}

function Write-Ok([string]$Message) {
    Write-Host "[OK]   $Message" -ForegroundColor Green
}

function Write-Warn([string]$Message) {
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Err([string]$Message) {
    Write-Host "[ERR]  $Message" -ForegroundColor Red
}

function Ensure-Dir([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

function Get-PythonCandidates {
    $candidates = New-Object System.Collections.Generic.List[string]
    $venvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
    if (Test-Path -LiteralPath $venvPython) {
        $candidates.Add($venvPython)
    }

    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if ($null -ne $pythonCmd -and -not $candidates.Contains($pythonCmd.Source)) {
        $candidates.Add($pythonCmd.Source)
    }

    return $candidates
}

function Test-UvicornAvailable {
    param(
        [string]$PythonCommand
    )
    & $PythonCommand -c "import importlib.util, sys; sys.exit(0 if importlib.util.find_spec('uvicorn') else 1)" >$null 2>$null
    return ($LASTEXITCODE -eq 0)
}

function Test-PortInUse([int]$Port) {
    $lines = netstat -ano | Select-String -Pattern "LISTENING"
    foreach ($line in $lines) {
        if ($line.Line -match "[:\.]$Port\s") {
            return $true
        }
    }
    return $false
}

function Wait-PortOpen {
    param(
        [int]$Port,
        [int]$TimeoutSeconds = 30
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-PortInUse -Port $Port) {
            return $true
        }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

function Wait-HttpOk {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 30
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return $true
            }
        }
        catch {
            Start-Sleep -Milliseconds 600
        }
    }
    return $false
}

function Ensure-Uvicorn {
    param(
        [string]$PythonCommand
    )

    if (Test-UvicornAvailable -PythonCommand $PythonCommand) {
        return
    }

    if ($NoInstall) {
        throw "uvicorn is missing and -NoInstall was specified."
    }

    Write-Warn "uvicorn not found; installing backend requirements..."
    & $PythonCommand -m pip install -r (Join-Path $ProjectRoot "backend\requirements.txt")
    $installExit = $LASTEXITCODE
    if ($installExit -ne 0) {
        throw "Dependency install failed."
    }
}

function New-WindowCommand {
    param(
        [string]$WorkDir,
        [string]$CommandLine,
        [string]$LogPath
    )

    $escapedWorkDir = $WorkDir.Replace("'", "''")
    $escapedLogPath = $LogPath.Replace("'", "''")
    $flatCommand = ($CommandLine -replace "(\r|\n)+", " ").Trim()
    return @"
`$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    `$PSNativeCommandUseErrorActionPreference = `$false
}
`$ErrorActionPreference = 'Continue'
Set-Location -LiteralPath '$escapedWorkDir'
Write-Host "Working directory: $WorkDir"
`$cmd = @'
$flatCommand
'@
Write-Host ("Command: {0}" -f `$cmd.Trim())
Invoke-Expression `$cmd 2>&1 | Tee-Object -FilePath '$escapedLogPath' -Append
if (`$LASTEXITCODE -ne 0) {
    Write-Host "Process exited with code `$LASTEXITCODE." -ForegroundColor Red
    exit `$LASTEXITCODE
}
"@
}

function Write-RunnerScript {
    param(
        [string]$Name,
        [string]$WorkDir,
        [string]$CommandLine,
        [string]$LogPath
    )

    $runnerPath = Join-Path $RunDir ("{0}-runner.ps1" -f $Name.ToLowerInvariant())
    $runnerScript = New-WindowCommand -WorkDir $WorkDir -CommandLine $CommandLine -LogPath $LogPath
    Set-Content -Path $runnerPath -Value $runnerScript -Encoding UTF8
    return $runnerPath
}

function Start-ServiceProcess {
    param(
        [string]$Name,
        [string]$WorkDir,
        [string]$CommandLine,
        [string]$LogPath
    )

    $runnerPath = Write-RunnerScript -Name $Name -WorkDir $WorkDir -CommandLine $CommandLine -LogPath $LogPath
    if ($Headless) {
        $proc = Start-Process -FilePath "powershell.exe" -ArgumentList @(
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-File", $runnerPath
        ) -PassThru -WindowStyle Hidden
    } else {
        $proc = Start-Process -FilePath "powershell.exe" -ArgumentList @(
            "-NoExit",
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-File", $runnerPath
        ) -PassThru
    }

    if ($null -eq $proc -or $proc.Id -le 0) {
        throw "Failed to launch $Name process."
    }

    return $proc
}

function Stop-ProcessTreeByPid {
    param(
        [int]$ProcessId,
        [string]$Name
    )

    if ($ProcessId -le 0) {
        return
    }

    try {
        $process = Get-Process -Id $ProcessId -ErrorAction Stop
        if ($null -ne $process) {
            Write-Info "Stopping $Name (PID $ProcessId)..."
            & taskkill /PID $ProcessId /T /F *> $null
        }
    }
    catch {
    }
}

Ensure-Dir -Path $RunDir
Ensure-Dir -Path $LogDir

$pythonCandidates = Get-PythonCandidates
if ($pythonCandidates.Count -eq 0) {
    throw "Python was not found in PATH and .venv\Scripts\python.exe is missing."
}

$pythonExe = $pythonCandidates[0]
if (-not (Test-UvicornAvailable -PythonCommand $pythonExe)) {
    foreach ($candidate in $pythonCandidates) {
        if (Test-UvicornAvailable -PythonCommand $candidate) {
            $pythonExe = $candidate
            break
        }
    }
}
Write-Info "Python command: $pythonExe"

if (Test-PortInUse -Port $FrontendPort) {
    throw "Frontend port $FrontendPort is already in use."
}
if (Test-PortInUse -Port $BackendPort) {
    throw "Backend port $BackendPort is already in use."
}

$frontendCmd = "& '$pythonExe' -m http.server $FrontendPort"
$backendCmd = "& '$pythonExe' -m uvicorn backend.src.api.main:app --host 0.0.0.0 --port $BackendPort --reload --reload-dir backend/src"

$frontendProcess = $null
$backendProcess = $null

try {
    Ensure-Uvicorn -PythonCommand $pythonExe

    Write-Info "Starting frontend on port $FrontendPort..."
    $frontendProcess = Start-ServiceProcess -Name "Frontend" -WorkDir (Join-Path $ProjectRoot "frontend") -CommandLine $frontendCmd -LogPath $FrontendLog

    if (-not (Wait-PortOpen -Port $FrontendPort -TimeoutSeconds 25)) {
        throw "Frontend did not open port $FrontendPort. See $FrontendLog"
    }
    Write-Ok "Frontend is listening on port $FrontendPort (host PID $($frontendProcess.Id))."

    Write-Info "Starting backend on port $BackendPort..."
    $backendProcess = Start-ServiceProcess -Name "Backend" -WorkDir $ProjectRoot -CommandLine $backendCmd -LogPath $BackendLog

    if (-not (Wait-PortOpen -Port $BackendPort -TimeoutSeconds 30)) {
        throw "Backend did not open port $BackendPort. See $BackendLog"
    }
    if (-not (Wait-HttpOk -Url "http://localhost:$BackendPort/api/health" -TimeoutSeconds 30)) {
        throw "Backend health endpoint did not respond in time. See $BackendLog"
    }
    Write-Ok "Backend is healthy on port $BackendPort (host PID $($backendProcess.Id))."

    $state = [ordered]@{
        started_at        = (Get-Date).ToString("s")
        frontend_port     = $FrontendPort
        backend_port      = $BackendPort
        frontend_host_pid = $frontendProcess.Id
        backend_host_pid  = $backendProcess.Id
        frontend_log      = $FrontendLog
        backend_log       = $BackendLog
        mode              = if ($Headless) { "headless" } else { "windowed" }
    }

    $state | ConvertTo-Json | Set-Content -Path $StatePath -Encoding UTF8

    Write-Host ""
    Write-Ok "All services started."
    Write-Host "Frontend:    http://localhost:$FrontendPort"
    Write-Host "Backend API: http://localhost:$BackendPort"
    Write-Host "API Docs:    http://localhost:$BackendPort/docs"
    Write-Host "Health:      http://localhost:$BackendPort/api/health"
    Write-Host ""
    Write-Host "Logs:"
    Write-Host "  Frontend: $FrontendLog"
    Write-Host "  Backend:  $BackendLog"
    Write-Host ""
    Write-Host "Stop services with:"
    Write-Host "  stop.bat"
    exit 0
}
catch {
    Write-Err $_.Exception.Message
    if ($null -ne $backendProcess) {
        Stop-ProcessTreeByPid -ProcessId $backendProcess.Id -Name "Backend"
    }
    if ($null -ne $frontendProcess) {
        Stop-ProcessTreeByPid -ProcessId $frontendProcess.Id -Name "Frontend"
    }
    exit 1
}
