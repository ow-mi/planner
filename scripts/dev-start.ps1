param(
    [ValidateRange(1, 65535)]
    [int]$FrontendPort = 3000,
    [ValidateRange(1, 65535)]
    [int]$BackendPort = 8000,
    [switch]$Headless,
    [switch]$NoInstall,
    [switch]$RestartOnCrash
)

# Support PowerShell 5.1+ and 7.x
if ($PSVersionTable.PSVersion.Major -ge 5) {
    Set-StrictMode -Version 3.0
}
$ErrorActionPreference = "Stop"

# Ensure TLS 1.2 for modern HTTPS connections (required for network operations)
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
} catch {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
}

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

function Write-Telemetry {
    <#
    .SYNOPSIS
    Emits structured telemetry entries for launch decisions and fallback events.
    
    .DESCRIPTION
    Creates consistent, parseable telemetry entries in both log file and console.
    Format: [TELEMETRY] key=value pairs for critical startup decisions.
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$EventName,
        
        [Parameter(Mandatory=$true)]
        [hashtable]$Data
    )
    
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff")
    $dataPairs = @()
    foreach ($key in $Data.Keys) {
        $value = $Data[$key]
        # Escape special characters in values
        $escapedValue = $value -replace '"', '\"'
        if ($value -match '[\s\t"]' -or $value -eq '') {
            $dataPairs += "$key=`"$escapedValue`""
        } else {
            $dataPairs += "$key=$escapedValue"
        }
    }
    $dataString = $dataPairs -join " "
    
    # Write to log
    $logLine = "$timestamp [TELEMETRY] [$EventName] $dataString"
    try {
        Add-Content -Path $StartupLog -Value $logLine -Encoding UTF8
    }
    catch {
        # Best-effort logging
    }
    
    # Write to console with INFO level
    Write-Info "TELEMETRY[$EventName]: $dataString"
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

function Write-SystemInfo {
    Write-Info "=== System Information ==="
    Write-Info "PowerShell Version: $($PSVersionTable.PSVersion)"
    try {
        $osInfo = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
        Write-Info "OS: $($osInfo.Caption)"
    } catch {
        Write-Info "OS: Unable to retrieve OS information"
    }
    try {
        Write-Info "Architecture: $([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture)"
    } catch {
        Write-Info "Architecture: Unable to retrieve architecture information"
    }
    Write-Info "Project Root: $ProjectRoot"
    Write-Info "=========================="
}

# ============================================
# Preflight Checks
# ============================================

function Invoke-PreflightChecks {
    <#
    .SYNOPSIS
    Runs preflight checks before starting services. Returns $true if startup should proceed.
    Fails fast on blockers, warns on non-critical issues.
    #>
    
    $preflightPassed = $true
    $preflightWarnings = @()
    
    Write-Info "Running preflight checks..."
    
    # 1. Execution Policy Check (blocking for Restricted)
    Write-Info "Checking execution policy..."
    try {
        $currentPolicy = Get-ExecutionPolicy -ErrorAction Stop
        if ($currentPolicy -eq "Restricted") {
            Write-Err "EXECUTION POLICY BLOCKER: Current policy is 'Restricted' - scripts cannot run"
            Write-Err "  Remediation: Run 'Set-ExecutionPolicy -Scope CurrentUser RemoteSigned'"
            Write-Err "  Or launch with: powershell -ExecutionPolicy Bypass -File dev-start.ps1"
            $preflightPassed = $false
        } elseif ($currentPolicy -eq "AllSigned") {
            Write-Warn "Execution policy is 'AllSigned' - scripts must be code-signed"
            $preflightWarnings += "AllSigned policy may require script signing"
        } else {
            Write-Info "Execution policy: $currentPolicy (acceptable)"
        }
    } catch {
        Write-Warn "Could not check execution policy: $($_.Exception.Message)"
        $preflightWarnings += "Could not verify execution policy"
    }
    
    # 2. Long Path Support Check (warning-only for deep paths)
    Write-Info "Checking long path support..."
    try {
        $pathLength = $ProjectRoot.Length
        $regPath = "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem"
        $longPathEnabled = Get-ItemProperty -Path $regPath -Name "LongPathsEnabled" -ErrorAction Stop
        
        if ($longPathEnabled.LongPathsEnabled -ne 1 -and $pathLength -gt 200) {
            Write-Warn "LONG PATH RISK: Project path is $pathLength chars and long paths disabled"
            Write-Warn "  Path: $ProjectRoot"
            Write-Warn "  Risk: Files may exceed Windows 260 char limit during build/runtime"
            Write-Warn "  Remediation: Move project to shorter path (e.g., C:\dev\planner)"
            $preflightWarnings += "Long paths disabled with deep project path ($pathLength chars)"
        } elseif ($longPathEnabled.LongPathsEnabled -ne 1) {
            Write-Info "Long paths disabled (path is short enough: $pathLength chars)"
        } else {
            Write-Info "Long path support enabled (path: $pathLength chars)"
        }
    } catch {
        $pathLength = $ProjectRoot.Length
        if ($pathLength -gt 230) {
            Write-Warn "LONG PATH RISK: Could not check long path setting, path is $pathLength chars"
            Write-Warn "  Path: $ProjectRoot"
            Write-Warn "  Risk: Files may exceed Windows 260 char limit"
            $preflightWarnings += "Deep project path ($pathLength chars) - consider relocation"
        } else {
            Write-Info "Could not check long path registry (non-critical)"
        }
    }
    
    # 3. Cloud Sync Path Detection (warning-only)
    Write-Info "Checking for cloud-synced folder..."
    try {
        $resolvedProjectPath = (Resolve-Path $ProjectRoot -ErrorAction Stop).Path
        $cloudPatterns = @(
            "\\OneDrive\\", "\\OneDrive -", "\\OneDrive for Business\\",
            "\\Dropbox\\", "\\Google Drive\\", "\\Google\\Drive\\",
            "\\iCloudDrive\\", "\\Box\\"
        )
        
        $inCloudFolder = $false
        foreach ($pattern in $cloudPatterns) {
            if ($resolvedProjectPath -match [regex]::Escape($pattern)) {
                $inCloudFolder = $true
                break
            }
        }
        
        if ($inCloudFolder) {
            Write-Warn "CLOUD SYNC RISK: Project is in a cloud-synced folder"
            Write-Warn "  Path: $resolvedProjectPath"
            Write-Warn "  Risks: File locking, performance issues with node_modules/.venv"
            Write-Warn "  Remediation: Move outside synced folder or exclude .venv, node_modules"
            $preflightWarnings += "Project is in cloud-synced folder (performance risk)"
        } else {
            Write-Info "Project not in common cloud-synced folder"
        }
    } catch {
        Write-Info "Could not fully verify cloud sync status (non-critical)"
    }
    
    # 4. Proxy Check (warning-only)
    Write-Info "Checking proxy configuration..."
    $proxyConfigured = $false
    try {
        # Check WinHTTP proxy
        $winhttpProxy = netsh winhttp show proxy 2>&1
        if ($winhttpProxy -match "Proxy Server\s*:\s*(.+)" -and $Matches[1].Trim() -ne "Direct access") {
            $proxyConfigured = $true
            Write-Warn "PROXY DETECTED: WinHTTP proxy is configured"
            Write-Warn "  May affect npm install, pip install, git operations"
            $preflightWarnings += "System proxy configured - may affect network operations"
        }
        
        # Check environment proxy variables
        $proxyVars = @("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy")
        foreach ($var in $proxyVars) {
            $value = [Environment]::GetEnvironmentVariable($var)
            if ($value) {
                $proxyConfigured = $true
                Write-Warn "PROXY DETECTED: Environment variable $var is set"
                $preflightWarnings += "Proxy environment variables detected"
                break
            }
        }
        
        if (-not $proxyConfigured) {
            Write-Info "No proxy configuration detected"
        }
    } catch {
        Write-Info "Could not check proxy configuration (non-critical)"
    }
    
    # 5. Port Availability Pre-check (blocking)
    Write-Info "Pre-checking port availability..."
    $portsNeeded = @($FrontendPort, $BackendPort)
    foreach ($port in $portsNeeded) {
        if (Test-PortInUse -Port $port) {
            Write-Warn "Port $port is in use - will find alternative port during startup"
        } else {
            Write-Info "Port $port is available"
        }
    }
    
    # Summary
    Write-Info "Preflight check complete."
    if ($preflightWarnings.Count -gt 0) {
        Write-Warn "Preflight warnings ($($preflightWarnings.Count)):"
        foreach ($warning in $preflightWarnings) {
            Write-Warn "  - $warning"
        }
    }
    
    return $preflightPassed
}

function Ensure-Dir([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

function Test-PythonWorks {
    param([string]$PythonPath)
    
    try {
        $result = & $PythonPath -c "import sys; print(sys.version)" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Info "Python validated: $PythonPath"
            Write-DebugBlock -Header "Python version" -Content $result
            Write-Telemetry -EventName "python_selected" -Data @{
                selected_python_path = $PythonPath
                validation_method = "version_check"
            }
            return $true
        }
    } catch {
        Write-Warn "Python validation failed for $PythonPath : $($_.Exception.Message)"
    }
    return $false
}

function Get-PythonCandidates {
    $candidates = [System.Collections.Generic.List[string]]::new()
    
    # Method 1: Virtual environment (preferred)
    $venvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
    if (Test-Path -LiteralPath $venvPython) {
        $candidates.Add($venvPython)
        Write-Info "Found: venv python at $venvPython"
    } else {
        Write-Warn "Not found: venv python at $venvPython"
    }
    
    # Method 2: py.exe launcher (Windows recommended)
    $pyLauncher = Get-Command py -ErrorAction SilentlyContinue
    if ($null -ne $pyLauncher) {
        $pyPath = $pyLauncher.Source
        if (-not $candidates.Contains($pyPath)) {
            $candidates.Add($pyPath)
            Write-Info "Found: py launcher at $pyPath"
        }
    } else {
        Write-Warn "Not found: py launcher"
    }
    
    # Method 3: python.exe in PATH
    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if ($null -ne $pythonCmd) {
        $pyPath = $pythonCmd.Source
        if (-not $candidates.Contains($pyPath)) {
            $candidates.Add($pyPath)
            Write-Info "Found: python in PATH at $pyPath"
        }
    } else {
        Write-Warn "Not found: python in PATH"
    }
    
    # Method 4: python3.exe in PATH
    $python3Cmd = Get-Command python3 -ErrorAction SilentlyContinue
    if ($null -ne $python3Cmd) {
        $pyPath = $python3Cmd.Source
        if (-not $candidates.Contains($pyPath)) {
            $candidates.Add($pyPath)
            Write-Info "Found: python3 in PATH at $pyPath"
        }
    }
    
    # Method 5: Common installation paths on Windows
    $commonPaths = @(
        "${env:LOCALAPPDATA}\Programs\Python\Python3*\python.exe"
        "${env:LOCALAPPDATA}\Programs\Python\Python*\python.exe"
        "${env:ProgramFiles}\Python3*\python.exe"
        "${env:ProgramFiles(x86)}\Python3*\python.exe"
    )
    foreach ($pattern in $commonPaths) {
        try {
            $found = Get-Item -Path $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($null -ne $found -and -not $candidates.Contains($found.FullName)) {
                $candidates.Add($found.FullName)
                Write-Info "Found: python at $($found.FullName) (from common path)"
            }
        } catch {
            # Ignore errors from path expansion
        }
    }
    
    if ($candidates.Count -eq 0) {
        Write-Err "No Python installations found. Please install Python 3.8+ from python.org"
    } else {
        Write-Info "Found $($candidates.Count) Python candidate(s)"
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
    # Locale-independent port checking using .NET API
    $script:PortCheckMethod = "dotnet"
    try {
        $ipGlobalProps = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties()
        $listeners = $ipGlobalProps.GetActiveTcpListeners()
        foreach ($listener in $listeners) {
            if ($listener.Port -eq $Port) {
                return $true
            }
        }
        return $false
    } catch {
        # Fallback to netstat if .NET method fails
        $script:PortCheckMethod = "netstat_fallback"
        Write-Warn "Port check falling back to netstat for port $Port"
        Write-Telemetry -EventName "port_check_fallback" -Data @{
            port = $Port
            method = "netstat"
            reason = "dotnet_api_failed"
        }
        $matches = @(netstat -ano | Select-String -Pattern "LISTENING" | Select-String -Pattern "[:\.]$Port\s")
        return ($matches.Count -gt 0)
    }
}

function Find-AvailablePort {
    param(
        [int]$PreferredPort,
        [int]$MaxAttempts = 200,
        [string]$Label = "Service"
    )

    # Validate PreferredPort is within valid TCP port range
    if ($PreferredPort -lt 1 -or $PreferredPort -gt 65535) {
        throw "$Label port $PreferredPort is invalid. Port must be in range 1-65535."
    }

    $candidate = $PreferredPort
    for ($i = 0; $i -lt $MaxAttempts; $i++) {
        if (-not (Test-PortInUse -Port $candidate)) {
            if ($candidate -ne $PreferredPort) {
                Write-Warn "$Label requested port $PreferredPort is unavailable; using fallback port $candidate."
                Write-Telemetry -EventName "port_conflict_resolution" -Data @{
                    service = $Label
                    requested_port = $PreferredPort
                    resolved_port = $candidate
                    port_check_method = $script:PortCheckMethod
                }
            }
            return $candidate
        }

        if ($i -eq 0) {
            Write-PortDiagnostics -Port $PreferredPort -Label "$Label port pre-check"
        }
        $candidate++

        # Prevent overflow beyond max TCP port
        if ($candidate -gt 65535) {
            throw "$Label could not find a free port. Search reached maximum valid port 65535 starting from $PreferredPort."
        }
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

function Start-BackgroundProcess {
    <#
    .SYNOPSIS
    Starts a background child process with detached log file redirection.

    .DESCRIPTION
    Launches a process via CMD.exe with output redirection to log files.
    Child processes write directly to log files, decoupling logging from
    parent process lifetime. Uses CreateNoWindow=true for single-window UX.

    .OUTPUTS
    System.Diagnostics.Process - The started process object with Id property.
        Note: Returns the CMD wrapper process, not the direct child.
    #>
    param(
        [string]$Name,
        [string]$WorkDir,
        [string]$CommandExe,
        [string[]]$CommandArgs,
        [string]$LogPath
    )

    # Validate executable exists before launching
    if (-not (Test-Path -LiteralPath $CommandExe)) {
        throw "$Name executable not found at: $CommandExe"
    }

    # Validate working directory
    if (-not (Test-Path -LiteralPath $WorkDir)) {
        throw "$Name working directory not found: $WorkDir"
    }

    # Ensure log directory exists and initialize log file
    $logDir = Split-Path -Parent $LogPath
    if (-not (Test-Path -LiteralPath $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }

    # Quote arguments safely for Windows command line
    # Rules: 1) Quote if contains spaces, tabs, or special chars
    #        2) Escape internal quotes by doubling them
    $quotedArgs = ($CommandArgs | ForEach-Object {
        if ([string]::IsNullOrWhiteSpace($_)) {
            '""'
        }
        elseif ($_ -match '[\s\t"''`(){}\[\]&|^<>]') {
            # Escape double quotes by doubling them, then wrap in quotes
            $escaped = $_ -replace '"', '""'
            "`"$escaped`""
        }
        else {
            $_
        }
    }) -join ' '

    # Initialize log file with startup header
    $initStamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss.fff')
    # Escape the command for display (not for execution)
    $displayArgs = $quotedArgs -replace '\$\([^)]+\)', '<subexpr>'
    $initHeader = @"
==== $Name log initialized $initStamp ====
launch_mode=single_orchestrator
service_name=$Name
working_directory=$WorkDir
executable=$CommandExe
arguments=$displayArgs
"@
    Set-Content -Path $LogPath -Value $initHeader -Encoding UTF8

    # Log process metadata
    Write-Info "$Name working directory: $WorkDir"
    Write-Info "$Name executable: $CommandExe"
    Write-Info "$Name args: $displayArgs"
    Write-DebugBlock -Header "$Name process metadata" -Content @"
launch_mode: single_orchestrator
working_directory: $WorkDir
executable: $CommandExe
arguments: $displayArgs
log_path: $LogPath
"@

    # Build the full command with CMD-based redirection
    # The child process writes directly to log file (not through parent pipes)
    # Using: cmd /c "executable args >> "logpath" 2>&1"
    # 
    # For paths with spaces, we use the "call" trick and proper quoting:
    # - Quote the executable path if it contains spaces
    # - Always quote the log path for robustness
    # - Use "call" to ensure quoted executables work correctly
    $needsExeQuote = $CommandExe -match '[\s\t"]'
    $quotedExe = if ($needsExeQuote) { "`"$CommandExe`"" } else { $CommandExe }
    $quotedLog = "`"$LogPath`""
    
    $fullCommand = "$quotedExe $quotedArgs"
    $redirectTo = "$quotedLog"
    
    $cmdExe = "${env:ComSpec}"
    if ($needsExeQuote) {
        # Use "call" to handle quoted executable paths
        $cmdArgs = "/c `"call $fullCommand >> $redirectTo 2>&1`""
    }
    else {
        $cmdArgs = "/c `"$fullCommand >> $redirectTo 2>&1`""
    }

    # Create ProcessStartInfo for background process
    # No stream redirection - CMD handles file writes directly
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $cmdExe
    $startInfo.Arguments = $cmdArgs
    $startInfo.WorkingDirectory = $WorkDir
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $false
    $startInfo.RedirectStandardError = $false
    $startInfo.RedirectStandardInput = $false

    # Set environment variable to indicate orchestrator mode
    $startInfo.EnvironmentVariables['PLANNER_LAUNCH_MODE'] = 'single_orchestrator'
    $startInfo.EnvironmentVariables['PLANNER_SERVICE_NAME'] = $Name

    # Create the process object
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $startInfo

    # Start the process (no event subscriptions needed - child writes directly to log)
    try {
        $null = $process.Start()
    }
    catch {
        throw "Failed to start $Name process: $($_.Exception.Message)"
    }

    if ($null -eq $process -or $process.Id -le 0) {
        throw "Failed to launch $Name process - invalid process ID."
    }

    # Brief wait to check for immediate exit (CMD wrapper exits quickly if child fails)
    Start-Sleep -Milliseconds 300
    $process.Refresh()
    if ($process.HasExited) {
        $exitCode = $process.ExitCode
        $tail = Get-LogTail -Path $LogPath -LineCount 40
        throw "$Name process exited immediately (PID $($process.Id), exit code $exitCode). Log tail:`n$tail"
    }

    Write-Info "$Name process started with PID $($process.Id)."
    Write-ProcessSnapshot -ProcessId $process.Id -Label "$Name process"

    return $process
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

