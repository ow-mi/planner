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
            
            # Post-termination verification with retries (up to 5 seconds)
            $verifyRetries = 10
            $verifyDelayMs = 500
            $stillAlive = $false
            
            for ($i = 0; $i -lt $verifyRetries; $i++) {
                Start-Sleep -Milliseconds $verifyDelayMs
                try {
                    $stillAliveProcess = Get-Process -Id $ProcessId -ErrorAction Stop
                    if ($null -ne $stillAliveProcess) {
                        $stillAlive = $true
                    } else {
                        break
                    }
                }
                catch {
                    # Process no longer exists
                    break
                }
            }
            
            if ($stillAlive) {
                Write-Warn "$Name PID $ProcessId still running after termination attempt."
                Write-Warn "Residual PID detected - manual cleanup may be required."
                return $false
            } else {
                Write-Ok "$Name stopped (verified termination)."
                return $true
            }
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
    $residualPids = @()
    $processIds = Get-ListeningPidsByPort -Port $Port
    foreach ($processId in $processIds) {
        if (Stop-ProcessTreeByPid -ProcessId $processId -Name "$Name (port $Port)") {
            $killedAny = $true
        } else {
            $residualPids += $processId
        }
    }
    
    if ($residualPids.Count -gt 0) {
        Write-Warn "Residual $Name PIDs still detected on port $Port`: $($residualPids -join ', ')"
    }
    
    return $killedAny
}

Write-Info "Stopping Planner services..."

$stoppedFrontend = $false
$stoppedBackend = $false

if (Test-Path -LiteralPath $StatePath) {
    try {
        $state = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
        
        # Support both legacy (frontend_host_pid/backend_host_pid) and new (frontend_pid/backend_pid) field names
        if ($null -ne $state.frontend_pid) {
            $stoppedFrontend = Stop-ProcessTreeByPid -ProcessId ([int]$state.frontend_pid) -Name "Frontend"
        } elseif ($null -ne $state.frontend_host_pid) {
            $stoppedFrontend = Stop-ProcessTreeByPid -ProcessId ([int]$state.frontend_host_pid) -Name "Frontend"
        }
        
        if ($null -ne $state.backend_pid) {
            $stoppedBackend = Stop-ProcessTreeByPid -ProcessId ([int]$state.backend_pid) -Name "Backend"
        } elseif ($null -ne $state.backend_host_pid) {
            $stoppedBackend = Stop-ProcessTreeByPid -ProcessId ([int]$state.backend_host_pid) -Name "Backend"
        }
        
        if ($null -ne $state.frontend_port) {
            $FrontendPort = [int]$state.frontend_port
        }
        if ($null -ne $state.backend_port) {
            $BackendPort = [int]$state.backend_port
        }
        
        # Log the launch mode if available
        if ($null -ne $state.launch_mode) {
            Write-Info "Service was launched with mode: $($state.launch_mode)"
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
