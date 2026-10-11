---
schema: topic-index/v1
kind: topic
topic: concurrency
last-updated: 2026-10-04
---

# Concurrency

Concurrency covers how independent work is started, waited for, cancelled, scheduled, and synchronized across languages. It does not cover distributed systems protocols or database transaction isolation.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [structured-concurrency.md](structured-concurrency.md) | concept | Owned task scopes, cancellation, joins, and leak prevention across Go, Python, Rust, and TypeScript | verified |
| [blocking-in-async-runtimes.md](blocking-in-async-runtimes.md) | concept | Why blocking calls stall cooperative async runtimes and how to offload them | verified |
| [shared-state-and-data-races.md](shared-state-and-data-races.md) | concept | Data races, synchronization, channels, and Rust Send/Sync-safe sharing | verified |

## References
- [Notes on structured concurrency](https://vorpus.org/blog/notes-on-structured-concurrency-or-go-statement-considered-harmful/) — Nathaniel J. Smith, 2018. Backs: topic scope.
- [The Go Memory Model](https://go.dev/ref/mem) — Go project, 2022. Backs: shared-state scope.
- [Developing with asyncio](https://docs.python.org/3/library/asyncio-dev.html) — Python Software Foundation, living. Backs: async runtime scope.

## Related
- `error-handling/`
- `js-runtime/`
- `software-design/functional-modeling/`