---
schema: knowledge-doc/v1
type: concept
topic: performance/measurement
status: verified
applies-to: ["Linux perf", "sampling profilers in general", "flame graphs"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [performance, profiling, sampling, perf, flame-graph, cpu-profile, hot-path]
---

# Profiling and flame graphs

## Summary
**TL;DR:** A profiler tells you **where** time goes, so you optimize the code that matters instead of the code you suspect. A **sampling** profiler interrupts the program many times per second and records the current stack; functions that appear in many samples are where CPU time is spent. `perf record` does this on Linux; `perf report` lists the hottest functions; a **flame graph** draws all sampled stacks at once — width = share of samples, height = stack depth. In the lab, `perf record` on the cache benchmark attributed 97.7% of samples to `main`, with 0.9% in the kernel clearing pages.
**Use this when:** something is slow and you do not yet know which code is responsible, or you need evidence before optimizing.
**Not this doc:** comparing two implementations → `measurement/benchmarking-methodology.md`; eBPF tracing → `linux/system-management/ebpf-tracing.md`.

## Problem
Engineers guess where time goes and are often wrong: the slow part turns out to be serialization, logging, a lock, or an allocation in a loop. Optimizing by intuition wastes effort; a profile replaces the guess with data.

## Mental model
**Analogy:** photographing a busy office every few seconds for an hour. You never watch anyone continuously, but after hundreds of photos, the desks that appear busy in most of them are where the work happens. A flame graph is all those photos stacked so the busiest desks form the widest blocks.

**Artifact:** `perf` on the lab's cache benchmark (Linux 6.17.8, `perf` from Alpine, 2026-11-04) ✅[^4]:
```console
# perf record -F 999 -g -o /tmp/p.data ./cache
# perf report -i /tmp/p.data --stdio --no-children
    97.66%  cache    cache                 [.] main
     0.91%  cache    [kernel.kallsyms]     [k] __pi_clear_page
```
`-F 999` = sample 999 times per second; `-g` = record call stacks; `[.]` user space, `[k]` kernel.

## How it works
**3 actors:**
- **Profiler (`perf record`)** — its job: run a command and gather a performance profile into `perf.data` ✅[^1].
- **Kernel sampling** — its job: interrupt at the chosen frequency and capture the instruction pointer and stack.
- **Report / visualizer (`perf report`, flame graph scripts)** — its job: aggregate samples by function and stack ✅[^2].

1. **Sample:** at each tick the current stack is recorded; cost is low because the program is not instrumented ✅[^1].
2. **Aggregate:** identical stacks are counted; a function's share of samples estimates its share of CPU time.
3. **Visualize as a flame graph:** the x-axis is the stack population sorted alphabetically — **not** time; the y-axis is stack depth; each rectangle is a frame, and wider frames were on-CPU more often ✅[^2].
4. **Read top-down for causes:** a wide frame near the top is where CPU burns; its parents show who called it.
5. **Counters, not samples:** `perf stat` counts events for the whole run (task-clock, context switches, page faults); in the lab VM some hardware counters (cache misses) reported `<not supported>` ✅[^4].

## Worked example
Lab `perf stat` on the branch benchmark ✅[^4]:
```text
    629.43 msec task-clock     #  0.999 CPUs utilized
         0      context-switches
        36      page-faults
```
Reading: one CPU fully busy, no blocking, almost no page faults — a pure CPU-bound loop, so a CPU profile (not an I/O or lock analysis) is the right next step.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Missing symbols (stripped binaries, JIT code) | Hex addresses instead of names | No symbol table; install debug symbols; JIT runtimes need their own symbol support (runtime-specific) |
| Time spent waiting (I/O, locks) | Invisible in an on-CPU profile | Samples only capture running threads; use off-CPU analysis or tracing |
| Hardware counters in a VM | `<not supported>` | The hypervisor does not expose them ✅[^4] |
| Reading the flame graph x-axis as time | Wrong conclusions | It is sorted alphabetically ✅[^2] |

## Takeaways
- Profile before optimizing; change the code that dominates the profile. [rule-candidate]
- Pair an on-CPU profile with a check for waiting (I/O, locks) before concluding the code is CPU-bound.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 9 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [perf-record(1)](https://man7.org/linux/man-pages/man1/perf-record.1.html) — Linux perf via man-pages, living. Backs: runs a command and records its profile into `perf.data`. [^1]
- [Flame Graphs](https://www.brendangregg.com/flamegraphs.html) — Brendan Gregg, living. Backs: x-axis is the stack population sorted alphabetically, y-axis is stack depth, width = frequency. [^2]
- [perf wiki](https://perfwiki.github.io/main/) — perf project, living. Backs: further reading.
- `linux/lab-setup.md` — the lab where `perf record`, `perf report` and `perf stat` ran on 2026-11-04. [^4]

## Related
- `performance/measurement/benchmarking-methodology.md`
- `linux/system-management/ebpf-tracing.md` — tracing beyond sampling.
- `linux/system-management/observability-tools.md`
