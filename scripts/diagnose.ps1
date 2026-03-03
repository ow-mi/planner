# diagnose.ps1 - Run this to check your environment
# Usage: diagnose.bat or powershell -File scripts/diagnose.ps1
# Supports PowerShell 5.1+ and PowerShell 7.x

$ErrorActionPreference = "Continue"

function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "=== $Text ===" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Text)
    Write-Host "  [OK] $Text" -ForegroundColor Green
}

function Write-Failure {
    param([string]$Text)
    Write-Host "  [FAIL] $Text" -ForegroundColor Red
}

function Write-InfoItem {
    param([string]$Text)
    Write-Host "  $Text" -ForegroundColor Gray
}

function Write-WarningItem {
    param([string]$Text)
    Write-Host "  [WARN] $Text" -ForegroundColor Yellow
}

function Write-Remediation {
    param([string]$Text)
    Write-Host "        $Text" -ForegroundColor DarkYellow
}

# ============================================
# Windows Diagnostics Functions
# ============================================

function Test-ExecutionPolicyDiagnostic {
    <#
    .SYNOPSIS
    Checks PowerShell execution policies across all scopes with remediation guidance.
    #>
    Write-Header "Execution Policy"
    
    $hasBlockingPolicy = $false
    $recommendations = @()
    
    try {
        # Get all execution policies
        $policies = Get-ExecutionPolicy -List -ErrorAction Stop
        
        foreach ($policy in $policies) {
            $scope = $policy.Scope
            $value = $policy.ExecutionPolicy
            $color = "White"
            $status = ""
            
            switch -Regex ($value) {
                "^(Restricted|Undefined)$" {
                    if ($scope -eq "MachinePolicy" -or $scope -eq "UserPolicy") {
                        # GPO policies are informational
                        $status = "[INFO]"
                        $color = "Gray"
                    } elseif ($scope -eq "Process" -or $scope -eq "CurrentUser") {
                        $status = "[WARN]"
                        $color = "Yellow"
                        if ($value -eq "Restricted") {
                            $hasBlockingPolicy = $true
                            $recommendations += "Run: Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned"
                        }
                    } else {
                        $status = "[WARN]"
                        $color = "Yellow"
                    }
                }
                "^(AllSigned|RemoteSigned|Bypass|Unrestricted)$" {
                    $status = "[OK]"
                    $color = "Green"
                }
                default {
                    $status = "[????]"
                    $color = "Yellow"
                }
            }
            
            Write-Host "  $status $($scope): $value" -ForegroundColor $color
        }
        
        # Check current effective policy
        $currentPolicy = Get-ExecutionPolicy -ErrorAction SilentlyContinue
        Write-Host ""
        Write-InfoItem "Effective policy for current session: $currentPolicy"
        
        if ($currentPolicy -eq "Restricted") {
            Write-Failure "Execution policy is RESTRICTED - scripts cannot run"
            Write-Remediation "Fix: Run 'Set-ExecutionPolicy -Scope CurrentUser RemoteSigned'"
            Write-Remediation "     Or use: powershell -ExecutionPolicy Bypass -File script.ps1"
            return $false
        } elseif ($currentPolicy -eq "AllSigned") {
            Write-WarningItem "Execution policy is ALLSIGNED - all scripts must be signed"
            Write-Remediation "Consider: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned"
            return $true
        } else {
            Write-Success "Execution policy allows script execution"
            return $true
        }
    } catch {
        Write-WarningItem "Could not retrieve execution policies: $($_.Exception.Message)"
        Write-Remediation "Try running with elevated permissions or check GPO settings"
        return $true  # Non-blocking, allow script to continue
    }
}

