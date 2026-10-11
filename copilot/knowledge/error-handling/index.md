---
schema: topic-index/v1
kind: topic
topic: error-handling
last-updated: 2026-10-04
---

# Error handling

Error handling covers how failures are represented, propagated, wrapped, logged, matched, and translated. It does not cover domain validation rules except where validation failures become error API contracts.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [handle-errors-once.md](handle-errors-once.md) | concept | Add context while propagating, then log or recover exactly once at the boundary | verified |
| [library-vs-application-errors.md](library-vs-application-errors.md) | concept | Libraries expose typed matchable errors; applications add human context at the edge | verified |

## References
- [Working with Errors in Go 1.13](https://go.dev/blog/go1.13-errors) — Go team, 2019. Backs: wrapping and cause chains.
- [`anyhow`](https://docs.rs/anyhow/latest/anyhow/) and [`thiserror`](https://docs.rs/thiserror/latest/thiserror/) — David Tolnay / docs.rs, living. Backs: Rust error scope.
- [Errors and Exceptions](https://docs.python.org/3/tutorial/errors.html) — Python Software Foundation, living. Backs: exception hierarchy scope.

## Related
- `concurrency/`
- `web-apis/http-error-mapping.md`
- `operations/structured-logging.md`