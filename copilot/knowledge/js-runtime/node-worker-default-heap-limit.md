---
schema: knowledge-doc/v1
type: concept
topic: js-runtime
status: verified
applies-to: ["Node.js 24 (V8 13.6)", "64-bit Linux, cgroup v2", "worker_threads and piscina 5.3"]
last-verified: 2026-11-06
last-updated: 2026-11-06
tags: [worker-threads, piscina, resourceLimits, heap, maxOldGenerationSizeMb, oom, container, cgroup]
---

# Default heap limit of a Node.js worker thread in a memory-limited container

## Summary
**TL;DR:** A worker thread started without `resourceLimits` gets a JavaScript heap limit worked out from the container's memory limit: half of it, at least 256 MiB and at most 2 GiB ✅[^1][^2][^4] Every worker gets that size independently, so the limits of several workers add up to more than the container has, and the kernel kills the whole container (exit 137) before any worker hits its own limit ✅[^4]
**Use this when:** Deciding whether to set `resourceLimits.maxOldGenerationSizeMb` on a `Worker` or a piscina pool, reading `ERR_WORKER_OUT_OF_MEMORY` or `OOMKilled` after adding worker threads, or sizing a pod's memory limit for a service that renders in workers.
**Not this doc:** Use `js-runtime/worker-thread-pools.md` for pool sizing and CPU limits; use `kubernetes/memory-limits-and-oom-kill.md` for how the kernel enforces a container's memory limit.

## Problem
`new Worker()` and `new Piscina()` accept `resourceLimits`, but it is optional, and the Node.js documentation does not state what a worker gets without it ✅[^5] Two wrong beliefs follow: that there is no limit, and that the limit is the whole container.
Neither is true. The default exists, follows the container, and is large: in a 512 MiB container each worker may grow to 256 MiB of heap ✅[^4] The limit protects a single worker, not the container, so adding workers without setting the limit can turn a clean per-task failure into a container restart ✅[^4]

## Mental model
**Analogy:** A restaurant tells every diner at a table "you may eat half of the food on the table". With one diner that is a rule. With two diners (and the kitchen staff, the main thread, eating too) the promises add up to more than the table holds, and the manager (the kernel) clears the whole table before either diner has eaten their half.
**Artifact:**
```sh
docker run --rm --memory=512m node:24.22.1-alpine node -e '
const { Worker } = require("node:worker_threads");
new Worker("console.log(JSON.stringify(require(\"node:worker_threads\").resourceLimits))", { eval: true });'
# {"maxYoungGenerationSizeMb":3,"maxOldGenerationSizeMb":256,"codeRangeSizeMb":0,"stackSizeMb":4}
```

## How it works
1. Node.js creates the worker's V8 isolate with `SetIsolateCreateParamsForNode`, the same function the main thread uses ✅[^1][^3]
2. That function takes `total = min(os.totalmem(), process.constrainedMemory())`, so a container's cgroup limit wins over the machine's RAM, and with no container limit the machine's RAM is used ✅[^1]
3. It asks V8 to configure default heap sizes for `total` (`ResourceConstraints::ConfigureDefaults`) ✅[^1] V8 13.6 computes the old generation as `total / 4 × 2` (the multiplier is `kSystemPointerSize / 4`, which is 2 on 64-bit), caps it at 2 GiB (4 GiB when `total` is at least 15 GiB), and raises it to a minimum, then derives the young generation from it ✅[^2] The minimum was not located in the source; 256 MiB was measured ✅[^4]
4. `Worker::UpdateResourceConstraints` then applies the options you passed: a value above 0 replaces the default, anything else keeps V8's number and writes it back, which is why `require("node:worker_threads").resourceLimits` shows real numbers inside a worker that was given none ✅[^3]
5. When the worker's old generation reaches its limit, Node.js terminates that worker with `ERR_WORKER_OUT_OF_MEMORY` ✅[^5] piscina rejects the task and starts a replacement worker ✅[^4]
6. The limit covers the JavaScript engine's heap only, not `ArrayBuffer`s, `Buffer`s, native memory or thread stacks, and the process can still abort on a global out-of-memory ✅[^5] The kernel compares the container's total memory use with `memory.max` and kills the whole container when it is over ✅[^4]

