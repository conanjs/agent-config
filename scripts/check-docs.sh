#!/usr/bin/env bash
# check-docs.sh — runs this repo's checks: procedures, agent-foundry, TRACKER.md, the skill and agent build, the spec 022
# TypeScript tiers and their checks, then the Cucumber scenarios that pin what the repo's tools do (tests/).
# Used by .githooks/pre-commit, the Claude Code hook (.claude/settings.json) and CI (.github/workflows/validate-docs.yml).
#
# Usage: scripts/check-docs.sh   (network checks are separate: validate-procedures.mjs --upstream)
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
# The knowledge base, agentic-sdlc, the company KBs and the atlas live in their own folders and repos, with their own
# checks (agent-knowledge: npm run check; agentic-sdlc: npm test). This repo checks only what it holds.
"$node_bin" "$root/home/procedures/tools/validate-procedures.mjs" || status=1
"$node_bin" "$root/home/frameworks/agent-foundry/tools/validate-foundry.mjs" || status=1
# This repo's own TRACKER.md (tracker/v1).
"$node_bin" "$root/home/tracker/tracker.mjs" "$root" || status=1
# The skill and agent build: every source has a valid header for each agent it names (writes only dist/).
"$node_bin" "$root/scripts/build.mjs" >/dev/null || status=1
# Spec 022 (T086): the new TypeScript tiers and the tools built on them, in their own script so the Windows CI job can
# run them alone; the scenarios run once, in the Cucumber step below.
"$root/scripts/check-new-tiers.sh" --no-scenarios || status=1
(cd "$root" && "$node_bin" "$cucumber") || status=1
exit $status
