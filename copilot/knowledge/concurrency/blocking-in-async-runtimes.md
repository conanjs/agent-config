---
schema: knowledge-doc/v1
type: concept
topic: concurrency
status: verified
applies-to: ["Python asyncio", "Rust tokio", "Node.js", "TypeScript"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [async, event-loop, tokio, asyncio, node]
---

# Blocking in async runtimes

## Summary
**TL;DR:** Async runtimes are cooperative: work must reach an `await` or return quickly so the executor can run other tasks ✅[^1]
**Use this when:** a coroutine, Tokio task, or Node callback calls synchronous I/O, sleeps a thread, runs CPU-heavy code, or performs slow logging.
**Not this doc:** task ownership and cancellation → `concurrency/structured-concurrency.md`.

## Problem
In asyncio, one event-loop thread runs callbacks and tasks, and while one task is running, no other task in that same thread can run until it awaits ✅[^2]
Python documents that directly calling CPU-bound blocking code delays all concurrent asyncio tasks and I/O operations by the same duration ✅[^2]
Tokio documents that blocking or heavy compute inside a future can prevent the executor from driving other futures forward ✅[^3]
Node warns that a blocked Event Loop cannot give current or new clients a turn until the callback finishes ✅[^4]

## Mental model
**Analogy:** an async runtime is a single checkout clerk serving many customers by asking each one short questions; if one customer starts filling out a long tax form at the counter, the whole line stalls.
**Artifact:**
```python
async def handler():
    data = await asyncio.to_thread(lambda: requests.get("https://example.test").content)
```
`asyncio.to_thread` and `loop.run_in_executor()` move blocking work off the event-loop thread ✅[^2]

## How it works
1. Async tasks make progress until they hit `await`, return, or yield through the runtime API ✅[^1]
2. A synchronous call such as `time.sleep`, `std::thread::sleep`, large JSON parsing, or sync file/network I/O occupies the executor thread instead of yielding ✅[^1]
3. Other tasks assigned to that thread wait even if their I/O is ready ✅[^2]
4. The fix is to use async-native APIs, split CPU work, or offload bounded blocking work to a thread/process pool ✅[^3]

```python
result = await asyncio.to_thread(read_sync_file, path)
# or: await loop.run_in_executor(pool, cpu_heavy, value)
```
```rust
let parsed = tokio::task::spawn_blocking(move || parse_big(payload)).await??;
```
```ts
const text = await fs.promises.readFile(path, "utf8");
```
```go
req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
```

## Worked example
A Python route handles 100 concurrent requests and each route calls `time.sleep(1)` inside `async def`.
Because the sleeping task does not await, the event loop cannot run the next ready task during that second ✅[^2]
Changing the call to `await asyncio.sleep(1)` for non-blocking sleep or `await asyncio.to_thread(sync_call)` for synchronous I/O lets the loop schedule other tasks while the work waits elsewhere ✅[^2]
In Rust, the equivalent change is replacing inline blocking work with `tokio::task::spawn_blocking`, which uses threads dedicated to blocking operations ✅[^3]

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Blocking DNS, file I/O, crypto, or compression in Node | Throughput can drop and malicious inputs can cause denial of service | Node has a small Event Loop plus Worker Pool model and warns not to block either ✅[^4] |
| Long CPU task in `spawn_blocking` | It may occupy a blocking-pool thread until finished | Tokio says started `spawn_blocking` tasks cannot be aborted and should eventually finish ✅[^3] |
| Python slow callbacks | Debug mode logs callbacks that exceed the slow-callback threshold | asyncio debug mode logs callbacks taking longer than 100 ms by default ✅[^2] |
| Rust local testing looks fine | Multi-threaded runtimes can hide blocking until executor threads saturate | Cooperative scheduling only switches at await points ✅[^1] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Async-native library | Best integration with cancellation and fairness | May require changing dependencies |
| Thread offload | Simple for sync I/O | Threads are finite and cancellation is weaker |
| Process pool or Rayon | Better for CPU-bound work | Serialization and coordination overhead |

## Takeaways
- Do not call blocking I/O or long CPU code directly from coroutines, Tokio tasks, or Node callbacks. [rule-candidate]
- Use async-native APIs first; use thread or process offload for bounded blocking work. [rule-candidate]
- Turn on asyncio debug mode when hunting event-loop stalls. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| stack idiom | PY-5 | Source: |
| stack idiom | RS-5 | Source: |

## Verification status
- Verified: 17 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [Async: What is blocking?](https://ryhl.io/blog/async-what-is-blocking/) — Alice Ryhl, 2020. Backs: cooperative scheduling and Rust examples. [^1]
- [Developing with asyncio](https://docs.python.org/3/library/asyncio-dev.html) and [asyncio.to_thread](https://docs.python.org/3/library/asyncio-task.html#asyncio.to_thread) — Python Software Foundation, living. Backs: Python event loop, debug mode, offload APIs. [^2]
- [tokio::task::spawn_blocking](https://docs.rs/tokio/latest/tokio/task/fn.spawn_blocking.html) — Tokio project, living. Backs: Rust blocking behavior. [^3]
- [Don't block the Event Loop](https://nodejs.org/learn/asynchronous-work/dont-block-the-event-loop) — Node.js project, living. Backs: Node Event Loop behavior. [^4]
- `copilot/frameworks/agentic-sdlc/stacks/python/idioms.md` — cites this doc as PY-5.
- `copilot/frameworks/agentic-sdlc/stacks/rust/idioms.md` — cites this doc as RS-5.

## Related
- `concurrency/structured-concurrency.md`
- `concurrency/shared-state-and-data-races.md`
- `operations/structured-logging.md`