function Test-LongPathSupport {
    <#
    .SYNOPSIS
    Checks if Windows long path support is enabled (paths > 260 characters).
    #>
    Write-Header "Long Path Support"
    
    $projectPath = Split-Path $PSScriptRoot -Parent
    $pathLength = $projectPath.Length
    
    try {
        $regPath = "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem"
        $longPathEnabled = Get-ItemProperty -Path $regPath -Name "LongPathsEnabled" -ErrorAction Stop
        
        if ($longPathEnabled.LongPathsEnabled -eq 1) {
            Write-Success "Long path support is ENABLED in Windows"
            Write-InfoItem "Registry: $regPath\LongPathsEnabled = 1"
            
            # Check if path is deep
            if ($pathLength -gt 150) {
                Write-WarningItem "Project path is long ($pathLength chars) - consider shorter path"
            }
            return $true
        } else {
            Write-WarningItem "Long path support is DISABLED in Windows"
            Write-InfoItem "Registry: $regPath\LongPathsEnabled = 0"
            Write-InfoItem "Current path length: $pathLength characters"
            
            if ($pathLength -gt 200) {
                Write-Failure "Project path ($pathLength chars) may exceed 260 char limit"
                Write-Remediation "Enable long paths requires ADMIN:"
                Write-Remediation "  1. Open Registry Editor as Admin"
                Write-Remediation "  2. Navigate to: $regPath"
                Write-Remediation "  3. Set LongPathsEnabled = 1"
                Write-Remediation "  OR run as Admin: fsutil behavior set disablepathcachelength 0"
                Write-Remediation "  OR move project to shorter path like C:\dev\planner"
                return $false
            } else {
                Write-WarningItem "Path length is moderate ($pathLength chars) but long paths disabled"
                Write-Remediation "Enable for future safety: Set LongPathsEnabled = 1 (requires Admin)"
                return $true
            }
        }
    } catch {
        # Registry access may fail without admin
        Write-WarningItem "Could not check LongPathsEnabled registry: $($_.Exception.Message)"
        Write-InfoItem "Current path length: $pathLength characters"
        
        if ($pathLength -gt 200) {
            Write-Failure "Project path ($pathLength chars) may exceed Windows 260 char limit"
            Write-Remediation "Consider moving to shorter path like C:\dev\planner"
            return $false
        }
        Write-Remediation "To enable long paths: Run as Admin and set registry LongPathsEnabled = 1"
        return $true
    }
}

function Test-CloudSyncPath {
    <#
    .SYNOPSIS
    Detects if project is in a cloud-synced folder (OneDrive, Dropbox, etc.).
    #>
    Write-Header "Cloud Sync Path Detection"
    
    $projectPath = (Resolve-Path (Split-Path $PSScriptRoot -Parent) -ErrorAction SilentlyContinue).Path
    if (-not $projectPath) {
        $projectPath = Split-Path $PSScriptRoot -Parent
    }
    
    $cloudPatterns = @(
        @{ Name = "OneDrive"; Pattern = "\\OneDrive\\"; Icon = "onedrive" },
        @{ Name = "OneDrive (Personal)"; Pattern = "\\OneDrive -"; Icon = "onedrive" },
        @{ Name = "SharePoint/OneDrive Business"; Pattern = "\\OneDrive for Business\\"; Icon = "sharepoint" },
        @{ Name = "Dropbox"; Pattern = "\\Dropbox\\"; Icon = "dropbox" },
        @{ Name = "Google Drive"; Pattern = "\\Google Drive\\"; Icon = "googledrive" },
        @{ Name = "Google Drive (AppData)"; Pattern = "\\Google\\Drive\\"; Icon = "googledrive" },
        @{ Name = "iCloud"; Pattern = "\\iCloudDrive\\"; Icon = "icloud" },
        @{ Name = "Box"; Pattern = "\\Box\\"; Icon = "box" }
    )
    
    $detectedCloud = $null
    foreach ($cloud in $cloudPatterns) {
        if ($projectPath -match [regex]::Escape($cloud.Pattern) -or 
            $projectPath -match [regex]::Escape($cloud.Pattern) -replace "\\\\", "\\") {
            $detectedCloud = $cloud
            break
        }
    }
    
    if ($detectedCloud) {
        Write-WarningItem "Project is in $($detectedCloud.Name) synced folder"
        Write-InfoItem "Path: $projectPath"
        Write-Host ""
        Write-Host "  [RISK] Cloud-synced folders can cause:" -ForegroundColor Yellow
        Write-Host "         - File locking conflicts during sync" -ForegroundColor Gray
        Write-Host "         - Performance issues with node_modules/.venv" -ForegroundColor Gray
        Write-Host "         - Database corruption (SQLite, .db files)" -ForegroundColor Gray
        Write-Host "         - Real-time sync interfering with file watchers" -ForegroundColor Gray
        Write-Host ""
        Write-Host "  [RECOMMENDATION]" -ForegroundColor Cyan
        Write-Remediation "Move project outside cloud-synced folders:"
        Write-Remediation "  Good: C:\dev\planner_redesign"
        Write-Remediation "  Bad:  C:\Users\name\OneDrive\dev\planner_redesign"
        Write-Remediation ""
        Write-Remediation "Or exclude these folders from sync:"
        Write-Remediation "  - .venv/"
        Write-Remediation "  - node_modules/"
        Write-Remediation "  - .run/"
        Write-Remediation "  - .runlogs/"
        return "WARN"
    } else {
        Write-Success "Project is NOT in a cloud-synced folder"
        Write-InfoItem "Path: $projectPath"
        return "OK"
    }
}

