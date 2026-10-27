---
schema: deep-dive/v1
topic: software-design/architecture-styles
status: verified
applies-to: ["any"]
last-updated: 2026-10-27
last-verified: 2026-10-25
synthesized-into: []
tags: [screaming-architecture, use-cases, packaging, package-by-feature, vertical-slice, folder-structure]
---

# Screaming Architecture, end to end

## Summary
**TL;DR:** Robert C. Martin (2011) says the top-level structure of a codebase should "scream" what the system does, such as health care or accounting, not which framework it uses. Use cases are central, frameworks and the web are delivery details, and the use cases must be testable without any framework. In practice this is a **packaging** decision: what you see when you open the repository's top-level folders.
**Use this when:** choosing the top-level folder layout, deciding when to switch from layer-first to feature-first, or reviewing whether a repo's structure tells a newcomer what it does.
**Depth:** the claim and its analogies; what "use case" means; packaging options with folder trees; when to switch from layers to features; vertical slices; edge cases; the stack reference; self-check.

## 1. The claim

| Point | Source |
|---|---|
| Building plans scream their purpose: a house plan screams "house", a library plan screams "Library" | ✅[^1] |
| Does your top-level directory scream the business, "or do they scream: Rails, or Spring/Hibernate, or ASP?" | ✅[^1] |
| "Software architectures are structures that support the use cases of the system" | ✅[^1] |
| Martin's pointer: "Go back and read Ivar Jacobson's seminal work on software architecture: Object Oriented Software Engineering" | ✅[^1] |
| "Frameworks are tools to be used, not architectures to be conformed to" | ✅[^1] |
| "The Web is a delivery mechanism, and your application architecture should treat it as such" | ✅[^1] |
| Decisions about frameworks, databases and web servers can be deferred | ✅[^1] |
| "You should be able to unit-test all those use cases without any of the frameworks in place" | ✅[^1] |
| Conclusion: "Your architectures should tell readers about the system, not about the frameworks you used in your system" | ✅[^1] |

The book's chapter 21 has the same structure. Its sections are The Theme of an Architecture; The Purpose of an Architecture; But What About the Web?; Frameworks Are Tools, Not Ways of Life; Testable Architectures ✅[^2].

## 2. Analogies

| Analogy | Source |
|---|---|
| **Blueprints:** a plan reveals the building's purpose at a glance | ✅[^1] |
| **A supermarket's aisle signs** *(teaching analogy, ours)*: aisles say "Dairy", "Bakery". They don't say "Shelves made by IKEA". Folders are aisle signs | — |
| **A book's table of contents** *(teaching analogy, ours)*: chapters are named for topics, not for the font or the printer | — |

## 3. A "use case" here

A use case is one thing a user achieves with the system, such as "revise a document" or "admit a patient". The term comes from Jacobson's use-case-driven approach, which Martin cites ✅[^1]. Jacobson's analysis turns each use case into a *control* object ✅[^4]; Clean Architecture's *interactor* plays the same role.

## 4. What does *not* scream (verified example)

Microsoft describes the default single-project MVC layout:
- UI concerns "reside in multiple folders, which aren't grouped together alphabetically";
- business logic is "scattered between the Models and Services folders";
- "there's no clear indication of which classes in which folders should depend on which others" ✅[^3].

```text
 Does not scream (technical)            Screams (business)
 src/                                    src/
   controllers/                            documents/
   models/                                   revise/   ← one use case
   services/                                 publish/
   repositories/                           reviewers/
   views/                                    assign/
```

## 5. Packaging options

The book's chapter 34, "The Missing Chapter", has sections titled Package by Layer; Package by Feature; Ports and Adapters; Package by Component; The Devil Is in the Implementation Details; Organization versus Encapsulation; Other Decoupling Modes ✅[^2].

Simon Brown publishes the same material on his own site and says: "A version of this was also published as 'The missing chapter' in Clean Architecture" ✅[^7]. His running example is an online book store with a "view order status" use case. It uses the classes `OrdersController`, `OrdersService`/`OrdersServiceImpl` and `OrdersRepository`/`JdbcOrdersRepository` ✅[^7].

| Option | Top level | Screams? | Brown's description ✅[^7] |
|---|---|---|---|
| By layer | `controllers/ services/ repositories/` | No | Code "sliced horizontally into layers"; "three large buckets of code", not enough as software grows; "a layered architecture doesn't 'scream' anything about the business domain" |
| By feature | `documents/ reviewers/` | Yes | "A 'vertical' slicing, based upon related features, domain concepts, bounded contexts, or aggregate roots"; the top level "now screams something about the business domain" |
| Ports and adapters | `domain/ application/ infrastructure/` | Only the inside does | "The 'outside' depends on the 'inside'; never the other way around"; the inside uses domain language, so `OrdersRepository` becomes `Orders` |
| By component | `orders/` with only `OrdersComponent` public | Yes | A component is "a grouping of related functionality behind a well-defined interface". Everything except `OrdersComponent` is package-protected, "so we can rely on the compiler to enforce this architectural principle" |

