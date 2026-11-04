---
schema: knowledge-doc/v1
type: concept
topic: javascript/async
status: verified
applies-to: ["ECMAScript 2025", "Node.js 24"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [javascript, callbacks, promise, then, catch, finally, chaining, promise-all, allsettled, race, any, promisify, thenable]
---

# Callbacks and promises: creation, chaining, errors and combinators

## Summary
**TL;DR:** Callback-style async code nests and splits error handling ("pyramid of doom"). A **promise** is an object that settles once — fulfilled with a value or rejected with an error — and lets any number of handlers subscribe with `.then`, `.catch` and `.finally`. The executor runs **immediately and synchronously**; only the first `resolve`/`reject` counts. Each `.then` returns a **new** promise resolved with the handler's return value (or with the result of a returned promise or thenable), which is what makes chains flat. A `throw` anywhere in an executor or handler becomes a rejection that skips to the next `.catch`. `Promise.all`, `allSettled`, `race` and `any` combine several promises; `promisify` converts callback APIs.
**Use this when:** writing or reviewing asynchronous code, converting callback APIs, running tasks in parallel, or tracking down a lost rejection.
**Not this doc:** microtask ordering and `async`/`await` → `javascript/async/event-loop-and-async-await.md`; unhandled rejections in Node and linting → `js-runtime/promise-rejections.md`; cancellation → `js-runtime/abort-signal.md`.

## Problem
Nested callbacks make sequencing and error handling hard to follow; developers forget to `return` inside `.then`, so the chain stops waiting; one failing request in `Promise.all` throws away the other results; a rejection with no handler crashes a Node process.

## Mental model
**Analogy:** a promise is a restaurant buzzer. Ordering gives you the buzzer at once (the promise); the kitchen works (the executor); the buzzer goes off exactly once — food ready (fulfilled) or kitchen out of stock (rejected). Anyone holding the buzzer can react, and you can chain "when it buzzes, order dessert", which hands you a new buzzer.

**Artifact:** executor timing and settle-once, in Node 24 ✅[^1]:
```js
const order = [];
const p = new Promise(res => { order.push('executor'); res(1); res(2); });
order.push('after');
order          // ['executor', 'after'] — the executor ran synchronously
await p        // 1 — the second resolve was ignored
```

## How it works
1. **Callbacks first.** A function such as `loadScript(src, callback)` calls back later; the convention is error-first: `callback(err, result)`. Each dependent step nests one level deeper ✅[^2].
2. **States.** A promise starts *pending*, then becomes *fulfilled* or *rejected* exactly once; extra `resolve`/`reject` calls are ignored ✅[^1] ✅[^3]. Rejecting with an `Error` object is recommended ✅[^3].
3. **Consumers.** `.then(onFulfilled, onRejected)`, `.catch(f)` (= `.then(null, f)`), `.finally(f)`. `finally` takes no argument, passes the value or rejection through unchanged, and its return value is ignored ✅[^1] ✅[^3]. Handlers attached to an already-settled promise still run (asynchronously) ✅[^3].
4. **Chaining.** `.then` returns a new promise:
   - A plain return value resolves it.
   - A returned promise or **thenable** (any object with a `then` method) is waited for.
   - Measured: `1 → ×2 → wait 5 ms then +1 → ×10` gives `30` ✅[^1] ✅[^4].
5. **Errors.** The executor and every handler run inside an implicit `try…catch`; a `throw` becomes a rejection. `new Promise(() => { throw new Error('boom') }).catch(e => e.message)` gives `'boom'` ✅[^1] ✅[^5]. A `.catch` that returns normally lets the chain continue fulfilled; rethrowing passes the error on ✅[^5].
6. **Combinators** ✅[^1] ✅[^6]:

   | Call | Settles when | Result |
   |---|---|---|
   | `Promise.all(list)` | All fulfil, or the first rejects | Array in **input order** (`[1,2,3]` though the last was slowest), or the first error |
   | `Promise.allSettled(list)` | All settle | `[{status:'fulfilled', value}, {status:'rejected', reason}]` |
   | `Promise.race(list)` | The first settles | That value or error (`'fast'`) |
   | `Promise.any(list)` | The first fulfils | That value; if all reject, `AggregateError` with `errors` |
   | `Promise.resolve(v)` / `Promise.reject(e)` | Immediately | An already-settled promise |
7. **Promisification.** A wrapper calls the callback API and resolves or rejects from inside the callback; Node's `util.promisify(fn)` does this for error-first APIs — measured `await pf(21)` → `42`, `pf(-1)` rejected with `'neg'` ✅[^1] ✅[^7] ✅[^8].

## Worked example
Fetch a user, then their avatar, with one error handler:

| Step | Code | Notes |
|---|---|---|
| 1 | `fetch('/user.json')` | Promise of a response |
| 2 | `.then(r => r.json())` | Returns a promise → the chain waits ✅[^4] |
| 3 | `.then(user => fetch('/avatar/' + user.id))` | Must `return` (here implicit) or the chain stops waiting |
| 4 | `.catch(err => showError(err))` | Catches failures of steps 1–3 ✅[^5] |
| 5 | `.finally(() => hideSpinner())` | Runs on both paths; does not change the result ✅[^1] |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `.then` handler forgets to `return` an inner promise | Next step runs immediately with `undefined` | Nothing to wait for ✅[^4] |
| `Promise.all` with one rejection | Rejects with the first error; other results are lost (the work is not cancelled) | Use `allSettled` to keep all results ✅[^1] ✅[^6] |
| `await` on `{ then(res) { res('x') } }` | `'x'` | Thenables are adopted ✅[^1] |
| Rejection with no handler in Node 24 | Process exits with code 1 | Default `--unhandled-rejections=throw` ✅[^1] ✅[^9] |
| `try { promise } catch {}` without `await` | Rejection not caught | `try` only sees synchronous throws ✅[^5] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Callbacks | No allocation, simplest for one step | Nesting, scattered error handling |
| Promise chains | Flat sequencing, one `.catch` | Easy to forget `return` |
| `all` vs `allSettled` | Fail fast vs complete picture | Lost results vs manual status checks |

## Takeaways
- Always return the inner promise from a `.then` handler, and end every chain with `.catch` or an awaited `try`. [rule-candidate]
- Use `Promise.allSettled` when partial failure must not discard the successful results.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 28 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- `linux/lab-setup.md` — the Node 24.22.1 lab where every behaviour marked with this note ran on 2026-11-04. [^1]
- [Introduction: callbacks](https://javascript.info/callbacks) — javascript.info, living. Backs: callback style, error-first convention, pyramid of doom. [^2]
- [Promise](https://javascript.info/promise-basics) — javascript.info, living. Backs: states, settle once, consumers, `finally` semantics. [^3]
- [Promises chaining](https://javascript.info/promise-chaining) — javascript.info, living. Backs: returning values, promises and thenables from handlers. [^4]
- [Error handling with promises](https://javascript.info/promise-error-handling) — javascript.info, living. Backs: implicit try/catch, rethrowing, continuing after `.catch`. [^5]
- [Promise API](https://javascript.info/promise-api) — javascript.info, living. Backs: `all`, `allSettled`, `race`, `any`, `resolve`, `reject`. [^6]
- [Promisification](https://javascript.info/promisify) — javascript.info, living. Backs: wrapping callback APIs. [^7]
- [util.promisify](https://nodejs.org/api/util.html#utilpromisifyoriginal) — Node.js documentation, v24. Backs: converting error-first callback functions. [^8]
- [Command-line API: --unhandled-rejections](https://nodejs.org/api/cli.html#--unhandled-rejectionsmode) — Node.js documentation, v24. Backs: default `throw` mode. [^9]

## Related
- `javascript/async/event-loop-and-async-await.md`
- `js-runtime/promise-rejections.md`
- `js-runtime/abort-signal.md`
