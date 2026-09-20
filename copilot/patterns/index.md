# Patterns

This repo follows a deliberate structural philosophy: every recurring shape gets named and written down exactly once, every piece of content has exactly one authoritative home, and nothing gets restated in a second place "for convenience" — a second copy is how two things silently drift apart (see the incident notes in each pattern below; it's already happened twice here). When a new capability or piece of content is needed, check this catalog first for a pattern that already fits, rather than improvising a one-off shape.

## Catalog

| Pattern | File | Use when |
|---|---|---|
| Shared Procedure + Thin Wrapper | [`shared-procedure-thin-wrapper.pattern.md`](shared-procedure-thin-wrapper.pattern.md) | A capability needs to work across more than one agent tool (Claude Code, Copilot, Codex, future tools) |
| Backup Before Overwrite | [`backup-before-overwrite.pattern.md`](backup-before-overwrite.pattern.md) | Anything automated is about to replace/delete a path that might hold real, pre-existing content — not just this repo's own installers |
| Explaining Multi-Actor Mechanisms | [`explaining-mechanisms.pattern.md`](explaining-mechanisms.pattern.md) | Explaining anything where more than one actor/component acts in sequence — an auth flow, a build pipeline, a cross-service integration |

This catalog is meant to grow — add a row + a new `patterns/<name>.pattern.md` file when a second recurring shape shows up, rather than folding it into an existing pattern's file or leaving it undocumented. This folder now deploys to `{{AGENT_HOME}}/patterns/` (see `mapping.yaml`), so these patterns are available from any project, not only while working inside `agent-config` itself — worth checking here before designing a one-off reusable mechanism anywhere, not just here.

## References

**Local artifacts:**
- `shared-procedure-thin-wrapper.pattern.md`, `backup-before-overwrite.pattern.md`, `explaining-mechanisms.pattern.md` — the three patterns documented so far.
- `copilot/frameworks/company-kb/index.md` — a worked example of "one folder, one concise overview file, typed subfolders for accumulating content" — itself following this same don't-repeat-yourself philosophy, just not yet promoted to its own named pattern here.

## Related

- `copilot/frameworks/company-kb/schemas/_system.md` — the Company KB Framework's own compliance/consistency mechanism, same philosophy applied to KB documents specifically.
- `README.md` — repo-wide reference, links here.
