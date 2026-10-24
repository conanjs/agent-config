---
schema: foundation/v2
last-updated: 2026-10-04
rule-prefix: RUB
subject: review
---

# Review Rubrics

How any role in `mode: review` evaluates an artifact: the shared structure of a check, how findings are written, how severity is assigned, and when a review passes or fails — plus generic checks every role applies. Reviews cite `RUB-n` for these generic checks.

## Rules

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| RUB-1 | It does what its task line says, and nothing outside that scope | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| RUB-2 | Every behaviour traces to a story/AC or a plan decision (`../quality/functional-suitability.md`, Q-FUNC-7) | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| RUB-3 | It doesn't contradict the constitution, an accepted decision record, or a frozen contract | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| RUB-4 | Names and terms match the ubiquitous language (DDD-1) | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| RUB-5 | No secrets, credentials, or personal data in the artifact | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| RUB-6 | Required tests/evidence for the change exist and pass | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm (fallback) | — |
| RUB-7 | Documentation affected by the change (`docs/architecture.md`, contract, README section) is updated or a P7 task exists | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| RUB-8 | No unexplained new dependency, suppression, or threshold change | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| RUB-9 | Assumptions the author made are stated, not hidden | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |

## Interpreting

**Structure of a rubric check**

Every check a role's rubric lists (in its agent definition or a principle file) has:

| Field | Meaning |
|---|---|
| **Id** | Stable citable id from its principle file (e.g. `Q-MAINT-1`, `CA-1`, `ERR-2`) or `RUB-n` below |
| **Applies to** | Artifact type: spec, plan, contract, code, test, pipeline config, docs |
| **Pass condition** | An observable "satisfied when…" statement — no taste-based checks |
| **Evidence** | What the reviewer looked at: file:line, script output, test name |
| **Default severity** | Used unless the finding's context justifies another (stated in the detail) |

**Writing a finding**

Each finding is one `findings` entry in the role message (`../../schemas/message.schema.md`):

```yaml
- check: ERR-2
  result: fail
  detail: "[major] orders/app/place_order:48 — catch block ignores repository error; translate to OrderPersistenceFailed and propagate."
```

**Severity**

| Severity | Meaning | Effect |
|---|---|---|
| `blocker` | Violates spec/contract, security, data integrity, or a dependency/compatibility rule | `review-fail` |
| `major` | Real defect risk or rule violation with likely future cost | `review-fail` |
| `minor` | Rule deviation with low, local cost | Pass; listed for follow-up |
| `nit` | Optional improvement | Pass; omit unless asked |

**Pass/fail rules**

**Generic checks (all roles, all artifacts)**

**Application note:** stack profiles define concrete commands and idioms; this foundation defines stack-agnostic intent.

## Tensions

| Rule A | Rule B | Default resolution |
|---|---|---|
| Automation | Human review | Automate objective checks and leave intent and trade-offs to reviewers. |

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/schemas/foundation.schema.md`: schema and required structure for this foundation.
- `copilot/frameworks/agentic-sdlc/schemas/_system.md`: shared rule-table, id, path and references rules.
- `foundations/review/review-rubrics.md`: this foundation file.

**External authoritative sources:**
- Google Engineering Practices, "How to do a code review" (google.github.io/eng-practices).
- Conventional Comments (conventionalcomments.org) — labelled, actionable review comments.
- ISO/IEC 20246:2017, *Work product reviews*.

## Related

- `fitness-functions.md` — checks that are automated instead of reviewed.
- `../quality/` — quality contracts whose `Q-*` ids reviews cite.
- `../code/coding-standards.md`, `../delivery/testing-strategy.md` — role-specific rules cited in reviews.
