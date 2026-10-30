---
schema: tree/v2
last-updated: 2026-10-24
prefix: PRV
owner: pr-reviewer
phases: [review]
feeds: the review summary posted on a pull request (findings, questions, verdict)
---

# PR Review (PRV)

The spine of the `pr-reviewer` agent: the ordered questions it walks for every pull request. It decides **what to check, how seriously, and whether to speak or ask**. It does NOT approve, merge or edit code. **Default is cautious:** unknown zone is treated as owned (full checks); low confidence on a serious finding becomes a question.

## Overview

```
PRV-Q1 Context Pack built and every changed file zoned?
├─ NO  → ask for the missing zone/owner → (default: treat file as owned) → PRV-Q2
└─ YES → PRV-Q2
PRV-Q2 Change touches auth, payments, secrets, a public contract, or personal data?
├─ YES → tier HIGH (floors + all rules + extra scrutiny) → PRV-Q3
└─ NO  → tier NORMAL → PRV-Q3
PRV-Q3 Next changed file: is its zone foreign?
├─ YES → PRV-Q4 (border checks only)
└─ NO  → PRV-Q5
PRV-Q4 Border checks (adapter, timeout, error translation, no leakage) → PRV-Q6
PRV-Q5 Any floor rule violated?
├─ YES → finding at rubric severity, NOT softenable → PRV-Q6
└─ NO  → PRV-Q6
PRV-Q6 Any other rule violated?  → finding at rubric severity → PRV-Q7
PRV-Q7 Does an active lesson or waiver cover the finding?
├─ lesson/waiver, in scope, not expired → apply (one step down / waived) → PRV-Q8
├─ contested lessons                    → question to humans → PRV-Q8
└─ none                                 → PRV-Q8
more files? → PRV-Q3
PRV-Q8 Critical-thinking pass over all findings → PRV-Q9
PRV-Q9 Low confidence on a blocker or major?
├─ YES → turn into a question → PRV-Q10
└─ NO  → keep finding → PRV-Q10
PRV-Q10 Synthesis: dedupe vs human comments, rank, cap, label by source → post
```

## Nodes

### PRV-Q1 — Is the Context Pack built and every changed file mapped to a zone?
- **Criteria:** the pack from `resolver.md` exists; each changed path matches a row in the zone map (`schemas/zone-map.schema.md`) or its Default.
- **Branches:**
  - YES → PRV-Q2
  - NO → record a question naming the unzoned paths, treat them as `owned`, → PRV-Q2
- **Default:** treat the file as `owned` (stricter checks).
- **Escalate when:** more than a quarter of the changed files are unzoned; the zone map is missing entirely.

### PRV-Q2 — Does the change touch authn/authz, payments, secrets, a public contract, or personal data?
- **Criteria:** changed paths and diff content; spec entities; `Q-SEC-*`, `CON-*` relevance. If `agentic-sdlc` is installed, its `RT` tree gives the same answer and may be used.
- **Branches:**
  - YES → tier HIGH → PRV-Q3
  - NO → tier NORMAL → PRV-Q3
- **Default:** YES when unknown (fail-closed).
- **Escalate when:** the change handles a regulated data class; the agent cannot tell whether an endpoint is public.

### PRV-Q3 — For the next changed file, is its zone `foreign`?
- **Criteria:** the zone map row for the file's path.
- **Branches:**
  - foreign → PRV-Q4
  - owned or adopted → PRV-Q5
- **Default:** owned.
- **Escalate when:** the PR edits a foreign file itself (the team may not change it): raise a question, do not review the edit as normal.

### PRV-Q4 — Do the team's border checks pass for calls into the foreign zone?
- **Criteria:** at the call site in owned code: adapter present (DDD-5, CA-2); remote call has a timeout (DS-2); foreign errors are translated (ERR-4); foreign types do not enter the domain (CA-4). Never comment on the foreign code's inside.
- **Branches:**
  - each failed check → finding with provenance including the zone → PRV-Q6
  - all pass → PRV-Q6
- **Default:** a missing border check is a finding.
- **Escalate when:** the foreign API cannot be wrapped at all (no hook for timeouts or cancellation): suggest a waiver, never a silent pass.

