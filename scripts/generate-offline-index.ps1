# scripts/generate-offline-index.ps1
# Generates offline-capable index.html with inlined dependencies
# Extracted from install.bat for maintainability
#
# IMPORTANT: Version-agnostic esm.sh URLs are used below. These will match
# whatever versions are installed via npm (defined in install.bat's package.json).
# Do not add version-specific URLs here to avoid version mismatch issues.

param(
    [string]$ProjectRoot
)

$ErrorActionPreference = "Stop"

# Navigate to frontend directory
$FrontendDir = Join-Path $ProjectRoot "frontend"
Set-Location $FrontendDir

Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Generating offline index from: $FrontendDir"

# Read the online template
$OnlineIndex = Join-Path $FrontendDir "index-online.html"
if (-not (Test-Path $OnlineIndex)) {
    Write-Error "index-online.html not found at: $OnlineIndex"
    exit 1
}

$Content = Get-Content -Raw $OnlineIndex

# Define all URL-to-local replacements
# NOTE: esm.sh URLs are version-agnostic to match whatever npm installs
$Replacements = @{
    # External CDN dependencies (downloaded to deps/)
    'https://unpkg.com/htmx.org@2.0.0' = './deps/htmx.min.js'
    'https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js' = './deps/alpinejs.min.js'
    'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js' = './deps/jszip.min.js'
    'https://d3js.org/d3.v7.min.js' = './deps/d3.v7.min.js'
    'https://cdn.jsdelivr.net/npm/papaparse@5.3.2/papaparse.min.js' = './deps/papaparse.min.js'
    'https://cdn.tailwindcss.com' = './deps/tailwindcss.js'
    'https://cdn.jsdelivr.net/npm/daisyui@4.10.1/dist/full.min.css' = './deps/daisyui.css'
    
    # CodeMirror modules (installed via npm) - version-agnostic URLs
    'https://esm.sh/@codemirror/view?external=*' = './node_modules/@codemirror/view/dist/index.js'
    'https://esm.sh/@codemirror/state?external=*' = './node_modules/@codemirror/state/dist/index.js'
    'https://esm.sh/@codemirror/language?external=*' = './node_modules/@codemirror/language/dist/index.js'
    'https://esm.sh/@codemirror/commands?external=*' = './node_modules/@codemirror/commands/dist/index.js'
    'https://esm.sh/@codemirror/search?external=*' = './node_modules/@codemirror/search/dist/index.js'
    'https://esm.sh/@codemirror/autocomplete?external=*' = './node_modules/@codemirror/autocomplete/dist/index.js'
    'https://esm.sh/@codemirror/lint?external=*' = './node_modules/@codemirror/lint/dist/index.js'
    'https://esm.sh/@codemirror/lang-javascript?external=*' = './node_modules/@codemirror/lang-javascript/dist/index.js'
    'https://esm.sh/@codemirror/theme-one-dark?external=*' = './node_modules/@codemirror/theme-one-dark/dist/index.js'
    
    # Lezer parser dependencies (installed via npm) - version-agnostic URLs
    'https://esm.sh/@lezer/common?external=*' = './node_modules/@lezer/common/dist/index.js'
    'https://esm.sh/@lezer/highlight?external=*' = './node_modules/@lezer/highlight/dist/index.js'
    'https://esm.sh/@lezer/lr?external=*' = './node_modules/@lezer/lr/dist/index.js'
    'https://esm.sh/@lezer/javascript?external=*' = './node_modules/@lezer/javascript/dist/index.js'
    
    # Other npm dependencies - version-agnostic URLs
    'https://esm.sh/crelt?external=*' = './node_modules/crelt/index.js'
    'https://esm.sh/style-mod?external=*' = './node_modules/style-mod/src/style-mod.js'
    'https://esm.sh/w3c-keyname?external=*' = './node_modules/w3c-keyname/index.js'
    'https://esm.sh/@marijn/find-cluster-break?external=*' = './node_modules/@marijn/find-cluster-break/dist/index.js'
}

# Apply all replacements
$MissingFiles = @()
foreach ($Url in $Replacements.Keys) {
    $LocalPath = $Replacements[$Url]
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Replacing: $Url -> $LocalPath"
    $Content = $Content.Replace($Url, $LocalPath)
    
    # Track missing files for validation (skip deps/ as they're downloaded separately)
    if ($LocalPath -notmatch '^\./deps/') {
        $FullPath = Join-Path $FrontendDir $LocalPath.Substring(2)  # Remove './' prefix
        if (-not (Test-Path $FullPath)) {
            $MissingFiles += $LocalPath
        }
    }
}

# Validate that all npm-installed files exist
if ($MissingFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "[WARNING] The following npm module files are missing:" -ForegroundColor Yellow
    foreach ($File in $MissingFiles) {
        Write-Host "  - $File" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "This may indicate npm install did not complete successfully," -ForegroundColor Yellow
    Write-Host "or the package.json dependencies need to be updated." -ForegroundColor Yellow
    Write-Host ""
    # Continue anyway - the installed versions might use different paths
}

# Write the offline index
$OfflineIndex = Join-Path $FrontendDir "index.html"
Set-Content -Path $OfflineIndex -Value $Content -Encoding UTF8

Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Successfully generated: $OfflineIndex"
exit 0