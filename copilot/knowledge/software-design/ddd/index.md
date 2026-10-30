---
schema: topic-index/v1
kind: subtopic
topic: software-design/ddd
last-updated: 2026-10-04
---

# Domain-Driven Design

Domain-Driven Design covers business language, model boundaries, tactical building blocks, aggregate consistency, and domain-layer isolation. It does not cover generic object syntax or dependency injection mechanics; see `software-design/oop/` for those.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [building-blocks.md](building-blocks.md) | concept | Entity, value object, domain service, repository, and factory responsibilities with a comparison table. | verified |
| [aggregates.md](aggregates.md) | concept | Aggregate roots, consistency boundaries, invariants, small aggregates, identity references, transaction scope, eventual consistency, and root-level tests. | verified |
| [layering.md](layering.md) | concept | UI/application/domain/infrastructure layers, domain isolation from I/O, and relation to ports-and-adapters. | verified |
| [bounded-contexts.md](bounded-contexts.md) | concept | Bounded contexts, ubiquitous language, and context mapping patterns. | verified |

## References
- `copilot/frameworks/knowledge/schemas/topic-index.schema.md` — defines the topic index shape.
- `copilot/frameworks/agentic-sdlc/foundations/design/domain-driven-design.md` — DDD foundation aligned by these docs.
- `copilot/frameworks/agentic-sdlc/paradigms/class-modeled.md` — cites aggregate and layering docs from PDM class-modeled rules.
- [DDD Reference](https://www.domainlanguage.com/ddd/reference/) — Eric Evans / Domain Language, 2015. Backs: DDD topic scope.
- [BoundedContext](https://martinfowler.com/bliki/BoundedContext.html) — Martin Fowler, 2014. Backs: strategic DDD scope.

## Related
- `software-design/`
- `software-design/oop/`
