---
schema: foundation/v2
last-updated: 2026-10-04
rule-prefix: TST
subject: delivery
---

# Testing Strategy

How qa sets the testing bar and how test tasks are written: what to test at which level, how to name tests, how to keep them deterministic, and how to read coverage. Tests run only via `cmd.test_unit` and `cmd.test_integration`. Reviews cite `TST-n`.

## Rules

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| TST-1 | Every acceptance criterion has a test that cites its AC id (`../quality/functional-suitability.md`, Q-FUNC-2). | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm (fallback) | — |
| TST-2 | Test behaviour, not implementation. Assert observable outcomes through public surfaces; don't assert on private state or incidental call order. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm (fallback) | — |
| TST-3 | Naming states scenario and expectation: `<unit>_<condition>_<expected>` or the stack profile's equivalent descriptive form ("rejects order when cart is empty"). | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm (fallback) | — |
| TST-4 | Arrange–Act–Assert, one behaviour per test; shared setup via builders/factories, not deep fixture inheritance. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm (fallback) | — |
| TST-5 | Deterministic. No real clock, randomness, network, or sleep in unit tests — inject them (`../design/clean-architecture.md`, CA-7). Seed any randomness and print the seed on failure. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm (fallback) | — |
| TST-6 | Isolated and order-independent. Each test creates its own data and cleans up; tests pass when run alone, in any order, and in parallel. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm (fallback) | — |
| TST-7 | No flaky tests in the main branch. A flaky test is quarantined with an owner and a fix task within the same feature; never retried until green. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm (fallback) | — |
| TST-8 | Fakes over mocks. Prefer in-memory implementations of ports; use interaction mocks only to verify an effect that has no observable state (e.g. "email was sent"). | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| TST-9 | Error paths are tested (`../code/error-handling.md`, ERR-12), including timeout and duplicate-delivery for distributed interactions. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm (fallback) | — |
| TST-10 | Regression first. A bug fix starts with a failing test that reproduces it (`../../../conventions.md` §8). | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm (fallback) | — |
| TST-11 | Test code is production code for readability and review; it follows `../code/coding-standards.md`. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm (fallback) | — |
| TST-12 | Fast feedback. The unit suite runs in under the constitution's limit (default: 60 s); slow tests move to integration. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm (fallback) | — |

## Interpreting

**The pyramid**

| Level | Scope | Real dependencies? | Speed | Runs via | Share |
|---|---|---|---|---|---|
| **Unit** | One function/class/use case | None — fakes for ports | ms | `cmd.test_unit` | Most tests |
| **Integration** | One adapter against its real dependency (database, broker, file system), or one module through its public surface | Yes, local/ephemeral | seconds | `cmd.test_integration` | Fewer |
| **Contract** | Provider honours its contract; consumer expectations still hold | Provider in isolation | seconds | `cmd.test_integration` | One suite per contract |
| **End-to-end** | A P1 user journey through the deployed system | Everything | minutes | Pipeline stage | A handful — P1 stories only |

**What to test where**

| Code | Level | Notes |
|---|---|---|
| Domain entities, value objects, policies | Unit | No doubles at all; table-driven over edge cases |
| Use cases (application layer) | Unit | Fake driven ports (in-memory repos); assert outcomes and emitted events, not call sequences |
| Repositories, queries, migrations | Integration | Real engine of the same kind and major version as production |
| HTTP/RPC controllers, message consumers | Integration (thin) | Request → response mapping, auth wiring, error translation |
| External API clients | Contract + integration against a stub of the contract | Never hit third-party production in tests |
| API/event contracts | Contract | Provider verification + recorded consumer expectations (`../design/contract-design.md`, CON-14) |
| P1 acceptance scenarios | End-to-end or high-level integration | One test per scenario, named by AC id |

**Rules**

**Coverage philosophy**

- Coverage is a **floor and a flashlight, not a target**. The constitution sets the floor (default: 80% line coverage on domain + application layers; adapters not counted).
- Uncovered lines in a diff are a review question ("why is this untested?"), not an automatic fail.
- Never write assertion-free tests to raise coverage; a test without a meaningful assertion is a finding.
- Mutation testing, where the stack profile supports it, is the stronger signal for domain logic.

**Depth by risk**

Raise the bar for HIGH risk-tier features: every authorization rule gets a negative test; every state transition gets a test; contract and integration tests are mandatory, not optional.

**Application note:** stack profiles define concrete commands and idioms; this foundation defines stack-agnostic intent.

## Tensions

| Rule A | Rule B | Default resolution |
|---|---|---|
| Process completeness | Fast feedback | Keep required evidence, but choose the lightest check that proves the rule. |

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/schemas/foundation.schema.md`: schema and required structure for this foundation.
- `copilot/frameworks/agentic-sdlc/schemas/_system.md`: shared rule-table, id, path and references rules.
- `foundations/delivery/testing-strategy.md`: this foundation file.

**External authoritative sources:**
- Mike Cohn, *Succeeding with Agile* (2009) — test pyramid; Martin Fowler, "The Practical Test Pyramid" (Ham Vocke, 2018).
- Gerard Meszaros, *xUnit Test Patterns* (2007) — test doubles profile registry.
- Kent Beck, *Test-Driven Development: By Example* (2002).
- Google Testing Blog, "Flaky Tests at Google and How We Mitigate Them" (2016).

## Related

- `../quality/functional-suitability.md`, `../quality/maintainability.md` — contracts tests prove.
- `../delivery/spec-writing.md` — where acceptance scenarios come from.
- `../delivery/release-pipeline.md` — which stage runs which level.
