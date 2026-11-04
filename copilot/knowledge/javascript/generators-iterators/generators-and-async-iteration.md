---
schema: knowledge-doc/v1
type: concept
topic: javascript/generators-iterators
status: verified
applies-to: ["ECMAScript 2025", "Node.js 24"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [javascript, generators, yield, yield-star, iterator, async-generators, for-await, symbol-asynciterator, streams, pagination]
---

# Generators, `yield*` and async iteration

## Summary
**TL;DR:** A **generator function** (`function*`) returns a generator object instead of running; each `next()` runs the body to the next `yield` and returns `{value, done}`. Generators are iterators *and* iterables, so they work with `for…of` and spread, and they are the easiest way to implement `Symbol.iterator`. `yield*` delegates to another iterable; `next(v)` sends a value **into** the generator (it becomes the result of the paused `yield`); `throw(err)` and `return(v)` inject an error or finish early. **Async generators** (`async function*`) can `await` between yields and are consumed with `for await…of`, the natural shape for paginated APIs and streams; objects become async-iterable via `Symbol.asyncIterator`.
**Use this when:** producing a sequence lazily, making a custom object iterable, composing sequences, or reading paged or streamed data.
**Not this doc:** the synchronous iteration protocol itself → `javascript/data-types/arrays-and-iterables.md`; promises → `javascript/async/promises.md`.

## Problem
Hand-written iterators need boilerplate state objects; loading all pages of an API before processing wastes memory and time; mixing `await` with a manual `next()` loop is error-prone. Generators and async generators remove that boilerplate.

## Mental model
**Analogy:** a generator is a storyteller who pauses after each chapter (`yield`) and waits until asked for the next one (`next()`); you can whisper a word to them when asking (`next(v)`), shout "stop" (`return`) or interrupt with bad news (`throw`). An async generator is a storyteller who sometimes has to fetch the next chapter from the library before telling it.

**Artifact:** two-way communication with a generator, in Node 24 ✅[^1]:
```js
function* gen() { const x = yield 1; yield x * 2; return 'done'; }
const g = gen();
g.next()    // { value: 1, done: false }
g.next(5)   // { value: 10, done: false }   — 5 became the value of the first yield
g.next()    // { value: 'done', done: true }
g.next()    // { value: undefined, done: true }
```

## How it works
1. **Creation.** Calling a generator function runs no code; it returns a generator object ✅[^2].
2. **`next()`.** Resumes the body until the next `yield` (result `{value, done: false}`) or the end (`{value: returnValue, done: true}`) ✅[^1] ✅[^2].
3. **Iterable.** A generator's `[Symbol.iterator]()` returns itself, so `for…of` and spread work. They ignore the final `return` value: `for…of` over `gen()` produced only `1` and `NaN` ✅[^1] ✅[^2].
4. **`yield*`.** Delegates to another generator or iterable: `yield* range(1,3); yield* range(10,11)` produced `1,2,3,10,11` ✅[^1] ✅[^2].
5. **`next(value)`.** The value becomes the result of the `yield` expression where the generator paused; the first `next()` cannot send a value, because no `yield` is waiting yet ✅[^2].
6. **`throw(err)` and `return(v)`.** `throw` raises the error at the paused `yield`, where a `try…catch` inside the generator can handle it (`'caught inj'`); `return(v)` finishes the generator with `{value: v, done: true}` ✅[^1] ✅[^2].
7. **Async iteration.**
   - An object is async-iterable when `[Symbol.asyncIterator]()` returns an object whose `next()` returns a promise of `{value, done}` ✅[^1] ✅[^3].
   - `for await (const v of x)` consumes it; spreading an async iterable throws `TypeError` because spread needs `Symbol.iterator` ✅[^1] ✅[^3].
   - An `async function*` may use both `await` and `yield`; the lab's async generator delivered `1,2,3` to `for await` ✅[^1] ✅[^3] ✅[^4].

## Worked example
Paginated API as an async generator:

| Step | Code | Effect |
|---|---|---|
| 1 | `async function* commits(url) { while (url) { const r = await fetch(url); url = nextLink(r); for (const c of await r.json()) yield c; } }` | Lazily follows "next page" links ✅[^3] |
| 2 | `for await (const c of commits(start)) { … if (++n === 100) break; }` | Requests only as many pages as needed |
| 3 | `break` | Calls the generator's `return()`, ending it cleanly ✅[^2] |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Value sent with the first `next(v)` | Ignored | No `yield` paused yet ✅[^2] |
| `for…of` over a generator with `return 'x'` | `'x'` not seen | Loops stop when `done` is true ✅[^1] |
| Generator consumed twice | Second loop gets nothing | A generator runs once; create a new one ✅[^2] |
| `[...asyncIterable]` | `TypeError` | Spread is synchronous ✅[^1] |
| `g.return('early')` then `g.next()` | `{value:'early', done:true}`, then `{done:true}` | Finished generators stay finished ✅[^1] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Array | Random access, `length`, reusable | All values in memory |
| Generator | Lazy, infinite sequences, little code | Single pass, no random access |
| Async generator | Natural paging/streaming with backpressure | Consumers must use `for await` |

## Takeaways
- Implement `[Symbol.iterator]` as a generator method instead of a hand-written iterator object.
- Model paged or streamed sources as async generators and consume them with `for await`.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 25 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- `linux/lab-setup.md` — the Node 24.22.1 lab where every behaviour marked with this note ran on 2026-11-04. [^1]
- [Generators](https://javascript.info/generators) — javascript.info, living. Backs: generator objects, `next`, iterability, `yield*`, two-way `yield`, `throw`, `return`. [^2]
- [Async iteration and generators](https://javascript.info/async-iterators-generators) — javascript.info, living. Backs: `Symbol.asyncIterator`, `for await`, async generators, paginated data. [^3]
- [for await...of](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of) — MDN, living. Backs: async iteration statement. [^4]

## Related
- `javascript/data-types/arrays-and-iterables.md`
- `javascript/async/event-loop-and-async-await.md`
