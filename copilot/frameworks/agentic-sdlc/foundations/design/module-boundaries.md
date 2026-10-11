---
schema: foundation/v2
last-updated: 2026-10-04
rule-prefix: MOD
subject: design
---

# Module Boundaries

How the architecture role defines modules and layers inside one repo, checks dependency direction, and decides when to split or merge. Reviews cite `MOD-n`.

## Rules

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| MOD-1 | Modules by domain, layers inside. Top-level structure follows business capability (package by feature), not technical role (`controllers/`, `services/` at the root). | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| MOD-2 | Dependency direction is declared and acyclic. Every module-to-module dependency appears in the documented DAG; anything else is a violation. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| MOD-3 | Depend only on public surfaces. A module imports another's public entry point, never its internals. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| MOD-4 | Shared code is earned. A `shared`/`common` module holds only stable, domain-neutral utilities; business rules never go there. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| MOD-5 | Cross-module communication is explicit: a direct call to a public use case, or a domain event. No reaching into another module's persistence. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| MOD-6 | One owner per table/collection. Only the owning module reads/writes its storage directly. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| MOD-7 | The composition root wires modules; modules don't instantiate each other's adapters (`idiom.di`). | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| MOD-8 | Simplifications are recorded. Collapsing a layer or skipping a module boundary is stated in `docs/architecture.md` with the reason. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |

## Interpreting

**Procedure — defining modules**

1. **Start from the domain.** List the bounded contexts / sub-domains the repo serves (`../design/domain-driven-design.md`). Each becomes a candidate top-level module (vertical slice).
2. **Layer inside each module** per `../design/clean-architecture.md` (domain, application, adapters) using the stack profile's `project_layout`.
3. **Declare the public surface** of each module: the use cases, types, and events other modules may use. Everything else is internal.
4. **Draw the allowed-dependency graph** between modules (a DAG) and record it in `docs/architecture.md`.
5. **Encode the graph as checks** (`../review/fitness-functions.md`, FF-1 to FF-3) so violations fail the build, not just the review.
6. **Update at P7** — any new module, dependency edge, or simplification is reflected in `docs/architecture.md`.

**Rules**

**Dependency direction checks**

| Check | Fails when |
|---|---|
| Layer direction | An inner layer imports an outer one (domain → adapters) |
| Module DAG | An import edge isn't in the declared graph |
| Internals access | An import targets a non-public path of another module |
| Cycles | Any cycle among modules or layers |
| Framework leakage | A framework/driver import appears in domain or application |

Express these as automated rules (stack profile's `cmd.lint` configuration or a dedicated architecture test run by `cmd.test_unit`).

**When to split a module**

Split when **two or more** hold:
- Parts change for different reasons or on different cadences (`../design/design-principles.md`, DP-1).
- The module exceeds the size threshold in the constitution (default: ~30 files or ~3,000 lines of non-test code).
- Different parts use different vocabularies for the same word (a hidden second bounded context).
- Tests for one part routinely break from changes in another.

**When to merge**

Merge when two modules always change together, call each other in both directions, or one has no logic of its own.

**When a module should become a service**

Only when an independent deployment, scaling, ownership, or failure-isolation need exists **and** the module already has a clean public surface and owned data. Module first, service later — escalate to system-architecture.

**Application note:** stack profiles define concrete commands and idioms; this foundation defines stack-agnostic intent.

## Tensions

| Rule A | Rule B | Default resolution |
|---|---|---|
| Simplicity | Explicit boundaries | Add boundaries only where change rate, ownership or risk justifies them. |

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/schemas/foundation.schema.md`: schema and required structure for this foundation.
- `copilot/frameworks/agentic-sdlc/schemas/_system.md`: shared rule-table, id, path and references rules.
- `foundations/design/module-boundaries.md`: this foundation file.

**External authoritative sources:**
- David Parnas, "On the Criteria To Be Used in Decomposing Systems into Modules" (CACM, 1972).
- Robert C. Martin, *Clean Architecture* (2017) — component principles (ADP, SDP, SAP).
- Simon Brown, "Modular Monoliths" and the C4 model (c4model.com).

## Related

- `../design/clean-architecture.md` — the layer rules.
- `../quality/maintainability.md` — Q-MAINT-1, Q-MAINT-2.
- `../review/fitness-functions.md` — automated boundary checks.
- `../design/contract-design.md` — when boundaries become service contracts.
