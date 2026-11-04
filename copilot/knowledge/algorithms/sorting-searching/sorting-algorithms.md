---
schema: knowledge-doc/v1
type: concept
topic: algorithms/sorting-searching
status: verified
applies-to: ["CPython timsort", "Java Arrays.sort", "Rust slice::sort", "C++ std::sort"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [algorithms, sorting, timsort, quicksort, mergesort, stability, adaptive, comparisons]
---

# Sorting algorithms in practice: complexity, stability and adaptivity

## Summary
**TL;DR:** Comparison sorts cannot beat O(n log n) in general, and the standard libraries all reach it: Python uses **timsort** (stable, adaptive merge sort), Java uses dual-pivot quicksort for primitive arrays, C++ requires O(n log n) comparisons from `std::sort`, Rust offers a stable `sort` and a faster `sort_unstable`. Two properties matter as much as speed: **stability** (equal keys keep their input order, which makes multi-key sorting easy) and **adaptivity** (exploiting existing order). In the lab, timsort sorted 1 000 000 already-sorted floats 5× faster than random ones, needing exactly n − 1 comparisons.
**Use this when:** you choose or call a sort, sort by several keys, sort nearly-sorted data, or explain why a hand-written sort is slower than the library's.
**Not this doc:** growth rates → `fundamentals/complexity-and-big-o.md`; top-k without a full sort → `data-structures/trees-heaps-and-b-trees.md`.

## Problem
Hand-rolled sorts are slower and often unstable; multi-key sorts get done with fragile composite keys; and people assume sorting nearly-sorted data costs the same as random data. Knowing what the library sort guarantees avoids all three.

## Mental model
**Analogy:** sorting a hand of cards. Merge sort splits the hand, sorts each half and zips them together. Quicksort picks a card as a pivot and throws smaller cards left and larger right, then repeats on each side. Timsort first looks for runs that are already in order (like a hand dealt mostly sorted) and merges those runs, so an already sorted hand costs just one look at each card.

**Artifact:** timsort on different inputs (lab, Python 3.12.13, n = 1 000 000; comparisons counted on the first 100 000 items with a counting `__lt__`, 2026-11-04) ✅[^5]:
```text
random                       154.4 ms   comparisons for first 100k: 1,529,321   (≈ n·log2 n = 1.66 M)
sorted                        31.5 ms   comparisons for first 100k:    99,999   (n − 1)
reversed                      30.9 ms   comparisons for first 100k:    99,999
nearly sorted (100 swaps)     32.4 ms   comparisons for first 100k:   101,133
```

## How it works
**Library sorts:**

| Library | Algorithm / guarantee |
|---|---|
| Python `sorted`, `list.sort` | Timsort: "adaptive, stable, natural mergesort"; as few as N − 1 comparisons on ordered input ✅[^1]; stability guaranteed ✅[^2] |
| Java `Arrays.sort` (primitives) | Dual-Pivot Quicksort, O(n log n) on all data sets ✅[^3] |
| C++ `std::sort` | O(N·log N) comparisons (since C++11) ✅[^4] |
| Rust `slice::sort_unstable` | In place, may reorder equal elements ✅[^6] |

**Timsort in steps** ✅[^1]:
1. Scan for natural **runs** (ascending, or strictly descending ones that it reverses); extend short runs with binary insertion sort to a minimum length.
2. Push runs on a stack and **merge** them, keeping run lengths balanced.
3. When one run keeps "winning" during a merge, switch to **galloping mode**: search ahead for where the next element belongs and copy whole chunks at once.

**Quicksort's caveat:** Θ(n²) in the worst case, typically O(n log n), and in practice a tuned quicksort beats most sorts ✅[^7]; libraries guard against the worst case with pivot strategies or a fallback.

**Stability** means the relative order of items with equal keys is preserved ✅[^8]. Lab, sorting `(name, age)` records by age ✅[^5]:
```text
input : ('bob',30) ('alice',25) ('carol',30) ('dave',25)
output: ('alice',25) ('dave',25) ('bob',30) ('carol',30)     # alice before dave, bob before carol — input order kept
```

## Worked example
Sort employees by department, then by salary descending inside each department, using stability:

| Step | Call | Result order |
|---|---|---|
| 1 | `rows.sort(key=lambda r: r.salary, reverse=True)` | All rows by salary, highest first |
| 2 | `rows.sort(key=lambda r: r.dept)` | Grouped by department; within a department the salary order from step 1 survives because the sort is stable ✅[^2] |

Sort by the **least** significant key first and the most significant last. With an unstable sort (e.g. Rust `sort_unstable`) step 2 could scramble the salary order ✅[^6].

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Already sorted or reversed input to timsort | ≈ O(n) | Natural runs ✅[^1] ✅[^5] |
| Nearly sorted (100 swaps in 1 M) | 32 ms vs 154 ms random | Long runs remain ✅[^5] |
| Hand-written quicksort on sorted input with first-element pivot | Θ(n²) | Worst case ✅[^7] |
| Sorting objects whose comparison is expensive | Comparison count dominates | Timsort minimizes comparisons ✅[^1] |
| Need only the top k | Full sort wastes work | Use a heap (see trees doc) |

## Takeaways
- Use the standard library sort; do not write your own. [rule-candidate]
- Sort by multiple keys with successive stable sorts (least significant key first) or a tuple key.
- Expect huge speed-ups on nearly-sorted data with adaptive sorts — and exploit them by appending then sorting.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 17 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [listsort.txt](https://github.com/python/cpython/blob/main/Objects/listsort.txt) — Tim Peters, CPython project, living. Backs: adaptive stable natural mergesort, N − 1 comparisons on ordered data, runs, galloping. [^1]
- [Sorting Techniques](https://docs.python.org/3/howto/sorting.html) — Python Software Foundation, living. Backs: sorts are guaranteed to be stable; multi-pass sorting. [^2]
- [java.util.Arrays](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Arrays.html) — Oracle, Java SE 21. Backs: Dual-Pivot Quicksort with O(n log n) on all data sets. [^3]
- [std::sort](https://en.cppreference.com/w/cpp/algorithm/sort) — cppreference.com, living. Backs: O(N·log N) comparisons. [^4]
- `linux/lab-setup.md` — the lab where the timsort timings, comparison counts and stability example ran on 2026-11-04 (Python 3.12.13). [^5]
- [slice primitive: sort_unstable](https://doc.rust-lang.org/std/primitive.slice.html) — Rust project, living. Backs: unstable, in-place sort that may reorder equal elements. [^6]
- [quicksort](https://xlinux.nist.gov/dads/HTML/quicksort.html) — NIST DADS, living. Backs: Θ(n²) worst case, typically O(n log n), practical speed. [^7]
- [stable](https://xlinux.nist.gov/dads/HTML/stable.html) — NIST DADS, living. Backs: definition of a stable algorithm. [^8]

## Related
- `algorithms/fundamentals/complexity-and-big-o.md` — O(n log n) and O(n²) measured.
- `algorithms/data-structures/trees-heaps-and-b-trees.md` — heaps for top-k.
