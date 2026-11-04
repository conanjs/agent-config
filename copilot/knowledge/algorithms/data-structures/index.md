---
schema: topic-index/v1
kind: subtopic
topic: algorithms/data-structures
last-updated: 2026-11-04
---

# Data structures

Operation costs of common structures, hash tables (hashing, collisions, load factor), and trees, heaps and B-trees (priority queues, top-k, database indexes). Not covered: tries, union-find, Bloom filters.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [data-structure-catalog.md](data-structure-catalog.md) | reference | A lookup table of what each common data structure is good and bad at — access, search, insert, delete, ordered iteration — with the typical (average) and worst-case costs, and the Python built-in that implements it | verified |
| [hash-tables.md](hash-tables.md) | concept | A hash table maps each key to an array position computed by a **hash function**, so lookup, insert and delete are O(1) on average | verified |
| [trees-heaps-and-b-trees.md](trees-heaps-and-b-trees.md) | concept | Trees keep data **ordered** so that search, insert and range queries cost O(log n) when the tree stays balanced | verified |

## References
- [NIST Dictionary of Algorithms and Data Structures](https://xlinux.nist.gov/dads/) — NIST, living. Backs: topic scope.

## Related
- `algorithms/learning-path.md` — where this subtopic sits in the learning order.
- `performance/` — making real systems fast.
