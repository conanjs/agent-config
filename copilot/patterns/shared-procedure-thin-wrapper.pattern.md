# Pattern: Shared Procedure + Thin Wrapper

**Use when:** a capability needs to work across more than one agent tool (Claude Code, Copilot CLI/Chat, Codex, future tools), and each tool has its own native format/location for that kind of thing (instructions, prompts, agent personas, a global entrypoint file, etc.).

## The pattern

1. Write the actual logic/content **once**, in a tool-neutral location, in plain prose any capable agent can follow without a specific tool feature to interpret it. This is the single source of truth.
2. For each tool that needs it, write the **thinnest possible wrapper**, in that tool's own native format/discovery location — ideally just "go read X and follow it," plus only the tool-specific glue that genuinely can't live in the shared doc (an `@import` line, a prompt's `argument-hint`, frontmatter a tool requires).
3. **Never let a wrapper restate the shared content.** Needing more than a sentence of unique material in a wrapper is a sign the boundary is drawn wrong.
4. **Not every tool needs a wrapper.** If a tool's native discovery mechanism already reads the shared source directly (because the shared source happens to already be in that tool's native format), a wrapper for that tool would be pure overhead — see the Copilot row below.
5. **If a tool has no mechanism at all for this** (no global equivalent, verified — not just "didn't check"), don't fabricate a wrapper that only half-works. Say so, and rely on whatever broader mechanism already reaches that tool instead (see the Claude Code row below).

## Why this exists (real incidents, not hypotheticals)

- `conventions.md` once carried its own full copy of the frontmatter-format rule that `schemas/_system.md` also had — they drifted out of sync (one used `---` delimiters, the other didn't) before anyone noticed. Two independent descriptions of the same thing will eventually disagree; one copy, pointed at from everywhere else, cannot drift from itself.
- `personal-defaults.instructions.md` briefly carried the *full* backup-mechanism explanation, even though that file loads on every request forever and the detail only matters during install/revert tasks. The fix wasn't a second copy — it was moving the detail to where it's actually needed (`README`/`SETUP.md`) and leaving a short, conditional pointer behind. Placement (always-loaded vs. read-on-demand) matters as much as avoiding duplication.

## Worked examples already in this repo

| Shared source (single source of truth) | Wrapper(s) | Tool-specific glue / notes |
|---|---|---|
| `copilot/instructions/*.instructions.md` (personal-defaults, answer-patterns, code-review-graph) | `claude/CLAUDE.md` — one `@import` line per file | Claude Code's `@import` takes individual file paths only, no glob/directory import (verified) — that's *why* a wrapper is needed here at all |
| (same) | `codex/AGENTS.md` — prose pointer | Codex has no `@import`-equivalent; the wrapper is plain prose telling the agent to go read the files |
| (same) | *(none for Copilot)* | Copilot CLI/Chat's own native discovery already reads `~/.copilot/instructions/*.instructions.md` directly — the shared source happens to already be in Copilot's native format |
| `global-variables.md` | Pointed at from `personal-defaults.instructions.md`; every tool resolves `{{VAR}}` the same way | This is shared *data*, not a procedure — no per-tool glue needed at all |
| `copilot/procedures/init-repo-kb.procedure.md` | `copilot/prompts/init-repo-kb.prompt.md` (Copilot) | Prompt needs `argument-hint`/`{{company}}`/`{{repos}}` templating glue, and deliberately avoids writing the knowledge-base's own `{{VAR}}` syntax in its body — see the file's own comment for why |
| `copilot/frameworks/agentic-sdlc/agents/<role>.md` | `claude/agents/sdlc-<role>.md`, `copilot/agents/sdlc-<role>.agent.md`, `codex/agents/sdlc-<role>.toml` | Each tool's agent format differs (Codex is TOML), so each needs its own one-paragraph wrapper; tool glue is only frontmatter (`model`, `skills:` preload in Claude Code, `user-invocable: false` in Copilot) |
| `copilot/frameworks/agentic-sdlc/stacks/<id>/`, `paradigms/<id>.md`, a role's Preset list | `skills/sdlc-stack-<id>/`, `skills/sdlc-paradigm-<id>/`, `skills/sdlc-<role>-preset/` `SKILL.md` — **one** wrapper each for all three tools | `SKILL.md` is the same format in Claude Code, Copilot and Codex (verified 2026-10-03), so one `skills/` folder is linked to both `~/.claude/skills` and `~/.agents/skills` (the latter read by Copilot and Codex) — rule 4 applied across tools instead of per tool |
| (same as `init-repo-kb` row above) | **No wrapper built for Claude Code yet** — *superseded note:* at the time, `~/.claude/skills/` and `~/.claude/commands/` didn't exist on this machine and no global Skills mechanism had been verified. User-level skills (`~/.claude/skills/`) are now documented ([Claude Code skills](https://code.claude.com/docs/en/skills.md)) and `skills/` is linked there via `mapping.yaml`, so a `skills/init-repo-kb/SKILL.md` wrapper is now possible; not built yet. Functional parity already exists anyway: `personal-defaults.instructions.md`'s existing pointer to the procedure reaches every Claude Code session via the `CLAUDE.md` `@import` chain, so the capability works today via natural-language invocation ("initialize the KB for ne-shipment-api") — just without a `/slash-shortcut`. Revisit only if Claude Code ships a verified global equivalent, or if a project-scoped skill (accepted cost: copied per-repo, not globally reachable) is worth it for a specific repo. |

## Checklist when adding something new

1. Does more than one tool need this? If no, just write it directly where that one tool expects it — this pattern is overhead you don't need yet.
2. If yes: write the tool-neutral version first, in the location that matches its *artifact type*, not its subject matter — e.g. a repeatable task goes in `copilot/procedures/` even if it's entirely about one specific framework (like `init-repo-kb.procedure.md`, which is company-KB-specific content but lives alongside all other procedures, not nested inside `frameworks/company-kb/`) — same reasoning `copilot/prompts/` and `copilot/agents/` already follow.
3. For each tool, check whether it needs a wrapper at all (rule 4) and whether a wrapper is even possible (rule 5) before writing one.
4. Before finishing, re-read every wrapper and confirm none of them restate more than a sentence of the shared content.

## References

**Local artifacts:**
- `copilot/frameworks/company-kb/conventions.md`, `schemas/_system.md` — the incident that motivated documenting this pattern.
- `copilot/instructions/personal-defaults.instructions.md` — the second incident, and the always-loaded pointer that gives Claude Code its "no wrapper" parity above.
- `claude/CLAUDE.md`, `codex/AGENTS.md`, `copilot/prompts/init-repo-kb.prompt.md` — the worked wrapper examples in the table above.

## Related

- `mapping.yaml` — where every wrapper file actually deploys to, per tool.
- `index.md` — the catalog this pattern is listed in.
