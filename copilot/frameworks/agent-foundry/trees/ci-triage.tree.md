---
schema: tree/v2
last-updated: 2026-10-24
prefix: CIT
owner: ci-failure-triager
phases: [triage]
feeds: the triage note posted for one failed CI run (cause class, evidence, suggested next step)
---

# CI Failure Triage (CIT)

Classifies why one CI run failed and suggests the next human step. It does NOT rerun jobs, edit code, change CI config or mute tests. **Default is unknown:** when evidence is thin the answer is a question, not a guess.

## Overview

```
CIT-Q1 Is the log complete enough to read the first failure?
├─ NO  → ask for the full log → stop
└─ YES → CIT-Q2
CIT-Q2 Did a step before the tests fail (checkout, install, build, auth)?
├─ YES → class: INFRA-OR-CONFIG → CIT-Q5
└─ NO  → CIT-Q3
CIT-Q3 Does an active lesson mark this test or runner as flaky?
├─ YES → class: KNOWN-FLAKY (still show evidence) → CIT-Q5
└─ NO  → CIT-Q4
CIT-Q4 Does the first failing test touch files changed in this commit?
├─ YES → class: LIKELY-REGRESSION → CIT-Q5
└─ NO  → class: UNKNOWN → CIT-Q5
CIT-Q5 Confidence low?
├─ YES → state the question for a human
└─ NO  → post the triage note
```

## Nodes

### CIT-Q1 — Is the log complete enough to read the first failure?
- **Criteria:** the log reaches the first non-zero exit; it is not truncated by the CI provider.
- **Branches:**
  - YES → CIT-Q2
  - NO → ask for the full log and stop
- **Default:** NO.
- **Escalate when:** the log contains what looks like a secret (do not quote it; see Q-SEC-5).

### CIT-Q2 — Did a step before the tests fail?
- **Criteria:** the first failing step name and exit code; steps such as checkout, dependency install, build, credential login.
- **Branches:**
  - YES → INFRA-OR-CONFIG → CIT-Q5
  - NO → CIT-Q3
- **Default:** NO (read the tests next).
- **Escalate when:** the same pre-test step failed in the last three runs of other branches.

### CIT-Q3 — Does an active lesson mark this test or runner as flaky?
- **Criteria:** lessons in the team Lens whose scope matches the test path or runner, `status: active`, not expired.
- **Branches:**
  - YES → KNOWN-FLAKY, citing the lesson id → CIT-Q5
  - NO → CIT-Q4
- **Default:** NO (do not assume flakiness without a recorded lesson).
- **Escalate when:** the flaky test failed in a way the lesson does not describe.

### CIT-Q4 — Does the first failing test touch files changed in this commit?
- **Criteria:** the failing test's imports and paths against the commit diff.
- **Branches:**
  - YES → LIKELY-REGRESSION → CIT-Q5
  - NO → UNKNOWN → CIT-Q5
- **Default:** UNKNOWN.
- **Escalate when:** the diff changes shared test helpers or CI config.

### CIT-Q5 — Is confidence low?
- **Criteria:** whether the cited evidence (log lines with line numbers) directly supports the class.
- **Branches:**
  - YES → post a question, not a verdict
  - NO → post the triage note
- **Default:** YES.
- **Escalate when:** the suggested next step would be to disable a check; that is a human decision.

## Trade-off tables

| Class | Suggested next step |
|---|---|
| INFRA-OR-CONFIG | Ask the platform or CI owner; rerun is a human choice |
| KNOWN-FLAKY | Link the lesson; rerun is a human choice |
| LIKELY-REGRESSION | Point to the changed file and the failing assertion |
| UNKNOWN | List what was checked and what is missing |

## Recording

One triage note per failed run. The run keeps no state (FP-7). A human confirming "yes, flaky" feeds the Observer, which may propose a lesson through `lesson-promotion.tree.md`.

## References

**Local artifacts:**
- `charters/ci-failure-triager.charter.md`, `../resolver.md`, `../principles.md`.

**External authoritative sources:**
> _None._

## Related

- `pr-review.tree.md`, `lesson-promotion.tree.md`.
