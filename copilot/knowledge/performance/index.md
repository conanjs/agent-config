---
schema: topic-index/v1
kind: topic
topic: performance
last-updated: 2026-11-07
---

# Performance engineering and optimization

How to reason about, measure and improve performance: latency percentiles and tail amplification, queueing and Little's law, Amdahl's law, the memory hierarchy, branch prediction, false sharing, benchmarking you can trust, profiling with perf and flame graphs, an optimization playbook keyed by bottleneck, and caching. Laws are checked by simulation and hardware effects by C benchmarks on an Apple M2 host running a Linux 6.17 VM. Start with `learning-path.md`. The 2026-11-07 English synthesis adds workload decisions, database tuning, load models, overload/coalescing, runtime/client and accelerator/data/cost catalogs plus three sourced cases. Start at [performance-map.md](performance-map.md) for scope, evidence limits and symptom routing; specialist domains are mapped rather than claimed exhaustive.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [learning-path.md](learning-path.md) | reference | Four stages — laws, hardware, measurement, optimization — with an exercise and a self-check per stage | verified |
| [sqlite-covering-index-lab.md](sqlite-covering-index-lab.md) | reference | SQLite 3.50.4 ordered top-k experiment | verified |
| [accelerator-data-and-cost.md](accelerator-data-and-cost.md) | reference | Accelerator, data and cost performance | draft |
| [architecture-selection.md](architecture-selection.md) | reference | Architecture choices by work cost | draft |
| [case-cache-gc.md](case-cache-gc.md) | case-study | Case study: a large cache and garbage collection | verified |
| [case-hot-partition.md](case-hot-partition.md) | case-study | Case study: hot partitions and request coalescing | verified |
| [case-ui-interaction.md](case-ui-interaction.md) | case-study | Case study: reducing interaction processing work | verified |
| [database-query-performance.md](database-query-performance.md) | concept | Query and data-path performance | draft |
| [load-testing-and-regression.md](load-testing-and-regression.md) | how-to | Load measurement and performance regression control | draft |
| [overload-and-coalescing.md](overload-and-coalescing.md) | concept | Bounding load and coalescing duplicate work | draft |
| [performance-map.md](performance-map.md) | reference | Performance knowledge and decision map | draft |
| [runtime-and-client-performance.md](runtime-and-client-performance.md) | reference | Measuring runtime and browser experience | draft |
| [join-group-and-deduplicate-under-memory-pressure.md](join-group-and-deduplicate-under-memory-pressure.md) | reference | Join, grouping and deduplication strategy under memory pressure | verified |

## Subtopics
| Subtopic | Summary |
|---|---|
| [fundamentals/](fundamentals/index.md) | Percentiles and fan-out tails; queueing and Little's law; Amdahl's law |
| [hardware/](hardware/index.md) | Caches and locality; branch prediction; false sharing |
| [measurement/](measurement/index.md) | Benchmarking methodology; profiling and flame graphs |
| [optimization/](optimization/index.md) | Optimization playbook; caching and hit ratio |

## References
- [Linux Performance](https://www.brendangregg.com/linuxperf.html) — Brendan Gregg, living. Backs: topic scope.

## Related
- `algorithms/` — complexity and data structures.
- `linux/system-management/performance-triage.md` — system-level triage.
