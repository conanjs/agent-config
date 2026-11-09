---
schema: knowledge-doc/v1
type: reference
topic: algorithms
status: verified
applies-to: ["Exact intersections of integer identifier sets"]
last-verified: 2026-11-07
last-updated: 2026-11-07
---

# Set intersection representations

## Summary
**TL;DR:** Choose an intersection representation using the identifier span, density, update rate and requested output. Sorted arrays, hash sets, dense bitmaps and compressed bitmaps pay for different operations.
**Use this when:** Combining audience filters, posting lists, permission sets or groups of integer identifiers.

## Scope
Inputs contain unique integer identifiers. As with matching two guest lists, the operation returns the names both lists contain. For example, the intersection of `[2, 5, 9]` and `[5, 8, 9]` is `[5, 9]`, while its cardinality is just `2`.

## Catalog

| Representation | Operation | Cost and conditions | Cost to measure |
|---|---|---|---|
| Sorted arrays | Compare the current elements and advance the smaller one, advancing both on equality | At most a linear pass through both arrays. In highly unequal lists, seek forward in the larger list rather than always stepping one position at a time. | Sort or insertion cost, bytes read, match enumeration |
| Hash sets | Iterate the smaller input and probe membership in the larger one | One lookup per smaller-input element. Expected constant lookup cost assumes suitable hashing and load. | Build time, retained memory, lookup cost, result materialization |
| Dense bitmap | Set bit `i` for identifier `i`, then AND matching words | Space and whole-span operations scale with the addressable span. Reusing bitmaps avoids conversion on every query. | Span, bytes touched, count-only versus enumeration |
| Roaring bitmap | ✅ Partition 32-bit identifiers by their high bits and choose a representation per block. Intersect only shared blocks and use the appropriate container operation. [Roaring implementation paper](https://arxiv.org/abs/1709.07821) | Sparse, dense and run containers suit different local distributions. Container choice, metadata and mixed-container work contribute to the cost. | Bytes by container, conversion, serialized size, update and query costs |

## Lookup notes
A dense bitmap with identifiers `2`, `5` and `9` has those three bit positions set. Its highest identifier still determines the required span even though there are only three members. Dense remapping can reduce the span when a stable mapping exists. Count the mapping's memory, build cost and consistency requirements.

✅ A local count-only comparison on arm64 with Python 3.13.7 gave the following results on 2026-11-07. Each input held 4,096 unique identifiers. The inputs and their alternate representations were prepared before timing. The same result was checked for each representation.

| Identifier universe size | Intersection count | Python two-pointer loop, median µs | Built-in set intersection and length, median µs | Integer bitwise AND and bit count, median µs |
|---:|---:|---:|---:|---:|
| 8,192 | 2,066 | 731.34 | 82.23 | 0.20 |
| 1,048,576 | 22 | 879.13 | 55.50 | 17.52 |

The Python loop and built-ins execute through different implementation paths. The measured set expression also materializes its result, while the bitmap operation counts bits in an intermediate integer. These timings compare those exact operations in a warmed process. They do not isolate representation from implementation or measure Roaring, build cost, peak memory or result enumeration.

To reproduce, initialize `random.Random(1729)` once. For each universe size in table order, create two sorted arrays using `sorted(r.sample(range(universe), 4096))`. Convert to sets and integer bitmaps using `sum(1 << i for i in values)`. Run the two-pointer count, `len(sa & sb)` and `(x & y).bit_count()`, asserting equal counts. Use `timeit.repeat` with seven repeats and 100 calls per repeat, then divide each elapsed time by 100 before calculating the median.

## Takeaways
- Include conversion, updates and enumeration when those operations are part of the workload.
- Test clustered and spread-out identifiers independently even when their cardinalities match.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 2 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-07

## References
- [Roaring Bitmaps: Implementation of an Optimized Software Library](https://arxiv.org/abs/1709.07821) — Lemire et al., 2017 preprint. Backs the container representation and intersection mechanisms.
- Embedded local reproduction recipe — input seed, measured operations and result check.

## Related
- [Workload selection](workload-selection.md)
- [Streaming and approximation](streaming-and-approximation.md)
