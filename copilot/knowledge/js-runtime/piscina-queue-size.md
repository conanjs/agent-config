---
schema: knowledge-doc/v1
type: concept
topic: js-runtime
status: verified
applies-to: ["piscina 5.x (measured on 5.3.2)", "Node.js 24"]
last-verified: 2026-11-06
last-updated: 2026-11-06
tags: [piscina, queueSize, maxQueue, needsDrain, drain, backpressure, abort-signal, worker-threads]
---

# piscina queueSize: what it counts, and what it does not limit

## Summary
**TL;DR:** `pool.queueSize` is the number of tasks waiting for a worker thread: tasks that are running are not counted, and tasks that wait while a worker is still starting are not counted either ✅[^1][^6][^8] `maxQueue` is the limit on that same waiting line, but in piscina 5.3.2 it is not enforced for tasks submitted with an `AbortSignal`, so a caller that uses per-task timeouts must check `queueSize` itself ✅[^8]
**Use this when:** Logging or alerting on `pool.queueSize`, choosing `maxQueue`, rejecting work when the pool is busy, or reading `needsDrain` and `'drain'` for backpressure.
**Not this doc:** Use `js-runtime/worker-thread-pools.md` for pool sizing against a container CPU limit and for the other piscina behaviors measured there; use `js-runtime/abort-signal.md` for the cancellation contract of `AbortSignal.timeout()`.

## Problem
The documentation defines `queueSize` in one sentence ("the current number of tasks waiting to be assigned to a Worker thread") ✅[^1][^2] Four questions are left open: does it count the task a worker is running right now, what happens to it while workers are still starting, does `maxQueue` apply to every task, and how do `needsDrain` and `'drain'` relate to it. Reading the wrong answer into the number gives a dashboard that shows 0 while work is piling up, or a "queue limit" that never rejects anything ✅[^8]

## Mental model
**Analogy:** A restaurant host stand. Guests already seated at a table (running tasks) are not in the line. Guests who are told "a table is being set, it is ready in a minute" (workers that are starting) are not in the line either: that table is already theirs. `queueSize` is the number of guests standing at the host stand with no table assigned.
**Artifact:**
```js
const pool = new Piscina({ filename, minThreads: 1, maxThreads: 1 });
// 1 worker already running, 5 tasks submitted one after another:
// pool.queueSize after each run() call = 0, 1, 2, 3, 4
```

## How it works
1. `pool.run(task)` first tries to hand the task to a ready worker. When none is free, the task is stored in the pool's internal queue ✅[^6]
2. Tasks submitted with an `AbortSignal` are kept in a second list, `skipQueue`, and tasks without one in `taskQueue` ✅[^6] Both are lines of tasks waiting for a worker
3. `pendingCapacity()` is the number of workers that are still starting multiplied by `concurrentTasksPerWorker` (default 1) ✅[^6]
4. `queueSize` is `max(taskQueue.size + skipQueue.length − pendingCapacity, 0)`: everything waiting, minus the places that starting workers will take ✅[^6] Running tasks are in neither list ✅[^6][^8]
5. `maxQueue` (default `Infinity`; `'auto'` means `maxThreads²`) is checked when a new task arrives: if `taskQueue.size` is at `maxQueue + pendingCapacity`, the promise rejects with "Task queue is at limit" ✅[^1][^6][^8] The check reads `taskQueue.size` only, not `skipQueue` ✅[^6]
6. After every submit and every task end, the pool compares its usage with its capacity: when every worker is busy it sets `needsDrain` and emits `'needsDrain'`; when usage falls below capacity again it emits `'drain'` once ✅[^6][^8]

## Worked example
Measured 2026-11-06, piscina 5.3.2, Node.js 24.22.1, a task that waits 100 to 300 ms; script and outputs below ✅[^8]

