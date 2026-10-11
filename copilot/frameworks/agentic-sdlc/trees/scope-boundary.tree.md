---
schema: tree/v2
last-updated: 2026-10-04
prefix: SCOPE
owner: product-spec
phases: [P0, P3]
feeds: whether a request joins the current feature, amends an existing `spec.md`, or becomes a new feature; and which user stories are P1 (MVP) vs P2/P3
---

# Scope Boundary (SCOPE)

Decides where a requested change belongs and what the minimum viable cut is. It does NOT decide how the change is built or its technical risk. The goal is to keep each feature folder (`specs/<NNN-feature>/`) about one thing, and to keep the P1 user story small enough to be independently testable, as Spec Kit's prioritized user stories require.

## Overview

```
SCOPE-Q1 Inside the stated mission / current feature?
├─ NO  → new feature (own spec folder; P1 → P3 → ...)
└─ YES → SCOPE-Q2 Changes acceptance criteria of an existing spec?
          ├─ YES, a merged feature's → amend that spec.md at P3 (then P4 → P7)
          ├─ YES, the in-flight one's  → update spec.md, re-run /speckit-clarify, re-gate G2
          └─ NO  → SCOPE-Q3 Needed for the P1 story to be independently testable?
                    ├─ YES → P1 (MVP)
                    └─ NO  → P2 or P3
```

## Nodes

### SCOPE-Q1 — Is the request inside the stated mission or current feature?
- **Criteria:** The mission statement and `blueprint.md` goal; the current feature's `spec.md` summary and user stories. A request is inside if it serves the same user goal for the same actor.
- **Branches:**
  - YES → SCOPE-Q2
  - NO → new feature: its own `specs/<NNN-feature>/` folder, starting at P1
- **Default:** NO — an unrelated-looking request becomes its own feature; folding it in silently grows the feature.
- **Escalate when:** the request is inside the mission but would more than double the feature's user stories — ask whether to split.

### SCOPE-Q2 — Does it change an existing spec's acceptance criteria?
- **Criteria:** Compare the request with acceptance scenarios (Given/When/Then) in every `spec.md` it touches, including merged features. A changed outcome, a removed scenario, or a new constraint on an existing scenario counts; a new scenario alongside unchanged ones does not.
- **Branches:**
  - YES, in a merged feature's spec → amend that `spec.md` at P3, then P4 → P7 (the "fix that changes specified behaviour" path); a new record notes what changed
  - YES, in the in-flight feature's spec → update its `spec.md`, re-run `/speckit-clarify`, re-gate G2
  - NO → SCOPE-Q3
- **Default:** YES if any existing acceptance scenario's outcome would differ — never edit behaviour without amending the spec that describes it.
- **Tie-breaker:** if both a merged and the in-flight spec are affected: amend the merged spec first (it is the shipped contract with users), then update the in-flight one.
- **Escalate when:** the amendment contradicts a scenario another feature or consumer depends on, or reverses a decision already approved at a gate.

### SCOPE-Q3 — MVP cut: is it needed for the P1 user story to be independently testable?
- **Criteria:** Spec Kit priorities — P1 is the smallest slice that delivers value and can be tested and demonstrated on its own; P2/P3 add value on top. Ask: without this item, can the P1 story still be run end to end and its acceptance scenarios pass?
- **Branches:**
  - YES → P1 (MVP)
  - NO, adds clear value soon → P2
  - NO, nice to have → P3
- **Default:** NO → P2 — keep the MVP minimal; unknown items move later, not earlier.
- **Escalate when:** the human's mission explicitly names the item as must-have but it is not needed for P1 testability — confirm the priority at G2 instead of overriding the human.

## Recording

One decision record per scope call, `DR-<NNN>: Scope — <request>`, in the receiving feature's `specs/<NNN-feature>/research.md` (for a new feature, in its own `research.md` once P3 creates the folder). Story priorities themselves live in `spec.md`; the record captures why a contested item landed in P1, P2 or P3.

## References

**Local artifacts:**
- `proposals/agentic-sdlc-v2-structure.md` ?5.2 ? v2 tree layout and tree registration.
- `schemas/tree.schema.md` ? `tree/v2` node format and validation rules.
- `conventions.md` ?4, ?8 ? P0 mission classification and the fast path.

**External authoritative sources:**
- [github/spec-kit](https://github.com/github/spec-kit) ? prioritized, independently testable user stories.

## Related

- `risk-tier.tree.md` ? run on whatever scope this tree settles.
- `schemas/decision-record.schema.md` ? record format.
