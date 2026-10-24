# Schema: cross-repo-feature

_Applies to: `system/features/<NNN-slug>.md`_

One file per feature that spans more than one repo. It holds the system-level plan: what changes, which contracts change, the decisions, and the **slices** (one piece of work per repo). Each slice is then built as a normal feature in its own repo, whose spec links back here.

**Example:** "HR sync" needs a new endpoint in `hr-gateway` and a new use case in `rbac`. This doc lists both slices. Slice 0, the contract change, merges first.

---

## Required Sections (in this order)

```
---
schema: cross-repo-feature
last-updated: YYYY-MM-DD
id: <NNN-slug>
status: draft | approved | in-progress | done
system-ref: <integer from system/architecture.md when planned>
---

# Feature: <title>

## Summary
## Blueprint
## Behaviour
## Contract Changes
## Decisions
## Slices
## Rollout Order
## References
## Related
```

---

## Section Definitions

### `## Summary`
**Required. 2–4 sentences.** What the feature does and why it spans repos.

### `## Blueprint`
**Required.** The initial proposal: a table `Area | Proposal | Confidence | Role`, then **Assumptions** (bullets) and **Open questions** (at most 3).

### `## Behaviour`
**Required.** System-level acceptance criteria, numbered `SAC-1`, `SAC-2`, … Each repo's spec cites these ids instead of rewriting them.

### `## Contract Changes`
**Required.**

| Contract | Provider | Change | Version | Breaking |
|---|---|---|---|---|

If none: `> _No contract changes._`

### `## Decisions`
**Required.** One entry per decision, ids `SDR-<nnn>`:

```
### SDR-001: <topic>
- **Options considered:** A | B
- **Chosen:** A — <reason>
- **Rejected:** B — <reason>
- **Decided by:** <role or human> · <YYYY-MM-DD>
```

### `## Slices`
**Required.**

| Slice | Service | Repo feature | Depends on | Status |
|---|---|---|---|---|

- If **Contract Changes** is not empty, slice `0` is the contract change in the provider repo, and every other slice depends on it.
- `Repo feature` is `<repo>:specs/<NNN-slug>/` once the slice starts; `—` before that.
- `Status`: `pending` · `in-progress` · `done`.

### `## Rollout Order`
**Required.** Deployment order, plus feature flags or a migration window if any.

### `## References`
**Required.** Contract file paths and repo spec paths.

### `## Related`
**Required.** `{{AGENT_HOME}}/companies/<company>/...` links: `system/architecture.md`, affected flows and domains.

---

## Status Rules

- `done` requires every slice to be `done`.
- When the feature is done, `system/architecture.md` is updated (Context Map, Features row) and `system-ref` goes up by 1 if the Context Map or the catalog changed.
