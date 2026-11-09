# codex/

Codex CLI's files in this repo. `mapping.yaml` deploys them to `~/.codex/` (`%USERPROFILE%\.codex\` on Windows).

| File | Deployed to | What it is |
|---|---|---|
| `hooks.json` | `~/.codex/hooks.json` | Codex hooks: the tracker brief at session start, the turn-token report, the workflow guard |
| `agents/*.toml` | `~/.codex/agents/` | `sdlc-*` role wrappers |
| (none) | `~/.codex/AGENTS.md` | Linked straight to `copilot/instructions/core.instructions.md`, the core every agent loads (decision D2 in `proposals/instruction-loading.md`) |

## Why `~/.codex/AGENTS.md` is the core itself

Until 2026-11-09, `~/.codex/AGENTS.md` was `codex/AGENTS.md`, a pointer asking Codex to read three instruction files, because Codex has no import syntax. Codex followed it every time: in a benchmark on 2026-11-07 (Codex CLI 0.166.0-alpha.6), it ran `cat` on all three files at the start of all 10 sessions, a one-line email included. The reads cost more than the files' size, because each read adds a model request that sends the whole context again: the email took about 51,100 input tokens with the pointer and about 22,500 with a short core written into `AGENTS.md` itself. So since 2026-11-09 the core file is linked as `AGENTS.md`; Codex reads its front matter as plain text (about 20 tokens). The note explaining this used to sit inside the pointer file, where it reached the model in every Codex session (decision D8).

## References

**Local artifacts:**
- `mapping.yaml` — deploys `copilot/instructions/core.instructions.md` to `~/.codex/AGENTS.md`.
- `copilot/knowledge/ai-agents/codex-usage-reference.md`, section "Global instructions that point to other files" — the 2026-11-07 benchmark.
- `proposals/instruction-loading.md` — the measurements and decisions behind the core.

**External authoritative sources:**
- [Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md) — confirms `~/.codex/AGENTS.md` is Codex's global instructions file, read before project-level `AGENTS.md`.

## Related

- `claude/CLAUDE.md` — Claude Code's entry point, which imports the same core.
