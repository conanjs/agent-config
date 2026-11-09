---
schema: knowledge-doc/v1
type: reference
topic: algorithms
status: verified
applies-to: ["General comparison algorithms; Python 3.13.7 local experiment"]
last-verified: 2026-11-07
last-updated: 2026-11-07
---

# Selection, top-k, and merging ordered streams

## Summary
**TL;DR:** Match the work to the output contract. Finding one rank, returning a small ranked subset, and combining sorted streams need different algorithms.
**Use this when:** Ranking search results, selecting a percentile, or combining sorted files and shard results.

## Scope

Here `n` is the number of input items, `k` is the number of requested winners, `m` is the number of ordered streams, and `p` is the number of merged results consumed. Costs assume constant-time key comparisons. Big-O describes growth with input size. Define whether the output is ordered, whether all cutoff ties are included, and whether the input can be modified.

## Catalog

| Output and input | Method | Time and space | Operational trade-off |
|---|---|---|---|
| Fully ordered array | Comparison sort | Typically O(n log n) time for a general-purpose guaranteed sort. Auxiliary memory depends on the implementation. | Simple oracle and useful when most items are returned |
| Largest k from unsorted stream, ordered output | Bounded min-heap, then sort winners | O(n log(k+1) + k log(k+1)) worst-case time and O(k) auxiliary space | One pass. The root is the weakest current winner. |
| One rank, mutable random-access input | Iterative randomized Quickselect | Expected O(n) time under uniformly random pivots. Worst case O(n²). O(1) auxiliary space with in-place partitioning and constant-size random state. | May reorder the input. A defensive copy adds O(n) space. |
| Ordered largest k, mutable random-access input | Quickselect at the boundary, then sort winners | Expected O(n + k log(k+1)) time under uniformly random pivots | A rank partition does not establish order within either side |
| Prefix of a merge over m sorted streams | Min-heap of stream heads | O(m + p log(m+1)) time and O(m) state, excluding input/output buffers | Can stop after p items. Every stream must use the same ordering. |

✅ Hoare's Find partitions a sequence to establish a rank without sorting the whole array. Randomized selection has expected linear time under the stated pivot rule. Consistently extreme pivots can leave all but one element for the next iteration, yielding quadratic work. Three-way partitioning groups equal keys so that a pivot group covering the target rank terminates the selection. [Hoare's Find](https://courses.cs.vt.edu/~cs3114/Summer17/Notes/Supplemental/p321-hoare.pdf) · [Randomized selection analysis](https://people.orie.cornell.edu/vc333/orie5270/lectures/04/)

✅ Python documents that `heapq.merge` consumes sorted inputs lazily and that `nlargest` is best suited to small result counts. In a merge, initialize the heap with one head per nonempty stream, emit the smallest head, and advance only its stream. [Python 3.13 heap queue documentation](https://docs.python.org/3.13/library/heapq.html)

## Lookup notes

A bounded heap is like a waiting list that always shows its weakest admitted candidate. For scores `[9, 2, 7, 10]` and `k=2`, the final heap holds 9 and 10. To make ties reproducible, rank by a composite key such as `(score, -original_position)` for descending order with earlier positions preferred. This returns exactly k records. A contract that returns every cutoff tie can exceed k results.

To merge `[1, 7, 9]`, `[2, 3, 8]`, and `[4, 6]`, the first three results are `[1, 2, 3]`. A lower-is-better score can use the same min-heap structure. For a globally stable merge, include the relevant original order in the comparison key.

### Local check

✅ On 2026-11-07, CPython 3.13.7 on arm64 processed 100,000 tuples `(score, -original_position)` with scores drawn uniformly from 0 through 99 using seed 20261107. Each cell is the median of five wall-clock runs in milliseconds after one warmup. Sorted output was checked against a full-sort oracle every run. The Quickselect code used a Python loop, a three-way partition, a fresh fixed seed of 7, and a defensive copy. A fixed seed reproduces this workload but does not protect an exposed service against adversarial inputs.

| k | Full sort | Bounded heap via nlargest | Quickselect and sort winners |
|---:|---:|---:|---:|
| 10 | 12.79 | 1.86 | 21.38 |
| 1,000 | 12.47 | 3.94 | 21.62 |
| 50,000 | 12.72 | 50.47 | 49.53 |

This comparison includes result construction and any copy. It compares these implementations, including library versus Python-loop overhead. Allocation and streaming input costs were not measured. Check all-equal keys, a deterministic tie rule, empty input, and `k=0` alongside the representative distribution.

Copy this reproduction into `selection-check.py` and run it with `python3 selection-check.py`.

```python
from heapq import merge, nlargest
from random import Random
from statistics import median
from time import perf_counter
import platform

def select_largest(values, k):
    if not k:
        return []
    values = list(values)
    rng = Random(7)
    left, right = 0, len(values)
    target = k - 1
    while right - left > 1:
        pivot = values[rng.randrange(left, right)]
        greater = i = left
        smaller = right
        while i < smaller:
            if values[i] > pivot:
                values[greater], values[i] = values[i], values[greater]
                greater += 1
                i += 1
            elif values[i] < pivot:
                smaller -= 1
                values[smaller], values[i] = values[i], values[smaller]
            else:
                i += 1
        if target < greater:
            right = greater
        elif target >= smaller:
            left = smaller
        else:
            break
    return sorted(values[:k], reverse=True)

rng = Random(20261107)
records = [(rng.randrange(100), -i) for i in range(100_000)]
print(platform.python_version(), platform.machine())
for k in (10, 1000, 50000):
    expected = sorted(records, reverse=True)[:k]
    for name, fn in (
        ("full sort", lambda: sorted(records, reverse=True)[:k]),
        ("bounded heap", lambda: nlargest(k, records)),
        ("partition", lambda: select_largest(records, k)),
    ):
        assert fn() == expected
        elapsed = []
        for _ in range(5):
            start = perf_counter()
            actual = fn()
            elapsed.append((perf_counter() - start) * 1000)
            assert actual == expected
        print(k, name, round(median(elapsed), 2))
for records in ([], [3], [2, 2, 1, 2], list(range(100)), list(range(100, 0, -1))):
    for k in range(len(records) + 1):
        assert select_largest(records, k) == sorted(records, reverse=True)[:k]
assert list(merge([1, 7, 9], [2, 3, 8], [4, 6])) == [1, 2, 3, 4, 6, 7, 8, 9]
```

## Takeaways
- Use a bounded heap when input arrives incrementally and the winner list stays small.
- Compare full sort and selection when most of the input will be returned. Include the ordering and copy costs.
- Preserve a common ordering across streams and measure how many stream heads must be kept live.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 3 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-07

## References
- [Algorithm 65: Find](https://courses.cs.vt.edu/~cs3114/Summer17/Notes/Supplemental/p321-hoare.pdf) — C. A. R. Hoare, 1961. Backs: rank partitioning.
- [Randomized algorithms](https://people.orie.cornell.edu/vc333/orie5270/lectures/04/) — Cornell course notes. Backs: randomized selection analysis.
- [Heap queue algorithm](https://docs.python.org/3.13/library/heapq.html) — Python 3.13 documentation. Backs: bounded selection and lazy merge interfaces.
- Local benchmark, 2026-11-07 — workload, environment, seed and measurements above.

## Related
- [Sorting algorithms](sorting-searching/sorting-algorithms.md)
- [Choosing algorithms and representations](workload-selection.md)
