---
schema: knowledge-doc/v1
type: concept
topic: javascript/async
status: verified
applies-to: ["ECMAScript 2025", "Node.js 24"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [javascript, event-loop, microtask, macrotask, queuemicrotask, async, await, sequential, parallel, top-level-await]
---

# Microtasks, the event loop and `async`/`await`

## Summary
**TL;DR:** Promise handlers never run immediately: they go into the **microtask queue**, which the engine empties completely after the current script (or task) finishes and **before** any timer or I/O callback (macrotasks). So `sync → all microtasks → next timer`. `async function` always returns a promise; `await p` pauses only that function, lets other code run, and resumes it as a microtask with the value — or throws the rejection, so plain `try…catch` works. Awaiting one thing after another runs **sequentially**; start the operations first and `await Promise.all` to run them **in parallel**.
**Use this when:** predicting the order of logs in async code, choosing between sequential and parallel awaits, or converting `.then` chains to `async`/`await`.
**Not this doc:** promise API → `javascript/async/promises.md`; async iteration → `javascript/generators-iterators/generators-and-async-iteration.md`; worker threads for CPU-bound work → `js-runtime/worker-thread-pools.md`.

## Problem
A log placed after `promise.then(...)` prints first; code that `await`s three independent requests in a row takes three times longer than needed; a `forEach` with an `async` callback "does not wait". Each follows from the queue order and from what `await` pauses.

## Mental model
**Analogy:** a chef (the engine) finishes the current dish (the script), then serves every small side order on the counter (microtasks) — including side orders added while serving — and only then takes the next big order from the queue (a timer or I/O callback). `await` is the chef saying "put this dish aside until the oven beeps, I will cook other things meanwhile".

**Artifact:** queue order measured in Node 24 ✅[^1]:
```js
setTimeout(() => log('timeout'), 0);
Promise.resolve().then(() => log('micro1')).then(() => log('micro2'));
queueMicrotask(() => log('qm'));
log('sync');
// sync, micro1, qm, micro2, timeout
```
`micro2` comes after `qm` because it is queued only when `micro1` finishes.

## How it works
Actors: the **engine's call stack**, the **microtask queue** (promise reactions, `queueMicrotask`, `await` continuations) and the **macrotask queue** owned by the host (timers, I/O, UI events).

1. **Run to completion.** The current script runs until the stack is empty; nothing interrupts it ✅[^4].
2. **Drain microtasks.** The engine runs every queued microtask, including ones queued during this step, until the queue is empty ✅[^2] ✅[^1].
3. **Next macrotask.** Only then does the host hand over the next task, such as a due timer; in browsers rendering happens between tasks, never during one ✅[^4].
4. **`async` functions.** They always return a promise: a returned value becomes a fulfilled promise, a `throw` a rejected one ✅[^1] ✅[^3].
5. **`await`.** Suspends the function until the promise settles; the rest of the function continues as a microtask. A rejection is thrown at the `await`, so `try { await f() } catch (e)` catches it ✅[^1] ✅[^3]. `await` accepts thenables ✅[^1] ✅[^3]. In ES modules `await` works at the top level ✅[^3].
6. **Sequential versus parallel.** Two `await sleep(50)` in a row took about 100 ms; `await Promise.all([sleep(50), sleep(50)])` about 50 ms ✅[^1].
7. **Unhandled rejection detection.** A rejection is reported as unhandled when it is still unhandled after the microtask queue is drained ✅[^2]; in Node 24 that terminates the process by default ✅[^1] (details: `js-runtime/promise-rejections.md`).

## Worked example
Load a profile and its settings, which are independent:

| Version | Code | Time with 50 ms each (lab) |
|---|---|---|
| Sequential | `const p = await getProfile(); const s = await getSettings();` | ~100 ms ✅[^1] |
| Parallel | `const [p, s] = await Promise.all([getProfile(), getSettings()]);` | ~50 ms ✅[^1] |
| Error handling | Wrap either in `try { … } catch (e) { … }` | Rejection thrown at the `await` ✅[^1] |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `array.forEach(async x => await work(x))` | Returns immediately; nothing waits | `forEach` ignores returned promises; use `for…of` with `await` or `Promise.all(array.map(…))` ✅[^1] |
| `await` in a non-async function in a classic script | `SyntaxError` | Only `async` functions and module top level ✅[^3] |
| Endless microtask loop | Timers and rendering starve | The queue is drained fully before the next task ✅[^2] ✅[^4] |
| `setTimeout(f, 0)` versus `queueMicrotask(f)` | Microtask runs first | Microtasks precede the next macrotask ✅[^1] |
| Long synchronous loop | Delays every callback | Run to completion ✅[^1] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| `.then` chains | Explicit, usable anywhere | Nesting for conditional logic |
| `async`/`await` | Reads like synchronous code; normal `try`/loops | Easy to serialize independent work accidentally |
| `queueMicrotask` | Runs before any I/O | Can starve the event loop |

## Takeaways
- Start independent async operations before awaiting them, then `await Promise.all`. [rule-candidate]
- Never pass an `async` callback to `forEach`; use `for…of` or `Promise.all(map(...))`. [rule-candidate]
- Keep synchronous work short; long loops block every queued callback.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 24 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- `linux/lab-setup.md` — the Node 24.22.1 lab where every behaviour marked with this note ran on 2026-11-04. [^1]
- [Microtasks](https://javascript.info/microtask-queue) — javascript.info, living. Backs: microtask queue, run-to-completion, unhandled rejection timing. [^2]
- [Async/await](https://javascript.info/async-await) — javascript.info, living. Backs: `async` return values, `await` semantics, thenables, top-level await, error handling. [^3]
- [Event loop: microtasks and macrotasks](https://javascript.info/event-loop) — javascript.info, living. Backs: run-to-completion, rendering between tasks, microtasks before the next macrotask. [^4]
- [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises) — MDN, living. Background: task queues versus microtasks.

## Related
- `javascript/async/promises.md`
- `js-runtime/promise-rejections.md`
- `js-runtime/worker-thread-pools.md`
