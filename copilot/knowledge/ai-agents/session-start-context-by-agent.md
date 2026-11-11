---
schema: knowledge-doc/v1
type: reference
topic: ai-agents
status: draft
applies-to: ["Claude Code 2.1.319", "Copilot CLI 1.0.107", "VS Code Copilot (docs read 2026-11-11)", "Codex CLI 0.166", "Official documentation read 2026-11-11"]
last-verified: 2026-11-11
last-updated: 2026-11-11
tags: [context, skills, subagents, mcp, memory, instructions, token-cost]
---

# What each coding agent loads at session start

## Summary
**TL;DR:** Every request of a session carries the same start-up block: instructions, the skill list, the agent list, tool definitions and memory. It is paid on every request, not once. Each part has its own size limit and its own switch, and they differ between Claude Code, Copilot CLI, VS Code Copilot and Codex. On this machine the skill list (9,900 tokens in Claude Code) is the largest part that configuration alone can shrink.
**Use this when:** deciding which skills, agents, plugins or MCP servers to install globally; explaining why a session starts large; choosing the setting that removes something from the start-up block.
**Not this doc:** how a skill is written → [Agent Skills portability](agent-skills-portability.md); what a subagent inherits → [Subagent execution boundaries](subagent-execution-boundaries.md); plugins and MCP in detail → [Plugins and MCP loading](agent-plugins-and-mcp-loading.md); memory in detail → [Agent memory features](agent-memory-features.md); how cache and compaction price this block → [Token accounting](agent-token-accounting.md).

## Scope
The four surfaces agent-config installs into: Claude Code, GitHub Copilot CLI, GitHub Copilot in VS Code (its Copilot and Local harnesses) and Codex CLI. A **harness** is the engine that runs the chat, like the kitchen that cooks a recipe: VS Code can run the Copilot harness (the same runtime as Copilot CLI), its older Local harness, or Claude and Codex harnesses. The **start-up block** is everything sent before the first user message; think of it as the briefing pack handed to a worker every time they are asked anything. Example: a Claude Code session in this repo with no user text already holds the global `CLAUDE.md`, this repo's `AGENTS.md`, about 100 skill names and descriptions, 12 agent descriptions and the MCP tool names.

## Catalog

### Instructions

