---
schema: knowledge-doc/v1
type: reference
topic: performance/optimization
status: verified
applies-to: ["application and service performance work in any language"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [performance, optimization, playbook, techniques, algorithmic, caching, batching, data-layout, concurrency]
---

# Optimization playbook: techniques by bottleneck

## Summary
**TL;DR:** A lookup table that maps a **measured** bottleneck to the techniques that address it, with the size of effect seen in this knowledge base's lab measurements and the doc that explains each. The order of work is always: measure → find the dominant cost → apply the cheapest technique that removes it → measure again.
**Use this when:** a profile or triage has identified what is slow and you need options, or you want to know the typical size of a win before investing.
**Not this doc:** how to find the bottleneck → `measurement/profiling-and-flame-graphs.md`, `linux/system-management/performance-triage.md`.

## Scope
Single-process and service-level techniques. Effect sizes are lab measurements from the linked docs (one machine, 2026-11-04) and indicate orders of magnitude, not promises.

## Catalog

### Technique by bottleneck

| Bottleneck (measured) | Technique | Lab effect | Explained in |
|---|---|---|---|
| Wrong growth rate (O(n²), O(n) lookups in loops) | Better algorithm or data structure (hash set, index, heap) | List scan → set: 269 ms → 0.04 ms for 1 000 lookups at n = 100 000 ✅[^1] | `algorithms/fundamentals/complexity-and-big-o.md` |
| Full table scans | Database index (B-tree) | 3 583 ms → 0.50 ms for 200 lookups in 1 M rows ✅[^1] | `algorithms/data-structures/trees-heaps-and-b-trees.md` |
| Sorting everything to take a few | Heap / partial selection | 158 ms → 8.5 ms (top 10 of 1 M) ✅[^1] | same |
| Repeated identical computation | Memoization / caching | Fibonacci(27): 635 621 calls → 28 ✅[^1] | `algorithms/techniques/dynamic-programming-and-greedy.md`, `optimization/caching.md` |
| Remote calls with skewed keys | Cache-aside with LRU | Effective latency 50 → 17 ms at 67% hit ratio (simulated) ✅[^1] | `optimization/caching.md` |
| Cache-unfriendly memory access | Sequential layout, loop order, contiguous arrays | Column → row order: 4.0× ✅[^1] | `hardware/memory-hierarchy-and-caches.md` |
| Unpredictable branches in hot loops | Sort/partition data, branchless code | 4.9× ✅[^1] | `hardware/branch-prediction.md` |
| Threads slowing each other without locks | Pad per-thread data to the cache line | 0.45 s → 0.07 s ✅[^1] | `hardware/false-sharing.md` |
| CPU-bound and parallelizable | More threads/workers, bounded by the serial fraction | 4.03× on 8 threads with 10% serial ✅[^1] | `fundamentals/amdahls-law-and-scalability.md` |
| High utilization, rising latency | Add capacity or reduce work per request; keep utilization below the knee | 90% → 95% busy doubled mean latency ✅[^1] | `fundamentals/queueing-and-littles-law.md` |
| Fan-out tail latency | Hedged requests, fewer backends per request, per-backend tail budgets | 100-way fan-out: 63% of requests see a backend's p99 ✅[^1] | `fundamentals/latency-percentiles-and-tail.md` |
| Event loop or thread blocked on I/O | Async I/O (epoll/io_uring), move blocking work off the loop | — | `linux/networking/io-multiplexing-epoll-io-uring.md` |
| Container CPU quota throttling | Raise the limit or reduce parallelism to the quota | — | `kubernetes/cpu-limits-and-throttling.md` |

### Order of operations

| Step | Action | Why |
|---|---|---|
| 1 | Reproduce and measure (benchmark or production metrics) | Establish a baseline you trust |
| 2 | Profile / triage to find the dominant cost | Avoid optimizing what does not matter ✅[^2] |
| 3 | Fix growth rate and I/O patterns first | Largest wins in the table above ✅[^1] |
| 4 | Then data layout and micro-architecture | Smaller, hardware-specific wins ✅[^1] |
| 5 | Re-measure under the same conditions | Confirm and guard against regressions |

## Lookup notes
- Effects compound in the order of the table: an O(n²) algorithm with perfect cache behaviour still loses to an O(n log n) one at scale.
- Micro-architectural results (cache line size, branch behaviour) are CPU-specific; the lab host was an Apple M2 with 128-byte cache lines ✅[^3].

## Takeaways
- Fix the growth rate before micro-optimizing. [rule-candidate]
- Pick a technique only after the profile names the bottleneck; re-measure every change.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 15 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- `linux/lab-setup.md` — the lab (Linux 6.17.8 VM on an Apple M2 host, Python 3.12.13, GCC 13.2.1) where every effect size in the table was measured on 2026-11-04; details in the linked docs. [^1]
- [Active Benchmarking](https://www.brendangregg.com/activebenchmarking.html) — Brendan Gregg, living. Backs: identify the real limiter before drawing conclusions. [^2]
- Host measurement, 2026-11-04 — `sysctl hw.cachelinesize` = 128 on the macOS host (Apple M2). [^3]

## Related
- `performance/learning-path.md`
- `algorithms/learning-path.md`
- `linux/system-management/performance-triage.md`
