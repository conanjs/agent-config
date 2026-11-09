---
schema: knowledge-doc/v1
type: reference
topic: performance
status: verified
applies-to: ["SQLite 3.50.4 ordered top-k experiment"]
last-verified: 2026-11-07
last-updated: 2026-11-07
---

# Covering indexes for ordered top-k in SQLite

## Summary
**TL;DR:** A covering index replaced a scan and temporary sorting structure in a local ordered top-20 query. Both plans produced identical rows.
**Use this when:** A query filters on a key, orders matching rows and returns a small result.

## Scope
A covering index is like a directory containing both the lookup key and the fields you need to copy. Here the input rows have shape `(id, tenant, score)`. The query selects tenant 7, orders by descending score and identifier, and returns `(id, score)`. ✅ SQLite documents when indexes can satisfy ordering and avoid consulting the table. [Query planner](https://www.sqlite.org/queryplanner.html)

## Catalog

| Variant | Plan detail | Median ms | Minimum–maximum ms |
|---|---|---:|---:|
| Without index | `SCAN events`, `USE TEMP B-TREE FOR ORDER BY` | 1.939 | 1.873–2.136 |
| With index | `SEARCH events USING COVERING INDEX e (tenant=?)` | 0.00725 | 0.00700–0.01938 |

## Lookup notes
✅ Local measurement on 2026-11-07 used arm64, Python 3.13.7 and SQLite 3.50.4. Each variant had five warmups and 51 timed executions. Timing included fetching the result, with setup, index build and assertions outside the timed region. The unindexed variant ran first. Every result matched an independent Python sort, including the first three output rows `(61007, 99943)`, `(9307, 99925)` and `(96707, 99762)`.

Save this reproduction as `sqlite_top_k.py` and run `python3 sqlite_top_k.py`.

```python
import sqlite3
from statistics import median
from time import perf_counter_ns

db = sqlite3.connect(":memory:")
db.execute("CREATE TABLE events(id INTEGER PRIMARY KEY, tenant INTEGER, score INTEGER)")
rows = [(i, i % 100, (i * 7919) % 100003) for i in range(1, 100001)]
db.executemany("INSERT INTO events VALUES (?, ?, ?)", rows)
query = ("SELECT id, score FROM events WHERE tenant = 7 "
         "ORDER BY score DESC, id DESC LIMIT 20")
expected = sorted(
    ((i, score) for i, tenant, score in rows if tenant == 7),
    key=lambda row: (row[1], row[0]),
    reverse=True,
)[:20]
for ddl in ("", "CREATE INDEX e ON events(tenant, score DESC, id DESC)"):
    if ddl:
        db.execute(ddl)
    print(db.execute("EXPLAIN QUERY PLAN " + query).fetchall())
    samples = []
    for iteration in range(56):
        start = perf_counter_ns()
        actual = db.execute(query).fetchall()
        elapsed_ms = (perf_counter_ns() - start) / 1e6
        assert actual == expected
        if iteration >= 5:
            samples.append(elapsed_ms)
    print(median(samples), min(samples), max(samples), actual[:3])
```

The timings describe one warmed in-memory experiment. To choose an index for production, repeat with representative selectivity, storage and concurrency. Include index build time, storage and write throughput in the comparison.
 
## Takeaways
- Verify identical ordered results and inspect the query plan before interpreting a latency change.
- Measure the cost of maintaining the index on the write path.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 2 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-07

## References
- [Query Planning](https://www.sqlite.org/queryplanner.html) — SQLite, living. Backs: ordering and covering indexes.
- [EXPLAIN QUERY PLAN](https://www.sqlite.org/eqp.html) — SQLite, living. Backs: plan interpretation.
- Embedded Python reproduction — local workload and result oracle.

## Related
- [Query and data-path performance](database-query-performance.md)
