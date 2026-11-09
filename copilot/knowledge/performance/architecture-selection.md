---
schema: knowledge-doc/v1
type: reference
topic: performance
status: draft
applies-to: ["General service architecture; Kafka 4.0"]
last-verified: 2026-11-07
last-updated: 2026-11-07
tags: [performance, research-synthesis]
---

# Architecture choices by work cost

## Summary
**TL;DR:** A suitable architecture reduces work and data movement on the critical path. More parallelism, service boundaries or queues help only when coordination costs and data contracts remain appropriate.
**Use this when:** choosing synchronous/asynchronous processing, batching, replicas, partitioning or computation near data.

## Scope
The critical path is the chain of work that determines when a result becomes available, like the required road segments of a journey. Illustrative artifact: `client→service A→service B→database`; shortening one segment does not remove waiting elsewhere. There is no universally fastest ranking of monoliths and microservices.

## Catalog

| Workload shape | Architecture candidate | Suitable conditions | Costs / measurements |
|---|---|---|---|
| Many sequential calls fetching little data | Combine calls or move computation near data | Round trips can be reduced without fetching excessive data | Coupling, payload, serialization; measure end-to-end time and bytes |
| Many independent tasks waiting on the network | Bounded concurrency | Dependencies have headroom; a shared deadline | Connections, queues, p99, fairness |
| Divisible CPU-bound work | Worker pool or parallel execution | Tasks are large enough to repay dispatch/copy costs | CPU/item, transfers, serial fraction; [Amdahl](fundamentals/amdahls-law-and-scalability.md) |
| Work whose result is not required immediately | Queue + workers | Users accept delayed completion | Queue age, completion latency, duplicate/loss semantics |
| Read-heavy with tolerable delay | Replica/read model | Freshness and read-after-write behavior are defined | Lag, storage, rebuilding, failover |
| Evenly distributed data/keys | Sharding, partitioning data by key | Queries can be routed and data rebalanced | Cross-shard queries, skew, transactions |
| One very hot key/tenant | Coalescing, quotas, correctly scoped caches | Duplicate work exists or freshness permits caching | Sharding does not automatically split one key; measure requests/key |
| Many rows but few columns | Columnar layout, pruning, preaggregation | Queries can select regions/columns | Update cost, freshness, bytes scanned |
| Many repeated small tasks | Batching or fusion of passes | Work can be combined within the latency contract | Wait-to-fill, memory, failure scope |

| Architecture evidence | Verified behavior | Interpretation limits |
|---|---|---|
| Tail-tolerant systems | ✅ [The Tail at Scale](https://research.google/pubs/the-tail-at-scale/) explains how slow component tails affect distributed requests | Do not add stage p99 values to obtain request p99; hedging adds load |
| Log streaming | ✅ [Kafka 4.0 design](https://kafka.apache.org/40/design/design/) combines page cache, batching and compression; this version does not use the sendfile path when SSL is enabled | Zero-copy does not mean every transport path avoids copies; SSL expands to Secure Sockets Layer, the historical security label used by the documentation |
| Capacity | ✅ [Handling overload](https://sre.google/sre-book/handling-overload/) explains that requests have different costs | Requests/second alone is not a capacity model |

## Lookup notes
⚠️ unverified: every candidate in the first table needs a benchmark with the actual workload. A minimum experiment holds data size, key skew, payload, durability and freshness constant; measure useful completed operations/s, p50/p95/p99, retries, rejections, queue age, bytes and cost.

Hypothetical example: application processing takes 10 ms and waiting for the database takes 100 ms. Reducing application processing to 5 ms saves 5 out of 110 ms, about 4.5%, although the function itself is twice as fast. If increased concurrency adds 20 ms of queueing, the local gain becomes an end-to-end regression. These are illustrative calculations, not measurements.

Compression packs data like folding clothes to save space: fewer transferred bytes, but more CPU and memory work. Batching resembles transporting several parcels in one trip: less overhead per trip, but the first arrival may have to wait. Always compare the same payload and latency target.

## Takeaways
- Measure the whole path to the result, including waiting and transfers.
- Hold freshness, durability and correctness constant when comparing architectures.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 3 claims (✅) · Unverified: 1 claim (⚠️) · Last verified: 2026-11-07

## References
- [The Tail at Scale](https://research.google/pubs/the-tail-at-scale/) — Dean and Barroso, 2013. Backs: distributed tail effects.
- [Design](https://kafka.apache.org/40/design/design/) — Apache Kafka 4.0. Backs: batching/copy path.
- [Handling overload](https://sre.google/sre-book/handling-overload/) — Google SRE, 2016. Backs: resource-based capacity.
- [Amdahl's law](fundamentals/amdahls-law-and-scalability.md) — local scaling foundation.

## Related
- [Database](database-query-performance.md)
- [Overload](overload-and-coalescing.md)
- [Algorithms](../algorithms/workload-selection.md)
