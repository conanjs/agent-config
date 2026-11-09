---
schema: knowledge-doc/v1
type: concept
topic: algorithms
status: draft
applies-to: ["Redis probabilistic structures; RocksDB filters"]
last-verified: 2026-11-07
last-updated: 2026-11-07
tags: [performance, research-synthesis]
---

# Approximation and filtering over data streams

## Summary
**TL;DR:** Membership, distinct count, frequency and top-k are different questions. Probabilistic structures save memory through controlled information loss; they do not replace exact data when the contract permits no error.
**Use this when:** processing large event streams, filtering expensive lookups or building statistical dashboards.

## Problem
Keeping every key to answer every question makes state grow with the data. Switching to a compressed structure without defining its error contract can produce an incorrect dashboard or discard a valid transaction.

## Mental model
A sketch is compressed statistics, like recording a visitor count instead of retaining every ticket. Artifact: `events=[A,B,A,C]`; the exact set is `{A,B,C}`, the distinct count is 3, and A's frequency is 2. These three answers are not interchangeable.

## How it works
✅ The [Redis catalog](https://redis.io/docs/latest/develop/data-types/probabilistic/) distinguishes Bloom for membership, HyperLogLog for distinct counts, Count-min sketch for frequencies, t-digest for percentiles and Top-K for frequent items.

There are 3 components in this example of a Bloom filter before a remote store:
- **Reader** — its job: process keys through application calls.
- **Filter** — its job: return an existence indication through a local memory check.
- **Exact store** — its job: return exact records through network queries.

```text
Reader --local key--> Filter
  |                    |
  |<-- absent/possible-|
  | absent: return not found
  | possible
  +====== network boundary ======> Exact store
  <========= record / not found =========+
```

1. Reader calls the local filter with a key.
2. Filter checks hash fingerprints and returns absent or possible.
3. Reader sends a network query to the exact store only for possible.
4. Exact store verifies the key and returns the actual result.

✅ [RocksDB filters](https://github.com/meta/rocksdb/wiki/RocksDB-Bloom-Filter) avoid reading files that definitely do not contain a key. A positive result still requires exact verification. The theoretical guarantee applies only to correctly built and updated filter state.

✅ [Redis HyperLogLog](https://redis.io/docs/latest/develop/data-types/probabilistic/hyperloglogs/) uses up to 12 KB and reports a standard error of 0.81%. Standard error is a statistical property, not an absolute error bound for every query; the structure does not retain a member list.

## Worked example
Illustrative calculation, not benchmarked: 10,000 lookups include 9,000 absent keys and 1,000 present keys. Assume the filter is fully updated and has a 1% false-positive rate on absent keys. About `9,000×1%=90` absent keys still need exact verification; with 1,000 present keys, the store receives about 1,090 lookups instead of 10,000. Include filter checking, construction/update costs and the actual measured error rate; this is not a promise of a proportional latency reduction.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Filter has not received a newly written key | A valid lookup can be rejected at system level | Filter/store state differs; this does not contradict the mathematical filter guarantee |
| A positive result discards a new record | Data can be lost | Positive does not prove the key actually exists |
| HyperLogLog is used for invoices | It provides neither an exact count nor a list | Estimation differs from accounting |
| Hourly trends use permanently accumulated state | Results describe history rather than the intended window | Windows, expiry and late arrivals need explicit design |
| Sketches with different configurations are merged | Results may violate the contract | Check the implementation's merge semantics |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Exact set + expiry | Exact deduplication within a defined window | State grows with key count; expiry costs |
| Bloom before an exact store | Avoids many negative lookups where suitable | Filter memory, false positives, update consistency |
| HyperLogLog | Small state for distinct counts | No member retrieval; estimation error |
| Heavy-hitter sketch | Tracks trends with bounded state | Measure precision/recall and response to skew |

⚠️ unverified: no choice has been benchmarked on the target workload. Use ground truth from an exact sample, the actual false-positive rate, bytes/key and merge/update time. Do not assign one common error percentage to every sketch.

## Takeaways
- Choose the structure by the question and the allowed error.
- Keep ground truth to measure error, not only speed.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 3 claims (✅) · Unverified: 1 claim (⚠️) · Last verified: 2026-11-07

## References
- [Probabilistic data types](https://redis.io/docs/latest/develop/data-types/probabilistic/) — Redis, living. Backs: question-to-structure mapping.
- [HyperLogLog](https://redis.io/docs/latest/develop/data-types/probabilistic/hyperloglogs/) — Redis, living. Backs: memory/error contract.
- [RocksDB Bloom filter](https://github.com/meta/rocksdb/wiki/RocksDB-Bloom-Filter) — RocksDB, living. Backs: negative lookup filtering.
- [Workload selection](workload-selection.md) — local decision context.

## Related
- [Database performance](../performance/database-query-performance.md)
- [Cache overload](../performance/overload-and-coalescing.md)
