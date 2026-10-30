---
schema: topic-index/v1
kind: topic
topic: software-design
last-updated: 2026-10-04
---

# Software design

Software design covers design principles, model structure, boundaries, and dependency direction for code that must stay understandable as rules change. It does not cover runtime internals or team documentation formats.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| — | — | No top-level docs; see Subtopics | — |

## Subtopics
| Subtopic | Summary |
|---|---|
| [design-principles/](design-principles/) | Paradigm-neutral design principles: SOLID, DRY, KISS/YAGNI, separation of concerns, least astonishment, cohesion and coupling. |
| [oop/](oop/) | Object-oriented modeling practices for behavior-owning types, dependency wiring, and contracts. |
| [ddd/](ddd/) | Domain-Driven Design tactical and strategic patterns for business-model boundaries. |
| [architecture-styles/](architecture-styles/) | Hexagonal (ports and adapters), clean architecture's dependency rule, onion, and how they combine with DDD. |
| [functional-modeling/](functional-modeling/) | Functional modeling practices for immutable data, pipelines, and effects at the edge. |

## References
- `copilot/frameworks/knowledge/schemas/topic-index.schema.md` — defines the topic index shape.
- `copilot/frameworks/agentic-sdlc/paradigms/class-modeled.md` — cites OOP and DDD knowledge docs under this topic.
- `copilot/frameworks/agentic-sdlc/foundations/design/design-principles.md` — cites design-principles and OOP docs (DP-1…DP-11).
- [DDD Reference](https://www.domainlanguage.com/ddd/reference/) — Eric Evans / Domain Language, 2015. Backs: DDD topic scope.
- [Domain Model](https://martinfowler.com/eaaCatalog/domainModel.html) — Martin Fowler, 2002. Backs: behavior-and-data modeling scope.

## Related
- `software-design/design-principles/`
- `software-design/oop/`
- `software-design/ddd/`
- `software-design/functional-modeling/`
- `software-design/architecture-styles/`
