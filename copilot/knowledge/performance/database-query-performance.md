---
schema: knowledge-doc/v1
type: concept
topic: performance
status: draft
applies-to: ["PostgreSQL 18; RocksDB tuning concepts"]
last-verified: 2026-11-07
last-updated: 2026-11-07
tags: [performance, research-synthesis]
---

# Query and data-path performance

## Summary
**TL;DR:** Measure the queries, rows and bytes actually processed before adding resources. Indexes, batching and pagination change the amount of work; transactions and replication determine what remains correct after optimization.
**Use this when:** slow queries, N+1 access, deep pagination, spills or lock waits.

## Problem
A fast database query can still produce a slow request if the application calls it hundreds of times or transfers excessive data. Conversely, reducing query count with a join can multiply rows and payload size.

## Mental model
An index is like a book's table of contents: it quickly finds the required section, but every change requires maintaining the contents too. A query plan is the actual read path; the artifact `EXPLAIN (ANALYZE, BUFFERS) SELECT ...` compares estimates with execution.

## How it works
There are 3 components:
- **Application** — its job: send data questions through a connection.
- **Planner/executor** — its job: select and run a plan through the database engine.
- **Storage** — its job: provide pages through buffers or storage devices.

```text
Application == network / query ==> Planner → Executor --local buffer/read--> Storage
Application <== network / rows === Executor <----------- pages ------------- Storage
```

1. The application sends a query and parameters through a connection, after any pool waiting time.
2. The planner selects a plan using predicates, indexes and statistics.
3. The executor reads pages, filters/joins/sorts and produces rows.
4. The application receives rows over the network and turns them into request output.

✅ [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/18/using-explain.html): estimated cost is not milliseconds; ANALYZE actually executes the query, and BUFFERS reports buffer accesses. A plan cannot replace full client-side measurement. ANALYZE on a write statement has side effects; the example below uses only SELECT in a test environment.