function Test-ProxyConfiguration {
    <#
    .SYNOPSIS
    Checks Windows HTTP proxy configuration that may affect npm, pip, git.
    #>
    Write-Header "Proxy Configuration"
    
    $proxyWarnings = @()
    $proxyInfo = @()
    
    # Check WinHTTP proxy
    try {
        $winhttpProxy = netsh winhttp show proxy 2>&1
        $proxyInfo += "WinHTTP Proxy:"
        foreach ($line in $winhttpProxy) {
            $proxyInfo += "  $line"
        }
        
        if ($winhttpProxy -match "Proxy Server\s*:\s*(.+)") {
            $proxyServer = $Matches[1].Trim()
            if ($proxyServer -and $proxyServer -ne "Direct access") {
                Write-WarningItem "WinHTTP proxy is configured: $proxyServer"
                $proxyWarnings += "npm, pip, git may need proxy configuration"
            } else {
                Write-Success "WinHTTP proxy: Direct access (no proxy)"
            }
        } elseif ($winhttpProxy -match "Direct access") {
            Write-Success "WinHTTP proxy: Direct access (no proxy)"
        } else {
            Write-InfoItem "WinHTTP proxy status unclear"
        }
    } catch {
        Write-InfoItem "Could not check WinHTTP proxy: $($_.Exception.Message)"
    }
    
    # Check environment proxy variables
    $envProxyVars = @(
        "HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy",
        "NO_PROXY", "no_proxy", "FTP_PROXY", "ftp_proxy"
    )
    
    $foundEnvProxies = @()
    foreach ($var in $envProxyVars) {
        $value = [Environment]::GetEnvironmentVariable($var)
        if ($value) {
            $foundEnvProxies += @{ Name = $var; Value = $value }
        }
    }
    
    Write-Host ""
    if ($foundEnvProxies.Count -gt 0) {
        Write-WarningItem "Environment proxy variables detected:"
        foreach ($proxy in $foundEnvProxies) {
            Write-InfoItem "  $($proxy.Name) = $($proxy.Value)"
        }
        $proxyWarnings += "Environment proxies may affect npm/pip/git"
    } else {
        Write-Success "No environment proxy variables set"
    }
    
    # Check IE/Edge proxy settings (machine-wide)
    try {
        $ieProxyPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings"
        $ieSettings = Get-ItemProperty -Path $ieProxyPath -ErrorAction Stop
        
        if ($ieSettings.ProxyEnable -eq 1) {
            Write-WarningItem "IE/Edge system proxy enabled"
            Write-InfoItem "  Proxy Server: $($ieSettings.ProxyServer)"
            if ($ieSettings.ProxyOverride) {
                Write-InfoItem "  Bypass: $($ieSettings.ProxyOverride)"
            }
            $proxyWarnings += "System proxy may intercept HTTP requests"
        } else {
            Write-Success "IE/Edge system proxy: Disabled"
        }
    } catch {
        Write-InfoItem "Could not check IE/Edge proxy settings"
    }
    
    Write-Host ""
    if ($proxyWarnings.Count -gt 0) {
        Write-Host "  [ACTIONS] If network operations fail:" -ForegroundColor Yellow
        foreach ($warning in $proxyWarnings) {
            Write-Remediation "- $warning"
        }
        Write-Remediation ""
        Write-Remediation "npm config set proxy http://proxy:port"
        Write-Remediation "npm config set https-proxy http://proxy:port"
        Write-Remediation "pip config set global.proxy http://proxy:port"
        return "WARN"
    } else {
        return "OK"
    }
}

