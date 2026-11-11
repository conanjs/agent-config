---
schema: knowledge-doc/v1
type: reference
topic: ai-agents
status: verified
applies-to: ["Official documentation read 2026-11-07 (Claude Code, Codex) and 2026-11-11 (all four hosts); host-specific behavior"]
last-verified: 2026-11-11
last-updated: 2026-11-11
tags: [skills, subagents, context, portability, prompt-caching]
---

# Agent Skills: portable format and host-specific execution

## Summary
**TL;DR:** A skill is a reusable work recipe. Share the recipe across hosts, but verify each host's discovery, invocation and execution controls separately.
**Use this when:** authoring a skill for Claude Code, ChatGPT/Codex and GitHub Copilot, or diagnosing why a copied skill behaves differently.

## Scope
The Agent Skills format, Claude Code extensions, ChatGPT/Codex integration, and GitHub Copilot (CLI and VS Code; added 2026-11-11). A **host** is the application that reads and executes the recipe. **Frontmatter** is its configuration label: the YAML block between `---` lines in `SKILL.md`. YAML is a text format for named configuration values. A **plugin** is an installable package, like a delivery box containing one or more recipes and their tools.

## Catalog

| Portable item | Constraint or purpose | Evidence |
|---|---|---|
| Required file | Directory containing `SKILL.md`: YAML header, then Markdown instructions | ✅[^spec] |
| `name` | 1–64 characters; lowercase alphanumeric/hyphens; matches directory; no leading, trailing or consecutive hyphens | ✅[^spec] |
| `description` | 1–1024 characters; what the skill does and when to use it | ✅[^spec] |
| Optional header fields | `license`, `compatibility` (≤500 characters), `metadata` (string map), experimental `allowed-tools` (space-separated) | ✅[^spec] |
| Supporting files | `scripts/`, `references/`, `assets/`; relative references; avoid deep reference chains | ✅[^spec] |
| Progressive disclosure | Load metadata, then selected instructions, then needed resources; recommended body below 500 lines / 5,000 tokens | ✅[^spec] |

| Host concern | Claude Code | ChatGPT / Codex | Copilot CLI | VS Code Copilot | Evidence |
|---|---|---|---|---|---|
| Local discovery | `.claude/skills/`, `~/.claude/skills/` | Codex: ancestor `.agents/skills/` through repository root; user `~/.agents/skills/`; admin `/etc/codex/skills`; bundled system skills | Project `.github/skills/`, `.agents/skills/`, `.claude/skills/`, parent `.github/skills/`; personal `~/.copilot/skills/`, `~/.agents/skills/`; plugins; `COPILOT_SKILLS_DIRS`; first found wins for a duplicate name | Per harness: Copilot `.github/skills/`, `~/.copilot/skills/`; Local adds `.claude/` and `.agents/` folders ([VS Code Copilot loading](../github-copilot/vscode-copilot-loading.md)) | ✅[^claude][^openai][^ghref][^vscode] |
| Explicit invocation | `/skill-name` | ChatGPT `@`; Codex command-line interface (CLI) / editor `$skill-name`, `/skills` | `/skill-name` in the prompt | `/skill-name` | ✅[^claude][^openai][^ghref][^vscode] |
| Prevent implicit invocation | `disable-model-invocation: true` | `agents/openai.yaml`: `policy.allow_implicit_invocation: false` (default true) | `disable-model-invocation: true` (default false) | `disable-model-invocation: true` | ✅[^claude][^openai][^ghref][^vscode] |
| Hide from manual menu | `user-invocable: false`; model may still invoke | Build skills documents no field that hides a skill from the menu | `user-invocable: false` | `user-invocable: false` | ✅[^claude][^openai][^ghref][^vscode] |
| Turn off without editing the file | `skillOverrides` in settings: `on`, `name-only` (listed without description), `user-invocable-only`, `off`; plugin skills are not affected, manage them with `/plugin` | `[[skills.config]]` with `path` or `name` and `enabled = false`; `[skills.bundled] enabled = false` | `copilot skill disable <name>`, `/skills`; `ignoredSkillsLocations` excludes folders | No setting documented; remove the folder or set `disable-model-invocation` | ✅[^claude][^openai][^ghref][^vscode] |
| Skill execution in child | `context: fork`, optional `agent` | Build skills documents no fork or subagent field; use the host's delegation mechanism | Not documented | Forked context with `github.copilot.chat.skillTool.enabled` | ✅[^claude][^openai][^vscode] |
| Preload into a subagent | Agent `skills:` field; a skill with `disable-model-invocation: true` cannot be preloaded | No such field | Not documented | Copilot-harness agent `skills` field | ✅[^claude][^vscode] |
| Large initial catalog | Listing budget is 1% of the context window in characters (`skillListingBudgetFraction`, `SLASH_COMMAND_TOOL_CHAR_BUDGET`); every name stays, descriptions of the least-invoked skills drop first; `description` + `when_to_use` capped at 1,536 characters (`skillListingMaxDescChars`); separate from the loaded body | Codex defaults to 2% of context, or 8,000 characters if unknown; `skills.max_context_tokens` up to 10,000; descriptions can shorten and skills can be omitted | No budget stated; `description` max 1,024 characters | No budget stated; name and description load first, body and resources only when used | ✅[^claude][^openai][^ghref][^vscode] |
| After compaction | The latest invocation of each skill is re-attached: its first 5,000 tokens, 25,000 tokens for all together | Not documented | Not documented | Not documented | ✅[^claude] |
| Extra metadata | Host-specific frontmatter | `agents/openai.yaml`: appearance, invocation policy, tool dependencies | `argument-hint`, `allowed-tools` | `argument-hint` and other VS Code fields | ✅[^openai][^ghref][^vscode] |

