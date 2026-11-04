---
schema: deep-dive/v1
topic: javascript/async
status: verified
applies-to: ["ECMAScript 2025", "Node.js 24 (V8)", "You Don't Know JS: Async & Performance (1st ed., 2015) reconciled with 2026 practice"]
last-updated: 2026-11-04
last-verified: 2026-11-04
synthesized-into: []
tags: [javascript, async, event-loop, run-to-completion, concurrency, callbacks, zalgo, promises, promise-trust, generators, coroutines, thunks, workers, sharedarraybuffer, atomics, benchmarking, tail-calls, ydkjs]
---

# Asynchrony, promises, generators and program performance, end to end

## Summary
**TL;DR:** A JavaScript program is a set of chunks: one runs **now**, the rest are scheduled to run **later** by the event loop, and each chunk runs to completion without interruption. Callbacks express "later" but hand control of your continuation to someone else — the **trust problem** (called too early, too late, never, twice, errors swallowed). Promises fix trust by being immutable, settle-once, always-asynchronous future values; generators fix the *sequential reasoning* problem by pausing a function at `yield`; combined (a generator plus a promise runner) they are exactly what `async`/`await` became. For performance, real parallelism comes only from workers, and measuring requires repetition, statistics and awareness of engine optimizations. Several 2015-era tools in the book are now obsolete; each is marked with its current replacement.
**Use this when:** you need the reasoning behind promise and async design (not just the API), are debugging ordering or "lost" errors, choose between async patterns, move CPU work to workers, or benchmark; or you read You Don't Know JS *Async & Performance* and need to know what still holds in 2026.
**Depth:** chunks, event loop and jobs; concurrency models (non-interacting, interacting, cooperating); callback continuations and the five trust failures including "Zalgo"; promise trust guarantees one by one; chain flow and terminology; error handling ("pit of despair") and Node's unhandled-rejection behaviour; promise patterns and their edge cases; promise limitations and today's remedies; generators as coroutines, message passing, delegation, the promise-aware runner and thunks; workers with structured clone, transfer and shared memory with `Atomics`; benchmarking and tail calls; a 2015→2026 status table; a failure matrix. Every ✅[^2] row ran in Node.js 24.22.1.

## 1. Now and later

A program is split into chunks; the chunk running *now* finishes before any *later* chunk (a timer, I/O callback or promise reaction) starts. This **run-to-completion** rule held in the lab: a 30 ms busy loop finished before a `setTimeout(…, 0)` callback ran (`loop done > timer`) ✅[^1] ✅[^2].

| Term | Meaning |
|---|---|
| Event loop | The host's loop that takes the next task (timer, I/O, UI event) and runs it to completion |
| Job queue | Since ES2015, a queue drained after each task — promise reactions run here, before the next task (`javascript/async/event-loop-and-async-await.md` has the measured order) |
| Parallelism | Truly simultaneous execution — only with workers (§8) |
| Concurrency | Two or more "processes" (sequences of chunks) progressing in overlapping time on one thread |

**Concurrency patterns** ✅[^1]:

| Pattern | Situation | Risk | Remedy |
|---|---|---|---|
| Non-interacting | Two tasks share nothing | None | — |
| Interacting | Both write shared state (e.g. both push responses into one array) | Order depends on network timing — a race | Index results by request, or use `Promise.all` |
| Cooperating | One long task | Blocks everything else | Split into batches and yield between them (`setTimeout`, `setImmediate`, `scheduler.yield` in browsers) |

## 2. Callbacks and the trust problem

A callback is the **continuation** of your program, handed to another function ✅[^3]. Two problems follow:

1. **Sequential brain:** humans plan step by step; nested callbacks force the reader to jump around the file ✅[^3].
2. **Inversion of control:** a third-party utility now decides when, how often and with what arguments your continuation runs ✅[^3]. The five trust failures:

| Failure | Example |
|---|---|
| Called too early | Before setup code that follows the call |
| Called too late or never | Lost network request |
| Called too few or too many times | A payment callback run twice |
| Missing parameters or environment | Callback gets `undefined` |
| Errors swallowed | Exception inside the utility vanishes |

