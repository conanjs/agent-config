# Schema: repo-overview

_Applies to: `repos/{repo}/overview.md`_

---

## Required Sections (in this order)

```
---
schema: repo-overview
last-updated: YYYY-MM-DD
---

# Repo: <repo-name>

## Purpose
## Tech Stack
## Entry Point
## Module Map
## Features
## Data Model
## External Integrations
## Env Vars (Key)
## References
## Related
```

---

## Section Definitions

### `## Purpose`
**Required. 1–3 sentences.**
What does this repo do? Who depends on it?

### `## Tech Stack`
**Required.**
Key frameworks, language version, DB, queue, transport. Bullet list.

### `## Entry Point`
**Required.**
How is the app started? What is the main module? What port/protocol does it listen on?

### `## Module Map`
**Required.**
Tree-style list of feature modules. One line per module with a 5–10 word description.

```
src/modules/
├── cargo-release/    ← cargo release submission, status check, restore
├── import-shipment/  ← BL/container info from external system
└── ...
```

### `## Features`
**Required if the repo has any `features/*.md` docs.**
Bullet list linking to this repo's feature docs (see `feature.schema.md`). Omit the section entirely if none exist yet, rather than leaving it empty.

### `## Data Model`
**Optional.** Repo-wide DB schema summary — only when a feature-level `## Data Model` (per `feature.schema.md`) isn't enough to see the whole picture (e.g. cross-feature FKs, a shared table many features touch). Most repos won't need this section at all; the default is per-feature data model docs.

### `## External Integrations`
**Required.**
Other systems this repo talks to.

| System | Protocol | Direction | Purpose |
|---|---|---|---|

If none: `> _No external integrations._`

### `## Env Vars (Key)`
**Required.**
Only the most important env vars — DB connection, service URLs, API keys. Full lists live in feature docs.

| Var | Purpose |
|---|---|

### `## References`
**Required.**
`src/main.ts`, `src/app.module.ts`, and other entry-level files.

### `## Related`
**Required.**
Links to this repo's feature docs, and flows that involve this repo.
