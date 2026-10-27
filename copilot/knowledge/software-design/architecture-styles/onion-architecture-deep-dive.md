---
schema: deep-dive/v1
topic: software-design/architecture-styles
status: verified
applies-to: ["any"]
last-updated: 2026-10-27
last-verified: 2026-10-25
synthesized-into: []
tags: [onion, palermo, domain-model, repository-interface, dependency-inversion, layering]
---

# Onion Architecture, end to end

## Summary
**TL;DR:** Jeffrey Palermo named the Onion Architecture in 2008 as a fix for traditional layering, where business logic sits on top of data access and depends on it. The onion puts the **domain model at the centre**. Inner layers define interfaces, outer layers implement them, and all coupling points toward the centre. The database, UI and tests live on the outside edge.
**Use this when:** explaining why "UI → business → data" layering ages badly, deciding where a repository interface lives, or comparing onion with hexagonal and clean.
**Depth:** the problem with traditional layers, with the transitive-dependency argument; the four tenets; the layers; Palermo's own code example step by step; what changed after four years; scope; edge cases; mapping; self-check.

## 1. The problem: traditional layering

In the traditional stack, "each layer is coupled to the layers below it", and usually to shared infrastructure too ✅[^1]. Because "transitive dependencies are still dependencies", the UI ends up coupled to data access: "Yes, UI is coupled to data access with this approach" ✅[^1].

Why that hurts: "Historically, the industry has modified data access techniques at least every three years", so "we can count on needing to modify data access three years from now" ✅[^1]. If the business logic depends on data access, every data-access change reaches the business logic.

Microsoft's guide states the same drawback for N-layer apps: the business layer "is dependent on data access implementation details (and often on the existence of a database)" ✅[^5].

```text
 Traditional                       Onion
 ┌────────┐                        ┌──────────────── UI · Infrastructure · Tests ─┐
 │   UI   │                        │  ┌──── Application services (vary) ───────┐  │
 ├────────┤  depends on ▼          │  │  ┌── Repository interfaces ────────┐   │  │
 │Business│                        │  │  │  ┌── Domain Model ──────────┐   │   │  │
 ├────────┤  depends on ▼          │  │  │  └──────────────────────────┘   │   │  │
 │  Data  │                        │  │  └─────────────────────────────────┘   │  │
 └────────┘                        │  └────────────────────────────────────────┘  │
 business rests on data            └───────── all coupling points to the centre ──┘
```

## 2. The four tenets (verbatim list) ✅[^2]

1. "The application is built around an independent object model"
2. "Inner layers define interfaces. Outer layers implement interfaces"
3. "Direction of coupling is toward the center"
4. "All application core code can be compiled and run separate from infrastructure"

**The rule** in part 1: "all code can depend on layers more central, but code cannot depend on layers further out from the core" ✅[^1]. "All coupling is toward the center" ✅[^1].

## 3. The layers

| Layer | What it holds | Source |
|---|---|---|
| Domain Model (centre) | The organisation's state and behaviour; the architecture is "unashamedly biased toward object-oriented programming" | ✅[^1] |
| First layer around the model | "Interfaces that provide object saving and retrieving behavior, called repository interfaces" | ✅[^1] |
| Further core layers | Not fixed: "The number of layers in the application core will vary" | ✅[^1] |
| Outer edge | "UI, Infrastructure, and Tests"; "reserved for things that change often". "The database is not the center. It is external." | ✅[^1] |

The core depends on interfaces, so the implementations must arrive from outside: "we need some mechanism for injecting that code at runtime" ✅[^1]. Palermo grounds this in the Dependency Inversion principle ✅[^1].

## 4. Analogies

| Analogy | Source |
|---|---|
| **The onion itself:** layers wrap a centre, and coupling runs only inward | ✅[^1] |
| **The shape is not the point:** traditional and onion can be drawn with the same circles, "the structure of the actual application is radically different" | ✅[^2] |
| **A house and its utilities** *(teaching analogy, ours)*: the house defines the socket and the pipe fittings (interfaces). Utility companies (database, mail) connect to those fittings. When the water company changes, the house's plumbing plan stays the same | — |

## 5. Palermo's example, step by step (CodeCampServer) ✅[^3]