function Invoke-Watchdog {
    <#
    .SYNOPSIS
    Optional watchdog mode to restart crashed services during startup window.
    
    .DESCRIPTION
    When -RestartOnCrash is enabled, monitors child processes and attempts
    up to 2 restarts with exponential backoff if they crash during the
    startup monitoring period.
    
    .OUTPUTS
    Returns the Process object if healthy or successfully restarted, $null on failure.
    #>
    param(
        [System.Diagnostics.Process]$Process,
        [string]$Name,
        [string]$WorkDir,
        [string]$CommandExe,
        [string[]]$CommandArgs,
        [string]$LogPath,
        [int]$MaxRetries = 2,
        [int]$StartupWindowMs = 30000
    )
    
    if ($null -eq $Process) {
        return $null
    }
    
    $retries = 0
    $startTime = Get-Date
    $backoffMs = 1000  # Start with 1 second backoff
    $currentProcess = $Process
    
    while (((Get-Date) - $startTime).TotalMilliseconds -lt $StartupWindowMs) {
        Start-Sleep -Milliseconds 500
        $currentProcess.Refresh()
        
        if (-not $currentProcess.HasExited) {
            # Process still running, continue monitoring
            continue
        }
        
        # Process has exited - check if we should restart
        if ($retries -ge $MaxRetries) {
            Write-Err "$Name crashed and max retries ($MaxRetries) exceeded."
            Write-Telemetry -EventName "watchdog_failure" -Data @{
                service = $Name
                retries = $retries
                max_retries = $MaxRetries
                exit_code = $currentProcess.ExitCode
            }
            return $null
        }
        
        $retries++
        Write-Warn "$Name crashed (exit code $($currentProcess.ExitCode)). Restarting (attempt $retries/$MaxRetries)..."
        Write-Telemetry -EventName "watchdog_restart" -Data @{
            service = $Name
            attempt = $retries
            max_retries = $MaxRetries
            exit_code = $currentProcess.ExitCode
            backoff_ms = $backoffMs
        }
        
        # Wait before restart with exponential backoff
        Start-Sleep -Milliseconds $backoffMs
        $backoffMs = [Math]::Min($backoffMs * 2, 10000)  # Cap at 10 seconds
        
        try {
            $currentProcess = Start-BackgroundProcess -Name $Name -WorkDir $WorkDir -CommandExe $CommandExe -CommandArgs $CommandArgs -LogPath $LogPath
            Write-Info "$Name restarted successfully with new PID $($currentProcess.Id)."
        }
        catch {
            Write-Err "Failed to restart $Name': $($_.Exception.Message)"
            if ($retries -ge $MaxRetries) {
                return $null
            }
        }
    }
    
    return $currentProcess
}

