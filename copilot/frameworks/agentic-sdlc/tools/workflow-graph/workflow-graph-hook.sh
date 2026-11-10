#!/usr/bin/env sh
# workflow-graph-hook.sh — starts the workflow-graph tool (specs/019) for the guard and approval hooks of Claude Code,
# Copilot CLI and Codex, with a Node.js that can run TypeScript by type stripping (24.12 or later). A hook may start
# without the login shell's PATH, so nvm's Node is tried too. Arguments and stdin pass through.
# With no such Node the call is left alone (Copilot gets `{}`, the others nothing): the guard cannot read the run
# without Node, and refusing every tool call would stop all work. `doctor` in SETUP.md checks Node is found.
dir="$(cd "$(dirname "$0")" && pwd)"
empty() { case " $* " in *" copilot-cli "*) echo '{}' ;; *) echo '' ;; esac; }
# WG-38: the guard and approval hooks run before every tool call and prompt, in every repo. When the hook's folder
# has no workflow runs (<cwd>/.specify/runs, where the guard reads them) and the input names no run, no launch
# prompt, no run file and no approval, the guard could only answer "no decision": answer that here, without
# starting Node (about 130-190 ms per call otherwise). Anything else goes to the guard as before, stdin unchanged.
buffered=""
case "$1 $2" in
  "hook guard"|"hook approve")
    input="$(cat)"
    buffered=1
    runs=""
    # Every "cwd" value in the input (the session's, and any a tool's own arguments carry) and the hook's folder.
    for c in "$PWD" $(printf '%s' "$input" | grep -o '"cwd"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"\([^"]*\)"$/\1/'); do
      [ -d "$c/.specify/runs" ] && runs=1
    done
    if [ -z "$runs" ]; then
      case "$input" in
        *.specify/runs*|*run:*|*launch-prompt*|*[Aa]pprove*) ;;
        *) empty "$@"; exit 0 ;;
      esac
    fi
    ;;
esac
for n in "${NODE:-}" "$(command -v node 2>/dev/null)" $(ls -d "$HOME"/.nvm/versions/node/v*/bin/node 2>/dev/null | sort -rV); do
  [ -n "$n" ] && [ -x "$n" ] || continue
  "$n" -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>24||(a===24&&b>=12)?0:1)' 2>/dev/null || continue
  if [ -n "$buffered" ]; then printf '%s' "$input" | "$n" "$dir/src/main.ts" "$@"; exit $?; fi
  exec "$n" "$dir/src/main.ts" "$@"
done
empty "$@"
exit 0
