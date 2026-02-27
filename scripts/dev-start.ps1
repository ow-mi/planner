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
$StartupLog = Join-Path $LogDir "startup.log"

function Write-Log {
    param(
        [string]$Level,
        [string]$Message,
        [ConsoleColor]$Color = [ConsoleColor]::White
    )

    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff")
    $line = "$timestamp [$Level] $Message"
    try {
        Add-Content -Path $StartupLog -Value $line -Encoding UTF8
    }
    catch {
        # Best-effort logging to file; always keep console output.
    }
    Write-Host "[$Level] $Message" -ForegroundColor $Color
}

function Write-Info([string]$Message) {
    Write-Log -Level "INFO" -Message $Message
}

function Write-Ok([string]$Message) {
    Write-Log -Level "OK" -Message $Message -Color Green
}

function Write-Warn([string]$Message) {
    Write-Log -Level "WARN" -Message $Message -Color Yellow
}

function Write-Err([string]$Message) {
    Write-Log -Level "ERR" -Message $Message -Color Red
}

function Write-DebugBlock {
    param(
        [string]$Header,
        [string]$Content
    )

    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff")
    try {
        Add-Content -Path $StartupLog -Value "$timestamp [DEBUG] $Header" -Encoding UTF8
        Add-Content -Path $StartupLog -Value $Content -Encoding UTF8
    }
    catch {
    }
}

function Get-LogTail {
    param(
        [string]$Path,
        [int]$LineCount = 60
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return "Log file does not exist: $Path"
    }
    try {
        $lines = Get-Content -Path $Path -Tail $LineCount -ErrorAction Stop
        return ($lines -join [Environment]::NewLine)
    }
    catch {
        return "Unable to read log file: $Path. Error: $($_.Exception.Message)"
    }
}

function Write-PortDiagnostics {
    param(
        [int]$Port,
        [string]$Label
    )

    try {
        $matches = @(netstat -ano | Select-String -Pattern "[:\.]$Port\s" | ForEach-Object { $_.Line.Trim() })
        if ($matches.Count -eq 0) {
            Write-Warn "${Label}: no netstat entries found for port $Port."
            return
        }

        Write-Warn "${Label}: netstat entries for port ${Port}:"
        foreach ($entry in $matches) {
            Write-Warn "  $entry"
            if ($entry -match "\s(?<pid>\d+)\s*$") {
                $pid = [int]$Matches["pid"]
                try {
                    $proc = Get-Process -Id $pid -ErrorAction Stop
                    Write-Warn "    PID $pid -> $($proc.ProcessName)"
                }
                catch {
                    Write-Warn "    PID $pid -> process lookup failed: $($_.Exception.Message)"
                }
            }
        }
    }
    catch {
        Write-Warn "${Label}: failed to collect port diagnostics for port $Port. Error: $($_.Exception.Message)"
    }
}

function Write-ProcessSnapshot {
    param(
        [int]$ProcessId,
        [string]$Label
    )

    try {
        $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop
        $snapshot = [ordered]@{
            label          = $Label
            process_id     = $proc.ProcessId
            name           = $proc.Name
            executable     = $proc.ExecutablePath
            command_line   = $proc.CommandLine
        } | ConvertTo-Json -Depth 3
        Write-DebugBlock -Header "Process snapshot for PID $ProcessId" -Content $snapshot
    }
    catch {
        Write-Warn "Could not collect process snapshot for PID $ProcessId. Error: $($_.Exception.Message)"
    }
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
        Write-Info "Python candidate discovered: $venvPython"
    }
    else {
        Write-Warn "Python candidate missing: $venvPython"
    }

    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if ($null -ne $pythonCmd -and -not $candidates.Contains($pythonCmd.Source)) {
        $candidates.Add($pythonCmd.Source)
        Write-Info "Python candidate discovered via PATH: $($pythonCmd.Source)"
    }
    elseif ($null -eq $pythonCmd) {
        Write-Warn "'python' command not found in PATH."
    }

    return $candidates
}