**Zalgo** — an API that calls back synchronously sometimes and asynchronously other times. Lab: a cache-backed `get` produced `cb-a > after-a > after-b > cb-b`: the cached call ran its callback *before* the next line, the uncached one *after* it ✅[^2] ✅[^3]. Rule: an API must be always-sync or always-async.

## 3. Promises: how they restore trust

| Trust failure | Promise guarantee | Lab |
|---|---|---|
| Too early | `then` callbacks always run asynchronously, even on an already-resolved promise (`sync after then > then`) | ✅[^2] |
| Too late | Reactions run in the job queue right after the current chunk, before timers | ✅[^2] |
| Never | Use `Promise.race` with a timeout (or `AbortSignal.timeout`) to bound waiting | ✅[^2] |
| Too many times | A promise settles once; a thenable that calls `resolve` then `reject` then `resolve` yields only `'first'` | ✅[^2] |
| Missing values | One fulfilment value or rejection reason is passed to every reaction | ✅[^4] |
| Errors swallowed | An exception in the executor rejects the promise; in a handler, it rejects the next promise | ✅[^2] |

✅[^4]

- **Normalizing untrusted thenables:** `Promise.resolve(x)` returns `x` itself if it is a genuine promise (`true` in the lab) and otherwise adopts the thenable's state ✅[^2] ✅[^4].
- **Terminology:** *resolve* means "lock in an outcome" (which may be another promise, so it can still end up rejected); *fulfil* and *reject* are the two final states ✅[^4].

### 3.1 Error handling: the pit of despair

An error thrown inside the **last** `then` handler of a chain has no later handler to reach. The lab caught it only through `process.on('unhandledRejection')` (`pit of despair`) ✅[^2]. Without such a hook, Node 24 terminates the process with exit code 1 (default `--unhandled-rejections=throw`; measured in `javascript/async/promises.md`). The book's 2015 proposal ("pit of success") has effectively arrived: runtimes now report unhandled rejections by default ✅[^4].

### 3.2 Patterns and their edge cases

| Pattern | Behaviour | Lab |
|---|---|---|
| `Promise.all([])` | Fulfils immediately with `[]` | ✅[^2] |
| `Promise.race([])` | **Never settles** (still pending after 30 ms) | ✅[^2] |
| Timeout via `race` | `Promise.race([work, timeoutRejection])` → `'timeout'` | ✅[^2] |
| Variations the book proposed (`none`, `any`, `first`, `last`) | Now built in: `Promise.allSettled`, `Promise.any`; plus `Promise.withResolvers` (all functions in Node 24) | ✅[^2] |
| Concurrent iteration | `Promise.all(items.map(asyncFn))` | — |

### 3.3 Limitations and today's remedies

| Limitation (book, 2015) | Status in 2026 |
|---|---|
| Errors in a long chain are hard to attribute | `async`/`await` with `try…catch` and `Error` `cause` |
| Single value only | Wrap values in an object/array; use async iterators for streams |
| Single resolution — unfit for repeated events | Event emitters, async iterators (`javascript/generators-iterators/generators-and-async-iteration.md`) |
| Inertia: wrapping callback APIs by hand | `util.promisify`, and most Node APIs ship promise versions (`node:fs/promises`) |
| **Uncancelable** | `AbortController`/`AbortSignal` (lab: `AbortSignal.timeout(10)` aborted with `TimeoutError`) ✅[^2] — see `js-runtime/abort-signal.md` |
| Performance overhead | Engines have optimized promises and `await` heavily; still avoid creating promises in tight synchronous loops |

✅[^4]

## 4. Generators: pausable functions

A generator breaks run-to-completion *inside one function*: `yield` pauses it, `next(value)` resumes it and delivers a value in, `throw(err)` resumes it with an exception ✅[^5]. Mechanics and measured behaviour: `javascript/generators-iterators/generators-and-async-iteration.md`. Async uses ✅[^5]:

