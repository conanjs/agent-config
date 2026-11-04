---
schema: topic-index/v1
kind: subtopic
topic: javascript/node
last-updated: 2026-11-04
---

# Node.js programming

Programming Node.js services and data pipelines: the event loop and libuv thread pool, HTTP services, timeouts, graceful shutdown, long polling, streams and backpressure, CSV and JSON Lines. Engine and runtime internals stay in `js-runtime/`.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [node-services-deep-dive.md](node-services-deep-dive.md) | deep-dive | Event loop and thread pool measured, a framework-free JSON service, timeout defaults, long polling, `--env-file`, graceful shutdown verified, microservice concerns | verified |
| [data-wrangling-deep-dive.md](data-wrangling-deep-dive.md) | deep-dive | Whole-file vs streaming memory measured, RFC 4180 CSV traps, JSON Lines, type conversion, `Intl`, streams, backpressure and `pipeline` | verified |

## References
- [The Modern JavaScript Tutorial, Part 1: The JavaScript language](https://javascript.info/js) — javascript.info, living. Backs: subtopic scope (one subtopic per chapter).
- [ECMAScript Language Specification](https://tc39.es/ecma262/) — Ecma TC39, living. Backs: topic scope.

## Related
- `javascript/learning-path.md` — where this subtopic sits in the learning order.
- `js-runtime/` — engine and Node.js runtime behaviour.
