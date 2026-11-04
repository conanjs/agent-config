---
schema: knowledge-doc/v1
type: concept
topic: linux/processes
status: verified
applies-to: ["Linux ≥ 6.6 (EEVDF)", "Linux 2.6.23–6.5 (CFS) for history"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [linux, scheduler, cfs, eevdf, nice, real-time, sched-fifo, load-average, context-switch]
---

# CPU scheduling: EEVDF, nice values and load average

## Summary
**TL;DR:** The scheduler decides which runnable thread runs on each CPU and for how long. Normal threads (`SCHED_OTHER`) share CPU time **in proportion to their weight**, which comes from the nice value (−20…19, each step ≈ 1.25× more or less CPU). Since Linux 6.6 the algorithm is **EEVDF** (it replaced CFS): among threads that are owed CPU time, the one with the earliest virtual deadline runs next. Real-time policies (`SCHED_FIFO`, `SCHED_RR`, `SCHED_DEADLINE`) always beat normal threads. Load average counts runnable **and** uninterruptible (`D`) threads, so it is "system load", not "CPU load".
**Use this when:** you tune `nice`/`chrt`, interpret load average or `vmstat`'s `r` column, see high context switches, or need to explain why a busy batch job slows a latency-sensitive one.
**Not this doc:** cgroup CPU limits and throttling → `kubernetes/cpu-limits-and-throttling.md` and `containers/cgroups-v2.md`.

## Problem
"Load is 12 on a 4-core box, so CPU is overloaded" is often wrong (the threads may be stuck on disk). "Make it real-time so it's faster" can freeze a machine. Without the scheduler's model, CPU problems get misdiagnosed and mis-tuned.

## Mental model
**Analogy:** a fair-share kitchen with one stove per CPU. Every cook (thread) has a "fair share" meter. Cooks who have used less than their share are "owed" time (positive lag) and are *eligible*. Among eligible cooks, the one whose small next task is due soonest (earliest virtual deadline) gets the stove. Senior cooks (lower nice value) have a bigger share. Emergency staff (real-time threads) skip the queue entirely.

**Artifact:** a thread's policy and nice value as the kernel sees them (lab, Linux 6.17.8, 2026-11-04) ✅[^6]:
```console
$ chrt -p 1
pid 1's current scheduling policy: SCHED_OTHER
pid 1's current scheduling priority: 0
$ nice -n 10 ps -o pid,ni,cls,pri,comm -p $$
    PID  NI CLS PRI COMMAND
     39  10  TS   9 ps          # NI=10, class TS (time-sharing = SCHED_OTHER)
```

## How it works
**4 actors:**
- **Thread** — its job: run or block, via its code; becomes runnable when its wait ends.
- **Per-CPU run queue** — its job: hold the runnable threads of one CPU, via the scheduler's data structures.
- **Scheduler (EEVDF for normal threads)** — its job: pick the next thread and when to preempt, via lag, eligibility and virtual deadlines ✅[^2].
- **Load balancer** — its job: move threads between CPUs' run queues, via periodic and idle balancing ✅[^8].

**Policy classes, highest priority first** ✅[^1]:

| Policy | Kind | Priority | Behaviour |
|---|---|---|---|
| `SCHED_DEADLINE` | Deadline (since 3.14) | Above all | Runtime / deadline / period set with `sched_setattr`; admission control can refuse with `EBUSY` |
| `SCHED_FIFO` | Real-time | 1–99 | Runs until it blocks, yields, or a higher priority preempts; no time slice |
| `SCHED_RR` | Real-time | 1–99 | Like FIFO with a time quantum per thread |
| `SCHED_OTHER` (`SCHED_NORMAL`) | Normal | 0, plus nice −20…19 | Fair sharing by weight (EEVDF) |
| `SCHED_BATCH` | Normal | 0 | Like OTHER, slightly disfavoured on wakeup (CPU-heavy work) |
| `SCHED_IDLE` | Normal | 0 | Below nice 19; runs when nothing else wants the CPU |

**EEVDF for normal threads** ✅[^2]:
1. **Lag:** each thread's lag is the difference between the CPU time it should have received (its fair share) and what it actually received. "A task with a positive lag is owed CPU time."
2. **Eligibility:** only threads with lag ≥ 0 are eligible to run.
3. **Virtual deadline:** each eligible thread gets a virtual deadline; the earliest one runs next, so threads that ask for short slices are picked sooner, which helps latency.
4. **Preemption:** a newly runnable thread with an earlier virtual deadline can preempt the running one.
5. **Sleeping does not reset debt:** a thread that sleeps briefly keeps its negative lag (it decays over time), so sleeping cannot be used to cheat.
6. **Slice requests:** threads can ask for a specific time slice with `sched_setattr()`.

The default base slice in current kernel source is 0.7 ms (`sysctl_sched_base_slice = 700000` ns) ✅[^5]. Linux used CFS from 2.6.23 ✅[^1] and began moving to EEVDF in 6.6 ✅[^2].

**Weights from nice:** each nice step changes the scheduler's preference by about 1.25× ✅[^1]. Nice is per thread on Linux, not per process ✅[^1].

**Real-time safety net:** `sched_rt_runtime_us` = 950 000 of `sched_rt_period_us` = 1 000 000 by default, so real-time and deadline threads together get at most 95% of CPU time and 5% stays for normal threads ✅[^1].

**Autogroup:** on desktop-style systems, each session (`setsid`, e.g. each terminal) gets its own group with an equal CPU share, so a `make -j32` in one terminal does not starve a video player in another. It is toggled by `/proc/sys/kernel/sched_autogroup_enabled` and does not apply once the cgroup CPU controller is used ✅[^1].

**Load average:** `/proc/loadavg` holds "the number of jobs in the run queue (state R) or waiting for disk I/O (state D) averaged over 1, 5, and 15 minutes", then runnable/total scheduling entities, then the last PID created ✅[^3]. Linux added `D` tasks in 1993 to reflect system demand, not just CPU; the averages are exponentially damped, so one busy thread shows ≈ 0.62 after one minute, not 1.0 ✅[^4].

## Worked example
Two CPU-bound threads on one CPU, both `SCHED_OTHER`, one at nice 0 and one at nice 5. The kernel's `sched_prio_to_weight` table gives weight 1024 for nice 0 and 335 for nice 5 ✅[^7]. Fair share:

| Thread | Weight | Share = weight / total | CPU per second |
|---|---|---|---|
| nice 0 | 1024 | 1024 / 1359 ≈ 75% | ≈ 750 ms |
| nice 5 | 335 | 335 / 1359 ≈ 25% | ≈ 250 ms |

That matches the 1.25× per step rule: 1.25⁵ ≈ 3.05, and 1024 / 335 ≈ 3.06 ✅[^1].

Reading load average on a 4-CPU machine: `8.10 7.95 7.80 9/312 4711`.
- 1, 5 and 15 minute averages ≈ 8 → about 8 threads were running, runnable or in `D` state on average.
- `9/312` → 9 runnable now, 312 scheduling entities exist.
- Next step: check whether CPUs are busy (`mpstat -P ALL 1`, `vmstat 1` `r` column vs 4) or threads are in `D` (`ps -eo stat,comm | grep ^D`). Load alone cannot tell CPU saturation from disk waits ✅[^4].

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Busy-looping `SCHED_FIFO` thread at priority 99 | Normal threads get only the 5% reserve on that CPU | RT runs before all normal threads; RT throttling keeps 5% ✅[^1] |
| `sched_rt_runtime_us = -1` | The reserve is gone; a runaway RT thread can lock the CPU | Reservation removed ✅[^1] |
| Raising your own nice value back down | Unprivileged users may be refused | `RLIMIT_NICE` limits it ✅[^1] |
| High load, idle CPUs | Threads stuck in `D` (disk, NFS) | Load includes `D` ✅[^3] |
| Container with a CPU limit | Throttled by cgroup bandwidth control even with idle CPUs | A separate mechanism; see `kubernetes/cpu-limits-and-throttling.md` |
| `nice` inside a container with `cpu.weight` set | Nice orders threads inside the group; the group's weight orders groups | Group scheduling gives fair time to groups, then to tasks in them ✅[^9] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Lower priority for batch work (`nice 10`, `SCHED_BATCH`, `SCHED_IDLE`) | Foreground latency protected | Batch takes longer when the CPU is busy |
| Real-time policy for latency-critical threads | Predictable, immediate scheduling | Can starve the system; needs privileges |
| CPU pinning (`taskset`, cpusets) | Cache locality, isolation | Less flexible balancing; idle pinned CPUs are wasted |

## Takeaways
- Compare load average to the CPU count only after ruling out `D`-state threads.
- Use nice / `SCHED_IDLE` / cgroup weights to protect latency; avoid real-time policies unless the thread is short, bounded and trusted.
- On kernels ≥ 6.6 the fair scheduler is EEVDF; older tuning advice that names CFS sysctls may not apply.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 22 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [sched(7)](https://man7.org/linux/man-pages/man7/sched.7.html) — Linux man-pages project, living. Backs: policies, priorities, nice range and 1.25× factor, per-thread nice, `RLIMIT_NICE`, RT throttling defaults, autogroup, CFS since 2.6.23. [^1]
- [EEVDF Scheduler](https://docs.kernel.org/scheduler/sched-eevdf.html) — Linux kernel documentation, living. Backs: lag, eligibility, virtual deadline, preemption, lag decay, slice requests, transition in 6.6. [^2]
- [proc_loadavg(5)](https://man7.org/linux/man-pages/man5/proc_loadavg.5.html) — Linux man-pages project, living. Backs: load average fields and the `R` + `D` definition. [^3]
- [Linux Load Averages: Solving the Mystery](https://www.brendangregg.com/blog/2017-08-08/linux-load-averages.html) — Brendan Gregg, 2017. Backs: why `D` is counted (1993 patch), exponential damping, 0.62 after one minute. [^4]
- [`kernel/sched/fair.c`](https://github.com/torvalds/linux/blob/master/kernel/sched/fair.c) — Linux kernel source, master, read 2026-11-04. Backs: `sysctl_sched_base_slice = 700000ULL`. [^5]
- `linux/lab-setup.md` — the lab where the `chrt` and `nice` output was captured on 2026-11-04. [^6]
- [`kernel/sched/core.c`](https://github.com/torvalds/linux/blob/master/kernel/sched/core.c) — Linux kernel source, master, read 2026-11-04. Backs: `sched_prio_to_weight` (nice 0 → 1024, nice 5 → 335). [^7]
- [Scheduler Domains](https://docs.kernel.org/scheduler/sched-domains.html) — Linux kernel documentation, living. Backs: load balancing between CPU groups within sched domains. [^8]
- [CFS Scheduler: group scheduler extensions](https://docs.kernel.org/scheduler/sched-design-CFS.html) — Linux kernel documentation, living. Backs: fair CPU time per task group, then per task inside the group. [^9]

## Related
- `kubernetes/cpu-limits-and-throttling.md` — cgroup CPU bandwidth limits on top of the scheduler.
- `linux/containers/cgroups-v2.md` — `cpu.weight` and `cpu.max`.
- `linux/system-management/performance-triage.md` — CPU checks in a triage run.
