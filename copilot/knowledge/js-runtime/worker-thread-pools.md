---
schema: knowledge-doc/v1
type: concept
topic: js-runtime
status: verified
applies-to: ["Node.js 24 (libuv >= 1.52)", "piscina 5.3", "Linux containers with a CPU limit or a pinned CPU set (cgroup v2)"]
last-verified: 2026-11-09
last-updated: 2026-11-09
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
4. `os.availableParallelism()` wraps libuv's `uv_available_parallelism()` ✅[^2] Since libuv 1.49.0 it accounts for the cgroup CPU quota on Linux, and 1.52.0 fixed the case where `cpu.max`'s limit is lower than its period, which is every fractional limit such as 500m ✅[^3] Node.js 24.22.1 ships libuv 1.52.1 ✅[^4] The calculation in 1.52.1 (`src/unix/core.c`, `src/unix/linux.c`) has four steps ✅[^8]:
   1. `N` is the number of CPUs in the calling thread's affinity mask (`sched_getaffinity`; the `Cpus_allowed_list` line of `/proc/self/status`), not a quota. It equals `os.cpus().length` (every CPU of the machine) unless the process is pinned to some CPUs ✅[^8][^9] Pinning restricts *which* CPUs the threads may run on, while a quota restricts *how much* CPU time they get. Docker's `--cpuset-cpus` pins a container: it takes a comma-separated list or hyphen range of CPU numbers, the first CPU is number 0, so `0-3` is the first four CPUs and `1,3` is the second and fourth ✅[^10] `--cpuset-cpus=0,1` therefore lets the container's threads run only on CPUs 0 and 1, and `Cpus_allowed_list` inside it reads `0-1` (so `N` = 2) while `os.cpus().length` still lists all 8 ✅[^9] `taskset` pins a process the same way. Kubernetes pins only when the kubelet runs the `static` CPU manager policy, and then only containers of a Guaranteed pod that request a whole number of CPUs get exclusive CPUs; all other containers stay on the shared pool ✅[^11]
   2. It reads `/sys/fs/cgroup/cpu.max`, whose content is `<quota> <period>` in microseconds: the CPU time the whole container may use in each `period` window. When there is no CPU limit the file reads `max 100000` (`max` stands for the quota; `100000` is only the period), libuv skips the quota step, and `availableParallelism()` returns `N`: a container without `limits.cpu` on a 4-CPU node gets 4 ✅[^8][^9]
   3. With a quota, `cpus = quota / period` as C integer division, so the fraction is dropped (`50000 / 100000` is `0`), and a result of `0` is raised to `1` ✅[^8]
   4. The result is `cpus` when `cpus < N`, otherwise `N` ✅[^8] In short: `min(N, max(1, floor(quota / period)))` with a quota, and `N` without one
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

Measured 2026-11-06, Node.js 24.22.1 (libuv 1.52.1) in `node:24.22.1-alpine` on an 8-CPU Linux VM; each row is one `docker run` of the script below ✅[^9]

| `docker run` flag | `cpu.max` | `Cpus_allowed_list` | `os.cpus().length` | `availableParallelism()` | Why |
|---|---|---|---|---|---|
| none | `max 100000` | `0-7` | 8 | **8** | No quota, so `N` = 8 |
| `--cpus=0.5` | `50000 100000` | `0-7` | 8 | **1** | `50000 / 100000` = 0, raised to 1 |
| `--cpus=1` | `100000 100000` | `0-7` | 8 | **1** | 1 |
| `--cpus=1.99` | `199000 100000` | `0-7` | 8 | **1** | `199000 / 100000` = 1, fraction dropped |
| `--cpus=2` | `200000 100000` | `0-7` | 8 | **2** | 2 |
| `--cpus=2.9` | `290000 100000` | `0-7` | 8 | **2** | 2, fraction dropped |
| `--cpus=4` | `400000 100000` | `0-7` | 8 | **4** | 4 |
| `--cpuset-cpus=0,1` | `max 100000` | `0-1` | 8 | **2** | No quota, but `N` = 2 because of pinning |
| `--cpuset-cpus=0,1 --cpus=0.5` | `50000 100000` | `0-1` | 8 | **1** | `min(2, 1)` |
| `--cpuset-cpus=0,1 --cpus=4` | `400000 100000` | `0-1` | 8 | **2** | `min(2, 4)`: the quota is above `N` |

