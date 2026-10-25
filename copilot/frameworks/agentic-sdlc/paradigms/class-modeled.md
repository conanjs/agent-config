---
schema: paradigm/v1
last-updated: 2026-10-25
id: class-modeled
version: 1
supports: [typescript-node]
compatible-with: [functional-pipeline]
---

# Paradigm: Class-modeled (`class-modeled@1`)

## Core idea

Model each important domain concept as a behavior-owning type: callers ask the concept to do meaningful work, and the concept protects its own rules. Analogy: a locked safe controls how its contents change; visitors do not reach inside and rearrange the valuables directly.

## Use when

Use this when the component owns long-lived identity, lifecycle state, or invariants that must hold across several operations. It fits domains where the same concept is created, changed, validated, and later revisited under business rules.

## Avoid when

Avoid this as the default for one-shot transforms, reports, import/export jobs, or pass-through components with little domain behavior. Those usually stay simpler when the transformation is explicit and the shell owns the side effects.

## Modeling

Represent entities and aggregates as behavior-owning types. Represent small validated concepts as immutable value objects. Outside code names the operation it wants; it does not inspect raw state and decide the invariant itself.

### Tiers

This paradigm is a default, not a mandate. Three tiers say where behavior-owning types are required and where plain functions are fine.

| Tier | Which units | Form | Hatch note |
|---|---|---|---|
| A | Domain entities, value objects, aggregates; application services and use cases; adapters and stores; middleware and guards; every unit that plays a named role from the suffix glossary in `../foundations/code/naming.md` (Presenter, Policy, Factory, Handler …), whether or not it holds state | Behavior-owning type (R7) | None needed |
| B | Process entry point (thin: builds the composition root and calls run); a small pure helper that plays no named role and serves one owning type; route-table and config declarations; framework-required factory functions | Plain function or declaration, in the form the stack overlay sets | One-line why-comment naming the hatch (R8) |
| C | Any single component that needs a different paradigm | Per component | `PDM-<component>` decision record (R11) |

**The A/B boundary.** A unit that has a role name is Tier A, even when it is stateless. A presenter maps an internal entity to the public response shape so that fields such as a password hash cannot leak. It is a class because readers look for it under its role, and the composition root can swap it. Tier B is only for small, nameless helpers, the kind Evans means when he says some operations are "not a natural responsibility of an entity or value object" (`knowledge/software-design/ddd/building-blocks.md`). The paradigm decides *whether* a unit is a type. The stack overlay decides the *form* a Tier B helper takes (module function, static class), because that depends on the language.

### Why classes

- Substitution and extension: a caller depends on the port, and a new behavior arrives as a new type behind it, with no edit to the caller.
- Constructor injection: a type declares what it needs once, at construction. Inversion of control follows naturally, as in Clean Architecture, DDD and .NET-style hosts.
- Tests: tests depend on the port or the public operations and wire fakes in. They do not re-implement the production logic (R10).
- Findability: every role-named unit is a type with that role in its name and its file name (NAM-6, NAM-8). A reader finds a feature's presenter, policy or guard without searching through loose functions.

## State

State is owned by the type that protects it. Changes happen only through intention-named operations that check preconditions, preserve invariants, and expose observable results.

## Composition

Compose behavior by giving collaborators narrow roles and by using policy objects when behavior varies. Prefer telling the owning model what to do over spreading conditional business rules through callers.

### Inversion of control and composition root

One composition root wires concrete adapters to ports; nothing else creates collaborators. Types receive their ports at construction and never look them up or build them. The process entry point is Tier B and thin: it builds the composition root, calls run, and holds no business logic. Analogy: the composition root is the electrician who wires the building once; the appliances only plug into sockets. Background: `../knowledge/software-design/oop/dependency-injection.md`, `../knowledge/software-design/design-principles/dependency-inversion.md`, `../knowledge/software-design/ddd/layering.md`.

## Effects

Domain types do not perform I/O. Application services orchestrate work and receive ports from the outside. The core remains focused on business decisions; adapters perform external communication.

## Errors shape

Expected rule failures are explicit results following the active stack's error idiom. Unexpected failures may cross boundaries through the stack's exceptional-error idiom, but business-rule failures are not hidden or silently ignored.

## Testing shape

Tests exercise public operations and assert observable outcomes. Invariant tests try invalid sequences, not just invalid initial data. Tests do not depend on internal fields. Tests wire fakes through the port; they never copy production logic into the test to compute the expected result.

