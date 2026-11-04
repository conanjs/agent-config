---
schema: knowledge-doc/v1
type: reference
topic: algorithms/data-structures
status: verified
applies-to: ["any language", "Python built-ins as concrete examples"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [algorithms, data-structures, complexity, cheat-sheet, array, linked-list, hash-table, heap, tree, deque]
---

# Data structure operation costs

## Summary
**TL;DR:** A lookup table of what each common data structure is good and bad at — access, search, insert, delete, ordered iteration — with the typical (average) and worst-case costs, and the Python built-in that implements it.
**Use this when:** you choose a structure for a workload or check whether an operation in a hot loop is O(1), O(log n) or O(n).
**Not this doc:** why these costs arise → the concept docs linked in Related.

## Scope
Standard in-memory structures as taught and as implemented in mainstream runtimes. Costs are average case unless marked; n = number of elements. Rows backed by a source or a lab measurement carry a marker in the Source column.

## Catalog

### Core structures

| Structure | Access by index | Search by value | Insert | Delete | Ordered iteration | Source |
|---|---|---|---|---|---|---|
| Dynamic array (Python `list`) | O(1) | O(n) | Append amortized O(1); middle O(n) | End O(1); middle O(n) | Only if kept sorted | Over-allocation rule ✅[^1]; scan O(n) measured ✅[^5] |
| Sorted array + binary search (`bisect`) | O(1) | O(log n) | O(n) (shift) | O(n) | Yes | ✅[^2] |
| Linked list | O(n) | O(n) | O(1) at a known node | O(1) at a known node | Insertion order | Pointer structure; poor cache locality (see `performance/hardware/memory-hierarchy-and-caches.md`) |
| Hash table (`dict`, `set`) | — | O(1) avg, O(n) worst | O(1) avg, amortized | O(1) avg | No (insertion order in CPython dicts) | ✅[^3] ✅[^5] |
| Binary heap (`heapq`) | Min only, O(1) | O(n) | O(log n) | Pop min O(log n) | No | ✅[^4] |
| Balanced search tree / B-tree | O(log n) | O(log n) | O(log n) | O(log n) | Yes, plus ranges | See `data-structures/trees-heaps-and-b-trees.md` |
| Double-ended queue (`collections.deque`) | O(n) in the middle | O(n) | O(1) at either end | O(1) at either end | Insertion order | ✅[^6] |

### Pick by workload

| Workload | Use | Avoid |
|---|---|---|
| "Have I seen this key?" | Hash set | List membership (`x in list`) |
| FIFO queue | `deque` | `list.pop(0)` (O(n) shift) |
| Priority queue / top-k | Heap | Re-sorting after each insert |
| Ordered data with range queries | Sorted array (read-mostly) or B-tree/balanced tree | Hash table |
| Counting occurrences | Hash map (`collections.Counter`) | Nested loops |

## Lookup notes
- "Amortized O(1)" means occasional O(n) steps; see `fundamentals/amortized-analysis.md`.
- Hash-table worst cases come from collisions (lab: 38× slower with a constant hash) ✅[^5].
- Big-O hides constants: a contiguous array often beats a linked list even where both are O(n), because of CPU caches.

## Takeaways
- Map each hot operation to its row before choosing a structure.
- Replace `x in list` inside loops with a set, and `list.pop(0)` with `deque.popleft()`.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 8 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Objects/listobject.c](https://github.com/python/cpython/blob/main/Objects/listobject.c) — CPython project, read 2026-11-04. Backs: proportional over-allocation behind amortized appends. [^1]
- [bisect — Array bisection algorithm](https://docs.python.org/3/library/bisect.html) — Python Software Foundation, living. Backs: logarithmic search; `insort` O(n). [^2]
- [hash table](https://xlinux.nist.gov/dads/HTML/hashtab.html) — NIST DADS, living. Backs: hash table definition and collisions. [^3]
- [heapq — Heap queue algorithm](https://docs.python.org/3/library/heapq.html) — Python Software Foundation, living. Backs: heap invariant, smallest element at index 0. [^4]
- `linux/lab-setup.md` — the lab where list-scan, set and collision measurements ran on 2026-11-04 (Python 3.12.13). [^5]
- [collections.deque](https://docs.python.org/3/library/collections.html#collections.deque) — Python Software Foundation, living. Backs: O(1) appends and pops from either end; O(n) access in the middle. [^6]

## Related
- `algorithms/fundamentals/complexity-and-big-o.md`
- `algorithms/data-structures/hash-tables.md`
- `algorithms/data-structures/trees-heaps-and-b-trees.md`
