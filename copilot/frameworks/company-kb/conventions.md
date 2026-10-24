# Company KB Framework — Conventions

Shared across every company instance (e.g. `{{AGENT_HOME}}/companies/ots/`) — not specific to any one company. Locations below use flat structure; under grouped-by-project (see `{{AGENT_HOME}}/frameworks/company-kb/schemas/_system.md`'s "Structure Options"), prepend `{project}/` to every `repos/...` path.

## Schema Compliance

Every document must declare its schema. **See `{{AGENT_HOME}}/frameworks/company-kb/schemas/_system.md` for the exact frontmatter format and the full compliance rules** — not restated here, so there's exactly one place to keep correct.

**Schema → Location mapping:** also lives in `{{AGENT_HOME}}/frameworks/company-kb/schemas/_system.md` — don't duplicate that table here either; it drifted out of sync with this file once already (fixed 2026-09-20).

---

## Document Types

| Type | Location | What goes in |
|---|---|---|
| **overview** | `repos/{repo}/overview.md` | Tech stack, purpose, entry points, key env vars — see `{{AGENT_HOME}}/frameworks/company-kb/schemas/repo-overview.schema.md` |
| **api-surface** | `repos/{repo}/api-surface.md` | All endpoints/methods exposed, repo-wide — optional, only once feature-level API tables get hard to scan; see `{{AGENT_HOME}}/frameworks/company-kb/schemas/api-surface.schema.md` |
| **feature** | `repos/{repo}/features/{feature}.md` | Business logic, key code paths, schemas |
| **flow** | `flows/{flow}.md` | Cross-repo sequence diagram + API version map |
| **domain** | `domain/{concept}.md` | Business terminology, status enums, rules (no code) |
| **infra** | `infra/{topic}.md` | Clusters, namespaces, env mappings — no strict schema yet |
| **system-architecture** | `system/architecture.md` | *Optional.* Context map between repos, integration rules, system principles, feature list — see `{{AGENT_HOME}}/frameworks/company-kb/schemas/system-architecture.schema.md` |
| **service-catalog** | `system/service-catalog.yaml` | *Optional.* Every service: repo, owner, stack, owned entities, contracts provided/consumed — see `schemas/service-catalog.schema.md` |
| **cross-repo-feature** | `system/features/{NNN-slug}.md` | *Optional.* System-level plan for one feature spanning repos: behaviour, contract changes, decisions, per-repo slices — see `schemas/cross-repo-feature.schema.md` |

**Note (2026-10-04):** the three `system/` types replace the separate "system repo" from agentic-sdlc v1. `flows/` stays the place for *request* sequences; `system/architecture.md` is the static *topology* and links to flows rather than repeating them.

**Note (2026-09-20):** `architecture` as a separate doc type was removed from this table — its scope (module structure, DB schema, external integrations) overlapped with `repo-overview`'s `Module Map`/`External Integrations` sections. The one genuinely new piece, DB schema, is now `repo-overview.schema.md`'s optional `## Data Model` section instead of a whole separate file.

## Writing Rules

1. **Code pointers, not dumps** — use `path/to/file.ts:line` references, not full source blocks.
2. **ASCII diagrams** for flows — no external tool dependency.
3. **API version table** in every flow doc — which version (`v1`/`v2`) each repo uses.
4. **"Last updated"** timestamp at top of every doc.
5. **"Related"** section at the bottom — links to other docs in this KB, using `{{AGENT_HOME}}/companies/<company>/...`-anchored paths (see `{{AGENT_HOME}}/frameworks/company-kb/schemas/_system.md`'s "Structure Options" for why, not relative `../` paths).
6. **"References"** section at the bottom — links to actual source files (these are real source-tree paths, not KB doc paths — relative-vs-absolute doesn't apply the same way here).

## Update Trigger

After every feature implementation:
- Update the relevant `features/{feature}.md` (add new endpoint, schema changes).
- Update the relevant `flows/{flow}.md` if the cross-repo contract changed.
- Update `domain/{concept}.md` if a new status or business rule was added.

If the company has a `system/` folder:
- When a cross-repo feature is planned, create `system/features/{NNN-slug}.md`. Update its Slices table as each slice progresses.
- When a service, a repo-to-repo edge or a contract version changes, update `system/architecture.md` and `system/service-catalog.yaml`, and add 1 to `system-ref`.
- When a repo is added to `index.md`, add it to the catalog too.

## How an Agent Uses These Docs

At the start of each task:
1. Check `flows/` — understand cross-repo chain. If `system/` exists and the task may touch more than one service, check `system/service-catalog.yaml` and `system/features/` first.
2. Check `repos/{repo}/features/{feature}.md` — understand what already exists.
3. Do targeted source reads only for unknowns.
4. Implement, then update docs.
