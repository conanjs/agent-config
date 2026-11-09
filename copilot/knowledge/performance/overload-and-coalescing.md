---
schema: knowledge-doc/v1
type: concept
topic: performance
status: draft
applies-to: ["Service architectures; cache and dependency overload"]
last-verified: 2026-11-07
last-updated: 2026-11-07
tags: [performance, research-synthesis]
---

# Bounding load and coalescing duplicate work

## Summary
**TL;DR:** Queues and retries do not create processing capacity. Coalescing identical requests and bounding in-flight work can protect dependencies, but deadlines, access control and success semantics must remain correct.
**Use this when:** cache stampedes, hot keys, retry storms or growing queues.

## Problem
When a dependency slows, requests live longer, queues grow and clients retry. If every layer independently increases concurrency, the system can spend most resources on duplicate or already-expired work.

## Mental model
Think of a warehouse counter: more waiting customers do not make staff retrieve goods faster. Coalescing lets customers requesting the same item share one retrieval; caching keeps the retrieved item for later requests. Artifact: `inflight[(tenant=7,key=42)] = pending_task` exists only while the task runs.

## How it works
There are 3 components:
- **Client** — its job: send read requests over the network.
- **Data service** — its job: manage running tasks through a local map.
- **Database** — its job: serve queries through a connection.

```text
Client A == network ==> Data service [tenant7,key42 → pending]
Client B == network ==>          |  B waits on the shared task (local)
                                 +== network/query ==> Database
Client A,B <== network/result ====+<== network/row =====+
```

1. Client A sends a request; the service checks access and builds a coalescing key containing the tenant, key and parameters affecting the result.
2. The service creates a local task and sends one query through a connection to the database.
3. Client B, with the same valid key, subscribes to the task; the service sends no second query.
4. The database returns a result; the service delivers it to waiters whose deadlines have not passed, then removes the task from the map, including on failure.

✅ A [messaging-system report](https://discord.com/blog/how-discord-stores-trillions-of-messages) describes request coalescing and channel-based routing to share an in-flight query. This is not long-lived result caching.

✅ [Handling overload](https://sre.google/sre-book/handling-overload/) emphasizes that capacity depends on each request's cost, not only requests/second; admission control and bounded degradation protect the system.

✅ [Timeouts and retries](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/): a timeout does not prove a side effect did not occur. Retries need limits, backoff (increasing the wait), jitter (randomizing the wait) and idempotency (repetition preserves a single business effect).

## Worked example
Unexecuted illustrative calculation: 100 requests for the same key arrive during a 50 ms query. Without coalescing, they can issue 100 queries. Correctly scoped coalescing gives one query and 100 waiters. If the query fails, all 100 waiters can receive an error; if they retry together after the task has been removed, the new wave still needs admission control.

Suppose three layers each allow at most 3 attempts, including the first. One request can produce up to `3×3×3=27` attempts at the final layer. This is an illustrative upper bound when all layers exhaust their attempts, not a measurement. A shared retry budget must account for useful completed operations, not count attempts as successes.

## Edge cases
| Case | What happens | Why / handling contract |
|---|---|---|
| A times out; B still has time | Do not automatically cancel B's shared work | Each waiter's deadline differs from the task deadline |
| Two users have the same id but different rights | Incorrect coalescing leaks data | Include authorization scope in the key or verify separately |
| Cache outage | All misses reach the database | Bound fallback concurrency/rate and define degradation |
| Every key expires together | Refreshes burst across keys | Jitter reduces simultaneous expiry; it does not by itself solve one hot key |
| Invalidation followed by a stale writer refilling the cache | The cache contains an old version | Use versioning/fencing or a verified consistency protocol |
| Unbounded queue | Work age and memory increase | A queue stores backlog; it does not raise service capacity |
| Client cancellation after commit | The side effect persists | Cancellation does not undo a committed transaction |
| Hedging under overload | More attempts worsen tail latency | Consider spare capacity, deadlines and safe read semantics |

## Trade-offs
| Option | Gains | Costs and measurement |
|---|---|---|
| Bounded queue/admission | Bounds memory and work age | Explicit rejection; measure accepted/completed/rejected/expired separately |
| Coalescing | Reduces duplicate work | Waiter bookkeeping, shared failures; measure queries/key and cancellation |
| Serve stale within an allowed window | Reduces refresh pressure | Freshness; ✅ [cache revalidation](https://developers.cloudflare.com/cache/concepts/revalidation/) explains stale-while-revalidate |
| Probabilistic early revalidation | Avoids dependence on a lock service | ✅ [Cache analysis](https://blog.cloudflare.com/sometimes-i-cache/): guarantees neither exactly one refresh nor a refresh before expiry |
| Per-tenant bulkheads/quotas | Isolates resource-heavy tenants | Capacity can sit idle in another pool; measure fairness |
| Count/time-based batching | Shares fixed costs | More waiting and a wider failure scope; measure completion latency too |

⚠️ unverified: optimal queue limits, worker counts, deadlines and batch sizes depend on the workload; no local benchmark has been run. Test bursts, hot keys, slow dependencies, cold caches and recovery, not only steady state.

## Takeaways
- Count correctly completed work, not attempts or queue admission as proxies.
- Check recovery and failure interactions alongside throughput.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 5 claims (✅) · Unverified: 1 claim (⚠️) · Last verified: 2026-11-07

## References
- [How Discord stores trillions of messages](https://discord.com/blog/how-discord-stores-trillions-of-messages) — Discord, 2023. Backs: coalescing mechanism.
- [Handling overload](https://sre.google/sre-book/handling-overload/) — Google SRE, 2016. Backs: capacity/admission.
- [Timeouts, retries, and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/) — AWS Builders' Library, 2019. Backs: retry semantics.
- [Revalidation](https://developers.cloudflare.com/cache/concepts/revalidation/) — Cloudflare, living. Backs: stale response policy.
- [Sometimes I cache](https://blog.cloudflare.com/sometimes-i-cache/) — Cloudflare, 2024. Backs: probabilistic refresh tradeoff.
- [Caching foundation](optimization/caching.md) — local cache-aside/hit ratio material.

## Related
- [Hot-partition case](case-hot-partition.md)
- [Load-test workflow](load-testing-and-regression.md)
