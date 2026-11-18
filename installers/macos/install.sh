#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
export REPO_ROOT

# shellcheck source=../lib/link-or-copy.sh
source "$SCRIPT_DIR/../lib/link-or-copy.sh"

echo "Installing agent-config from $REPO_ROOT (macOS)"
apply_mapping "$REPO_ROOT/mapping.yaml"
# Skills and agents: built per coding agent from skills/ and agents/ sources, then linked entry by entry.
if [ -f "$REPO_ROOT/scripts/build.mjs" ]; then node "$REPO_ROOT/scripts/build.mjs" --link; fi
echo "Done."
