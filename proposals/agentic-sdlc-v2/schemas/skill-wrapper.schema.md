---
schema: schema/v1
last-updated: 2026-10-04
---

# Schema: Skill Wrapper (`skill-wrapper/v1`)

**Applies to:** `skills/<name>/SKILL.md` for `agentic-sdlc`, `sdlc-<role>-preset`, `sdlc-stack-<id>`, `sdlc-paradigm-<id>` · **Store:** A (tool adapters) · **Written by:** framework maintainer · **Read by:** tools that support skills (Claude Code, Copilot, Codex) · **Loaded as:** the delivery channel for ① and ②

A skill is a **named bundle of reading instructions**. It tells an agent which framework files to read. It never contains the rules itself. Skills are how ① and ② reach an agent in tools that preload skills. In other tools, the launch prompt passes the same paths directly.

## Front-matter

Fixed by the Agent Skills format: `name`, `description`. The framework's `schema:` key is **not** added.

## The four skill kinds

| Kind | Name | Reads | Named where |
|---|---|---|---|
| Entry | `agentic-sdlc` | `agents/orchestrator.md`, `conventions.md` | user invokes it |
| Role preset (①) | `sdlc-<role>-preset` | the role's Preset list, in order | Claude wrapper `skills:` |
| Stack (②) | `sdlc-stack-<id>` | `stacks/<id>/index.md`, `idioms.md`, plus the `frameworks/<fw>.md` named in the task | launch prompt `profiles.stack` |
| Paradigm (②) | `sdlc-paradigm-<id>` | `paradigms/<id>.md`, plus the overlay `stacks/<stack>/paradigms/<id>.md` for the task's stack | launch prompt `profiles.paradigm` |

## Required structure

```markdown
---
name: <name>
description: "<what it equips; when to use it — the text tools match on for auto-loading>"
---

Read and apply, in this order:
1. `~/.copilot/frameworks/agentic-sdlc/<path>`
2. …

(On Windows `~/.copilot` is `%USERPROFILE%\.copilot`.)
<one line on how this skill combines with the others, e.g. "These say WHAT; the stack skill says HOW in your language.">
```

## Rules

- A role preset skill's list must equal the role file's Preset table, in the same order. The validator compares them, so the two can't drift.
- No rule text in a skill. If you're tempted to write a rule here, it belongs in a foundation, stack or paradigm file.
- `description` says when to use the skill, because tools match on it (Agent Skills docs).

## Example

```markdown
---
name: sdlc-paradigm-class-modeled
description: "Agentic SDLC paradigm profile: class-modeled (rich domain objects, constructor-injected services). Use when a task's component or layer has paradigm: class-modeled."
---
Read and apply, in this order:
1. `~/.copilot/frameworks/agentic-sdlc/paradigms/class-modeled.md`
2. `~/.copilot/frameworks/agentic-sdlc/stacks/<stack>/paradigms/class-modeled.md` (stack = the task's `profiles.stack`)
```

## Checks

| Check | Tool |
|---|---|
| A preset skill's list equals the role's Preset table | `validate.mjs` |
| One stack skill per `stacks/<id>/`; one paradigm skill per `paradigms/<id>.md` | `validate.mjs` |

## References

**External authoritative sources:**
- [Agent Skills overview](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview): the `SKILL.md` format and how `description` drives loading.
- [Claude Code subagents: `skills` frontmatter](https://docs.claude.com/en/docs/claude-code/sub-agents): how a subagent preloads skills.
