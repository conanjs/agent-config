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
  source="$(echo "$line" | sed -E 's/.*source: *([^,]+),.*/\1/')"
  target="$(echo "$line" | sed -E 's/.*target: *([^,]+),.*/\1/')"
  strategy="$(echo "$line" | sed -E 's/.*strategy: *([^ }]+).*/\1/')"
  source="$(trim "$source")"; target="$(trim "$target")"; strategy="$(trim "$strategy")"
  target="$(expand_target "$target")"
  if [ "$strategy" = "symlink" ] && [ -L "$target" ]; then
    echo "removing symlink $target"
    rm "$target"
  elif [ "$strategy" = "link-each" ]; then
    # Only the links this repo made; the folder and anything else in it stay.
    for entry in "$REPO_ROOT/$source"/*; do
      [ -e "$entry" ] || continue
      t="$target/$(basename "$entry")"
      if [ -L "$t" ] && [ "$(readlink "$t")" = "$entry" ]; then
        echo "removing symlink $t"
        rm "$t"
      fi
    done
  fi
done < "$REPO_ROOT/mapping.yaml"

echo "Done. Any pre-existing content backed up during install is at ~/.agent-config-backups/<timestamp>/ — restore it manually if needed."
