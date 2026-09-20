#Requires -Version 5.1
# Core "place this repo file at that destination path" primitives for Windows.
# Dot-sourced by install.ps1 / uninstall.ps1. Callers must set $RepoRoot first.
#
# Windows specifics this file exists to handle (see README "Windows notes"):
#  - New-Item -ItemType SymbolicLink needs admin OR Developer Mode. When it
#    fails, we fall back to a Junction (directories) or a HardLink (files) —
#    neither needs elevation, but both have caveats documented in README.
#  - Remove-Item -Recurse on a symlink/junction DIRECTORY follows the link and
#    deletes the real target's contents. Verified via PowerShell/PowerShell
#    issue #621 and community writeups (see README References). We NEVER pass
#    -Recurse when removing a link in this file.

function Expand-TargetPath {
  param([string]$Target)
  $t = $Target
  if ($t.StartsWith('~/')) {
    $t = Join-Path $env:USERPROFILE ($t.Substring(2))
  }
  return ($t -replace '/', '\')
}

function Resolve-SourcePath {
  param([string]$RepoRoot, [string]$SourceRel)
  $rel = $SourceRel -replace '/', '\'
  return (Join-Path $RepoRoot $rel)
}

function Test-AlreadyLinkedCorrectly {
  param([string]$Target, [string]$ExpectedSource)
  if (-not (Test-Path -LiteralPath $Target)) { return $false }
  $item = Get-Item -LiteralPath $Target -Force -ErrorAction SilentlyContinue
  if (-not $item) { return $false }
  if (-not $item.LinkType) { return $false } # real file/dir, not a link we created
  if ($item.Target) {
    # .Target is normally populated for SymbolicLink; sometimes unreliable for
    # Junction/HardLink on older PowerShell — fall back to "it's some kind of
    # link already" below when it's empty, rather than claim a false match.
    $actual = $item.Target | Select-Object -First 1
    return ($actual -eq $ExpectedSource)
  }
  return $true
}

# All backups from one install run land under one timestamped folder, mirroring
# each entry's mapping.yaml Source path — e.g. a link at ~/.claude/CLAUDE.md
# gets backed up to $script:BackupRoot\claude\CLAUDE.md, not a scattered sibling
# ~/.claude/CLAUDE.md.backup-<ts>. Created lazily: only the first actual backup
# in a run creates the folder, so a clean run creates nothing.
$script:BackupRoot = $null
function Get-BackupRoot {
  if (-not $script:BackupRoot) {
    $script:BackupRoot = Join-Path $env:USERPROFILE ".agent-config-backups\$(Get-Date -Format yyyyMMddHHmmss)"
  }
  return $script:BackupRoot
}

function Backup-IfExists {
  param([string]$Target, [string]$ExpectedSource, [string]$SourceRel)
  if (Test-AlreadyLinkedCorrectly -Target $Target -ExpectedSource $ExpectedSource) {
    return $false # already correct, nothing to do
  }
  if (Test-Path -LiteralPath $Target) {
    $item = Get-Item -LiteralPath $Target -Force
    if ($item.LinkType) {
      # a link, but pointing somewhere else / unverifiable — remove the link
      # entry only (never -Recurse: see file header).
      Remove-Item -LiteralPath $Target -Force
    } else {
      $dest = Join-Path (Get-BackupRoot) ($SourceRel -replace '/', '\')
      $destParent = Split-Path $dest -Parent
      if (-not (Test-Path -LiteralPath $destParent)) { New-Item -ItemType Directory -Path $destParent -Force | Out-Null }
      Write-Host "  existing content at $Target -> backing up to $dest"
      Move-Item -LiteralPath $Target -Destination $dest -Force
    }
  }
  return $true
}

function New-LinkWithFallback {
  param([string]$Target, [string]$SourceAbs)
  $parent = Split-Path $Target -Parent
  if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }

  $isDir = Test-Path -LiteralPath $SourceAbs -PathType Container
  try {
    New-Item -ItemType SymbolicLink -Path $Target -Target $SourceAbs -ErrorAction Stop | Out-Null
    Write-Host "  symlinked $Target -> $SourceAbs"
    return
  } catch {
    Write-Host "  symlink failed ($($_.Exception.Message.Trim())) - falling back (no admin / Developer Mode?)"
  }

  if ($isDir) {
    New-Item -ItemType Junction -Path $Target -Target $SourceAbs | Out-Null
    Write-Host "  created JUNCTION $Target -> $SourceAbs (fallback, no elevation needed)"
  } else {
    New-Item -ItemType HardLink -Path $Target -Target $SourceAbs | Out-Null
    Write-Host "  created HARD LINK $Target -> $SourceAbs (fallback, no elevation needed - see README caveat)"
  }
}

function Invoke-SymlinkMapping {
  param([string]$SourceRel, [string]$TargetRaw)
  $target = Expand-TargetPath $TargetRaw
  $sourceAbs = Resolve-SourcePath -RepoRoot $RepoRoot -SourceRel $SourceRel
  if (Backup-IfExists -Target $target -ExpectedSource $sourceAbs -SourceRel $SourceRel) {
    New-LinkWithFallback -Target $target -SourceAbs $sourceAbs
  } else {
    Write-Host "  $target already correctly linked, skipped"
  }
}

function Invoke-SeedOnceMapping {
  param([string]$SourceRel, [string]$TargetRaw)
  $target = Expand-TargetPath $TargetRaw
  $sourceAbs = Resolve-SourcePath -RepoRoot $RepoRoot -SourceRel $SourceRel
  if (Test-Path -LiteralPath $target) {
    Write-Host "  $target already exists, leaving it alone (seed-once)"
    return
  }
  $parent = Split-Path $target -Parent
  if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  Copy-Item -LiteralPath $sourceAbs -Destination $target
  Write-Host "  seeded $target from $sourceAbs (will not be touched by future installs)"
}

function Get-MappingEntries {
  param([string]$MappingFile)
  $pattern = '^- \{\s*source:\s*([^,]+?)\s*,\s*target:\s*([^,]+?)\s*,\s*strategy:\s*([^\s}]+)\s*\}'
  Get-Content -LiteralPath $MappingFile | ForEach-Object {
    if ($_ -match $pattern) {
      [PSCustomObject]@{ Source = $Matches[1]; Target = $Matches[2]; Strategy = $Matches[3] }
    }
  }
}

function Invoke-Mapping {
  param([string]$MappingFile)
  foreach ($entry in Get-MappingEntries -MappingFile $MappingFile) {
    Write-Host "[$($entry.Strategy)] $($entry.Source) -> $($entry.Target)"
    switch ($entry.Strategy) {
      'symlink'   { Invoke-SymlinkMapping -SourceRel $entry.Source -TargetRaw $entry.Target }
      'seed-once' { Invoke-SeedOnceMapping -SourceRel $entry.Source -TargetRaw $entry.Target }
      default     { Write-Host "  unknown strategy '$($entry.Strategy)', skipped" }
    }
  }
  if ($script:BackupRoot) {
    Write-Host "Backed up pre-existing content to: $script:BackupRoot"
  }
}
