---
schema: paradigm/v1
last-updated: 2026-10-04
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

## State

State is owned by the type that protects it. Changes happen only through intention-named operations that check preconditions, preserve invariants, and expose observable results.

## Composition

Compose behavior by giving collaborators narrow roles and by using policy objects when behavior varies. Prefer telling the owning model what to do over spreading conditional business rules through callers.

## Effects

Domain types do not perform I/O. Application services orchestrate work and receive ports from the outside. The core remains focused on business decisions; adapters perform external communication.

## Errors shape

Expected rule failures are explicit results following the active stack's error idiom. Unexpected failures may cross boundaries through the stack's exceptional-error idiom, but business-rule failures are not hidden or silently ignored.

## Testing shape

Tests exercise public operations and assert observable outcomes. Invariant tests try invalid sequences, not just invalid initial data. Tests do not depend on internal fields.

## Rules

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| PDM-class-modeled-R1 | Keep model state private and change it only through intention-named operations | Callers cannot mutate entity or aggregate state directly | A caller appends to a permissions collection exposed by a role | lint | knowledge/software-design/oop/encapsulation.md |
| PDM-class-modeled-R2 | Put each invariant on the type that owns the state it protects | The same rule is checked once at the owning model boundary | Duplicate-permission checks appear in several use cases | llm | knowledge/software-design/ddd/aggregates.md |
| PDM-class-modeled-R3 | Orchestrate use cases through application-service types with injected ports | External dependencies arrive at construction or composition time | A use-case function accepts repositories as ordinary call parameters | lint | knowledge/software-design/oop/dependency-injection.md |
| PDM-class-modeled-R4 | Keep domain models free of direct I/O | Domain operations make decisions without calling external systems | An entity writes to a database or calls a remote service | lint | knowledge/software-design/ddd/layering.md |
| PDM-class-modeled-R5 | Return expected business-rule failures explicitly | Callers must handle known rule failures in the normal result shape | A duplicate grant throws an untyped exception or is ignored | llm | knowledge/software-design/oop/design-by-contract.md |
| PDM-class-modeled-R6 | Test behavior through public operations | Tests prove invariants through valid and invalid operation sequences | A test mutates private state or asserts storage layout | llm | knowledge/software-design/ddd/aggregates.md |

## Escape hatches

| When | Allowed deviation | Must record |
|---|---|---|
| A calculation has no identity, state, or dependencies | Put it in a pure helper near the owning model | One-line comment or decision note naming this hatch |
| A framework requires a data-only transfer shape at a boundary | Use a boundary DTO and map into the model immediately | Boundary location and mapper in the task or decision record |
| A legacy component already has a consistent different paradigm | Keep it under PDM-Q1 and avoid a rewrite | `PDM-<component>` decision record with retrofit rationale |

## Changelog

| Version | Change | Breaking? |
|---|---|---|
| 1.0.0 | Initial class-modeled paradigm for v2 migration | No |

## References

**Local artifacts:**
- `schemas/paradigm.schema.md` — required paradigm profile structure.
- `trees/paradigm-selection.tree.md` — selects this paradigm at PDM-Q2.
- `stacks/typescript-node/paradigms/class-modeled.md` — first concrete stack overlay and enforcement mapping.

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
