---
schema: topic-index/v1
kind: topic
topic: performance
last-updated: 2026-11-04
---

# Performance engineering and optimization

How to reason about, measure and improve performance: latency percentiles and tail amplification, queueing and Little's law, Amdahl's law, the memory hierarchy, branch prediction, false sharing, benchmarking you can trust, profiling with perf and flame graphs, an optimization playbook keyed by bottleneck, and caching. Laws are checked by simulation and hardware effects by C benchmarks on an Apple M2 host running a Linux 6.17 VM. Start with `learning-path.md`. Not covered: GC tuning, load-testing models, database query tuning.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [learning-path.md](learning-path.md) | reference | Four stages — laws, hardware, measurement, optimization — with an exercise and a self-check per stage | verified |

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
