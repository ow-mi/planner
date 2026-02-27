param(
    [int]$FrontendPort = 3000,
    [int]$BackendPort = 8000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$RunDir = Join-Path $ProjectRoot ".run"
$StatePath = Join-Path $RunDir "state.json"

function Write-Info([string]$Message) {
    Write-Host "[INFO] $Message"
}

function Write-Ok([string]$Message) {
    Write-Host "[OK]   $Message" -ForegroundColor Green
}

function Write-Warn([string]$Message) {
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Stop-ProcessTreeByPid {
    param(
        [int]$ProcessId,
        [string]$Name
    )

    if ($ProcessId -le 0) {
        return $false
    }

    try {
        $process = Get-Process -Id $ProcessId -ErrorAction Stop
        if ($null -ne $process) {
            Write-Info "Stopping $Name process tree (PID $ProcessId)..."
            & taskkill /PID $ProcessId /T /F *> $null
            Write-Ok "$Name stopped."
            return $true
        }
    }
    catch {
    }
    return $false
}

function Get-ListeningPidsByPort {
    param(
        [int]$Port
    )

    $results = @()
    $lines = netstat -ano | Select-String -Pattern "LISTENING"
    foreach ($line in $lines) {
        if ($line.Line -match "[:\.]$Port\s+.*LISTENING\s+(\d+)\s*$") {
            $results += [int]$matches[1]
        }
    }
    return ($results | Sort-Object -Unique)
}

function Stop-ByPort {
    param(
        [int]$Port,
        [string]$Name
    )

    $killedAny = $false
    $processIds = Get-ListeningPidsByPort -Port $Port
    foreach ($processId in $processIds) {
        if (Stop-ProcessTreeByPid -ProcessId $processId -Name "$Name (port $Port)") {
            $killedAny = $true
        }
    }
    return $killedAny
}

Write-Info "Stopping Planner services..."

$stoppedFrontend = $false
$stoppedBackend = $false

if (Test-Path -LiteralPath $StatePath) {
    try {
        $state = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
        if ($null -ne $state.frontend_host_pid) {
            $stoppedFrontend = Stop-ProcessTreeByPid -ProcessId ([int]$state.frontend_host_pid) -Name "Frontend"
        }
        if ($null -ne $state.backend_host_pid) {
            $stoppedBackend = Stop-ProcessTreeByPid -ProcessId ([int]$state.backend_host_pid) -Name "Backend"
        }
        if ($null -ne $state.frontend_port) {
            $FrontendPort = [int]$state.frontend_port
        }
        if ($null -ne $state.backend_port) {
            $BackendPort = [int]$state.backend_port
        }
    }
    catch {
        Write-Warn "Could not parse .run/state.json; falling back to port-based stop."
    }
}

if (-not $stoppedFrontend) {
    if (-not (Stop-ByPort -Port $FrontendPort -Name "Frontend")) {
        Write-Warn "No frontend listener found on port $FrontendPort."
    }
}

if (-not $stoppedBackend) {
    if (-not (Stop-ByPort -Port $BackendPort -Name "Backend")) {
        Write-Warn "No backend listener found on port $BackendPort."
    }
}

if (Test-Path -LiteralPath $StatePath) {
    Remove-Item -LiteralPath $StatePath -Force
}

Write-Ok "Stop routine completed."