| Step | What happens |
|---|---|
| 1 | `SpeakerController` sits in the UI layer and is coupled to ASP.NET MVC |
| 2 | It "only depends on interfaces, which are defined in the application core" |
| 3 | `ConferenceRepository` and `UserSession` implement those interfaces outside the core |
| 4 | The "IoC container will resolve the classes that implement interfaces and pass them into the SpeakerController constructor" |
| 5 | The controller may use `UserSession` directly (same layer) but "cannot use ConferenceRepository directly"; it must receive it from outside |

## 6. Four years later (2013) ✅[^4]

- "Onion architecture works well with and without DDD patterns".
- The core model "does not accept dependencies on less stable code".
- The CodeCampServer sample "has too much going on"; a simpler sample followed.
- "Onion architecture works just fine without the likes of StructureMap or Castle Windsor" (no IoC container needed).

## 7. Scope

- "This architecture is not appropriate for small websites. It is appropriate for long-lived business applications as well as applications with complex behavior" ✅[^1].
- Palermo did not claim invention: "it's not completely new, but I'm proposing it as a named, architectural pattern" ✅[^1].

## 8. Onion vs. hexagonal vs. clean

| | Onion | Hexagonal | Clean |
|---|---|---|---|
| Centre | Domain model ✅[^1] | "The application" ✅[^6] | Entities, then use cases ✅[^7] |
| Main split | Concentric layers | Inside vs. outside, driving vs. driven ✅[^6] | Concentric circles + the Dependency Rule ✅[^7] |
| Interfaces | Defined by inner layers ✅[^2] | Ports ✅[^6] | Input/output ports in the use-case circle ✅[^7] |
| Named use-case layer | No ("will vary") ✅[^1] | No | Yes ✅[^7] |

## 9. Edge cases

| # | Situation | Answer | Source |
|---|---|---|---|
| O1 | Repository interface placed in the infrastructure project | Wrong: interfaces are defined inside | ✅[^2] |
| O2 | The core needs the database to compile | Breaks tenet 4 | ✅[^2] |
| O3 | No IoC container in the stack | Fine | ✅[^4] |
| O4 | A small CRUD website | Palermo says not appropriate | ✅[^1] |
| O5 | Without DDD | Still works | ✅[^4] |

## 10. Mapping to the stack reference

| Onion | Reference |
|---|---|
| Domain Model | `src/domain/` |
| Repository-interfaces layer | `src/application/ports/DocumentStore.ts` |
| Application core layers | `src/application/` |
| Outer edge: UI / Infrastructure / Tests | `src/interface/`, `src/infrastructure/`, `test/` |
| Injection at run time | `CompositionRoot.ts`, with no container (matches §6) |

## 11. Check yourself
1. Why does the UI depend on data access in traditional layering? *(Transitive dependency.)*
2. Which tenet does "the domain project references the ORM" break? *(4, and 3.)*
3. Where does `DocumentStore` belong in onion terms? *(The first layer around the domain model.)*

## References
- [^1]: [The Onion Architecture, part 1](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/) — Jeffrey Palermo, 2008. Backs: §1, §3, §4, §7, §8.
- [^2]: [The Onion Architecture, part 3](https://jeffreypalermo.com/2008/08/the-onion-architecture-part-3/) — Jeffrey Palermo, 2008. Backs: §2, §4, §8, O1, O2.
- [^3]: [The Onion Architecture, part 2](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-2/) — Jeffrey Palermo, 2008. Backs: §5.
- [^4]: [Onion Architecture, part 4: after four years](https://jeffreypalermo.com/2013/08/onion-architecture-part-4-after-four-years/) — Jeffrey Palermo, 2013. Backs: §6, O3, O5.
- [^5]: [Common web application architectures](https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/common-web-application-architectures) — Microsoft, living. Backs: §1.
- [^6]: [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/) — Alistair Cockburn, 2005. Backs: §8.
- [^7]: [The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) — Robert C. Martin, 2012 (text and figure). Backs: §8.
- [conanjs/agentic-sdlc-reference-typescript-node @ v1.2.0](https://github.com/conanjs/agentic-sdlc-reference-typescript-node/tree/a8e776660fe686a716fc1f80550f2671c972cc7b) — mapped in §10 (the stack reference, pinned by `copilot/frameworks/agentic-sdlc/stacks/typescript-node/reference.md`).

## Related
- `software-design/architecture-styles/clean-architecture-deep-dive.md`
- `software-design/architecture-styles/hexagonal-architecture-deep-dive.md`
- `software-design/architecture-styles/combining-styles.md`
- `software-design/ddd/layering.md`
