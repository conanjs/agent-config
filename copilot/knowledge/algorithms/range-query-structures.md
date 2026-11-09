---
schema: knowledge-doc/v1
type: reference
topic: algorithms
status: verified
applies-to: ["General array algorithms; CPython 3.13.7 local experiment"]
last-verified: 2026-11-07
last-updated: 2026-11-07
---

# Range-query structures for static and changing arrays

## Summary
**TL;DR:** Scan for occasional or narrow ranges, use a prefix array for frequent sums over static data, and consider Fenwick or segment trees when points change between queries.
**Use this when:** Computing totals, minima, or other aggregates over indexed intervals.

## Scope

The input is an array of `n` values, such as sales totals indexed by day. A query `[left, right)` covers `left` up to but excluding `right`. Its width `w` is `right - left`. A point update changes one value. Costs assume constant-time numeric or aggregate operations.

## Catalog

| Structure | Range query | Point update | Build | Auxiliary space | Fit |
|---|---:|---:|---:|---:|---|
| Plain array with direct scan | O(w) | O(1) | No additional build | O(1) with iterator scan | Narrow ranges or few queries |
| Prefix sums | O(1) | O(n) worst case for the full prefix representation | O(n) | O(n) | Frequent sums, immutable data or batched rebuilds |
| Fenwick tree for additive sums | O(log n) | O(log n) | O(n) with linear construction | O(n) | Interleaved point additions and sums |
| Segment tree with an associative operation and identity | O(log n) | O(log n) | O(n) | O(n) | Interleaved point updates and sums, minima, maxima, or ordered associative reductions |