In short: `old generation limit = clamp(container limit ÷ 2, 256 MiB, 2 GiB)`, per worker.

## Worked example
Measured 2026-11-06, Node.js 24.22.1 (V8 13.6.233) in `node:24.22.1-alpine`, one `docker run --memory=<m> --memory-swap=<m>` per row, piscina 5.3.2 with no `resourceLimits`, on an 8 GiB Linux VM ✅[^4]

| Container limit | `constrainedMemory()` | Worker `maxOldGenerationSizeMb` / `maxYoungGenerationSizeMb` | `clamp(limit ÷ 2, 256, 2048)` |
|---|---|---|---|
| 128m | 128 MB | 256 / 3 | 256 |
| 256m | 256 MB | 256 / 3 | 256 |
| 512m | 512 MB | 256 / 3 | 256 |
| 768m | 768 MB | 384 / 36 | 384 |
| 1024m | 1024 MB | 512 / 48 | 512 |
| 2048m | 2048 MB | 1024 / 96 | 1024 |
| 3072m | 3072 MB | 1536 / 144 | 1536 |
| 4096m | 4096 MB | 2048 / 192 | 2048 |
| 6144m | 6144 MB | 2048 / 192 | 2048 |
| none (8 GiB VM) | 2^64 | 2048 / 192 | 2048 |

All 11 rows match the formula. The option name says `Mb` but the unit is MiB: a 512 MiB container gives exactly 256 ✅[^4]

The 2 GiB upper cap becomes 4 GiB only when `total` (step 2: the smaller of the machine's own RAM, `os.totalmem()`, and the container's memory limit) is at least 15 GiB ✅[^1][^2] So there are two branches, and the branch is chosen by `total`:

| `total` | Upper cap | Example |
|---|---|---|
| Below 15 GiB | 2 GiB | The 8 GiB VM with no container limit gave 2048 ✅[^4]; any container limit below 15 GiB, on a machine of any size ✅[^1][^2] |
| 15 GiB or more | 4 GiB | A 16 GiB laptop with no container limit gave 4096 ✅[^4]; a container limit of 15 GiB or more, on a machine with at least that much RAM ✅[^1][^2] |

The exact numbers a worker gets at the container sizes most pods use (`require("node:worker_threads").resourceLimits` and `v8.getHeapStatistics().heap_size_limit` read inside the worker) ✅[^4]

| Container limit | Default `maxOldGenerationSizeMb` (MiB) | Default `maxYoungGenerationSizeMb` (MiB) | `heap_size_limit` inside the worker (old + young + other, MB) | Share of the container limit (old generation) |
|---|---|---|---|---|
| 512m | 256 | 3 | 259 | 50% |
| 1024m | 512 | 48 | 560 | 50% |
| 2048m | 1024 | 96 | 1120 | 50% |
| none (8 GiB VM) | 2048 | 192 | 2240 | not applicable: the VM's RAM ÷ 2 = 4002 MiB, capped at 2048 |

