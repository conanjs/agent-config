#Requires -Version 5.1
# For Windows ONLY. On macOS/Linux, run install.sh instead (this file is
# PowerShell syntax; bash can't execute it, and vice versa — never run both).
# Run from PowerShell: .\install.ps1
$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
. (Join-Path $ScriptDir 'lib\link-or-copy.ps1')

Write-Host "Installing agent-config from $RepoRoot (Windows)"
Invoke-Mapping -MappingFile (Join-Path $RepoRoot 'mapping.yaml')
Write-Host "Done."
