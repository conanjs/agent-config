---
schema: knowledge-doc/v1
type: concept
topic: performance/hardware
status: verified
applies-to: ["multi-core CPUs with coherent caches (measurements: Apple M2, 128-byte lines)"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [performance, false-sharing, cache-coherence, cache-line, threads, padding, alignment]
---

# False sharing: when independent variables share a cache line

## Summary
**TL;DR:** Caches keep whole **cache lines** coherent across cores. If two threads write *different* variables that happen to sit in the *same* line, each write invalidates the other core's copy and the line bounces between cores — **false sharing**. Nothing is logically shared, yet the threads slow each other down. In the lab, four threads incrementing their own counters took 0.45 s when the counters were 8 bytes apart, 0.10 s at 64 bytes and 0.07 s at 128 bytes (the host's line size).
**Use this when:** a multi-threaded counter, stats array or per-thread slot scales badly, or you choose padding/alignment for concurrent data.
**Not this doc:** cache basics → `hardware/memory-hierarchy-and-caches.md`; true data sharing and races → `concurrency/shared-state-and-data-races.md`.

## Problem
Per-thread counters in an array look perfectly parallel — no locks, no shared variables — but performance gets worse as threads are added. The cause is invisible in the source code: the variables share hardware.

## Mental model
**Analogy:** two people editing different paragraphs of the same page in a shared notebook that only one person may hold at a time. They never touch each other's words, but they keep passing the notebook back and forth. Giving each paragraph its own page (padding) ends the passing.

**Artifact:** four threads, 200 million increments each, counters placed at different distances (lab, C, `-O2`, `-pthread`, 2026-11-04) ✅[^2]:
```c
volatile long *c = (volatile long *)(base + id * stride);   // one counter per thread, `stride` bytes apart
for (long i = 0; i < 200000000; i++) (*c)++;
```
```text
4 threads, counters   8 bytes apart: 0.45 s     # all four in one line
4 threads, counters  64 bytes apart: 0.10 s     # x86-style padding; still pairs per 128-byte line here
4 threads, counters 128 bytes apart: 0.07 s     # one line per counter on this CPU
```

## How it works
**3 actors:**
- **Threads on different cores** — their job: write their own variables.
- **Per-core caches** — their job: hold lines in a coherent state; a write needs exclusive ownership of the line.
- **Coherence protocol** — its job: invalidate other copies of a line before a core writes it ✅[^1].

1. False sharing is a side effect of maintaining coherence for one cache line held in several CPUs' caches ✅[^1].
2. Each increment needs exclusive ownership; with four writers in one line, ownership moves on almost every write ✅[^2].
3. **Fix — padding/alignment:** place each thread's hot data in its own line. The line size is hardware-specific: 128 bytes on the lab host ✅[^3], which is why 64-byte padding (common advice for x86) only partly helped there ✅[^2]. The Linux kernel uses cache-line alignment annotations for hot fields for this reason ✅[^1].

## Worked example
A request counter per worker thread in a web server, stored as `long counters[8]`:

| Layout | Bytes per counter slot | Workers sharing a 128-byte line | Expected behaviour |
|---|---|---|---|
| `long counters[8]` | 8 | 8 | Heavy false sharing (lab: 6.4× slower than padded) ✅[^2] |
| Struct padded to 64 bytes | 64 | 2 | Better, still paired on 128-byte-line CPUs ✅[^2] |
| Struct aligned to 128 bytes (or the platform's line size) | 128 | 1 | No false sharing ✅[^2] |

Alternative: each thread counts in a local variable and adds to the shared total once at the end.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Read-mostly data shared by threads | Fine | Lab: 4 threads only reading took 0.08 s with values 8 bytes apart vs 0.07 s at 128 bytes — no write, no ownership ping-pong ✅[^2] |
| Padding everything | Wastes memory and cache | Pad only hot, frequently written per-thread data |
| Code tuned on x86 (64-byte lines) run on Apple silicon | Padding too small | 128-byte lines ✅[^3] ✅[^2] |

## Takeaways
- Give each thread's frequently written data its own cache line, sized for the target CPU (query it; do not assume 64). [rule-candidate]
- Prefer thread-local accumulation and a final merge over shared counters in hot loops.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 13 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [False Sharing](https://docs.kernel.org/kernel-hacking/false-sharing.html) — Linux kernel documentation, living. Backs: false sharing as a coherence side effect for one cache line in several CPUs' caches; cache-line alignment annotations. [^1]
- `linux/lab-setup.md` — the lab (Linux 6.17.8 VM on an Apple M2 host, GCC 13.2.1) where the false-sharing benchmark ran on 2026-11-04. [^2]
- Host measurement, 2026-11-04 — `sysctl hw.cachelinesize` on the macOS host returned 128 (Apple M2). [^3]

## Related
- `performance/hardware/memory-hierarchy-and-caches.md`
- `performance/fundamentals/amdahls-law-and-scalability.md`
- `concurrency/shared-state-and-data-races.md`