function Test-FirewallPortReachability {
    <#
    .SYNOPSIS
    Checks if firewall rules might block planned service ports.
    #>
    Write-Header "Firewall and Port Reachability"
    
    $plannedPorts = @(3000, 8000)  # Frontend and Backend ports
    $issues = @()
    
    # Check if we can listen on ports (binding test)
    foreach ($port in $plannedPorts) {
        Write-InfoItem "Checking port $port..."
        
        try {
            # Try to create a listener to test if port is available
            $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
            $listener.Start()
            $listener.Stop()
            Write-Success "Port $port: Available for binding"
        } catch {
            if ($_.Exception.Message -match "access denied|permission|blocked") {
                Write-Failure "Port $port: Access denied (may require admin or firewall rule)"
                $issues += "Port $port access denied - check Windows Firewall"
            } elseif ($_.Exception.Message -match "in use|already") {
                Write-Failure "Port $port: Already in use"
                $issues += "Port $port in use - stop conflicting service"
            } else {
                Write-WarningItem "Port $port: Could not test binding - $($_.Exception.Message)"
            }
        }
    }
    
    # Check firewall status (non-admin may not get details)
    Write-Host ""
    Write-InfoItem "Checking Windows Firewall status..."
    
    try {
        $firewallProfiles = Get-NetFirewallProfile -ErrorAction Stop
        foreach ($profile in $firewallProfiles) {
            $status = if ($profile.Enabled) { "ENABLED" } else { "DISABLED" }
            $color = if ($profile.Enabled) { "Green" } else { "Yellow" }
            Write-Host "  $($profile.Name): $status" -ForegroundColor $color
        }
    } catch {
        # Try alternative method
        try {
            $fwStatus = netsh advfirewall show allprofiles state 2>&1
            Write-InfoItem "Firewall status (via netsh):"
            $fwStatus | Where-Object { $_ -match "State|Profile" } | ForEach-Object {
                Write-Host "    $_" -ForegroundColor Gray
            }
        } catch {
            Write-WarningItem "Cannot check firewall status - may need admin rights"
        }
    }
    
    # Check for loopback exemptions (important for UWP/local development)
    Write-Host ""
    Write-InfoItem "Loopback exemption status (for UWP apps):"
    try {
        $loopback = CheckNetIsolation LoopbackExempt -s 2>&1
        if ($loopback -match "No apps") {
            Write-Success "No loopback restrictions detected"
        } else {
            Write-InfoItem "Some apps have loopback exemptions configured"
        }
    } catch {
        Write-InfoItem "Loopback check not applicable or requires admin"
    }
    
    Write-Host ""
    if ($issues.Count -gt 0) {
        Write-Host "  [REMEDIATION]" -ForegroundColor Yellow
        foreach ($issue in $issues) {
            Write-Remediation "- $issue"
        }
        Write-Remediation ""
        Write-Remediation "Allow app through firewall:"
        Write-Remediation "  Run firewall.cpl > Allow an app through firewall"
        Write-Remediation ""
        Write-Remediation "Or via PowerShell (Admin):"
        Write-Remediation "  New-NetFirewallRule -DisplayName 'PV Planner' -Direction Inbound -LocalPort 8000,3000 -Protocol TCP -Action Allow"
        return "FAIL"
    }
    
    Write-Success "All planned ports are accessible"
    return "OK"
}

