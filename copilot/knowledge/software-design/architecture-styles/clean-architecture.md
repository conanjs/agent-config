---
schema: knowledge-doc/v1
type: concept
topic: software-design/architecture-styles
status: verified
applies-to: ["any"]
last-verified: 2026-10-25
last-updated: 2026-10-25
tags: [clean-architecture, dependency-rule, interface-adapters, presenter, architecture]
---

# Clean architecture and the dependency rule

## Summary
**TL;DR:** Clean architecture draws the code as rings: business rules in the centre, then use cases, then interface adapters (controllers, presenters, gateways), then frameworks and drivers. The one rule is that source-code dependencies point only inward. When control must flow outward, an inner ring declares an interface and an outer ring implements it.
**Use this when:** checking an import's direction, deciding where a presenter or controller lives, or explaining why the domain must not import the framework.
**Not this doc:** inside/outside and adapter-to-adapter calls → `hexagonal-architecture.md`. How it combines with DDD and onion → `combining-styles.md`.

## Problem
When the business rules import the web framework or the database driver, every change to those details touches the rules, and the rules cannot be tested without them.

## Mental model
**Analogy:** an onion of rooms in a castle. People in an outer room may walk inward. Nobody in an inner room even knows the names of the outer rooms. Messages that must go outward are left in a mailbox the inner room owns.

**Artifact:**
```text
 ┌─ Frameworks & drivers: web server, DB driver ─────────────┐
 │ ┌─ Interface adapters: controllers, presenters, gateways ┐│
 │ │ ┌─ Use cases (application rules) ───────────────────┐ ││
 │ │ │ ┌─ Entities (enterprise / domain rules) ───────┐  │ ││
 │ │ │ └──────────────────────────────────────────────┘  │ ││
 │ │ └───────────────────────────────────────────────────┘ ││
 │ └────────────────────────────────────────────────────────┘│
 └───────────────────────────────────────────────────────────┘
  every import arrow points inward
```

## How it works
1. **Dependency rule.** Source-code dependencies can only point inward. ✅[^1]
2. **Interface adapters ring.** Adapters convert data between the form the use cases need and the form an external agent needs, such as the database or the web. Presenters, views and controllers all belong in this ring. ✅[^1]
3. **Crossing a boundary outward.** Control flows controller → use case → presenter, which is outward at the last step. The use case declares an output interface and the presenter implements it. That way the source-code dependency opposes the flow of control at the boundary. ✅[^1] This is the dependency inversion principle applied at the ring edge (`../design-principles/dependency-inversion.md`).
4. **The rings are schematic.** Four is not a law; you may need more. ✅[^1]
5. **Same goal as its peers.** Hexagonal, onion and similar architectures share the objective of separation of concerns. ✅[^1]

**What a presenter is here.** A presenter is the adapter that turns a use case's output into the shape the outside world sees (a view model, or a JSON body for an API). Example: given a user entity holding `id`, `username` and `passwordHash`, `UserPresenter` returns `{ id, username }`. A later field never leaks unless someone adds it to the presenter on purpose. The name has an older, different meaning in Model-View-Presenter UI design (an object that reacts to user input). A project should say which one it means.

## Worked example
A login request.

| Step | Ring | What happens | Import direction |
|---|---|---|---|
| 1 | Frameworks | The web server hands the request to the controller | Framework code → controller |
| 2 | Adapters | The controller builds `LoginInput` and calls the `Login` use case | Adapter → use case ✓ |
| 3 | Use cases | `Login` checks the password through the `PasswordHasher` port, which it declares | Use case → its own port ✓ |
| 4 | Entities | `User` and `Role` decide the principal's permissions | Use case → entity ✓ |
| 5 | Adapters | `Login` returns its output; `UserPresenter` maps it to `{ id, username, roles }` | Presenter → use-case output type ✓ |
| ✗ | Entities | `User` imports the web framework's `Request` | Inner → outer: violates the rule |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Entity imports a framework type | The rule is broken; the entity can no longer be tested alone | Dependencies must point inward ✅[^1] |
| Use case needs storage | It declares a gateway interface; an outer adapter implements it | Dependency inversion at the boundary ✅[^1] |
| Two adapters in the same ring call each other | The dependency rule alone does not forbid it | It only speaks about inward direction. Hexagonal architecture adds the "through the application" rule |
| A project needs five rings | Fine | The rings are schematic ✅[^1] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Full rings with input/output ports | Maximum isolation and testability | Many small types for simple CRUD |
| Collapsed rings for a small component | Less ceremony | The collapse must be recorded so reviewers do not see it as drift |

## Takeaways
- Check every import against the inward direction; inner code never names outer code. [rule-candidate]
- Put presenters and controllers in the adapter ring and keep them free of business decisions. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 8 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-25

## References
- [The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) — Robert C. Martin, 2012. Backs: How it works 1–5, Edge cases. [^1]
- [GUI Architectures](https://martinfowler.com/eaaDev/uiArchs.html) — Martin Fowler, 2006. Backs: the Model-View-Presenter meaning of "presenter".
- `copilot/frameworks/agentic-sdlc/foundations/design/clean-architecture.md` — the CA rules this doc explains.
- `copilot/frameworks/agentic-sdlc/foundations/code/naming.md` — the `Presenter` role suffix.

## Related
- `software-design/architecture-styles/hexagonal-architecture.md`
- `software-design/architecture-styles/combining-styles.md`
- `software-design/design-principles/dependency-inversion.md`
