# Contract: hook input and output per tool

✅ = recorded from a live run on 2026-11-03 (the payload is kept as a test fixture); 📄 = from the tool's docs read the same day; ⚠️ = not verified yet.

## Guard: pre-tool-use on the subagent tool

| | Claude Code 2.1.129 | Copilot CLI 1.0.105 | Codex 0.164.0-alpha |
|---|---|---|---|
| Event / matcher | `PreToolUse`, matcher `Agent` ✅ | `preToolUse` (no matcher; the guard ignores tools other than `task` and edit tools) ✅ | `PreToolUse`, matcher `Agent` (covers `spawn_agent`) 📄 |
| Where installed | `~/.claude/settings.json` `hooks` (seed `claude/settings.json`) | `~/.copilot/hooks/workflow-graph.json` (user level; repository hooks need a trusted folder ✅) | `~/.codex/hooks.json` (from `codex/hooks.json`); trust in `/hooks` 📄 |
| Tool name in input | `tool_name: "Agent"` ✅ | `toolName: "task"` ✅ | `tool_name` canonical, `spawn_agent` 📄 |
| Launch prompt in input | `tool_input.prompt` ✅ (also `subagent_type`, `description`) | `toolArgs.prompt` ✅ (also `agent_type`, `name`, `description`, `mode`) | `tool_input` holds the arguments 📄; field name of the prompt ⚠️ |
| Deny output | `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"…"}}` ✅ | `{"permissionDecision":"deny","permissionDecisionReason":"…"}` (reason required) ✅ | same as Claude Code 📄 |
| No decision | exit 0, no output | exit 0, `{}` | exit 0, no output |
| Seen by the agent | the reason, verbatim ✅ | "Denied by preToolUse hook: <reason>" ✅ | ⚠️ |

## Approval: prompt submit

| | Claude Code | Copilot CLI | Codex |
|---|---|---|---|
| Event | `UserPromptSubmit` 📄 | `userPromptSubmitted` 📄 | `UserPromptSubmit` 📄 |
| Text | `prompt` 📄 | `prompt` 📄 | ⚠️ |
| Session reference | `session_id`, `transcript_path` 📄 | `sessionId`; the log is `~/.copilot/session-state/<id>/events.jsonl` (`user.message`) | `session_id`, `transcript_path` 📄 |
| Output | none (the hook only records) | dropped for config-file hooks 📄 | none |

## The launch prompt's new key

`launch-prompt/v1` gains `run: R-<nnn>`, required when `phase` is P0–P7 and optional otherwise (an additive change: CC-Q1). The guard reads `run`, `phase`, `role`, `mode`, `task` and `context.attempt` from the YAML at the start of the prompt.