function Test-UvicornAvailable {
    param(
        [string]$PythonCommand
    )
    Write-Info "Checking uvicorn availability with: $PythonCommand"
    & $PythonCommand -c "import importlib.util, sys; sys.exit(0 if importlib.util.find_spec('uvicorn') else 1)" >$null 2>$null
    $available = ($LASTEXITCODE -eq 0)
    if ($available) {
        Write-Info "uvicorn is available for: $PythonCommand"
    }
    else {
        Write-Warn "uvicorn is not available for: $PythonCommand"
    }
    return $available
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

function Find-AvailablePort {
    param(
        [int]$PreferredPort,
        [int]$MaxAttempts = 200,
        [string]$Label = "Service"
    )

    $candidate = $PreferredPort
    for ($i = 0; $i -lt $MaxAttempts; $i++) {
        if (-not (Test-PortInUse -Port $candidate)) {
            if ($candidate -ne $PreferredPort) {
                Write-Warn "$Label requested port $PreferredPort is unavailable; using fallback port $candidate."
            }
            return $candidate
        }

        if ($i -eq 0) {
            Write-PortDiagnostics -Port $PreferredPort -Label "$Label port pre-check"
        }
        $candidate++
    }

    throw "$Label could not find a free port starting at $PreferredPort within $MaxAttempts attempts."
}

function Wait-PortOpen {
    param(
        [int]$Port,
        [int]$TimeoutSeconds = 30
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    Write-Info "Waiting up to $TimeoutSeconds seconds for port $Port to open."
    while ((Get-Date) -lt $deadline) {
        if (Test-PortInUse -Port $Port) {
            Write-Info "Port $Port is open."
            return $true
        }
        Start-Sleep -Milliseconds 500
    }
    Write-Warn "Timed out waiting for port $Port."
    return $false
}

function Wait-HttpOk {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 30
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    Write-Info "Waiting up to $TimeoutSeconds seconds for HTTP check: $Url"
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                Write-Info "HTTP check succeeded: $Url (status $($response.StatusCode))."
                return $true
            }
        }
        catch {
            Start-Sleep -Milliseconds 600
        }
    }
    Write-Warn "Timed out waiting for HTTP check: $Url"
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
        Write-Err "uvicorn missing and -NoInstall was specified."
        throw "uvicorn is missing and -NoInstall was specified."
    }

    Write-Warn "uvicorn not found; installing backend requirements..."
    & $PythonCommand -m pip install -r (Join-Path $ProjectRoot "backend\requirements.txt")
    $installExit = $LASTEXITCODE
    if ($installExit -ne 0) {
        Write-Err "Dependency install failed with exit code $installExit."
        throw "Dependency install failed."
    }
    Write-Ok "Dependency install completed."
}