The script (`/tmp/ap.sh`) and how to run it:
```sh
cat > /tmp/ap.sh <<'EOF'
node -e '
const os = require("os"), fs = require("fs");
const aff = fs.readFileSync("/proc/self/status", "utf8").match(/Cpus_allowed_list:\s*(.*)/)[1];
const cm = fs.readFileSync("/sys/fs/cgroup/cpu.max", "utf8").trim();
console.log("cpu.max=[" + cm + "] Cpus_allowed_list=[" + aff + "] os.cpus().length=" + os.cpus().length + " availableParallelism()=" + os.availableParallelism());
'
EOF
docker run --rm --cpus=0.5 -v /tmp/ap.sh:/ap.sh:ro node:24.22.1-alpine sh /ap.sh
# in a Kubernetes pod (read-only):
kubectl exec -n <namespace> <pod> -- sh -c 'cat /sys/fs/cgroup/cpu.max; grep Cpus_allowed_list /proc/self/status; node -p "require(\"os\").availableParallelism()"'
```
A Kubernetes pod with `limits.cpu: 500m` on a 4-vCPU node gave `cpu.max` = `50000 100000`, `Cpus_allowed_list` = `0-3`, `os.cpus().length` = 4 and `availableParallelism()` = 1, the same as the `--cpus=0.5` row ✅[^9]

**Where `N` comes from: two cases.** `Cpus_allowed_list` is the list of CPU numbers the process may run on, and `N` is how many CPUs that list holds. The list comes from the `cpuset.cpus` file of the process's cgroup ✅[^12]
1. **`cpuset.cpus` is empty (the container is not restricted to specific CPUs):** the cgroup uses the setting of its nearest ancestor with a non-empty `cpuset.cpus`, or all available CPUs when there is none, so in practice the machine's CPUs ✅[^12] The file `cpuset.cpus.effective` shows the CPUs it really got ✅[^12] This is the normal Kubernetes pod, and Docker without `--cpuset-cpus`.
2. **`cpuset.cpus` is set:** the list is that set of CPUs, and `N` is its size: `0-1` is 2 CPUs, `1,3` is 2 CPUs, `0-3` is 4 CPUs ✅[^12] The kernel can grant fewer CPUs than requested, because the parent's limits win ✅[^12]

Checks inside a running Kubernetes pod (`limits.cpu: 500m`, `requests.cpu: 100m`, 4-vCPU node), read-only, 2026-11-06 ✅[^9]

| Check | Result | What it means |
|---|---|---|
| `cat /sys/fs/cgroup/cpuset.cpus` | empty | Nothing restricted the container to specific CPUs |
| `cat /sys/fs/cgroup/cpuset.cpus.effective` | `0-3` | It may use all 4 node CPUs |
| `Cpus_allowed_list` in `/proc/self/status` | `0-3` | That is the affinity mask, so `N` = 4 |
| `grep -c ^processor /proc/cpuinfo` | 4 | The machine's CPU count, which is why `os.cpus().length` is also 4 |
| `cat /sys/fs/cgroup/cpu.max` | `50000 100000` | The `500m` time budget, which makes `availableParallelism()` 1 (`50000 ÷ 100000` = 0, raised to 1, `min(4, 1)`) |
| Pod QoS class (`kubectl get pod -o jsonpath='{.status.qosClass}'`) | `Burstable` | `requests` are below `limits`, so the pod cannot get exclusive CPUs even under the `static` CPU manager policy |