function Test-DefenderStatus {
    <#
    .SYNOPSIS
    Checks Windows Defender status with graceful fallback for non-admin.
    #>
    Write-Header "Windows Defender Status"
    
    $defenderInfo = @{}
    
    # Try to get Defender status (requires Win8+/Server2012+)
    try {
        $mpStatus = Get-MpComputerStatus -ErrorAction Stop
        
        $defenderInfo.AntivirusEnabled = $mpStatus.AntivirusEnabled
        $defenderInfo.RealTimeProtectionEnabled = $mpStatus.RealTimeProtectionEnabled
        $defenderInfo.IoavProtectionEnabled = $mpStatus.IoavProtectionEnabled
        $defenderInfo.AntispywareEnabled = $mpStatus.AntispywareEnabled
        
        Write-InfoItem "Antivirus Enabled: $($defenderInfo.AntivirusEnabled)"
        Write-InfoItem "Real-time Protection: $($defenderInfo.RealTimeProtectionEnabled)"
        Write-InfoItem "IOAV Protection: $($defenderInfo.IoavProtectionEnabled)"
        Write-InfoItem "Antispyware: $($defenderInfo.AntispywareEnabled)"
        
        if ($defenderInfo.RealTimeProtectionEnabled) {
            Write-Success "Windows Defender real-time protection is ACTIVE"
            
            # Check for performance impact warnings
            Write-Host ""
            Write-InfoItem "Note: Real-time scanning may slow down:"
            Write-Host "        - npm install / node_modules creation" -ForegroundColor Gray
            Write-Host "        - pip install / .venv creation" -ForegroundColor Gray
            Write-Host "        - File watching in dev mode" -ForegroundColor Gray
            Write-Host ""
            
            # Suggest exclusions for performance
            $projectPath = Split-Path $PSScriptRoot -Parent
            Write-Host "  [PERFORMANCE TIP] Consider excluding for faster dev:" -ForegroundColor Cyan
            Write-Remediation "$projectPath\.venv\"
            Write-Remediation "$projectPath\node_modules\"
            Write-Remediation "$projectPath\.run\"
            Write-Remediation "$projectPath\.runlogs\"
        }
        
        return $defenderInfo
        
    } catch [System.Management.Automation.CommandNotFoundException] {
        Write-WarningItem "Get-MpComputerStatus not available (requires Windows 8+)"
        Write-InfoItem "This is normal on older Windows or non-Windows systems"
        return $null
    } catch [System.UnauthorizedAccessException] {
        Write-WarningItem "Access denied checking Defender status (requires admin)"
        Write-InfoItem "Defender status check skipped"
        return $null
    } catch {
        Write-WarningItem "Could not check Defender status: $($_.Exception.Message)"
        
        # Fallback: Try via WMIC (older method)
        try {
            $avProducts = Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct -ErrorAction Stop
            if ($avProducts) {
                Write-InfoItem "Found antivirus products:"
                foreach ($av in $avProducts) {
                    $state = switch ($av.productState) {
                        { $_ -band 0x1000 } { "Disabled" }
                        { $_ -band 0x2000 } { "Enabled" }
                        default { "Unknown" }
                    }
                    Write-Host "    $($av.displayName): $state" -ForegroundColor Gray
                }
            }
        } catch {
            Write-InfoItem "Could not retrieve antivirus info via WMI either"
        }
        
        return $null
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PV Planner Environment Diagnostics" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. PowerShell version
Write-Header "PowerShell Version"
$psVersion = $PSVersionTable.PSVersion
Write-Host "  Version: $psVersion" -ForegroundColor White
if ($psVersion.Major -ge 5) {
    Write-Success "PowerShell version is compatible (5.1+)"
} else {
    Write-Failure "PowerShell version is too old. Please upgrade to 5.1 or later."
}

# 2. Operating System
Write-Header "Operating System"
try {
    $osInfo = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
    Write-Host "  OS: $($osInfo.Caption)" -ForegroundColor White
    Write-Host "  Version: $($osInfo.Version)" -ForegroundColor White
    Write-Host "  Architecture: $($osInfo.OSArchitecture)" -ForegroundColor White
} catch {
    Write-WarningItem "Could not retrieve OS information: $($_.Exception.Message)"
}

# ========== Windows Diagnostics Section ==========
Write-Host ""
Write-Host "========================================" -ForegroundColor DarkCyan
Write-Host "  Windows Environment Diagnostics" -ForegroundColor DarkCyan
Write-Host "========================================" -ForegroundColor DarkCyan

# 2a. Execution Policy
$executionPolicyOk = Test-ExecutionPolicyDiagnostic

# 2b. Long Path Support
$longPathOk = Test-LongPathSupport

# 2c. Cloud Sync Path Detection
$cloudSyncStatus = Test-CloudSyncPath

# 2d. Proxy Configuration
$proxyStatus = Test-ProxyConfiguration

# 2e. Firewall and Port Reachability
$firewallStatus = Test-FirewallPortReachability

# 2f. Defender Status
$defenderInfo = Test-DefenderStatus

Write-Host ""
Write-Host "========================================" -ForegroundColor DarkCyan
Write-Host "  Application Dependencies" -ForegroundColor DarkCyan
Write-Host "========================================" -ForegroundColor DarkCyan

# 3. Python detection
Write-Header "Python Detection"
$pythonFound = $false
$pythonCandidates = @()

# Check venv
$venvPython = Join-Path $PSScriptRoot "..\.venv\Scripts\python.exe"
if (Test-Path -LiteralPath $venvPython) {
    $resolved = (Resolve-Path $venvPython).Path
    Write-Success "Virtual environment: $resolved"
    $pythonCandidates += $resolved
    $pythonFound = $true
} else {
    Write-InfoItem "Virtual environment: Not found"
}

# Check py launcher
$pyCmd = Get-Command py -ErrorAction SilentlyContinue
if ($null -ne $pyCmd) {
    Write-Success "py launcher: $($pyCmd.Source)"
    try {
        $pyVersion = & py --version 2>&1
        Write-InfoItem "  Version: $pyVersion"
    } catch {}
    $pythonCandidates += $pyCmd.Source
    $pythonFound = $true
} else {
    Write-InfoItem "py launcher: Not found"
}

# Check python
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if ($null -ne $pythonCmd) {
    $alreadyListed = $pythonCandidates | Where-Object { $_ -eq $pythonCmd.Source }
    if (-not $alreadyListed) {
        Write-Success "python in PATH: $($pythonCmd.Source)"
        try {
            $pyVersion = & python --version 2>&1
            Write-InfoItem "  Version: $pyVersion"
        } catch {}
        $pythonCandidates += $pythonCmd.Source
        $pythonFound = $true
    }
} else {
    Write-InfoItem "python in PATH: Not found"
}

# Check python3
$python3Cmd = Get-Command python3 -ErrorAction SilentlyContinue
if ($null -ne $python3Cmd) {
    $alreadyListed = $pythonCandidates | Where-Object { $_ -eq $python3Cmd.Source }
    if (-not $alreadyListed) {
        Write-Success "python3 in PATH: $($python3Cmd.Source)"
        try {
            $pyVersion = & python3 --version 2>&1
            Write-InfoItem "  Version: $pyVersion"
        } catch {}
        $pythonCandidates += $python3Cmd.Source
        $pythonFound = $true
    }
} else {
    Write-InfoItem "python3 in PATH: Not found"
}

# Check common installation paths
$commonPaths = @(
    "${env:LOCALAPPDATA}\Programs\Python\Python3*\python.exe"
    "${env:LOCALAPPDATA}\Programs\Python\Python*\python.exe"
    "${env:ProgramFiles}\Python3*\python.exe"
    "${env:ProgramFiles(x86)}\Python3*\python.exe"
)
foreach ($pattern in $commonPaths) {
    try {
        $found = Get-Item -Path $pattern -ErrorAction SilentlyContinue
        foreach ($item in $found) {
            $alreadyListed = $pythonCandidates | Where-Object { $_ -eq $item.FullName }
            if (-not $alreadyListed) {
                Write-Success "Common path: $($item.FullName)"
                $pythonCandidates += $item.FullName
                $pythonFound = $true
            }
        }
    } catch {}
}

if (-not $pythonFound) {
    Write-Failure "No Python installation found!"
    Write-Host "  Please install Python 3.8+ from https://python.org" -ForegroundColor Yellow
}

# 4. Node.js
Write-Header "Node.js"
try {
    $nodeVersion = node --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Node.js: $nodeVersion"
    } else {
        Write-Failure "Node.js: Not found or error"
    }
} catch {
    Write-Failure "Node.js: Not found"
}

try {
    $npmVersion = npm --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "npm: $npmVersion"
    } else {
        Write-Failure "npm: Not found or error"
    }
} catch {
    Write-Failure "npm: Not found"
}

