#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
export REPO_ROOT

# shellcheck source=../lib/link-or-copy.sh
source "$SCRIPT_DIR/../lib/link-or-copy.sh"

echo "Installing agent-config from $REPO_ROOT (macOS)"
apply_mapping "$REPO_ROOT/mapping.yaml"
echo "Done."