So `N` is the limit set by the CPUs a process's cgroup grants it, `cpu.max` is a separate time budget, and `availableParallelism()` combines the two to estimate how many threads the Node.js process can usefully run at once.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Reading `pool.utilization` as current load | A pool busy for the whole run reported 0.00083 instead of about 0.83 ✅[^4] | Run times are recorded in microseconds and summarized back to milliseconds, then divided by 1000 again before being compared with a duration in milliseconds ✅[^5] It is also an average since the pool started, not a current value ✅[^5] |
| `maxQueue` set on the pool and tasks carry a `signal` | The limit is not applied: with `maxQueue: 1` and one busy worker, all four signalled tasks ran; without signals, tasks 3 and 4 were rejected with "Task queue is at limit" ✅[^4] | Observed behavior of piscina 5.3.2; enforce the limit in the caller by checking `pool.queueSize` before `run()`. So moving the limit into `new Piscina({ maxQueue })` and deleting the caller check removes the limit without any error: every task is accepted and the queue grows until the per-task timeouts fire ✅[^4] |
| `resourceLimits.maxOldGenerationSizeMb` sized to the whole container | The container is OOM-killed (exit 137) before the worker reaches its cap: 512 MB cap, 512 MiB container, about 200 MiB already used by the main thread, a 3,000-row document ✅[^4] | The limit covers only the worker's JS heap, not `ArrayBuffer`s or other external memory, and the process can still hit a global out-of-memory ✅[^6] Size it as (container limit − main-thread reserve) / workers |
| Cap sized to fit the container | Same container with a 256 MB cap: the 3,000-row document succeeded (heap peak 228 MiB, V8 collects garbage harder), and a 6,000-row one failed with `ERR_WORKER_OUT_OF_MEMORY` while the container stayed up ✅[^4] | The worker is terminated at its heap limit and piscina rejects the task and replaces the worker ✅[^5][^6] |
| No `resourceLimits` on the worker (Node default) | Measured 2026-11-06, Node.js 24.22.1 in `node:24.22.1-alpine`: a worker without `resourceLimits` gets the same heap limit as the main thread, about half of the container memory limit: 259 MiB at 512 MiB, 560 MiB at 1 GiB, 1,120 MiB at 2 GiB ✅[^4] At 512 MiB / 0.5 CPU, no limit and a 256 MB cap behaved the same: 1,500 rows rendered, 3,000 and 6,000 failed with `ERR_WORKER_OUT_OF_MEMORY` and the process stayed up (peak 391 vs 320 MiB) ✅[^4] At 2 GiB / 1 CPU, the default failed 12,000 rows cleanly (peak 1,266 MiB) while a (limit − 256 MB) cap of 1,792 MB rendered them with the container at 1,875 of 2,048 MiB ✅[^4] | The default already follows the container limit, and a derived cap of (limit − reserve) / workers is larger than the default from 1 GiB up, leaving less headroom. With more than one worker the defaults add up (each about half the limit), so set an explicit per-worker cap only then. Supersedes the "size it as (limit − reserve) / workers" advice above for single-worker pools |
| Comparing the output of two builds of a worker-thread renderer byte for byte | pdfmake 0.3.13 output differs between two renders of the same input only in the `CreationDate` value (`(D:YYYYMMDDHHMMSSZ)`) and the trailer `/ID` derived from it ✅[^4] A module preloaded with `node -r freeze-date.js` that pins `Date` runs inside every worker thread too: a Worker created without `execArgv` inherits `process.execArgv`, and the worker printed the pinned time (Node.js 24.22.1, measured 2026-11-09) ✅[^4] | Pin `Date` with a `-r` preload in the process that owns the pool, then compare raw bytes (SHA-256) with no normalization; add pixel comparison with zero tolerance, and a negative control (one changed character or one nudged layout value) to prove the check is not vacuous |
| Container memory after large renders in a single-worker pool | Measured 2026-11-09 in a 0.5 CPU / 512 MiB Kubernetes pod (Node.js 24, piscina, 1 worker, pdfmake tables of 10–1,717 rows): cgroup `memory.current` climbed from 150 MiB idle to 420–450 MiB over the first large renders, then stayed there for the rest of the 30-minute run and was still 422 MiB 60 s after the load stopped; peak 466 MiB, `oom_kill 0`, no restart. Render time was 10.5–12.7 ms per row up to 1,500 rows and 17–20 ms per row at 1,717 rows ✅[^4] | V8 keeps heap pages it has grown into instead of returning them, so size the container for the high-water mark of the largest document, not for idle memory. Why rendering slows per row near the top (for example garbage collection close to the worker heap limit) was not measured |
| Same single-worker pool in a service with a higher idle footprint, compared with a shared headless Chromium | Measured 2026-11-09, two Kubernetes pods with no CPU limit on 4-CPU nodes, same 762–1,495-row export tables: the pdfmake pod (512 MiB limit) idled at 310 MiB, held 400–450 MiB after large renders, and a 1,016-row render added 40–75 MiB; a 1,253-row render that started at 448 MiB was OOM-killed at 510 MiB, while a freshly started pod rendered 1,495 rows at a 464 MiB peak. The Chromium pod (1 GiB limit, one shared browser) added 510–540 MiB per 1,016-row render and was OOM-killed on its first 1,253-row render ✅[^4] After each OOM kill, BullMQ 5.80.9 re-ran the interrupted job (stalled-job recovery): once next to a new job, which caused a second kill, and once with no new request, which killed the Chromium pod a third time ✅[^4] | Size the memory limit from idle footprint + retained level + the largest render, per service: the same renderer that fit 512 MiB in a 150 MiB-idle service did not in a 310 MiB-idle one. A job interrupted by an OOM kill comes back, so an oversized document can crash a pod repeatedly without any new request |
| `process.constrainedMemory()` with no container memory limit | Returned 18446744073709552000 (2^64, cgroup "max") in `node:24.22.1-alpine`, not the documented `0`; 0 on a macOS host ✅[^4] | Treat a value of 0 or above `os.totalmem()` as "no limit" ✅[^4] |
| Treating a BullMQ `Worker` (or a NestJS `@Processor` / `WorkerHost`) as a thread | It is not: with a function processor the job ran on the main thread of the same process (`isMainThread=true`, `threadId=0`, same pid), and 2 s of CPU work in the job froze the event loop for 2.0 s ✅[^4] | BullMQ runs a processor in another process or thread only as a sandboxed processor given as a file path (`useWorkerThreads` applies only then); CPU-heavy work in a standard worker keeps the event loop busy and can stall jobs ✅[^7] `@nestjs/bullmq` passes the provider's bound `process` method, a function ✅[^4] |
| A CPU-bound render on the main thread of an HTTP service, with a liveness probe (every 5 s, 1 s timeout, 3 failures) | The event loop is blocked for the whole render, so probes time out; with back-to-back 2–10 s renders on 0.5 CPU the probe hit 3 consecutive failures within 15–25 s. The same renders in one worker thread kept the longest block at 0.02–0.5 s and no probe failed ✅[^4] | Node runs JavaScript on one main thread; a worker thread has its own event loop ✅[^4] Measured 2026-11-05, pdfmake 0.3.13, 10–1,500-row tables |
| CPU limit vs memory limit for the same render | 1,500-row pdfmake table on the main thread: 0.5 CPU / 512 MiB 28–32 s; 0.5 CPU / 2 GiB 11–16 s; 1 CPU / 512 MiB 5.6–5.7 s; 1 CPU / 2 GiB 3.1–3.5 s ✅[^4] | Both limits matter: doubling the CPU limit cut the time about 4–5×, and quadrupling memory about 1.7–2.2×; the cause was not measured, so size both from a benchmark rather than from the CPU limit alone |
| pdfmake `svg` nodes repeated in every table row (status icons) | 2.2–2.5× slower than drawing the same icons with `canvas` vectors: 300 rows 7.7–9.2 s vs 3.4–4.5 s, 1,500 rows 32–34 s vs 13–14 s on 0.5 CPU / 512 MiB ✅[^4] | pdfmake 0.3.13 handles each `svg` node separately: `DocMeasure.measureSVG` parses the string with xmldoc to read its size, `SVGMeasure.writeDimensions` parses it again and serializes it back, and `Renderer.renderSVG` hands it to the bundled svg-to-pdfkit, which parses it a third time and converts it into PDF drawing operators; a `canvas` ellipse is one `pdfDocument.ellipse()` call ✅[^4] CPU profile of a 300-row render on the host (901 `svg` nodes): svg-to-pdfkit 190 ms (about 20 %), xmldoc/sax 28 ms, garbage collection 39 ms vs 17 ms; total 773–903 ms vs 516–524 ms with vectors ✅[^4] The gap grows to 2.2–2.5× under a 0.5 CPU / 512 MiB limit; the reason was not measured. Draw icons that repeat per row as vectors |
| Statically importing the worker task module into the main-thread service for an optional "render inline" mode (`workers = 0`) | Loads the renderer into the main thread even when every task goes to workers: pdfmake 0.3.13 with fontkit/pdfkit added 84 ms, 7.2 MiB heap and 17 MiB RSS (resident memory) to the main thread and ran its top-level configuration there ✅[^4] | Load it lazily on the inline path only: with `"module": "commonjs"`, TypeScript compiles `await import(...)` to `Promise.resolve().then(() => require(...))`, so after the first call it is a `require` cache hit, measured at 0.5 µs per call ✅[^4] Measured 2026-11-05, Node.js 24.22.1 |
| Rejecting work with HTTP 503 when the pool queue is full, behind a NestJS gRPC service | The status survives only on a direct gRPC call: NestJS `ServiceUnavailableException` → gRPC `UNAVAILABLE` (14). A gRPC client whose service config retries `UNAVAILABLE` resends it: grpc-js 1.14.5 with `maxAttempts: 4, initialBackoff 0.5s, backoffMultiplier 2` delivered 4 attempts at 0, 0.5, 1.6 and 3.6 s before the caller saw the error ✅[^4] Behind a BullMQ job awaited with `job.waitUntilFinished()`, the status is lost: bullmq 5.80.9 rejects with `new Error(failedReason)`, a plain `Error` holding only the message, so a filter that maps `HttpException` statuses falls back to 500 ✅[^4] | Decide per entry point: on a retried gRPC path a 503 adds load during overload (make sure everything before the render is safe to repeat); on a queued path rethrow with the status or check capacity before enqueuing. Measured 2026-11-05 |
| `pool.queueSize` | Counts tasks waiting for a worker, minus the capacity of workers still starting; running tasks are not counted ✅[^5] | Defined that way in piscina's `queueSize` getter ✅[^5] |
| A CPU limit that is a whole number plus a fraction (1.99 CPU, 2.9 CPU) | `availableParallelism()` rounds down: 1.99 gives 1 and 2.9 gives 2 ✅[^9] | libuv uses integer division of `quota` by `period` ✅[^8] A pool sized from it leaves the fractional CPU unused |
| `os.cpus().length` inside a container with a CPU limit | Still the machine's CPU count (8 in every row of the table above, 4 in the pod) ✅[^9] | It lists the machine's CPUs and ignores `cpu.max`; only `availableParallelism()` reads the quota ✅[^8] |
| `pool.completed` | Counts every task that finished, including failed and aborted ones ✅[^5] | The counter is incremented in the task callback before the error is checked ✅[^5] |
| `idleTimeout` set on a pool whose `minThreads` equals `maxThreads` | Has no effect: with `minThreads: 2, maxThreads: 2, idleTimeout: 300` the pool still had 2 threads 1 s after a burst ✅[^13] | piscina only shuts down an idle worker while the pool holds more workers than `minThreads` ✅[^13] |
| `idleTimeout` on a pool with `minThreads: 1, maxThreads: 2` | A second worker started by a burst is shut down after it has been idle for `idleTimeout` ms (300 ms: 2 threads after the burst, 1 thread 1 s later); with `10000` it was still there after 1 s; with the default `0` it was shut down immediately, so a burst never kept 2 threads ✅[^13] | Documented as "how long a Worker is allowed to be idle, i.e. not handling any tasks, before it is shut down"; the default is immediate, and `Infinity` means never ✅[^13] The documentation warns that the default can lose performance because of the cost of stopping and starting threads ✅[^13] |

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
- Verified: 81 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-09

