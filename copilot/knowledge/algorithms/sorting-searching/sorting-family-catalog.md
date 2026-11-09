---
schema: knowledge-doc/v1
type: reference
topic: algorithms/sorting-searching
status: verified
applies-to: ["Canonical sorting families and common variants", "CPython 3.11 and later merge scheduling"]
last-verified: 2026-11-07
last-updated: 2026-11-07
tags: [sorting, algorithm-selection, external-memory]
---

# Sorting families and selection criteria

## Summary
**TL;DR:** Start with the required ordering, stability and memory budget. Compare a library sort with specialist algorithms when key structure, existing runs or storage limits give the specialist a concrete advantage.
**Use this when:** Selecting a sort or designing a benchmark across sorting families.

## Scope

Here n is the number of records, K is the size of a dense integer key range, r is the number of radix buckets, and p is the number of digit passes. Stability preserves the input order of equal-key records. For example, a stable sort by score keeps A before C when `[(2,A), (1,B), (2,C)]` becomes `[(1,B), (2,A), (2,C)]`. Think of it as moving labeled envelopes between shelves while preserving their order within a shelf.

The table describes common implementations on arrays. Extra space excludes the input and includes recursion where shown. A family can have implementations with different bounds or stability.

## Catalog

| Family | Representative mechanics | Time | Extra space and stability | Decision |
|---|---|---|---|---|
| Insertion sort | Insert each item into the sorted prefix | Best O(n), worst O(n²) | O(1), stable when equal keys are left in place | Small inputs, short runs, nearly sorted sequences |
| Selection sort | Find the next minimum and swap it into place | Θ(n²) comparisons even on sorted data | O(1), standard swap variant unstable | Teaching baseline, or when minimizing swaps matters more than comparisons |
| Bubble and cocktail sorts | Swap inverted adjacent pairs, in one or both directions | O(n) best with early exit, O(n²) worst | O(1), stable with strict swaps | Teaching baseline for inversions |
| Shellsort | Insertion sort on spaced subsequences with shrinking gaps | Depends on gap sequence | O(1), unstable | Small working storage with a simpler implementation than many hybrids |
| Quicksort | Partition around a pivot and recurse on the outer regions | Expected O(n log n) with randomized pivots, worst O(n²) | Ordinary swaps are unstable. Recurse on the smaller side and loop on the larger to bound stack depth to O(log n) | Measure partition quality, key repeats and branch behavior |
| Merge sort | Divide into runs and merge ordered runs | Standard array form Θ(n log n) | O(n), stable with left-first ties | Stable records, sequential merging and predictable work |
| Heapsort | Build a max heap and repeatedly move its root to the end | O(n log n) worst | O(1) in iterative form, unstable | Predictable worst case with tight auxiliary storage |
| Smoothsort | Reorganize a forest of heaps over the array | O(n) best, O(n log n) worst | In place, unstable | Adaptive alternative when auxiliary storage is constrained |
| Introsort | Partition like quicksort until the depth budget is exhausted, then use heapsort | O(n log n) worst | O(log n) stack for the usual bounded-depth form, unstable | General-purpose unstable sort with a worst-case bound |
| Timsort | Detect natural runs, extend short runs and merge | O(n) on a single monotonic run, O(n log n) worst | O(n) worst-case auxiliary storage, stable | Records arriving in ordered batches or with expensive comparisons |
| Counting sort | Count occurrences, then reconstruct keys or scatter records using prefix counts | O(n + K) | O(K) counters plus O(n) output for stable record scattering | Small dense integer domain. Reject unexpectedly wide ranges |
| Least-significant-digit radix sort | Apply stable digit passes from low digit to high | O(p(n + r)) with counting passes | O(n + r) for the buffered form, stable | Fixed-width keys with an encoding that preserves the intended order |
| Most-significant-digit radix sort | Partition on the highest remaining digit, recurse by bucket | Depends on key widths, bucket work and common prefixes | Implementation dependent. American flag sort permutes buckets in place and is generally unstable | Strings, prefixes and variable digit lengths |
| Bucket sort | Distribute to ranges, sort within each bucket and concatenate | Expected linear under suitable distribution assumptions and bucket count. Skew can dominate | Depends on storage and the inner sort | Bounded keys with measured distribution |
| Tree sort | Insert keys into a search tree and traverse in order | O(n log n) with a balanced tree. O(n²) worst without balancing | O(n) for nodes. Stability depends on duplicate handling | Useful when a tree is needed for intervening queries as well as sorted output |
| Pigeonhole sort | Put complete records in slots indexed by key and read slots in order | O(n + K) | O(n + K) slots and entries, stable with ordered buckets | Small key range with payloads that must move together |
| External merge sort | Sort chunks that fit in memory, write runs, merge multiple runs at a time | Track run count, merge passes and bytes transferred | Bounded buffers plus temporary storage. Run order and tie handling determine stability | Data larger than main memory |
| Parallel merge or sample sort | Sort partitions concurrently, then merge or redistribute by sampled splitters | Depends on worker count, imbalance, memory bandwidth and movement | Depends on implementation | Measure total elapsed time, peak memory and skew at fixed worker counts |
| Sorting network | Fixed compare-exchange schedule, such as bitonic sort | Bitonic networks use O(n log² n) comparators and O(log² n) stages for power-of-two n | Usually unstable without an explicit tie-breaker | Small fixed batches or hardware with predictable parallel schedules |

