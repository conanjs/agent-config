---
schema: foundation/v2
last-updated: 2026-10-04
rule-prefix: FF
subject: review
---

# Fitness Functions

Automatable checks that keep architectural characteristics from eroding — described conceptually here, implemented per stack through `cmd.lint` rules, architecture tests run by `cmd.test_unit`, or dedicated pipeline steps. Reviews and decisions cite `FF-n`.

## Rules

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| FF-1 | Run the Dependency direction fitness function. | Import edges vs. allowed layer/module graph in `docs/architecture.md` | The artifact violates this rule in the affected surface. | script | — |
| FF-2 | Run the Cycle detection fitness function. | Strongly connected components in the module/package graph | The artifact violates this rule in the affected surface. | script | — |
| FF-3 | Run the Public-surface only fitness function. | Imports into another module's internal paths | The artifact violates this rule in the affected surface. | script | — |
| FF-4 | Run the Unit size & complexity fitness function. | Function length, cyclomatic/cognitive complexity, file length | The artifact violates this rule in the affected surface. | llm (fallback) | — |
| FF-5 | Run the Module size fitness function. | Non-test lines / files per module | The artifact violates this rule in the affected surface. | llm (fallback) | — |
| FF-6 | Run the Contract compatibility fitness function. | Diff of each contract against the last released version, classified breaking/non-breaking | The artifact violates this rule in the affected surface. | script | — |
| FF-7 | Run the Consumer expectations fitness function. | Recorded consumer expectations verified against the provider | The artifact violates this rule in the affected surface. | script | — |
| FF-8 | Run the Framework isolation fitness function. | Framework/driver imports in domain or application layers | The artifact violates this rule in the affected surface. | script | — |
| FF-9 | Run the Dependency health fitness function. | `cmd.audit` findings by severity; new dependencies without a decision record | The artifact violates this rule in the affected surface. | script | — |
| FF-10 | Run the Test determinism fitness function. | Unit suite run repeatedly and in random order | The artifact violates this rule in the affected surface. | llm (fallback) | — |
| FF-11 | Run the Coverage floor fitness function. | Line/branch coverage of domain + application layers | The artifact violates this rule in the affected surface. | llm (fallback) | — |
| FF-12 | Run the Suppression count fitness function. | Lint/type suppressions without a reason comment | The artifact violates this rule in the affected surface. | llm (fallback) | — |
| FF-13 | Run the Data ownership fitness function. | Data stores accessed by more than one module/service | The artifact violates this rule in the affected surface. | script | — |
| FF-14 | Run the Performance budget fitness function. | Benchmark or load-test result vs. stated target | The artifact violates this rule in the affected surface. | llm (fallback) | — |
| FF-15 | Run the Runtime SLO fitness function. | Error rate, latency percentiles, error-budget burn post-deploy | The artifact violates this rule in the affected surface. | script | — |
| FF-16 | Run the Stale flags fitness function. | Release flags past their removal date | The artifact violates this rule in the affected surface. | script | — |

## Interpreting

**What a fitness function is**

An objective, repeatable, automated test of an architectural characteristic, with a threshold and an owner. If a rule can be a fitness function, it should be — humans then review intent, not mechanics (`review-rubrics.md`, RUB-P5).

| Field | Every fitness function states |
|---|---|
| **Characteristic** | Which quality it protects (link to a `Q-*` or axiom id) |
| **Measure** | What is computed from code, contracts, or runtime |
| **Threshold** | Pass/fail boundary, set in the constitution |
| **Trigger** | Every commit (atomic), nightly (holistic), or post-deploy (runtime) |
| **Runs via** | Which `cmd.*` slot or pipeline stage executes it |

**Catalog**

**Rules**

**Application note:** stack profiles define concrete commands and idioms; this foundation defines stack-agnostic intent.

## Tensions

| Rule A | Rule B | Default resolution |
|---|---|---|
| Automation | Human review | Automate objective checks and leave intent and trade-offs to reviewers. |

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/schemas/foundation.schema.md`: schema and required structure for this foundation.
- `copilot/frameworks/agentic-sdlc/schemas/_system.md`: shared rule-table, id, path and references rules.
- `foundations/review/fitness-functions.md`: this foundation file.

**External authoritative sources:**
- Neal Ford, Rebecca Parsons, Patrick Kua, Pramod Sadalage, *Building Evolutionary Architectures* (2nd ed., 2023).
- Mark Richards & Neal Ford, *Fundamentals of Software Architecture* (2020) — architecture characteristics and fitness functions.
- ISO/IEC 25010:2023 — the characteristics being protected.

## Related

- `review-rubrics.md` — what remains a human/agent review check.
- `../design/clean-architecture.md`, `../design/module-boundaries.md` — the rules FF-1 to FF-5 enforce.
- `../design/contract-design.md` — FF-6, FF-7.
- `../delivery/release-pipeline.md` — where each trigger runs.
