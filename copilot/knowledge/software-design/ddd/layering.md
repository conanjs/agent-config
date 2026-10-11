---
schema: knowledge-doc/v1
type: concept
topic: software-design/ddd
status: verified
applies-to: ["any"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [ddd, layering, hexagonal-architecture, ports-and-adapters]
---

# Domain layering and ports

## Summary
**TL;DR:** Layering keeps business decisions in the domain and puts I/O at the edges. Hexagonal architecture says the application should communicate with outside technologies through ports and adapters, so the inside stays independent of UI, databases, and remote services.
**Use this when:** reviewing domain imports, deciding where repositories live, or keeping `Role.grant` free of database and HTTP calls.
**Not this doc:** constructor injection mechanics → `software-design/oop/dependency-injection.md`.

## Problem
When business logic leaks into UI code or database code, automated tests become harder and the application becomes tied to volatile external details. Cockburn identifies the same design error on both sides: entanglement between business logic and interaction with external entities. ✅[^1]

## Mental model
**Analogy:** a restaurant kitchen decides how to cook; waiters, phone orders, and delivery apps translate requests into the kitchen's language.
**Artifact:**
```ts
// domain
class Role { grant(permission: Permission): Result<Role, GrantError> { /* no I/O */ } }

// application port
interface RoleRepository { save(role: Role): Promise<void>; }

// infrastructure adapter
class SqlRoleRepository implements RoleRepository { /* SQL lives here */ }
```
The domain is the kitchen, the repository interface is a port, and SQL is an adapter.

## How it works
Layered DDD commonly separates user interface, application, domain, and infrastructure responsibilities so business rules stay in the domain layer. ✅[^5]

An application service coordinates work but should stay thin and delegate business decisions to domain objects. ✅[^5]

The domain layer is responsible for business concepts, business state, and business rules. ✅[^5]

Data Mapper keeps in-memory objects independent from database structure and SQL details. ✅[^4]

Repository mediates between domain and data mapping layers using a collection-like interface. ✅[^3]

Hexagonal architecture lets an application be driven by users, programs, tests, or batch scripts and be tested apart from eventual UI and database devices. ✅[^1]

In ports-and-adapters, adapters convert outside technology details into calls or messages the application understands. ✅[^1]

The application should not know the nature of devices or systems on the other side of adapters. ✅[^1]

Dependency direction should point inward: domain code defines or consumes abstractions, while infrastructure implements adapters outside the domain. ✅[^1]

## Worked example
`POST /roles/admin/permissions` receives `shipment:approve`. The controller converts HTTP into a call to `GrantPermissionToRole`. The application service loads a role through `RoleRepository`, calls `role.grant(permission)`, and saves the result. `Role` never imports HTTP, SQL, or a logger; it only returns a domain result that the outer adapter maps to a response.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Domain calls `fetch` or SQL | Move the call to an adapter or application service | The application core should be ignorant of external devices. ✅[^1] |
| Repository interface in infrastructure | Move the port to the consuming application/domain side | The domain should not depend outward on storage details. ✅[^3] |
| Validation at HTTP boundary | Keep syntax checks at the adapter | Domain rules and transport parsing are separate responsibilities. ✅[^1] |
| Transaction management | Put it in application/infrastructure orchestration | Domain objects decide rules; outer layers coordinate resources. ✅[^5] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Strict domain isolation | Fast unit tests and clear business rules | More mapping at boundaries |
| Direct active-record style | Fewer files for simple CRUD | Domain decisions couple to persistence |
| Ports and adapters | Swappable technologies and test adapters | Requires clear port names and composition |

## Takeaways
- Keep domain models free of direct I/O and framework imports. [rule-candidate]
- Let application services orchestrate transactions and ports while domain objects make decisions. [rule-candidate]
- Put adapters outside the core and make dependency direction point inward. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| paradigm rule | PDM-class-modeled-R4 | Source: |

## Verification status
- Verified: 14 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture) — Alistair Cockburn, 2005. Backs: Problem, How it works, Edge cases. [^1]
- [Inversion of Control Containers and the Dependency Injection pattern](https://martinfowler.com/articles/injection.html) — Martin Fowler, 2004. Backs: dependency separation at composition boundaries. [^2]
- [Repository](https://martinfowler.com/eaaCatalog/repository.html) — Martin Fowler, 2002. Backs: How it works, Edge cases. [^3]
- [Data Mapper](https://www.martinfowler.com/eaaCatalog/dataMapper.html) — Martin Fowler, 2002. Backs: How it works. [^4]
- [AnemicDomainModel](https://martinfowler.com/bliki/AnemicDomainModel.html) — Martin Fowler, 2003. Backs: layered domain/application responsibilities. [^5]
- `copilot/frameworks/agentic-sdlc/paradigms/class-modeled.md` — cites this doc as PDM-class-modeled-R4.
- `copilot/frameworks/agentic-sdlc/foundations/design/domain-driven-design.md` — aligns DDD layering with domain isolation.
- Eric Evans, *Domain-Driven Design* (2003) — further reading on layered architecture.

## Related
- `software-design/oop/dependency-injection.md`
- `software-design/ddd/aggregates.md`
- `software-design/ddd/building-blocks.md`
