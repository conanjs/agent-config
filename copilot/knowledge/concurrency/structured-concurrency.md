---
schema: knowledge-doc/v1
type: concept
topic: concurrency
status: verified
applies-to: ["Go", "Python >= 3.11", "Rust tokio", "TypeScript"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [concurrency, cancellation, async, goroutines]
---

# Structured concurrency

## Summary
**TL;DR:** Structured concurrency means every concurrent child belongs to a parent scope that waits for it and can cancel it before the scope exits ✅[^1]
**Use this when:** code fans out work with goroutines, tasks, futures, promises, or background jobs ✅[^1]
**Not this doc:** blocking work inside async runtimes → `concurrency/blocking-in-async-runtimes.md`; shared mutable state → `concurrency/shared-state-and-data-races.md`.

## Problem
Unowned tasks turn control flow into one-way jumps: the caller starts work, loses the direct join point, and later failures or cancellations become hard to account for ✅[^1]
In Go pipelines, a downstream stage that stops early can leave upstream goroutines blocked forever, and goroutines must exit on their own because they are not garbage-collected ✅[^2]

## Mental model
**Analogy:** a field trip works because every child is assigned to a teacher; the teacher counts everyone before leaving and can call the trip off.
**Artifact:**
```ts
const ac = new AbortController();
try {
  await Promise.all(urls.map(u => fetch(u, { signal: ac.signal })));
} catch (err) {
  ac.abort();
  throw err;
}
```
`Promise.all` gives the join point, and `AbortSignal` gives children a shared cancellation signal ✅[^6]

## How it works
1. The parent creates a scope, such as `errgroup.WithContext`, `asyncio.TaskGroup`, a Tokio `JoinSet`, or a Promise aggregation block ✅[^3]
2. Children are started only through that scope, so their handles remain reachable until the parent joins them ✅[^4]
3. The parent waits at scope exit; if one child fails, structured APIs either cancel siblings automatically or give the parent a single place to request cancellation ✅[^3]
4. Child code must observe cancellation by using context-aware calls, timeout-aware awaits, or abort-aware APIs ✅[^2]

```go
g, ctx := errgroup.WithContext(ctx)
for _, url := range urls {
    url := url
    g.Go(func() error { return fetch(ctx, url) })
}
if err := g.Wait(); err != nil { return err }
```
```python
async with asyncio.TaskGroup() as tg:
    tasks = [tg.create_task(fetch(u)) for u in urls]
```
```rust
let mut set = tokio::task::JoinSet::new();
for u in urls { set.spawn(fetch(u)); }
while let Some(res) = set.join_next().await { res??; }
```
```ts
const ac = new AbortController();
const results = await Promise.allSettled(urls.map(u => fetch(u, { signal: ac.signal })));
```

## Worked example
A request must fetch `profile`, `orders`, and `limits` within 800 ms.
The handler derives a Go `context.Context` with timeout, starts three `errgroup` functions, and returns only after `g.Wait()` has observed success or the first error ✅[^3]
If `orders` fails after 120 ms, `errgroup.WithContext` cancels the derived context, and context-aware HTTP calls in the other goroutines can stop instead of continuing useless work ✅[^3]
The same shape maps to Python `TaskGroup`, where exiting the `async with` waits for tasks, and to Rust `JoinSet`, where `join_next` drains the owned task set ✅[^4]

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Fire-and-forget goroutine | It can keep a channel, file, lock, or heap reference alive after the request ended | Go requires goroutines to return; leaked goroutines are not collected ✅[^2] |
| Python `create_task` without a retained handle | The task may fail later with an unretrieved exception | `TaskGroup` is the documented structured alternative to raw `create_task` for related tasks ✅[^4] |
| Rust `JoinSet` dropped early | Tracked tasks are aborted | Tokio documents that dropping a `JoinSet` immediately aborts tasks in it ✅[^5] |
| TypeScript Promise failure | `Promise.all` rejects on the first rejection, while `allSettled` reports every outcome | Promise aggregation is a join point, but cancellation still needs `AbortSignal` or an equivalent API ✅[^6] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Strict scoped fan-out | Clear ownership, one error path, bounded lifetime | Background daemons need an application-level supervisor instead of request scope |
| Raw spawn plus manual handles | Works in low-level libraries | Easy to forget `Wait`, `join`, or `abort` |
| `allSettled` for best-effort work | Preserves partial results | Caller must decide how to handle failures |

## Takeaways
- Start concurrent work through a scope that owns its handles and waits for them. [rule-candidate]
- Pass cancellation to every blocking or I/O child operation. [rule-candidate]
- Treat unjoined goroutines, tasks, and promises as leaks until proven supervised. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| stack idiom | GO-5 | Source: |
| stack idiom | PY-6 | Source: |
| stack idiom | RS-6 | Source: |

## Verification status
- Verified: 16 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [Notes on structured concurrency, or: Go statement considered harmful](https://vorpus.org/blog/notes-on-structured-concurrency-or-go-statement-considered-harmful/) — Nathaniel J. Smith, 2018. Backs: Summary, Problem. [^1]
- [Go Concurrency Patterns: Pipelines and cancellation](https://go.dev/blog/pipelines) — Go team, 2014. Backs: Problem, cancellation, goroutine leaks. [^2]
- [Package errgroup](https://pkg.go.dev/golang.org/x/sync/errgroup) and [Package context](https://pkg.go.dev/context) — Go project, living. Backs: Go examples and cancellation. [^3]
- [Coroutines and tasks: TaskGroup](https://docs.python.org/3/library/asyncio-task.html#task-groups) — Python Software Foundation, living. Backs: Python examples. [^4]
- [tokio::task::JoinSet](https://docs.rs/tokio/latest/tokio/task/struct.JoinSet.html) — Tokio project, living. Backs: Rust examples and edge cases. [^5]
- [Promise.all()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all), [Promise.allSettled()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled), and [AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) — MDN, living. Backs: TypeScript examples. [^6]
- `copilot/frameworks/agentic-sdlc/stacks/go/idioms.md` — cites this doc as GO-5.
- `copilot/frameworks/agentic-sdlc/stacks/python/idioms.md` — cites this doc as PY-6.
- `copilot/frameworks/agentic-sdlc/stacks/rust/idioms.md` — cites this doc as RS-6.

## Related
- `concurrency/blocking-in-async-runtimes.md`
- `concurrency/shared-state-and-data-races.md`
- `js-runtime/abort-signal.md`