### PRV-Q5 — Is any floor rule violated in this file?
- **Criteria:** every rule in `floors.md` that the Context Pack marks relevant, checked against the diff.
- **Branches:**
  - YES → finding at the severity in the Charter rubric (`blocker`); no lesson or waiver may soften it → PRV-Q6
  - NO → PRV-Q6
- **Default:** when it cannot be determined, ask (PRV-Q9), do not assume pass.
- **Escalate when:** a floor violation is already in main branch code the PR depends on.

### PRV-Q6 — Is any other rule in the pack violated?
- **Criteria:** rules selected by the Resolver; `Holds when` from each rule table.
- **Branches:**
  - violated → finding at the Charter rubric severity → PRV-Q7
  - not violated → PRV-Q7
- **Default:** do not invent findings outside the pack.
- **Escalate when:** two rules in the pack contradict each other (see Tensions in the foundation file).

### PRV-Q7 — Does an active lesson or waiver cover this finding?
- **Criteria:** lens items whose `scope` matches the file, `status: active`, not past `expires` / `review-by`; Resolver rules R2, R3, R5, R6.
- **Branches:**
  - lesson with `adjusts` → lower severity exactly one step; add its id to provenance → PRV-Q8
  - waiver → mark finding `waived`, keep it visible with the reason → PRV-Q8
  - contested lessons → question to humans → PRV-Q8
  - none → unchanged → PRV-Q8
- **Default:** unchanged.
- **Escalate when:** a lesson would lower a floor finding (invalid: report the lens entry as broken).

### PRV-Q8 — Critical-thinking pass
- **Criteria:** a fixed checklist over all findings and over the change as a whole:
  1. What assumption does this change make?
  2. What input or state would break it?
  3. Is there a simpler design that meets the spec?
  4. Does it contradict a recorded decision (RUB-3)?
  5. What would a reviewer from this team ask?
  6. Which finding am I least sure of?
- **Branches:**
  - new concern found → add as finding or question → PRV-Q9
  - nothing new → PRV-Q9
- **Default:** nothing new.
- **Escalate when:** the pass shows the spec itself is ambiguous in a way that changes the review.

### PRV-Q9 — Is confidence low on a blocker or major finding?
- **Criteria:** the finding's `confidence` and the evidence cited (file:line, test output).
- **Branches:**
  - YES → convert to a question for humans
  - NO → keep as finding
- **Default:** convert to a question (never assert what you cannot show).
- **Escalate when:** three or more questions result from one PR; summarise the common unknown instead.

### PRV-Q10 — Synthesis
- **Criteria:** existing human comments on the PR; the Charter's comment cap; the `autonomy` level.
- **Branches:**
  - remove findings already raised by humans, add "agent agrees" notes → rank by severity → cap new comments → label each by source (floor / rule / team lesson) → post according to `autonomy`
- **Default:** `suggest-only` (private summary to the author).
- **Escalate when:** the PR has a blocker and autonomy is `suggest-only`: notify the author directly, do not only wait.

## Trade-off tables

| Tier | What it switches on |
|---|---|
| NORMAL | Floors + rules selected by path and topic |
| HIGH | NORMAL + all `Q-SEC-*` and `CON-*` checks + a mandatory question list for anything unverified |

## Recording

Each run produces one summary message (`message/v2`) whose findings carry `provenance`. The run keeps no state of its own (FP-7). Observations for the Lens are written by the Observer from human reactions, not by this tree.

## References

**Local artifacts:**
- `schemas/zone-map.schema.md`, `../resolver.md`, `../floors.md`, `../principles.md`.
- `agentic-sdlc/schemas/tree.schema.md`: node format. `agentic-sdlc/trees/risk-tier.tree.md`: tree reused conceptually at PRV-Q2.

**External authoritative sources:**
- Google Engineering Practices, "How to do a code review" (google.github.io/eng-practices): reviewers prioritise design and correctness; the tree follows that order.

## Related

- `zone-classification.tree.md`, `lesson-promotion.tree.md`.