✅ The comparison-sort bounds and assumptions above follow the textbook analysis for elementary, partition, merge and heap sorts. Quicksort partition variants include Hoare-style two-way partitioning, three-way partitioning to skip a region of equal keys, and dual-pivot partitioning. These partition schemes do not imply identical performance or implementation contracts. [Algorithms, 4th Edition](https://algs4.cs.princeton.edu/20sorting/)

✅ Dijkstra’s Smoothsort paper specifies linear best-case work and O(n log n) worst-case work for an in-place alternative to heapsort. [Smoothsort](https://www.cs.utexas.edu/~EWD/transcriptions/EWD07xx/EWD796a.html)

✅ Musser's Introsort paper describes the depth budget and heapsort fallback. The fallback bounds work on inputs with poor partitions even if a pivot heuristic usually performs well. [Introspective Sorting and Selection Algorithms](https://webpages.charlotte.edu/rbunescu/courses/ou/cs4040/introsort.pdf)

✅ Timsort exploits ordered runs and can switch to galloping, which searches for the next boundary and copies a stretch of values at once. CPython 3.11 and later combine the Timsort machinery with the Powersort merge scheduling strategy. Treat the library's observable stability contract separately from its internal scheduling policy. [CPython design notes](https://github.com/python/cpython/blob/main/Objects/listsort.txt) · [Powersort authors](https://powersort.github.io/)

✅ Counting, radix and bucket sorts exploit properties of keys beyond their relative order. The general comparison-model lower bound of Ω(n log n) in the worst case follows because a binary comparison decision tree needs at least n! leaves for distinct keys. It does not apply to algorithms that directly inspect integer digits or index a count array. [NIST radix sort](https://xlinux.nist.gov/dads/HTML/radixsort.html) · [NIST sorting catalog](https://xlinux.nist.gov/dads/HTML/sort.html)

✅ Production engines can switch families. The PostgreSQL sort implementation generates runs when it exceeds the memory available to that sort and uses a balanced multiway merge for external sorting. An execution plan can distinguish an in-memory quicksort, top-N heapsort and external merge. [PostgreSQL sort implementation](https://github.com/postgres/postgres/blob/REL_18_STABLE/src/backend/utils/sort/tuplesort.c)

✅ A sorting network executes a fixed pattern of comparator pairs for a given input width. Network depth counts parallel comparator layers, while total comparator count counts work. These two metrics answer different questions. [Batcher, Sorting Networks and Their Applications](https://www.cs.kent.edu/~batcher/sort.pdf)

## Lookup notes

- For arbitrary keys, first test the production library with the actual comparator and record layout. For dense keys, bound the largest allocation implied by the key domain before testing counting sort.
- Test runs, sorted and reverse-sorted inputs, few distinct keys, skewed distributions, wide records and expensive key extraction. Use separate sizes to expose overhead and growth rate.
- For large records, compare sorting records with sorting references or cached keys. Include any final gather or materialization in the end-to-end measurement if consumers require reordered records.
- Report stability, peak working memory, tail latency and elapsed time. For external sorting, also report temporary bytes and merge passes. For parallel sorting, include data transfer and scheduling.
- If the contract asks for only a rank or top-k, compare selection and bounded heaps before sorting everything.
- A complete inventory of historical variants is open-ended. The catalog covers the major mechanisms and directs readers to the broader NIST index for specialist variants.

## Takeaways
- Choose candidates by key domain, output contract and memory budget.
- Preserve identical output semantics when comparing timings.
- Treat family-level bounds separately from the behavior of a specific implementation.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 7 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-07

## References
- [Algorithms, 4th Edition, Sorting](https://algs4.cs.princeton.edu/20sorting/) — Sedgewick and Wayne. Backs: elementary, merge, quick and heap sorts.
- [Radix sort](https://xlinux.nist.gov/dads/HTML/radixsort.html) and [Counting sort](https://xlinux.nist.gov/dads/HTML/countingsort.html) — NIST. Backs: counting and radix mechanisms.
- [Smoothsort, an alternative for sorting in situ](https://www.cs.utexas.edu/~EWD/transcriptions/EWD07xx/EWD796a.html) — Dijkstra, 1981. Backs: Smoothsort bounds.
- [Tree sort](https://xlinux.nist.gov/dads/HTML/treeSort.html) — NIST. Backs: tree construction and traversal.
- [Introspective Sorting and Selection Algorithms](https://webpages.charlotte.edu/rbunescu/courses/ou/cs4040/introsort.pdf) — Musser, 1997. Backs: Introsort.
- [CPython list sort design notes](https://github.com/python/cpython/blob/main/Objects/listsort.txt) — CPython project. Backs: natural runs, galloping and merge strategy.
- [Powersort](https://powersort.github.io/) — Powersort authors. Backs: CPython adoption.
- [Sort](https://xlinux.nist.gov/dads/HTML/sort.html) — NIST. Backs: family names and broader catalog.
- [PostgreSQL 18 tuplesort implementation](https://github.com/postgres/postgres/blob/REL_18_STABLE/src/backend/utils/sort/tuplesort.c) — PostgreSQL project. Backs: external merge and sort methods.
- [Sorting Networks and Their Applications](https://www.cs.kent.edu/~batcher/sort.pdf) — Batcher, 1968. Backs: sorting networks.
- [Sorting algorithms in practice](sorting-algorithms.md) — local library behavior and existing adaptive-sort measurements.

## Related
- [Workload selection](../workload-selection.md)
- [Database query performance](../../performance/database-query-performance.md)