# 5. Check ports
Write-Header "Port Availability"
$ports = @(3000, 8000)
foreach ($port in $ports) {
    try {
        $ipGlobalProps = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties()
        $listeners = $ipGlobalProps.GetActiveTcpListeners()
        $inUse = $false
        foreach ($listener in $listeners) {
            if ($listener.Port -eq $port) {
                $inUse = $true
                break
            }
        }
        if ($inUse) {
            Write-Failure "Port $port : IN USE"
            # Try to find what's using it
            try {
                $netstatOutput = netstat -ano 2>&1 | Select-String ":$port\s" | Select-String "LISTENING"
                if ($netstatOutput) {
                    foreach ($line in $netstatOutput) {
                        Write-InfoItem "  $line"
                        if ($line -match "\s(\d+)\s*$") {
                            $pid = $Matches[1]
                            try {
                                $proc = Get-Process -Id $pid -ErrorAction Stop
                                Write-WarningItem "  Process using port: $($proc.ProcessName) (PID $pid)"
                            } catch {}
                        }
                    }
                }
            } catch {}
        } else {
            Write-Success "Port $port : Available"
        }
    } catch {
        # Fallback to netstat
        $netstatCheck = netstat -ano 2>&1 | Select-String ":$port\s" | Select-String "LISTENING"
        if ($netstatCheck) {
            Write-Failure "Port $port : IN USE"
        } else {
            Write-Success "Port $port : Available"
        }
    }
}

