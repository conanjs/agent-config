---
schema: knowledge-doc/v1
type: reference
topic: performance
status: draft
applies-to: ["Cross-layer software performance; research synthesis 2026-11-07"]
last-verified: 2026-11-07
last-updated: 2026-11-07
tags: [performance, research-synthesis]
---

# Performance knowledge and decision map

## Summary
**TL;DR:** Performance is constrained optimization: correct results, appropriate timing, enough capacity, and resource and monetary budgets. This map connects existing foundations with additions on workloads, databases, overload, load testing, runtimes, clients and accelerators.
**Use this when:** starting to learn, choosing a document by symptom or identifying researched and unresearched scope.

## Scope
There is no workload-independent "fastest" solution. Think of choosing transportation: the vehicle carrying the most freight does not always arrive first. Minimum contract artifact: `correct result + p99≤budget + useful throughput≥target + memory/cost≤limits`. Specific values belong to the product; one threshold does not fit everything.

The 2026-11-07 additions are listed in the Catalog below and in the [performance index](index.md); existing foundations retain their own content and measurement dates. "Verified" means checked against a source, not benchmarked on the reader's machine. "Draft" in recommendation catalogs means that effectiveness on the target workload still requires validation.

## Catalog

| Layer / problem | Where to read | Coverage |
|---|---|---|
| Complexity, amortized cost, array/hash/tree/heap | [Algorithms learning path](../algorithms/learning-path.md) | Existing foundations; prior labs retain measurement dates |
| Sorting, graphs, dynamic programming/greedy | [Algorithms index](../algorithms/index.md) | Existing foundations |
| Representation selection, top-k, CSR, SIMD, incremental computation | [Workload selection](../algorithms/workload-selection.md) | Added decision tables and artifacts |
| Membership, distinct counts, heavy hitters, approximate streams | [Streaming](../algorithms/streaming-and-approximation.md) | Added mechanisms, error contracts and examples |
| Percentiles, queueing, Little/Amdahl | [Fundamentals](fundamentals/index.md) | Existing foundations |
| Memory hierarchy, locality, branches, false sharing | [Hardware](hardware/index.md) | Existing foundations |
| Microbenchmarks, CPU profiling | [Measurement](measurement/index.md) | Existing foundations |
| Load models, omitted arrivals, histograms, regressions | [Load workflow](load-testing-and-regression.md) | Added commands/configuration/expected checks; unexecuted |
| SQL/index/N+1/pagination/replication/compaction | [Database](database-query-performance.md) | Added mechanisms and SQL input/output; SQL unexecuted |
| Cache, queue, backpressure, retries, coalescing | [Overload](overload-and-coalescing.md) | Added flow and failure interactions; cache basics remain in [caching](optimization/caching.md) |
| Service boundaries, batches, shards, replicas | [Architecture](architecture-selection.md) | Added decisions by workload and cost |
| GC, event loops, waiting, frontend | [Runtime/client](runtime-and-client-performance.md) | Added symptoms, measurements and Web Vitals |
| GPU/inference/training/data/cost/carbon | [Accelerator/data/cost](accelerator-data-and-cost.md) | Choice and method catalog; no model/hardware benchmark |
| Real cases | [Cache/GC](case-cache-gc.md), [hot partition](case-hot-partition.md), [UI interaction](case-ui-interaction.md) | Sourced historical reports; not remeasured |

| Symptom | Measure first | Investigation / counterexample |
|---|---|---|
| Slow with large inputs | Scaling with n, rows/bytes touched | Algorithms/representation; micro-optimization does not fix the wrong growth rate |
| High CPU | CPU profiles, cycles/item, allocation | Less work, locality, vectorization; more workers add overhead |
| Low CPU but high latency | Pool/lock/queue/input-output waits | Dependencies and admission; more CPU may not help |
| Growing tails under load | Offered/achieved load, queue age, p99 | Saturation; closed load can hide the issue |
| Growing memory | Allocation versus retained heap, cache size | Lifetimes/representation; a smaller cache can increase database load |
| One slow tenant/key | Per-key/tenant distributions | Skew, quotas, coalescing; averages hide unfairness |
| Fast backend, sluggish interface | Input-to-paint and main-thread traces | Payload/rendering, not only the API |
| Lower hourly price, higher total bill | Cost/correct operation | Useful throughput, retries, idle time and headroom |

| Specialist branch identified but not covered deeply in this synthesis | Questions for further workload-specific research |
|---|---|
| Suffix and spatial indexes, union-finds | Query/update mix, size, error/ordering contract |
| Vector database internals | Recall/latency/memory on actual datasets |
| NUMA, Roofline, high-performance computing interconnects | Memory locality, bandwidth, arithmetic intensity, communication |
| Hard real-time, embedded/mobile battery, frame pacing | Worst-case deadlines, power boundary, thermal/device behavior |
| Multi-region consensus, RDMA, kernel bypass, storage firmware | Consistency/durability, network topology, failure assumptions |
| Compiler internals and advanced compression | Target architecture, data distribution, code-generation evidence |

## Lookup notes
✅ [SRE monitoring](https://sre.google/sre-book/monitoring-distributed-systems/) treats latency, traffic, errors and saturation together. The proposed practical path is therefore: business outcome → contract → baseline → profile → one hypothesis → one change → remeasure → controlled rollout. This explains how to use the collection, not a promise that every technique improves performance.

Learning path: start with fundamentals and algorithms, then hardware/measurement, then database/overload, and finally runtime/client or accelerators according to the system. Troubleshooting path: start with the symptom table, open the relevant document, retain raw artifacts and compare the corresponding case. Reading everything is not a prerequisite for solving one problem.

⚠️ unverified: no user workload or new benchmark is available to select a specific optimal worker count, cache size, index, batch or architecture. Illustrative calculations are labeled; historical numbers belong to their sources; branches that are merely identified must not be treated as fully researched.

## Takeaways
- Start with correct results and constraints, then choose techniques.
- Use the map to distinguish evidence, illustrations and areas requiring deeper research.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 1 claim (✅) · Unverified: 1 claim (⚠️) · Last verified: 2026-11-07

## References
- [Monitoring distributed systems](https://sre.google/sre-book/monitoring-distributed-systems/) — Google SRE, 2016. Backs: performance signals.
- [Performance index](index.md) — local topic catalog.
- [Algorithms index](../algorithms/index.md) — local algorithm foundations.

## Related
- [SQLite covering index experiment](sqlite-covering-index-lab.md)
- [Vector search evaluation](../algorithms/vector-search-evaluation.md)
- [Original performance learning path](learning-path.md)
- [Architecture choices](architecture-selection.md)
