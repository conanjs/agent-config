---
schema: knowledge-doc/v1
type: concept
topic: software-design/architecture-styles
status: verified
applies-to: ["any"]
last-verified: 2026-10-25
last-updated: 2026-10-25
tags: [ddd, layered-architecture, onion-architecture, hexagonal-architecture, clean-architecture]
---

# Combining DDD, layered, onion, hexagonal and clean architecture

## Summary
**TL;DR:** These are not rival choices. DDD says what goes in the core: a model of the business in its own language. Layered, onion, hexagonal and clean architecture say how to protect that core from technology. Each adds one rule, and a typical service applies all of them at once. Evans himself says hexagonal architecture may serve "as well or better" than his layers.
**Use this when:** someone asks "which architecture is this repo using?", or two rules seem to come from different books.
**Not this doc:** the details of each style → `hexagonal-architecture.md`, `clean-architecture.md`, `../ddd/layering.md`.

## Problem
Reviewers cite "DDD", "clean" and "hexagonal" for the same import rule and argue about which one applies. Without a map of what each style contributes, a gap stays invisible. Example: the inward-dependency rule alone does not stop one adapter from calling another.

## Mental model
**Analogy:** building a bank branch. DDD designs the vault and the banking rules. Layered architecture says the vault is on the lowest floor. Onion says every door opens inward. Hexagonal says customers and couriers enter only through the teller windows. Clean says nobody inside knows the street names outside.

**Artifact:** one repo, every style's contribution.
```text
src/core/domain/Role.ts           DDD: entity, ubiquitous language
src/core/ports/DocumentStore.ts   Onion/Clean: interface owned by the core
src/services/DocumentService.ts   Layered/Clean: thin application service (use case)
src/http/routes/documentRoutes.ts Hexagonal: driving adapter → calls the use case only
src/store/sqlite/SqliteDocStore   Hexagonal: driven adapter → implements the port
src/compose.ts                    composition root: the only file that names all of them
```

## How it works
| Style | Its main rule | Adds beyond the previous rows |
|---|---|---|
| DDD (Evans) | Isolate the domain model and business logic from UI, infrastructure and application logic; give the model the business's language | *What* the core holds. Each layer depends only on the layers below. ✅[^1] |
| Layered (Evans's form) | UI → application → domain → infrastructure | Infrastructure sits *below* the domain, so the domain could still depend on it ✅[^1] |
| Onion (Palermo) | All coupling is toward the centre; repository interfaces sit just outside the domain model and are implemented outside the core | Inverts the infrastructure layer: the core owns the interfaces ✅[^2] |
| Hexagonal (Cockburn) | Adapters convert outside technology into calls on the application's ports | The application is the hub; adapters talk to it, not to each other ✅[^3] |
| Clean (Martin) | Source-code dependencies point only inward | Named rings (entities, use cases, interface adapters); boundary crossing by dependency inversion ✅[^4] |

Martin says these styles share one objective: separation of concerns. ✅[^4] Evans's DDD Reference says related patterns such as hexagonal architecture "may serve as well or better" to the degree that they keep the model free of other concerns. ✅[^1]

**Where the ports live.** Onion puts repository interfaces in the first ring around the domain model. ✅[^2] Clean architecture puts gateway and output interfaces with the use cases. ✅[^4] Both are inside, and both are common. A small service often keeps all ports in one `core/ports/` folder.

## Worked example
Rule "the HTTP layer must not import the storage layer". Which style requires it?

| Check | Result |
|---|---|
| Clean architecture's dependency rule | Silent. HTTP and storage are both outer-ring adapters, so neither is inner to the other |
| Evans's layering | Silent or permissive. Infrastructure is below the UI, so UI → infrastructure points "down" |
| Onion | Silent on outer-to-outer edges |
| Hexagonal | **Requires it.** Adapters reach each other only through the application ✅[^3] |

So the rule comes from hexagonal architecture. It matters most when the use case runs a security check, because skipping the use case skips the check.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Domain imports a storage interface from infrastructure | Allowed by Evans's layered form, forbidden by onion and clean | Onion and clean invert that edge ✅[^2] ✅[^4] |
| Team cites "DDD" for an import rule | Usually the rule is from onion, hexagonal or clean | DDD's tactical patterns are about modeling. Its layering is one building block ✅[^1] |
| Application folder also holds adapters (hashing, token signing) | Layer rules can no longer tell use cases from adapters | Separate them, or list the adapter files explicitly in the boundary rules |

## Takeaways
- Name the style a rule comes from when citing it: modeling (DDD), direction (onion/clean), or hub (hexagonal). [rule-candidate]
- Keep use cases and adapters in different folders, so boundary rules can tell them apart. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 13 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-25

## References
- [Domain-Driven Design Reference](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf) — Eric Evans / Domain Language, 2015. Backs: "Layered Architecture" pattern summary. [^1]
- [The Onion Architecture, part 1](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/) — Jeffrey Palermo, 2008. Backs: coupling toward the centre, interface placement. [^2]
- [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/) — Alistair Cockburn, 2005. Backs: adapters and the application as hub. [^3]
- [The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) — Robert C. Martin, 2012. Backs: dependency rule, shared objective, port placement. [^4]
- `copilot/frameworks/agentic-sdlc/foundations/design/clean-architecture.md` — CA-1 (direction) and CA-10 (hub) apply these styles together.
- `copilot/frameworks/agentic-sdlc/foundations/design/domain-driven-design.md` — the DDD foundation.

## Related
- `software-design/architecture-styles/hexagonal-architecture.md`
- `software-design/architecture-styles/clean-architecture.md`
- `software-design/ddd/layering.md`
- `software-design/ddd/building-blocks.md`
