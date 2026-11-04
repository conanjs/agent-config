---
schema: knowledge-doc/v1
type: concept
topic: performance/fundamentals
status: verified
applies-to: ["parallel code: threads, processes, distributed workers"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [performance, amdahl, parallelism, speedup, scalability, gustafson, serial-fraction]
---

# Amdahl's law and the limits of parallel speed-up

## Summary
**TL;DR:** If a fraction s of a job must run serially, adding N workers can speed it up at most 1 / (s + (1 − s)/N), and never more than 1/s however many workers you add. With 10% serial work the ceiling is 10×; in the lab, 8 threads gave 4.03× (Amdahl predicts 4.71×), because real overheads add to the serial part. Gustafson's counterpoint: when the problem **grows** with the machine, the parallel part grows too and scaling looks much better.
**Use this when:** you decide whether more cores, threads or replicas will help, estimate the benefit of parallelizing a job, or explain diminishing returns.
**Not this doc:** queueing effects of load → `fundamentals/queueing-and-littles-law.md`.

## Problem
Teams add threads or nodes expecting linear speed-up and get much less, sometimes even a slowdown. The serial part — setup, locks, coordination, a single-threaded merge step — caps the gain, and overheads shrink it further.

## Mental model
**Analogy:** cooking a dinner where chopping can be shared among any number of helpers but the oven bakes one tray at a time. More helpers make chopping faster, but dinner is never ready before the oven is done.

**Artifact:** a workload with 10% serial work run with 1–8 threads (lab, C, GCC 13.2.1 `-O1`, 8 vCPUs on an Apple M2 host, 2026-11-04) ✅[^2]:
```text
threads=1 time=1.91s speedup=1.00 Amdahl-predicted=1.00
threads=2 time=1.06s speedup=1.81 Amdahl-predicted=1.82
threads=4 time=0.68s speedup=2.83 Amdahl-predicted=3.08
threads=8 time=0.47s speedup=4.03 Amdahl-predicted=4.71
```

## How it works
1. Split total time T₁ into serial part s·T₁ and parallel part (1 − s)·T₁.
2. With N workers: T_N = s·T₁ + (1 − s)·T₁/N, so speed-up S(N) = T₁/T_N = 1 / (s + (1 − s)/N).
3. As N → ∞, S → 1/s: "even when the fraction of serial work … is small, say s, the maximum speedup obtainable from even an infinite number of parallel processors is only 1/s" ✅[^1].
4. **Gustafson's view:** with more processors people usually solve **bigger** problems in the same time, so the serial share shrinks and measured scaling on a 1024-processor system was far better than Amdahl's fixed-size argument suggests ✅[^1].
5. **Real overheads** (thread start-up, memory bandwidth, cache contention, scheduling) act like extra serial work: the lab fell 15% short of the prediction at 8 threads ✅[^2].

## Worked example
A report job takes 100 s: 20 s reading input (serial), 80 s computing (parallelizable).

| Workers | Time | Speed-up | Cost (worker-seconds) |
|---|---|---|---|
| 1 | 20 + 80 = 100 s | 1.0× | 100 |
| 4 | 20 + 20 = 40 s | 2.5× | 160 |
| 16 | 20 + 5 = 25 s | 4.0× | 400 |
| ∞ | 20 s | 5.0× (= 1/0.2) | — |

Going from 4 to 16 workers saves 15 s but costs 2.5× the compute. Making the read parallel or faster (shrinking s) is worth more than adding workers.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Lock-protected shared state | Speed-up stalls or reverses | The critical section is serial work |
| Memory-bandwidth-bound loops | Little gain beyond a few threads | Shared resource saturates |
| False sharing between threads | Slower with more threads | See `hardware/false-sharing.md` |
| Container CPU limit below thread count | Threads wait on the quota | See `kubernetes/cpu-limits-and-throttling.md` |
| Problem size grows with workers | Better scaling than Amdahl predicts | Gustafson ✅[^1] |

## Takeaways
- Measure the serial fraction before buying parallelism: speed-up can never exceed 1/s.
- Attack the serial part (I/O, locks, merge steps) first; it limits every parallel gain.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 5 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Reevaluating Amdahl's Law](http://johngustafson.net/pubs/pub13/amdahl.htm) — John L. Gustafson, Communications of the ACM 31(5), 1988 (author's copy). Backs: Amdahl's 1/s bound and the scaled-problem argument with 1024-processor results. [^1]
- `linux/lab-setup.md` — the lab where the 10%-serial threaded benchmark ran on 2026-11-04 (GCC 13.2.1, 8 vCPUs). [^2]

## Related
- `performance/fundamentals/queueing-and-littles-law.md`
- `performance/hardware/false-sharing.md`
- `concurrency/shared-state-and-data-races.md`
