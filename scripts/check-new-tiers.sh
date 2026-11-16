#!/usr/bin/env bash
# check-new-tiers.sh — the spec 022 checks: the new TypeScript tiers (contracts/, installers/, eslint/, scripts/*.ts) and
# the tools built on them. scripts/check-docs.sh runs it with --no-scenarios (its own Cucumber run covers every feature);
# the installer (windows) CI job runs it alone, with the spec 022 scenarios (Cucumber profile "spec022" in cucumber.mjs),
# because the repo's older tools have not been made to run on Windows yet (V, 2026-11-16).
#
# Usage: scripts/check-new-tiers.sh [--no-scenarios]
# Exit:  0 = pass, 1 = a check failed, 3 = no Node.js 24 found, 4 = dependencies not installed (run: pnpm install).
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
scenarios=1
[ "${1:-}" = "--no-scenarios" ] && scenarios=0

pick_node() {
  local n
  for n in "${NODE:-}" "$(command -v node 2>/dev/null)" $(ls -d "$HOME"/.nvm/versions/node/v*/bin/node 2>/dev/null | sort -rV); do
    [ -n "$n" ] && [ -x "$n" ] || continue
    [ "$("$n" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -eq 24 ] && { echo "$n"; return 0; }
  done
  return 1
}
node_bin="$(pick_node)" || { echo "check-new-tiers: Node.js 24 not found (nvm install 24, or set NODE=/path/to/node)" >&2; exit 3; }
[ -f "$root/node_modules/typescript/bin/tsc" ] || { echo "check-new-tiers: dependencies missing; run: pnpm install" >&2; exit 4; }

status=0
# Format, lint, type check and unit tests, run from source by Node 24.12+ type stripping (T086).
(cd "$root" && "$node_bin" node_modules/prettier/bin/prettier.cjs --check --log-level warn . && "$node_bin" node_modules/eslint/bin/eslint.js . --max-warnings 0 && "$node_bin" node_modules/typescript/bin/tsc --noEmit -p tsconfig.json && "$node_bin" node_modules/vitest/vitest.mjs run --silent) || status=1
# The contract schema check over the shipped files.
schemas_out="$(cd "$root" && "$node_bin" contracts/tools/check-schemas.ts contracts/index.md contracts/slots.yaml contracts/*/v1/examples/valid/* 2>&1)" || { printf '%s\n' "$schemas_out" >&2; status=1; }
# The fitness check (fails only on a rise over docs/baselines/fitness.json).
(cd "$root" && "$node_bin" scripts/check-fitness.ts --root "$root") || status=1
# The coverage check for the delivered phases.
(cd "$root" && "$node_bin" scripts/check-ac-coverage.ts --root "$root" --delivered 0,1) || status=1
# The repo-layout check in report mode (lists findings, never fails until phase 1).
(cd "$root" && "$node_bin" contracts/tools/build.ts layout --report --repo agent-config --root "$root") || status=1
# build cite in check mode over the fixture tree (T114): the checker itself stays honest; real consumer enforcement starts in
# phase 6, when a provider repository URL exists.
(cd "$root" && "$node_bin" contracts/tools/build.ts cite --root "$root/tests/build-cite/fixtures/base" --slots "$root/contracts/slots.yaml" --provider providers/knowledge/component.yaml --provider providers/core/component.yaml) || status=1
# The spec 022 scenarios, when not left to check-docs.sh.
if [ "$scenarios" -eq 1 ]; then
  (cd "$root" && "$node_bin" node_modules/@cucumber/cucumber/bin/cucumber.js --profile spec022) || status=1
fi
exit $status
