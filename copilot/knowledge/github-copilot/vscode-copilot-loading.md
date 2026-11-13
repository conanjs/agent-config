---
schema: knowledge-doc/v1
type: reference
topic: github-copilot
status: verified
applies-to: ["VS Code with GitHub Copilot, docs read 2026-11-11 and 2026-11-13", "Session logs of 2026-11-10"]
last-verified: 2026-11-13
last-updated: 2026-11-13
tags: [vscode, copilot, harness, instructions, skills, agents, memory]
---

# VS Code Copilot: harnesses and what each one loads

## Summary
**TL;DR:** VS Code chat runs one of several harnesses, and each reads different files. The **Copilot** harness is the same runtime as Copilot CLI and reads `~/.copilot/` and `~/.agents/skills`; the **Local** harness is VS Code's own and also reads the Claude folders; **Claude** and **Codex** harnesses read their own products' files. Check which harness a session runs before deciding where a file must go.
**Use this when:** a skill, agent or instruction file works in Copilot CLI or Claude Code but not in VS Code chat, or the other way round; choosing install folders for VS Code.
**Not this doc:** the older hands-on notes on prompt files, frontmatter gotchas and the two repo patterns → [VS Code Copilot setup notes](copilot-prompts-agents-setup.md) (legacy); hooks, AI credits and the stale instruction copy → [GitHub Copilot usage, AI credits and hooks](../ai-agents/copilot-usage-reference.md).

## Scope
GitHub Copilot in VS Code as documented on 2026-11-11, plus what a VS Code session log showed on 2026-11-10. A **harness** is the engine that runs the chat, like choosing which kitchen cooks the same order: the order (your prompt) is identical, but each kitchen has its own pantry (folders). Example: a skill in `~/.claude/skills/` is visible to a Local-harness session but, by the documented table, not to a Copilot-harness one.

## Catalog

### Harnesses

| Harness | What runs | Evidence |
|---|---|---|
| Copilot | The Copilot SDK in VS Code's Agent Host: the shared runtime of GitHub Copilot products, including Copilot CLI | ✅[^har] |
| Local | VS Code's built-in harness in the extension host; the Agent Skills page's location table labels it "Local (deprecated)" (read 2026-11-13) | ✅[^har][^sk] |
| Claude | The Anthropic Claude Agent SDK, using Claude project configuration | ✅[^har] |
| Codex | OpenAI Codex, through its extension or the experimental Agent Host integration | ✅[^har] |

### Instructions

| Harness | Project | Targeted | User | Evidence |
|---|---|---|---|---|
| Copilot | `.github/copilot-instructions.md` or `AGENTS.md` | `.github/instructions/**/*.instructions.md`, nested `AGENTS.md` | `~/.copilot/copilot-instructions.md`, `~/.copilot/instructions/**/*.instructions.md` | ✅[^ins] |
| Claude | `CLAUDE.md` or `.claude/CLAUDE.md` | `.claude/rules` | `~/.claude/CLAUDE.md`, `~/.claude/rules` | ✅[^ins] |
| Codex | `AGENTS.md` | `AGENTS.md` along the path to the working folder | `AGENTS.md` in the Codex home (`~/.codex`) | ✅[^ins] |
| Local | `.github/copilot-instructions.md`, `AGENTS.md` or `CLAUDE.md` | `.github/instructions/**`, `.claude/rules` | The VS Code user profile | ✅[^ins] |
| `applyTo` | Comma-separated globs; no default pattern; `**` means all files. In Local sessions a `description` lets the agent load a file on demand | | | ✅[^ins] |
| Nested `AGENTS.md` in Local | Root file needs `chat.useAgentsMdFile`; nested files also need `chat.useNestedAgentsMdFiles` | | | ✅[^ins] |

### Skills

| Harness | Project | Personal | Evidence |
|---|---|---|---|
| Copilot | `.github/skills/` | `~/.copilot/skills/` | ✅[^sk] |
| Claude | `.claude/skills/` | `~/.claude/skills/` | ✅[^sk] |
| Codex | `.agents/skills/` | `~/.agents/skills/` | ✅[^sk] |
| Local | `.github/skills/`, also `.claude/skills/`, `.agents/skills/` | `~/.copilot/skills/`, also `~/.claude/skills/`, `~/.agents/skills/` | ✅[^sk] |
| Fields | `user-invocable: false` hides it from the `/` menu; `disable-model-invocation: true` stops automatic loading | | ✅[^sk] |
| Forked context | Needs `github.copilot.chat.skillTool.enabled` | | ✅[^sk] |
| `~/.agents/skills/` in the Copilot harness | Read. VS Code's table gives one location per harness, "not every directory it recognizes". GitHub documents `~/.copilot/skills` or `~/.agents/skills` as Copilot's personal skill folders, notes "Supported locations depend on the surface", and lists VS Code agent mode as a surface. A VS Code session on 2026-11-10 (log producer `vscode-copilot-migration`, Copilot runtime events, user hooks from `~/.copilot/hooks/` ran) delivered the `chrome-browser` skill with base directory `~/.agents/skills/synced/…`; `~/.copilot/skills/` does not exist on that machine | ✅[^sk][^ghsk][^ghref][^log] |

