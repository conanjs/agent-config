---
schema: schema/v1
last-updated: 2026-10-27
---

# Schema: Role Message (`message/v2`)

**Applies to:** every reply from a role instance · **Store:** runtime · **Written by:** the launched role · **Read by:** the Orchestrator (or the user, in standalone use) · **Loaded as:** n/a

One reply per launch.

## Structure

```yaml
schema: message/v2
from: <role-id>
to: orchestrator | user
mode: propose | decide | execute | review
type: proposal | decision | artifact | review-pass | review-fail | question | veto
payload:
  summary: <1–2 lines>
  confidence: high | medium | low
  rationale: <why; cite rule ids and tree node ids>
  artifacts: [<paths written or changed>]                       # decide / execute
  checks:                                                       # execute: tier-1 results
    - { cmd: cmd.lint | cmd.typecheck | cmd.test_unit | …, result: pass | fail | n/a }
  findings:                                                     # review only
    - { rule: <rule id>, enforced_by: lint | typecheck | test | script | llm,
        result: pass | fail | n/a, severity: blocker | major | minor | nit,
        location: <path:line>, detail: <one line> }
  procedure_steps:                                              # execute with state.procedure only
    - { step: <n>, result: done | n/a, note: <one line: what was done, or why n/a> }
  references_used: [<knowledge paths actually read>]
  unlisted_needs: [<knowledge or integration the task needed but the plan didn't list>]
  reason: spec-or-plan-wrong | fixable | blocked                # review-fail / veto only
  open_questions: []                                            # max 3, ranked by impact
```

## Rules

- `review-fail` has at least one `findings` entry with `result: fail` and severity `blocker` or `major`.
- A finding on a rule marked `lint`, `typecheck` or `test` cites the tool output. The reviewer doesn't re-judge it.
- `execute` replies list every tier-1 check in `checks`. A reply with any `fail` is not sent: the agent fixes the code first, within budget, or replies `type: question` with `reason: blocked`.
- `unlisted_needs` non-empty → the Orchestrator adds it to the next gate as a planning gap. This is the feedback channel for D7 (the planner missed a `touches:` or `refs:`).
- With `state.procedure`, `procedure_steps` has one entry per numbered step of the procedure, in order. A step that cannot be done is not marked `n/a` to get past it: the reply is `type: question` with `reason: blocked`. `artifacts` must lie inside the procedure's `allowed-paths`.
- `veto` is reserved for `security`.
- `open_questions` are only for what a human must answer.

## Example

```yaml
schema: message/v2
from: engineering
to: orchestrator
mode: review
type: review-fail
payload:
  summary: Role exposes mutable permissions; use case bypasses the aggregate.
  confidence: high
  findings:
    - { rule: PDM-class-modeled-R1, enforced_by: lint, result: fail, severity: major, location: src/domain/role.ts:4, detail: "cmd.lint: explicit-member-accessibility" }
    - { rule: DDD-8, enforced_by: llm, result: fail, severity: major, location: src/application/roles/grant.ts:12, detail: "pushes into role.permissions directly" }
  reason: fixable
  open_questions: []
```

## Changes from v1

- `findings.check` is renamed `rule`. New fields: `enforced_by`, `location`.
- New payload fields: `checks`, `references_used`, `unlisted_needs`. `to` may be `user` (standalone use).
