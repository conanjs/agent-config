---
schema: knowledge-doc/v1
type: concept
topic: software-design/oop
status: verified
applies-to: ["any"]
last-verified: 2026-10-29
last-updated: 2026-10-29
tags: [oop, dependency-injection, composition-root, ports, modular-monolith]
---

# Dependency injection for application services

## Summary
**TL;DR:** Dependency injection gives an object its collaborators from the outside instead of letting it construct or locate them itself. Constructor injection makes a use case's ports visible at creation time, while a composition root wires concrete adapters near the application's entry point.
**Use this when:** implementing application services, repositories, gateways, clocks, or other dependencies that vary by environment; or choosing how a modular monolith splits its wiring between the composition root and the modules.
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

**Wiring a modular monolith: three shapes.** Each application or process needs only one composition root, however complex it is. ✅[^2] That still leaves a choice of how much wiring each module does for itself:

| Shape | Who builds the use cases | Who picks the adapters | Seen in |
|---|---|---|---|
| W1. One composition root builds everything | The root | The root | Seemann's basic form ✅[^2]; the stack reference since v4.1 (one private method per module) |
| W2. One root, one composer per module | A per-module composer, given its adapters and the other modules' public objects | The root | ASP.NET Core's convention: one `Add{GROUP NAME}` extension method registers all services of a feature ✅[^4]; NestJS modules, which keep their providers private unless exported ✅[^5] |
| W3. One composition root per module | The module | The module (its own container, config and store) | Grzybek's modular monolith: "Each Module has its own Composition Root" and its own IoC container, for encapsulation and isolation ✅[^6] |

W2 does not break "one composition root": the root still chooses every adapter and creates every shared instance; a composer only groups one module's `new` calls, as an `Add{GROUP NAME}` method groups registrations. W3 is a different decision: each module owns its infrastructure, which pays off when modules may become separate services. *(Classification ours, from the cited sources.)*

A module composer cannot live in the module's interface layer when it must name adapters: interface code may not import infrastructure. It sits at the module root, outside the layers, and only the composition root imports it. *(Analysis, ours; in the stack reference the layer zones block `interface → infrastructure`, read from `eslint.config.mjs` on 2026-10-29.)*

## Worked example
The HTTP adapter parses `{ roleId: "admin", permission: "shipment:approve" }` and calls a `GrantPermissionToRole` application service. The composition root built that service with a SQL `RoleRepository` in production and an in-memory repository in unit tests. The use case can grant, reject, and save without knowing which adapter was selected.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Optional dependency | Prefer a default implementation at composition time | The use case still sees one explicit collaborator shape. ✅[^2] |
| Framework-created controller | Put framework lookup in the adapter layer | Framework wiring belongs near the composition root, not inside domain code. ✅[^2] |
| Passing repositories as method parameters | Avoid for class-modeled use cases | Repeated call-time dependencies obscure the service's stable required collaborators. ✅[^1] |
| Injecting a locator | Still a service locator | The consumer still asks for dependencies indirectly rather than declaring each dependency. ✅[^3] |
| W2 composer that creates its own store | It became W3 by accident: tests and the root can no longer swap the adapter | Give composers adapters; let only the root call `new` on adapters *(analysis, ours)* |
| Two modules need the same store or id source | W1 and W2 share one instance created by the root; W3 cannot share without a module exposing it | Shared instances belong to the one place that sees every module ✅[^2] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Constructor injection | Explicit dependencies, simple tests | Constructors grow when a class does too much |
| DI container at composition root | Centralized object graph wiring | Container configuration can become opaque |
| Service locator | Easy late lookup | Hidden requirements and runtime surprises |
| W1 one root builds everything | One file shows the whole graph; no new file kind; nothing to lint | The root grows by one block per module; adding a use case edits the root |
| W2 root plus module composers | A module's wiring sits with the module; adding a use case edits only that module; the root reads as a module list | One more file per module and a lint zone for it; cross-module objects become explicit fields |
| W3 composition root per module | Strongest isolation; a module can be extracted with its wiring ✅[^6] | Several graphs and configs; shared instances need explicit passing; overkill when all modules share one store |

## Takeaways
- Define ports where they are consumed, not where an adapter happens to live. [rule-candidate]
- Wire object graphs at the composition root and keep containers out of domain and application classes. [rule-candidate]
- Treat service locator as hidden dependency lookup, not dependency injection. [rule-candidate]
- In a modular monolith, keep adapter choice in the one composition root; move a module's use-case wiring into a module-root composer once the root becomes a list of per-module blocks, and give each module its own composition root only when modules own separate infrastructure. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| paradigm rule | PDM-class-modeled-R3 | Source: |
| paradigm rule | PDM-class-modeled-R9 | Source: |

## Verification status
- Verified: 20 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-29

## References
- [Inversion of Control Containers and the Dependency Injection pattern](https://martinfowler.com/articles/injection.html) — Martin Fowler, 2004. Backs: Problem, How it works, Edge cases. [^1]
- [Composition Root](https://blog.ploeh.dk/2011/07/28/CompositionRoot/) — Mark Seemann, 2011. Backs: How it works (including one composition root per application, from the author's replies in the comments), Edge cases. [^2]
- [Service Locator is an Anti-Pattern](https://blog.ploeh.dk/2010/02/03/ServiceLocatorisanAnti-Pattern/) — Mark Seemann, 2010. Backs: Problem, How it works, Edge cases. [^3]
- [Dependency injection in ASP.NET Core: Register groups of services with extension methods](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/dependency-injection#register-groups-of-services-with-extension-methods) — Microsoft, living (read 2026-10-29). Backs: How it works (W2, the `Add{GROUP NAME}` convention). [^4]
- [NestJS: Modules](https://docs.nestjs.com/modules) — NestJS project, living. Backs: How it works (W2, providers encapsulated by default, `exports`). [^5]
- [Modular Monolith with DDD](https://github.com/kgrzybek/modular-monolith-with-ddd) — Kamil Grzybek, living. Backs: How it works and Trade-offs (W3, §3.1 assumption 7 "Each Module has its own Composition Root"). [^6]
- `conanjs/agentic-sdlc-reference-typescript-node` v4.1 branch — `src/CompositionRoot.ts` (W1 with one private method per module) and `eslint.config.mjs` (layer zones).
- `copilot/frameworks/agentic-sdlc/paradigms/class-modeled.md` — cites this doc as PDM-class-modeled-R3.
- `copilot/frameworks/agentic-sdlc/stacks/typescript-node/paradigms/class-modeled.md` — maps this rule to constructor-injected TypeScript application classes.

## Related
- `software-design/oop/composition-over-inheritance.md`
- `software-design/oop/polymorphism.md`
- `software-design/ddd/layering.md`
- `software-design/oop/encapsulation.md`
- `software-design/ddd/aggregates.md`
- `software-design/architecture-styles/use-case-folders.md` — the placement rule; a module router as a wiring file.
- `software-design/architecture-styles/clean-architecture-deep-dive.md` — Main as the configurator.