# Company KB Framework

The reusable definition behind every per-company knowledge base (e.g. `{{AGENT_HOME}}/companies/ots/`). This folder holds the framework itself — rules and schemas shared across every company — never anything company-specific. A company's own content lives in its own `{{AGENT_HOME}}/companies/<company>/` folder instead, pointing back here.

## What's in this folder

| Path | What it is | Read this when... |
|---|---|---|
| [`conventions.md`](conventions.md) | Writing rules, document-type table, update triggers | Writing or updating any doc in a company KB |
| [`schemas/`](schemas/) | One `<type>.schema.md` per document type (`flow`, `feature`, `repo-overview`, `domain`, `api-surface`, and for the optional `system/` folder `system-architecture`, `service-catalog`, `cross-repo-feature`), plus `schemas/_system.md` — the compliance mechanism itself: frontmatter format, the two supported repo-layout options (flat vs. grouped-by-project), and why cross-references use `{{AGENT_HOME}}`-anchored paths | Before writing/editing any doc — start with `schemas/_system.md`, then the specific `<type>.schema.md` |

**Optional `system/` folder:** a company whose repos form one multi-repo system can keep its context map, service catalog and cross-repo feature plans in `companies/<company>/system/`, instead of a separate "system repo". Contracts stay in their provider repos.

**Not in this folder:** task procedures live at `{{AGENT_HOME}}/procedures/` (e.g. `init-repo-kb.procedure.md`, which bootstraps a KB entry for an undocumented repo) — grouped by *artifact type* alongside `copilot/prompts/` and `copilot/agents/`, not nested inside whichever framework they happen to be about. See `{{AGENT_HOME}}/patterns/shared-procedure-thin-wrapper.pattern.md`'s checklist for why.

## Where the actual content is

This folder never holds company-specific facts. The current (and so far only) instance is **OTS**: `{{AGENT_HOME}}/companies/ots/` — start at its own `index.md`.

## References

**Local artifacts:**
- `{{AGENT_HOME}}/companies/ots/index.md` — the worked instance this framework supports.
- `{{AGENT_HOME}}/procedures/init-repo-kb.procedure.md` — the task procedure for this framework, held elsewhere per the artifact-type grouping above.
- `{{AGENT_HOME}}/patterns/index.md` — the general "Shared Procedure + Thin Wrapper" pattern this framework's Copilot prompt follows.

## Related

- `conventions.md`, `schemas/_system.md` — this folder's own contents, described above.
- `{{AGENT_HOME}}/procedures/` — this framework's task procedures, held there instead.