The default is **not always half**. It is half only between 512 MiB and 4 GiB of container memory; below 512 MiB the 256 MiB minimum applies (so it is more than half, and at 128m more than the whole container), and from 4 GiB up the 2 GiB cap applies (it becomes 4 GiB only when `total`, the smaller of the machine's RAM and the container limit, is at least 15 GiB; see the table above) ✅[^2][^4]

What happens in a **512 MiB container** (0.5 CPU), where the default limit is 256 MiB for each worker and for the main thread ✅[^4] The "Heap each worker allocates" column is **the amount the test asked each worker to allocate**, not the limit: 200, 240, 250 and 300 MB were chosen to sit below, near and above the 256 MiB limit. Each worker allocates JavaScript heap (arrays of numbers) ✅[^4]

| Workers | Heap each worker allocates | Result |
|---|---|---|
| 1 | 200 MB (under its 256 MiB limit) | Task succeeds |
| 1 | 240 MB | Task succeeds |
| 1 | 256 MB (its limit) | Task rejected with `ERR_WORKER_OUT_OF_MEMORY`; the process and the container stay up |
| 1 | 300 MB (over it) | Task rejected with `ERR_WORKER_OUT_OF_MEMORY`; the process and the container stay up |
| 2 | 200 MB (400 MB total) | Both succeed |
| 2 | 240 MB (480 MB total, plus the main thread) | Both succeeded, with almost no room left |
| 2 | 250 MB (500 MB total, plus the main thread) | **Container killed: exit code 137, `OOMKilled: true`**, although each worker is below its own 256 MiB limit |
| 2 | 300 MB | **Container killed: exit code 137, `OOMKilled: true`**; no per-task error was returned |
| 2, with `resourceLimits.maxOldGenerationSizeMb: 128` | 200 MB | Both rejected with `ERR_WORKER_OUT_OF_MEMORY`; the container stayed up |
| 2, with `maxOldGenerationSizeMb: 128` | 100 MB | Both succeed |

**Why 2 × 250 MB kills the container although each worker is below its limit:** two different things are being checked by two different parties. V8 checks, for each worker alone, whether that worker's old generation has reached its own limit (256 MiB); at 250 MB each, neither has, so V8 raises no error ✅[^1][^3] The kernel checks the **container total** against `memory.max` (512 MiB): the two workers' 500 MB of heap, plus the main thread's own memory (its heap, the loaded modules and Node.js itself; an idle container with one worker used about 50 to 60 MiB in the measurements of `js-runtime/worker-thread-pools.md`), plus memory outside the heap, is over 512 MiB ✅[^4] The kernel acts first, kills the whole container (exit 137), and no worker ever gets to report `ERR_WORKER_OUT_OF_MEMORY` ✅[^4] The per-worker limit only protects the container when the sum of all limits (main thread and every worker) fits inside it.

What happens in a container **smaller than 512 MiB**, where the default worker limit is still 256 MiB (one worker; `--memory` and `--memory-swap` set to the same size so the container cannot swap; the worker allocates the heap shown) ✅[^4]

| Container limit | Worker's default limit | Heap the worker allocates | Result |
|---|---|---|---|
| 128m | 256 MiB (larger than the container) | 0 MB (the worker starts and runs an empty task) | Succeeds |
| 128m | 256 MiB (larger than the container) | 100 MB | Succeeds |
| 128m | 256 MiB | 150 MB | **Container killed: exit 137, `OOMKilled: true`** |
| 192m | 256 MiB (larger than the container) | 150 MB | Succeeds |
| 192m | 256 MiB | 200 MB | **Container killed: exit 137, `OOMKilled: true`** |
| 256m | 256 MiB (equal to the container) | 200 MB | Succeeds |
| 256m | 256 MiB | 240 MB | **Container killed: exit 137, `OOMKilled: true`** |
| 384m | 256 MiB | 250 MB | Succeeds |

**Why the first rows succeed although the worker's limit (256 MiB) is larger than the container:** the heap limit is a number V8 compares the heap against as it grows, not memory that is set aside. When Node.js creates a worker it registers a "near heap limit" callback (`isolate->AddNearHeapLimitCallback(Worker::NearHeapLimit, w)`); V8 calls it when the worker's own heap, as V8 tracks it, is about to reach the limit (V8 first tries garbage collection), and the callback makes Node.js throw `ERR_WORKER_OUT_OF_MEMORY` ✅[^3] The check compares V8's own heap size with the limit; it does not look at the container's memory ✅[^3] V8 does not take 256 MiB when the worker starts; the worker's heap grows only as the task allocates, and the kernel counts only memory that is really in use ✅[^3][^4] A worker that allocates 100 MB inside a 128 MiB container stays under the container limit together with the main thread and Node.js itself, so nothing fails, even though its own ceiling is twice the container ✅[^4] The kill comes when the heap the worker really holds, added to what the main thread and Node.js already use, passes the container limit: between 100 and 150 MB at 128m, between 150 and 200 MB at 192m, between 200 and 240 MB at 256m ✅[^4]

In every killed row the worker was far below its own 256 MiB limit, so V8 never stopped it: the 256 MiB minimum is bigger than the memory that is really available to the worker (the container's limit minus what the main thread and Node.js already use), so the kernel's container-wide check is the only one that triggers ✅[^4]

The test used `task.js`, which allocates `mb` arrays of 131,072 doubles (about 1 MB each) and returns, run from this script with `THREADS` workers; `WITH_LIMIT` adds `resourceLimits`:
```js
// task.js
module.exports = ({ mb }) => {
  const hold = [];
  for (let i = 0; i < mb; i++) hold.push(new Array(131072).fill(i + 0.5));
  return { allocatedMb: hold.length };
};
// test.js (outline)
const pool = new Piscina({
  filename: require.resolve('./task.js'), minThreads: THREADS, maxThreads: THREADS,
  ...(process.env.WITH_LIMIT && { resourceLimits: { maxOldGenerationSizeMb: +process.env.WITH_LIMIT } }),
});
const results = await Promise.allSettled(Array.from({ length: THREADS }, () => pool.run({ mb: ALLOC_MB })));
```
```sh
docker run --name pt --memory=512m --memory-swap=512m --cpus=0.5 -e THREADS=2 -e ALLOC_MB=300 \
  -v "$PWD":/t:ro -w /t node:24.22.1-alpine node test.js
docker inspect pt --format '{{.State.OOMKilled}} {{.State.ExitCode}}'   # true 137
```

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Container limit below 512 MiB (128m, 192m, 256m, 384m) | The default is still 256 MiB: equal to the whole container at 256m, larger at 128m and 192m ✅[^4] The worker's limit is therefore never reached; the **kernel kills the whole container** (exit 137) when the container's total memory passes its limit, as soon as the worker holds about 150 MB at 128m, 200 MB at 192m, 240 MB at 256m ✅[^4] | A minimum of 256 MiB applies; half of the limit would be smaller ✅[^1][^2] V8 checks only the worker's own heap against 256 MiB; the kernel checks the container total (main thread, Node.js itself, all workers, Buffers, native memory) against the container limit, and the container limit is the smaller number ✅[^4] Set `resourceLimits.maxOldGenerationSizeMb` explicitly below the container limit minus the main thread's share in containers this small |
| No container memory limit | 2 GiB when the machine's own RAM is below 15 GiB, 4 GiB when it is 15 GiB or more ✅[^2][^4] | `total` is the machine's RAM and the cap applies ✅[^1][^2] |
| The main thread | Has the same default heap limit as a worker: 259 MB at 512m, which is 256 MiB of old generation plus 3 MiB of young generation ✅[^4] | The main thread and workers use the same sizing function ✅[^1][^3] |
| Two or more workers | Their limits add up: 2 × 256 MiB plus the main thread's 256 MiB is 768 MiB in a 512 MiB container ✅[^4] | Each worker is sized as if it were alone ✅[^3] |
| A worker allocates `Buffer`s or `ArrayBuffer`s | They do not count against the heap limit, so memory can grow past it without `ERR_WORKER_OUT_OF_MEMORY` ✅[^5] | The limit covers the JavaScript heap only ✅[^5] |
| `--max-old-space-size` set on the command line | It overrides `maxOldGenerationSizeMb` ✅[^5] | Documented precedence ✅[^5] |
| `resourceLimits: { maxOldGenerationSizeMb: 0 }` | Treated as not set: the default applies ✅[^3] | Only values above 0 replace the default ✅[^3] |
| The kernel limit is hit first | The container is killed (exit 137) and every in-flight request is lost ✅[^4] | The per-worker limit is checked by V8; the container limit by the kernel, and the kernel reaches it first when the sum is larger ✅[^4] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Leave `resourceLimits` unset | No configuration; one worker in a container of 512 MiB or more fails cleanly when it passes about half the container ✅[^4] | With two or more workers the sum can exceed the container and a kernel kill replaces the clean error ✅[^4] |
| Set `maxOldGenerationSizeMb` to (container limit − main-thread reserve) ÷ workers | An oversized task fails alone with `ERR_WORKER_OUT_OF_MEMORY`; the container stays up ✅[^4] | A fixed number to maintain per environment; too high a reserve rejects tasks the container could have handled |
| Run one worker | The default of about half the container is a sane single limit ✅[^4] | No parallelism |

## Case studies
- _None yet._

## Takeaways
- In a container smaller than 512 MiB the default worker limit (256 MiB) is larger than the memory really available, so the kernel kills the container before any worker error; set `resourceLimits.maxOldGenerationSizeMb` explicitly. [rule-candidate]
- When a pool has more than one worker, set `resourceLimits.maxOldGenerationSizeMb` to (container memory limit − main-thread reserve) ÷ workers; do not rely on the default. [rule-candidate]
- To see what a worker really got, log `require("node:worker_threads").resourceLimits` from inside it. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 58 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-06

## References
- [Node.js v24.22.1 `src/api/environment.cc`](https://github.com/nodejs/node/blob/v24.22.1/src/api/environment.cc) — Node.js project, 2026. Backs: How it works §1–3 (`SetIsolateCreateParamsForNode`: `min(total memory, constrained memory)` and `ConfigureDefaults`). [^1]
- [V8 13.6.233 `src/heap/heap.cc`](https://github.com/v8/v8/blob/13.6.233/src/heap/heap.cc) and [`src/heap/heap.h`](https://github.com/v8/v8/blob/13.6.233/src/heap/heap.h) — V8 project, 2026. Backs: How it works §3 (`HeapSizeFromPhysicalMemory`, `MaxOldGenerationSize` with the 2 GiB and 4 GiB cap, `kPhysicalMemoryToOldGenerationRatio` = 4, `kHeapLimitMultiplier`). [^2]
- [Node.js v24.22.1 `src/node_worker.cc`](https://github.com/nodejs/node/blob/v24.22.1/src/node_worker.cc) — Node.js project, 2026. Backs: How it works §1, §4 (`Worker::UpdateResourceConstraints`: values above 0 override, others keep the default and are written back to `resourceLimits`). [^3]
- Local measurement, 2026-11-06 — Node.js 24.22.1 (V8 13.6.233) in `node:24.22.1-alpine` under OrbStack, piscina 5.3.2, `docker run --memory --memory-swap --cpus`; scripts and outputs in Worked example. Backs: Worked example, Edge cases, Trade-offs. [^4]
- [Node.js 24: `new Worker()` options, `resourceLimits`](https://nodejs.org/docs/latest-v24.x/api/worker_threads.html#new-workerfilename-options) and [`ERR_WORKER_OUT_OF_MEMORY`](https://nodejs.org/docs/latest-v24.x/api/errors.html#err_worker_out_of_memory) — Node.js project, living. Backs: Problem, How it works §5–6, Edge cases (the option is optional, limits cover the JS engine only, the process may still abort, `--max-old-space-size` overrides). [^5]

## Related
- `js-runtime/worker-thread-pools.md` — pool sizing, CPU limits, `availableParallelism()`.
- `kubernetes/memory-limits-and-oom-kill.md` — why memory over the container limit is killed (exit 137) instead of throttled.
- `js-runtime/index.md` — topic index.
