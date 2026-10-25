---
schema: topic-index/v1
kind: subtopic
topic: software-design/architecture-styles
last-updated: 2026-10-25
---

# Architecture styles

How the code inside one deployable is arranged so that business rules stay independent of technology: hexagonal (ports and adapters), clean architecture's dependency rule, onion, and how they combine with DDD. Not covered: DDD modeling building blocks (see `software-design/ddd/`) and how services talk to each other (contracts, distributed systems).

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [hexagonal-architecture.md](hexagonal-architecture.md) | concept | Ports, driving and driven adapters; the application as the hub, so adapters never call each other. | verified |
| [clean-architecture.md](clean-architecture.md) | concept | Concentric rings, the inward dependency rule, crossing boundaries by inversion, and what a presenter is. | verified |
| [combining-styles.md](combining-styles.md) | concept | What DDD, layered, onion, hexagonal and clean each contribute, and which one a given import rule comes from. | verified |

## References
- `copilot/frameworks/knowledge/schemas/topic-index.schema.md` — defines the topic index shape.
- `copilot/frameworks/agentic-sdlc/foundations/design/clean-architecture.md` — the CA rules these docs explain.
- [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/) — Alistair Cockburn, 2005. Backs: topic scope.
- [The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) — Robert C. Martin, 2012. Backs: topic scope.

## Related
- `software-design/ddd/`
- `software-design/design-principles/`
- `software-design/oop/`
