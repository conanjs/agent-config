---
schema: schema/v1
last-updated: 2026-10-24
---

# Schema: Lesson (`lesson/v1`)

**Applies to:** `<lens>/lessons/LS-<n>.md` · **Written by:** the Observer proposes; a human approves at the promotion gate · **Read by:** the Resolver

One habit a team has shown, with its scope, its evidence and its expiry. Modelled on `agentic-sdlc` decision records (`Rejected`, `Confidence`, `Supersedes`) so reviewers already know the shape.

## Front-matter

| Key | Required | Meaning |
|---|---|---|
| `schema` | yes | `lesson/v1` |
| `id` | yes | `LS-<n>` |
| `status` | yes | `candidate` · `active` · `contested` · `retired` · `rejected` |
| `scope` | yes | One or more of `team:<n>`, `repo:<n>`, `path:<glob>` |
| `polarity` | yes | `prefer` · `avoid` · `accept` |
| `adjusts` | one of `adjusts` / `adds-check` | `<RULE-ID>: <from> -> <to>`, one step only (e.g. `ERR-2: major -> minor`) |
| `adds-check` | one of `adjusts` / `adds-check` | One imperative sentence |
| `confidence` | yes | `high` · `medium` · `low` |
| `expires` | yes | Date; unconfirmed lessons retire on this date |
| `supersedes` | yes | A lesson id, or `none` |
| `last-updated` | yes | Date |

## Required structure

```markdown
# LS-<n>: <title>

## Statement
<one or two sentences in plain words>

## Evidence
- <PR or review link> — <who accepted/rejected, one line>
(at least 3 entries from at least 2 people for status active)

## Rejected alternative
<what the team decided not to do, and why>
```

## Rules

- A lesson without `scope` is invalid (FP-4).
- `adjusts` names a rule **not** listed in `floors.md`, and moves severity by exactly one step (R3).
- `status: active` needs evidence from ≥ 3 signals and ≥ 2 people (`trees/lesson-promotion.tree.md`, PRM-Q3).
- Evidence names the decision or code, never a personal trait (FP-8).
- Expiry is at most 180 days after `last-updated` unless a human sets longer with a reason in Evidence.
- Retired and rejected lessons stay on disk; their ids are never reused.

## Checks

| Check | Tool |
|---|---|
| Front-matter complete and values in the allowed sets | `validate-foundry.mjs` |
| `adjusts` rule is not a floor and exists in the rules root | `validate-foundry.mjs` |
| `status: active` has ≥ 3 evidence lines | `validate-foundry.mjs` |

## References

**Local artifacts:**
- `agentic-sdlc/schemas/decision-record.schema.md`: the shape this borrows.

## Related

- `waiver.schema.md`, `../resolver.md` R3 and R5.
