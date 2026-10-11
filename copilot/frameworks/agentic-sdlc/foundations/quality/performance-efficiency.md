---
schema: foundation/v2
last-updated: 2026-10-04
rule-prefix: Q-PERF
subject: quality
---

# Performance Efficiency

ISO/IEC 25010 quality contract: performance relative to the resources used under stated conditions. Reviews cite `Q-PERF-n`.

## Rules

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| Q-PERF-1 | Every performance requirement in `spec.md` is stated as *metric + percentile + load + data volume* (e.g. "p95 < 300 ms at 50 rps with 1M rows") | Spec text | No evidence shows the rule holds. | llm | — |
| Q-PERF-2 | No query or remote call executes inside a loop over an unbounded collection (N+1) | Code review | No evidence shows the rule holds. | llm | — |
| Q-PERF-3 | Every list/search endpoint or query is paginated or bounded; no unbounded result sets | Contract + code | No evidence shows the rule holds. | llm | — |
| Q-PERF-4 | Queries on hot paths are backed by an index or access path that fits the filter/sort; the plan records which | `data-model.md` / review | No evidence shows the rule holds. | llm | — |
| Q-PERF-5 | Blocking I/O is not performed on a thread/event loop that serves other requests (`idiom.concurrency`) | Code review | No evidence shows the rule holds. | llm | — |
| Q-PERF-6 | Pools (connections, workers) and buffers have explicit upper bounds | Config review | No evidence shows the rule holds. | llm | — |
| Q-PERF-7 | Large payloads are streamed or chunked, not loaded entirely into memory, above a stated size | Code review | No evidence shows the rule holds. | llm | — |
| Q-PERF-8 | Caches have a stated invalidation strategy and TTL; a cache is never the only copy of data | `plan.md` | No evidence shows the rule holds. | llm | — |
| Q-PERF-9 | Where `spec.md` states a load target, a repeatable load test exists and its last result is recorded against the target | Test report | No evidence shows the rule holds. | llm (fallback) | — |
| Q-PERF-10 | Optimizations that reduce readability cite a measurement (before/after) | Commit/PR note | No evidence shows the rule holds. | llm | — |

## Interpreting

**Definition**

Performance efficiency is the degree to which the product meets its time, throughput, and resource targets at the stated load. A performance requirement without a number, a percentile, and a load condition is not checkable and is sent back to product-spec.

**Sub-characteristics**

| Sub-characteristic | Question it answers |
|---|---|
| **Time behaviour** | Are response time, latency, and throughput within target at the stated load? |
| **Resource utilization** | Are CPU, memory, storage, network, and connections used within budget? |
| **Capacity** | Does the system meet its targets at the maximum stated load / data volume? |

**Checks — an artifact satisfies this when…**

**Principles**

- **Measure before optimizing.** Without a stated target (Q-PERF-1) or a measurement, prefer the clearer design (`../design/design-principles.md`, DP-7).
- **Algorithmic complexity first.** Quadratic work over user-controlled sizes is a defect regardless of current data volume.
- **Budgets travel with the request.** Latency budgets are split across hops and enforced by timeouts (`../design/distributed-systems.md`, DS-2).

**Failure severity defaults**

| Situation | Severity |
|---|---|
| Stated target demonstrably missed | `blocker` |
| Unbounded query/result set on a public endpoint (Q-PERF-3) | `major` |
| N+1 on a hot path (Q-PERF-2) | `major` |
| Missing measurement for a readability-reducing optimization (Q-PERF-10) | `minor` |

**Application note:** stack profiles define concrete commands and idioms; this foundation defines stack-agnostic intent.

## Tensions

| Rule A | Rule B | Default resolution |
|---|---|---|
| Quality bar | Delivery speed | Do not waive blocker or major quality failures; record accepted lower-risk trade-offs. |

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/schemas/foundation.schema.md`: schema and required structure for this foundation.
- `copilot/frameworks/agentic-sdlc/schemas/_system.md`: shared rule-table, id, path and references rules.
- `foundations/quality/performance-efficiency.md`: this foundation file.

**External authoritative sources:**
- ISO/IEC 25010:2023, *Product quality model* — performance efficiency.
- Brendan Gregg, *Systems Performance* (2nd ed., 2020) — USE method.
- Google SRE Book, ch. 4 "Service Level Objectives".

## Related

- `functional-suitability.md`, `maintainability.md`, `reliability.md`, `security.md` — sibling quality contracts.
- `../design/distributed-systems.md` — timeouts and backpressure.
- `../delivery/testing-strategy.md` — where load tests fit.
- `../review/fitness-functions.md` — performance budgets as automated checks.
