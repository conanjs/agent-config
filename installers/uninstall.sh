#!/usr/bin/env bash
# For macOS and Linux ONLY. On Windows, run uninstall.ps1 instead.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/lib/link-or-copy.sh"

echo "Removing symlinks created by install.sh (seed-once files are left untouched — they've diverged from the repo by design)."

while IFS= read -r line; do
  [[ "$line" == \#* || -z "$line" ]] && continue
  [[ "$line" != "- {"* ]] && continue
  target="$(echo "$line" | sed -E 's/.*target: *([^,]+),.*/\1/')"
  strategy="$(echo "$line" | sed -E 's/.*strategy: *([^ }]+).*/\1/')"
  target="$(trim "$target")"; strategy="$(trim "$strategy")"
  target="$(expand_target "$target")"
  if [ "$strategy" = "symlink" ] && [ -L "$target" ]; then
    echo "removing symlink $target"
    rm "$target"
  fi
done < "$REPO_ROOT/mapping.yaml"

echo "Done. Any pre-existing content backed up during install is at ~/.agent-config-backups/<timestamp>/ — restore it manually if needed."
