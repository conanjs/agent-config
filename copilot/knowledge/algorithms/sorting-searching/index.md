---
schema: topic-index/v1
kind: subtopic
topic: algorithms/sorting-searching
last-updated: 2026-11-07
---

# Sorting and searching

Library sorts in practice — timsort, dual-pivot quicksort, std::sort, Rust sorts — with stability and adaptivity measured. Binary search is covered in the complexity doc. The family catalog includes external and parallel sorting. The benchmark lab compares built-in, counting and radix sorts. String search is covered separately.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [sorting-algorithms.md](sorting-algorithms.md) | concept | Comparison sorts cannot beat O(n log n) in general, and the standard libraries all reach it: Python uses **timsort** (stable, adaptive merge sort), Java uses dual-pivot quicksort for primitive arrays, C++ requires O(n log n) comparisons from `std::sort`, Rust offers a stable `sort` and a faster `sort_unstable` | verified |
| [sorting-family-catalog.md](sorting-family-catalog.md) | reference | Major comparison, distribution, adaptive, hybrid, external and parallel sorting families | verified |
| [sorting-benchmark-lab.md](sorting-benchmark-lab.md) | how-to | Reproduce a verified comparison of library, counting and radix sorts | verified |

## References
- [NIST Dictionary of Algorithms and Data Structures](https://xlinux.nist.gov/dads/) — NIST, living. Backs: topic scope.

## Related
- `algorithms/learning-path.md` — where this subtopic sits in the learning order.
- `performance/` — making real systems fast.
