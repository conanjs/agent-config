---
schema: topic-index/v1
kind: topic
topic: algorithms
last-updated: 2026-11-07
---

# Algorithms and data structures

Practical algorithms and data structures for engineers: how cost grows with input size, amortized cost, operation costs of common structures, hash tables, trees, heaps and B-tree indexes, library sorting (stability, adaptivity), graph algorithms (BFS, DFS, Dijkstra, topological sort) and dynamic programming versus greedy. The foundational docs carry a measurement run in the Linux lab (Python 3.12 / SQLite on Linux 6.17). Start with `learning-path.md`. New workload-selection and streaming/approximation docs add sourced decision support, without claiming new lab measurements. The sorting catalog and lab compare major sorting families. Additional references cover selection and merging, mutable range queries, set intersections and text search. Advanced graph algorithms remain outside the current scope.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [learning-path.md](learning-path.md) | reference | Five stages from complexity to design techniques, with an exercise and a self-check per stage | verified |
| [vector-search-evaluation.md](vector-search-evaluation.md) | reference | Exact and graph-based vector search evaluation | verified |
| [streaming-and-approximation.md](streaming-and-approximation.md) | concept | Approximation and filtering over data streams | draft |
| [workload-selection.md](workload-selection.md) | reference | Choosing algorithms and representations by workload | draft |
| [range-query-structures.md](range-query-structures.md) | reference | Scan, prefix sums, Fenwick trees and segment trees | verified |
| [selection-and-k-way-merge.md](selection-and-k-way-merge.md) | reference | Top-k, selection and merging sorted inputs | verified |
| [set-intersection-representations.md](set-intersection-representations.md) | reference | Sorted lists, hash sets and bitmap representations | verified |
| [string-search-and-indexing.md](string-search-and-indexing.md) | reference | Single-pattern, multi-pattern, prefix and full-text search | verified |

## Subtopics
| Subtopic | Summary |
|---|---|
| [fundamentals/](fundamentals/index.md) | Big-O measured from O(1) to O(n²); amortized cost of dynamic arrays |
| [data-structures/](data-structures/index.md) | Operation-cost catalog; hash tables and collisions; trees, heaps, B-tree indexes |
| [sorting-searching/](sorting-searching/index.md) | Timsort, dual-pivot quicksort, stability and adaptivity measured |
| [graphs/](graphs/index.md) | BFS, DFS, Dijkstra, topological sort and cycles |
| [techniques/](techniques/index.md) | Dynamic programming, memoization, greedy algorithms |

## References
- [NIST Dictionary of Algorithms and Data Structures](https://xlinux.nist.gov/dads/) — NIST, living. Backs: topic scope.

## Related
- `performance/` — hardware, measurement and optimization.
- `linux/lab-setup.md` — the lab used for every measurement.