# ============================================
# Main Script Execution
# ============================================

Ensure-Dir -Path $RunDir
Ensure-Dir -Path $LogDir
Set-Content -Path $StartupLog -Encoding UTF8 -Value @(
    "==== Planner startup log ====",
    "Started: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss.fff'))",
    "ProjectRoot: $ProjectRoot",
    "Args: FrontendPort=$FrontendPort BackendPort=$BackendPort Headless=$Headless NoInstall=$NoInstall RestartOnCrash=$RestartOnCrash",
    ""
)
Write-Info "Startup log initialized at: $StartupLog"
Write-Info "Run directory: $RunDir"
Write-Info "Log directory: $LogDir"
Write-Info "Frontend log: $FrontendLog"
Write-Info "Backend log: $BackendLog"

# Display system information for diagnostics
Write-SystemInfo

# Run preflight checks (fail fast on blockers)
if (-not (Invoke-PreflightChecks)) {
    Write-Err "Preflight checks failed. See above for remediation steps."
    Write-Err "Run diagnose.bat for full environment diagnostics."
    exit 1
}

# Find Python installations
$pythonCandidates = Get-PythonCandidates
if ($pythonCandidates.Count -eq 0) {
    Write-Err "Python was not found. Please install Python 3.8+ from python.org"
    Write-Err "Run diagnose.bat for environment diagnostics."
    throw "Python not found in any location."
}

