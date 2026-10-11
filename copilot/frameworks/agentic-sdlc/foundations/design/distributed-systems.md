---
schema: foundation/v2
last-updated: 2026-10-04
rule-prefix: DS
subject: design
---

# Distributed Systems

What is true whenever work crosses a process or network boundary: the network fails, messages repeat, clocks disagree, and every participant evolves independently. Reviews cite `DS-n`.

## Rules

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| DS-1 | Choose consistency explicitly (CAP / PACELC). Under partition a system gives up consistency or availability; without partition it trades latency for consistency. | Each cross-boundary data flow records its choice (strong vs. eventual) and the user-visible consequence in `plan.md` | The artifact violates this rule in the affected surface. | llm | — |
| DS-2 | Every remote call has a timeout. | No unbounded waits; each timeout is shorter than the caller's own deadline; deadlines propagate downstream | The artifact violates this rule in the affected surface. | llm | — |
| DS-3 | Retries are bounded, backed off, jittered, and only on retryable failures. | Exponential backoff with jitter; max attempts set; no retry on validation/authorization errors; a retry budget prevents storms | The artifact violates this rule in the affected surface. | llm | — |
| DS-4 | Retried operations are idempotent. | Writes accept an idempotency key or are naturally idempotent (set, upsert by id); repeating a request yields the same outcome and no duplicate side effect | The artifact violates this rule in the affected surface. | llm | — |
| DS-5 | Assume at-least-once delivery. | Consumers deduplicate by message id or handle idempotently; "exactly-once" is only ever at-least-once + idempotency | The artifact violates this rule in the affected surface. | llm | — |
| DS-6 | State change and publish are atomic. | A state change and the event announcing it are not two independent writes; use a transactional outbox or equivalent | The artifact violates this rule in the affected surface. | llm | — |
| DS-7 | Eventual consistency is designed, not discovered. | Convergence time is bounded and stated; callers tolerate stale reads; multi-step workflows that can fail midway have compensations (saga) | The artifact violates this rule in the affected surface. | llm | — |
| DS-8 | Ordering is not free. | If order matters it is guaranteed per key and consumers handle gaps/out-of-order; otherwise handlers are order-independent | The artifact violates this rule in the affected surface. | llm | — |
| DS-9 | Single writer per data set. | Each data set has one owning service; others read via its contract or a replicated projection, never by writing its store | The artifact violates this rule in the affected surface. | llm | — |
| DS-10 | No shared databases across services. | Integration happens through contracts (APIs, events), not tables | The artifact violates this rule in the affected surface. | llm | — |
| DS-11 | Version everything that crosses a boundary. | APIs, events, and schemas carry versions; changes follow the compatibility rules in contract-design | The artifact violates this rule in the affected surface. | llm | — |
| DS-12 | Fail fast and contain. | Circuit breakers / bulkheads isolate a failing dependency; degraded behaviour is defined for non-critical dependencies | The artifact violates this rule in the affected surface. | llm | — |
| DS-13 | Don't trust clocks for ordering. | Ordering and conflict resolution use sequence numbers, versions, or logical clocks; wall-clock time is for display and TTLs | The artifact violates this rule in the affected surface. | llm | — |
| DS-14 | Observable across hops. | Every request/message carries a correlation or trace id; failures are logged with it (`idiom.logging`) | The artifact violates this rule in the affected surface. | llm | — |

## Interpreting

**Rules**

**Failure-mode checklist (per new remote interaction)**

| Question | Required answer |
|---|---|
| The call timed out but the server completed it — now what? | Retry is safe (DS-4) or reconciliation exists |
| The message is delivered twice? | Handler is idempotent (DS-5) |
| The dependency is down for 10 minutes? | Defined degraded behaviour or queued work (DS-12) |
| Step 2 of 3 fails? | Compensation or retry-until-done exists (DS-7) |
| The consumer is still on the old version? | The change is backward compatible (DS-11) |

**Consistency defaults**

| Need | Default |
|---|---|
| Money, inventory, uniqueness constraints | Strong consistency inside one owner (one aggregate, one transaction) |
| Cross-service views, notifications, analytics | Eventual consistency via events |
| Invariant spanning services | Redesign ownership first; saga with compensation second; distributed transaction last |

**Application note:** stack profiles define concrete commands and idioms; this foundation defines stack-agnostic intent.

## Tensions

| Rule A | Rule B | Default resolution |
|---|---|---|
| Simplicity | Explicit boundaries | Add boundaries only where change rate, ownership or risk justifies them. |

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/schemas/foundation.schema.md`: schema and required structure for this foundation.
- `copilot/frameworks/agentic-sdlc/schemas/_system.md`: shared rule-table, id, path and references rules.
- `foundations/design/distributed-systems.md`: this foundation file.

**External authoritative sources:**
- Eric Brewer, "Towards Robust Distributed Systems" (PODC 2000); Gilbert & Lynch, "Brewer's Conjecture and the Feasibility of Consistent, Available, Partition-Tolerant Web Services" (2002).
- Daniel Abadi, "Consistency Tradeoffs in Modern Distributed Database System Design" (IEEE Computer, 2012) — PACELC.
- Martin Kleppmann, *Designing Data-Intensive Applications* (2017).
- Michael Nygard, *Release It!* (2nd ed., 2018) — timeouts, circuit breakers, bulkheads.
- Peter Deutsch et al., "The Eight Fallacies of Distributed Computing".
- Chris Richardson, microservices.io — transactional outbox, saga.

## Related

- `domain-driven-design.md` — aggregates as consistency boundaries (DDD-7, DDD-11).
- `../quality/reliability.md` — the quality contract these rules serve.
- `../design/contract-design.md` — versioning and compatibility rules.
- `../code/error-handling.md` — classifying retryable vs. non-retryable failures.