# 6. Directory structure
Write-Header "Required Directories"
$projectRoot = Split-Path $PSScriptRoot -Parent
$requiredDirs = @(
    @{ Name = "backend"; Path = "backend" },
    @{ Name = "frontend"; Path = "frontend" },
    @{ Name = "scripts"; Path = "scripts" },
    @{ Name = ".venv"; Path = ".venv" },
    @{ Name = "backend/src"; Path = "backend\src" },
    @{ Name = "frontend/deps"; Path = "frontend\deps" }
)

foreach ($dir in $requiredDirs) {
    $fullPath = Join-Path $projectRoot $dir.Path
    if (Test-Path -LiteralPath $fullPath) {
        Write-Success "$($dir.Name): $fullPath"
    } else {
        if ($dir.Name -eq ".venv") {
            Write-WarningItem "$($dir.Name): Not found (run install.bat to create)"
        } elseif ($dir.Name -eq "frontend/deps") {
            Write-WarningItem "$($dir.Name): Not found (run install.bat to download)"
        } else {
            Write-Failure "$($dir.Name): Not found"
        }
    }
}

# 7. Required files
Write-Header "Required Files"
$requiredFiles = @(
    @{ Name = "backend/requirements.txt"; Path = "backend\requirements.txt" },
    @{ Name = "backend/src/api/main.py"; Path = "backend\src\api\main.py" },
    @{ Name = "frontend/index.html"; Path = "frontend\index.html" },
    @{ Name = "start.bat"; Path = "start.bat" },
    @{ Name = "stop.bat"; Path = "stop.bat" },
    @{ Name = "install.bat"; Path = "install.bat" }
)

