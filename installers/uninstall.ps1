#Requires -Version 5.1
# For Windows ONLY. On macOS/Linux, run uninstall.sh instead.
# Run from PowerShell: .\uninstall.ps1
# Only removes link entries (SymbolicLink/Junction/HardLink) this repo could
# have created. Never uses -Recurse on a directory link — see
# lib/link-or-copy.ps1's header for why that would delete the real
# repo content through the link instead of just removing the link.
$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
. (Join-Path $ScriptDir 'lib\link-or-copy.ps1')

Write-Host "Removing links created by install.ps1 (seed-once files are left untouched - they've diverged from the repo by design)."

foreach ($entry in Get-MappingEntries -MappingFile (Join-Path $RepoRoot 'mapping.yaml')) {
  if ($entry.Strategy -ne 'symlink') { continue }
  $target = Expand-TargetPath $entry.Target
  if (-not (Test-Path -LiteralPath $target)) { continue }
  $item = Get-Item -LiteralPath $target -Force
  if ($item.LinkType) {
    Write-Host "removing $($item.LinkType.ToLower()) $target"
    Remove-Item -LiteralPath $target -Force   # no -Recurse: see header
  }
}

Write-Host "Done. Any pre-existing content backed up during install is at %USERPROFILE%\.agent-config-backups\<timestamp>\ - restore it manually if needed."
