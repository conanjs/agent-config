---
schema: topic-index/v1
kind: subtopic
topic: javascript/async
last-updated: 2026-11-04
---

# Promises and async/await

Callbacks, promises, chaining, promise error handling, the promise combinators, promisification, the microtask queue and `async`/`await`. Consolidates javascript.info Part 1, chapter 11.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [promises.md](promises.md) | concept | From callbacks to promises: settle-once states, chaining, implicit `try…catch`, `all`/`allSettled`/`race`/`any` and promisification | verified |
| [event-loop-and-async-await.md](event-loop-and-async-await.md) | concept | Synchronous code, then all microtasks, then the next timer; how `await` suspends and resumes; sequential versus parallel awaits | verified |
| [async-patterns-and-performance-deep-dive.md](async-patterns-and-performance-deep-dive.md) | deep-dive | Run-to-completion and concurrency, callback trust failures and Zalgo, how promises restore trust, generator runners and thunks, workers and shared memory, benchmarking, 2015-to-2026 status table | verified |

## References
- [The Modern JavaScript Tutorial, Part 1: The JavaScript language](https://javascript.info/js) — javascript.info, living. Backs: subtopic scope (one subtopic per chapter).
- [ECMAScript Language Specification](https://tc39.es/ecma262/) — Ecma TC39, living. Backs: topic scope.

## Related
- `javascript/learning-path.md` — where this subtopic sits in the learning order.
- `js-runtime/` — engine and Node.js runtime behaviour.
