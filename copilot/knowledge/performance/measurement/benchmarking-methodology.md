---
schema: knowledge-doc/v1
type: how-to
topic: performance/measurement
status: verified
applies-to: ["micro- and macro-benchmarks in any language (examples: C with GCC 13, Python 3.12)"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [performance, benchmarking, methodology, dead-code-elimination, warmup, variance, active-benchmarking]
---

# Run a benchmark you can trust

## Summary
**TL;DR:** Most benchmark mistakes measure the wrong thing: the optimizer deleting the work, a cold cache, noise from other processes, or a single lucky run. A trustworthy benchmark keeps results live, warms up, repeats and reports a distribution, controls the environment, and — while it runs — is **actively** analysed to confirm what limits it. In the lab, a loop of a billion additions "took" 2.23 s at `-O0` and 0.000 s at `-O2`, because the compiler removed it.
**Use this when:** you compare two implementations, claim a speed-up, size hardware, or reproduce a performance regression.
**Not this doc:** finding where time goes inside a program → `measurement/profiling-and-flame-graphs.md`.

## Goal & prerequisites
**End state:** a comparison whose numbers you can explain (what resource limits each run) and reproduce (same environment, repeated runs, reported spread).

**Needs:** the code under test, a quiet machine or container with fixed CPU/memory limits, a timer with sub-millisecond resolution (`clock_gettime(CLOCK_MONOTONIC)`, `time.perf_counter`), and a profiler or `perf stat` for active analysis.

## Steps
1. **State the question and the metric:** throughput (ops/s) or latency (percentiles)? At which input size and concurrency?
2. **Keep the work observable.** Use every result (print it, or pass it to a "do not optimize" sink); otherwise the compiler may delete the loop. Google Benchmark provides `benchmark::DoNotOptimize` and `ClobberMemory` for this ✅[^2].
3. **Check what is actually executed** for micro-benchmarks: read the assembly (`gcc -S`) — the lab branch benchmark compiled its `if` into a `csel`, removing the effect it meant to measure ✅[^4].
4. **Warm up** caches, JITs and connection pools, then measure; discard the warm-up iterations.
5. **Repeat and report a distribution:** run each variant several times and report min/median/spread (or percentiles for latency), not one number.
6. **Control the environment:** same CPU and memory limits for every variant (a laptop without a CPU quota is not comparable to a pod with one; see `kubernetes/cpu-limits-and-throttling.md`), no other heavy processes, same input data.
7. **Scale the input:** measure at 2–3 sizes; the ratio reveals the growth rate (see `algorithms/fundamentals/complexity-and-big-o.md`).
8. **Analyse while it runs** ("active benchmarking"): use `vmstat`, `perf stat`, a profiler, to confirm the benchmark is limited by what you think — CPU, memory, disk, network or a lock ✅[^1].
9. **Write down** the environment (hardware, OS, versions, flags) next to the numbers.

## Verify
Expected signs of a trustworthy result, from the lab (2026-11-04) ✅[^4]:

| Check | Bad sign (seen in the lab) | Good sign |
|---|---|---|
| Work not optimized away | `loop of 1e9 additions: 0.000 s` at `-O2` (vs 2.232 s at `-O0`) | Time scales with the work; results printed |
| Effect present in the binary | Branch benchmark showed 1.0× because of `csel` | Assembly contains the construct being measured |
| Resource understood | — | `perf stat` shows `0.999 CPUs utilized`, 0 context switches for a CPU-bound run |
| Spread reported | Single run | Best/median of ≥ 3–5 runs (the lab scripts take the best of 5) |

## Troubleshooting
| Symptom | Cause | Fix |
|---|---|---|
| Implausibly fast result (0 s, faster than memory bandwidth) | Dead-code elimination or constant folding | Use the result; `DoNotOptimize` ✅[^2] |
| First run much slower | Cold caches / JIT / lazy loading | Warm-up iterations |
| Large run-to-run variance | Noisy neighbours, CPU frequency, throttling | Quiet machine, pinned limits, more repetitions; check `cpu.stat` throttling in containers |
| "A is faster" on a laptop but not in production | Different CPU quota, cache sizes, data | Benchmark in the target environment |
| Benchmark limited by the load generator | Client saturates first | Watch the client's CPU too ✅[^1] |

## Takeaways
- Never trust a benchmark you cannot explain; identify the limiting resource while it runs. [rule-candidate]
- Keep results live and inspect generated code for micro-benchmarks.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 6 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Active Benchmarking](https://www.brendangregg.com/activebenchmarking.html) — Brendan Gregg, living. Backs: analysing performance while the benchmark runs to find the real limiter. [^1]
- [Google Benchmark user guide](https://github.com/google/benchmark/blob/main/docs/user_guide.md) — Google, living. Backs: `benchmark::DoNotOptimize` and `benchmark::ClobberMemory`. [^2]
- [perf-stat(1)](https://man7.org/linux/man-pages/man1/perf-stat.1.html) — Linux perf via man-pages, living. Backs: further reading on counting events.
- `linux/lab-setup.md` — the lab (Linux 6.17.8 VM on an Apple M2 host, GCC 13.2.1, Python 3.12.13) where the `-O0`/`-O2` loop, the branch-benchmark attempts and `perf stat` ran on 2026-11-04. [^4]

## Related
- `performance/measurement/profiling-and-flame-graphs.md`
- `performance/hardware/branch-prediction.md` — the benchmark that measured the optimizer first.
- `linux/system-management/performance-triage.md` — system-level checks.
