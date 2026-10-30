---
schema: tree/v2
last-updated: 2026-10-04
prefix: TD
owner: qa
phases: [P4, P5]
feeds: which test levels each task needs, and whether P6 runs `cmd.test_integration` in addition to `cmd.test_unit`
---

# Test-Strategy Depth (TD)

Decides how deep testing goes for a feature or task: unit only, unit plus integration, or unit plus integration plus contract tests. It does NOT decide which tools run the tests (toolchain tree) or lower a bar fixed by the constitution — qa's constitution bar is fixed, and the result of this tree can only add to it.

## Overview

```
TD-Q1 Constitution fixes a testing bar?
├─ YES → use it (this tree may only add levels) → TD-Q2
└─ NO  → TD-Q2 Authorization / security / payment logic?  (forced YES when risk tier HIGH)
          ├─ YES → unit tests mandatory + security review → TD-Q3
          └─ NO  → TD-Q3 Crosses a process / network boundary?
                    ├─ YES → unit + integration (+ contract tests if multi-repo)
                    └─ NO  → unit tests
```

## Nodes

### TD-Q1 — Does the constitution fix a testing bar?
- **Criteria:** Testing section of the project constitution and, if present, the system constitution (coverage thresholds, required test levels, test-first rules).
- **Branches:**
  - YES → apply that bar as the floor → TD-Q2 (may add levels, never remove)
  - NO → TD-Q2
- **Default:** NO when the constitution has no testing section.
- **Escalate when:** the bar cannot be met by the active stack's test slots (e.g. it demands contract testing and the stack has none).

### TD-Q2 — Does the task touch authorization, security or payment logic?
- **Criteria:** The task's file paths and description against the feature's risk-tier record; auth, secrets, payment and permission code paths. When the feature's risk tier is HIGH, this node is forced to YES for every task.
- **Branches:**
  - YES → unit tests mandatory, including negative cases (denied access, invalid input) + security review → TD-Q3
  - NO → TD-Q3
- **Default:** YES when the task touches an auth or secrets path and the evidence is unclear (fail-closed, as the risk-tier tree does).
- **Escalate when:** the logic cannot be unit-tested without real credentials or a live third-party payment system.

### TD-Q3 — Does the code cross a process or network boundary?
- **Criteria:** The task calls or exposes an HTTP/RPC endpoint, publishes or consumes events, talks to a data store, or calls a third party. Multi-repo is true when `docs/architecture.md` has a `system:` section.
- **Branches:**
  - YES, single repo → unit + integration tests
  - YES, multi-repo and the boundary is a contract in the system repo → unit + integration + contract tests against that contract version
  - NO → unit tests
- **Default:** unit tests only, unless any boundary is visible in the task's paths or `contracts/`.
- **Escalate when:** integration tests need an environment or service that cannot be started locally or in CI.

## Trade-off tables

| Level | Catches | Cost | Required when |
|---|---|---|---|
| Unit | Logic errors in one module | Low | Always |
| Integration | Wiring, queries, serialization | Medium (real store or container) | TD-Q3 YES |
| Contract | Provider/consumer drift across repos | Medium (contract kept in sync) | TD-Q3 YES and multi-repo |

## Recording

One decision record, `DR-<NNN>: Test depth`, in the feature's `specs/<NNN-feature>/research.md`, listing the levels per user story. qa then reflects it as `[QA]` test tasks in `tasks.md` at P5.

## References

**Local artifacts:**
- `proposals/agentic-sdlc-v2-structure.md` ?5.2 ? v2 tree layout and tree registration.
- `schemas/tree.schema.md` ? `tree/v2` node format and validation rules.
- `conventions.md` ?4 ? the P6 loop that runs the test slots.

**External authoritative sources:**
> _None._

## Related

- `risk-tier.tree.md` ? a HIGH tier forces TD-Q2.
- `toolchain-selection.tree.md` ? fills the test slots this tree turns on.
