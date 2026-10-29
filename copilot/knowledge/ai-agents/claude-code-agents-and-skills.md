---
schema: knowledge-doc/v1
type: reference
topic: ai-agents
status: verified
applies-to: ["Claude Code 2.1.129 (CLI), and the docs read 2026-10-29"]
last-verified: 2026-10-29
last-updated: 2026-10-29
tags: [claude-code, subagents, skills, install, synced]
---

# Claude Code subagents and skills: where they load and how to call them

## Summary
**TL;DR:** User-level agents load from `~/.claude/agents/` and project agents from `.claude/agents/`. Call one by asking for it by name, by `@`-mentioning it, or by running a whole session as it with `claude --agent <name>`. `~/.claude/skills/` can also hold a `synced/` folder with the skills enabled on claude.ai; replacing `~/.claude/skills` with a link moves that folder, and the next session did not download it again.
**Use this when:** installing agents or skills into a home folder, or calling an agent in Claude Code.
**Not this doc:** how agent-config's installer works → `README.md` "Install strategies"; what each `sdlc-*` agent does → `{{AGENT_HOME}}/frameworks/agentic-sdlc/index.md`.

## Scope
Claude Code's user and project agent folders, the four ways to call an agent, and the `~/.claude/skills/synced/` folder, as documented on 2026-10-29 and as tested on this machine with Claude Code 2.1.129.

## Catalog

| Item | Behaviour | Status |
|---|---|---|
| User agents | `~/.claude/agents/`, available in all projects; project agents in `.claude/agents/` | ✅ [^1] |
| Ask by name | "Use the sdlc-coordinator agent to …"; Claude delegates | ✅ [^1] |
| `@`-mention | Pick it after typing `@`, or type `@agent-<name>`; that agent runs, not Claude's choice | ✅ [^1] |
| `@` in the Claude desktop app (Code tab) | The picker offered only files for `@agent-sdlc-coor`, though the agent was loaded (listed as a subagent the session could launch): observed 2026-10-29. Ask for the agent by name there, or use the terminal CLI | ✅ |
| A session as the agent | `claude --agent <name>`, or the `agent` setting; the flag wins | ✅ [^1] |
| New agent files | Picked up within seconds, no restart; except the first file in an `agents` folder that did not exist when the session started | ✅ [^1] |
| `skills:` in an agent | Preloads those skills' full text into the agent; other skills stay callable | ✅ [^1] |
| `~/.claude/skills/synced/` | The skills enabled on claude.ai, downloaded per account (`synced/<account>/<skill>/`); the `syncClaudeAiSkills` setting turns the download off | ✅ [^2] |
| Moving `synced/` away | Not downloaded again by the next session: tested 2026-10-29 by replacing `~/.claude/skills` with a link (the folder went to a backup) and running `claude -p` with 2.1.129; no `synced/` appeared within a minute | ✅ |

## Lookup notes
- An installer that links the whole `~/.claude/skills` folder to a repo moves `synced/` into its backup. agent-config's installer does this on purpose (V, 2026-10-29: the synced skills are minor and come back once used); the per-skill alternative was built, tested and withdrawn (`specs/011`). To keep a copy, take it from the install run's backup folder.
- To call the agent-config coordinator: in the terminal CLI, `@agent-sdlc-coordinator where is …` or `claude --agent sdlc-coordinator` for a whole session; in the desktop app, "Use the sdlc-coordinator agent: where is …".

## Takeaways
- Linking the whole `~/.claude/skills` folder moves the claude.ai `synced/` skills aside; link each skill instead when they must stay.
- Use `@agent-<name>` when a specific agent must answer; plain requests let Claude choose.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 9 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-29

## References
- [Create custom subagents](https://code.claude.com/docs/en/sub-agents) — Anthropic, living. Backs: Catalog rows 1–6. [^1]
- Claude Code settings schema, `syncClaudeAiSkills`: "previously synced skills (~/.claude/skills/synced) can no longer be run" when off — read from the settings JSON schema bundled with Claude Code, 2026-10-29. Backs: Catalog row 7. [^2]
- `specs/011-installer-link-each/research.md` in agent-config — the test of moving `synced/`, and why `link-each` was added.

## Related
- `ai-agents/graph-engineering-study-guide.md`