**Organisation vs. encapsulation.** "If you make all types in your Java application public, the packages are simply an organisation mechanism". In that case all four approaches are effectively the same ✅[^7]. Brown's closing advice: "Consider using your compiler to help you enforce your chosen architectural style" ✅[^7].

**Other decoupling modes** he lists ✅[^7]:
- module systems that separate *public* from *published* types (OSGi, the Java Platform Module System);
- separate source trees per component. He calls this "very much an idealistic solution", and warns that a plain inside/outside two-tree split invites the "Périphérique anti-pattern".

**TypeScript (analysis, ours):** there is no package-private keyword. The stack reference uses lint zones as the enforcing tool, which plays the role Brown gives the compiler.

**Two sources that say when to switch:**
- **Fowler:** layer-first top levels are fine for small systems, but larger ones "should split your top level into domain oriented modules", each layered inside ✅[^5].
- **Bogard (vertical slices):** group a request's code from front to back. "Minimize coupling between slices, and maximize coupling in a slice." Start each slice as a simple transaction script and refactor as smells appear ✅[^6].

**Combined layout (analysis, ours):** features at the top, layers inside, so both the business and the dependency direction are visible:

```text
src/
  documents/
    domain/  application/  infrastructure/  interface/
  reviewers/
    domain/  application/  infrastructure/  interface/
  CompositionRoot.ts  main.ts
```

## 6. Edge cases

| # | Situation | Answer | Source |
|---|---|---|---|
| S1 | One feature only | Layer-first is fine; Fowler accepts it for small systems | ✅[^5] |
| S2 | The framework's generator creates `controllers/` etc. | Frameworks are tools, not the shape of the app | ✅[^1] |
| S3 | Use cases can't be tested without the web server | Fails the testability claim | ✅[^1] |
| S4 | Shared code between slices | Keep it minimal | ✅[^6] |

## 7. The stack reference

`src/domain/ application/ infrastructure/ interface/` is **layer-first** (it shows ports and adapters). With one feature (`ReviseDocument`) this is fine (S1). The reference does not say when to switch. Proposed, not applied: a packaging note in the CA foundation and in the reference's `docs/architecture.md`.

## 8. Check yourself
1. Open a repo: what should its top-level folders tell you? *(What the system does.)*
2. Where would `PublishDocument` go in the combined layout? *(`src/documents/application/`.)*
3. Why is "the web is a delivery mechanism" a screaming argument? *(The web belongs in an outer folder, not in the top-level shape.)*

## References
- [^1]: [Screaming Architecture](https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html) — Robert C. Martin, 2011. Backs: §1–§3, S2, S3.
- [^2]: [Clean Architecture, detailed contents](https://www.informit.com/store/clean-architecture-a-craftsmans-guide-to-software-9780134494166) — InformIT (Pearson), 2017. Backs: §1 chapter 21, §5.
- [^3]: [Common web application architectures](https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/common-web-application-architectures) — Microsoft, living. Backs: §4.
- [^4]: [Entity-control-boundary](https://en.wikipedia.org/wiki/Entity-control-boundary) — Wikipedia, living. Backs: §3.
- [^5]: [Presentation Domain Data Layering](https://martinfowler.com/bliki/PresentationDomainDataLayering.html) — Martin Fowler, 2015. Backs: §5, S1.
- [^6]: [Vertical Slice Architecture](https://www.jimmybogard.com/vertical-slice-architecture/) — Jimmy Bogard, 2018. Backs: §5, S4.
- [^7]: [Modular monolith and "package by component"](https://simonbrown.je/modular-monolith) — Simon Brown, originally 2016 (the version published as *Clean Architecture* ch. 34). Backs: §5.
- [conanjs/agentic-sdlc-reference-typescript-node @ v1.0.1](https://github.com/conanjs/agentic-sdlc-reference-typescript-node/tree/9323ccd662f566ea33fd93b55b99453b8e537cea) — §7 (the stack reference, pinned by `copilot/frameworks/agentic-sdlc/stacks/typescript-node/reference.md`).

## Related
- `software-design/architecture-styles/clean-architecture-deep-dive.md`
- `software-design/architecture-styles/hexagonal-architecture-deep-dive.md`
- `software-design/design-principles/cohesion-and-coupling.md`