### Agents

| Item | Fact | Evidence |
|---|---|---|
| Locations | Workspace `.github/agents` (`.agent.md` or `.md`) and `.claude/agents` (Claude format); user `~/.copilot/agents` and `~/.claude/agents` | ✅[^ag] |
| Picker and delegation | `user-invocable: false` hides an agent from the dropdown; `disable-model-invocation: true` stops other agents from calling it; `infer` is deprecated | ✅[^ag] |
| Copilot-only fields | `skills` (preload), `deferred-tool-loading`, `strict-tools-list`, `include-custom-instructions`, `mcp-servers`, `model-policy` | ✅[^ag] |
| Handoffs | Only in the Local harness | ✅[^ag] |

### Tools and memory

| Item | Fact | Evidence |
|---|---|---|
| Tool limit | 128 tools per request; deselect tools or servers, or use `github.copilot.chat.virtualTools.threshold` | ✅[^tools] |
| Copilot harness memory | Copilot Memory (cloud), setting `chat.copilot.memory.enabled`; details in [Agent memory features](../ai-agents/agent-memory-features.md) | ✅[^mem] |
| Local harness memory | Memory files: `/memories/`, `/memories/repo/`, `/memories/session/` | ✅[^mem] |

## Lookup notes
- **Which harness is running:** VS Code shows it in the session target control; the docs' "Identify your current harness" section lists the signs. A Copilot-harness session writes `~/.copilot/session-state/<id>/events.jsonl` like Copilot CLI ([GitHub Copilot usage](../ai-agents/copilot-usage-reference.md)).
- **Corrections to the legacy notes:** [VS Code Copilot setup notes](copilot-prompts-agents-setup.md) §11 said Copilot CLI has no custom agents; it has them (`~/.copilot/agents/`, `.github/agents/`, `.claude/agents/`, `--agent`), and it reads extra instruction folders through `COPILOT_CUSTOM_INSTRUCTIONS_DIRS`.

## Takeaways
- Install agent-config's skills in `~/.agents/skills/`: Copilot CLI, VS Code's Copilot and Local harnesses and Codex all read it.
- When a VS Code chat ignores a file, check the harness first, then the folder table above.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 24 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-13

## References
- [Choose an agent harness](https://code.visualstudio.com/docs/agents/run/agent-harnesses) — Microsoft, living, read 2026-11-11. Backs: Harnesses. [^har]
- [Custom instructions reference](https://code.visualstudio.com/docs/agents/reference/custom-instructions-reference) — Microsoft, living, read 2026-11-11. Backs: Instructions. [^ins]
- [Agent Skills in VS Code](https://code.visualstudio.com/docs/agent-customization/agent-skills) — Microsoft, living, read 2026-11-11. Backs: Skills. [^sk]
- [Custom agent file reference](https://code.visualstudio.com/docs/agents/reference/custom-agent-file-reference) — Microsoft, living, read 2026-11-11. Backs: Agents. [^ag]
- [Use tools with agents](https://code.visualstudio.com/docs/agent-customization/tools) — Microsoft, living, read 2026-11-11. Backs: tool limit. [^tools]
- [Use memory with agents in VS Code](https://code.visualstudio.com/docs/agents/run/memory) — Microsoft, living, read 2026-11-11. Backs: memory. [^mem]
- [GitHub Copilot CLI command reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference) — GitHub, living, read 2026-11-11. Backs: `~/.agents/skills/` as a personal skill location; CLI custom agents. [^ghref]
- [About agent skills](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills) — GitHub, living, read 2026-11-13. Backs: personal skills in `~/.copilot/skills` or `~/.agents/skills`; locations depend on the surface; VS Code agent mode as a surface. [^ghsk]
- `~/.copilot/session-state/8ca39f25-5e37-4708-922b-87bcfbfd8ccd/events.jsonl` — local VS Code session log, 2026-11-10, searched 2026-11-13: `skill.context_delivered_ref` for `chrome-browser` with base directory under `~/.agents/skills/synced/`; `userPromptSubmitted` hooks. [^log]
- `mapping.yaml` — links `skills/` to `~/.agents/skills` and `~/.claude/skills`.

## Related
- [VS Code Copilot setup notes](copilot-prompts-agents-setup.md) (legacy)
- [What each coding agent loads at session start](../ai-agents/session-start-context-by-agent.md)
- [Agent Skills portability](../ai-agents/agent-skills-portability.md)
