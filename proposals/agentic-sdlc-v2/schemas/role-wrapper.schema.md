---
schema: schema/v1
last-updated: 2026-10-04
---

# Schema: Role Wrapper (`role-wrapper/v1`)

**Applies to:** `copilot/agents/sdlc-<role>.agent.md` · `claude/agents/sdlc-<role>.md` · `codex/agents/sdlc-<role>.toml` (in the `agent-config` repo; installed by `mapping.yaml`) · **Store:** A (tool adapters) · **Written by:** framework maintainer · **Read by:** each tool's agent loader · **Loaded as:** n/a

A **thin wrapper** makes one role launchable in one tool. It holds only tool metadata and a pointer to `agents/<role>.md`. It never holds rules. See `{{AGENT_HOME}}/patterns/shared-procedure-thin-wrapper.pattern.md`.

## Front-matter

Tool-specific. The wrapper format is fixed by each tool, so the framework's `schema:` key is **not** added here.

| Tool | Required keys | v2 values |
|---|---|---|
| Copilot (`.agent.md`) | `name`, `description`, `user-invocable` | `user-invocable: true` (standalone use, v2 §4.7) |
| Claude Code (`.md`) | `name`, `description`, `model`, `disallowedTools`, `skills` | `model:` from tier (opus/sonnet); `disallowedTools: Agent`; `skills: [sdlc-<role>-preset]` |
| Codex (`.toml`) | `name`, `description`, `developer_instructions` | — |

## Required structure

The body (or `developer_instructions`) is exactly this text, with only `<role>` substituted:

```markdown
Read `{{AGENT_HOME}}/frameworks/agentic-sdlc/agents/<role>.md` and follow it, together with
`{{AGENT_HOME}}/frameworks/agentic-sdlc/conventions.md`.
If your task starts with a launch prompt (schemas/launch-prompt.schema.md), act in its `mode`.
Otherwise you were invoked directly: follow the role's "Standalone use" section.
Never launch other agents.
```

(Path shown as `{{AGENT_HOME}}`. The installed wrapper uses the tool's path form: `~/.copilot/...`, with a note about `%USERPROFILE%` on Windows.)

## Rules

- `name` = `sdlc-<role-id>`, and `<role-id>` exists in `conventions.md` §1.
- `description` is one sentence about what the role owns, plus "Launched by the agentic-sdlc Orchestrator, or invoked directly for standalone review/execute."
- No rule text, no tool names, no paths other than the two above.
- Claude's `skills:` names only the role's preset skill. Stack and paradigm skills are named in the launch prompt, because they vary per task.

## Example

```markdown
---
name: sdlc-engineering
description: "Agentic SDLC Engineering role: writes and reviews code within architecture's boundaries. Launched by the agentic-sdlc Orchestrator, or invoked directly for standalone review/execute."
user-invocable: true
---
Read `~/.copilot/frameworks/agentic-sdlc/agents/engineering.md` and follow it, together with …
```

## Checks

| Check | Tool |
|---|---|
| 3 wrappers per role in §1; `name` matches; body matches the template | `validate.mjs` |
