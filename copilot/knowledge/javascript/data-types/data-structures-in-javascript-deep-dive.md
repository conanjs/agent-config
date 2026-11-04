---
schema: deep-dive/v1
topic: javascript/data-types
status: verified
applies-to: ["ECMAScript 2025", "Node.js 24 (V8 13.6) for every measurement"]
last-updated: 2026-11-04
last-verified: 2026-11-04
synthesized-into: []
tags: [javascript, data-structures, algorithms, v8, elements-kinds, array, map, set, queue, heap, priority-queue, trie, linked-list, typed-arrays, sorting, binary-search, big-o]
---

# Data structures and algorithms in JavaScript, end to end

## Summary
**TL;DR:** JavaScript ships only a few built-in structures — `Array`, `Map`, `Set`, their weak variants and typed arrays — so stacks, queues, heaps, tries, linked lists and graphs are built from them. Which choice is fast depends on V8 internals as much as on Big-O: arrays are stored in different **elements kinds** (small integers, doubles, generic, holey, dictionary) that only ever generalize; `Array.prototype.shift` re-copies the array once it is large (a 100 000-item queue took **1.9 s** to drain with `shift` and **1.7 ms** with a head index); `Set.has` stays flat while `includes` grows linearly; `Map` beats objects for churning dynamic keys; and typed arrays are about 5× faster than plain arrays for numeric bulk work. The language guarantees a **stable** `sort` since ES2019, but its default comparison is by string.
**Use this when:** choosing a data structure in JavaScript, implementing a queue, priority queue, trie or graph search, sorting or searching large data, or explaining a performance cliff in array code; or reading JavaScript data-structures-and-algorithms books and wanting a verified, open-source-based companion.
**Depth:** V8 elements kinds observed with V8 internals; measured membership, queue, key-churn, front-insertion and numeric bulk costs; sorting rules (stability, string default, `undefined` and holes, locale); binary search; heap/priority queue and top-k measured; trie; linked list; typed array overflow rules; how this extends the language-neutral `algorithms/` topic; a decision table and failure matrix. Every measurement is a single run on an Apple M2 host (✅[^2]); compare ratios, not absolute times.

## 1. The building blocks

| Built-in | Best for | Avoid for |
|---|---|---|
| `Array` | Ordered data, stack (`push`/`pop`), iteration | Large FIFO queues via `shift`, membership tests at scale, front insertion |
| `Map` | Dictionaries with dynamic or non-string keys, frequent add/delete | JSON payloads (needs conversion) |
| `Set` | Membership, deduplication, set algebra (ES2025 methods) | Ordered or indexed access |
| `WeakMap` / `WeakSet` | Metadata or caches keyed by objects | Iteration, primitive keys |
| Typed arrays | Large numeric data, binary protocols, workers | Mixed values, growing collections |

Language-neutral background — Big-O, amortized cost, hash tables, heaps, B-trees, sorting and graphs — lives in `algorithms/`; this dive covers what is specific to JavaScript and V8 ✅[^1].

## 2. How V8 stores arrays: elements kinds

V8 tracks each array's **elements kind** to pick fast machine code ✅[^3]. Observed with `node --allow-natives-syntax` ✅[^2]:

| Array | Kind |
|---|---|
| `[1, 2, 3]` | Packed small integers (SMI), not holey |
| `[1, 2, 3.5]` | Doubles |
| `[1, 'a']` | Generic elements (any value) |
| `[1, , 3]` literal with a hole | Holey |
| `[1, 2, 3]` then `a[10] = 4` | Becomes holey |
| `a[1e6] = 1` on an empty array | Dictionary (hash table) elements |

Kinds move only in one direction, from specific to general: after `[1, 2, 3.5].pop()` the array still has double elements, not SMI ✅[^2] ✅[^3]. Practical consequences: create arrays at their final size with values (or `push` into an empty one), avoid holes and `new Array(n)` followed by sparse writes, and do not mix types in hot numeric arrays ✅[^3]. Object property layout has a similar story: `js-runtime/v8-hidden-classes.md`.

## 3. Measured costs that drive the choice

### 3.1 Membership: `Array.includes` versus `Set.has` (1000 lookups) ✅[^2]