# Select the best Python candidate
$pythonExe = $null
foreach ($candidate in $pythonCandidates) {
    if (Test-PythonWorks -PythonPath $candidate) {
        $pythonExe = $candidate
        break
    }
}

if ($null -eq $pythonExe) {
    $pythonExe = $pythonCandidates[0]
    Write-Warn "Using first Python candidate without full validation: $pythonExe"
}

Write-Info "Selected Python command: $pythonExe"

# Check uvicorn availability and select Python with uvicorn if available
if (-not (Test-UvicornAvailable -PythonCommand $pythonExe)) {
    foreach ($candidate in $pythonCandidates) {
        if ($candidate -ne $pythonExe -and (Test-UvicornAvailable -PythonCommand $candidate)) {
            $pythonExe = $candidate
            Write-Info "Switching to Python with uvicorn: $pythonExe"
            break
        }
    }
}

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

    # Log launch mode telemetry
    Write-Info "launch_mode=single_orchestrator"
    Write-Telemetry -EventName "launch_mode" -Data @{
        mode = "single_orchestrator"
        description = "Services launched via CMD.exe with direct file redirection"
        watchdog_enabled = $RestartOnCrash.IsPresent
        python_path = $pythonExe
        frontend_port_requested = $FrontendPort
        backend_port_requested = $BackendPort
    }
    Write-DebugBlock -Header "Launch mode configuration" -Content @"
