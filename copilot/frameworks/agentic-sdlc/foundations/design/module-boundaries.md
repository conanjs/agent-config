---
schema: foundation/v2
last-updated: 2026-10-27
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
| MOD-9 | Choose the top-level packaging by size, and record the switch. **Layer-first** (`domain/`, `application/`, `infrastructure/`, `interface/` at the top of `src/`) while the repo serves one bounded context with at most three feature areas: the repo is then one module, layered inside, which satisfies MOD-1. **Feature-first** (one folder per feature area, the same layers inside each, plus `shared/` under MOD-4) from the fourth feature area or the second bounded context. The switch is a decision record in `docs/architecture.md`, done as a pure move with no behaviour change. | `docs/architecture.md` names the layout and the feature-area count, and the tree matches it | Five feature areas whose files are spread across four top-level layer folders; or a one-feature service split into `documents/` and `shared/` with nothing else | llm | — |

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

**Packaging: layer-first or feature-first (MOD-9)**

A *feature area* is a group of use cases around one aggregate or business capability, with its own vocabulary: for example `documents` (create, get, list, revise, delete, history) or `comments`. A use case is not a feature area; ten use cases on documents are still one.

| Repo | Layout | Top of `src/` | Why |
|---|---|---|---|
| One bounded context, 1–3 feature areas | Layer-first | `domain/ application/ infrastructure/ interface/` + composition root | Every layer is small; the layers themselves teach the rule. The repo is one module (MOD-1 holds at repo level) |
| 4+ feature areas, or a second bounded context | Feature-first | `documents/ comments/ … shared/` + composition root; each module has the four layers | A change to one feature touches one folder; module boundaries (MOD-3, MOD-5) can be enforced per folder |

Analogy: a small shop keeps all tools on four shelves sorted by kind; a workshop with ten benches gives each bench its own shelves plus one shared shelf.

**Switching:** write the decision record, then move files without changing behaviour (all tests pass unchanged), then add the module-boundary checks (MOD-3, FF-1). The stack reference shows both layouts: `stacks/<stack>/reference.md`.

**Application note:** stack profiles define concrete commands and idioms; this foundation defines stack-agnostic intent.

## Tensions

| Rule A | Rule B | Default resolution |
|---|---|---|
| Simplicity | Explicit boundaries | Add boundaries only where change rate, ownership or risk justifies them. |
| MOD-1 modules by domain | A one-feature repo | MOD-9: below the threshold the whole repo is one module, so layer folders at the top satisfy MOD-1. Technical-role folders that cut across features (`controllers/`, `services/`) still do not. |

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/schemas/foundation.schema.md`: schema and required structure for this foundation.
- `copilot/frameworks/agentic-sdlc/schemas/_system.md`: shared rule-table, id, path and references rules.
- `foundations/design/module-boundaries.md`: this foundation file.

**External authoritative sources:**
- David Parnas, "On the Criteria To Be Used in Decomposing Systems into Modules" (CACM, 1972).
- Robert C. Martin, *Clean Architecture* (2017) — component principles (ADP, SDP, SAP).
- Simon Brown, "Modular Monoliths" and the C4 model (c4model.com).
- [Robert C. Martin, "Screaming Architecture"](https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html) (2011) — the top level should show the use cases, not the framework (MOD-9).
- [Martin Fowler, "PresentationDomainDataLayering"](https://martinfowler.com/bliki/PresentationDomainDataLayering.html) (2015) — for a larger system, split the top level into domain-oriented modules, each layered inside (MOD-9).

## Related

- `../design/clean-architecture.md` — the layer rules.
- `../quality/maintainability.md` — Q-MAINT-1, Q-MAINT-2.
- `../review/fitness-functions.md` — automated boundary checks.
- `../design/contract-design.md` — when boundaries become service contracts.
- `../design/import-paths.md` — how module references are written and checked (IMP-n).
- `knowledge/software-design/architecture-styles/clean-architecture-deep-dive.md` §8, §15 G2 — the packaging options MOD-9 chooses between.
