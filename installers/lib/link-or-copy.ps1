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
  # A junction/hard link from an earlier degraded run must be replaced so a
  # re-run can upgrade it to a real symlink.
  if ($item.LinkType -ne 'SymbolicLink') { return $false }
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
      if ($item.PSIsContainer) { [IO.Directory]::Delete($Target) } else { Remove-Item -LiteralPath $Target -Force }
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

# Get-Command misses a pwsh installed after this process started (stale PATH),
# so also probe the usual install locations.
function Find-Pwsh {
  $cmd = Get-Command pwsh -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd }
  $candidates = @(
    (Join-Path $env:ProgramFiles 'PowerShell\7\pwsh.exe'),
    (Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\pwsh.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\PowerShell\7\pwsh.exe')
  )
  foreach ($c in $candidates) { if (Test-Path -LiteralPath $c) { return (Get-Item -LiteralPath $c) } }
  return $null
}

# Links that couldn't be made without admin rights; created in one elevated
# process at the end of Invoke-Mapping so the user sees a single UAC prompt.
$script:ElevQueue = @()
$script:Mode = 'symlink'
$script:CopyConsent = $null

function Test-SymlinkCapability {
  $probe = Join-Path $env:USERPROFILE ".agent-config-probe-$PID"
  $src = $RepoRoot
  $ok = $false
  $how = $null
  try {
    New-Item -ItemType SymbolicLink -Path $probe -Target $src -ErrorAction Stop | Out-Null
    $ok = $true; $how = 'New-Item'
  } catch {
    cmd /c "mklink /D `"$probe`" `"$src`" >nul 2>&1"
    if ($LASTEXITCODE -eq 0) { $ok = $true; $how = 'mklink' }
  }
  if (-not $ok -and $PSVersionTable.PSVersion.Major -lt 7) {
    $pw = Find-Pwsh
    if ($pw) {
      $pp = if ($pw.Source) { $pw.Source } else { $pw.FullName }
      $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
      try { & $pp -NoProfile -Command "New-Item -ItemType SymbolicLink -Path '$probe' -Target '$src' -ErrorAction Stop | Out-Null" 2>&1 | Out-Null } catch { $global:LASTEXITCODE = 1 } finally { $ErrorActionPreference = $prev }
      if ($LASTEXITCODE -eq 0) { $ok = $true; $how = 'pwsh7' }
    }
  }
  if (Test-Path -LiteralPath $probe) { [IO.Directory]::Delete($probe) }
  return $ok
}

function Get-SymlinkDiagnosis {
  $devKey = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock'
  $dev = (Get-ItemProperty -Path $devKey -Name AllowDevelopmentWithoutDevLicense -ErrorAction SilentlyContinue).AllowDevelopmentWithoutDevLicense -eq 1
  $admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  [PSCustomObject]@{
    DeveloperMode = $dev
    IsAdmin       = $admin
    Pwsh7         = [bool](Find-Pwsh)
    PSVersion     = $PSVersionTable.PSVersion.ToString()
    CrossDrive    = ((Split-Path -Qualifier $RepoRoot) -ne (Split-Path -Qualifier $env:USERPROFILE))
  }
}

