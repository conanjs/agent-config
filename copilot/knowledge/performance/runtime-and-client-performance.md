---
schema: knowledge-doc/v1
type: reference
topic: performance
status: draft
applies-to: ["Go GC guide; Node.js; Core Web Vitals as checked 2026-11-07"]
last-verified: 2026-11-07
last-updated: 2026-11-07
tags: [performance, research-synthesis]
---

# Measuring runtime and browser experience

## Summary
**TL;DR:** Distinguish computation, waiting and browser painting time. A fast backend response does not ensure a responsive interface; high memory use alone does not establish a leak.
**Use this when:** low CPU utilization with slow responses, garbage-collection spikes, event-loop delays or sluggish pages.

## Scope
A runtime is the environment executing a program, like a coordinator of work and memory. Allocation creates new storage; retained heap is the part still kept alive. For example, `cache.set(id, largeObject)` retains data across requests, unlike a temporary object discarded after each request. A garbage collector (GC) reclaims unused storage; runtime memory is not necessarily all process memory.

## Catalog

| Symptom / concept | Verified mechanism | Experiments and trade-offs |
|---|---|---|
| Go GC / heap | ✅ [Go guide](https://go.dev/doc/gc-guide): GOGC adjusts the heap-growth target; GOMEMLIMIT is a soft limit for runtime-managed memory; a limit near the live heap can cause thrashing | Compare allocations/s, retained heap, GC CPU/pauses, process peak and p99; a larger heap trades memory for less collection |
| Busy event loop | ✅ [Node.js](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop): long callbacks block the loop; long tasks block their worker pool; `async` does not make synchronous computation parallel | Chunking/workers add scheduling, copying and queue costs; measure end-to-end time rather than worker duration alone |
| CPU is not busy but latency is high | ✅ [Off-CPU analysis](https://www.brendangregg.com/offcpuanalysis.html) examines threads waiting for input/output, locks, sleep or scheduling | Classify intentional waits; not all sleep is removable work |
| Service monitoring | ✅ [SRE monitoring](https://sre.google/sre-book/monitoring-distributed-systems/) uses latency, traffic, errors and saturation; fast failures can lower the average | Separate success/error paths and check business content |
| Largest Contentful Paint (LCP) | ✅ [Web Vitals](https://web.dev/articles/vitals): good at ≤2.5 seconds | Break down server delay, resources and rendering; prioritizing the main resource changes cache/transfer costs |
| Interaction to Next Paint (INP) | ✅ [Web Vitals](https://web.dev/articles/vitals): good at ≤200 ms | Reduce main-thread work and split tasks; measure real devices and field distributions |
| Cumulative Layout Shift (CLS) | ✅ [Web Vitals](https://web.dev/articles/vitals): good at ≤0.1; all three metrics are evaluated at the 75th percentile, separating mobile and desktop | Reserve image/content space; check layout and usability |

| Profiling question | Artifact to retain | Mistake to avoid |
|---|---|---|
| Which function consumes CPU? | Sampled CPU profile, version, workload | Treating flame-graph width as wall time when it represents CPU samples |
| Where does work wait? | Blocked stacks, pool wait, lock wait, input/output latency | Blaming the algorithm when the connection pool is full |
| Does memory grow from creation or retention? | Allocation profile + heap snapshots over time | Confusing allocation pressure with a leak |
| Does the user wait after network completion? | Browser trace from input to paint | Treating API time as interaction time |

## Lookup notes
API expands to Application Programming Interface. Illustrative timing artifact: `request 40 ms + parse 80 ms + render 60 ms`, before queueing; receiving the response is not the same as completing the paint. These are invented example values, not measurements.

⚠️ unverified: payload reduction, chunking, more workers and heap-target changes are candidates for a specific workload. Measure effects on other parts too: smaller payloads can increase request count, larger caches increase live heap, and more workers add copying/queueing. Do not infer server capacity from a browser laboratory score.

## Takeaways
- Distinguish work, waiting and painting before choosing tools.
- Consider memory, latency and correctness together.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 7 claims (✅) · Unverified: 1 claim (⚠️) · Last verified: 2026-11-07

## References
- [A guide to the Go garbage collector](https://go.dev/doc/gc-guide) — Go project, living. Backs: heap/memory tradeoffs.
- [Don't block the event loop](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop) — Node.js, living. Backs: scheduling.
- [Off-CPU analysis](https://www.brendangregg.com/offcpuanalysis.html) — Brendan Gregg, living. Backs: waiting analysis.
- [Monitoring distributed systems](https://sre.google/sre-book/monitoring-distributed-systems/) — Google SRE, 2016. Backs: four signals.
- [Web Vitals](https://web.dev/articles/vitals) — web.dev, living. Backs: user metrics and thresholds.
- [Profiles and flame graphs](measurement/profiling-and-flame-graphs.md) — local profiling foundation.

## Related
- [Cache/GC case](case-cache-gc.md)
- [UI case](case-ui-interaction.md)
