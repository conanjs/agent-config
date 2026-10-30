---
schema: schema/v1
last-updated: 2026-10-24
---

# Schema: Zone Map (`zone-map/v1`)

**Applies to:** `<lens>/zones.md` · **Written by:** the repo owner (a draft may come from CODEOWNERS and vendored-folder detection) · **Read by:** the Resolver, `trees/zone-classification.tree.md`

Says which paths the team **owns**, which it **adopted with known debt**, and which are **foreign** (another team, a vendor, or untouchable legacy). Reviewing behaviour per zone is in `trees/pr-review.tree.md` (PRV-Q3).

## Front-matter

| Key | Required | Meaning |
|---|---|---|
| `schema` | yes | `zone-map/v1` |
| `repo` | yes | Repo name |
| `team` | yes | The owning team |
| `last-updated` | yes | Date |

## Required structure

```markdown
# Zones: <repo>

## Zones
| Path | Zone | Owner | Reason |
|---|---|---|---|
| src/** | owned | orders | default |
| src/legacy/** | adopted | orders | known debt, ORD-88 |
| vendor/legacy-tax-client/** | foreign | finance-platform | vendored library |

## Default
<zone for a path that matches no row; normally `owned`>
```

## Rules

- First match wins; list narrow paths before wide ones.
- Zone values are exactly `owned`, `adopted` or `foreign`.
- A `foreign` row names an owner other than the team.
- An `adopted` row has a ticket or reason for the debt.

## Checks

| Check | Tool |
|---|---|
| Zone values valid; foreign rows have a different owner | `validate-foundry.mjs` |

## References

**Local artifacts:**
- `agentic-sdlc/foundations/design/domain-driven-design.md` DDD-3 (one owner per context) and DDD-5 (translate at the border).

## Related

- `waiver.schema.md`.
