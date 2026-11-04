---
schema: knowledge-doc/v1
type: concept
topic: performance/hardware
status: verified
applies-to: ["modern CPUs (measurements: Apple M2 host, Linux 6.17 VM)"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [performance, cpu-cache, memory-hierarchy, latency, locality, cache-line, dram]
---

# The memory hierarchy: caches, locality and memory latency

## Summary
**TL;DR:** A CPU core can finish an operation in well under a nanosecond, but a load from main memory (DRAM) takes on the order of 100 ns. Caches close the gap by keeping recently used memory close to the core in fixed-size **cache lines** (128 bytes on Apple M2, commonly 64 bytes on x86). Code that walks memory sequentially (good **spatial locality**) and reuses a small working set (good **temporal locality**) runs from cache; code that jumps around large data waits for DRAM. In the lab, a dependent random walk cost ~1 ns per access in a 128 KiB working set and ~150 ns at 256 MiB; summing a 64 MiB matrix column by column was 4× slower than row by row.
**Use this when:** you choose data layouts (arrays vs pointer structures, struct-of-arrays), loop orders, or explain why the "same" algorithm runs at very different speeds.
**Not this doc:** cache effects between threads → `hardware/false-sharing.md`.

## Problem
Big-O treats every memory access as equal. Real hardware does not: a linked-list traversal and an array scan are both O(n) but can differ by an order of magnitude, and iterating a 2-D array in the "wrong" order slows a loop several times without changing a single operation count.

## Mental model
**Analogy:** a workshop. The workbench (L1 cache) holds a few tools within arm's reach; the shelf behind you (L2) takes a step; the storeroom down the hall (DRAM) takes a walk. Fetching one screw from the storeroom, you bring the whole box (a cache line) — handy if the next screws you need are in the same box.

**Artifact:** dependent random pointer chase through working sets of growing size (lab, C, GCC 13.2.1 `-O2`, 2026-11-04) ✅[^1], next to the host CPU's cache sizes from `sysctl` ✅[^2]:
```text
working set   ns/access          host (Apple M2, from sysctl)
   16 KiB       0.92             hw.cachelinesize           = 128 bytes
  128 KiB       1.04             hw.perflevel0.l1dcachesize = 131072 (128 KiB, performance cores)
  256 KiB       5.73   ← out of L1
    8 MiB       7.86             hw.perflevel0.l2cachesize  = 16777216 (16 MiB, shared L2)
   16 MiB      26.75   ← out of L2
   64 MiB     116.57
  256 MiB     153.15   ← DRAM
```

## How it works
**3 actors:**
- **Core** — its job: execute instructions; stalls when a load misses all caches.
- **Cache hierarchy (L1 per core, larger shared L2/L3)** — its job: keep recently used lines; each level is larger and slower ✅[^1] ✅[^2].
- **Main memory (DRAM)** — its job: hold everything; ~100+ ns away ✅[^1].

1. **Lines, not bytes:** memory moves between levels in whole cache lines; the lab host uses 128-byte lines ✅[^2].
2. **Spatial locality:** after one access, neighbouring bytes are already in the line; hardware prefetchers also fetch ahead on sequential patterns. Row-major traversal of a C array uses every byte of each line; column-major traversal touches one element per line and moves on ✅[^1].
3. **Temporal locality:** a working set that fits in a level is served at that level's latency — the plateaus in the artifact line up with the 128 KiB L1 and 16 MiB L2 of the host ✅[^1] ✅[^2].
4. **Dependent loads expose latency:** in a pointer chase each address comes from the previous load, so the CPU cannot overlap misses — this is why linked structures suffer more than arrays.

## Worked example
Summing a 4096 × 4096 `int` matrix (64 MiB) two ways (lab) ✅[^1]:
```c
for (i = 0; i < N; i++) for (j = 0; j < N; j++) acc += a[i*N + j];   // row-major:    0.008 s
for (j = 0; j < N; j++) for (i = 0; i < N; i++) acc += a[i*N + j];   // column-major: 0.034 s (4.0x)
```
Same 16.7 million additions; the only change is the order of memory accesses. Row-major uses all 32 four-byte integers of each 128-byte line; column-major uses one and jumps 16 KiB to the next row.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Linked list vs array of the same items | Array traversal much faster | Sequential lines and prefetching vs dependent loads ✅[^1] |
| Working set slightly above a cache size | Sharp slowdown | Plateau boundaries (128 KiB → 256 KiB: 1.0 → 5.7 ns) ✅[^1] |
| Struct with hot and cold fields | Cold fields waste cache space | Lines carry whole neighbourhoods; split hot data |
| Running inside a VM | Same hardware caches, but topology may be hidden | The lab VM did not expose cache sizes; the host's `sysctl` did ✅[^2] |

## Takeaways
- Prefer contiguous arrays and sequential access in hot paths; iterate in memory order. [rule-candidate]
- Keep hot working sets small (pack data, split hot from cold fields) so they fit in cache.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 13 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- `linux/lab-setup.md` — the lab (Linux 6.17.8 VM on an Apple M2 host, GCC 13.2.1) where the pointer-chase and matrix benchmarks ran on 2026-11-04. [^1]
- Host measurement, 2026-11-04 — `sysctl hw.cachelinesize hw.perflevel0.l1dcachesize hw.perflevel0.l2cachesize` and `machdep.cpu.brand_string` on the macOS host (Apple M2). [^2]
- [What Every Programmer Should Know About Memory](https://www.akkadia.org/drepper/cpumemory.pdf) — Ulrich Drepper, 2007. Backs: further reading on caches, lines and memory latency.

## Related
- `performance/hardware/false-sharing.md` — cache lines shared between threads.
- `algorithms/data-structures/data-structure-catalog.md` — Big-O versus locality.
