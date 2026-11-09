---
schema: knowledge-doc/v1
type: case-study
topic: performance
status: verified
applies-to: ["Historical messaging storage, report 2023"]
last-verified: 2026-11-07
last-updated: 2026-11-07
tags: [performance, research-synthesis]
---

# Case study: hot partitions and request coalescing

## Summary
**TL;DR:** A message store experienced concentrated load on hot partitions. Request coalescing reduced duplicate work, but the successful migration involved several coordinated changes.
**Use this when:** learning from a sourced production change with explicit limitations.

## Context
A messaging platform operated a large Cassandra cluster and later moved to ScyllaDB. Its report dated 2023-03-06 describes the data service, routing and storage layer together. ✅ [Original source](https://discord.com/blog/how-discord-stores-trillions-of-messages).

## Symptom
Hot partitions and operating effort grew with data and load. A hot partition is a portion of data receiving more access than the rest, like one counter serving nearly all customers; the artifact `requests/channel=[10,12,900]` is an invented illustration, not a measurement from the report.

## Root cause
Many users reading the same channel data created duplicate work; adding nodes does not automatically divide one hot key. The team added channel-based routing and coalescing so duplicate reads waited on a single query. ✅ [Original source](https://discord.com/blog/how-discord-stores-trillions-of-messages).

## Fix
The data service reduced spikes but did not fully resolve hot-partition issues before migration. Database and storage-infrastructure changes were part of the same improvement context. ✅ [Original source](https://discord.com/blog/how-discord-stores-trillions-of-messages). Do not isolate a speedup number and attribute it entirely to the language or engine.

## Generalized lesson
[Coalescing](overload-and-coalescing.md) explains the flow and cancellation/authorization failure cases. To test the idea, preserve skew, payload and freshness; measure queries/key, p99, retries and useful throughput, including cold-cache and recovery tests. The case demonstrates a duplicate-work reduction mechanism, not that migration is always beneficial.

## Takeaways
- Preserve the case workload and historical context when transferring lessons.
- Measure cross-layer effects; do not infer an optimal decision from a technology name.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 3 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-07

## References
- [How Discord stores trillions of messages](https://discord.com/blog/how-discord-stores-trillions-of-messages) — Discord, 2023. Backs: historical reported context and outcome.
- [Coverage map](performance-map.md) — local entry and evidence policy.

## Related
- [Measurement contract](load-testing-and-regression.md)