# Probe first. On failure: explain the cause, list ranked fixes, and let the
# user choose. Never degrades (junction/hard link/copy) without explicit consent.
function Invoke-Preflight {
  if ($script:PreflightDone) { return }
  $script:PreflightDone = $true
  if (Test-SymlinkCapability) { $script:Mode = 'symlink'; return }
  $d = Get-SymlinkDiagnosis
  $interactive = [Environment]::UserInteractive -and -not [Console]::IsInputRedirected

  Write-Host ""
  Write-Host "PREFLIGHT: this account cannot create real symlinks right now." -ForegroundColor Yellow
  Write-Host "  Diagnosis: developer_mode=$($d.DeveloperMode) is_admin=$($d.IsAdmin) powershell=$($d.PSVersion) pwsh7_installed=$($d.Pwsh7) repo_and_home_on_different_drives=$($d.CrossDrive)"
  if ($d.DeveloperMode) {
    Write-Host "  Cause: Developer Mode is ON but the symlink still failed" -ForegroundColor Yellow
    Write-Host "         (the setting may not have taken effect yet, or this shell predates it)."
  } else {
    Write-Host "  Cause: Developer Mode is OFF and this shell is not elevated, so Windows denies symlink creation (needs Developer Mode or the 'Create symbolic links' privilege)." -ForegroundColor Yellow
  }
  Write-Host "  Fixes, best first (no new software first):"
  Write-Host "    1) ELEVATE once   - one UAC prompt, creates every symlink; installs nothing.  (re-run with AGENT_CONFIG_ELEVATE=1)"
  Write-Host "    2) DEVELOPER MODE - Settings > System > For developers, then re-run. Machine-wide setting."
  Write-Host "    3) GRANT RIGHT    - secpol.msc > User Rights Assignment > 'Create symbolic links' for your user, then sign out/in."
  Write-Host "  Degraded option (not recommended): junctions for directories only$(if ($d.CrossDrive) { '; FILE links cannot be made at all because the repo and home are on different drives' } else { '; hard links for files' }). Re-run with AGENT_CONFIG_ALLOW_DEGRADED=1."

  if ($env:AGENT_CONFIG_ELEVATE -eq '1') { $script:Mode = 'elevate'; return }
  if ($env:AGENT_CONFIG_ALLOW_DEGRADED -eq '1') { $script:Mode = 'degrade'; return }
  if ($interactive) {
    $ans = Read-Host "  Choose: [1] elevate now  [2] accept degraded links  [q] quit (default q)"
    switch ($ans) {
      '1' { $script:Mode = 'elevate'; return }
      '2' { $script:Mode = 'degrade'; return }
    }
  }
  Write-Host "No changes made. Choose a fix above and re-run." -ForegroundColor Red
  exit 2
}

