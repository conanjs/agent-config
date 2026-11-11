---
schema: knowledge-doc/v1
type: reference
topic: ai-agents
status: verified
applies-to: ["Claude Code (docs read 2026-11-11)", "Copilot CLI and VS Code Copilot (docs read 2026-11-11)", "Codex (docs read 2026-11-11)"]
last-verified: 2026-11-11
last-updated: 2026-11-11
tags: [memory, context, claude-code, copilot, codex]
---

# Agent memory features: Claude Code, Copilot and Codex

## Summary
**TL;DR:** All three vendors have a memory that the agent writes for itself, and it is not the same thing as instruction files. Claude Code's auto memory loads the first 200 lines or 25 KB of `MEMORY.md` every session; Copilot Memory is a cloud store whose relevant entries are sent and which expire after 90 days without use; Codex's local memories are off until turned on. Rules that must always apply belong in instruction files, not memory.
**Use this when:** deciding where a learned fact should live, finding why a session knows something no file says, or switching memory off for a measurement run.
**Not this doc:** instruction files → [What each coding agent loads at session start](session-start-context-by-agent.md); memory as a context-engineering technique → [Context engineering, end to end](context-engineering-deep-dive.md).

## Scope
Memory here means notes the agent saves on its own and reloads later, like a notebook the worker keeps between shifts, as opposed to the rulebook (instruction files) a person writes. Example: Claude Code saving "this repo's tests run with `scripts/check-docs.sh`" into its project memory folder after a session. Covers the features documented on 2026-11-11.

## Catalog

| Item | Claude Code auto memory | Copilot Memory (CLI, VS Code Copilot harness) | VS Code Local harness memory | Codex local memories | Evidence |
|---|---|---|---|---|---|
| Where it lives | A per-project memory folder: a `MEMORY.md` index plus one topic file per memory | GitHub's cloud service, shared by Copilot CLI, VS Code, cloud agent and code review; repository facts and user preferences | Local files: `/memories/` (user), `/memories/repo/` (workspace), `/memories/session/` (current conversation) | `$CODEX_HOME/memories_v2/` in a fresh home, or the existing `memories/` | ✅[^ccmem][^ghmem][^vsmem][^cxmem] |
| Default | On; `autoMemoryEnabled` or `CLAUDE_CODE_DISABLE_AUTO_MEMORY` turns it off | CLI interactive: follows GitHub settings; CLI programmatic: off, `--enable-memory` per run. VS Code: the VS Code page says on by default (`chat.copilot.memory.enabled`), the GitHub page says off until the local setting is enabled | On, file-based | Off; `[features] memories = true` | ✅[^ccsub][^ghmem][^vsmem][^cxmem] |
| What loads at start | First 200 lines or 25 KB of `MEMORY.md`, whichever comes first; topic files on demand | Not all memories: upvoted ones are more likely to be sent | Recalled as the agent works | Injected when `memories.use_memories` allows | ✅[^ccmem][^ghmem][^cxmem] |
| Turn off per session | — | `/memory off` in an interactive CLI session (kept for later sessions on that machine) | — | `/memories` per chat | ✅[^ghmem][^cxmem] |
| Subagents | The main conversation's memory is not loaded; a subagent's own `memory` field gives it its own | Only the root agent stores or votes; subagents may read with `read_memories` | — | — | ✅[^ccsub][^ghref] |
| Expiry | Memory files are excluded from the transcript clean-up | 90 days without an upvote (7–180 days configurable for repository facts) | Session scope ends with the conversation | Generated in the background after a chat is idle; skipped when the rate limit is low | ✅[^ccmem][^ghmem][^vsmem][^cxmem] |
| Repository-local option | — | VS Code only, experimental: `chat.copilot.memory.local.enabled` stores repository facts in `.github/copilot-memories.jsonl`, which can end up in commits | — | — | ✅[^vsmem] |

## Lookup notes
- **The VS Code default is contradictory in the vendors' own docs.** Check `chat.copilot.memory.enabled` in settings rather than trusting either page.
- **Measurement runs:** memory makes two runs of the same prompt differ. Codex memories are off by default; Copilot CLI programmatic runs (`copilot -p`) have no memory unless `--enable-memory` is passed; a Claude Code run loads `MEMORY.md` unless auto memory is turned off.
- **Where agent-config keeps durable knowledge:** instructions and `copilot/knowledge/`, both under review. Memory is for personal or not-yet-reviewed notes.

## Takeaways
- Promote a memory that the team depends on into an instruction file or a knowledge doc. [rule-candidate]
- Keep Claude Code's `MEMORY.md` to one line per memory, under 200 lines.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 7 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-11

## References
- [How Claude remembers your project](https://code.claude.com/docs/en/memory) — Anthropic, living, read 2026-11-11. Backs: auto memory layout, 200 lines / 25 KB, retention. [^ccmem]
- [Create custom subagents](https://code.claude.com/docs/en/sub-agents) — Anthropic, living, read 2026-11-11. Backs: subagents do not load the main memory; `memory` field; `autoMemoryEnabled`. [^ccsub]
- [About GitHub Copilot Memory](https://docs.github.com/en/copilot/concepts/agents/copilot-memory) — GitHub, living, read 2026-11-11. Backs: scopes, per-surface defaults, `/memory off`, expiry, voting. [^ghmem]
- [GitHub Copilot CLI command reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference) — GitHub, living, read 2026-11-11. Backs: only the root agent stores memories. [^ghref]
- [Use memory with agents in VS Code](https://code.visualstudio.com/docs/agents/run/memory) — Microsoft, living, read 2026-11-11. Backs: VS Code defaults, repository-local store, Local harness memory scopes. [^vsmem]
- [Memories](https://learn.chatgpt.com/docs/customization/memories) — OpenAI, living, read 2026-11-11. Backs: Codex storage, default off, settings, per-chat control. [^cxmem]

## Related
- [What each coding agent loads at session start](session-start-context-by-agent.md)
- [Context engineering, end to end](context-engineering-deep-dive.md)
