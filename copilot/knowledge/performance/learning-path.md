---
schema: knowledge-doc/v1
type: reference
topic: performance
status: verified
applies-to: ["the docs under knowledge/performance/ as of 2026-11-04"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [performance, optimization, learning-path, curriculum]
---

# Performance engineering learning path

## Summary
**TL;DR:** Four stages: the laws that govern performance (percentiles, queueing, Amdahl), the hardware that sets the constants (caches, branch prediction, false sharing), how to measure without fooling yourself (benchmarking, profiling), and how to choose an optimization (playbook, caching). Each doc contains a benchmark or simulation you can rerun in the Linux lab.
**Use this when:** you start learning performance engineering or want the next doc to read.
**Not this doc:** algorithmic complexity → `algorithms/learning-path.md`; system triage → `linux/system-management/performance-triage.md`.

## Scope
The v1 docs under `knowledge/performance/`. Prerequisite: `algorithms/fundamentals/complexity-and-big-o.md`.

## Catalog

### Stages

| # | Stage | Read | Exercise (Linux lab) | Self-check: you can explain … |
|---|---|---|---|---|
| 1 | Laws | `fundamentals/latency-percentiles-and-tail.md` → `fundamentals/queueing-and-littles-law.md` → `fundamentals/amdahls-law-and-scalability.md` | Simulate a single-server queue at 50/80/90/95% load | … why p99 matters more than the mean, why 95% utilization hurts, and the 1/s speed-up ceiling |
| 2 | Hardware | `hardware/memory-hierarchy-and-caches.md` → `hardware/branch-prediction.md` → `hardware/false-sharing.md` | Row vs column matrix sum; sorted vs unsorted branch; padded vs packed counters | … why identical operation counts can differ 4–6× |
| 3 | Measurement | `measurement/benchmarking-methodology.md` → `measurement/profiling-and-flame-graphs.md` | Compile a loop at `-O0` and `-O2`; `perf record` a benchmark | … dead-code elimination, and how to read a flame graph |
| 4 | Optimization | `optimization/optimization-playbook.md` → `optimization/caching.md` | Measure LRU hit ratio vs size on a skewed key stream | … which technique fits which bottleneck, and effective latency |
| → | In production | `linux/system-management/performance-triage.md`, `kubernetes/cpu-limits-and-throttling.md` | Triage a CPU-limited container | … CPU saturation vs CPU quota throttling |

### Free, authoritative resources

| Resource | Why |
|---|---|
| [Brendan Gregg's Linux performance page](https://www.brendangregg.com/linuxperf.html) | Methods (USE, active benchmarking) and tools |
| [Google SRE book](https://sre.google/sre-book/table-of-contents/) | SLOs, percentiles, overload handling |
| [What Every Programmer Should Know About Memory](https://www.akkadia.org/drepper/cpumemory.pdf) | CPU caches in depth |

### Not yet covered in this knowledge base

| Topic | Fits under | Start with |
|---|---|---|
| Garbage collection and allocator behaviour | new `runtime/` subtopic | language runtime docs |
| Load testing (open vs closed models, coordinated omission) | `measurement/` | load tool documentation |
| Database query optimization | `optimization/` | database EXPLAIN docs |
| SIMD / vectorization | `hardware/` | compiler auto-vectorization docs |
| Universal Scalability Law (contention + coherence) | `fundamentals/` | Neil Gunther's publications |

## Lookup notes
- All measurements come from one machine (Apple M2 host, Linux 6.17 VM); hardware-specific numbers (latencies, cache-line effects) will differ elsewhere — the ratios and shapes are the lesson.

## Takeaways
- Learn the laws first: they predict where performance work pays off.
- Rerun every benchmark yourself; reproducing the effect is the self-check.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 0 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Linux Performance](https://www.brendangregg.com/linuxperf.html) — Brendan Gregg, living. Backs: resources table.
- [Site Reliability Engineering](https://sre.google/sre-book/table-of-contents/) — Google, 2016. Backs: resources table.
- [What Every Programmer Should Know About Memory](https://www.akkadia.org/drepper/cpumemory.pdf) — Ulrich Drepper, 2007. Backs: resources table.
- `linux/lab-setup.md` — the lab every exercise runs in.

## Related
- `algorithms/learning-path.md`
- `linux/learning-path.md`