| Item | Claude Code | Copilot CLI | VS Code Copilot | Codex | Evidence |
|---|---|---|---|---|---|
| Loaded at launch | `CLAUDE.md` / `CLAUDE.local.md` in the working folder and above, user `~/.claude/CLAUDE.md`, `.claude/rules/` files without `paths:` | `~/.copilot/copilot-instructions.md`, `~/.copilot/instructions/**`, and `.github/copilot-instructions.md`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md` from the repository root, working folder and folders between | User instructions (`~/.copilot/instructions`) and repository instructions; see [VS Code Copilot loading](../github-copilot/vscode-copilot-loading.md) | `~/.codex/AGENTS.md` and `AGENTS.md` from the project root down to the working folder | ✅[^ccmem][^ghinst][^vsins] |
| Loaded later, on demand | `CLAUDE.md` in subfolders, once a file there is read; `.claude/rules/` with `paths:` when a matching file is read | `*.instructions.md` only when its `applyTo` matches a file being worked on | `applyTo` match; in the Local harness also a file the agent picks by its `description` | Nested `AGENTS.md` | ✅[^ccmem][^ghinst][^vsins] |
| `AGENTS.md` | Read only when no `CLAUDE.md` or `CLAUDE.local.md` is in the working folder or above (default; v2.1.277+) | Always read | Read | Native | ✅[^ccmem][^ghinst] |
| `@path` imports | Expanded, at most four hops; imports do not reduce the cost, the imported text loads too | Expanded in `copilot-instructions.md`, `AGENTS.md`, `CLAUDE.md`; only paths inside the repository; `~/` and absolute paths are not loaded | — | No import syntax | ✅[^ccmem][^ghinst] |
| Size limit | Whole file up to 4 MiB; skipped entirely above it | Not stated | Not stated | 32 KiB project-doc limit ([Codex usage reference](codex-usage-reference.md)) | ✅[^ccmem] |
| After compaction | Project-root `CLAUDE.md` is re-read from disk; nested files and path rules reload on demand | Not stated | Not stated | See [Codex usage reference](codex-usage-reference.md) | ✅[^ccmem] |

### Skill list

| Item | Claude Code | Copilot CLI | VS Code Copilot | Codex | Evidence |
|---|---|---|---|---|---|
| What is listed | Name and description of every skill the model may invoke, plus every plugin skill, on every turn | Skills from every enabled location, by name and description | Name and description first; body and resources only when used ("three-level loading") | Name, description and file path | ✅[^ccsk][^ghref][^vssk][^cxsk] |
| Budget | 1% of the context window, counted in characters; `/context` shows the size after the budget is applied (since v2.1.196) | Not stated | Not stated | 2% of the context window, or 8,000 characters if unknown; `skills.max_context_tokens` up to 10,000 | ✅[^ccsk][^cxsk] |
| Over budget | Every name stays; descriptions of the least-invoked skills are dropped first; a warning goes to the `--debug` log | Not stated | Not stated | Descriptions shortened first, then skills may be left out, with a warning | ✅[^ccsk][^cxsk] |
| Per-entry cap | `description` + `when_to_use`: 1,536 characters (`skillListingMaxDescChars`) | `description` max 1,024 characters | — | — | ✅[^ccsk][^ghref] |
| Keep a skill out of the list | `disable-model-invocation: true`; or `skillOverrides`: `name-only`, `user-invocable-only`, `off` (not for plugin skills) | `disable-model-invocation: true`; `copilot skill disable <name>`; `ignoredSkillsLocations` | `disable-model-invocation: true` | `[[skills.config]] enabled = false` (by path or name); `[skills.bundled] enabled = false` | ✅[^ccsk][^ghref][^vssk][^cxsk] |

### Agent list

| Item | Claude Code | Copilot CLI | VS Code Copilot | Codex | Evidence |
|---|---|---|---|---|---|
| What is listed | Description of every subagent | Description, shown in the agent list and the `task` tool | Agents in the picker; `description` drives delegation | Agent definitions in `~/.codex/agents/` | ✅[^ccsub][^ghref][^vsag] |
| Limit | Startup warning when the combined descriptions of non-built-in subagents exceed 15,000 tokens; every agent still loads | Not stated | Not stated | Not stated | ✅[^ccsub] |
| Keep an agent from being chosen automatically | — (ask by name instead) | `infer: false` | `disable-model-invocation: true` (`infer` is deprecated) | — | ✅[^ghref][^vsref] |

### Tools, memory and hooks

| Item | Claude Code | Copilot CLI | VS Code Copilot | Codex | Evidence |
|---|---|---|---|---|---|
| MCP tools | Tool search on by default: only tool names and server instructions at start | Tool search with per-server `deferTools` (`auto` default, `never`) | At most 128 tools per request; virtual tools above `github.copilot.chat.virtualTools.threshold` | `enabled_tools` / `disabled_tools` per server | ✅[^ccmcp][^ghref][^vstools][^cxmcp] |
| Memory at start | First 200 lines or 25 KB of `MEMORY.md` | Copilot Memory: relevant memories, not all of them | Copilot Memory (Copilot harness) or memory files (Local harness) | Local memories, off by default | ✅[^ccmem]; details in [Agent memory features](agent-memory-features.md) |
| Hooks | A `SessionStart` hook's output is added to the start-up block | `sessionStart` and other hooks | Same hook files as Copilot CLI | `hooks.json` | See [Copilot usage reference](copilot-usage-reference.md) |

### Measured on this machine

| Measurement | Value | How | Evidence |
|---|---|---|---|
| Claude Code skill list | 9,900 tokens: Postman plugin 19 skills ≈ 2,870; built-in 16 ≈ 2,580; synced from claude.ai 28 ≈ 1,860; agent-config `skills/` 20 ≈ 1,670; product-management plugin 9 ≈ 900; cowork plugin-management 2 ≈ 240 | `/context all`, Claude Code, 2026-11-10 | ✅ |
| Of which the 13 `sdlc-*` skills | ≈ 824 tokens | Same run | ✅ |
| Tracker session-start hook | 1,952 → 615 tokens after TR-11 capped the brief at 5 items | Hook output counted with `o200k_base`, 2026-11-10 | ✅ |
| claude.ai connectors (Claude Code) | Present in some runs and missing in others; moved the first request by about 4,000 tokens until `--strict-mcp-config` was used | Level-1 runs, 2026-11-09 (`proposals/instruction-loading.md`) | ✅ |
| Synced claude.ai skills outside Claude Code | Listed in Copilot CLI 1.0.107 (2026-11-10), in a VS Code Copilot session (2026-11-10) and in Codex `exec` runs (0.166.0-alpha.6, 2026-11-09) | Session logs searched for a synced skill's name. Cause: agent-config links both `~/.claude/skills` and `~/.agents/skills` to the repo's `skills/`, and Claude Code downloads synced skills into `skills/synced/`; `~/.agents/skills` is a personal skill folder for Copilot CLI and Codex | ✅ |
| Whether the 9,900-token list is already cut | Not known. 9,900 tokens is close to 1% of a 1,000,000-token window, but the budget is counted in characters and `/context` reports the size after cutting | `/doctor` estimates it; `--debug` logs a warning when over budget. `claude -p "/doctor"` did not finish in print mode (2026-11-11) | ⚠️ unverified |

## Lookup notes
- **The same folder feeds three agents.** A skill placed in agent-config's `skills/` reaches Claude Code, Copilot CLI, VS Code's Copilot harness and Codex. So do the claude.ai skills that Claude Code syncs into `skills/synced/`. Turning sync off (`syncClaudeAiSkills: false`) therefore shortens all four lists, not only Claude Code's.
- **Cutting the list, by effect on all four agents:** removing a skill from `skills/` or installing it per project works everywhere. `disable-model-invocation: true` works in Claude Code, Copilot CLI and VS Code but in Claude Code also stops the skill being preloaded into subagents ([Agent Skills portability](agent-skills-portability.md)). `skillOverrides`, `[[skills.config]]` and `copilot skill disable` each work in one agent only.
- **"Not stated" means the official page gives no number.** Measure it with a cheap model on Copilot CLI or Codex before relying on it.

## Takeaways
- Install global skills and agents only when they are used in most repos; everything else belongs in the project folders that use it. [rule-candidate]
- Put a skill's trigger words first in its description: Claude Code cuts at 1,536 characters and Codex shortens descriptions first when the list is over budget.
- Count the start-up block once per agent (`/context` in Claude Code and Copilot CLI) after any install change.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 21 claims (✅) · Unverified: 1 claim (⚠️) · Last verified: 2026-11-11

## References
- [How Claude remembers your project](https://code.claude.com/docs/en/memory) — Anthropic, living, read 2026-11-11. Backs: instruction loading, imports, `AGENTS.md`, size limit, compaction, `MEMORY.md` limit. [^ccmem]
- [Extend Claude with skills](https://code.claude.com/docs/en/skills) — Anthropic, living, read 2026-11-11. Backs: skill-list budget, cut order, per-entry cap, `skillOverrides`. [^ccsk]
- [Create custom subagents](https://code.claude.com/docs/en/sub-agents) — Anthropic, living, read 2026-11-11. Backs: 15,000-token description warning. [^ccsub]
- [Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp) — Anthropic, living, read 2026-11-11. Backs: tool search default. [^ccmcp]
- [Adding custom instructions for GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions) — GitHub, living, read 2026-11-11. Backs: Copilot CLI instruction files, `applyTo`, `@` references. [^ghinst]
- [GitHub Copilot CLI command reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference) — GitHub, living, read 2026-11-11. Backs: skill fields and locations, `ignoredSkillsLocations`, agent fields, `deferTools`. [^ghref]
- [Custom instructions reference](https://code.visualstudio.com/docs/agents/reference/custom-instructions-reference) — Microsoft, living, read 2026-11-11. Backs: VS Code `applyTo` and `description`; the Codex instruction chain. [^vsins]
- [Agent Skills in VS Code](https://code.visualstudio.com/docs/agent-customization/agent-skills) — Microsoft, living, read 2026-11-11. Backs: VS Code skill loading levels and fields. [^vssk]
- [Custom agents in VS Code](https://code.visualstudio.com/docs/agent-customization/custom-agents) — Microsoft, living, read 2026-11-11. Backs: picker and delegation. [^vsag]
- [Custom agent file reference](https://code.visualstudio.com/docs/agents/reference/custom-agent-file-reference) — Microsoft, living, read 2026-11-11. Backs: `disable-model-invocation`, deprecated `infer`. [^vsref]
- [Use tools with agents](https://code.visualstudio.com/docs/agent-customization/tools) — Microsoft, living, read 2026-11-11. Backs: 128-tool limit, virtual tools. [^vstools]
- [Build skills](https://learn.chatgpt.com/docs/build-skills) — OpenAI, living, read 2026-11-11. Backs: Codex skill list, budget, `[[skills.config]]`. [^cxsk]
- [Model Context Protocol](https://learn.chatgpt.com/docs/extend/mcp) — OpenAI, living, read 2026-11-11. Backs: `enabled_tools`, `disabled_tools`. [^cxmcp]
- `mapping.yaml` — links `skills/` to both `~/.claude/skills` and `~/.agents/skills`.
- `proposals/instruction-loading.md` — the level-1 runs that found the connector variance.
- `copilot/tracker/tracker.schema.md` — TR-11, the tracker brief cap.

## Related
- [Agent Skills portability](agent-skills-portability.md)
- [Subagent execution boundaries](subagent-execution-boundaries.md)
- [Plugins and MCP loading](agent-plugins-and-mcp-loading.md)
- [Agent memory features](agent-memory-features.md)
- [VS Code Copilot loading](../github-copilot/vscode-copilot-loading.md)
- [Token accounting in coding agents](agent-token-accounting.md)