| Scenario | Result |
|---|---|
| 1 ready worker, 5 tasks submitted in a row | `queueSize` after each `run()` = `0, 1, 2, 3, 4`; after all finished `0` ✅[^8] |
| Same, tasks submitted with an `AbortSignal` | Same values `0, 1, 2, 3, 4` ✅[^8] (piscina before 5.2.0 reported `0` here ✅[^3][^4][^5]) |
| Cold pool: 2 workers still starting, 5 tasks in a row | `queueSize` after each `run()` = `0, 0, 1, 2, 3`: the first 2 tasks are counted against the starting workers ✅[^8] |
| `maxQueue: 2`, 1 ready worker, 6 tasks, no signal | 3 fulfilled (1 running + 2 waiting) and 3 rejected with "Task queue is at limit" ✅[^8] |
| `maxQueue: 2`, 1 ready worker, 6 tasks, **with** a signal | All 6 accepted, none rejected ✅[^8] |
| `maxQueue: 'auto'`, `maxThreads: 3` | `pool.options.maxQueue` = 9; with no `maxQueue` it is `Infinity` ✅[^8] |
| 1 ready worker, 1 running task, nothing waiting | `queueSize` 0 and `needsDrain` **true** ✅[^8] |
| 2 ready workers, 1 running task | `queueSize` 0 and `needsDrain` false; with 2 tasks, `needsDrain` true ✅[^8] |
| 1 worker, 3 tasks of 150 ms | `'needsDrain'` emitted several times (9 times at 0, 150 and 301 ms), `'drain'` once at 453 ms, after the last task finished ✅[^8] |

```js
// sleep.task.js
module.exports = ({ ms }) => new Promise((resolve) => setTimeout(() => resolve(ms), ms));
// queue-test.js (one of the cases)
const pool = new Piscina({ filename: require.resolve('./sleep.task.js'), minThreads: 1, maxThreads: 1, maxQueue: 2 });
await pool.run({ ms: 1 }); // make sure the worker is ready
const results = await Promise.allSettled(Array.from({ length: 6 }, () => pool.run({ ms: 200 })));
console.log(results.filter((r) => r.status === 'rejected').map((r) => r.reason.message)); // 3 x 'Task queue is at limit'
```

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `maxQueue` set and every task carries an `AbortSignal` | The limit is never enforced: 6 tasks into `maxQueue: 2` on one worker were all accepted ✅[^8] | The limit is checked against `taskQueue.size`, and signalled tasks wait in `skipQueue` ✅[^6] A GitHub comment on issue #1029 reports the same ✅[^3] Check `pool.queueSize` before `run()` in the caller ✅[^8] |
| piscina older than 5.2.0, tasks with a signal | `queueSize` stayed 0 while tasks waited ✅[^3] | `queueSize` counted only `taskQueue`; fixed by "include skipQueue in queueSize calculation" in 5.2.0 (2026-06-12) ✅[^4][^5] |
| Reading `queueSize` right after creating the pool | Lower than the number of waiting tasks: starting workers absorb tasks ✅[^8] | `pendingCapacity()` is subtracted ✅[^6] |
| Treating `needsDrain` as "tasks are queued" | It is true as soon as every worker is busy, even with an empty queue ✅[^8] | It compares running tasks with total capacity, not waiting tasks with the queue ✅[^6] The documentation says "capacity exceeded by the number of tasks enqueued" ✅[^1][^2] |
| Waiting for `'drain'` when `queueSize` hits 0 | The event comes later, when a worker has spare capacity (453 ms, not 301 ms in the 3-task run) ✅[^8] | The documentation says `'drain'` is emitted "whenever the queueSize reaches 0" ✅[^2] The implementation emits it when usage drops below capacity ✅[^6] |
| `maxQueue` too small | Workers can sit idle and be shut down ✅[^7] | The maintainers advise about `maxThreads²` as a starting point and a benchmark ✅[^1][^7] |
| `maxQueue` too large or unset | The queue grows without bound while tasks hold their data in memory ✅[^1][^7] | Default is no limit ✅[^1][^8] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| `maxQueue` on the pool | Rejects in one place, with piscina's own error | Not enforced for tasks with an `AbortSignal` (5.3.2) ✅[^8] |
| Check `queueSize >= limit` in the caller before `run()` | Works with and without signals; the caller chooses the error (for example HTTP 503) | Each caller path must do it; two callers submitting in the same tick can both pass the check |
| `needsDrain` and `'drain'` | Good for pausing a stream or a producer ✅[^1] | True while all workers are busy, so it signals "no spare capacity", not "a queue exists" ✅[^8] |

