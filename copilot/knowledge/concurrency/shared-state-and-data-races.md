---
schema: knowledge-doc/v1
type: concept
topic: concurrency
status: verified
applies-to: ["Go", "Rust", "Python", "TypeScript"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [data-race, mutex, channels, send, sync]
---

# Shared state and data races

## Summary
**TL;DR:** Shared mutable state must be synchronized or avoided; otherwise concurrent reads and writes can observe invalid interleavings ✅[^1]
**Use this when:** several goroutines, tasks, threads, or workers touch the same map, struct, counter, cache, or collection.
**Not this doc:** task lifetime and cancellation → `concurrency/structured-concurrency.md`.

## Problem
Go defines a data race as a concurrent write with another read or write to the same memory location unless all accesses are atomic ✅[^1]
Go explicitly advises serializing simultaneous access with channels, `sync`, or `sync/atomic` primitives ✅[^1]
Rust uses the `Send` and `Sync` traits to express which types can be transferred or shared across thread boundaries ✅[^4]

## Mental model
**Analogy:** a shared whiteboard needs a marker token; without the token, two people can erase and write at the same time.
**Artifact:**
```go
var mu sync.Mutex
counts := map[string]int{}
mu.Lock()
counts[userID]++
mu.Unlock()
```
The mutex is the marker token; channels are another option when ownership can move instead of being shared ✅[^3]

## How it works
1. Go's memory model says data-race-free programs have sequentially consistent behavior, but programs with races are erroneous and may be reported or terminated by implementations ✅[^1]
2. `go test -race`, `go run -race`, and related commands instrument a program and report races that execute at runtime ✅[^2]
3. Go channels can move data between goroutines so only one goroutine owns mutation at a time, while `sync.Mutex` guards data that must stay shared ✅[^3]
4. Rust lets a type cross thread boundaries only when its trait bounds allow it; `Arc<T>` provides shared ownership, but mutation still needs `Mutex`, `RwLock`, or atomics when `T` is shared ✅[^5]

```go
updates := make(chan int)
go func() { for n := range updates { total += n } }()
updates <- 1
```
```rust
let count = Arc::new(Mutex::new(0));
let c = Arc::clone(&count);
tokio::spawn(async move { *c.lock().unwrap() += 1; });
```
```python
lock = asyncio.Lock()
async with lock:
    counts[user_id] += 1
```
```ts
worker.postMessage({ type: "increment", userId });
```

## Worked example
A Go cache uses `map[string]Session` and both the HTTP handler and refresh goroutine write it.
The race detector can report conflicting accesses with stack traces when tests or realistic workloads execute the conflicting paths ✅[^2]
Moving all writes through one owner goroutine or wrapping every access in the same `sync.Mutex` gives readers and writers a clear synchronization edge ✅[^1]
In Rust, trying to move `Rc<RefCell<T>>` into a thread fails because `Rc` is not `Send`, while `Arc<Mutex<T>>` is the standard shape for shared mutable state when `T` satisfies the required bounds ✅[^5]

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Go map concurrent writes | The race detector can report the race; the program may also panic or corrupt behavior | Concurrent map access is a typical race pattern ✅[^2] |
| Race not covered by tests | `-race` may miss it | The race detector only finds races on executed code paths ✅[^2] |
| `Arc<T>` without `Mutex<T>` | Shared ownership is safe, but mutation is not automatically safe | `Arc` does not add thread safety to the inner value ✅[^5] |
| Python or TypeScript single-thread event loop | Logical races can still happen across awaits or message handlers | The issue is interleaving at suspension points, not only OS threads ✅[^6] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Ownership by one worker/channel | Fewer locks and clearer invariants | Requires message design and backpressure |
| Mutex/RwLock | Simple for shared caches and counters | Lock ordering and contention must be managed |
| Atomics | Low overhead for counters/flags | Harder to reason about than locks |

## Takeaways
- Prefer moving ownership through messages; guard truly shared mutation with one synchronization primitive. [rule-candidate]
- Run Go's race detector on tests that exercise concurrent paths. [rule-candidate]
- In Rust, let `Send` and `Sync` errors guide the design instead of bypassing them. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| stack idiom | GO-6 | Source: |
| stack idiom | RS-7 | Source: |

## Verification status
- Verified: 16 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [The Go Memory Model](https://go.dev/ref/mem) — Go project, 2022. Backs: Go race definition and synchronization advice. [^1]
- [Data Race Detector](https://go.dev/doc/articles/race_detector) — Go project, living. Backs: Go race detector usage and limits. [^2]
- [Effective Go: Share by communicating](https://go.dev/doc/effective_go#sharing) — Go project, living. Backs: channel ownership style. [^3]
- [Send and Sync](https://doc.rust-lang.org/nomicon/send-and-sync.html) plus [`Send`](https://doc.rust-lang.org/std/marker/trait.Send.html) and [`Sync`](https://doc.rust-lang.org/std/marker/trait.Sync.html) — Rust project, living. Backs: trait model. [^4]
- [`Arc<T>`](https://doc.rust-lang.org/std/sync/struct.Arc.html) and [Shared-State Concurrency](https://doc.rust-lang.org/book/ch16-03-shared-state.html) — Rust project, living. Backs: `Arc<Mutex<T>>` behavior. [^5]
- [Developing with asyncio](https://docs.python.org/3/library/asyncio-dev.html) and [Don't block the Event Loop](https://nodejs.org/learn/asynchronous-work/dont-block-the-event-loop) — Python Software Foundation and Node.js project, living. Backs: cooperative interleaving context. [^6]
- `copilot/frameworks/agentic-sdlc/stacks/go/idioms.md` — cites this doc as GO-6.
- `copilot/frameworks/agentic-sdlc/stacks/rust/idioms.md` — cites this doc as RS-7.

## Related
- `concurrency/structured-concurrency.md`
- `concurrency/blocking-in-async-runtimes.md`
- `software-design/functional-modeling/immutability.md`