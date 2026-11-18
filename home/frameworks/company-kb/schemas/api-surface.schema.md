# Schema: api-surface

_Applies to: `repos/{repo}/api-surface.md`_

**Optional document type.** Only add this file for a repo once its per-feature `## API Methods` tables (see `feature.schema.md`) are numerous enough that "what does this repo expose, in total?" is genuinely hard to answer by scanning `features/*.md` individually. Small repos with 1-2 features don't need this — their feature docs already answer it.

---

## Required Sections (in this order)

```
---
schema: api-surface
repo: <repo-name>
last-updated: YYYY-MM-DD
---

# API Surface: <repo-name>

## Overview
## Endpoint Catalog
## Deprecated / Legacy
## References
## Related
```

---

## Section Definitions

### `## Overview`
**Required. 1–2 sentences.**
Protocol(s) this repo exposes (REST, gRPC, both) and roughly how many endpoints/methods.

### `## Endpoint Catalog`
**Required. The core of this doc.**
Every endpoint/method the repo exposes, across all features, in one table:

| Method | Path/RPC | Version | Feature | Auth | Notes |
|---|---|---|---|---|---|

`Feature` links back to the owning `features/{feature}.md` doc — this file is an index, not a duplicate source of truth. Don't repeat business logic here; that lives in the feature doc.

### `## Deprecated / Legacy`
**Required.**
Endpoints still live but not for new use — old API versions kept for backward compatibility, etc.

If none: `> _No deprecated endpoints._`

### `## References`
**Required.**
Controller/router files where the full route table is actually defined.

### `## Related`
**Required.**
Link to this repo's `overview.md` and its individual `features/*.md` docs.

## References

**Local artifacts:**
- `feature.schema.md`'s `## API Methods` section — the per-feature source of truth this doc indexes, doesn't replace.
- `flow.schema.md`'s `## API Surface Summary` section — a per-*flow* (cross-repo) endpoint list, a different scope than this per-*repo* catalog.

## Related

- `_system.md` — schema system overview.
- `repo-overview.schema.md` — the doc this one supplements once its feature list grows large.
