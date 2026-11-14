#Requires -Version 5.1
# Prints the install plan of the old Windows installer (installers/install.ps1) as one line per link or seeded file,
# sorted by target: "link <target> -> <source>" and "seed <target> <- <source>". Targets are relative to the home
# folder (shown as ~), sources relative to the repo, both with "/" so the listing does not depend on where the repo
# or the home is. This is the PowerShell twin of tests/installers/golden/posix/plan.sh (specs/022 QB-3, T037).
# A seeded file has no mode here: Windows files carry no POSIX mode, so the seed line ends after its source.
# Usage (Windows runner): ./tests/installers/golden/windows/plan.ps1 > golden-windows.txt
#   V commits that output as tests/installers/golden/windows/windows.txt (the file golden.feature compares).
#
# Safety: the installer reads USERPROFILE (and the repo it sits in). This script gives it a fresh temporary home and
# clears the AGENT_CONFIG_* switches, so the real home is never touched. It runs the installer in a child process of
# the same PowerShell host and records its exit code in the header. When symbolic links are not allowed on the
# machine, the installer stops without changes (exit 2) and the plan is empty: the header shows it.
$ErrorActionPreference = 'Stop'

$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$work = Join-Path ([IO.Path]::GetTempPath()) ("golden-plan-" + [Guid]::NewGuid().ToString('N').Substring(0, 8))
$home_ = Join-Path $work 'home'
New-Item -ItemType Directory -Path $home_ -Force | Out-Null

# Target -> source of every mapping.yaml entry, read with the installer's own pattern (a seeded file is a copy, so its
# source is the entry whose target it is).
$entryPattern = '^- \{\s*source:\s*([^,]+?)\s*,\s*target:\s*([^,]+?)\s*,\s*strategy:\s*([^\s}]+)\s*\}'
$sourceOf = @{}
foreach ($line in Get-Content -LiteralPath (Join-Path $repo 'mapping.yaml')) {
  if ($line -match $entryPattern) { $sourceOf[$Matches[2]] = $Matches[1] }
}

function Test-IsLink($item) { return ($item.LinkType -eq 'SymbolicLink' -or $item.LinkType -eq 'Junction') }

# Every file and link under $dir as @{ Path; Rel; Link }, never descending into a link.
function Get-Entries([string]$dir, [string]$rel) {
  foreach ($child in Get-ChildItem -LiteralPath $dir -Force) {
    $childRel = if ($rel) { "$rel/$($child.Name)" } else { $child.Name }
    if (Test-IsLink $child) { @{ Path = $child.FullName; Rel = $childRel; Link = $true } }
    elseif ($child.PSIsContainer) { Get-Entries $child.FullName $childRel }
    else { @{ Path = $child.FullName; Rel = $childRel; Link = $false } }
  }
}

function Format-Source([string]$target) {
  $t = ($target -replace '^\\\\\?\\', '') -replace '\\', '/'
  $r = ($repo -replace '\\', '/').TrimEnd('/') + '/'
  if ($t.StartsWith($r, [StringComparison]::OrdinalIgnoreCase)) { return $t.Substring($r.Length) }
  return $t
}

$code = 0
$lines = @()
try {
  $saved = @{ USERPROFILE = $env:USERPROFILE; HOME = $env:HOME }
  $env:USERPROFILE = $home_
  $env:HOME = $home_
  Get-ChildItem Env: | Where-Object { $_.Name -like 'AGENT_CONFIG_*' } | ForEach-Object { Remove-Item "Env:$($_.Name)" }
  & (Get-Process -Id $PID).Path -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'installers/install.ps1') *> $null
  $code = $LASTEXITCODE
  $env:USERPROFILE = $saved.USERPROFILE
  $env:HOME = $saved.HOME

  foreach ($e in Get-Entries $home_ '') {
    if ($e.Rel -like '.agent-config-backups/*') { continue }
    # PowerShell's own cache and config under HOME (macOS and Linux hosts only; used when testing this script there).
    if ($e.Rel -like '.cache/powershell/*' -or $e.Rel -like '.config/powershell/*' -or $e.Rel -like '.local/share/powershell/*') { continue }
    $t = "~/$($e.Rel)"
    if ($e.Link) {
      $lines += "link $t -> $(Format-Source (@((Get-Item -LiteralPath $e.Path -Force).Target) | Select-Object -First 1))"
    } else {
      $lines += "seed $t <- $($sourceOf[$t])"
    }
  }
}
finally {
  # Remove every link by itself first: Remove-Item -Recurse on a directory link can follow it and delete the real folder.
  if (Test-Path -LiteralPath $home_) {
    $stack = [Collections.Generic.Stack[string]]::new()
    $stack.Push($home_)
    while ($stack.Count -gt 0) {
      foreach ($child in Get-ChildItem -LiteralPath $stack.Pop() -Force) {
        if (Test-IsLink $child) {
          if ($child.PSIsContainer) { [IO.Directory]::Delete($child.FullName) } else { [IO.File]::Delete($child.FullName) }
        } elseif ($child.PSIsContainer) { $stack.Push($child.FullName) }
      }
    }
  }
  Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
}

[Array]::Sort($lines, [StringComparer]::Ordinal)
Write-Output "# install plan of installers/install.ps1, os=windows, exit=$code"
foreach ($l in $lines) { Write-Output $l }