function New-WindowCommand {
    param(
        [string]$WorkDir,
        [string]$CommandExe,
        [string[]]$CommandArgs,
        [string]$LogPath
    )

    $escapedWorkDir = $WorkDir.Replace("'", "''")
    $escapedLogPath = $LogPath.Replace("'", "''")
    $escapedExe = $CommandExe.Replace("'", "''")
    $argsLiteral = (($CommandArgs | ForEach-Object { "'" + ($_.Replace("'", "''")) + "'" }) -join ", ")
    return @"
`$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    `$PSNativeCommandUseErrorActionPreference = `$false
}
Set-Location -LiteralPath '$escapedWorkDir'
if (-not (Test-Path -LiteralPath '$escapedLogPath')) {
    New-Item -ItemType File -Path '$escapedLogPath' -Force | Out-Null
}
`$runnerStamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss.fff')
"`$runnerStamp [RUNNER] Started. WorkDir=$escapedWorkDir" | Out-File -FilePath '$escapedLogPath' -Append -Encoding UTF8
`$exe = '$escapedExe'
`$args = @($argsLiteral)
Write-Host ("Executable: {0}" -f `$exe)
Write-Host ("Arguments:  {0}" -f (`$args -join ' '))
try {
    & `$exe @args 2>&1 | Tee-Object -FilePath '$escapedLogPath' -Append
    `$exitCode = `$LASTEXITCODE
    if (`$null -eq `$exitCode) {
        `$exitCode = 0
    }
    if (`$exitCode -ne 0) {
        Write-Host "Process exited with code `$exitCode." -ForegroundColor Red
        exit `$exitCode
    }
    exit 0
}
catch {
    `$message = "Unhandled runner exception: $(`$_.Exception.Message)"
    Write-Host `$message -ForegroundColor Red
    `$stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss.fff')
    "`$stamp [RUNNER] `$message" | Out-File -FilePath '$escapedLogPath' -Append -Encoding UTF8
    if (`$_.ScriptStackTrace) {
        "`$stamp [RUNNER] StackTrace: $(`$_.ScriptStackTrace)" | Out-File -FilePath '$escapedLogPath' -Append -Encoding UTF8
    }
    exit 1
}
"@
}

function Write-RunnerScript {
    param(
        [string]$Name,
        [string]$WorkDir,
        [string]$CommandExe,
        [string[]]$CommandArgs,
        [string]$LogPath
    )

    $runnerPath = Join-Path $RunDir ("{0}-runner.ps1" -f $Name.ToLowerInvariant())
    $runnerScript = New-WindowCommand -WorkDir $WorkDir -CommandExe $CommandExe -CommandArgs $CommandArgs -LogPath $LogPath
    Set-Content -Path $runnerPath -Value $runnerScript -Encoding UTF8
    return $runnerPath
}

function Start-ServiceProcess {
    param(
        [string]$Name,
        [string]$WorkDir,
        [string]$CommandExe,
        [string[]]$CommandArgs,
        [string]$LogPath
    )

    if (-not (Test-Path -LiteralPath $LogPath)) {
        New-Item -ItemType File -Path $LogPath -Force | Out-Null
    }
    $runnerPath = Write-RunnerScript -Name $Name -WorkDir $WorkDir -CommandExe $CommandExe -CommandArgs $CommandArgs -LogPath $LogPath
    Write-Info "$Name runner script: $runnerPath"
    Write-Info "$Name working directory: $WorkDir"
    Write-Info "$Name executable: $CommandExe"
    Write-Info "$Name args: $($CommandArgs -join ' ')"
    Write-DebugBlock -Header "$Name runner script contents" -Content (Get-Content -Path $runnerPath -Raw)
    if ($Headless) {
        $proc = Start-Process -FilePath "powershell.exe" -ArgumentList @(
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-File", $runnerPath
        ) -PassThru -WindowStyle Hidden
    } else {
        $proc = Start-Process -FilePath "powershell.exe" -ArgumentList @(
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-File", $runnerPath
        ) -PassThru
    }

    if ($null -eq $proc -or $proc.Id -le 0) {
        throw "Failed to launch $Name process."
    }

    Start-Sleep -Milliseconds 300
    $proc.Refresh()
    if ($proc.HasExited) {
        $exitCode = $proc.ExitCode
        $tail = Get-LogTail -Path $LogPath -LineCount 40
        throw "$Name process exited immediately (PID $($proc.Id), exit code $exitCode). Log tail:`n$tail"
    }

    Write-Info "$Name host process started with PID $($proc.Id)."
    Write-ProcessSnapshot -ProcessId $proc.Id -Label "$Name host process"
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
Set-Content -Path $StartupLog -Encoding UTF8 -Value @(
    "==== Planner startup log ====",
    "Started: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss.fff'))",
    "ProjectRoot: $ProjectRoot",
    "Args: FrontendPort=$FrontendPort BackendPort=$BackendPort Headless=$Headless NoInstall=$NoInstall",
    ""
)
Write-Info "Startup log initialized at: $StartupLog"
Write-Info "Run directory: $RunDir"
Write-Info "Log directory: $LogDir"
Write-Info "Frontend log: $FrontendLog"
Write-Info "Backend log: $BackendLog"

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

$resolvedFrontendPort = Find-AvailablePort -PreferredPort $FrontendPort -Label "Frontend"
$resolvedBackendPort = Find-AvailablePort -PreferredPort $BackendPort -Label "Backend"
if ($resolvedBackendPort -eq $resolvedFrontendPort) {
    $resolvedBackendPort = Find-AvailablePort -PreferredPort ($resolvedBackendPort + 1) -Label "Backend"
}

Write-Info "Frontend requested port: $FrontendPort; selected port: $resolvedFrontendPort"
Write-Info "Backend requested port: $BackendPort; selected port: $resolvedBackendPort"

$frontendExe = $pythonExe
$frontendArgs = @("-m", "http.server", "$resolvedFrontendPort")
$backendExe = $pythonExe
$backendArgs = @("-m", "uvicorn", "backend.src.api.main:app", "--host", "0.0.0.0", "--port", "$resolvedBackendPort", "--reload", "--reload-dir", "backend/src")

$frontendProcess = $null
$backendProcess = $null

try {
    Ensure-Uvicorn -PythonCommand $pythonExe

    Set-Content -Path $FrontendLog -Encoding UTF8 -Value "==== Frontend log initialized $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff') ===="
    Set-Content -Path $BackendLog -Encoding UTF8 -Value "==== Backend log initialized $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff') ===="

    Write-Info "Starting frontend on port $resolvedFrontendPort..."
    $frontendProcess = Start-ServiceProcess -Name "Frontend" -WorkDir (Join-Path $ProjectRoot "frontend") -CommandExe $frontendExe -CommandArgs $frontendArgs -LogPath $FrontendLog

    if (-not (Wait-PortOpen -Port $resolvedFrontendPort -TimeoutSeconds 25)) {
        Write-PortDiagnostics -Port $resolvedFrontendPort -Label "Frontend startup failure"
        Write-Warn "Frontend log tail:`n$(Get-LogTail -Path $FrontendLog -LineCount 80)"
        throw "Frontend did not open port $resolvedFrontendPort. See $FrontendLog"
    }
    if (-not (Wait-HttpOk -Url "http://localhost:$resolvedFrontendPort" -TimeoutSeconds 15)) {
        Write-Warn "Frontend HTTP check failed; frontend log tail:`n$(Get-LogTail -Path $FrontendLog -LineCount 80)"
        throw "Frontend HTTP endpoint did not respond in time. See $FrontendLog"
    }
    Write-Ok "Frontend is listening on port $resolvedFrontendPort (host PID $($frontendProcess.Id))."

    Write-Info "Starting backend on port $resolvedBackendPort..."
    $backendProcess = Start-ServiceProcess -Name "Backend" -WorkDir $ProjectRoot -CommandExe $backendExe -CommandArgs $backendArgs -LogPath $BackendLog

    if (-not (Wait-PortOpen -Port $resolvedBackendPort -TimeoutSeconds 30)) {
        Write-PortDiagnostics -Port $resolvedBackendPort -Label "Backend startup failure"
        Write-Warn "Backend log tail:`n$(Get-LogTail -Path $BackendLog -LineCount 80)"
        throw "Backend did not open port $resolvedBackendPort. See $BackendLog"
    }
    if (-not (Wait-HttpOk -Url "http://localhost:$resolvedBackendPort/api/health" -TimeoutSeconds 30)) {
        Write-Warn "Backend health check failed; backend log tail:`n$(Get-LogTail -Path $BackendLog -LineCount 80)"
        throw "Backend health endpoint did not respond in time. See $BackendLog"
    }
    Write-Ok "Backend is healthy on port $resolvedBackendPort (host PID $($backendProcess.Id))."

    $state = [ordered]@{
        started_at        = (Get-Date).ToString("s")
        frontend_port     = $resolvedFrontendPort
        backend_port      = $resolvedBackendPort
        frontend_host_pid = $frontendProcess.Id
        backend_host_pid  = $backendProcess.Id
        frontend_log      = $FrontendLog
        backend_log       = $BackendLog
        mode              = if ($Headless) { "headless" } else { "windowed" }
    }

    $state | ConvertTo-Json | Set-Content -Path $StatePath -Encoding UTF8

    Write-Host ""
    Write-Ok "All services started."
    Write-Host "Frontend:    http://localhost:$resolvedFrontendPort"
    Write-Host "Backend API: http://localhost:$resolvedBackendPort"
    Write-Host "API Docs:    http://localhost:$resolvedBackendPort/docs"
    Write-Host "Health:      http://localhost:$resolvedBackendPort/api/health"
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
    Write-Err "Exception type: $($_.Exception.GetType().FullName)"
    if ($_.ScriptStackTrace) {
        Write-Err "Stack trace: $($_.ScriptStackTrace)"
    }
    if ($null -ne $backendProcess) {
        Stop-ProcessTreeByPid -ProcessId $backendProcess.Id -Name "Backend"
    }
    if ($null -ne $frontendProcess) {
        Stop-ProcessTreeByPid -ProcessId $frontendProcess.Id -Name "Frontend"
    }
    Write-Err "Startup failed. Review logs:"
    Write-Err "  Startup:  $StartupLog"
    Write-Err "  Frontend: $FrontendLog"
    Write-Err "  Backend:  $BackendLog"
    exit 1
}
