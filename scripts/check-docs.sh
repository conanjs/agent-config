#!/usr/bin/env bash
# check-docs.sh — runs the repo's document validators (layer 1 of the doc guards): knowledge, procedures, agentic-sdlc,
# then the scenario tests that pin what those validators do (tests/, specs/001).
# Used by .githooks/pre-commit, the Claude Code hook (.claude/settings.json) and CI (.github/workflows/validate-docs.yml).
#
# Usage: scripts/check-docs.sh   (network checks are separate: validate-knowledge.mjs --urls, validate-procedures.mjs --upstream)
# Exit:  0 = pass (warnings allowed), 1 = a validator failed, 3 = no Node.js >= 18 found.
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"

# The validators use top-level await and fetch: they need Node >= 18.
pick_node() {
  local n
  for n in "${NODE:-}" "$(command -v node 2>/dev/null)" $(ls -d "$HOME"/.nvm/versions/node/v*/bin/node 2>/dev/null | sort -rV); do
    [ -n "$n" ] && [ -x "$n" ] || continue
    [ "$("$n" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -ge 18 ] && { echo "$n"; return 0; }
  done
  return 1
}
node_bin="$(pick_node)" || { echo "check-docs: Node.js >= 18 not found (set NODE=/path/to/node)" >&2; exit 3; }

status=0
"$node_bin" "$root/copilot/frameworks/knowledge/tools/validate-knowledge.mjs" || status=1
"$node_bin" "$root/copilot/procedures/tools/validate-procedures.mjs" || status=1
"$node_bin" "$root/copilot/frameworks/agentic-sdlc/tools/validate.mjs" || status=1
# node --test takes files or glob patterns, not folders; listing the files keeps it independent of glob support.
(cd "$root" && "$node_bin" --test --test-reporter=dot $(find tests -name '*.test.mjs' | sort)) || status=1
exit $status
