---
schema: knowledge-doc/v1
type: reference
topic: performance
status: verified
applies-to: ["Relational execution algorithms and PostgreSQL 18 diagnostics"]
last-verified: 2026-11-07
last-updated: 2026-11-07
---

# Joins, grouping and deduplication under memory pressure

## Summary
**TL;DR:** Choose an execution strategy using input order, distinct-key count, row width, key skew, output size and memory budget.
**Use this when:** A join, grouping or deduplication step dominates latency or starts writing temporary data.

## Scope
A hash table is like a set of labeled bins. A sorted run is like a stack of receipts already ordered by account. Hashing collects related keys in bins. Merging walks ordered stacks. Both can move intermediate data to disk when memory is insufficient, which is called spilling.

## Catalog

| Work | Candidate | Conditions to examine | Costs to measure |
|---|---|---|---|
| Equality join | Hash join | Build-side rows and width fit the budget, or partitions can be processed independently | Build bytes, partition batches, temporary reads and writes |
| Equality join | Merge join | Both inputs can be delivered in compatible key order | Ordering cost, duplicate groups, output rows |
| Selective join | Indexed nested loops | A small outer input probes a selective inner index | Probe count and random reads |
| Group or deduplicate | Hash aggregation or set | Distinct groups and their states fit in memory | Peak memory, partition sizes and spilled bytes |
| Group or deduplicate | Sort and stream | Ordering already exists or downstream uses it | Sort passes and temporary storage |
| Group or deduplicate | Ordered streaming | Matching keys arrive consecutively | Cost of producing the order and size of each group's state |

## Lookup notes
✅ Do, Graefe and Naughton compare in-stream, sort-based and hash-based aggregation. Ordered input permits processing consecutive groups. Sort-based approaches can create sorted runs on disk and merge them. Hash-based approaches can partition work to temporary storage. Use their analysis to choose candidates under the expected data distribution. [Original paper](https://arxiv.org/abs/2010.00152)

For a merge join with duplicate keys on both sides, the matching groups produce every valid pair. If key B has 1,000 rows on each side, B alone yields one million joined rows. A more efficient join cannot avoid producing that output when it is required. Hash partitioning by key also keeps all rows for a hot key together unless the implementation explicitly handles skew.

✅ PostgreSQL 18 exposes actual rows, timing, sort method and hash details through plan inspection. Its memory setting applies to operations such as sort and hash, so multiple operators and sessions can draw on memory concurrently. In a controlled PostgreSQL environment, compare plans using `EXPLAIN (ANALYZE, BUFFERS)` and inspect sort disk usage, hash batches and temporary blocks where shown. The command executes the query. Compare elapsed time and peak memory at matched concurrency, and keep identical results as an acceptance check. [Plan inspection](https://www.postgresql.org/docs/18/using-explain.html) · [Resource settings](https://www.postgresql.org/docs/18/runtime-config-resource.html)

✅ The following result shapes were checked locally with SQLite 3.50.4 on 2026-11-07. They demonstrate semantics. PostgreSQL physical plans and disk spill were not measured.

Input `events(k, amount)` contains `(b,4), (a,2), (b,4), (b,7)`. Input `labels(k, label)` contains `(a,alpha), (b,beta)`.

```sql
CREATE TABLE events(k TEXT, amount INTEGER);
INSERT INTO events VALUES ('b',4), ('a',2), ('b',4), ('b',7);
CREATE TABLE labels(k TEXT PRIMARY KEY, label TEXT);
INSERT INTO labels VALUES ('a','alpha'), ('b','beta');

SELECT DISTINCT k, amount FROM events ORDER BY k, amount;
SELECT k, SUM(amount) AS total FROM events GROUP BY k ORDER BY k;
SELECT l.label, e.amount
FROM events e JOIN labels l USING(k)
ORDER BY l.label, e.amount;
```

| Transformation | Output shape | Ordered output |
|---|---|---|
| Deduplicate full rows | `(k, amount)` | `(a,2), (b,4), (b,7)` |
| Group by key and sum | `(k, total)` | `(a,2), (b,15)` |
| Join on key and project | `(label, amount)` | `(alpha,2), (beta,4), (beta,4), (beta,7)` |

Deduplicating before the sum would change B's total from 15 to 11. Compare row multiplicity and null behavior before adopting a rewrite. When benchmarking, vary distinct counts and skew independently, test narrow and wide rows, and record temporary bytes, elapsed time and memory at multiple budgets.

## Takeaways
- Compare plans using both result semantics and intermediate data costs.
- Measure output cardinality and hot-key sizes before attributing join cost to the implementation.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 3 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-07

## References
- [Efficient sorting, duplicate removal, grouping, and aggregation](https://arxiv.org/abs/2010.00152) — Do, Graefe and Naughton, 2022 revision. Backs: aggregation alternatives.
- [Using EXPLAIN](https://www.postgresql.org/docs/18/using-explain.html) — PostgreSQL 18 documentation. Backs: plan diagnostics.
- [Resource Consumption](https://www.postgresql.org/docs/18/runtime-config-resource.html) — PostgreSQL 18 documentation. Backs: memory scope.
- Embedded SQL — locally executed result-shape example.

## Related
- [Database query performance](database-query-performance.md)
- [Covering index experiment](sqlite-covering-index-lab.md)