| n | `includes` (ms) | `Set.has` (ms) |
|---|---|---|
| 1 000 | 0.54 | 0.10 |
| 10 000 | 1.06 | 0.05 |
| 100 000 | 9.99 | 1.43 |
| 1 000 000 | 95.11 | 0.13 |

`includes` is O(n) per lookup; `Set.has` is O(1) on average (hash table) ✅[^4]. Build a `Set` once when you test membership repeatedly.

### 3.2 FIFO queue: `shift` versus a head index ✅[^2]

| n items pushed then drained | `Array.shift` (ms) | Head index (ms) |
|---|---|---|
| 10 000 | 2.51 | 0.44 |
| 100 000 | **1926.23** | 1.65 |

Ten times the data cost ~770× the time with `shift`: removing the first element moves the rest (V8 avoids the copy only for smaller arrays), so draining is quadratic ✅[^2]. Use a head index (`q[head++]`, compacting occasionally), a ring buffer, or a linked list.

### 3.3 Dynamic keys: object versus `Map` ✅[^2]

Inserting then deleting 200 000 string keys: object 82 ms, `Map` 33 ms. `delete` pushes objects into slow dictionary mode; `Map` is designed for frequent additions and removals ✅[^4].

### 3.4 Front insertion: `unshift` versus a linked list ✅[^2]

50 000 inserts at the front: `Array.unshift` 436 ms, linked list (`head = {v, next: head}`) 0.5 ms. Arrays win for indexing and iteration; linked lists only for frequent front or middle insertions with a known node.

### 3.5 Numeric bulk work: typed arrays ✅[^2]

Filling and summing 10⁷ doubles: `Float64Array` 27 ms, plain array with `push` 134 ms, identical sums. Typed arrays have a fixed length and element type, stored as raw machine numbers ✅[^5]. Writes are converted: `Uint8Array([256, -1, 3.7])` stores `[0, 255, 3]` (wraps, truncates); `Uint8ClampedArray` stores `[255, 0, 4]` (clamps, rounds) ✅[^2] ✅[^5].

## 4. Sorting

| Rule | Evidence |
|---|---|
| `sort` is **stable** (equal keys keep their order) — required since ES2019; V8 uses TimSort | Records sorted by `k` kept `b, d, a, c` order ✅[^2] ✅[^6] |
| Without a comparator, elements are compared **as strings**: `[10, 9, 1]` → `1,10,9` | ✅[^2] ✅[^7] |
| `undefined` values are moved to the end and holes after them (`[3, undefined, 1, , 2]` → `[1, 2, 3, undefined, <hole>]`) | ✅[^2] ✅[^7] |
| Comparators must be consistent (`a - b`); random comparators give engine-dependent order and are not a shuffle (use Fisher–Yates) | ✅[^7] |
| Human text: `localeCompare` sorts `é` next to `e` (`a, e, é, z`) instead of after `z` | ✅[^2] |
| `toSorted` sorts a copy (ES2023) | ✅[^2] |

TimSort is adaptive: nearly sorted input sorts in close to linear time ✅[^6]; measured behaviour of library sorts across languages: `algorithms/sorting-searching/sorting-algorithms.md`.

## 5. Searching

**Binary search** on a sorted array of 10⁶ even numbers found 777776 at index 388888 and reported −1 for 777777 ✅[^2]. Use `(lo + hi) >>> 1` for the midpoint, and only on sorted data; for repeated exact lookups a `Map`/`Set` is simpler and O(1).

## 6. Structures you build yourself

### 6.1 Stack and queue
- **Stack:** `push`/`pop` on an array — amortized O(1) ✅[^1].
- **Queue:** head index or ring buffer (§3.2).

### 6.2 Binary heap / priority queue

JavaScript has no built-in priority queue. A binary min-heap in an array (parent of `i` at `(i - 1) >> 1`, children at `2i + 1`, `2i + 2`) gives O(log n) `push`/`pop` ✅[^1] ✅[^8]. Lab: 1000 random values pushed and popped came out sorted (`true`) ✅[^2]. **Top-k:** keeping only the 10 largest of 10⁶ values in a size-10 heap took 34 ms versus 362 ms for a full sort, with the same answer ✅[^2].

### 6.3 Trie

