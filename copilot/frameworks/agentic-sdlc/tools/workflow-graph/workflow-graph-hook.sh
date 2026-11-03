#!/usr/bin/env sh
# workflow-graph-hook.sh — starts the workflow-graph tool (specs/019) for the guard and approval hooks of Claude Code,
# Copilot CLI and Codex, with a Node.js that can run TypeScript by type stripping (24.12 or later). A hook may start
# without the login shell's PATH, so nvm's Node is tried too. Arguments and stdin pass through.
# With no such Node the call is left alone (Copilot gets `{}`, the others nothing): the guard cannot read the run
# without Node, and refusing every tool call would stop all work. `doctor` in SETUP.md checks Node is found.
dir="$(cd "$(dirname "$0")" && pwd)"
for n in "${NODE:-}" "$(command -v node 2>/dev/null)" $(ls -d "$HOME"/.nvm/versions/node/v*/bin/node 2>/dev/null | sort -rV); do
  [ -n "$n" ] && [ -x "$n" ] || continue
  "$n" -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>24||(a===24&&b>=12)?0:1)' 2>/dev/null && exec "$n" "$dir/src/main.ts" "$@"
done
case " $* " in *" copilot-cli "*) echo '{}' ;; *) echo '' ;; esac
exit 0
