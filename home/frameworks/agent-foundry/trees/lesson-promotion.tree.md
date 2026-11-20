---
schema: tree/v2
last-updated: 2026-10-24
prefix: PRM
owner: pr-reviewer
phases: [learn]
feeds: the status of one lesson (`candidate` to `active`, `contested` or `rejected`)
---

# Lesson Promotion (PRM)

The gate between "the agent noticed a habit" and "the habit changes future reviews". It does NOT collect observations. **Default is do nothing:** an unproven lesson stays a candidate and never applies.

## Overview

```
PRM-Q1 Does the candidate have a scope?
├─ NO  → rejected
└─ YES → PRM-Q2
PRM-Q2 Does it adjust or waive a floor rule?
├─ YES → rejected
└─ NO  → PRM-Q3
PRM-Q3 3+ consistent signals from 2+ people in the scope?
├─ NO, too few  → stays candidate
├─ NO, conflict → contested
└─ YES → PRM-Q4
PRM-Q4 Replay on the golden set: floor recall unchanged and noise not worse?
├─ NO  → blocked (report numbers)
└─ YES → PRM-Q5
PRM-Q5 Human approves?
├─ YES            → active (set expires)
├─ YES, narrower  → active with the narrower scope
└─ NO             → rejected (never re-proposed on the same evidence)
```

## Nodes

### PRM-Q1 — Does the candidate name a scope (team, repo or path)?
- **Criteria:** the `scope` front-matter key of `schemas/lesson.schema.md`.
- **Branches:**
  - NO → rejected
  - YES → PRM-Q2
- **Default:** rejected (FP-4).
- **Escalate when:** the scope is the whole organisation; ask a human whether it is really a Company KB rule instead.

### PRM-Q2 — Does the lesson adjust or waive any rule in `floors.md`?
- **Criteria:** the `adjusts` rule, or the rule a check would silence, against `floors.md`.
- **Branches:**
  - YES → rejected
  - NO → PRM-Q3
- **Default:** YES when the rule cannot be identified (fail-closed).
- **Escalate when:** the team insists; a floor change is a separate PR to `floors.md`, not a lesson.

### PRM-Q3 — Are there 3 or more consistent signals from 2 or more different people in the scope?
- **Criteria:** observations (accepted, dismissed or edited agent comment; human comment with the same intent). Count distinct people and PRs.
- **Branches:**
  - YES → PRM-Q4
  - NO, too few signals → stays candidate
  - NO, signals disagree → `contested`; the agent asks the team at the next relevant PR
- **Default:** stays candidate.
- **Escalate when:** all signals come from one person who is also the approver.

### PRM-Q4 — Does replaying the golden set with the lesson keep floor recall and not raise noise?
- **Criteria:** run the agent on the Charter's golden set with and without the lesson; compare `floor recall` and `noise rate` (`schemas/charter.schema.md`, Eval).
- **Branches:**
  - YES → PRM-Q5
  - NO → blocked; report both runs' numbers on the promotion PR
- **Default:** blocked when no golden set exists (a lesson cannot be promoted untested).
- **Escalate when:** the golden set has fewer than 10 cases; promote manually with a note.

### PRM-Q5 — Does a human approve (optionally with a narrower scope)?
- **Criteria:** review of the promotion PR by someone with authority over the scope.
- **Branches:**
  - approve → `active`, `expires` set (≤ 180 days)
  - approve with narrower scope → `active` with that scope
  - reject → `rejected`
- **Default:** no answer is not approval; the candidate expires after 30 days.
- **Escalate when:** reviewers disagree; mark `contested`.

## Trade-off tables

| Outcome | Effect on future reviews |
|---|---|
| candidate | None |
| active | Applies within scope until `expires` |
| contested | Not applied; agent asks |
| rejected | Not applied; not proposed again on the same evidence |
| retired | Removed on expiry, contradiction or owner request |

## Recording

The promotion is a normal PR that adds or edits `<lens>/lessons/LS-<n>.md`. The PR description holds the replay numbers.

## References

**Local artifacts:**
- `../schemas/lesson.schema.md`, `../floors.md`, `../principles.md` FP-3, FP-4, FP-8.

**External authoritative sources:**
- CodeRabbit "learnings" (docs.coderabbit.ai/knowledge-base/learnings): a comparable idea, vendor-reported; this tree adds the human gate and the replay test.

## Related

- `pr-review.tree.md`, `zone-classification.tree.md`.
