---
schema: knowledge-doc/v1
type: concept
topic: software-design/ddd
status: verified
applies-to: ["any"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [ddd, aggregates, invariants, testing]
---

# Aggregates as consistency boundaries

## Summary
**TL;DR:** An aggregate is a cluster of domain objects treated as one unit, with one root that protects the whole cluster. Put invariants that must be immediately consistent inside one aggregate; coordinate separate aggregates with ids, transactions, and eventual consistency.
**Use this when:** deciding where `Role.grant`, duplicate-permission checks, transactions, and behavior tests belong.
**Not this doc:** basic entity and value-object selection → `software-design/ddd/building-blocks.md`.

## Problem
Large object graphs invite callers to reach into internals, update several objects in one transaction, and duplicate invariant checks across use cases. Vernon describes aggregate modeling as difficult partly because developers often create large object clusters that hurt performance and scalability. ✅[^2]

## Mental model
**Analogy:** a castle has one gatekeeper; outsiders talk to the gatekeeper, and the gatekeeper coordinates everyone inside the walls.
**Artifact:**
```ts
class Role {
  #permissions: ReadonlySet<string>;

  grant(permission: string): Result<Role, "already_granted"> {
    if (this.#permissions.has(permission)) return { ok: false, error: "already_granted" };
    return { ok: true, value: new Role(this.id, [...this.#permissions, permission]) };
  }
}
```
The `Role` aggregate root is the gatekeeper for its permission set.

## How it works
An aggregate is a cluster of domain objects that can be treated as a single unit. ✅[^1]

One component object is the aggregate root. ✅[^1]

References from outside the aggregate should go only to the aggregate root. ✅[^1]

The aggregate root can ensure the integrity of the aggregate as a whole. ✅[^1]

Aggregates are the basic unit loaded from and saved to storage. ✅[^1]

Transactions should not cross aggregate boundaries. ✅[^1]

Vernon's Effective Aggregate Design series focuses on finding real consistency constraints instead of navigating object graphs. ✅[^2]

Vernon's free aggregate papers are the primary source for rules of thumb such as small aggregates, identity references to other aggregates, and eventual consistency across aggregate boundaries. ✅[^3]

Tests should exercise aggregate behavior through root operations because outside callers are supposed to interact through the root. ✅[^1]

## Worked example
`Role(admin)` owns permissions `{shipment:read}`. A use case loads the `Role` aggregate, calls `role.grant("shipment:approve")`, and saves that one aggregate. If assigning the role to a user must update a separate `User` aggregate, the role update commits first and publishes a domain event; the user-side reaction happens separately so one transaction does not span both roots.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Caller mutates a child collection | Block it with private state and root methods | Outside references should target the root only. ✅[^1] |
| Rule needs atomic consistency across two roots | Reconsider the boundary or record a rare exception | Transactions should not cross aggregate boundaries. ✅[^1] |
| Need to show related aggregate data | Reference by id and query a read model | Object references encourage accidental cross-boundary mutation. ✅[^3] |
| Large aggregate with many unrelated rules | Split around true invariants | Large clusters can hurt performance and scalability. ✅[^2] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Small aggregate | Less contention, clearer invariants | Cross-aggregate workflows need events or process managers |
| Large aggregate | Immediate consistency across more data | Bigger transactions and harder tests |
| Reference by id | Clear boundary and persistence independence | More explicit loading in application services |

## Takeaways
- Put an invariant on the aggregate root that owns the state needed to enforce it. [rule-candidate]
- Keep aggregates small by modeling true consistency boundaries, not screen shapes. [rule-candidate]
- Test valid and invalid behavior through root operations instead of mutating internals. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| paradigm rule | PDM-class-modeled-R2 | Source: |
| paradigm rule | PDM-class-modeled-R6 | Source: |

## Verification status
- Verified: 14 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [DDD_Aggregate](https://martinfowler.com/bliki/DDD_Aggregate.html) — Martin Fowler, 2013. Backs: Problem, How it works, Edge cases. [^1]
- [Effective Aggregate Design](https://www.dddcommunity.org/library/vernon_2011/) — Vaughn Vernon / DDD Community, 2011. Backs: Problem, How it works, Edge cases. [^2]
- [Effective Aggregate Design, Part I](https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_1.pdf), [Part II](https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_2.pdf), [Part III](https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_3.pdf) — Vaughn Vernon, 2011. Backs: identity references, small aggregates, eventual consistency. [^3]
- [DDD Reference](https://www.domainlanguage.com/ddd/reference/) — Eric Evans / Domain Language, 2015. Backs: DDD pattern classification. [^4]
- `copilot/frameworks/agentic-sdlc/paradigms/class-modeled.md` — cites this doc as PDM-class-modeled-R2 and PDM-class-modeled-R6.
- Vaughn Vernon, *Implementing Domain-Driven Design* (2013) — further reading; the free Effective Aggregate Design materials above are used for verified claims.
- Eric Evans, *Domain-Driven Design* (2003) — further reading; the free DDD Reference above is used for verified claims.

## Related
- `software-design/ddd/building-blocks.md`
- `software-design/oop/encapsulation.md`
- `software-design/oop/design-by-contract.md`
