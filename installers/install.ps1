#Requires -Version 5.1
# For Windows ONLY. On macOS/Linux, run install.sh instead (this file is
# PowerShell syntax; bash can't execute it, and vice versa — never run both).
# Run from PowerShell: .\install.ps1
$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
. (Join-Path $ScriptDir 'lib\link-or-copy.ps1')

Write-Host "Installing agent-config from $RepoRoot (Windows)"
# An old install linked the whole ~/.copilot/frameworks folder to this repo; it is now one link per framework.
$fw = Join-Path $env:USERPROFILE '.copilot\frameworks'
if ((Test-Path -LiteralPath $fw) -and (Get-Item -LiteralPath $fw -Force).LinkType) { [IO.Directory]::Delete($fw) }
Invoke-Mapping -MappingFile (Join-Path $RepoRoot 'mapping.yaml')
# Skills and agents: built per coding agent from skills/ and agents/ sources, then linked entry by entry.
$build = Join-Path $RepoRoot 'scripts\build.mjs'
if (Test-Path -LiteralPath $build) {
  node $build --link
  if ($LASTEXITCODE -ne 0) { throw "scripts/build.mjs failed ($LASTEXITCODE)" }
}
Write-Host "Done."