✅ A Fenwick tree stores overlapping power-of-two blocks. With one-based internal index `i`, the block ending there has size `i & -i`, the value of the lowest set bit. A prefix query removes the last block and repeats. A point addition visits all blocks that contain the changed position. [Fenwick's original paper](https://doi.org/10.1002/spe.4380240306) · [AtCoder Fenwick tree interface](https://atcoder.github.io/ac-library/production/document_en/fenwicktree.html)

✅ A segment tree partitions the full interval recursively. Each parent stores the combination of its left and right children. An associative operation gives the same result regardless of grouping, while an identity value contributes nothing to an empty range. Order matters for operations such as concatenation, so combine queried blocks in input order. [AtCoder segment tree interface](https://atcoder.github.io/ac-library/production/document_en/segtree.html)

## Lookup notes

A prefix array is like a bank ledger's running balance. For `[3, 1, 4, 2]`, the prefix array is `[0, 3, 4, 8, 10]`. The range sum `[1, 3)` is `8 - 3 = 5`, representing `1 + 4`. After adding 5 at position 1, that range sums to 10. The equivalent minimum query needs a different structure because the minimum of a suffix cannot generally be recovered by subtracting prefix minima.

For the same example, a Fenwick prefix over the first three elements reads internal index 3, whose block contains 4, then index 2, whose block sums to 4. Updating external position 1 begins at internal index 2 and updates block totals at 2 and 4. A segment tree can instead answer a minimum over positions 1 and 2 by combining the two leaf results. It also supports sums, at the cost of holding summaries over more explicit intervals.

For a fixed array, use a prefix array when the aggregate can be derived from two prefixes, such as integer sum. With a Fenwick tree for sums, replacing a value requires applying the difference between the new and old value. Range updates require additional machinery and are outside the table. If both updates and queries span intervals, specify the update and aggregation operations before choosing lazy propagation. Coordinate compression maps known sparse keys to dense positions. A newly inserted key outside that mapping needs a rebuild or a dynamic index.

### Local check

✅ On 2026-11-07, CPython 3.13.7 on arm64 replayed 3,000 operations on 8,192 integers. The array values were generated in the range 0–99 with random seed 20261107. Query starts were uniformly generated among valid positions for the selected width. In the update case, every tenth operation starting with the first applied a random delta from -5 to 5 at a uniformly chosen position. Each cell is the median of five replay times in milliseconds, with initialization excluded. Every query result matched direct scanning. The four-element example above and an empty range were also checked.

| Query width | Update share | Scan with Python slice and sum | Prefix sums rebuilt on each update | Fenwick | Segment tree |
|---:|---:|---:|---:|---:|---:|
| 32 | 0% | 0.65 | 0.15 | 2.48 | 1.85 |
| 4,096 | 0% | 45.97 | 0.16 | 2.46 | 3.74 |
| 4,096 | 10% | 41.50 | 36.35 | 2.55 | 3.67 |

The scan variant allocated a temporary slice proportional to the width. The table's direct-scan space bound assumes iteration without slicing. Prefix rebuilding used the standard-library accumulator. The tree variants used Python loops. These measurements cover replay and result accumulation, with construction and memory unmeasured. They illustrate how range width and update frequency change the choice under one workload.

Copy this reproduction into `range-check.py` and run it with `python3 range-check.py`.

```python
from itertools import accumulate
from random import Random
from statistics import median
from time import perf_counter
import platform

def run(values, operations, kind):
    a = values[:]
    n = len(a)
    prefix = list(accumulate(a, initial=0))
    bit = [0] + a
    for i in range(1, n + 1):
        parent = i + (i & -i)
        if parent <= n:
            bit[parent] += bit[i]
    size = 1 << (n - 1).bit_length()
    tree = [0] * size + a + [0] * (size - n)
    for i in range(size - 1, 0, -1):
        tree[i] = tree[2*i] + tree[2*i + 1]

    def fenwick_prefix(i):
        total = 0
        while i:
            total += bit[i]
            i -= i & -i
        return total

    output = []
    start = perf_counter()
    for update, left, right in operations:
        if update:
            delta = right
            a[left] += delta
            if kind == "prefix":
                prefix = list(accumulate(a, initial=0))
            elif kind == "fenwick":
                i = left + 1
                while i <= n:
                    bit[i] += delta
                    i += i & -i
            elif kind == "segment":
                i = left + size
                while i:
                    tree[i] += delta
                    i //= 2
        elif kind == "scan":
            output.append(sum(a[left:right]))
        elif kind == "prefix":
            output.append(prefix[right] - prefix[left])
        elif kind == "fenwick":
            output.append(fenwick_prefix(right) - fenwick_prefix(left))
        else:
            left += size
            right += size
            total = 0
            while left < right:
                if left % 2:
                    total += tree[left]
                    left += 1
                if right % 2:
                    right -= 1
                    total += tree[right]
                left //= 2
                right //= 2
            output.append(total)
    return (perf_counter() - start) * 1000, output

rng = Random(20261107)
values = [rng.randrange(100) for _ in range(8192)]
print(platform.python_version(), platform.machine())
for width, update_every in ((32, 0), (4096, 0), (4096, 10)):
    ops = []
    for i in range(3000):
        if update_every and i % update_every == 0:
            ops.append((True, rng.randrange(len(values)), rng.randrange(-5, 6)))
        else:
            left = rng.randrange(len(values) - width + 1)
            ops.append((False, left, left + width))
    expected = run(values, ops, "scan")[1]
    for kind in ("scan", "prefix", "fenwick", "segment"):
        elapsed = []
        for _ in range(5):
            ms, actual = run(values, ops, kind)
            assert actual == expected
            elapsed.append(ms)
        print(width, update_every, kind, round(median(elapsed), 2))
for kind in ("prefix", "fenwick", "segment"):
    assert run([3, 1, 4, 2], [(False, 1, 3), (True, 1, 5), (False, 1, 3), (False, 4, 4)], kind)[1] == [5, 10, 0]
```

## Takeaways
- Start with the operation contract and typical range width, then estimate query and update frequency.
- Include construction, rebuilds, numeric overflow behavior, and memory before adopting a structure.
- Compare the same replay against a simple scan oracle. Include empty intervals, boundaries, negative deltas, and repeated writes.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 3 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-07

## References
- [A new data structure for cumulative frequency tables](https://doi.org/10.1002/spe.4380240306) — Peter M. Fenwick, 1994. Backs: binary indexed tree.
- [Fenwick tree](https://atcoder.github.io/ac-library/production/document_en/fenwicktree.html) — AtCoder Library. Backs: update, range-sum and operation costs.
- [Segtree](https://atcoder.github.io/ac-library/production/document_en/segtree.html) — AtCoder Library. Backs: aggregate contract and operation costs.
- Local benchmark, 2026-11-07 — workload, environment, seed and measurements above.

## Related
- [Choosing algorithms and representations](workload-selection.md)
- [Benchmarking methodology](../performance/measurement/benchmarking-methodology.md)