A tree of nested objects keyed by character, with an end marker, answers prefix queries: after adding `car, cart, care, dog`, the prefix `car` returned `["car", "cart", "care"]` ✅[^2] ✅[^8]. Use `Map` nodes when keys can collide with object prototype names, or `Object.create(null)` nodes.

### 6.4 Graphs

Store adjacency as `Map<node, node[]>`; BFS with a head-index queue, Dijkstra with the heap above, topological sort with in-degree counts — algorithms and measurements in `algorithms/graphs/graph-algorithms.md` ✅[^1].

## 7. Decision table

| Need | Use |
|---|---|
| Ordered list, iterate, push/pop | `Array` (packed, one type) |
| Membership or dedupe | `Set` |
| Key → value, keys change often or are not strings | `Map` |
| Object-keyed metadata without leaks | `WeakMap` |
| FIFO queue | Array + head index, or ring buffer |
| Priority queue, top-k, scheduling | Binary heap |
| Prefix search, autocomplete | Trie |
| Large numeric arrays, binary data | Typed arrays |
| Big integers | `BigInt` (`javascript/misc/bigint-unicode-and-weakrefs.md`) |

## 8. Failure matrix

| Symptom | Cause | Fix |
|---|---|---|
| Queue processing slows down sharply as it grows | `shift` copies large arrays | Head index or ring buffer |
| Membership checks dominate a profile | `includes` in a loop | Build a `Set` |
| Object used as a cache gets slow after deletions | Dictionary mode after `delete` | `Map` |
| Numbers sort as `1, 10, 9` | Default string comparison | `(a, b) => a - b` |
| "Shuffle" with `sort(() => Math.random() - 0.5)` is biased | Inconsistent comparator | Fisher–Yates |
| Numeric array code slower after one string or hole sneaks in | Elements kind generalized permanently | Keep hot arrays packed and single-typed; rebuild if needed |
| Values wrap in a `Uint8Array` | Modular conversion | `Uint8ClampedArray` or a wider type |

## 9. How this deep dive was built
- **Sources:** V8's blog posts on elements kinds and on `Array.prototype.sort`, MDN (`Array`, `Map`, `Set`, typed arrays, `sort`), the ECMAScript specification, and the MIT-licensed *JavaScript Algorithms and Data Structures* repository for reference implementations. It covers the subjects of the JavaScript data-structures-and-algorithms books from these open sources only.
- **Reconciled with:** the language-neutral `algorithms/` topic (measured in Python), which this dive extends with V8-specific behaviour.
- **Verified:** `node --allow-natives-syntax` in `node:24.22.1-alpine` on 2026-11-04 (lab file `dsa.js`).

## References
- `algorithms/learning-path.md` — the language-neutral algorithms topic: complexity, amortized cost, hash tables, heaps, sorting and graphs. [^1]
- `linux/lab-setup.md` — the Node.js 24.22.1 lab where every ✅[^2] measurement ran on 2026-11-04. [^2]
- [Elements kinds in V8](https://v8.dev/blog/elements-kinds) — Mathias Bynens, V8 team, 2017. Backs: SMI/double/generic and packed/holey kinds, one-way transitions, advice. [^3]
- [Keyed collections](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Keyed_collections) — MDN, living. Backs: `Map` vs object trade-offs, `Set` membership. [^4]
- [JavaScript typed arrays](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Typed_arrays) — MDN, living. Backs: fixed-type buffers, conversion and clamping. [^5]
- [Getting things sorted in V8](https://v8.dev/blog/array-sort) — Simon Zünd, V8 team, 2018. Backs: TimSort, stability, adaptivity. [^6]
- [Array.prototype.sort()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort) — MDN, living. Backs: string default, `undefined` and holes, comparator requirements, stability since ES2019. [^7]
- [JavaScript Algorithms and Data Structures](https://github.com/trekhleb/javascript-algorithms) — Oleksii Trekhleb, MIT. Backs: reference implementations of heaps, tries, linked lists and graph algorithms. [^8]

## Related
- `algorithms/` — language-neutral algorithms and data structures.
- `javascript/data-types/arrays-and-iterables.md`
- `javascript/data-types/maps-sets-and-weak-collections.md`
- `js-runtime/v8-hidden-classes.md`
