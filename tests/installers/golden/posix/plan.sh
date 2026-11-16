#!/usr/bin/env bash
# Prints the install plan of the old bash installer (installers/install.sh) as one line per link or seeded file,
# sorted by target: "link <target> -> <source>" and "seed <target> <- <source> <mode>". Targets are relative to
# HOME (shown as ~), sources relative to the repo, so the listing does not depend on where the repo or HOME is.
# Usage: plan.sh darwin|linux > golden/posix/<os>.txt   (characterization test, specs/022 QB-3, T036)
#
# Safety: the installer reads only HOME (and the repo it sits in). This script gives it a fresh temporary HOME
# and a minimal environment, so the real ~/.claude, ~/.codex, ~/.copilot and ~/.agents are never touched.
# "linux" runs on any machine: a fake `uname` makes install.sh route to installers/linux/install.sh.
set -euo pipefail
os="${1:?usage: plan.sh darwin|linux}"
case "$os" in darwin) uname_out=Darwin ;; linux) uname_out=Linux ;; *) echo "unknown os: $os" >&2; exit 2 ;; esac

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd -P)"
work="$(mktemp -d "${TMPDIR:-/tmp}/golden-plan.XXXXXX")"
trap 'rm -rf "$work"' EXIT
home="$work/home"; bin="$work/bin"
mkdir -p "$home" "$bin"
printf '#!/bin/sh\necho %s\n' "$uname_out" > "$bin/uname"; chmod +x "$bin/uname"

mode_of() { stat -c %a "$1" 2>/dev/null || stat -f %Lp "$1"; }  # GNU stat, then BSD stat

code=0
env -i HOME="$home" PATH="$bin:/usr/bin:/bin" bash "$repo/installers/install.sh" >/dev/null 2>&1 || code=$?
echo "# install plan of installers/install.sh, os=$os, exit=$code"

home_real="$(cd "$home" && pwd -P)"
rel_source() { local s="$1"; s="${s#"$repo"/}"; echo "$s"; }
while IFS= read -r p; do
  case "$p" in "$home_real"/.agent-config-backups/*) continue ;; esac
  t="~/${p#"$home_real"/}"
  if [ -L "$p" ]; then
    echo "link $t -> $(rel_source "$(readlink "$p")")"
  else
    # A seeded file is a copy, so its source is the mapping.yaml entry whose target it is.
    src="$(grep -F "target: $t," "$repo/mapping.yaml" | sed -E 's/.*source: *([^,]+),.*/\1/')"
    echo "seed $t <- $src $(mode_of "$p")"
  fi
done < <(find "$home_real" \( -type l -o -type f \) | LC_ALL=C sort) | LC_ALL=C sort
