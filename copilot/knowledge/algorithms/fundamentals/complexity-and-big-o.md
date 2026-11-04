---
schema: knowledge-doc/v1
type: concept
topic: algorithms/fundamentals
status: verified
applies-to: ["any language", "measurements: Python 3.12 on Linux 6.17 (arm64)"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [algorithms, complexity, big-o, asymptotic, scaling, binary-search, hashing]
---

# Time complexity and Big-O, measured

## Summary
**TL;DR:** Big-O describes how an algorithm's cost **grows** with input size n, ignoring constant factors: O(1) stays flat, O(log n) grows by a step each time n doubles, O(n) doubles when n doubles, O(n log n) slightly more than doubles, O(n²) quadruples. The measurements in this doc show exactly that: 1 000 lookups in a 100 000-element list took 269 ms (O(n) each), in the sorted list with binary search 0.26 ms (O(log n)), and in a set 0.04 ms (O(1)).
**Use this when:** you choose a data structure or algorithm, estimate how code will behave at 10× or 1000× the data, or read complexity notes in library documentation.
**Not this doc:** costs averaged over many operations → `fundamentals/amortized-analysis.md`; per-operation costs of common structures → `data-structures/data-structure-catalog.md`.

## Problem
Code that is instant on test data becomes unusable in production because its cost grows faster than the data. A loop inside a loop over 1 000 items is a million steps; over 1 000 000 items it is a trillion. Constant-factor tuning cannot rescue the wrong growth rate.

## Mental model
**Analogy:** finding a word. Reading every page of a dictionary from the start is O(n). Opening it in the middle and halving the remaining range each time is O(log n): a 1 000-page dictionary needs about 10 openings, a million-page one about 20. Knowing the exact page number in advance (a hash) is O(1).

**Artifact:** the measurement script's core and its output (lab: Python 3.12.13, Linux 6.17.8, Apple M2 host, 2026-11-04) ✅[^3]:
```python
data = list(range(n)); s = set(data); keys = [random.randrange(n) for _ in range(1000)]
[k in data for k in keys]                    # list scan, O(n) each
[bisect.bisect_left(data, k) for k in keys]  # binary search, O(log n) each
[k in s for k in keys]                       # hash lookup, O(1) average each
```
```text
n=    1,000  list scan      2.61 ms   binary search  0.130 ms   set  0.031 ms
n=   10,000  list scan     28.27 ms   binary search  0.159 ms   set  0.033 ms
n=  100,000  list scan    269.48 ms   binary search  0.256 ms   set  0.039 ms
n=1,000,000  (not run)               binary search  0.358 ms   set  0.039 ms
```

## How it works
1. **Definition:** Big-O is a theoretical measure of the time or memory an algorithm needs as a function of the problem size n; f(n) = O(g(n)) means f grows no faster than a constant multiple of g for large n ✅[^1].
2. **Count the dominant work:** a single loop over n items is O(n); a loop inside a loop is O(n²); halving the search range each step is O(log n) ✅[^2].
3. **Drop constants and smaller terms:** 3n² + 100n is O(n²); at large n the n² term dominates.
4. **Average vs worst case:** hash lookups are O(1) on average, assuming a hash function that spreads keys well ✅[^5]; quicksort is typically O(n log n) but Θ(n²) in the worst case ✅[^6].

**Common growth rates and what doubling n does:**

| Class | Example | n → 2n | Measured here |
|---|---|---|---|
| O(1) | Hash table lookup | Same | Set: 0.031 → 0.039 ms over 1 000× more data ✅[^3] |
| O(log n) | Binary search | +1 step | 0.130 → 0.358 ms over 1 000× more data ✅[^3] |
| O(n) | Linear scan | ×2 | 2.6 → 28 → 269 ms per 10× n ✅[^3] |
| O(n log n) | Comparison sort | ×2.1 | `sorted()`: 11.1, 24.7, 63.1, 124.5 ms for 100k, 200k, 400k, 800k ✅[^3] |
| O(n²) | Insertion sort | ×4 | 10.1, 42.2, 162.1 ms for 1 000, 2 000, 4 000 items ✅[^3] |

## Worked example
A nightly job deduplicates customer IDs: for each of n new IDs, it checks `if id in seen_list`.

| n | List (O(n) per check → O(n²) total) | Set (O(1) per check → O(n) total) |
|---|---|---|
| 1 000 | 1 000 × ~2.6 µs scan ≈ 2.6 ms | ≈ 0.03 ms |
| 100 000 | 100 000 × ~270 µs ≈ 27 s | ≈ 4 ms |
| 1 000 000 | ≈ 45 min (×100 again) | ≈ 40 ms |

The per-check figures come from the measurements above (269 ms per 1 000 scans at n = 100 000 ✅[^3]); the larger rows are extrapolated by the growth rate. Changing one data structure turns a 45-minute job into a sub-second one.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Small n | An O(n²) algorithm can beat an O(n log n) one | Constants matter below the crossover point; library sorts use insertion sort for short runs ✅[^7] |
| Hash keys that collide | O(1) lookups degrade toward O(n) | See `data-structures/hash-tables.md` (lab: 38× slower with one shared hash) ✅[^3] |
| Already sorted input | Adaptive sorts run in O(n) | Timsort needs as few as n − 1 comparisons ✅[^7] |
| `bisect.insort` into a list | O(n), not O(log n) | The search is logarithmic but the insertion shifts elements ✅[^4] |
| Memory, not time | Space complexity grows too | Big-O applies to memory as well ✅[^1] |

## Takeaways
- Choose data structures by the operation you repeat most: membership tests → hash set; ordered range queries → sorted array/tree; FIFO → deque. [rule-candidate]
- Before shipping a loop over growing data, ask what happens at 100× the size.
- Measure at two or three sizes: the ratio between them reveals the growth rate faster than any analysis.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 16 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [big-O notation](https://xlinux.nist.gov/dads/HTML/bigOnotation.html) — NIST Dictionary of Algorithms and Data Structures, living. Backs: definition of Big-O for time or memory as a function of n. [^1]
- [binary search](https://xlinux.nist.gov/dads/HTML/binarySearch.html) — NIST DADS, living. Backs: halving the search interval each step. [^2]
- `linux/lab-setup.md` — the lab (Linux 6.17.8 VM on an Apple M2 host, Alpine 3.20, Python 3.12.13, GCC 13.2.1) where every measurement in this doc ran on 2026-11-04. [^3]
- [bisect — Array bisection algorithm](https://docs.python.org/3/library/bisect.html) — Python Software Foundation, living. Backs: logarithmic search step; `insort` is O(n) because insertion dominates. [^4]
- [java.util.HashMap](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/HashMap.html) — Oracle, Java SE 21. Backs: constant-time `get`/`put` assuming a hash function that disperses elements. [^5]
- [quicksort](https://xlinux.nist.gov/dads/HTML/quicksort.html) — NIST DADS, living. Backs: Θ(n²) worst case, typically O(n log n). [^6]
- [listsort.txt](https://github.com/python/cpython/blob/main/Objects/listsort.txt) — CPython project, living. Backs: timsort needs as few as N − 1 comparisons on ordered data; binary insertion sort for short runs. [^7]

## Related
- `algorithms/fundamentals/amortized-analysis.md` — when an occasional expensive step is fine.
- `algorithms/data-structures/data-structure-catalog.md` — operation costs at a glance.
- `performance/measurement/benchmarking-methodology.md` — how to measure growth reliably.
