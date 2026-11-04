---
schema: knowledge-doc/v1
type: concept
topic: algorithms/data-structures
status: verified
applies-to: ["binary heaps (Python heapq)", "B-trees in databases (SQLite)", "any language"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [algorithms, tree, binary-search-tree, heap, priority-queue, b-tree, index, top-k]
---

# Trees, heaps and B-trees

## Summary
**TL;DR:** Trees keep data **ordered** so that search, insert and range queries cost O(log n) when the tree stays balanced. A **heap** is a weaker, cheaper order — each parent is ≤ its children — that gives the minimum in O(1) and push/pop in O(log n): ideal for priority queues and "top k". A **B-tree** is a balanced tree with many keys per node, so it is only a few levels deep even for millions of keys; that is why databases use it for indexes. In the lab, a SQLite index turned 200 random lookups in 1 000 000 rows from 3 583 ms (full scan) into 0.50 ms.
**Use this when:** you need ordered data, priority queues, top-k selection, or want to understand what a database index does.
**Not this doc:** unordered exact lookups → `data-structures/hash-tables.md`.

## Problem
Sorting everything to get the 10 largest items, scanning a table for one row, or keeping a sorted list up to date by re-sorting after every insert are all common and avoidable costs; each has a tree-shaped fix.

## Mental model
**Analogy:** a company org chart. A **binary search tree** is a chart where everyone to your left sorts before you and everyone to your right after you — find anyone by going left/right from the top. A **heap** only promises that every manager outranks their reports, so the CEO (minimum or maximum) is always on top, but siblings are in no order. A **B-tree** is a flat org chart where each manager has hundreds of reports, so even a huge company has only three or four levels.

**Artifact:** the B-tree index effect in SQLite (lab, Python 3.12.13 `sqlite3`, 1 000 000 rows, 2026-11-04) ✅[^4]:
```text
plan without index: SCAN t                           | 200 lookups 3583 ms
plan with index:    SEARCH t USING INDEX ix (id=?)   | 200 lookups 0.50 ms
```

## How it works
**Binary heap** ✅[^2]:
1. Stored in an array: for every k, `heap[k] <= heap[2*k+1]` and `heap[k] <= heap[2*k+2]` (min-heap), so the smallest element is `heap[0]`.
2. Push appends at the end and sifts up; pop moves the last element to the root and sifts down — each O(log n) because the tree is complete.
3. A heap is a complete tree where every node's key is at least as extreme as its parent's ✅[^1].

**Top k with a heap:** keep a heap of size k while scanning n items: O(n log k) instead of O(n log n) for a full sort. Python's `heapq.nlargest`/`nsmallest` "perform best for smaller values of n" (n = how many items you want); for large ones `sorted()` is better ✅[^2]. Lab: the 10 largest of 1 000 000 floats took 8.5 ms with `heapq.nlargest` and 158 ms with `sorted()[-10:]` ✅[^4].

**B-tree** ✅[^3]:
1. A balanced search tree where every node has between ⌈m/2⌉ and m children (m is the order); the root may have as few as 2.
2. Because each node holds many keys and maps to one disk page, the height is tiny — good "if much of the tree is in slow memory (disk)".
3. A database index is such a tree keyed by the indexed column; a lookup walks root → leaf (a handful of page reads) instead of reading every row. SQLite's query plan shows `SCAN` for a full-table scan and `SEARCH … USING INDEX` for an index lookup ✅[^5] ✅[^4].

**Binary search tree balance:** an unbalanced BST degrades to a linked list (O(n) per operation) when keys arrive sorted; self-balancing variants (AVL, red-black) keep the height logarithmic. Lab: a naive BST of 2 000 keys was 25 levels deep for random insertion order and 2 000 levels deep for sorted order ✅[^4].

## Worked example
How many levels does a B-tree need for 1 000 000 keys if each node holds ~100 keys?

| Level | Keys reachable |
|---|---|
| 1 (root) | 100 |
| 2 | 100 × 100 = 10 000 |
| 3 | 1 000 000 |

Three node reads find any key; a full scan reads every row. The lab's 7 000× speed-up (3 583 ms → 0.5 ms for 200 lookups) is the measured version of this arithmetic ✅[^4].

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Need the k smallest, k ≈ n | `sorted()` is faster than a heap | Documented for `heapq.nsmallest` ✅[^2] |
| Need min and max repeatedly | Two heaps or a balanced tree | A heap orders only one direction ✅[^1] |
| Writes on a heavily indexed table | Slower inserts | Each index is another tree to update; lab: 200 000 inserts took 0.18 s with 0, 0.26 s with 1 and 0.56 s with 3 indexes ✅[^4] |

## Takeaways
- Use a heap for priority queues and top-k; do not sort everything to take a few items.
- Index the columns you filter or join on, and confirm with the query plan (`EXPLAIN QUERY PLAN` / `EXPLAIN`).

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 13 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [heap](https://xlinux.nist.gov/dads/HTML/heap.html) — NIST Dictionary of Algorithms and Data Structures, living. Backs: complete tree with parent keys at least as extreme as children. [^1]
- [heapq — Heap queue algorithm](https://docs.python.org/3/library/heapq.html) — Python Software Foundation, living. Backs: array heap invariant, `nlargest`/`nsmallest` best for small n. [^2]
- [B-tree](https://xlinux.nist.gov/dads/HTML/btree.html) — NIST DADS, living. Backs: node child bounds, order m, suitability for slow memory. [^3]
- `linux/lab-setup.md` — the lab where the heap and SQLite index measurements ran on 2026-11-04 (Python 3.12.13). [^4]
- [EXPLAIN QUERY PLAN](https://www.sqlite.org/eqp.html) — SQLite, living. Backs: full-table scans vs index searches in query plans. [^5]

## Related
- `algorithms/data-structures/hash-tables.md` — unordered O(1) lookups.
- `algorithms/sorting-searching/sorting-algorithms.md` — heapsort and full sorts.
