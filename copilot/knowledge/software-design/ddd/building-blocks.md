---
schema: knowledge-doc/v1
type: concept
topic: software-design/ddd
status: verified
applies-to: ["any"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [ddd, entities, value-objects, repositories, factories]
---

# DDD tactical building blocks

## Summary
**TL;DR:** DDD tactical building blocks give different jobs to different model shapes: entities keep identity, value objects describe values, services name domain actions that do not fit one object, repositories retrieve aggregates, and factories create valid objects. Use the smallest block that owns the rule.
**Use this when:** choosing where to place RBAC concepts such as `Role`, `Permission`, `GrantPolicy`, and `RoleRepository`.
**Not this doc:** aggregate transaction rules → `software-design/ddd/aggregates.md`.

## Problem
When every domain concept is modeled as the same kind of class, identity, equality, persistence, and behavior rules become mixed together. DDD separates these responsibilities so the model says which concepts have identity, which are pure values, and which objects cross the persistence boundary. ✅[^5]

## Mental model
**Analogy:** a workshop has labeled stations: a passport desk tracks who someone is, a measuring station checks values, a tool room stores and retrieves tools, and an assembly jig builds a valid product.
**Artifact:**
```ts
class RoleId { constructor(readonly value: string) {} }
class Permission { constructor(readonly key: string) {} }
class Role { constructor(readonly id: RoleId, private permissions: Permission[]) {} }
interface RoleRepository { findById(id: RoleId): Promise<Role | undefined>; }
```
`Role` is tracked by identity, `Permission` can be compared by value, and `RoleRepository` is a collection-like port for roles.

## How it works
A domain model represents meaningful domain objects and combines behavior with data. ✅[^1]

A value object is equal because of its property values rather than a separate identity. ✅[^2]

Value objects should usually be immutable to avoid aliasing bugs where one reference changes another caller's value unexpectedly. ✅[^2]

Reference objects or entities are compared by identity rather than by all current property values. ✅[^2]

An aggregate root is the only object outside code should reference inside an aggregate. ✅[^3]

A repository mediates between domain and data mapping layers through a collection-like interface for accessing domain objects. ✅[^4]

A repository supports one-way dependency between the domain and data mapping layers. ✅[^4]

A domain service is useful when a domain operation is meaningful but does not naturally belong to one entity or value object. ✅[^5]

A factory is useful when creating a valid object or aggregate is complex enough that construction logic would distract from the caller's intent. ✅[^5]

| Block | Identity | Main job | RBAC example | Common mistake |
|---|---|---|---|---|
| Entity | Stable identity | Own lifecycle and behavior | `Role` | Comparing only by current fields |
| Value object | Value equality | Name and validate a concept | `PermissionKey` | Making it mutable |
| Domain service | No lifecycle identity | Express a domain operation across concepts | `GrantPolicy` | Turning every rule into a service |
| Repository | Aggregate-root identity | Load and save aggregate roots | `RoleRepository` | Exposing database queries as domain logic |
| Factory | Product identity varies | Create valid objects or aggregates | `RoleFactory` | Hiding business decisions in constructors |

## Worked example
An RBAC module receives a request to create role `admin` with permissions `shipment:read` and `shipment:approve`. `RoleId` and `PermissionKey` validate identifiers as value objects. `RoleFactory` creates a valid `Role` entity. `RoleRepository` saves and later retrieves the role by id. A `GrantPolicy` domain service is only needed if the grant rule depends on multiple objects that no single aggregate owns.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Same word in another context | Model it separately | DDD uses bounded contexts to keep models internally consistent. ✅[^5] |
| Persistence id on a value object | Reconsider whether it is an entity | Identity-based equality changes the modeling choice. ✅[^2] |
| Repository per table | Prefer repository per aggregate root | The domain wants aggregate access, not table access. ✅[^3] |
| Service with all business rules | Move behavior back to owning entities or aggregates | A rich domain model combines behavior and data. ✅[^1] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Rich entities and value objects | Clear ownership of rules | More modeling work than CRUD records |
| Domain services for cross-object rules | Names policies that have no natural owner | Easy to overuse and create anemic entities |
| Repositories as ports | Domain stays storage-agnostic | Queries must be shaped carefully around aggregates |

## Takeaways
- Choose entity vs value object by identity and equality, not by table shape. [rule-candidate]
- Add a domain service only when no entity or value object owns the behavior. [rule-candidate]
- Keep repositories collection-like and focused on aggregate roots. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 14 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [Domain Model](https://martinfowler.com/eaaCatalog/domainModel.html) — Martin Fowler, 2002. Backs: How it works, Edge cases. [^1]
- [Value Object](https://martinfowler.com/bliki/ValueObject.html) — Martin Fowler, 2016. Backs: How it works, Edge cases. [^2]
- [DDD_Aggregate](https://martinfowler.com/bliki/DDD_Aggregate.html) — Martin Fowler, 2013. Backs: How it works, Edge cases. [^3]
- [Repository](https://martinfowler.com/eaaCatalog/repository.html) — Martin Fowler, 2002. Backs: How it works. [^4]
- [DDD Reference PDF](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf) — Eric Evans / Domain Language, 2015. Backs: Problem, domain-service and factory classification. [^5]
- Eric Evans, *Domain-Driven Design* (2003) — further reading; the free DDD Reference above is the verified primary source used here.
- Vaughn Vernon, *Implementing Domain-Driven Design* (2013) — further reading on tactical modeling.

## Related
- `software-design/ddd/aggregates.md`
- `software-design/oop/encapsulation.md`
- `software-design/ddd/bounded-contexts.md`