1. **Yield a promise, resume with its value.** A small runner calls `it.next()`, waits for the yielded promise, then calls `it.next(value)` or `it.throw(error)`.
2. **Sequential-looking async code with real `try…catch`.** The lab's generator runner and the equivalent `async` function both returned `1:x` (a value, then a caught rejection) ✅[^2]. `async`/`await` (ES2017) *is* this pattern built into the language.
3. **Delegation** with `yield*` passes messages, errors and asynchrony through to an inner generator.
4. **Concurrency** inside generators: start several promises first, then `yield Promise.all(...)`.
5. **Thunks** — a function with all arguments pre-filled except the callback — were an alternative to promises for runners: `thunkify(add)(10, 15)` then calling it with a callback produced 25 ✅[^2] ✅[^5].

The book's advanced appendix builds on the same idea: coroutines as state machines, CSP-style message passing between generators, and reactive sequences ✅[^6].

## 5. Program performance: workers

The only way to run JavaScript **in parallel** is a separate worker (Web Workers in browsers, `worker_threads` in Node) — a separate thread with its own event loop and global scope that communicates by messages ✅[^7].

| Mechanism | Behaviour | Lab |
|---|---|---|
| Message passing (default) | Data is **copied** with structured clone: the worker set `m.obj.changed = true`, the original stayed `false` | ✅[^2] |
| Transfer list | Ownership moves: the worker received 8 bytes; the sender's `ArrayBuffer` became detached (`byteLength` 0) | ✅[^2] |
| `SharedArrayBuffer` + `Atomics` | True shared memory; two threads each doing 100 000 `Atomics.add` totalled exactly 200 000 | ✅[^2] |

Sizing worker pools under container limits: `js-runtime/worker-thread-pools.md`. Shared workers (one worker shared by several pages) exist in browsers ✅[^7].

## 6. Benchmarking and tuning

- **Repeat and use statistics.** One timing is meaningless; run many iterations and report spread. `performance.now()` gives sub-millisecond precision (lab: non-integer), `Date.now()` integer milliseconds ✅[^2] ✅[^8].
- **Context is king.** A micro-benchmark is only valid for the engine, input and surrounding code it ran in; engines may remove code whose result is unused (dead-code elimination) or specialize hot paths ✅[^8]. Method and pitfalls: `performance/measurement/benchmarking-methodology.md`.
- **Microperformance:** prefer clear code; optimize only measured hot spots ✅[^8].
- **Tail call optimization (TCO).** ES2015 specified proper tail calls in strict code, but V8 does not implement them: a strict, tail-recursive `sum(1e6)` threw `RangeError` in Node 24 ✅[^2] ✅[^8]. Write deep recursion as loops.

## 7. What changed since the book (2015 → 2026)

| Book topic | Status now | Evidence |
|---|---|---|
| SIMD.js | Abandoned at TC39 stage 1; SIMD lives in WebAssembly. `typeof SIMD` is `"undefined"` in Node 24 | ✅[^9] ✅[^2] |
| asm.js | Superseded by WebAssembly (`typeof WebAssembly` is `"object"`) | ✅[^10] ✅[^2] |
| jsPerf.com | The original site answers HTTP 410 Gone (checked 2026-11-04) | ✅[^2] |
| ES7 Observables | Still a TC39 stage 1 proposal; `typeof Observable` is `"undefined"` in Node 24 | ✅[^11] ✅[^2] |
| Generator runners (`co`, asynquence) | Replaced by native `async`/`await` | ✅[^2] |
| Proposed promise variations | `Promise.allSettled`, `Promise.any`, `Promise.withResolvers` are standard | ✅[^2] |
| Uncancelable promises | `AbortController`/`AbortSignal` | ✅[^2] |
| Proper tail calls | Specified, not implemented in V8 | ✅[^2] |

## 8. Failure matrix

