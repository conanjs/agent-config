---
schema: topic-index/v1
kind: subtopic
topic: performance/measurement
last-updated: 2026-11-04
---

# Performance measurement

How to run benchmarks you can trust (dead-code elimination, warm-up, active benchmarking) and how to profile with perf and read flame graphs. Not covered: load-testing models.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [benchmarking-methodology.md](benchmarking-methodology.md) | how-to | Most benchmark mistakes measure the wrong thing: the optimizer deleting the work, a cold cache, noise from other processes, or a single lucky run | verified |
| [profiling-and-flame-graphs.md](profiling-and-flame-graphs.md) | concept | A profiler tells you **where** time goes, so you optimize the code that matters instead of the code you suspect | verified |

## References
- [Linux Performance](https://www.brendangregg.com/linuxperf.html) — Brendan Gregg, living. Backs: topic scope.

## Related
- `performance/learning-path.md` — where this subtopic sits in the learning order.
- `algorithms/` — complexity and data structures.
