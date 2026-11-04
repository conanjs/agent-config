---
schema: topic-index/v1
kind: subtopic
topic: performance/optimization
last-updated: 2026-11-04
---

# Optimization

A playbook mapping measured bottlenecks to techniques with lab effect sizes, and caching (hit ratio, LRU, cache-aside). Not covered: database query tuning, GC tuning.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [optimization-playbook.md](optimization-playbook.md) | reference | A lookup table that maps a **measured** bottleneck to the techniques that address it, with the size of effect seen in this knowledge base's lab measurements and the doc that explains each | verified |
| [caching.md](caching.md) | concept | A cache keeps copies of expensive results close to where they are used | verified |

## References
- [Linux Performance](https://www.brendangregg.com/linuxperf.html) — Brendan Gregg, living. Backs: topic scope.

## Related
- `performance/learning-path.md` — where this subtopic sits in the learning order.
- `algorithms/` — complexity and data structures.
