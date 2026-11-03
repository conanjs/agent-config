#!/usr/bin/env bash
# check-docs.sh — runs the repo's document validators (layer 1 of the doc guards): knowledge, procedures, agentic-sdlc,
# agent-foundry, the atlas, this repo's TRACKER.md, the workflow graph tool (specs/019), then the Cucumber scenarios that pin what the repo's tools do (tests/, specs/001 and 003).
# Used by .githooks/pre-commit, the Claude Code hook (.claude/settings.json) and CI (.github/workflows/validate-docs.yml).
#
# Usage: scripts/check-docs.sh   (network checks are separate: validate-knowledge.mjs --urls, validate-procedures.mjs --upstream)
# Exit:  0 = pass (warnings allowed), 1 = a validator or scenario failed, 3 = no Node.js 24 found,
#        4 = test dependencies not installed (run: pnpm install).
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"

# The repo runs on Node 24 (.nvmrc, package.json engines). The validators alone need >= 18; Cucumber.js 13 needs 22 or 24+.
pick_node() {
  local n
  for n in "${NODE:-}" "$(command -v node 2>/dev/null)" $(ls -d "$HOME"/.nvm/versions/node/v*/bin/node 2>/dev/null | sort -rV); do
    [ -n "$n" ] && [ -x "$n" ] || continue
    [ "$("$n" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -eq 24 ] && { echo "$n"; return 0; }
  done
  return 1
}
node_bin="$(pick_node)" || { echo "check-docs: Node.js 24 not found (nvm install 24, or set NODE=/path/to/node)" >&2; exit 3; }
cucumber="$root/node_modules/@cucumber/cucumber/bin/cucumber.js"
[ -f "$cucumber" ] || { echo "check-docs: test dependencies missing; run: pnpm install" >&2; exit 4; }

status=0
"$node_bin" "$root/copilot/frameworks/knowledge/tools/validate-knowledge.mjs" || status=1
"$node_bin" "$root/copilot/procedures/tools/validate-procedures.mjs" || status=1
"$node_bin" "$root/copilot/frameworks/agentic-sdlc/tools/validate.mjs" || status=1
"$node_bin" "$root/copilot/frameworks/agent-foundry/tools/validate-foundry.mjs" || status=1
# The atlas: every file under a kind, the tree whole, the generated map current (after adding files: atlas.mjs --write).
"$node_bin" "$root/copilot/atlas/tools/atlas.mjs" || status=1
# This repo's own TRACKER.md (tracker/v1).
"$node_bin" "$root/copilot/tracker/tracker.mjs" "$root" || status=1
# The workflow graph (specs/019): the graph and its generated JSON and tables, then the tool's type check, lint
# (the class-modeled paradigm rules) and unit tests. Its development tools are a pnpm workspace package.
wg="$root/copilot/frameworks/agentic-sdlc/tools/workflow-graph"
"$node_bin" "$wg/src/main.ts" check-graph || status=1
[ -f "$wg/node_modules/typescript/bin/tsc" ] || { echo "check-docs: workflow-graph dependencies missing; run: pnpm install" >&2; exit 4; }
(cd "$wg" && "$node_bin" node_modules/typescript/bin/tsc --noEmit -p tsconfig.json && "$node_bin" node_modules/eslint/bin/eslint.js . --max-warnings 0 && "$node_bin" node_modules/vitest/vitest.mjs run --silent) || status=1
(cd "$root" && "$node_bin" "$cucumber") || status=1
exit $status
