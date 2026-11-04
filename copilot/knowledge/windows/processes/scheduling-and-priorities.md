---
schema: knowledge-doc/v1
type: concept
topic: windows/processes
status: verified
applies-to: ["Windows 10 / 11", "Windows Server 2016+"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [windows, scheduler, priority, priority-class, base-priority, dynamic-priority, priority-boost, realtime, preemption]
---

# Windows thread scheduling and priorities

## Summary
**TL;DR:** Windows schedules **threads**, not processes, by a priority from 0 to 31 (0 is reserved for the zero-page thread). A thread's **base priority** combines its process's **priority class** (Idle, Below normal, Normal, Above normal, High, Realtime) with its **thread priority level**; a normal thread in a normal process is 8, Realtime class spans 16–31. The highest-priority ready threads share CPUs round-robin, and a thread that becomes ready at a higher priority preempts immediately. Threads at 0–15 get temporary **boosts** (foreground, input, completed waits) that decay one level per time slice; 16–31 are never boosted.
**Use this when:** you set process or thread priorities, explain UI responsiveness, investigate starvation, or compare with Linux nice values and real-time policies.
**Not this doc:** processes and threads as objects → `processes/processes-threads-and-handles.md`.

## Problem
"Set it to High/Realtime so it runs faster" can starve the mouse, keyboard and disk flushing threads; busy-wait loops at high priority can deadlock with a lower-priority thread they wait for. Knowing the 32-level model and boosts prevents both.

## Mental model
**Analogy:** 32 queues at an airport, numbered 0–31. Staff always serve the highest-numbered queue that has anyone in it, taking people in turn (round-robin). Someone arriving at a higher queue is served the moment they arrive, interrupting whoever is at the desk. Ordinary passengers (0–15) sometimes get a temporary fast-track card (boost) that wears off step by step; crew (16–31) never get boosts because they are already ahead.

**Artifact:** base priority for selected combinations, from Microsoft's table ✅[^1]:

| Process priority class | Idle thread | Lowest | Normal thread | Highest | Time critical |
|---|---|---|---|---|---|
| `IDLE_PRIORITY_CLASS` | 1 | 2 | 4 | 6 | 15 |
| `BELOW_NORMAL_PRIORITY_CLASS` | 1 | 4 | 6 | 8 | 15 |
| `NORMAL_PRIORITY_CLASS` | 1 | 6 | **8** | 10 | 15 |
| `ABOVE_NORMAL_PRIORITY_CLASS` | 1 | 8 | 10 | 12 | 15 |
| `HIGH_PRIORITY_CLASS` | 1 | 11 | 13 | 15 | 15 |
| `REALTIME_PRIORITY_CLASS` | 16 | 22 | 24 | 26 | 31 |

## How it works
**3 actors:**
- **Thread** — its job: be ready, running or waiting; carries a base and a dynamic priority ✅[^1] ✅[^2].
- **Scheduler** — its job: give time slices to the highest-priority ready threads and preempt on higher-priority arrivals ✅[^1].
- **Application / admin** — its job: choose priority classes and thread levels, via `SetPriorityClass`, `SetThreadPriority`, `CreateProcess` flags ✅[^1].

1. **Levels:** 0 (lowest, zero-page thread only) to 31 (highest) ✅[^1].
2. **Base priority:** process priority class + thread priority level, per the table ✅[^1]. Processes default to `NORMAL_PRIORITY_CLASS`; children of Idle or Below-normal processes inherit that class ✅[^1]. Threads are created at `THREAD_PRIORITY_NORMAL` ✅[^1].
3. **Selection:** threads of the same priority are equal and share time slices round-robin; lower levels run only when no higher thread is ready ✅[^1].
4. **Preemption:** when a higher-priority thread becomes ready, the running lower one is stopped without finishing its slice, and the higher one gets a full time slice ✅[^1].
5. **Dynamic priority and boosts** (base 0–15 only) ✅[^2]:
   - The foreground normal-class process's class is raised to at least that of background processes.
   - The thread owning a window that receives input is boosted.
   - A thread whose wait completes (disk or keyboard I/O) is boosted.
   - The boost decays by one level per completed time slice, never below the base priority. Boosting can be disabled per process or thread.

**Comparison with Linux:**

| Topic | Windows | Linux |
|---|---|---|
| Scale | 0–31, higher = more important | Normal: nice −20…19 (lower = more important); real-time 1–99 |
| Normal threads | Strict priority between levels + round-robin within a level; boosts | Proportional fair share by weight (EEVDF) |
| Real-time | Realtime class 16–31 | `SCHED_FIFO` / `SCHED_RR` |
| Starvation protection | Boosts for 0–15 | Fair share; RT throttling keeps 5% for normal tasks |

## Worked example
A video encoder set to `HIGH_PRIORITY_CLASS` with all threads `THREAD_PRIORITY_NORMAL` (base 13 ✅[^1]) on a 4-core machine, running 4 CPU-bound threads:

| Thread | Base priority | Gets CPU? |
|---|---|---|
| Encoder threads ×4 | 13 | Whenever ready — they fill all 4 cores |
| Browser UI thread (normal class) | 8, boosted when its window receives input ✅[^2] | Only when it outranks 13 or an encoder thread waits |
| Background indexer (idle class) | 4 | Almost never |

Result: the desktop feels frozen. Microsoft's guidance: use High class only for brief time-critical work, and almost never Realtime, which interrupts threads that handle mouse, keyboard and background disk flushing ✅[^1]. Better: keep the encoder at `BELOW_NORMAL_PRIORITY_CLASS`, so the UI always wins.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| High-priority thread busy-waits on a low-priority thread | Possible deadlock (the low one never runs) | Use wait functions, not spin loops ✅[^1] |
| Realtime-class process with CPU-bound threads | System input and disk flushing starve | Realtime outranks them ✅[^1] |
| Priority boosts disabled | No foreground/input/wait boosts | `SetProcessPriorityBoost` ✅[^2] |
| Thread at base 20 | Never boosted | Boosts apply to 0–15 only ✅[^2] |

## Takeaways
- Lower the priority of background CPU work instead of raising foreground work. [rule-candidate]
- Never use `REALTIME_PRIORITY_CLASS` for ordinary applications.
- Block with wait functions instead of spinning, especially across priority levels.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 19 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Scheduling Priorities](https://learn.microsoft.com/en-us/windows/win32/procthread/scheduling-priorities) — Microsoft Learn, living. Backs: levels 0–31, zero-page thread, round-robin, preemption, priority classes and default, inheritance, thread levels, base priority table, High/Realtime guidance, busy-wait warning. [^1]
- [Priority Boosts](https://learn.microsoft.com/en-us/windows/win32/procthread/priority-boosts) — Microsoft Learn, living. Backs: dynamic priority, boost triggers, 0–15 only, decay per time slice, disabling boosts. [^2]
- No Windows lab was available when this doc was written (macOS host); the worked example is illustrative.

## Related
- `linux/processes/cpu-scheduling.md` — EEVDF and nice on Linux.
- `windows/processes/processes-threads-and-handles.md` — the objects being scheduled.
