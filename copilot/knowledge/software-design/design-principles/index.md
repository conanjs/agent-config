---
schema: topic-index/v1
kind: subtopic
topic: software-design/design-principles
last-updated: 2026-10-04
---

# Design principles

Design principles covers paradigm-neutral rules for choosing simple, understandable module and API boundaries. It does not replace paradigm-specific OOP, DDD, or functional-modeling docs; it links to them where the principle becomes concrete.

SOLID is a set of five class/module design principles named by Robert C. Martin: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion. The same ideas apply in functional code too: responsibilities become transformation modules, open extension becomes added handlers or functions after real variation appears, substitution becomes function/adapter contract compatibility, segregation becomes narrow function or capability types, and dependency inversion becomes pure policy accepting effectful capabilities at the boundary.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [single-responsibility.md](single-responsibility.md) | concept | One reason to change means one actor or policy, not one tiny operation. | verified |
| [open-closed.md](open-closed.md) | concept | Extend established variation by adding code, with YAGNI before speculative extension points. | verified |
| [liskov-substitution.md](liskov-substitution.md) | concept | Implementations must honor the behavioral contract of their abstraction. | draft |
| [interface-segregation.md](interface-segregation.md) | concept | Consumers depend on narrow role interfaces or function types they actually use. | verified |
| [dependency-inversion.md](dependency-inversion.md) | concept | Policy owns boundary abstractions; details implement them and are wired separately. | verified |
| [dry.md](dry.md) | concept | DRY as one authoritative representation of knowledge, with guidance on real vs incidental duplication | draft |
| [kiss-and-yagni.md](kiss-and-yagni.md) | concept | KISS, YAGNI, simple design, speculative generality, and why YAGNI wins for new code | verified |
| [separation-of-concerns.md](separation-of-concerns.md) | concept | Separating domain, I/O, presentation, and orchestration concerns by change reason | draft |
| [least-astonishment.md](least-astonishment.md) | concept | Predictable names, signatures, side effects, flags, and visible failure modes | verified |
| [cohesion-and-coupling.md](cohesion-and-coupling.md) | concept | Cohesion, coupling, and connascence vocabulary used by SRP, ISP, and SoC | draft |

## References
- [SOLID Relevance](https://blog.cleancoder.com/uncle-bob/2020/10/18/Solid-Relevance.html) — Robert C. Martin, 2020. Backs: SOLID scope.
- `copilot/frameworks/knowledge/schemas/topic-index.schema.md` — defines the topic index shape.
- `copilot/frameworks/agentic-sdlc/foundations/design/design-principles.md` — cites design-principles docs as DP-1 through DP-8, DP-10, and DP-11.
- [BeckDesignRules](https://martinfowler.com/bliki/BeckDesignRules.html) — Martin Fowler, 2015. Backs: topic scope for simple design.

## Related
- `software-design/oop/`
- `software-design/ddd/`
- `software-design/functional-modeling/`