launch_mode: single_orchestrator
description: Services launched via CMD.exe with direct file redirection
window_strategy: No additional PowerShell windows created
output_redirection: Child writes directly to log files via CMD (detached from parent lifetime)
process_model: CMD wrapper with CreateNoWindow=true, Python child spawned underneath
watchdog_enabled: $($RestartOnCrash.IsPresent)
"@

    Write-Info "Starting frontend on port $resolvedFrontendPort..."
    $frontendProcess = Start-BackgroundProcess -Name "Frontend" -WorkDir (Join-Path $ProjectRoot "frontend") -CommandExe $frontendExe -CommandArgs $frontendArgs -LogPath $FrontendLog

    # Invoke watchdog for startup monitoring if RestartOnCrash is enabled
    if ($RestartOnCrash) {
        Write-Info "Invoking watchdog for Frontend startup monitoring (RestartOnCrash enabled)..."
        $watchdogResult = Invoke-Watchdog -Process $frontendProcess -Name "Frontend" -WorkDir (Join-Path $ProjectRoot "frontend") -CommandExe $frontendExe -CommandArgs $frontendArgs -LogPath $FrontendLog -MaxRetries 2 -StartupWindowMs 25000
        if ($null -eq $watchdogResult) {
            Write-Err "Frontend crashed during startup and could not be restarted."
            Write-Warn "Frontend log tail:`n$(Get-LogTail -Path $FrontendLog -LineCount 80)"
            throw "Frontend watchdog failed. See $FrontendLog"
        }
        $frontendProcess = $watchdogResult
    } else {
        if (-not (Wait-PortOpen -Port $resolvedFrontendPort -TimeoutSeconds 25)) {
            Write-PortDiagnostics -Port $resolvedFrontendPort -Label "Frontend startup failure"
            Write-Warn "Frontend log tail:`n$(Get-LogTail -Path $FrontendLog -LineCount 80)"
            throw "Frontend did not open port $resolvedFrontendPort. See $FrontendLog"
        }
        if (-not (Wait-HttpOk -Url "http://localhost:$resolvedFrontendPort" -TimeoutSeconds 15)) {
            Write-Warn "Frontend HTTP check failed; frontend log tail:`n$(Get-LogTail -Path $FrontendLog -LineCount 80)"
            throw "Frontend HTTP endpoint did not respond in time. See $FrontendLog"
        }
    }
    Write-Ok "Frontend is listening on port $resolvedFrontendPort (PID $($frontendProcess.Id))."

    Write-Info "Starting backend on port $resolvedBackendPort..."
    $backendProcess = Start-BackgroundProcess -Name "Backend" -WorkDir $ProjectRoot -CommandExe $backendExe -CommandArgs $backendArgs -LogPath $BackendLog

    # Invoke watchdog for startup monitoring if RestartOnCrash is enabled
    if ($RestartOnCrash) {
        Write-Info "Invoking watchdog for Backend startup monitoring (RestartOnCrash enabled)..."
        $watchdogResult = Invoke-Watchdog -Process $backendProcess -Name "Backend" -WorkDir $ProjectRoot -CommandExe $backendExe -CommandArgs $backendArgs -LogPath $BackendLog -MaxRetries 2 -StartupWindowMs 30000
        if ($null -eq $watchdogResult) {
            Write-Err "Backend crashed during startup and could not be restarted."
            Write-Warn "Backend log tail:`n$(Get-LogTail -Path $BackendLog -LineCount 80)"
            throw "Backend watchdog failed. See $BackendLog"
        }
        $backendProcess = $watchdogResult
    } else {
        if (-not (Wait-PortOpen -Port $resolvedBackendPort -TimeoutSeconds 30)) {
            Write-PortDiagnostics -Port $resolvedBackendPort -Label "Backend startup failure"
            Write-Warn "Backend log tail:`n$(Get-LogTail -Path $BackendLog -LineCount 80)"
            throw "Backend did not open port $resolvedBackendPort. See $BackendLog"
        }
        if (-not (Wait-HttpOk -Url "http://localhost:$resolvedBackendPort/api/health" -TimeoutSeconds 30)) {
            Write-Warn "Backend health check failed; backend log tail:`n$(Get-LogTail -Path $BackendLog -LineCount 80)"
            throw "Backend health endpoint did not respond in time. See $BackendLog"
        }
    }
    Write-Ok "Backend is healthy on port $resolvedBackendPort (PID $($backendProcess.Id))."

    $state = [ordered]@{
        started_at        = (Get-Date).ToString("s")
        frontend_port     = $resolvedFrontendPort
        backend_port      = $resolvedBackendPort
        frontend_pid      = $frontendProcess.Id
        backend_pid       = $backendProcess.Id
        frontend_log      = $FrontendLog
        backend_log       = $BackendLog
        launch_mode       = "single_orchestrator"
        mode              = "background"
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
    Write-Err ""
    Write-Err "Run diagnose.bat to check your environment."
    exit 1
}