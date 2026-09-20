# Global preferences

Read and follow these files for operating preferences and this environment's shared knowledge base — they're the same files Claude Code and GitHub Copilot CLI already follow, not Codex-specific duplicates:

- `~/.copilot/instructions/personal-defaults.instructions.md` — response style, path variables (`{{AGENT_HOME}}` etc.), the Company KB Framework pointer, and everything else that follows from it.
- `~/.copilot/instructions/answer-patterns.instructions.md` — named response structures.
- `~/.copilot/instructions/code-review-graph.instructions.md` — code-review-graph MCP tool usage.

**Note on this integration:** unlike the macOS/Windows install scripts (tested end-to-end against real installs) and Copilot CLI's own native loading of `~/.copilot/instructions/*.instructions.md` (a documented product behavior), this file's effectiveness depends on Codex actually reading the files it points to when told to — this hasn't been verified against a real Codex CLI session. Codex's own instructions file is `~/.codex/AGENTS.md` (confirmed via Codex's own docs — see `README.md` References), which is what this file deploys to; whether Codex follows a "go read this other file" instruction the way Claude Code and Copilot CLI do is the unverified part. Flag it here if it doesn't work in practice.

## References

**Local artifacts:**
- `../claude/CLAUDE.md` — the equivalent pointer file for Claude Code, same content, native `@import` syntax.
- `mapping.yaml` — deploys this file to `~/.codex/AGENTS.md`.

**External authoritative sources:**
- [Codex CLI — Custom instructions with AGENTS.md](https://developers.openai.com/codex/guides/agents-md) — confirms `~/.codex/AGENTS.md` is Codex's global instructions file, read before project-level `AGENTS.md`.

## Related

- `copilot/instructions/personal-defaults.instructions.md` — the actual content this file points at.
