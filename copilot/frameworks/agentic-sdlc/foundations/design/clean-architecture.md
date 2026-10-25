---
schema: foundation/v2
last-updated: 2026-10-25
rule-prefix: CA
subject: design
---

# Clean Architecture

What is true of a well-layered component: source dependencies point inward toward policy, and I/O lives at the edges behind ports. Reviews cite `CA-n`.

## Rules

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| CA-1 | Dependency rule. Source-code dependencies point only inward (Adapters → Application → Domain). Nothing in an inner layer names anything in an outer layer. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CA-2 | Ports are owned by the inside. The interface for a repository, gateway, or publisher is declared in the application (or domain) layer, in its vocabulary; adapters implement it. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CA-3 | Adapters are thin. An adapter translates (transport ↔ use-case input/output, row ↔ entity) and makes no business decision. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CA-4 | Boundary-specific data. Data crosses a boundary as plain structures owned by that boundary — persistence models and transport DTOs never leak inward. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CA-5 | One intent, one use case. Each user intent in `spec.md` maps to one application-layer use case; controllers do not compose use cases ad hoc. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CA-6 | Frameworks are details. Framework types appear only in adapters and the composition root. Domain and application build and test without the framework. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm (fallback) | — |
| CA-7 | Side effects are injected. Time, randomness, id generation, environment, and configuration reach inner layers through ports or parameters (`idiom.config`). | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CA-8 | No cycles between layers or modules (`../review/fitness-functions.md`, FF-2). | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| CA-9 | Testability follows from layering. Domain is unit-tested with no doubles; application is unit-tested with fake ports; adapters are integration-tested against the real dependency. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm (fallback) | — |
| CA-10 | Adapters do not depend on each other. A driving adapter (controller, CLI handler, consumer) reaches a driven adapter (repository, client, publisher) only through an application use case and its port. Only the composition root names both. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | knowledge/software-design/architecture-styles/hexagonal-architecture.md |

## Interpreting

**Layers (inside one deployable component)**

| Layer | Contains | May depend on | Must not contain |
|---|---|---|---|
| **Domain** (entities, value objects, domain services) | Business rules and invariants | Nothing outside the domain | I/O, framework types, serialization annotations, clock/randomness read directly |
| **Application** (use cases) | Orchestration of one user intent; transaction scope; port interfaces | Domain | Transport (HTTP, queue) details, query strings |
| **Adapters / Infrastructure** | Port implementations: repositories, clients, publishers, controllers | Application, Domain; never another adapter (CA-10) | Business rules |
| **Composition root** | Wiring, configuration loading, process startup | Everything | Logic beyond wiring |

The stack profile's `project_layout` slot gives the concrete folder names; `idiom.di` gives the wiring form.

**Rules**

**Ports & adapters (hexagonal view)**

- **Driving (primary) ports:** use-case interfaces called by controllers, CLI handlers, message consumers.
- **Driven (secondary) ports:** interfaces the application calls — persistence, external APIs, messaging, clock.
- Each driven port has at least one production adapter and, where useful, an in-memory adapter for tests.
- The application is the hub (CA-10). A controller that calls a repository directly skips the use case and every check the use case runs, such as authorization. For a security-relevant use case this means failing open.

**Boundaries**

- A **boundary** is any place where a dependency is inverted (CA-1, CA-2). Draw one where the two sides change for different reasons or at different rates.
- Boundaries cost indirection. A small component (one use case, no domain rules) may collapse application and domain — record that choice in `docs/architecture.md`.
- Cross-service boundaries are contracts, not ports (`../design/contract-design.md`).

**Acceptable simplifications**

| Situation | Simplification |
|---|---|
| CRUD with no domain rules | Application + adapters only; no domain layer |
| Script / one-shot tool | Single module; still keep I/O at the edges |
| Read-heavy query paths | Query adapters may bypass the domain model (CQRS-style read side) |

Any simplification is stated in `docs/architecture.md`; an unstated one is a review finding.

**Application note:** stack profiles define concrete commands and idioms; this foundation defines stack-agnostic intent.

## Tensions

| Rule A | Rule B | Default resolution |
|---|---|---|
| Simplicity | Explicit boundaries | Add boundaries only where change rate, ownership or risk justifies them. |

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/schemas/foundation.schema.md`: schema and required structure for this foundation.
- `copilot/frameworks/agentic-sdlc/schemas/_system.md`: shared rule-table, id, path and references rules.
- `foundations/design/clean-architecture.md`: this foundation file.

**External authoritative sources:**
- Robert C. Martin, *Clean Architecture: A Craftsman's Guide to Software Structure and Design* (2017); [The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) (2012).
- [Alistair Cockburn, "Hexagonal Architecture"](https://alistair.cockburn.us/hexagonal-architecture/) (Ports and Adapters), 2005. Backs CA-10: adapters talk to the application, not to each other.
- [Jeffrey Palermo, "The Onion Architecture"](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/) (2008).

**Knowledge docs:** `knowledge/software-design/architecture-styles/` — hexagonal, clean, and how they combine with DDD.

## Related

- `design-principles.md` — DP-5 (dependency inversion), DP-10 (separation of concerns).
- `domain-driven-design.md` — what belongs in the domain layer.
- `../design/module-boundaries.md` — how to define and check layers in a repo.
- `../review/fitness-functions.md` — automated checks for CA-1 and CA-8.
