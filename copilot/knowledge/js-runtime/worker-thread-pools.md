---
schema: knowledge-doc/v1
type: concept
topic: js-runtime
status: verified
applies-to: ["Node.js 24 (libuv >= 1.52)", "piscina 5.3", "Linux containers with a CPU limit (cgroup v2)"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [worker-threads, piscina, availableParallelism, cgroup, sizing, cpu-bound]
---

# Worker thread pools in CPU-limited containers

## Summary
**TL;DR:** A piscina pool runs the default export of one file for every task, and on a container with a CPU limit `os.availableParallelism()` already reports that limit ✅[^2][^4] On a pod limited to 1 CPU or less, one worker thread was faster than two or three for CPU-bound rendering, and piscina 5.3's `utilization` figure is 1000 times too small, so it is not a load signal ✅[^4][^5]
**Use this when:** Moving CPU-bound work (PDF, image or report generation) off the Node.js event loop into a worker pool, choosing the worker count for a Kubernetes or Docker CPU limit, or reading piscina's pool statistics in logs.
**Not this doc:** Use `js-runtime/abort-signal.md` for the cancellation contract behind the per-task timeout; use `concurrency/blocking-in-async-runtimes.md` for why CPU-bound work blocks the event loop in the first place.

## Problem
Pool sizes are usually derived from the number of CPUs, but the host's CPU count says nothing about a container's CPU limit. A limit of 0.5 CPU (`cpu.max` = `50000 100000`) caps the whole container, all threads together, at half of one core ✅[^3]
Adding worker threads to such a container adds memory and scheduling contention, not compute: in the measurements below, two workers made the same work up to 72% slower ✅[^4]
The pool's own statistics can mislead the person sizing it: piscina 5.3.2 reports `utilization` 1000 times too small, so a fully busy pool logs `0.00` ✅[^5]

## Mental model
**Analogy:** The CPU limit is a kitchen with one stove. Hiring a second cook (worker thread) does not cook more food; the two cooks take turns at the same stove and get in each other's way.
**Artifact:**
```ts
import { availableParallelism } from 'node:os';
import { Piscina } from 'piscina';

const configured = process.env.WORKER_THREADS; // '0' = run on the main thread
const threads = configured
  ? Number(configured)
  : Math.max(1, Math.min(2, availableParallelism() - 1)); // 1 on a <= 2 CPU limit

const pool = new Piscina({
  filename: require.resolve('./render.task'), // its default export runs every task
  minThreads: threads,
  maxThreads: threads,
});
```
`availableParallelism()` returns 1 at a 0.5 CPU limit, so the default resolves to one worker without any configuration ✅[^4]

## How it works
1. The caller passes plain data to `pool.run(task, { signal })`; functions cannot cross the thread boundary, so the task names what to run instead of carrying it ✅[^1]
2. piscina resolves the task's `filename` and `name`; when the call gives neither, it uses the pool's `filename` and the default `name`, which is `'default'` ✅[^1][^5]
3. Each worker `require`s that file once, takes the export named by `name` (the default export), and calls it with the task; the return value resolves the caller's promise ✅[^5]
4. `os.availableParallelism()` wraps libuv's `uv_available_parallelism()` ✅[^2] Since libuv 1.49.0 it accounts for the cgroup CPU quota on Linux, and 1.52.0 fixed the case where `cpu.max`'s limit is lower than its period, which is every fractional limit such as 500m ✅[^3] Node.js 24.22.1 ships libuv 1.52.1 ✅[^4]
5. When an abort signal fires, piscina rejects the task; a task that was already running has its worker terminated and replaced, a queued one is removed from the queue ✅[^5]

## Worked example
Measured 2026-11-03: a PDF layout renderer (pdfmake 0.3.12) in a piscina 5.3.2 pool, run in `node:24.22.1-alpine` with `docker run --cpus=<n> --memory=<m>` ✅[^4]

| Scenario | 1 worker | 2 workers | 3 workers |
|---|---|---|---|
| 0.5 CPU / 512 MiB: two 1,500-row documents at once, time until both finish | 15.6 s | 26.8 s | — |
| 0.5 CPU / 512 MiB: two 300-row documents plus 10 small ones arriving every 200 ms, slowest large document | 3.5 s | 5.4 s | 8.7 s |
| 1 CPU / 2 GiB: 20 × 130-row burst, time until all finish | 3.1 s | 4.9 s | — |
| Idle memory of the container | about 50–60 MiB | +35–45 MiB per extra worker | |

Every row is slower with more workers, because the CPU limit, not the thread count, bounds the compute ✅[^4] `os.availableParallelism()` inside the same container returned 8 with no limit and 1 with `--cpus=0.5` ✅[^4]

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Reading `pool.utilization` as current load | A pool busy for the whole run reported 0.00083 instead of about 0.83 ✅[^4] | Run times are recorded in microseconds and summarized back to milliseconds, then divided by 1000 again before being compared with a duration in milliseconds ✅[^5] It is also an average since the pool started, not a current value ✅[^5] |
| `maxQueue` set on the pool and tasks carry a `signal` | The limit is not applied: with `maxQueue: 1` and one busy worker, all four signalled tasks ran; without signals, tasks 3 and 4 were rejected with "Task queue is at limit" ✅[^4] | Observed behavior of piscina 5.3.2; enforce the limit in the caller by checking `pool.queueSize` before `run()`. So moving the limit into `new Piscina({ maxQueue })` and deleting the caller check removes the limit without any error: every task is accepted and the queue grows until the per-task timeouts fire ✅[^4] |
| `resourceLimits.maxOldGenerationSizeMb` sized to the whole container | The container is OOM-killed (exit 137) before the worker reaches its cap: 512 MB cap, 512 MiB container, about 200 MiB already used by the main thread, a 3,000-row document ✅[^4] | The limit covers only the worker's JS heap, not `ArrayBuffer`s or other external memory, and the process can still hit a global out-of-memory ✅[^6] Size it as (container limit − main-thread reserve) / workers |
| Cap sized to fit the container | Same container with a 256 MB cap: the 3,000-row document succeeded (heap peak 228 MiB, V8 collects garbage harder), and a 6,000-row one failed with `ERR_WORKER_OUT_OF_MEMORY` while the container stayed up ✅[^4] | The worker is terminated at its heap limit and piscina rejects the task and replaces the worker ✅[^5][^6] |
| `process.constrainedMemory()` with no container memory limit | Returned 18446744073709552000 (2^64, cgroup "max") in `node:24.22.1-alpine`, not the documented `0`; 0 on a macOS host ✅[^4] | Treat a value of 0 or above `os.totalmem()` as "no limit" ✅[^4] |
| Treating a BullMQ `Worker` (or a NestJS `@Processor` / `WorkerHost`) as a thread | It is not: with a function processor the job ran on the main thread of the same process (`isMainThread=true`, `threadId=0`, same pid), and 2 s of CPU work in the job froze the event loop for 2.0 s ✅[^4] | BullMQ runs a processor in another process or thread only as a sandboxed processor given as a file path (`useWorkerThreads` applies only then); CPU-heavy work in a standard worker keeps the event loop busy and can stall jobs ✅[^7] `@nestjs/bullmq` passes the provider's bound `process` method, a function ✅[^4] |
| `pool.queueSize` | Counts tasks waiting for a worker, minus the capacity of workers still starting; running tasks are not counted ✅[^5] | Defined that way in piscina's `queueSize` getter ✅[^5] |
| `pool.completed` | Counts every task that finished, including failed and aborted ones ✅[^5] | The counter is incremented in the task callback before the error is checked ✅[^5] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| One worker on a <= 1 CPU limit | Best measured latency and throughput, lowest memory ✅[^4] | A large task delays small ones queued behind it |
| Two or more workers on a <= 1 CPU limit | A small task can start while a large one runs | Every task slower, more memory ✅[^4] |
| Default from `availableParallelism() - 1` | Follows the CPU limit with no per-environment config ✅[^4] | Depends on libuv >= 1.52 for fractional limits ✅[^3] |
| Explicit thread count from config | Operators can override per environment | Can oversubscribe the CPU limit if set too high |

## Takeaways
- Size CPU-bound worker pools from the container's CPU limit, not the host's cores; on a limit of 1 CPU or less, use one worker. [rule-candidate]
- Do not log or alert on piscina 5.3's `utilization`; use `queueSize` and per-task duration instead. [rule-candidate]
- When tasks carry an abort signal, enforce the queue limit in the caller. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 38 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [piscina](https://github.com/piscinajs/piscina) — piscina project, living. Backs: How it works §1–2. [^1]
- [Node.js 24: `os.availableParallelism()`](https://nodejs.org/docs/latest-v24.x/api/os.html#osavailableparallelism) — Node.js project, living. Backs: Summary, How it works §4. [^2]
- [libuv ChangeLog](https://github.com/libuv/libuv/blob/v1.x/ChangeLog) — libuv project, living. Backs: Problem, How it works §4 (1.49.0 "fix uv_available_parallelism using cgroup", 1.52.0 "handle cgroups cpu.max with limit < period"), Edge cases, Trade-offs. [^3]
- Local measurement, 2026-11-03 — Node.js 24.22.1 (libuv 1.52.1), piscina 5.3.2, pdfmake 0.3.12 in `node:24.22.1-alpine` under OrbStack with `docker run --cpus` / `--memory`; method and numbers in Worked example and Edge cases. [^4]
- `node_modules/piscina/dist/index.js` and `dist/histogram.js` (piscina 5.3.2) — getters `queueSize`, `completed`, `utilization`, `duration`; `runTask`; `toHistogramIntegerNano`. Backs: How it works §2–3, §5, Edge cases. [^5]
- [Node.js 24: Worker `resourceLimits`](https://nodejs.org/docs/latest-v24.x/api/worker_threads.html#new-workerfilename-options) — Node.js project, living. Backs: Edge cases (limits cover the JS engine only, not `ArrayBuffer`s; the process may still abort on global OOM). [^6]
- [BullMQ: Sandboxed processors](https://docs.bullmq.io/guide/workers/sandboxed-processors) — BullMQ project, living. Backs: Edge cases (standard workers run on the event loop; sandboxed processors run in another process or worker thread). [^7]

## Related
- `js-runtime/abort-signal.md` — the per-task timeout is an `AbortSignal.timeout()` passed to `pool.run()`.
- `concurrency/blocking-in-async-runtimes.md` — why CPU-bound work belongs off the event loop.
- `operations/structured-logging.md` — log per-task duration and queue size as structured fields.
