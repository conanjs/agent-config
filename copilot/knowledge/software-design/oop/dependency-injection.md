---
schema: knowledge-doc/v1
type: concept
topic: software-design/oop
status: verified
applies-to: ["any"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [oop, dependency-injection, composition-root, ports]
---

# Dependency injection for application services

## Summary
**TL;DR:** Dependency injection gives an object its collaborators from the outside instead of letting it construct or locate them itself. Constructor injection makes a use case's ports visible at creation time, while a composition root wires concrete adapters near the application's entry point.
**Use this when:** implementing application services, repositories, gateways, clocks, or other dependencies that vary by environment.
**Not this doc:** domain-layer isolation and hexagonal architecture → `software-design/ddd/layering.md`.

## Problem
If a use case constructs its own database adapter, the use case depends on a concrete storage choice and cannot be reused with another implementation without editing the use case. ✅[^1]

If a use case resolves dependencies from a service locator, its public constructor hides what must be registered before the object can run. ✅[^3]

## Mental model
**Analogy:** a theater actor receives props before the scene starts; the actor does not run backstage during a line to find the right prop.
**Artifact:**
```ts
interface RoleRepository {
  findById(id: string): Promise<Role | undefined>;
  save(role: Role): Promise<void>;
}

class GrantPermissionToRole {
  constructor(private readonly roles: RoleRepository) {}
}
```
The interface is the prop contract, and the constructor is the handoff before the scene.

## How it works
Dependency injection separates an object that uses a plugin from the assembler that chooses the plugin implementation. ✅[^1]

Constructor injection makes required collaborators explicit in the constructor signature, so creating the object requires supplying them. ✅[^3]

A composition root is a preferably unique place where modules are composed together. ✅[^2]

The composition root should be as close as possible to the application's entry point. ✅[^2]

Only the composition root should reference a DI container when one is used; other modules should rely on injection instead of the container. ✅[^2]

Consumer-owned ports mean the application service defines the interface it needs, such as `RoleRepository`, and infrastructure adapters implement that interface. ✅[^1]

Service locator hides dependencies and can move missing registrations from compile time or construction time to runtime failures. ✅[^3]

## Worked example
The HTTP adapter parses `{ roleId: "admin", permission: "shipment:approve" }` and calls a `GrantPermissionToRole` application service. The composition root built that service with a SQL `RoleRepository` in production and an in-memory repository in unit tests. The use case can grant, reject, and save without knowing which adapter was selected.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Optional dependency | Prefer a default implementation at composition time | The use case still sees one explicit collaborator shape. ✅[^2] |
| Framework-created controller | Put framework lookup in the adapter layer | Framework wiring belongs near the composition root, not inside domain code. ✅[^2] |
| Passing repositories as method parameters | Avoid for class-modeled use cases | Repeated call-time dependencies obscure the service's stable required collaborators. ✅[^1] |
| Injecting a locator | Still a service locator | The consumer still asks for dependencies indirectly rather than declaring each dependency. ✅[^3] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Constructor injection | Explicit dependencies, simple tests | Constructors grow when a class does too much |
| DI container at composition root | Centralized object graph wiring | Container configuration can become opaque |
| Service locator | Easy late lookup | Hidden requirements and runtime surprises |

## Takeaways
- Define ports where they are consumed, not where an adapter happens to live. [rule-candidate]
- Wire object graphs at the composition root and keep containers out of domain and application classes. [rule-candidate]
- Treat service locator as hidden dependency lookup, not dependency injection. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| paradigm rule | PDM-class-modeled-R3 | Source: |

## Verification status
- Verified: 13 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [Inversion of Control Containers and the Dependency Injection pattern](https://martinfowler.com/articles/injection.html) — Martin Fowler, 2004. Backs: Problem, How it works, Edge cases. [^1]
- [Composition Root](https://blog.ploeh.dk/2011/07/28/CompositionRoot/) — Mark Seemann, 2011. Backs: How it works, Edge cases. [^2]
- [Service Locator is an Anti-Pattern](https://blog.ploeh.dk/2010/02/03/ServiceLocatorisanAnti-Pattern/) — Mark Seemann, 2010. Backs: Problem, How it works, Edge cases. [^3]
- `copilot/frameworks/agentic-sdlc/paradigms/class-modeled.md` — cites this doc as PDM-class-modeled-R3.
- `copilot/frameworks/agentic-sdlc/stacks/typescript-node/paradigms/class-modeled.md` — maps this rule to constructor-injected TypeScript application classes.

## Related
- `software-design/oop/composition-over-inheritance.md`
- `software-design/oop/polymorphism.md`
- `software-design/ddd/layering.md`
- `software-design/oop/encapsulation.md`
- `software-design/ddd/aggregates.md`