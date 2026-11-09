---
schema: knowledge-doc/v1
type: reference
topic: ai-agents
status: verified
applies-to: ["Official documentation read 2026-11-07; host-specific behavior"]
last-verified: 2026-11-07
last-updated: 2026-11-07
tags: [skills, subagents, context, portability, prompt-caching]
---

# Subagents: task, context and permission boundaries

## Summary
**TL;DR:** A subagent is a delegated worker with its own task context. Specify its inputs and output explicitly; a separate conversation does not by itself provide a separate filesystem or permission boundary.
**Use this when:** deciding whether a skill should delegate, porting an agent definition, or investigating missing context in a child run.

## Scope
Current documented Claude Code and ChatGPT/Codex behavior, checked 2026-11-07. Think of a skill as a recipe and a subagent as the cook assigned to execute a job. The job ticket must say which ingredients and result are required. Model Context Protocol (MCP) supplies connections to external tools. YAML and TOML are text configuration formats; the examples below are the concrete artifacts.

## Catalog

| Claude Code control | Meaning | Evidence |
|---|---|---|
| Skill `context: fork` | Skill body becomes child task; conversation history is absent; different from forking the conversation | ✅[^skill] |
| Forked skill background | Defaults to background; `background: false` waits; non-interactive execution also waits | ✅[^skill] |
| `agent: Explore` | Forked skill uses Explore's startup context; Explore/Plan omit `CLAUDE.md` | ✅[^skill] |
| Custom definition | `.claude/agents/*.md` or `~/.claude/agents/*.md`; YAML configuration and Markdown system prompt | ✅[^agent] |
| `skills:` | Injects named skills' full bodies at startup; unlisted skills can remain callable | ✅[^agent] |
| Tools | `tools` selects; `disallowedTools` removes; omitted `tools` inherits tools available to subagents | ✅[^agent] |
| Repository isolation | `isolation: worktree` requests a separate checkout; context isolation alone does not | ✅[^agent] |

| OpenAI surface or control | Meaning | Evidence |
|---|---|---|
| Local Codex delegation | Direct request or applicable project/skill instructions | ✅[^openai] |
| ChatGPT Work | Hosted execution; most intelligence levels require explicit delegation; Ultra can delegate proactively | ✅[^openai] |
| Custom Codex definition | `.codex/agents/*.toml` or `~/.codex/agents/*.toml`; requires `name`, `description`, `developer_instructions` | ✅[^openai] |
| Inheritance | Parent permissions, provider, MCP servers and skills; custom files cannot replace inherited permission/provider/server settings | ✅[^openai] |
| Model settings | Custom file wins; otherwise explicit spawn, configured defaults, then parent. Selecting another model without effort can select that model's default effort | ✅[^openai] |
| Capability reduction | Supported feature switches and `skills.config` can disable capabilities; “read-only” prose creates no separate sandbox | ✅[^openai] |
| Concurrency | `[agents].max_concurrent_threads_per_session`; no fixed universal default promised | ✅[^openai] |

## Lookup notes
**Configuration example, not an installed agent:** TOML is a text format for settings. This minimal Codex file deliberately leaves model selection to the session:

```toml
# .codex/agents/evidence-reader.toml
name = "evidence-reader"
description = "Check claims against a supplied source list."
developer_instructions = """
Read the specified draft and sources. Return claim, URL, support/conflict,
and proposed correction. Report missing inputs. Do not edit files.
"""
```

**Design recommendation:** “Do not edit” describes behavior; enforce access restrictions through the host when required. A Git worktree is a separate working checkout, like a second desk for the same project, not a promise that all external tools are restricted.

A delegation ticket that can stand alone:

```text
Task: verify the 12 claims in work/draft.md against work/sources.md.
Ownership: read those files; do not modify any repository file.
Output: claim number, evidence URL, verdict, exact proposed correction.
Missing input: report it instead of inferring prior chat decisions.
Completion: cover all 12 claims and distinguish inaccessible sources.
```

**Proposed failure checks:**

| Situation | What to inspect | Design response |
|---|---|---|
| Child asks what “the earlier decision” means | Actual launch prompt and context mode | Pass the decision as an explicit input |
| Two writers touch one file | Ownership assignments and checkout paths | Separate ownership or serialize changes |
| Child finishes, parent omits findings | Result collection and coverage against assigned jobs | Require one returned status per job |
| Background skill lacks a needed tool | Host's background tool restrictions | Re-check current foreground/background documentation |
| A skill preloads several large guides | Actual injected bodies | Preload only essential material; reference the rest |

Review observation: Anthropic's changelog records a fix for workflow agents receiving forked-skill results in v2.1.295. This supports treating delivery behavior as version-sensitive, not testing only whether a child starts. ✅[^changes]

## Takeaways
- Put task-specific facts in the delegation ticket.
- Keep skill loading, worker creation, result collection and access control as distinct checks.
- Do not translate Claude YAML fields directly into Codex TOML.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 15 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-07

Source verification only: current official pages were read; illustrative configurations were not executed in a product session. Recommendations and worked scenarios are this document's synthesis, not measured product guarantees.

## References
- [Run skills in a subagent](https://code.claude.com/docs/en/skills#run-skills-in-a-subagent) — Anthropic, living. Backs: forked-skill semantics. [^skill]
- [Create custom subagents](https://code.claude.com/docs/en/sub-agents) — Anthropic, living. Backs: Claude definitions, preloading, tools and worktrees. [^agent]
- [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) — OpenAI, living. Backs: surfaces, definitions and inheritance. [^openai]
- [Claude Code changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md) — Anthropic, living; v2.1.295 entry read 2026-11-07. Backs: workflow result-delivery fix. [^changes]
- `copilot/knowledge/ai-agents/claude-code-agents-and-skills.md` — older version-scoped local observations.
- `copilot/procedures/review-docs.procedure.md` — source and meaning review used for this document.

## Related
- [Skill portability](agent-skills-portability.md).
- [Skills, delegation and cache economics](skills-delegation-cache-economics.md).
- [Codex usage reference](codex-usage-reference.md).
