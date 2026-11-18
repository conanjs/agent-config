#!/usr/bin/env sh
# tracker-hook.sh — starts tracker.mjs for a session-start hook (Claude Code SessionStart, Copilot CLI sessionStart)
# with any Node.js 18 or later it can find: a hook may start without the login shell's PATH, so nvm's Node is tried
# too. Arguments pass through (e.g. --hook claude "$CLAUDE_PROJECT_DIR"). With no Node found it prints nothing, so a
# session never fails to start because of the tracker.
dir="$(cd "$(dirname "$0")" && pwd)"
for n in "${NODE:-}" "$(command -v node 2>/dev/null)" $(ls -d "$HOME"/.nvm/versions/node/v*/bin/node 2>/dev/null | sort -rV); do
  [ -n "$n" ] && [ -x "$n" ] || continue
  [ "$("$n" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -ge 18 ] && exec "$n" "$dir/tracker.mjs" "$@"
done
exit 0