## Case studies
- _None yet._

## Takeaways
- When tasks carry an `AbortSignal`, do not rely on `maxQueue`: compare `pool.queueSize` with your limit before calling `run()`. [rule-candidate]
- Use `queueSize` for "how many are waiting" and per-task duration for "how slow"; read `needsDrain` as "all workers busy". [rule-candidate]
- Keep piscina at 5.2.0 or newer when `queueSize` is logged for tasks with a signal. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 44 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-06

## References
- [piscina on npm](https://www.npmjs.com/package/piscina) and [piscina README on GitHub](https://github.com/piscinajs/piscina/blob/current/README.md) — piscina project, living. Backs: Summary, Problem, How it works §5 (`queueSize`, `maxQueue`, `'auto'`, Backpressure, Queue Size sections). The npm page shows the same README and blocks automated requests, so link checks use the GitHub copy. [^1]
- [piscina documentation: API Overview](https://piscinajs.dev/api-reference/API%20Overview) and [Events](https://piscinajs.dev/api-reference/Events) — piscina project, living. Backs: Problem, Edge cases (`'drain'` "whenever the queueSize reaches 0", `needsDrain` wording). [^2]
- [piscina issue #1029: queueSize is incorrect when using AbortSignal](https://github.com/piscinajs/piscina/issues/1029) — piscina issue tracker, 2026-04-22. Backs: Worked example, Edge cases (queueSize 0 with a signal on 5.1.4; a comment reports `maxQueue` is not reached with a signal). [^3]
- [piscina pull request #1030: include skipQueue in queueSize calculation](https://github.com/piscinajs/piscina/pull/1030) — piscina project, merged 2026-06-04. Backs: Edge cases. [^4]
- [piscina CHANGELOG, 5.2.0](https://github.com/piscinajs/piscina/blob/v5.2.0/CHANGELOG.md) — piscina project, 2026-06-12. Backs: Edge cases (the fix is in 5.2.0). [^5]
- `node_modules/piscina/dist/index.js` (piscina 5.3.2) — `get queueSize`, `pendingCapacity()`, the `maxQueue` check in `runTask`, `_returnUndistributedTask`, `_maybeDrain`, `get needsDrain`. Backs: How it works §1–6, Edge cases. [^6]
- [piscina documentation: Performance Notes, Queue Size](https://piscinajs.dev/advanced-topics/Performance%20Notes) and [Learning to Swim with Piscina, the Node.js worker pool](https://nearform.com/insights/learning-to-swim-with-piscina-the-node-js-worker-pool) — piscina project and NearForm, living. Backs: Edge cases (a `maxQueue` that is too small or too large; about `maxThreads²`; "it can often make sense to check the current queue size before posting a task"). [^7]
- Local measurement, 2026-11-06 — piscina 5.3.2, Node.js 24.22.1; the scripts are reproduced in Worked example. Backs: Worked example, Edge cases, Trade-offs. [^8]

## Related
- `js-runtime/worker-thread-pools.md` — pool sizing against CPU limits; its Edge cases list the `maxQueue` with signal, `queueSize` and `completed` definitions, measured earlier.
- `js-runtime/abort-signal.md` — the per-task timeout is an `AbortSignal.timeout()` passed to `pool.run()`.
- `js-runtime/node-worker-default-heap-limit.md` — memory behavior of the workers whose tasks wait in this queue.