| Symptom | Cause | Fix |
|---|---|---|
| Callback order differs between runs | Zalgo API or interacting concurrency | Always-async APIs; avoid shared mutable state |
| UI or server stalls | A long chunk blocks run-to-completion | Batch and yield, or move to a worker |
| An error disappears | Thrown in the last `then` | End chains with `.catch`, or `await` inside `try` |
| Node process exits on a rejection | Unhandled rejection, default mode | Handle every promise |
| `Promise.race([])` hangs forever | Empty input never settles | Guard empty input |
| Data in a worker message is stale | Structured clone made a copy | Send updates back, or use shared memory |
| `ArrayBuffer` suddenly empty | It was transferred | Transfer only buffers you no longer need |
| Deep recursion crashes | No proper tail calls in V8 | Iterate |

## 9. How this deep dive was built
- **Primary narrative:** You Don't Know JS, *Async & Performance* (1st edition, 2015), chapters 1–6 and appendices A–B; the 2nd-edition "Sync & Async" book was never written.
- **Reconciled with:** current MDN, Node.js docs and the TC39 proposals list — every 2015 claim that changed is in §7.
- **Verified:** every ✅[^2] row ran in `node:24.22.1-alpine` on 2026-11-04 (lab file `async.mjs`); the jsPerf status was checked with an HTTP request the same day.

## References
- [You Don't Know JS: Async & Performance, ch. 1 "Asynchrony: Now & Later"](https://github.com/getify/You-Dont-Know-JS/blob/1st-ed/async%20%26%20performance/ch1.md) — Kyle Simpson, 1st ed., CC BY-NC-ND 4.0. Backs: chunks, event loop, run-to-completion, concurrency patterns, jobs. [^1]
- `linux/lab-setup.md` — the Node.js 24.22.1 lab where every ✅[^2] behaviour ran on 2026-11-04. [^2]
- [You Don't Know JS: Async & Performance, ch. 2 "Callbacks"](https://github.com/getify/You-Dont-Know-JS/blob/1st-ed/async%20%26%20performance/ch2.md) — Kyle Simpson. Backs: continuations, sequential brain, inversion of control, trust failures, Zalgo. [^3]
- [You Don't Know JS: Async & Performance, ch. 3 "Promises"](https://github.com/getify/You-Dont-Know-JS/blob/1st-ed/async%20%26%20performance/ch3.md) — Kyle Simpson. Backs: promise trust, terminology, error handling, patterns, limitations. [^4]
- [You Don't Know JS: Async & Performance, ch. 4 "Generators"](https://github.com/getify/You-Dont-Know-JS/blob/1st-ed/async%20%26%20performance/ch4.md) — Kyle Simpson. Backs: pausing, message passing, promise-aware runner, delegation, thunks. [^5]
- [You Don't Know JS: Async & Performance, Appendix B "Advanced Async Patterns"](https://github.com/getify/You-Dont-Know-JS/blob/1st-ed/async%20%26%20performance/apB.md) — Kyle Simpson. Backs: reactive sequences, coroutines, CSP. [^6]
- [Worker threads](https://nodejs.org/api/worker_threads.html) — Node.js documentation, v24. Backs: workers, `postMessage` cloning, transfer lists, `SharedArrayBuffer`. [^7]
- [You Don't Know JS: Async & Performance, ch. 6 "Benchmarking & Tuning"](https://github.com/getify/You-Dont-Know-JS/blob/1st-ed/async%20%26%20performance/ch6.md) — Kyle Simpson. Backs: repetition, context, engine optimizations, microperformance, TCO. [^8]
- [TC39 inactive proposals](https://github.com/tc39/proposals/blob/main/inactive-proposals.md) — Ecma TC39, living. Backs: SIMD.js abandoned in favour of WebAssembly SIMD. [^9]
- [WebAssembly](https://developer.mozilla.org/en-US/docs/WebAssembly) — MDN, living. Backs: WebAssembly as the near-native performance target. [^10]
- [TC39 stage 1 proposals](https://github.com/tc39/proposals/blob/main/stage-1-proposals.md) — Ecma TC39, living. Backs: Observable still at stage 1. [^11]
- [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises) — MDN, living. Background: modern promise usage.

## Related
- `javascript/async/promises.md`
- `javascript/async/event-loop-and-async-await.md`
- `js-runtime/promise-rejections.md`
- `js-runtime/abort-signal.md`
