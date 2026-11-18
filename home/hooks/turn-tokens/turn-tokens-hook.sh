#!/usr/bin/env sh
# turn-tokens-hook.sh — starts turn-tokens.mjs for the Stop hook of Claude Code or Codex (--hook claude|codex) and
# for Claude Code's status line (--statusline), with any Node.js 18 or later it can find: a hook may start without
# the login shell's PATH, so nvm's Node is tried too. Arguments pass through. With no Node found it prints valid,
# empty output (an empty JSON object for a hook), so a turn never fails because of the report.
dir="$(cd "$(dirname "$0")" && pwd)"
for n in "${NODE:-}" "$(command -v node 2>/dev/null)" $(ls -d "$HOME"/.nvm/versions/node/v*/bin/node 2>/dev/null | sort -rV); do
  [ -n "$n" ] && [ -x "$n" ] || continue
  [ "$("$n" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -ge 18 ] && exec "$n" "$dir/turn-tokens.mjs" "$@"
done
case " $* " in *" --hook "*) echo '{}' ;; *) echo '' ;; esac
exit 0
