---
schema: knowledge-doc/v1
type: reference
topic: algorithms
status: draft
applies-to: ["General algorithm design; Abseil; Arrow; NumPy 2.2"]
last-verified: 2026-11-07
last-updated: 2026-11-07
tags: [performance, research-synthesis]
---

# Choosing algorithms and representations by workload

## Summary
**TL;DR:** Count construction, query, update and data-movement costs together. Algorithms with the same complexity can still differ because of data layout and usage contracts.
**Use this when:** choosing a structure for a hot path or designing a meaningful comparison.

## Scope
A workload describes the shape of the work: data volume, frequently repeated operations, key distribution and correctness requirements. Think of organizing a warehouse: an index helps find one parcel, while placing similar items together helps retrieve a whole batch. Here n is the number of elements, k is the number of required results, and Q is the number of queries. O(n) describes how work grows with n, not elapsed seconds; see the [Big-O foundation](fundamentals/complexity-and-big-o.md).

## Catalog

| Problem | Candidate structure or algorithm | Conditions and limits | Deciding measurements |
|---|---|---|---|
| Exact key lookup | Hash table; Swiss tables use metadata to filter candidate groups | ✅ [Abseil](https://abseil.io/about/design/swisstables): hash-fingerprint filtering still needs actual key equality checks; hash quality matters | Build + lookup; hits/misses; bytes/key; skew |
| Ordered or range lookup | B-tree with several values per node | ✅ [B-tree design](https://abseil.io/about/design/btree): improves locality, but mutation can invalidate pointers and iterators | Range length, updates, memory, stable-address requirement |
| A few largest values | Heap bounded to k elements | ✅ [heapq](https://docs.python.org/3/library/heapq.html): nlargest/nsmallest suit small k; consider sorting for large k, max/min for k=1 | k/n, input stream versus array, ties |
| Only a quantile element or leading subset | Partition, then sort only the required region | ✅ [NumPy 2.2](https://numpy.org/doc/2.2/reference/generated/numpy.partition.html): introselect is O(n) worst-case and unstable; the function returns a copy | Total allocations, within-partition order, axis and copying time |
| Rarely changed graph, many traversals | Compressed Sparse Row (CSR) | ✅ [Boost](https://www.boost.org/doc/libs/latest/libs/graph/doc/html/graph/graph_classes/compressed_sparse_row.html): offsets + targets, O(V+E) memory, where V is vertices and E is edges; individual edge changes are difficult | Build/rebuild + traversal count; peak memory |
| Analysis of a few columns across many rows | Columnar data | ✅ [Arrow](https://arrow.apache.org/docs/format/Columnar.html): favors contiguous scans and vectorization; mutation is expensive; zero-copy is conditional | Bytes touched, conversion cost, update mix |
| Large arithmetic loop | Single Instruction Multiple Data (SIMD) | ✅ [LLVM](https://llvm.org/docs/Vectorizers.html): the cost model can reject vectorization; gather/scatter, runtime checks and remainder handling cost work | Compiler diagnostics + whole-loop time, including short inputs |

| Computation organization | Analogy and illustrative artifact | Where to try it | Trade-offs to check |
|---|---|---|---|
| Divide and conquer | Split a paper stack, solve each part and combine: `sort(left)+sort(right)→merge` | Independent subproblems with a clear merge step | Splitting/merging, stack, load balance |
| Pipeline | An assembly line: `read→parse→transform→write` | Overlapping input/output and computation | Slowest stage, buffers, backpressure |
| Bulk/vectorized | Process a whole tray: `sum(price_column)` | The same operation across many elements | Batch wait, layout conversion |
| Incremental computation | Adjust a total by the change: `sum += new-old` | Repeated questions with small changes | State, invalidation, replay correctness |
| Memoization | Save `f(input)→result` | Repeated function calls with the same input | Memory, keys, purity and expiry |
| External-memory processing | Split a file into runs, then merge | Data does not fit in memory | Disk reads/writes, spilling, temporary space |
| Approximate streaming | Keep compressed statistics | Error is acceptable instead of retaining every record | Error contract, merging, windows |

## Lookup notes
The computation table is a design taxonomy, not a benchmark or speed ranking. ⚠️ unverified: the benefit of each choice on a particular workload must be measured; it does not follow from a pattern name.

Illustrative calculation: building an index takes 20 ms; each scan takes 2 ms; indexed lookup takes 0.1 ms. Total scan time is `2Q`; total indexed time is `20+0.1Q`. The index wins when Q > 20/1.9, or from 11 queries onward. These values have not been measured; if data changes continuously, include rebuilding too.

A concrete CSR artifact: edges `0→1, 0→2, 1→2` become `offsets=[0,2,3,3]`, `targets=[1,2,2]`. Row 0 uses targets from position 0 up to, but excluding, 2. For columnar layout, `[{id:1,price:10},{id:2,price:20}]` becomes `id=[1,2]`, `price=[10,20]`; summing price does not require reading id. These illustrate the physical shape of the data.

For a fair comparison, vary n, k, key length, read/write ratio, hits/misses, uniform/skewed distributions and cold/warm caches. Measure construction, resizing, copying, cleanup and correctness. For exact deduplication, try a hash set when memory permits; sort and scan when ordered output is needed. Do not use a Bloom filter to decide to discard a new record permanently.

## Takeaways
- Count costs over the data lifecycle, not only one lookup.
- Check address, ordering and error contracts before replacing a structure.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 7 claims (✅) · Unverified: 1 claim (⚠️) · Last verified: 2026-11-07

## References
- [Swiss tables](https://abseil.io/about/design/swisstables) — Abseil, living. Backs: group metadata filtering.
- [B-tree containers](https://abseil.io/about/design/btree) — Abseil, living. Backs: locality and invalidation.
- [heapq](https://docs.python.org/3/library/heapq.html) — Python, living. Backs: top-k selection.
- [numpy.partition](https://numpy.org/doc/2.2/reference/generated/numpy.partition.html) — NumPy 2.2. Backs: algorithm and allocation contract.
- [CSR](https://www.boost.org/doc/libs/latest/libs/graph/doc/html/graph/graph_classes/compressed_sparse_row.html) — Boost, living. Backs: graph representation.
- [Columnar format](https://arrow.apache.org/docs/format/Columnar.html) — Apache Arrow, living. Backs: layout.
- [Vectorizers](https://llvm.org/docs/Vectorizers.html) — LLVM, living. Backs: vectorization conditions.
- [Operation costs](data-structures/data-structure-catalog.md) — local foundation; basic structures remain canonical here.

## Related
- [Streaming and approximation](streaming-and-approximation.md)
- [Measurement workflow](../performance/load-testing-and-regression.md)