## References
- [piscina](https://github.com/piscinajs/piscina) — piscina project, living. Backs: How it works §1–2. [^1]
- [Node.js 24: `os.availableParallelism()`](https://nodejs.org/docs/latest-v24.x/api/os.html#osavailableparallelism) — Node.js project, living. Backs: Summary, How it works §4. [^2]
- [libuv ChangeLog](https://github.com/libuv/libuv/blob/v1.x/ChangeLog) — libuv project, living. Backs: Problem, How it works §4 (1.49.0 "fix uv_available_parallelism using cgroup", 1.52.0 "handle cgroups cpu.max with limit < period"), Edge cases, Trade-offs. [^3]
- Local measurements, 2026-11-03 to 2026-11-09 — Node.js 24.22.1 (libuv 1.52.1), piscina 5.3.2, pdfmake 0.3.12 (2026-11-03) and 0.3.13 (2026-11-05 onward), grpc-js 1.14.5 and bullmq 5.80.9, in `node:24.22.1-alpine` under OrbStack with `docker run --cpus` / `--memory`, plus read-only checks in one 0.5 CPU / 512 MiB Kubernetes pod; each Edge cases row gives its own date. Method and numbers in Worked example and Edge cases. [^4]
- `node_modules/piscina/dist/index.js` and `dist/histogram.js` (piscina 5.3.2) — getters `queueSize`, `completed`, `utilization`, `duration`; `runTask`; `toHistogramIntegerNano`. Backs: How it works §2–3, §5, Edge cases. [^5]
- [Node.js 24: Worker `resourceLimits`](https://nodejs.org/docs/latest-v24.x/api/worker_threads.html#new-workerfilename-options) — Node.js project, living. Backs: Edge cases (limits cover the JS engine only, not `ArrayBuffer`s; the process may still abort on global OOM). [^6]
- [libuv v1.52.1 `src/unix/core.c`](https://github.com/libuv/libuv/blob/v1.52.1/src/unix/core.c) and [`src/unix/linux.c`](https://github.com/libuv/libuv/blob/v1.52.1/src/unix/linux.c) — libuv project, 2026. Backs: How it works §4 (`uv_available_parallelism`, `uv__get_cgroupv2_constrained_cpu`: affinity count, `cpu.max`, integer division, minimum 1). The [libuv documentation](https://docs.libuv.org/en/v1.x/misc.html#c.uv_available_parallelism) still describes only the affinity mask. [^8]
- Local measurement, 2026-11-06 — Node.js 24.22.1 (libuv 1.52.1) in `node:24.22.1-alpine` under OrbStack (8-CPU Linux VM) with `docker run --cpus` / `--cpuset-cpus`, and `kubectl exec` in one Kubernetes pod; script and outputs in Worked example. Backs: Worked example, Edge cases. [^9]
- [Docker: Resource constraints (`--cpuset-cpus`)](https://docs.docker.com/engine/containers/resource_constraints/) — Docker, living. Backs: How it works §4.1 (comma list or hyphen range, first CPU is 0). [^10]
- [Kubernetes: Control CPU Management Policies on the Node](https://kubernetes.io/docs/tasks/administer-cluster/cpu-management-policies/) — Kubernetes project, living. Backs: How it works §4.1 (static policy: only Guaranteed pods with integer CPU requests get exclusive CPUs). [^11]
- [Linux kernel: Control Group v2, cpuset interface files](https://docs.kernel.org/admin-guide/cgroup-v2.html) — Linux kernel documentation, living. Backs: Worked example "Where `N` comes from" (`cpuset.cpus` empty means the nearest ancestor's setting or all available CPUs; `cpuset.cpus.effective`; the parent's constraints win). [^12]
- [BullMQ: Sandboxed processors](https://docs.bullmq.io/guide/workers/sandboxed-processors) — BullMQ project, living. Backs: Edge cases (standard workers run on the event loop; sandboxed processors run in another process or worker thread). [^7]
- [piscina README: Options, `idleTimeout`](https://github.com/piscinajs/piscina/blob/current/README.md) and `node_modules/piscina/dist/index.js` (piscina 5.3.2, the idle-worker shutdown check `this.workers.size > this.options.minThreads`) — piscina project, living. Local measurement 2026-11-06, piscina 5.3.2, Node.js 24.22.1: a burst of 3 tasks of 100 ms, thread count right after the burst and 1 s later, for `minThreads`/`maxThreads`/`idleTimeout` of 1/2/300, 2/2/300, 1/2/0 and 1/2/10000. Backs: Edge cases (`idleTimeout`). [^13]

## Related
- `js-runtime/abort-signal.md` — the per-task timeout is an `AbortSignal.timeout()` passed to `pool.run()`.
- `concurrency/blocking-in-async-runtimes.md` — why CPU-bound work belongs off the event loop.
- `operations/structured-logging.md` — log per-task duration and queue size as structured fields.
- `js-runtime/piscina-queue-size.md` — what `queueSize` counts, `maxQueue` with abort signals, `needsDrain` and `'drain'`, with the official documentation and issues.
- `js-runtime/node-worker-default-heap-limit.md` — the rule behind a worker's default heap limit and the measured OOM behaviors without `resourceLimits`.
- `kubernetes/cpu-limits-and-throttling.md` — how `limits.cpu: 500m` becomes `cpu.max` `50000 100000` and how the kernel throttles the container.
