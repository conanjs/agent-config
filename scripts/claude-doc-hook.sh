#!/usr/bin/env bash
# Claude Code PostToolUse hook (.claude/settings.json): after an edit under copilot/knowledge, copilot/procedures
# or copilot/frameworks/knowledge, run the doc validators. On failure, exit 2 so Claude sees the errors and fixes them.
f="$(jq -r '.tool_input.file_path // .tool_response.filePath // empty' 2>/dev/null)"
case "$f" in
  */copilot/knowledge/*|*/copilot/procedures/*|*/copilot/frameworks/knowledge/*|*/copilot/frameworks/agentic-sdlc/*) ;;
  *) exit 0 ;;
esac
out="$("$(dirname "$0")/check-docs.sh" 2>&1)"; rc=$?
[ $rc -eq 1 ] && { printf 'Doc validation failed after editing %s:\n%s\n' "$f" "$out" >&2; exit 2; }
exit 0
