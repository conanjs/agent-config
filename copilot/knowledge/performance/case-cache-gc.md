---
schema: knowledge-doc/v1
type: case-study
topic: performance
status: verified
applies-to: ["Historical read-state service, report 2020"]
last-verified: 2026-11-07
last-updated: 2026-11-07
tags: [performance, research-synthesis]
---

# Case study: a large cache and garbage collection

## Summary
**TL;DR:** A large cache reduces queries but increases the live data managed by the runtime. Reducing the cache to address a symptom can move the cost into cache misses.
**Use this when:** learning from a sourced production change with explicit limitations.

## Context
A chat platform's read-state service used a frequently updated cache in front of Cassandra. This historical case was published on 2020-02-04; it is not a benchmark of current Go and Rust versions. ✅ [Original report](https://discord.com/blog/why-discord-is-switching-from-go-to-rust).

## Symptom
The operators observed CPU and latency spikes associated with garbage-collection cycles. Shrinking the cache reduced the spikes but increased misses and tail response times. ✅ [Original report](https://discord.com/blog/why-discord-is-switching-from-go-to-rust).

## Root cause
A cache retains copies for later reads; the live heap is data that remains referenced. A larger warehouse reduces shopping trips but costs more to inventory. Relationship artifact: `cache capacity↑ → hit ratio↑ but live heap↑`; this illustrates a trade-off, not a speed equation. Do not interpret the case as meaning that current Go always stops the entire program to scan every heap.

## Fix
The team moved this particular service to Rust and reported improved stability. ✅ [Original report](https://discord.com/blog/why-discord-is-switching-from-go-to-rust). This knowledge base has no raw dataset with which to recalculate the effect; do not attribute the outcome solely to the language or recommend rewriting every service.

## Generalized lesson
Measure allocation, retained heap, cache hits, database load and p99 together before changing runtime. The [runtime catalog](runtime-and-client-performance.md) explains mechanisms; [caching](optimization/caching.md) explains hit ratio. The transferable lesson is to measure interactions between caching and memory, rather than copy the rewrite decision.

## Takeaways
- Preserve the case workload and historical context when transferring lessons.
- Measure cross-layer effects; do not infer an optimal decision from a technology name.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 3 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-07

## References
- [Why Discord is switching from Go to Rust](https://discord.com/blog/why-discord-is-switching-from-go-to-rust) — Discord, 2020. Backs: historical reported context and outcome.
- [Coverage map](performance-map.md) — local entry and evidence policy.

## Related
- [Measurement contract](load-testing-and-regression.md)
