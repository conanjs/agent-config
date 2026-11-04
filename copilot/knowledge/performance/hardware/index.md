---
schema: topic-index/v1
kind: subtopic
topic: performance/hardware
last-updated: 2026-11-04
---

# Hardware effects

The memory hierarchy and cache locality, branch prediction and branchless code, and false sharing between threads, measured on an Apple M2 host. Not covered: SIMD, NUMA.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [memory-hierarchy-and-caches.md](memory-hierarchy-and-caches.md) | concept | A CPU core can finish an operation in well under a nanosecond, but a load from main memory (DRAM) takes on the order of 100 ns | verified |
| [branch-prediction.md](branch-prediction.md) | concept | CPUs start executing instructions before they know which way an `if` goes, guessing with a **branch predictor** | verified |
| [false-sharing.md](false-sharing.md) | concept | Caches keep whole **cache lines** coherent across cores | verified |

## References
- [Linux Performance](https://www.brendangregg.com/linuxperf.html) — Brendan Gregg, living. Backs: topic scope.

## Related
- `performance/learning-path.md` — where this subtopic sits in the learning order.
- `algorithms/` — complexity and data structures.