## Lookup notes
**Design recommendation:** keep the shared workflow independent of invocation syntax. Put essential scope and trigger words first in the description. A valid file is only the first acceptance check; successful routing and useful output are separate checks.

Illustrative portable artifact, `review-evidence/SKILL.md`:

```markdown
---
name: review-evidence
description: Check a supplied draft against its cited sources. Use for evidence review; exclude copyediting-only requests.
---
Read the supplied draft and its source list.
For each factual claim, open the cited source and record support or conflict.
Return a table with claim, evidence URL, verdict, and proposed correction.
Do not invent missing evidence. Report inaccessible sources separately.
```

Suggested acceptance cases for this recipe (a proposed test design, not executed):

| Input | Expected decision | Expected artifact |
|---|---|---|
| “Check these claims against their sources” | Select the skill | Evidence table, including unsupported claims |
| “Fix commas in this paragraph” | Do not select implicitly | Ordinary copyedit |
| Explicit invocation with an inaccessible source | Run within available evidence | Inaccessible-source finding, not a fabricated verdict |
| Same name installed twice | Inspect the host's selected path | Recorded actual definition, not an assumed merge |

**Interpretation:** the standard's experimental tool declaration is not proof of identical permission enforcement across hosts. Treat tool policy as an integration test. Model Context Protocol (MCP) connects a host to external tools; listing a dependency is like listing an ingredient, not evidence that credentials or access already work.

## Takeaways
- Keep one canonical recipe and small host-specific adapters.
- Test discovery, trigger selection, task completion and permission behavior separately.
- Re-check host extensions before copying configuration between products.
- In Claude Code, hide a skill from the list with `skillOverrides: name-only` or `disable-model-invocation`, but not a skill that a subagent preloads.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 16 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-11

Source verification only: current official pages were read; illustrative configurations were not executed in a product session. Recommendations and worked scenarios are this document's synthesis, not measured product guarantees.

## References
- [Specification](https://agentskills.io/specification) — Agent Skills, living. Backs: portable format and progressive disclosure. [^spec]
- [Extend Claude with skills](https://code.claude.com/docs/en/skills) — Anthropic, living, re-read 2026-11-11. Backs: Claude invocation, extensions, listing budget, `skillOverrides`, compaction re-attach, preloading limit. [^claude]
- [Build skills](https://learn.chatgpt.com/docs/build-skills) — OpenAI, living, re-read 2026-11-11. Backs: discovery, catalog budget, `[[skills.config]]` and OpenAI metadata. [^openai]
- [GitHub Copilot CLI command reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference) — GitHub, living, read 2026-11-11. Backs: Copilot CLI skill fields, locations, `copilot skill`, `ignoredSkillsLocations`. [^ghref]
- [Agent Skills in VS Code](https://code.visualstudio.com/docs/agent-customization/agent-skills) — Microsoft, living, read 2026-11-11. Backs: VS Code locations per harness, fields, loading levels, forked context. [^vscode]
- `skills/review-docs/SKILL.md` — local example of a thin wrapper around a shared procedure.
- `copilot/procedures/review-docs.procedure.md` — source and meaning review used for this document.

## Related
- [Subagent execution boundaries](subagent-execution-boundaries.md).
- [Skills, delegation and cache economics](skills-delegation-cache-economics.md).
- [Claude Code installation and historical tests](claude-code-agents-and-skills.md).
- [What each coding agent loads at session start](session-start-context-by-agent.md).
