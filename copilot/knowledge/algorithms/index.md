---
schema: topic-index/v1
kind: topic
topic: algorithms
last-updated: 2026-11-04
---

# Algorithms and data structures

Practical algorithms and data structures for engineers: how cost grows with input size, amortized cost, operation costs of common structures, hash tables, trees, heaps and B-tree indexes, library sorting (stability, adaptivity), graph algorithms (BFS, DFS, Dijkstra, topological sort) and dynamic programming versus greedy. Every doc carries a measurement run in the Linux lab (Python 3.12 / SQLite on Linux 6.17). Start with `learning-path.md`. Not covered: string algorithms, advanced graph algorithms, randomized algorithms.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [learning-path.md](learning-path.md) | reference | Five stages from complexity to design techniques, with an exercise and a self-check per stage | verified |

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
