---
schema: tree/v2
last-updated: 2026-10-01
prefix: TS
owner: engineering
phases: [P4]
feeds: the stack per component
---

# Stack selection (TS)

### TS-Q1 — Does the mission name a stack?
- **Branches:**
  - YES → use it
  - NO → TS-Q2
- **Default:** NO.
- **Escalate when:** the named stack conflicts with a standard.

### TS-Q2 — Is there existing code?
- **Default:** YES.
- **Escalate when:** two stacks are found.
