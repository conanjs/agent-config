---
schema: foundation/v2
last-updated: 2026-10-04
rule-prefix: Q-MAINT
subject: quality
---

# Maintainability

ISO/IEC 25010 quality contract: the product can be modified effectively and efficiently without introducing defects. Reviews cite `Q-MAINT-n`.

## Rules

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| Q-MAINT-1 | Source dependencies respect the declared layer/module direction; no cycles | `../review/fitness-functions.md` FF-1, FF-2 | No evidence shows the rule holds. | llm | — |
| Q-MAINT-2 | Modules expose a deliberate public surface; internals are not imported from outside the module | FF-3 / review | No evidence shows the rule holds. | llm | — |
| Q-MAINT-3 | A single behavioural change touches files in one module (plus its tests), except for intended contract changes | Diff review | No evidence shows the rule holds. | llm (fallback) | — |
| Q-MAINT-4 | Each business rule has one authoritative implementation (`../design/design-principles.md`, DP-6) | Review | No evidence shows the rule holds. | llm | — |
| Q-MAINT-5 | Names follow the ubiquitous language (`../design/domain-driven-design.md`, DDD-1); no unexplained abbreviations | Review | No evidence shows the rule holds. | llm | — |
| Q-MAINT-6 | Functions/units stay within the size and complexity thresholds set in the constitution (default: function ≤ 50 lines, cyclomatic complexity ≤ 10) | `cmd.lint` / FF-4 | No evidence shows the rule holds. | llm (fallback) | — |
| Q-MAINT-7 | Non-obvious decisions are explained where they live (comment stating *why*) or in a decision record | Review | No evidence shows the rule holds. | llm | — |
| Q-MAINT-8 | `cmd.format`, `cmd.lint`, and `cmd.typecheck` pass with zero new suppressions; each existing suppression has a reason | Script output | No evidence shows the rule holds. | llm (fallback) | — |
| Q-MAINT-9 | Domain and application logic is unit-testable without network, disk, or clock (`../design/clean-architecture.md`, CA-7, CA-9) | Test suite | No evidence shows the rule holds. | llm (fallback) | — |
| Q-MAINT-10 | Tests are deterministic and independent of execution order (`../delivery/testing-strategy.md`) | Repeated runs of `cmd.test_unit` | No evidence shows the rule holds. | llm (fallback) | — |
| Q-MAINT-11 | No dead code, commented-out code, or unused dependencies are introduced | `cmd.lint` / review | No evidence shows the rule holds. | llm (fallback) | — |
| Q-MAINT-12 | `docs/architecture.md` reflects the module structure after the feature (P7) | Diff of `docs/architecture.md` | No evidence shows the rule holds. | llm | — |

## Interpreting

**Definition**

Maintainability is the degree to which a competent engineer (or agent) unfamiliar with the code can understand it, change it in one place, and verify the change — quickly and safely.

**Sub-characteristics**

| Sub-characteristic | Question it answers |
|---|---|
| **Modularity** | Does a change to one component have minimal impact on others? |
| **Reusability** | Can an asset be used in more than one place without copying? |
| **Analysability** | Can one diagnose a defect or assess a change's impact quickly? |
| **Modifiability** | Can it be changed without degrading quality or introducing defects? |
| **Testability** | Can test criteria be set and tests run effectively? |

**Checks — an artifact satisfies this when…**

**Failure severity defaults**

| Situation | Severity |
|---|---|
| Dependency-direction violation or new cycle (Q-MAINT-1) | `blocker` |
| Logic not unit-testable because I/O is embedded (Q-MAINT-9) | `major` |
| Duplicated business rule (Q-MAINT-4) | `major` |
| Threshold exceeded without justification (Q-MAINT-6) | `minor` |
| Naming drift from the ubiquitous language (Q-MAINT-5) | `minor` |

**Application note:** stack profiles define concrete commands and idioms; this foundation defines stack-agnostic intent.

## Tensions

| Rule A | Rule B | Default resolution |
|---|---|---|
| Quality bar | Delivery speed | Do not waive blocker or major quality failures; record accepted lower-risk trade-offs. |

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/schemas/foundation.schema.md`: schema and required structure for this foundation.
- `copilot/frameworks/agentic-sdlc/schemas/_system.md`: shared rule-table, id, path and references rules.
- `foundations/quality/maintainability.md`: this foundation file.

**External authoritative sources:**
- ISO/IEC 25010:2023, *Product quality model* — maintainability.
- Robert C. Martin, *Clean Code* (2008).
- Thomas McCabe, "A Complexity Measure" (IEEE TSE, 1976).
- Neal Ford, Rebecca Parsons, Patrick Kua, *Building Evolutionary Architectures* (2nd ed., 2023).

## Related

- `functional-suitability.md`, `performance-efficiency.md`, `reliability.md`, `security.md` — sibling quality contracts.
- `../design/design-principles.md`, `../design/clean-architecture.md` — the principles behind these checks.
- `../code/coding-standards.md`, `../code/refactoring.md`
- `../review/fitness-functions.md` — automation for Q-MAINT-1, 2, 6.