## Rules

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| PDM-class-modeled-R1 | Keep model state private and change it only through intention-named operations | Callers cannot mutate entity or aggregate state directly | A caller appends to a permissions collection exposed by a role | lint | knowledge/software-design/oop/encapsulation.md |
| PDM-class-modeled-R2 | Put each invariant on the type that owns the state it protects | The same rule is checked once at the owning model boundary | Duplicate-permission checks appear in several use cases | llm | knowledge/software-design/ddd/aggregates.md |
| PDM-class-modeled-R3 | Orchestrate use cases through application-service types with injected ports | External dependencies arrive at construction or composition time | A use-case function accepts repositories as ordinary call parameters | lint | knowledge/software-design/oop/dependency-injection.md |
| PDM-class-modeled-R4 | Keep domain models free of direct I/O | Domain operations make decisions without calling external systems | An entity writes to a database or calls a remote service | lint | knowledge/software-design/ddd/layering.md |
| PDM-class-modeled-R5 | Return expected business-rule failures explicitly | Callers must handle known rule failures in the normal result shape | A duplicate grant throws an untyped exception or is ignored | llm | knowledge/software-design/oop/design-by-contract.md |
| PDM-class-modeled-R6 | Test behavior through public operations | Tests prove invariants through valid and invalid operation sequences | A test mutates private state or asserts storage layout | llm | knowledge/software-design/ddd/aggregates.md |
| PDM-class-modeled-R7 | Tier A units are behavior-owning types; free functions live only in the Tier B allow-list owned by `docs/architecture.md` | Every top-level function is in an allow-listed file or is a Tier B unit | A use case written as a loose function in a service folder | lint | knowledge/software-design/ddd/layering.md |
| PDM-class-modeled-R8 | A Tier B function names its hatch in a one-line why-comment | A reader sees why this unit is not a type | A pure helper with no note on why it is a function | llm | — |
| PDM-class-modeled-R9 | Only the composition root creates concrete adapters; the entry point is thin | Application and domain code import ports only | A use case imports a database adapter and builds it | lint | knowledge/software-design/oop/dependency-injection.md |
| PDM-class-modeled-R10 | Tests never duplicate production logic; they wire fakes through the port | Expected values come from the spec, not from re-running the logic | A test recomputes the permission result with the same algorithm | llm | knowledge/software-design/design-principles/dependency-inversion.md |
| PDM-class-modeled-R11 | A deviation from this paradigm is recorded in a `PDM-<component>` decision record | Reviewers find a record naming the component, scope and rationale for each deviation | A component is written as plain functions with no record | llm | — |
## Escape hatches

| When | Allowed deviation | Must record |
|---|---|---|
| A calculation has no identity, state, or dependencies | Put it in a pure helper near the owning model (Tier B) | One-line why-comment naming this hatch (R8) |
| The process entry point, a route table, or a config declaration | Plain function or declaration (Tier B); keep it thin | One-line why-comment; file listed in the `docs/architecture.md` Tier B allow-list |
| A framework requires a factory function | Use the function and return a Tier A type or wrapper (Tier B) | One-line why-comment naming the framework requirement |
| A component fits another paradigm better (Tier C) | Use that paradigm for the component only | `PDM-<component>` decision record. A recorded override is authoritative: reviewers check its scope and rationale, not whether they would have chosen it. An unrecorded deviation is a finding |
| A framework requires a data-only transfer shape at a boundary | Use a boundary DTO and map into the model immediately | Boundary location and mapper in the task or decision record |
| A legacy component already has a consistent different paradigm | Keep it under PDM-Q1 and avoid a rewrite | `PDM-<component>` decision record with retrofit rationale |

## Changelog

| Version | Change | Breaking? |
|---|---|---|
| 1.0.0 | Initial class-modeled paradigm for v2 migration | No |
| 1.1.0 | Tiers A/B/C, why-classes, composition root, rules R7 to R11 | Breaking in substance (R7 to R11 tighten the rules), but not bumped: the framework is unpublished, so it stays `@1` (`../conventions.md`, Versioning) |

## References

**Local artifacts:**
- `schemas/paradigm.schema.md` — required paradigm profile structure.
- `trees/paradigm-selection.tree.md` — selects this paradigm at PDM-Q2.
- `stacks/typescript-node/paradigms/class-modeled.md` — first concrete stack overlay and enforcement mapping.
- `knowledge/software-design/oop/dependency-injection.md`, `knowledge/software-design/design-principles/dependency-inversion.md`, `knowledge/software-design/ddd/layering.md` — constructor injection, inversion, layering.

**External authoritative sources:**
- Eric Evans, *Domain-Driven Design: Tackling Complexity in the Heart of Software* (2003) — entities, value objects, aggregates, and layered architecture.
- Vaughn Vernon, *Implementing Domain-Driven Design* (2013) — aggregate modeling and application-service boundaries.
- Bertrand Meyer, *Object-Oriented Software Construction*, 2nd ed. (1997) — design by contract and invariant framing.
- [Martin Fowler, “AnemicDomainModel”](https://martinfowler.com/bliki/AnemicDomainModel.html) — why behavior separated from domain data weakens the model.
- [Martin Fowler, “TellDontAsk”](https://martinfowler.com/bliki/TellDontAsk.html) — behavior should live with the data it uses.
- [Martin Fowler, “DDD_Aggregate”](https://martinfowler.com/bliki/DDD_Aggregate.html) — aggregate boundaries and invariant ownership.

## Related

- `functional-pipeline.md` — contrasting paradigm for input-to-output transformations.
- `../trees/paradigm-selection.tree.md` — decision tree that chooses between paradigms.
- `../foundations/code/naming.md` — presenter and other role names.
- `../foundations/design/module-boundaries.md` — layer rules the composition root respects.
