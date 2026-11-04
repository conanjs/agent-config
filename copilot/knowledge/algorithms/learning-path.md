---
schema: knowledge-doc/v1
type: reference
topic: algorithms
status: verified
applies-to: ["the docs under knowledge/algorithms/ as of 2026-11-04"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [algorithms, learning-path, data-structures, curriculum]
---

# Algorithms and data structures learning path

## Summary
**TL;DR:** Five stages: complexity (how cost grows), data structures (what each is good at), sorting and searching, graphs, and design techniques (dynamic programming, greedy). Every doc includes a measurement you can rerun in the Linux lab, so each idea is backed by numbers, not just notation.
**Use this when:** you start learning algorithms for practical engineering, or want the next doc to read.
**Not this doc:** making real systems fast (caches, profiling, queueing) → `performance/learning-path.md`.

## Scope
The v1 docs under `knowledge/algorithms/`, ordered by dependency. Exercises run with Python 3 in the lab from `linux/lab-setup.md`.

## Catalog

### Stages

| # | Stage | Read | Exercise | Self-check: you can explain … |
|---|---|---|---|---|
| 1 | Complexity | `fundamentals/complexity-and-big-o.md` → `fundamentals/amortized-analysis.md` | Time list membership vs set membership at 1k, 10k, 100k items | … why a set lookup stays flat while a list scan grows 10× per 10× data |
| 2 | Data structures | `data-structures/data-structure-catalog.md` → `data-structures/hash-tables.md` → `data-structures/trees-heaps-and-b-trees.md` | Build a dict with a constant `__hash__`; run `EXPLAIN QUERY PLAN` before and after `CREATE INDEX` in SQLite | … what a load factor is and what a database index does |
| 3 | Sorting & searching | `sorting-searching/sorting-algorithms.md` | Count comparisons of `sorted()` on random vs sorted input | … stability, and why timsort is fast on nearly sorted data |
| 4 | Graphs | `graphs/graph-algorithms.md` | Order a small build graph with `graphlib`; add a cycle | … when to use BFS vs Dijkstra, and what a topological sort needs |
| 5 | Techniques | `techniques/dynamic-programming-and-greedy.md` | Memoize a recursive function and read `cache_info()` | … why memoization turns exponential into linear, and when greedy fails |

### Free, authoritative resources

| Resource | Why |
|---|---|
| [NIST Dictionary of Algorithms and Data Structures](https://xlinux.nist.gov/dads/) | Precise definitions for every term in these docs |
| [MIT 6.006 Introduction to Algorithms (OCW)](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/) | Free lectures, notes and problem sets |
| [Python standard library](https://docs.python.org/3/library/) (`bisect`, `heapq`, `collections`, `graphlib`, `functools`) | Production implementations with documented complexity |

### Not yet covered in this knowledge base

| Topic | Fits under | Start with |
|---|---|---|
| Tries, union-find, segment trees, Bloom filters | `data-structures/` | NIST DADS entries |
| String algorithms (KMP, rolling hash, suffix arrays) | new `strings/` subtopic | MIT 6.006 / 6.046 |
| Minimum spanning trees, max flow | `graphs/` | MIT 6.046 |
| Randomized and approximation algorithms | `techniques/` | MIT 6.046 |
| Concurrent data structures | link with `concurrency/` | language runtime docs |

## Lookup notes
- Measurements were taken on one machine (Apple M2 host, Linux 6.17 VM, Python 3.12); ratios between sizes matter more than absolute times.

## Takeaways
- Learn complexity first; every later choice is a complexity trade-off.
- Rerun each stage's exercise yourself and compare growth ratios with the doc.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 0 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [NIST Dictionary of Algorithms and Data Structures](https://xlinux.nist.gov/dads/) — NIST, living. Backs: resources table.
- [MIT 6.006 Introduction to Algorithms, Spring 2020](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/) — MIT OpenCourseWare, 2020. Backs: resources table.
- `linux/lab-setup.md` — the lab every exercise runs in.

## Related
- `performance/learning-path.md` — the systems side of speed.
- `linux/learning-path.md` — the operating system underneath.
