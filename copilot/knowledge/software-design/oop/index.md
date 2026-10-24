---
schema: topic-index/v1
kind: subtopic
topic: software-design/oop
last-updated: 2026-10-04
---

# Object-oriented modeling

Object-oriented modeling covers objects, identity, state, behavior, messaging, classes and prototypes, encapsulation, polymorphism, composition, contracts, dependency wiring, and coupling rules such as the Law of Demeter. It does not cover DDD aggregate selection in depth; see `software-design/ddd/` for that.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [core-concepts.md](core-concepts.md) | concept | Object identity/state/behavior, messaging, classes vs prototypes, OOP pillars, and value vs reference semantics. | verified |
| [encapsulation.md](encapsulation.md) | concept | Information hiding, tell-don't-ask, anemic models, and intention-revealing operations. | verified |
| [polymorphism.md](polymorphism.md) | concept | Subtype, parametric, and ad-hoc polymorphism; dynamic dispatch; unions; structural, implicit, and trait typing. | verified |
| [composition-over-inheritance.md](composition-over-inheritance.md) | concept | Reusing behavior through collaborators, delegation, strategies, embedding, traits, and functions before inheritance. | verified |
| [law-of-demeter.md](law-of-demeter.md) | concept | Limiting object-graph knowledge, avoiding train wrecks, and distinguishing fluent APIs from coupling leaks. | verified |
| [dependency-injection.md](dependency-injection.md) | concept | Constructor injection, composition roots, consumer-owned ports, and why service locator hides dependencies. | verified |
| [design-by-contract.md](design-by-contract.md) | concept | Preconditions, postconditions, invariants, blame, and the boundary between expected rule failures and contract violations. | verified |

## References
- `copilot/frameworks/knowledge/schemas/topic-index.schema.md` — defines the topic index shape.
- `copilot/frameworks/agentic-sdlc/paradigms/class-modeled.md` — cites these docs from PDM class-modeled rules.
- `copilot/frameworks/agentic-sdlc/foundations/design/design-principles.md` — cites `composition-over-inheritance.md` as DP-9.
- [Clarification of "object-oriented"](http://www.purl.org/stefan_ram/pub/doc_kay_oop_en) — Alan Kay via Stefan Ram, 2003. Backs: messaging scope.
- [TellDontAsk](https://martinfowler.com/bliki/TellDontAsk.html) — Martin Fowler, 2013. Backs: OOP behavior ownership scope.
- [Inversion of Control Containers and the Dependency Injection pattern](https://martinfowler.com/articles/injection.html) — Martin Fowler, 2004. Backs: dependency injection scope.

## Related
- `software-design/`
- `software-design/ddd/`
- `software-design/functional-modeling/`