foreach ($file in $requiredFiles) {
    $fullPath = Join-Path $projectRoot $file.Path
    if (Test-Path -LiteralPath $fullPath) {
        Write-Success "$($file.Name)"
    } else {
        Write-Failure "$($file.Name): Not found"
    }
}

# 8. Python packages (if venv exists)
$venvPythonPath = Join-Path $projectRoot ".venv\Scripts\python.exe"
if (Test-Path -LiteralPath $venvPythonPath) {
    Write-Header "Python Packages (venv)"
    
    $packages = @("uvicorn", "fastapi", "pandas", "pydantic")
    foreach ($pkg in $packages) {
        try {
            $result = & $venvPythonPath -c "import $pkg; print($pkg.__version__)" 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Success "$($pkg): $result"
            } else {
                Write-Failure "$($pkg): Not installed"
            }
        } catch {
            Write-Failure "$($pkg): Not installed"
        }
    }
}

# Summary
Write-Header "Summary"
Write-Host ""

$issues = @()
$warnings = @()

if (-not $pythonFound) {
    $issues += "Python is not installed or not in PATH"
}

$nodeVersion = $null
try { $nodeVersion = node --version 2>&1 } catch {}
if (-not $nodeVersion) {
    $issues += "Node.js is not installed"
}

if (-not (Test-Path -LiteralPath (Join-Path $projectRoot ".venv"))) {
    $issues += "Virtual environment (.venv) not found - run install.bat"
}

if (-not (Test-Path -LiteralPath (Join-Path $projectRoot "frontend\deps"))) {
    $issues += "Frontend dependencies not downloaded - run install.bat"
}

# Collect Windows diagnostic results
if ($executionPolicyOk -eq $false) {
    $issues += "Execution policy is RESTRICTED - cannot run PowerShell scripts"
}

if ($longPathOk -eq $false) {
    $warnings += "Long path support disabled and project path is deep (>200 chars)"
}

if ($cloudSyncStatus -eq "WARN") {
    $warnings += "Project is in a cloud-synced folder - may cause performance/issues"
}

if ($proxyStatus -eq "WARN") {
    $warnings += "Proxy configuration detected - may affect npm/pip/git"
}

if ($firewallStatus -eq "FAIL") {
    $issues += "Firewall or port access issues detected"
}

if ($issues.Count -eq 0) {
    Write-Host "  All critical checks passed!" -ForegroundColor Green
    
    if ($warnings.Count -gt 0) {
        Write-Host ""
        Write-Host "  Warnings (non-blocking):" -ForegroundColor Yellow
        foreach ($warning in $warnings) {
            Write-Host "    - $warning" -ForegroundColor Yellow
        }
    }
    
    Write-Host ""
    Write-Host "  You should be able to run:" -ForegroundColor White
    Write-Host "    start.bat" -ForegroundColor Cyan
} else {
    Write-Host "  Critical issues found:" -ForegroundColor Red
    foreach ($issue in $issues) {
        Write-Host "    - $issue" -ForegroundColor Red
    }
    
    if ($warnings.Count -gt 0) {
        Write-Host ""
        Write-Host "  Additional warnings:" -ForegroundColor Yellow
        foreach ($warning in $warnings) {
            Write-Host "    - $warning" -ForegroundColor Yellow
        }
    }
    
    Write-Host ""
    Write-Host "  Fix these issues and run diagnose.bat again." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  End of Diagnostics" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""