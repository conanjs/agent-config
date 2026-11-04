---
schema: knowledge-doc/v1
type: concept
topic: algorithms/fundamentals
status: verified
applies-to: ["dynamic arrays in any language", "measurements: CPython 3.12"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [algorithms, amortized-analysis, dynamic-array, over-allocation, resizing, append]
---

# Amortized analysis: why appending to a dynamic array is O(1)

## Summary
**TL;DR:** Some operations are usually cheap but occasionally expensive — appending to a growable array copies everything when the array runs out of room. **Amortized** cost spreads that occasional cost over all the operations: if the capacity grows by a constant **factor** (not a constant amount), the total copying for n appends is O(n), so each append costs O(1) on average. CPython's list grows by about 1/8 plus a small constant each time; in the lab, 70 appends caused only 9 resizes.
**Use this when:** you reason about append-heavy code, see occasional latency spikes from resizing, pre-size buffers, or read "amortized O(1)" in documentation.
**Not this doc:** growth rates in general → `fundamentals/complexity-and-big-o.md`.

## Problem
A program that appends to an array in a loop looks O(1) per step, but a few appends take far longer than the others because they reallocate and copy. Without amortized reasoning, people either fear all appends (and pre-allocate needlessly) or miss the spike that matters for latency-sensitive code.

## Mental model
**Analogy:** moving house when your flat is full. If you always move to a flat **twice** as big, you move rarely, and the total boxes you have ever carried is at most about twice what you own now. If you always move to a flat with just **one** extra room, you move constantly and carry everything every time.

**Artifact:** CPython's growth rule in `list_resize` and the capacities it produced (lab, Python 3.12.13, 2026-11-04):
```c
new_allocated = ((size_t)newsize + (newsize >> 3) + 6) & ~(size_t)3;   /* ≈ newsize × 1.125 + 6, rounded to a multiple of 4 */
```
✅[^1]
```text
len → capacity: (1, 4) (5, 8) (9, 16) (17, 24) (25, 32) (33, 40) (41, 52) (53, 64) (65, 76)
```
✅[^2] — 70 appends, 9 reallocations.

## How it works
**3 actors:**
- **Caller** — its job: append items one at a time.
- **Dynamic array** — its job: keep `size` items in a buffer of `capacity` slots, and grow the buffer when `size == capacity`.
- **Allocator** — its job: provide a larger buffer; the array copies existing items into it.

1. **Cheap case:** while `size < capacity`, an append writes one slot — O(1).
2. **Expensive case:** when full, allocate a larger buffer and copy all `size` items — O(n) for that one append.
3. **Geometric growth:** if capacity is multiplied by a factor r > 1 each time, resizes happen at sizes c, c·r, c·r², …; the total items copied up to n is at most n·r/(r − 1) — a constant times n. Spread over n appends, that is O(1) each — the amortized cost; the measured capacities grow proportionally as this requires ✅[^1] ✅[^2].
4. **Additive growth is the trap:** adding a fixed k slots each time causes n/k resizes copying about n²/(2k) items in total — O(n) per append on average.
5. **CPython's factor** is ≈ 1.125 (plus a constant), small to save memory; still geometric, so still amortized O(1) ✅[^1].

## Worked example
Copy cost for 1 000 000 appends, starting from capacity 4:

| Strategy | Number of resizes | Items copied in total | Per append |
|---|---|---|---|
| Double (r = 2) | ≈ 18 | < 2 000 000 (4 + 8 + … + 524 288 + …) | ≈ 2 copies |
| CPython (r ≈ 1.125) | ≈ 100 | ≈ n·r/(r − 1) ≈ 9 000 000 | ≈ 9 copies |
| Add 1 000 slots each time | ≈ 1 000 | ≈ 500 000 000 | ≈ 500 copies |

Rows 1 and 2 follow from the geometric-series bound in step 3; row 3 from the arithmetic series. The CPython rule matches the capacities measured above ✅[^2].

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Latency-critical loop | One append occasionally takes O(n) | Amortized ≠ worst case; pre-size (e.g. `reserve` in C++/Rust, `[None] * n` in Python) if every step must be fast |
| Very large arrays | A resize temporarily needs old + new buffers | Copying requires both allocated |
| Shrinking after deletes | Many implementations keep capacity | Avoids thrashing between grow and shrink |
| Persistent / immutable arrays | Each append may copy | No in-place growth |

## Takeaways
- Grow buffers geometrically, never by a fixed amount. [rule-candidate]
- Pre-allocate when the final size is known or when per-operation latency, not throughput, matters.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 6 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Objects/listobject.c](https://github.com/python/cpython/blob/main/Objects/listobject.c) — CPython project, read 2026-11-04. Backs: the `new_allocated` over-allocation formula. [^1]
- `linux/lab-setup.md` — the lab where `sys.getsizeof` was used on 2026-11-04 to record list capacities (Python 3.12.13). [^2]

## Related
- `algorithms/fundamentals/complexity-and-big-o.md` — growth rates.
- `algorithms/data-structures/data-structure-catalog.md` — which operations are amortized.
