---
schema: schema/v1
last-updated: 2026-10-24
---

# Schema: Waiver (`waiver/v1`)

**Applies to:** `<lens>/waivers/WV-<n>.md` · **Written by:** a human owner · **Read by:** the Resolver

An **explicit, owned, expiring exception** to one non-floor rule, for one place. Where a lesson says "this is how we usually do it", a waiver says "we know this breaks the rule here, and here is why and until when".

## Front-matter

| Key | Required | Meaning |
|---|---|---|
| `schema` | yes | `waiver/v1` |
| `id` | yes | `WV-<n>` |
| `rule` | yes | One rule id, not in `floors.md` |
| `scope` | yes | `path:<glob>` (a waiver is never team-wide) |
| `zone` | yes | `owned` · `adopted` · `foreign` |
| `owner` | yes | A person or team accountable for ending it |
| `review-by` | yes | Date. After it the finding returns automatically |
| `last-updated` | yes | Date |

## Required structure

```markdown
# WV-<n>: <title>

## Reason
<why it cannot be fixed now; the ticket or owner that blocks it>

## Compensating control
<what reduces the risk meanwhile; or "none" with justification>

## After the date
<what happens when review-by passes: finding returns, or renew with a new reason>
```

## Rules

- One rule and one path scope per waiver.
- `review-by` is at most 180 days after `last-updated`.
- A waiver on a `foreign` zone names the owning team of that zone.
- Past `review-by`, the Resolver drops the waiver (R6) and the original finding returns.
- Renewal is a new edit with a new reason, in a PR; silent renewal is invalid.

## Checks

| Check | Tool |
|---|---|
| Front-matter complete; `rule` not a floor and exists | `validate-foundry.mjs` |
| `review-by` is a valid date; warn when already past | `validate-foundry.mjs` |

## References

**Local artifacts:**
- `../floors.md`, `../resolver.md` R6.

## Related

- `lesson.schema.md`, `zone-map.schema.md`.
