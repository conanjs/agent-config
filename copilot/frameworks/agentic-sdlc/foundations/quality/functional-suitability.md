---
schema: foundation/v2
last-updated: 2026-10-04
rule-prefix: Q-FUNC
subject: quality
---

# Functional Suitability

ISO/IEC 25010 quality contract: the product provides functions that meet stated and implied needs when used under specified conditions. Reviews cite `Q-FUNC-n`.

## Rules

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| Q-FUNC-1 | Every acceptance criterion (AC id) in `spec.md` maps to at least one task in `tasks.md` | Traceability: task lines reference `[USn]` / AC ids | No evidence shows the rule holds. | script | — |
| Q-FUNC-2 | Every acceptance criterion is covered by at least one automated test whose name or annotation cites the AC id | Test list from `cmd.test_unit` / `cmd.test_integration` | No evidence shows the rule holds. | llm (fallback) | — |
| Q-FUNC-3 | No `[NEEDS CLARIFICATION]` markers remain in `spec.md` at G2 | Spec text search | No evidence shows the rule holds. | script | — |
| Q-FUNC-4 | Each acceptance scenario (Given/When/Then) passes as written, including its stated error/edge scenarios | Passing tests | No evidence shows the rule holds. | llm (fallback) | — |
| Q-FUNC-5 | Boundary values (empty, zero, max, duplicate, unicode, time-zone edges) relevant to each input are tested | Test cases list | No evidence shows the rule holds. | llm (fallback) | — |
| Q-FUNC-6 | Error responses match the contract (status/code/shape) defined in `contracts/` | Contract tests | No evidence shows the rule holds. | llm (fallback) | — |
| Q-FUNC-7 | No behaviour exists that isn't traceable to a story or an explicit non-functional requirement (no scope creep) | Review of diff vs. `spec.md` | No evidence shows the rule holds. | llm | — |
| Q-FUNC-8 | Each P1 story is independently demonstrable — it delivers value without P2/P3 stories | Story's independent test passes in isolation | No evidence shows the rule holds. | llm (fallback) | — |
| Q-FUNC-9 | Domain invariants named in `spec.md` / `data-model.md` are enforced in the domain layer, not only in the UI or transport | Code location + unit tests | No evidence shows the rule holds. | llm (fallback) | — |

## Interpreting

**Definition**

Functional suitability is the degree to which delivered behaviour matches the specification (`spec.md`) — nothing missing, nothing wrong, nothing irrelevant. It is the attribute the acceptance criteria measure directly.

**Sub-characteristics**

| Sub-characteristic | Question it answers |
|---|---|
| **Functional completeness** | Is every specified user story and acceptance criterion implemented? |
| **Functional correctness** | Does each function produce the right result, including edge cases and error paths? |
| **Functional appropriateness** | Do the functions actually help accomplish the user's task, without unnecessary steps or unrequested features? |

**Checks — an artifact satisfies this when…**

**Failure severity defaults**

| Situation | Severity |
|---|---|
| A P1 acceptance criterion fails or is unimplemented | `blocker` |
| A P2/P3 criterion fails | `major` |
| Unrequested behaviour added | `major` (route to product-spec for a spec amendment or removal) |
| Missing edge-case test for an implemented criterion | `minor` |

**Who checks**

- **product-spec** at P3 (Q-FUNC-3, Q-FUNC-8 design).
- **qa** at P5 (`/speckit-analyze`: Q-FUNC-1) and in P6 review (Q-FUNC-2, 4, 5).
- **engineering** in P6 review (Q-FUNC-6, 7, 9).

**Application note:** stack profiles define concrete commands and idioms; this foundation defines stack-agnostic intent.

## Tensions

| Rule A | Rule B | Default resolution |
|---|---|---|
| Quality bar | Delivery speed | Do not waive blocker or major quality failures; record accepted lower-risk trade-offs. |

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/schemas/foundation.schema.md`: schema and required structure for this foundation.
- `copilot/frameworks/agentic-sdlc/schemas/_system.md`: shared rule-table, id, path and references rules.
- `foundations/quality/functional-suitability.md`: this foundation file.

**External authoritative sources:**
- ISO/IEC 25010:2023, *Systems and software engineering — SQuaRE — Product quality model*.
- ISO/IEC 25023, *Measurement of system and software product quality*.
- github/spec-kit — specification template (user stories, acceptance scenarios, `[NEEDS CLARIFICATION]`).

## Related

- `maintainability.md`, `performance-efficiency.md`, `reliability.md`, `security.md` — sibling quality contracts.
- `../delivery/spec-writing.md` — how acceptance criteria are written.
- `../delivery/testing-strategy.md` — how criteria become tests.
- `../review/review-rubrics.md` — finding format and severities.