function Invoke-ElevatedQueue {
  if ($script:ElevQueue.Count -eq 0) { return }
  $lines = foreach ($q in $script:ElevQueue) {
    $t = $q.Target -replace "'", "''"; $s = $q.Source -replace "'", "''"
    "if (Test-Path -LiteralPath '$t') { `$i = Get-Item -LiteralPath '$t' -Force; if (`$i.LinkType -and `$i.LinkType -ne 'SymbolicLink') { if (`$i.PSIsContainer) { [IO.Directory]::Delete('$t') } else { Remove-Item -LiteralPath '$t' -Force } } }"
    "New-Item -ItemType SymbolicLink -Path '$t' -Target '$s' -ErrorAction Stop | Out-Null"
  }
  $tmp = Join-Path $env:TEMP "agent-config-elevate-$PID.ps1"
  Set-Content -LiteralPath $tmp -Value $lines -Encoding UTF8
  Write-Host "Requesting elevation for $($script:ElevQueue.Count) symlink(s)..."
  try {
    $p = Start-Process -FilePath (Get-Process -Id $PID).Path -Verb RunAs -Wait -PassThru `
      -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',$tmp
    if ($p.ExitCode -ne 0) { Write-Host "  [!] Elevated run exited with code $($p.ExitCode); junctions/links left as-is." -ForegroundColor Yellow }
  } catch {
    Write-Host "  [!] Elevation declined or failed: $($_.Exception.Message.Trim())" -ForegroundColor Yellow
  } finally {
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
  }
  # Anything now a real symlink is no longer degraded.
  $script:Degraded = @($script:Degraded | Where-Object { (Get-Item -LiteralPath $_ -Force -ErrorAction SilentlyContinue).LinkType -ne 'SymbolicLink' })
  $script:Skipped = @($script:Skipped | Where-Object { (Get-Item -LiteralPath $_ -Force -ErrorAction SilentlyContinue).LinkType -ne 'SymbolicLink' })
}

function New-LinkWithFallback {
  param([string]$Target, [string]$SourceAbs)
  $parent = Split-Path $Target -Parent
  if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }

  $isDir = Test-Path -LiteralPath $SourceAbs -PathType Container

  if ($script:Mode -eq 'elevate') {
    $script:ElevQueue += [PSCustomObject]@{ Target = $Target; Source = $SourceAbs }
    Write-Host "  queued for elevated symlink: $Target"
    return
  }

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

  # 3. Re-try under PowerShell 7 if present (its .NET honors Developer Mode). Never installed implicitly.
  if ($PSVersionTable.PSVersion.Major -lt 7) {
    $pwsh = Find-Pwsh
    if ($pwsh) {
      $pwshPath = if ($pwsh.Source) { $pwsh.Source } else { $pwsh.FullName }
      Write-Host "  trying PowerShell 7 ($pwshPath) for a real symlink..."
      $cmd = "New-Item -ItemType SymbolicLink -Path '$Target' -Target '$SourceAbs' -ErrorAction Stop | Out-Null"
      $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
      try { & $pwshPath -NoProfile -Command $cmd 2>&1 | Out-Null } catch { $global:LASTEXITCODE = 1 } finally { $ErrorActionPreference = $prev }
      if ($LASTEXITCODE -eq 0) {
        Write-Host "  symlinked via pwsh $Target -> $SourceAbs"
        return
      }
    }
  }

  # Degrading is only reached when the user explicitly accepted it in the preflight.
  if ($script:Mode -ne 'degrade') {
    Write-Host "  [!] Could not create a real symlink ($err1)" -ForegroundColor Red
    $script:Skipped += "$Target"
    return
  }
  # 6. Junction (directories only; no privilege needed, works across drives)
  if ($isDir) {
    New-Item -ItemType Junction -Path $Target -Target $SourceAbs | Out-Null
    $script:Degraded += "$Target"
    Write-Host "  [degraded] created JUNCTION $Target -> $SourceAbs (not a symlink)" -ForegroundColor Yellow
    return
  }

  # 6. Hard link (files only; same volume only). Skipped outright across drives, where it cannot work.
  $crossDrive = (Split-Path -Qualifier $Target) -ne (Split-Path -Qualifier $SourceAbs)
  if (-not $crossDrive) {
    try {
      New-Item -ItemType HardLink -Path $Target -Target $SourceAbs -ErrorAction Stop | Out-Null
      $script:Degraded += "$Target"
      Write-Host "  [degraded] created HARD LINK $Target -> $SourceAbs (not a symlink; see README caveat)" -ForegroundColor Yellow
      return
    } catch {
      Write-Host "  [!] Hard link failed: $($_.Exception.Message.Trim())" -ForegroundColor Yellow
    }
  } else {
    Write-Host "  [!] No hard link possible: $Target and $SourceAbs are on different drives." -ForegroundColor Yellow
  }

  # 7. Last resort: a COPY. Never silent - one explicit decision covers every file, and it will NOT auto-update.
  if ($null -eq $script:CopyConsent) {
    $script:CopyConsent = $env:AGENT_CONFIG_ALLOW_COPY -eq '1'
    if (-not $script:CopyConsent -and [Environment]::UserInteractive -and -not [Console]::IsInputRedirected) {
      $ans = Read-Host "  File links are impossible here. COPY files instead (applies to all files; copies do NOT stay in sync with the repo)? (y/N)"
      $script:CopyConsent = $ans -match '^(y|yes)$'
    }
  }
  if ($script:CopyConsent) {
    Copy-Item -LiteralPath $SourceAbs -Destination $Target
    $script:Degraded += "$Target"
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
  if (Test-AlreadyLinkedCorrectly -Target $target -ExpectedSource $sourceAbs) {
    Write-Host "  $target already correctly linked, skipped"
    return
  }
  Invoke-Preflight
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
  Invoke-ElevatedQueue
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
