---
schema: foundation/v2
last-updated: 2026-10-04
rule-prefix: SPEC
subject: delivery
---

# Spec Writing

How product-spec turns a stated intent into a `spec.md` of independently testable user stories, requirements, and acceptance criteria — the shape `/speckit-specify` produces. Reviews cite `SPEC-n`.

## Rules

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| SPEC-1 | What and why, never how. No languages, frameworks, data stores, endpoints, or class names in `spec.md`. Those belong to `plan.md`. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| SPEC-2 | Independently testable stories. Each story has an "Independent Test" line describing how to verify it with only that story implemented. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm (fallback) | — |
| SPEC-3 | Every acceptance scenario is Given/When/Then with concrete values ("Given a cart with 3 items totalling 120.00"), not adjectives ("a large cart"). | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm (fallback) | — |
| SPEC-4 | Every requirement is testable and unambiguous. Ban unmeasurable words — *fast, easy, intuitive, robust, secure, scalable* — unless followed by a number or a criterion. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm (fallback) | — |
| SPEC-5 | Success criteria are measurable and technology-agnostic ("Users complete checkout in under 2 minutes", not "API p95 < 200 ms"). | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| SPEC-6 | Assume before asking. Use industry-standard defaults (e.g. email+password auth, standard retention, sensible pagination) and record them under Assumptions. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| SPEC-7 | Max 3 clarifications, ranked by impact: scope > security/privacy > user experience > technical detail. Each offers options with their implications. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| SPEC-8 | Edge cases are listed: empty states, limits, concurrent edits, permission denied, partial failure, duplicate submission. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| SPEC-9 | Scope is bounded. An explicit "Out of scope" list names adjacent things the feature does not do. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| SPEC-10 | Ubiquitous language. One term per concept; define new terms in Key Entities (`../design/domain-driven-design.md`, DDD-1). | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| SPEC-11 | Non-functional needs are stated as numbers when they matter (load, latency percentiles, data volume, availability) so quality contracts can check them. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| SPEC-12 | Behaviour-changing fixes amend the spec — the affected AC is edited, not worked around in code (`../../../conventions.md` §8). | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |

## Interpreting

**Procedure**

1. **Extract** actors, actions, data, and constraints from the intent. Write down what the user asked for, not how to build it.
2. **Slice into user stories** — each a thin, end-to-end journey that delivers value on its own.
3. **Prioritize** each story P1/P2/P3 (table below) and state *why this priority*.
4. **Write acceptance scenarios** for each story in Given/When/Then form, including at least one failure or edge scenario.
5. **Derive functional requirements** (`FR-001`…) as testable "The system MUST…" statements; each traces to a story.
6. **Name key entities** in the ubiquitous language (no fields, no storage).
7. **Define success criteria** (`SC-001`…): measurable, technology-agnostic outcomes.
8. **Fill gaps with informed assumptions**; record each under `## Assumptions`. Mark only true unknowns `[NEEDS CLARIFICATION: question]` — **max 3**.
9. **Self-check** against the rules below before handing over for G2.

**Priorities**

| Priority | Meaning | Test |
|---|---|---|
| **P1** | The MVP: without it the feature has no value | Shipping P1 alone is a viable, demonstrable release |
| **P2** | Important; materially improves value or covers a major secondary actor | Can ship one iteration after P1 |
| **P3** | Nice to have; polish, edge actors, convenience | Can be dropped without breaking P1/P2 |

**Rules**

**Acceptance criterion template**

```markdown
**Acceptance Scenarios**:
1. **Given** <precondition with concrete values>, **When** <single action>, **Then** <observable outcome>
2. **Given** <failure precondition>, **When** <action>, **Then** <error outcome the user sees>
```

**Clarification question template**

```markdown
[NEEDS CLARIFICATION: <question>]
Options: A) <option> — <implication> · B) <option> — <implication> · Custom
```

**Self-check before G2**

- [ ] No implementation detail (SPEC-1)
- [ ] Every story has priority, rationale, independent test, ≥ 2 scenarios
- [ ] Every FR traces to a story; every story has ≥ 1 FR
- [ ] ≤ 3 clarification markers; assumptions recorded
- [ ] Success criteria measurable; edge cases and out-of-scope listed

**Application note:** stack profiles define concrete commands and idioms; this foundation defines stack-agnostic intent.

## Tensions

| Rule A | Rule B | Default resolution |
|---|---|---|
| Process completeness | Fast feedback | Keep required evidence, but choose the lightest check that proves the rule. |

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/schemas/foundation.schema.md`: schema and required structure for this foundation.
- `copilot/frameworks/agentic-sdlc/schemas/_system.md`: shared rule-table, id, path and references rules.
- `foundations/delivery/spec-writing.md`: this foundation file.

**External authoritative sources:**
- github/spec-kit — `spec-template.md` and the `/speckit-specify`, `/speckit-clarify` commands.
- Mike Cohn, *User Stories Applied* (2004) — INVEST.
- Dan North, "Introducing BDD" (2006) — Given/When/Then.
- Gojko Adzic, *Specification by Example* (2011).

## Related

- `../quality/functional-suitability.md` — the checks applied to the finished spec.
- `../delivery/testing-strategy.md` — how acceptance scenarios become tests.
- `../review/review-rubrics.md` — review format for G2.
