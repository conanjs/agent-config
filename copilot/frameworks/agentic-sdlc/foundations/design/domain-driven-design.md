---
schema: foundation/v2
last-updated: 2026-10-04
rule-prefix: DDD
subject: design
---

# Domain-Driven Design

What is true of a model that tracks the business: one language per context, explicit context boundaries, and consistency enforced by aggregates. Reviews cite `DDD-n`.

## Rules

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| DDD-1 | Ubiquitous language. Terms in `spec.md`, code identifiers, API fields, and test names use the same words with the same meaning inside a bounded context. A rename in one is a rename in all. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm (fallback) | — |
| DDD-2 | Bounded context. Each model has an explicit boundary inside which its terms are unambiguous. The same word ("Account") may mean different things in different contexts — expected, not duplication. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| DDD-3 | One context, one owner. A bounded context is owned by one team/service/module; its data is written only through it (`distributed-systems.md`, DS-9). | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| DDD-4 | Explicit context map. Relations between contexts are named with a mapping pattern (below) and recorded in the system architecture (multi-repo) or `docs/architecture.md` (single repo). | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| DDD-5 | Translate at the border. A context never adopts another context's model inside its domain layer; it translates via an anti-corruption layer or a published language. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| DDD-6 | Entities have identity that persists across state changes; value objects are immutable and compared by value. Prefer value objects for amounts, ranges, identifiers, addresses. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| DDD-7 | Aggregate = consistency boundary. Invariants that must hold atomically live inside one aggregate; one transaction modifies one aggregate. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| DDD-8 | Access through the root. External code references only the aggregate root and changes internals only via root methods that enforce invariants. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| DDD-9 | Reference other aggregates by id, never by object reference. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| DDD-10 | Small aggregates. Size aggregates by true invariants, not by screens or tables; large aggregates cause contention. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| DDD-11 | Cross-aggregate consistency is eventual, achieved through domain events and handlers (`distributed-systems.md`, DS-5, DS-7). | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| DDD-12 | Domain events are named in past tense in the ubiquitous language (`OrderPlaced`), carry the data consumers need, and are facts — never commands in disguise. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| DDD-13 | Repositories exist per aggregate root, expose collection-like operations in domain terms, and are driven ports (`clean-architecture.md`, CA-2). | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| DDD-14 | No anemic model when rules exist. If an entity has invariants, the methods that enforce them live on the entity/aggregate, not in a service that mutates its fields. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |

## Interpreting

**Strategic design**

**Context mapping patterns**

| Pattern | Use when | Cost |
|---|---|---|
| **Shared Kernel** | Two contexts must share a tiny, stable model and one team coordinates both | Every change needs joint agreement |
| **Customer–Supplier** | Downstream needs influence over upstream's roadmap | Upstream must plan for downstream |
| **Conformist** | Upstream won't change and translation isn't worth it | Upstream's model leaks downstream |
| **Anti-Corruption Layer** | Upstream model is foreign, legacy, or unstable | Translation code to maintain |
| **Open Host Service + Published Language** | Many consumers; upstream offers a stable documented contract | Contract governance |
| **Separate Ways** | Integration cost exceeds value | Duplicated capability |

Default: Open Host Service + Published Language between our own services; Anti-Corruption Layer when consuming third-party or legacy systems.

**Tactical design**

**When DDD is overkill**

Tactical patterns pay off in rule-rich domains. For CRUD or integration-only components keep DDD-1 to DDD-5 (language and boundaries) and skip aggregates and domain events.

**Review checks**

- A term used in code but absent from `spec.md` (or used with a different meaning) is a DDD-1 finding.
- A transaction touching two aggregates is a DDD-7 finding unless a decision record justifies it.

**Application note:** stack profiles define concrete commands and idioms; this foundation defines stack-agnostic intent.

## Tensions

| Rule A | Rule B | Default resolution |
|---|---|---|
| Simplicity | Explicit boundaries | Add boundaries only where change rate, ownership or risk justifies them. |

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/schemas/foundation.schema.md`: schema and required structure for this foundation.
- `copilot/frameworks/agentic-sdlc/schemas/_system.md`: shared rule-table, id, path and references rules.
- `foundations/design/domain-driven-design.md`: this foundation file.

**External authoritative sources:**
- Eric Evans, *Domain-Driven Design: Tackling Complexity in the Heart of Software* (2003).
- Vaughn Vernon, *Implementing Domain-Driven Design* (2013) and "Effective Aggregate Design" (2011).
- DDD Crew, *Context Mapping* reference — github.com/ddd-crew/context-mapping.

## Related

- `clean-architecture.md` — the domain layer DDD populates.
- `distributed-systems.md` — consistency and ownership across contexts.
- `../delivery/spec-writing.md` — where the ubiquitous language is first captured.
- `../design/contract-design.md` — published language between contexts.
