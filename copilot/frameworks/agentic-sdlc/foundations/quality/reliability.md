---
schema: foundation/v2
last-updated: 2026-10-04
rule-prefix: Q-REL
subject: quality
---

# Reliability

ISO/IEC 25010 quality contract: the product performs specified functions under specified conditions for a specified period, and recovers when it doesn't. Reviews cite `Q-REL-n`.

## Rules

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| Q-REL-1 | Availability and latency objectives (SLOs) are stated for user-facing services, with an error budget | `spec.md` / `plan.md` | No evidence shows the rule holds. | llm | — |
| Q-REL-2 | Every remote call has a timeout and bounded retry policy (`../design/distributed-systems.md`, DS-2, DS-3) | Code/config review | No evidence shows the rule holds. | llm | — |
| Q-REL-3 | Retried writes and message handlers are idempotent (DS-4, DS-5) | Code review + duplicate-delivery test | No evidence shows the rule holds. | llm (fallback) | — |
| Q-REL-4 | Behaviour when each non-critical dependency is unavailable is defined and tested (degrade, queue, or fail fast) | Integration test | No evidence shows the rule holds. | llm (fallback) | — |
| Q-REL-5 | No error is silently swallowed; every caught failure is handled, translated, or propagated (`../code/error-handling.md`) | Code review | No evidence shows the rule holds. | llm | — |
| Q-REL-6 | Resource lifetimes are bounded: connections, files, locks, and background tasks are released/cancelled on all paths | Code review (`idiom.concurrency`) | No evidence shows the rule holds. | llm | — |
| Q-REL-7 | The service exposes liveness and readiness signals that reflect real ability to serve | Health endpoint / config | No evidence shows the rule holds. | llm | — |
| Q-REL-8 | Shutdown is graceful: in-flight work drains or is safely re-delivered | Code review | No evidence shows the rule holds. | llm | — |
| Q-REL-9 | Schema/data migrations are backward compatible (expand-then-contract) and reversible or forward-fixable | `../delivery/release-pipeline.md` | No evidence shows the rule holds. | llm | — |
| Q-REL-10 | Every release has a tested rollback path (redeploy previous version or disable flag) | Pipeline definition | No evidence shows the rule holds. | llm (fallback) | — |
| Q-REL-11 | Persistent data has backups with a stated RPO/RTO, and restore has been exercised | Ops runbook | No evidence shows the rule holds. | llm | — |
| Q-REL-12 | Failures are observable: error rate, latency, and saturation are measured and alertable | Dashboards / alerts config | No evidence shows the rule holds. | llm | — |

## Interpreting

**Definition**

Reliability is the degree to which the product keeps working (and keeps data correct) despite faults in itself, its dependencies, and its environment — and returns to a correct state quickly after a failure.

**Sub-characteristics**

| Sub-characteristic | Question it answers |
|---|---|
| **Faultlessness** (maturity) | Does it work correctly under normal operation? |
| **Availability** | Is it operational and accessible when required? |
| **Fault tolerance** | Does it keep operating as intended despite hardware/software/dependency faults? |
| **Recoverability** | Can it recover data and re-establish the desired state after an interruption? |

**Checks — an artifact satisfies this when…**

**Failure severity defaults**

| Situation | Severity |
|---|---|
| Missing timeout on a remote call; non-idempotent retried write (Q-REL-2, 3) | `blocker` |
| Swallowed error (Q-REL-5); leaked resource (Q-REL-6) | `major` |
| Non-backward-compatible migration (Q-REL-9) | `blocker` |
| No rollback path (Q-REL-10) | `major` |
| Missing health signal or metrics (Q-REL-7, 12) | `minor` (`major` for production services) |

**Application note:** stack profiles define concrete commands and idioms; this foundation defines stack-agnostic intent.

## Tensions

| Rule A | Rule B | Default resolution |
|---|---|---|
| Quality bar | Delivery speed | Do not waive blocker or major quality failures; record accepted lower-risk trade-offs. |

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/schemas/foundation.schema.md`: schema and required structure for this foundation.
- `copilot/frameworks/agentic-sdlc/schemas/_system.md`: shared rule-table, id, path and references rules.
- `foundations/quality/reliability.md`: this foundation file.

**External authoritative sources:**
- ISO/IEC 25010:2023, *Product quality model* — reliability.
- Beyer, Jones, Petoff, Murphy (eds.), *Site Reliability Engineering* (Google, 2016) — SLOs, error budgets.
- Michael Nygard, *Release It!* (2nd ed., 2018).

## Related

- `functional-suitability.md`, `maintainability.md`, `performance-efficiency.md`, `security.md` — sibling quality contracts.
- `../design/distributed-systems.md` — the rules most reliability checks derive from.
- `../code/error-handling.md`, `../delivery/release-pipeline.md`
