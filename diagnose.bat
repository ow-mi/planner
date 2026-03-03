@echo off
:: ===================================
:: PV Planner - Environment Diagnostics
:: ===================================

echo Running Planner Environment Diagnostics...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\diagnose.ps1" %*

echo.
pause