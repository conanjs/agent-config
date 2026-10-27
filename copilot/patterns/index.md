# Patterns

This repo follows a deliberate structural philosophy: every recurring shape gets named and written down exactly once, every piece of content has exactly one authoritative home, and nothing gets restated in a second place "for convenience" — a second copy is how two things silently drift apart (see the incident notes in each pattern below; it's already happened twice here). When a new capability or piece of content is needed, check this catalog first for a pattern that already fits, rather than improvising a one-off shape.

## Catalog

| Pattern | File | Use when |
|---|---|---|
| Shared Procedure + Thin Wrapper | [`shared-procedure-thin-wrapper.pattern.md`](shared-procedure-thin-wrapper.pattern.md) | A capability needs to work across more than one agent tool (Claude Code, Copilot, Codex, future tools) |
| Backup Before Overwrite | [`backup-before-overwrite.pattern.md`](backup-before-overwrite.pattern.md) | Anything automated is about to replace/delete a path that might hold real, pre-existing content — not just this repo's own installers |
| Explaining Multi-Actor Mechanisms | [`explaining-mechanisms.pattern.md`](explaining-mechanisms.pattern.md) | Explaining anything where more than one actor/component acts in sequence — an auth flow, a build pipeline, a cross-service integration |
| Revise Without Erasing | [`revise-without-erasing.pattern.md`](revise-without-erasing.pattern.md) | Revising an existing document, or moving one of its sections into a dedicated document: fix what is wrong, add what is missing, keep the rest. Leave the reader no regret, and satisfy their greed |
| Compare Every Version | [`compare-every-version.pattern.md`](compare-every-version.pattern.md) | Showing how something changed across two or more versions: one column per version, exact excerpts in every cell, a verdict with a reason |
| Layered Guards | [`layered-guards.pattern.md`](layered-guards.pattern.md) | The same kinds of mistake keep reaching a kind of artifact, and you want them caught every time: sort mistakes into shape / meaning / staleness, give each its own guard, and wire the checks into hook, commit and required CI |
| Maintained Variant | [`maintained-variant.pattern.md`](maintained-variant.pattern.md) | An example, template or reference that docs point to must change shape, and the old shape is still right for some readers: keep it as a CI-checked branch with its own pin, not a frozen tag |
| Artifact Types | [`artifact-types.pattern.md`](artifact-types.pattern.md) | Adding anything new an agent will read or run, and deciding if it is an instruction, skill, prompt, agent, procedure, framework, knowledge or pattern |

This catalog is meant to grow — add a row + a new `patterns/<name>.pattern.md` file when a second recurring shape shows up, rather than folding it into an existing pattern's file or leaving it undocumented. This folder now deploys to `{{AGENT_HOME}}/patterns/` (see `mapping.yaml`), so these patterns are available from any project, not only while working inside `agent-config` itself — worth checking here before designing a one-off reusable mechanism anywhere, not just here.

## References

**Local artifacts:**
- `shared-procedure-thin-wrapper.pattern.md`, `backup-before-overwrite.pattern.md`, `explaining-mechanisms.pattern.md`, `artifact-types.pattern.md`, `revise-without-erasing.pattern.md`, `compare-every-version.pattern.md`, `layered-guards.pattern.md`, `maintained-variant.pattern.md` — the eight patterns documented so far.
- `pattern.schema.md` — `pattern/v1`, the shape of new pattern files (origin, concrete examples, version comparisons). The first four patterns predate it and are legacy.
- `copilot/frameworks/company-kb/index.md` — a worked example of "one folder, one concise overview file, typed subfolders for accumulating content" — itself following this same don't-repeat-yourself philosophy, just not yet promoted to its own named pattern here.

## Related

- `copilot/frameworks/company-kb/schemas/_system.md` — the Company KB Framework's own compliance/consistency mechanism, same philosophy applied to KB documents specifically.
- `README.md` — repo-wide reference, links here.
