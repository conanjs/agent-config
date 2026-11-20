---
schema: floors/v1
last-updated: 2026-10-24
---

# Floors

Rules that **no Lens lesson, waiver or Charter setting may lower or waive**. A floor is a **label on an existing rule**, not a separate rule set. The rules themselves live in `agentic-sdlc/foundations/`.

**Admission test:** a rule is a floor only if harm lands on people **outside the team**, or **cannot be undone**. Style, taste and internal maintainability are never floors.

## Floors

| Rule | Why it is a floor | Category |
|---|---|---|
| Q-SEC-5 | A leaked secret cannot be un-leaked | security |
| Q-SEC-8 | Fail-open in authentication or validation is exploitable by outsiders | security |
| ERR-5 | Payment, auth and validation paths must fail closed | data integrity |
| CON-9 | Breaking a published contract hurts consumers outside the team | contract |
| RUB-3 | A change must not contradict the constitution, an accepted decision or a frozen contract | governance |
| RUB-5 | No secrets, credentials or personal data in the artifact | security |

## Rules for this file

- Each row's `Rule` must exist in the rules root (`validate-foundry.mjs` checks it).
- Adding a floor needs a human decision recorded in the PR that edits this file.
- Removing a floor is a security-relevant change; treat it like lowering a floor.
- A lesson or waiver whose `adjusts` rule is listed here is rejected by `trees/lesson-promotion.tree.md` (PRM-Q2) and by the validator.

## Not floors (examples, so the line is clear)

| Rule | Why not |
|---|---|
| ERR-2 (never swallow errors) | Local to the team's code; a team may accept it in legacy files with a waiver |
| DS-2 (every remote call has a timeout) | Important, but waivable with a compensating control and an expiry |
| CA-1 (dependency rule) | Maintainability, internal to the repo |

## Checks

| Check | Tool |
|---|---|
| Each floor id exists in the rules root | `validate-foundry.mjs` |
| No lesson or waiver adjusts a floor | `validate-foundry.mjs` |

## References

**Local artifacts:**
- `agentic-sdlc/foundations/quality/security.md` (Q-SEC-*), `code/error-handling.md` (ERR-*), `design/contract-design.md` (CON-*), `review/review-rubrics.md` (RUB-*).
- `proposals/agent-foundry-charter-and-floors.md`: why floors are a registry, not a rule-table column.

## Related

- `principles.md` FP-2, `resolver.md` R1 and R3.
