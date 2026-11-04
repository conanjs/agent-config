---
schema: knowledge-doc/v1
type: concept
topic: linux/memory
status: verified
applies-to: ["Linux ≥ 5.x"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [linux, page-cache, dirty-pages, writeback, reclaim, kswapd, swap, swappiness, drop-caches, watermarks]
---

# Page cache, writeback, reclaim and swap

## Summary
**TL;DR:** Linux uses free RAM as a **page cache** for file data, so "free" memory looks low on a healthy machine. Writes land in the cache as **dirty** pages and are written to disk later by flusher threads. When memory gets tight, the kernel **reclaims** pages: clean cache is simply dropped, dirty cache is written first, and anonymous memory (heap, stack) can only go to **swap**. Background reclaim (`kswapd`) starts at the low watermark; at the min watermark the allocating process itself stalls in **direct reclaim**.
**Use this when:** `free` shows little free memory, writes are fast then suddenly slow, latency spikes under memory pressure, you tune `swappiness` or `dirty_*` sysctls, or someone suggests `drop_caches`.
**Not this doc:** address spaces and page faults → `memory/virtual-memory.md`; the last resort when reclaim fails → `memory/oom-killer.md`; making writes durable → `storage/block-io-and-durability.md`.

## Problem
Teams add RAM because "free memory is 2%", disable swap to "make it faster" and get OOM kills instead, or see a batch job write at 2 GB/s for ten seconds and then stall for a minute. All three come from not knowing how the page cache, dirty limits and reclaim interact.

## Mental model
**Analogy:** a desk (RAM) and a filing cabinet (disk). You keep copies of files you used recently spread on the desk (page cache) because fetching from the cabinet is slow. Notes you wrote (dirty pages) must be filed before the desk space can be reused. When the desk fills up, an assistant (`kswapd`) tidies in the background; if you need space *right now*, you stop and tidy yourself (direct reclaim). Your own scratch paper (anonymous memory) has no copy in the cabinet, so it can only go into a box under the desk (swap).

**Artifact:** the page cache growing as a 100 MB file is read (lab, Linux 6.17.8, 2026-11-04) ✅[^4]:
```console
# sync; echo 1 > /proc/sys/vm/drop_caches; grep ^Cached /proc/meminfo
Cached:           121444 kB
# cat /tmp/big > /dev/null; grep ^Cached /proc/meminfo
Cached:           225212 kB          # +~100 MB: the file is now in RAM
```

## How it works
**5 actors:**
- **Process** — its job: read and write files, via `read`/`write`/`mmap`.
- **Page cache** — its job: keep file pages in RAM and mark written ones dirty, via the kernel's per-file page mappings ✅[^1].
- **Flusher (writeback) threads** — its job: write dirty pages to disk in the background, via the `dirty_*` thresholds ✅[^2].
- **`kswapd`** — its job: reclaim pages asynchronously when free memory falls to the low watermark ✅[^1].
- **Direct reclaim** — its job: free pages synchronously in the allocating task when free memory reaches the min watermark, via the same reclaim code ✅[^1].

```
                 free pages
   high ─────────────────────────────  kswapd stops
                                        ▲
   low  ───────────────────────────── kswapd wakes (async reclaim, apps keep running)
                                        ▲
   min  ───────────────────────────── allocating task stalls in direct reclaim
                                        ▼
                                      still nothing reclaimable → OOM killer

 reclaim order of preference:
   clean page cache ─(drop)→ free
   dirty page cache ─(write back, then drop)→ free
   anonymous pages ─(write to swap, if any)→ free      swappiness biases cache vs anon
   kernel slab caches (dentries, inodes) ─(shrink)→ free
```

1. **Read path:** a `read` checks the page cache; on a miss the page is read from disk into the cache, then copied to the process ✅[^1].
2. **Write path:** a `write` copies data into cache pages and marks them **dirty**; the call returns before the data is on disk ✅[^1].
3. **Background writeback:** when dirty memory exceeds `dirty_background_ratio` of available memory, flusher threads start writing ✅[^2]. Dirty data older than `dirty_expire_centisecs` becomes eligible on the next flusher wake-up ✅[^2]. Kernel defaults in source: background 10%, foreground 20%, expire 3000 cs (30 s), wake-up every 500 cs (5 s) ✅[^3] ✅[^4].
4. **Foreground throttling:** above `dirty_ratio`, the writing process itself must start writing out dirty data, so its `write` calls slow down ✅[^2].
5. **Reclaim:** page cache and anonymous memory are the main reclaimable memory; kernel data and DMA buffers mostly are not, though some kernel caches (filesystem metadata) can be shrunk ✅[^1]. Anonymous pages that are dirty must be swapped out to be reclaimed ✅[^1].
6. **Swappiness:** `vm.swappiness` (0–200, default 60) sets how costly the kernel treats swap I/O compared with dropping file cache: at 100 they are equal; lower values prefer dropping cache; at 0 swapping waits until free plus file-backed pages fall below the high watermark ✅[^2] ✅[^3].
7. **Compaction:** when free memory is fragmented, `kcompactd` (or the allocator, synchronously) moves pages to create large contiguous blocks ✅[^1].

**`drop_caches`:** `echo 1` frees page cache, `2` reclaimable slab (dentries, inodes), `3` both; dirty objects are not freed, so `sync` first ✅[^2]. It is a test and benchmarking tool; the cache refills on the next reads.

## Worked example
A job writes a 20 GB file on a machine where 30 GB is "available", disk speed 500 MB/s, defaults (background 10%, foreground 20%) ✅[^3]:

| Time | Dirty data | What happens |
|---|---|---|
| 0–1 s | 0 → 3 GB | Writes go to RAM at memory speed; the program sees ~3 GB/s |
| ~1 s | 3 GB (10% of 30 GB) | Background flushers start writing at 500 MB/s |
| ~2.5 s | 6 GB (20%) | Foreground limit hit: `write` calls are throttled to roughly disk speed |
| 2.5–40 s | ~6 GB, steady | Program throughput ≈ 500 MB/s; the "fast start" is over |
| end | 6 GB still dirty | `close` returns quickly; data reaches disk in the next ~12 s unless the program calls `fsync` |

The arithmetic follows from the thresholds; the kernel actually paces writers gradually, computing a pause per writer in `balance_dirty_pages()` ✅[^6].

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `free` shows almost no free memory, `available` is high | Healthy | Page cache counts as reclaimable in `MemAvailable` ✅[^5] |
| No swap at all, heap pressure | Only cache can be reclaimed; the cache shrinks until code pages thrash, then OOM | Anonymous memory needs swap to be reclaimed ✅[^1] |
| Latency spikes, high `sys` CPU, low free memory | Tasks stuck in direct reclaim | Free pages at the min watermark ✅[^1] |
| Power loss right after a successful `write` | Recent data lost | It was dirty in RAM; see `storage/block-io-and-durability.md` |
| `drop_caches` "fixed" slowness | Usually it only moved the problem | `drop_caches` only drops clean cache, which later reads refill ✅[^2] |
| Container near its memory limit | Its own page cache is reclaimed first, then its anon memory, then the OOM kill in the cgroup | Cgroup memory includes page cache ✅[^7] (see `kubernetes/memory-limits-and-oom-kill.md`) |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Keep some swap, moderate `swappiness` | Cold anonymous pages leave RAM; more room for cache; softer failure | Swap-in latency if hot pages were swapped |
| No swap | Predictable latency for anon memory | Earlier OOM kills; cache gets squeezed harder |
| Lower `dirty_*` ratios (or `dirty_bytes`) | Shorter write stalls, less data at risk | Less write batching; more I/O |

## Takeaways
- Judge memory with `MemAvailable` and pressure signals (direct reclaim, swap activity), not `MemFree`.
- Writes are not on disk when `write` returns; durability needs `fsync` (see the storage doc).
- Do not "fix" memory issues with `drop_caches`; find what fills memory.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 25 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Concepts overview (memory management)](https://docs.kernel.org/admin-guide/mm/concepts.html) — Linux kernel documentation, living. Backs: page cache, dirty pages, reclaimable vs unreclaimable, kswapd at low watermark, direct reclaim at min, compaction. [^1]
- [Documentation for /proc/sys/vm/](https://docs.kernel.org/admin-guide/sysctl/vm.html) — Linux kernel documentation, living. Backs: `dirty_ratio`, `dirty_background_ratio`, `dirty_expire_centisecs`, `swappiness` range and meaning, `drop_caches` values. [^2]
- [`mm/page-writeback.c`](https://github.com/torvalds/linux/blob/master/mm/page-writeback.c) and [`mm/vmscan.c`](https://github.com/torvalds/linux/blob/master/mm/vmscan.c) — Linux kernel source, master, read 2026-11-04. Backs: `dirty_background_ratio = 10`, `vm_dirty_ratio = 20`, `dirty_expire_interval = 30 * 100`, `dirty_writeback_interval = 5 * 100`, `vm_swappiness = 60`. [^3]
- `linux/lab-setup.md` — the lab where the page-cache growth and the `dirty_ratio` 20 / `dirty_background_ratio` 10 / expire 3000 / writeback 1500 values were read on 2026-11-04 (the writeback interval there differs from the source default). [^4]
- [The /proc filesystem](https://docs.kernel.org/filesystems/proc.html) — Linux kernel documentation, living. Backs: `MemAvailable` includes reclaimable file pages. [^5]
- [mm/page-writeback.c](https://github.com/torvalds/linux/blob/master/mm/page-writeback.c) — Linux kernel source, read 2026-11-04. Backs: `balance_dirty_pages()` computes a pause for writers in proportion to their dirtying rate. [^6]
- [Control Group v2](https://docs.kernel.org/admin-guide/cgroup-v2.html) — Linux kernel documentation, living. Backs: memory controller accounts userland memory: page cache and anonymous memory. [^7]

## Related
- `linux/memory/virtual-memory.md` — anonymous vs file-backed memory.
- `linux/memory/oom-killer.md` — what happens when reclaim cannot keep up.
- `linux/storage/block-io-and-durability.md` — `fsync` and the block layer.
