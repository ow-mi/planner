$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
$ErrorActionPreference = 'Continue'
Set-Location -LiteralPath 'C:\Users\x3092808\adslkfjalsdkjfl;adsj\ok_lets_hope_that_this_works\planner'
Write-Host "Working directory: C:\Users\x3092808\adslkfjalsdkjfl;adsj\ok_lets_hope_that_this_works\planner"
$cmd = @'
& 'C:\Program Files\Python310\python.exe' -m uvicorn backend.src.api.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir backend/src
'@
Write-Host ("Command: {0}" -f $cmd.Trim())
Invoke-Expression $cmd 2>&1 | Tee-Object -FilePath 'C:\Users\x3092808\adslkfjalsdkjfl;adsj\ok_lets_hope_that_this_works\planner\.runlogs\backend.log' -Append
if ($LASTEXITCODE -ne 0) {
    Write-Host "Process exited with code $LASTEXITCODE." -ForegroundColor Red
    exit $LASTEXITCODE
}
