#Requires -Version 5.1
# Core "place this repo file at that destination path" primitives for Windows.
# Dot-sourced by install.ps1 / uninstall.ps1. Callers must set $RepoRoot first.
#
# Windows specifics this file exists to handle (see README "Windows notes"):
#  - A real symlink needs admin OR Developer Mode (+ PowerShell 7, or mklink on
#    5.1). New-LinkWithFallback tries, in order: New-Item symlink -> mklink ->
#    pwsh 7 -> (prints how to fix) -> Junction (dirs) -> HardLink (files) ->
#    consented Copy. Anything below a real symlink is reported as degraded.
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
$script:Degraded = @()
$script:Skipped = @()
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
      # One source can map to several targets (e.g. skills -> ~/.claude/skills
      # and ~/.agents/skills); never let a second backup land on the first.
      $base = $dest; $n = 2
      while (Test-Path -LiteralPath $dest) { $dest = "$base.$n"; $n++ }
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

  # Ladder, proper-first. Each rung runs only if the previous one failed.
  # 1. Native symlink (works: elevated shell, or PowerShell 7 + Developer Mode)
  $err1 = $null
  try {
    New-Item -ItemType SymbolicLink -Path $Target -Target $SourceAbs -ErrorAction Stop | Out-Null
    Write-Host "  symlinked $Target -> $SourceAbs"
    return
  } catch { $err1 = $_.Exception.Message.Trim() }

  # 2. mklink: Windows PowerShell 5.1 ignores Developer Mode, cmd's mklink honors it
  $flag = if ($isDir) { '/D' } else { '' }
  $out = cmd /c "mklink $flag `"$Target`" `"$SourceAbs`" 2>&1"
  if ($LASTEXITCODE -eq 0) {
    Write-Host "  symlinked via mklink $Target -> $SourceAbs"
    return
  }

  # 3. Re-try under PowerShell 7 (its .NET honors Developer Mode). If it's missing, offer to install it.
  if ($PSVersionTable.PSVersion.Major -lt 7) {
    $pwsh = Get-Command pwsh -ErrorAction SilentlyContinue
    if (-not $pwsh) {
      Write-Host "  PowerShell 7 is not installed. It creates real symlinks with Developer Mode on (no admin needed)." -ForegroundColor Yellow
      $winget = Get-Command winget -ErrorAction SilentlyContinue
      $install = $env:AGENT_CONFIG_INSTALL_PWSH -eq '1'
      if (-not $install -and $winget -and [Environment]::UserInteractive -and -not [Console]::IsInputRedirected) {
        $install = (Read-Host "  Install PowerShell 7 now via winget? (y/N)") -match '^(y|yes)$'
      }
      if ($install -and $winget) {
        winget install --id Microsoft.PowerShell -e --accept-package-agreements --accept-source-agreements | Out-Null
        $exe = Join-Path $env:ProgramFiles 'PowerShell\7\pwsh.exe'
        if (Test-Path $exe) { $pwsh = Get-Item $exe }
      } else {
        Write-Host "  Install it with: winget install Microsoft.PowerShell  (then re-run with pwsh)" -ForegroundColor Yellow
      }
    }
    if ($pwsh) {
      $pwshPath = if ($pwsh.Source) { $pwsh.Source } else { $pwsh.FullName }
      Write-Host "  trying PowerShell 7 ($pwshPath) for a real symlink..."
      $cmd = "New-Item -ItemType SymbolicLink -Path '$Target' -Target '$SourceAbs' -ErrorAction Stop | Out-Null"
      & $pwshPath -NoProfile -Command $cmd 2>$null
      if ($LASTEXITCODE -eq 0) {
        Write-Host "  symlinked via pwsh $Target -> $SourceAbs"
        return
      }
    }
  }

  # 4. Tell the user exactly why and how to fix it, before degrading.
  Write-Host "  [!] Could not create a real symlink ($err1)" -ForegroundColor Yellow
  Write-Host "      Fix it properly, then re-run the installer (any one of these):" -ForegroundColor Yellow
  Write-Host "        a) Enable Developer Mode (Settings > System > For developers) AND run install.ps1 with PowerShell 7 (winget install Microsoft.PowerShell; pwsh -File .\installers\install.ps1)" -ForegroundColor Yellow
  Write-Host "        b) Run this installer from an elevated (Administrator) PowerShell" -ForegroundColor Yellow
  Write-Host "        c) Grant your user 'Create symbolic links' (secpol.msc > Local Policies > User Rights Assignment), then sign out/in" -ForegroundColor Yellow
  $script:Degraded += "$Target"

  # 5. Junction (directories only; no privilege needed, works across drives)
  if ($isDir) {
    New-Item -ItemType Junction -Path $Target -Target $SourceAbs | Out-Null
    Write-Host "  [degraded] created JUNCTION $Target -> $SourceAbs (not a symlink)" -ForegroundColor Yellow
    return
  }

  # 6. Hard link (files only; same volume only, breaks if the source is replaced - see README)
  try {
    New-Item -ItemType HardLink -Path $Target -Target $SourceAbs -ErrorAction Stop | Out-Null
    Write-Host "  [degraded] created HARD LINK $Target -> $SourceAbs (not a symlink; see README caveat)" -ForegroundColor Yellow
    return
  } catch {
    Write-Host "  [!] Hard link failed too: $($_.Exception.Message.Trim()) (usually: repo and home are on different drives)" -ForegroundColor Yellow
  }

  # 7. Last resort: a COPY. Never silent - needs explicit consent, and it will NOT auto-update.
  $allow = $env:AGENT_CONFIG_ALLOW_COPY -eq '1'
  if (-not $allow -and [Environment]::UserInteractive -and -not [Console]::IsInputRedirected) {
    $ans = Read-Host "  Copy $SourceAbs to $Target instead? It will NOT stay in sync with the repo (y/N)"
    $allow = $ans -match '^(y|yes)$'
  }
  if ($allow) {
    Copy-Item -LiteralPath $SourceAbs -Destination $Target
    Write-Host "  [degraded] COPIED $Target (stale-prone; re-run the installer after repo changes)" -ForegroundColor Red
  } else {
    Write-Host "  [!] Skipped $Target. Apply a fix above and re-run. (Set AGENT_CONFIG_ALLOW_COPY=1 to accept copies non-interactively.)" -ForegroundColor Red
    $script:Skipped += "$Target"
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
  if ($script:Degraded.Count -gt 0) {
    Write-Host "WARNING: $($script:Degraded.Count) target(s) are NOT real symlinks (junction/hard link/copy):" -ForegroundColor Yellow
    $script:Degraded | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
  }
  if ($script:Skipped.Count -gt 0) {
    Write-Host "ERROR: $($script:Skipped.Count) target(s) were NOT installed:" -ForegroundColor Red
    $script:Skipped | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    exit 1
  }
}
