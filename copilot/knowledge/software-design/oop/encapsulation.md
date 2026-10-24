---
schema: knowledge-doc/v1
type: concept
topic: software-design/oop
status: verified
applies-to: ["any"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [oop, encapsulation, domain-model]
---

# Encapsulation in behavior-owning models

## Summary
**TL;DR:** Encapsulation means the model owns both the state and the operations that keep that state valid. Callers tell a `Role` to `grant(permission)` instead of reading and editing its permission list.
**Use this when:** writing class-modeled domain objects, reviewing public fields, or deciding where a business rule belongs.
**Not this doc:** aggregate transaction boundaries → `software-design/ddd/aggregates.md`.

## Problem
Public mutable state lets callers change data without running the rule that protects it. In a domain model, moving behavior out of domain objects and into procedural services creates objects that look like the domain but act like bags of getters and setters. ✅[^2]

## Mental model
**Analogy:** a bank vault has a teller window; customers request a withdrawal, but they do not walk behind the counter and move cash between drawers.
**Artifact:**
```ts
class Role {
  #permissions = new Set<string>();

  grant(permission: string): "granted" | "already_granted" {
    if (this.#permissions.has(permission)) return "already_granted";
    this.#permissions.add(permission);
    return "granted";
  }
}
```
The private set is the vault, and `grant` is the teller window that enforces the duplicate-permission rule.

## How it works
Tell-don't-ask encourages callers to ask an object to perform behavior instead of asking for raw data and making the decision elsewhere. ✅[^1]

Objects are useful because data and the behavior that uses it often change together, so placing them in the same component reduces scattered edits. ✅[^1]

A domain model is strongest when domain objects contain both behavior and data, especially where rules and cases are complex. ✅[^3]

An anemic domain model has domain-shaped objects but little behavior, with service objects doing most business calculation and mutation. ✅[^2]

Intention-revealing operations name the business action, such as `grant`, `revoke`, or `rename`, so the method boundary can validate input and preserve the invariant in one place. ✅[^1]

Query methods are not forbidden; Fowler warns that tell-don't-ask can be overused when a simple information-providing query would make collaboration clearer. ✅[^1]

## Worked example
`Role("admin")` starts with `["shipment:read"]`. A caller invokes `role.grant("shipment:write")`, the role checks whether that permission already exists, and the role alone changes its private set. The same caller invokes `role.grant("shipment:write")` again and receives `already_granted` without mutating state.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Read-only snapshot | Return a copied array or immutable view | The caller can observe state without bypassing operations. ✅[^1] |
| DTO at an API boundary | Use a data-only shape outside the domain layer | Transfer objects are boundary data, not the behavior-owning model. ✅[^2] |
| Pure calculation | A helper can be acceptable when no object owns identity or state | Encapsulation protects owned state; stateless transforms may not need a class. ✅[^3] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Private state plus operations | Rules stay near the state they protect | More methods must be named and tested |
| Public data plus external services | Simple serialization and quick CRUD | Rules scatter and model behavior becomes procedural |

## Takeaways
- Keep mutable model state private and expose business verbs, not collection editing. [rule-candidate]
- Put a rule on the type that owns the data needed to check it. [rule-candidate]
- Use queries to reveal facts, not to make callers reconstruct the object's decision. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| paradigm rule | PDM-class-modeled-R1 | Source: |

## Verification status
- Verified: 10 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [TellDontAsk](https://martinfowler.com/bliki/TellDontAsk.html) — Martin Fowler, 2013. Backs: Problem, How it works, Edge cases. [^1]
- [AnemicDomainModel](https://martinfowler.com/bliki/AnemicDomainModel.html) — Martin Fowler, 2003. Backs: Problem, How it works, Edge cases. [^2]
- [Domain Model](https://martinfowler.com/eaaCatalog/domainModel.html) — Martin Fowler, 2002. Backs: How it works, Edge cases. [^3]
- `copilot/frameworks/agentic-sdlc/paradigms/class-modeled.md` — cites this doc as PDM-class-modeled-R1.
- `copilot/frameworks/agentic-sdlc/stacks/typescript-node/paradigms/class-modeled.md` — shows the TypeScript private-state shape this doc backs.
- Eric Evans, *Domain-Driven Design* (2003) — further reading on behavior-rich domain models.

## Related
- `software-design/oop/core-concepts.md`
- `software-design/oop/law-of-demeter.md`
- `software-design/oop/polymorphism.md`
- `software-design/ddd/aggregates.md`
- `software-design/ddd/building-blocks.md`
- `software-design/oop/design-by-contract.md`