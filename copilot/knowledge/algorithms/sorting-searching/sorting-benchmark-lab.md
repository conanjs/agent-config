---
schema: knowledge-doc/v1
type: how-to
topic: algorithms/sorting-searching
status: verified
applies-to: ["CPython 3.13.7 local arm64 experiment", "Nonnegative integers"]
last-verified: 2026-11-07
last-updated: 2026-11-07
tags: [sorting, benchmark, counting-sort, radix-sort]
---

# Comparing library, counting and radix sorts

## Summary
**TL;DR:** A narrow key range favored counting sort on random integers in this local experiment. The library sort led on ordered input and on the wider random domain. Validate the output and vary both domain size and input order before generalizing.
**Use this when:** A numeric workload may benefit from exploiting the key domain.

## Goal & prerequisites

Use Python 3.13 to measure three implementations on identical nonnegative integer lists. The baseline is the built-in sorted function. Counting is like recording how many envelopes go into each numbered mailbox and then reading the mailbox numbers in order. Radix reads one group of bits at a time and keeps each bucket in arrival order. For example, the result for `[255, 0, 255, 1]` is `[0, 1, 255, 255]`, with both occurrences of 255 retained.

## Steps

1. Save the program below as `sorting_lab.py`. Its fixed seed reproduces the test data. A known key range is part of the contract and generation occurs before timing.
2. Run `python3 sorting_lab.py`. Each candidate receives one warmup and 11 timed executions. Compare the median and observed range.
3. Before evaluating a service change, repeat at representative sizes and in separate processes. Measure allocation and peak memory separately. Include key extraction or output materialization if the proposed implementation adds that work.

```python
import platform
import random
import statistics
import time

def counting(values, key_range):
    counts = [0] * key_range
    for value in values:
        counts[value] += 1
    return [key for key, count in enumerate(counts) for _ in range(count)]

def radix(values, bits):
    result = values
    for shift in range(0, bits, 8):
        buckets = [[] for _ in range(256)]
        for value in result:
            buckets[(value >> shift) & 255].append(value)
        result = [value for bucket in buckets for value in bucket]
    return result

def measure(name, values, key_range):
    expected = sorted(values)
    print(name, len(values), key_range)
    methods = [
        ("library", sorted),
        ("counting", lambda xs: counting(xs, key_range)),
        ("radix", lambda xs: radix(xs, (key_range - 1).bit_length())),
    ]
    for label, method in methods:
        assert method(values) == expected
        times = []
        for _ in range(11):
            start = time.perf_counter_ns()
            actual = method(values)
            times.append((time.perf_counter_ns() - start) / 1e6)
            assert actual == expected
        print(label, *(round(x, 3) for x in (statistics.median(times), min(times), max(times))))

rng = random.Random(73)
print(platform.machine(), platform.python_version())
dense = [rng.randrange(256) for _ in range(100_000)]
wide = [rng.randrange(1 << 20) for _ in range(100_000)]
measure("dense random", dense, 256)
measure("dense sorted", sorted(dense), 256)
measure("wide random", wide, 1 << 20)
for values in ([], [0], [255, 0, 255, 1]):
    assert counting(values, 256) == radix(values, 8) == sorted(values)
```

## Verify

✅ Executed locally on 2026-11-07 on arm64 with CPython 3.13.7. Every timed result equaled the library-sorted result. Separate assertions covered empty input, a singleton and duplicate values. The script reports median, minimum and maximum milliseconds in that order. Compare output equality when rerunning. The exact timings vary by machine and load.

| 100,000 integers | Library median [range] ms | Counting median [range] ms | Radix median [range] ms |
|---|---:|---:|---:|
| Random, 256 possible keys | 6.771 [6.623–6.943] | 3.241 [3.057–3.314] | 3.769 [3.627–3.955] |
| Sorted, 256 possible keys | 0.256 [0.194–0.294] | 3.165 [2.981–3.274] | 3.610 [3.482–3.728] |
| Random, 1,048,576 possible keys | 9.538 [9.369–9.668] | 57.779 [57.062–58.520] | 13.315 [12.964–13.918] |

The test measures complete result construction and excludes the equality assertion. It runs methods in fixed order in one process. The library has a native implementation and the two alternatives use Python loops. This is an implementation comparison for integer values. It does not measure auxiliary memory, record stability, or equivalent native implementations. In the wide case counting scans more than a million slots and radix makes three passes instead of one.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Counting raises an index error or returns incorrect output | Input falls outside the promised domain | Validate the range before calling it. Negative Python indices can alias the end of the counts array |
| Counting becomes slower or exhausts memory | The counter array follows the key range | Limit the supported domain and compare radix or library sorting |
| A candidate sorts keys correctly but loses payloads | The counting implementation reconstructs keys only | For records, implement stable scattering and check the payload order on ties |
| Timings jump between runs | Noise, allocator state or fixed-order effects | Repeat in independent processes and rotate candidate order |

## Takeaways
- Vary the number of records and the possible key range independently.
- Compare identical output contracts, then verify ordering, multiplicity and tie behavior where applicable.
- Separate observed timings from theoretical growth and measure memory when it constrains the choice.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 1 claim (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-07

## References
- [Counting sort](https://xlinux.nist.gov/dads/HTML/countingsort.html) — NIST. Backs: counting and record scattering.
- [Radix sort](https://xlinux.nist.gov/dads/HTML/radixsort.html) — NIST. Backs: stable bucket passes.
- Embedded program and local output above — experiment protocol and results.

## Related
- [Sorting families and selection criteria](sorting-family-catalog.md)
- [Benchmarking methodology](../../performance/measurement/benchmarking-methodology.md)
