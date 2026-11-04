---
schema: topic-index/v1
kind: subtopic
topic: performance/fundamentals
last-updated: 2026-11-04
---

# Performance fundamentals

Latency percentiles and tail amplification, queueing and Little's law, and Amdahl's law — each checked by simulation or measurement. Not covered: the Universal Scalability Law.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [latency-percentiles-and-tail.md](latency-percentiles-and-tail.md) | concept | Latency is a distribution, not a number | verified |
| [queueing-and-littles-law.md](queueing-and-littles-law.md) | concept | **Little's law** says that, in a stable system, the average number of items inside (L) equals the arrival rate (λ) times the average time each spends inside (W): **L = λ·W** | verified |
| [amdahls-law-and-scalability.md](amdahls-law-and-scalability.md) | concept | If a fraction s of a job must run serially, adding N workers can speed it up at most 1 / (s + (1 − s)/N), and never more than 1/s however many workers you add | verified |

## References
- [Linux Performance](https://www.brendangregg.com/linuxperf.html) — Brendan Gregg, living. Backs: topic scope.

## Related
- `performance/learning-path.md` — where this subtopic sits in the learning order.
- `algorithms/` — complexity and data structures.