✅ [Index types](https://www.postgresql.org/docs/18/indexes-types.html): B-tree serves equality/range access; GIN (Generalized Inverted Index) serves multicomponent values; BRIN (Block Range Index, summarizing groups of blocks) exploits correlation with physical location.

✅ [Multicolumn indexes](https://www.postgresql.org/docs/18/indexes-multicolumn.html): leading columns usually matter; PostgreSQL 18 has skip scan in some cases, so missing a condition on the first column does not make an index universally useless.

✅ [Index-only scans](https://www.postgresql.org/docs/18/indexes-index-only-scans.html): having all required columns in the index does not guarantee avoidance of heap fetches; the visibility map also matters. Including many wide columns with INCLUDE increases storage and maintenance.

## Worked example
The following SQL (Structured Query Language) is an unexecuted design example. Input is a flat table with one row per order; tenant_id, created_at and id are non-null, and id is unique.

| tenant_id | created_at (UTC) | id | total |
|---|---|---|---|
| 7 | 2026-11-07 10:00:00 | 103 | 90 |
| 7 | 2026-11-07 10:00:00 | 102 | 40 |
| 7 | 2026-11-07 09:00:00 | 101 | 50 |
| 8 | 2026-11-07 08:00:00 | 100 | 20 |

The cursor is a bookmark containing the previous page's last `(created_at,id)`: `(10:00,102)`. WHERE retains tenant 7 and tuples smaller than the cursor; after filtering, only id 101 remains. ORDER BY sorts newest first, using id to break ties; LIMIT returns at most 50 rows. The flat output contains `id,created_at,total`, with one row `(101,09:00,50)`.

```sql
CREATE INDEX orders_page ON orders (tenant_id, created_at DESC, id DESC);
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, created_at, total
FROM orders
WHERE tenant_id = 7
  AND (created_at, id) < (TIMESTAMPTZ '2026-11-07 10:00:00+00', 102)
ORDER BY created_at DESC, id DESC
LIMIT 50;
```

✅ [LIMIT/OFFSET](https://www.postgresql.org/docs/18/queries-limit.html): rows skipped by OFFSET still have to be computed; a unique order makes pagination predictable. Measure latency and buffer reads by page depth; do not claim an index scan or speedup without an actual plan.

N+1 means one list query followed by N detail queries. Illustrative input `[order1→customer9, order2→customer9]` can batch the unique key `[9]`, then reconstruct the two corresponding order outputs. ✅ [DataLoader](https://github.com/graphql/dataloader) requires batch results to have the same length and key order as the input; request-scoped loader caching avoids sharing data across users with different access rights.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Sort keys change between pages | Rows can be skipped or repeated | A cursor does not automatically create a snapshot across requests |
| NULL or mixed ASC/DESC ordering | A simple tuple predicate may not match the order | A separate expression and contract are needed |
| One-to-many join | Row count and bytes increase | One parent appears multiple times |
| Long transaction | Lock waits and retries increase | Resources remain held longer; query computation is not the only cost |
| Lagging read replica | Reads see old data | ✅ [Warm standby](https://www.postgresql.org/docs/18/warm-standby.html) describes the asynchronous replication window |
| Serializable conflict | Retry the entire transaction | ✅ [Isolation](https://www.postgresql.org/docs/18/transaction-iso.html); do not weaken isolation if it breaks an invariant |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Add a suitable index | Reads less data | Storage, updates, maintenance |
| Keyset pagination | Continues from a bookmark | Cannot jump directly to an arbitrary page number |
| Batch/join | Fewer network round trips | Batch waiting or row multiplication |
| Precomputed read model | Cheaper reads | Freshness, rebuilding, state synchronization |
| More memory for sort/join | Can reduce spills | Total memory multiplies across operations and concurrency |
| Tiered compaction in an LSM (Log-Structured Merge-tree) | Reduces write amplification for suitable workloads | ✅ [RocksDB](https://github.com/facebook/rocksdb/wiki/Universal-Compaction): trades against read/space amplification |

⚠️ unverified: these choices are optimization hypotheses for a particular application. Check estimated/actual rows, buffers, temporary bytes, queries/request, lock waits, successful commits/s and end-to-end latency. Write amplification is device bytes written divided by logical bytes written; optimizing it alone can make reads slower or increase storage use.

## Takeaways
- Measure rows/bytes and query count alongside latency, not only planner cost.
- Preserve consistency, access-control and transaction contracts when optimizing.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 9 claims (✅) · Unverified: 1 claim (⚠️) · Last verified: 2026-11-07

## References
- [Using EXPLAIN](https://www.postgresql.org/docs/18/using-explain.html) — PostgreSQL 18. Backs: plan interpretation.
- [Index types](https://www.postgresql.org/docs/18/indexes-types.html) — PostgreSQL 18. Backs: access methods.
- [Multicolumn indexes](https://www.postgresql.org/docs/18/indexes-multicolumn.html) — PostgreSQL 18. Backs: skip scan.
- [Index-only scans](https://www.postgresql.org/docs/18/indexes-index-only-scans.html) — PostgreSQL 18. Backs: visibility and INCLUDE.
- [LIMIT/OFFSET](https://www.postgresql.org/docs/18/queries-limit.html) — PostgreSQL 18. Backs: pagination.
- [DataLoader](https://github.com/graphql/dataloader) — GraphQL project, living. Backs: batch ordering and request scope.
- [Warm standby](https://www.postgresql.org/docs/18/warm-standby.html) — PostgreSQL 18. Backs: replication.
- [Transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html) — PostgreSQL 18. Backs: serialization retries.
- [Universal compaction](https://github.com/facebook/rocksdb/wiki/Universal-Compaction) — RocksDB, living. Backs: amplification tradeoff.
- [Trees and B-trees](../algorithms/data-structures/trees-heaps-and-b-trees.md) — local foundation.

## Related
- [Overload and coalescing](overload-and-coalescing.md)
- [Load testing](load-testing-and-regression.md)
