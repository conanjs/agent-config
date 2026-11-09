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

# Agent Skills: portable format and host-specific execution

## Summary
**TL;DR:** A skill is a reusable work recipe. Share the recipe across hosts, but verify each host's discovery, invocation and execution controls separately.
**Use this when:** authoring a skill for both Claude Code and ChatGPT/Codex, or diagnosing why a copied skill behaves differently.

## Scope
The Agent Skills format, Claude Code extensions, and ChatGPT/Codex integration. A **host** is the application that reads and executes the recipe. **Frontmatter** is its configuration label: the YAML block between `---` lines in `SKILL.md`. YAML is a text format for named configuration values. A **plugin** is an installable package, like a delivery box containing one or more recipes and their tools.

## Catalog

| Portable item | Constraint or purpose | Evidence |
|---|---|---|
| Required file | Directory containing `SKILL.md`: YAML header, then Markdown instructions | ✅[^spec] |
| `name` | 1–64 characters; lowercase alphanumeric/hyphens; matches directory; no leading, trailing or consecutive hyphens | ✅[^spec] |
| `description` | 1–1024 characters; what the skill does and when to use it | ✅[^spec] |
| Optional header fields | `license`, `compatibility` (≤500 characters), `metadata` (string map), experimental `allowed-tools` (space-separated) | ✅[^spec] |
| Supporting files | `scripts/`, `references/`, `assets/`; relative references; avoid deep reference chains | ✅[^spec] |
| Progressive disclosure | Load metadata, then selected instructions, then needed resources; recommended body below 500 lines / 5,000 tokens | ✅[^spec] |

| Host concern | Claude Code | ChatGPT / Codex | Evidence |
|---|---|---|---|
| Local discovery | `.claude/skills/`, `~/.claude/skills/` | Codex: ancestor `.agents/skills/` through repository root; user `~/.agents/skills/`; admin `/etc/codex/skills`; bundled system skills | ✅[^claude][^openai] |
| Explicit invocation | `/skill-name` | ChatGPT `@`; Codex command-line interface (CLI) / editor `$skill-name`, `/skills` | ✅[^claude][^openai] |
| Prevent implicit invocation | `disable-model-invocation: true` | `agents/openai.yaml`: `policy.allow_implicit_invocation: false` (default true) | ✅[^claude][^openai] |
| Hide from manual menu | `user-invocable: false`; model may still invoke | Build skills documents no field that hides a skill from the menu | ✅[^claude][^openai] |
| Skill execution in child | `context: fork`, optional `agent` | Build skills documents no fork or subagent field; use the host's delegation mechanism | ✅[^claude][^openai] |
| Large initial catalog | Description budget is separate from loaded body | Codex defaults to 2% of context, or 8,000 characters if unknown; `skills.max_context_tokens` up to 10,000; descriptions can shorten and skills can be omitted | ✅[^openai] |
| Extra metadata | Host-specific frontmatter | `agents/openai.yaml`: appearance, invocation policy, tool dependencies | ✅[^openai] |

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

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 13 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-07

Source verification only: current official pages were read; illustrative configurations were not executed in a product session. Recommendations and worked scenarios are this document's synthesis, not measured product guarantees.

## References
- [Specification](https://agentskills.io/specification) — Agent Skills, living. Backs: portable format and progressive disclosure. [^spec]
- [Extend Claude with skills](https://code.claude.com/docs/en/skills) — Anthropic, living. Backs: Claude invocation and extensions. [^claude]
- [Build skills](https://learn.chatgpt.com/docs/build-skills) — OpenAI, living. Backs: discovery, catalog budget and OpenAI metadata. [^openai]
- `skills/review-docs/SKILL.md` — local example of a thin wrapper around a shared procedure.
- `copilot/procedures/review-docs.procedure.md` — source and meaning review used for this document.

## Related
- [Subagent execution boundaries](subagent-execution-boundaries.md).
- [Skills, delegation and cache economics](skills-delegation-cache-economics.md).
- [Claude Code installation and historical tests](claude-code-agents-and-skills.md).
