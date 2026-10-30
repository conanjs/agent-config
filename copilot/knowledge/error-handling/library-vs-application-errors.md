---
schema: knowledge-doc/v1
type: concept
topic: error-handling
status: verified
applies-to: ["Rust", "Go", "Python", "TypeScript"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [errors, libraries, applications, rust, thiserror, anyhow]
---

# Library and application errors

## Summary
**TL;DR:** Libraries should expose stable, typed, matchable errors; applications should add task-specific context near the edge where a human or operator will read the failure ✅[^1]
**Use this when:** deciding whether a crate, package, module, or service boundary returns a custom error type, a boxed/dynamic error, or a one-off message.
**Not this doc:** avoiding duplicate logs while propagating → `error-handling/handle-errors-once.md`.

## Problem
A library error is part of the caller's API contract, so callers need variants, fields, causes, or classes they can match without parsing text ✅[^2]
An application error is often read by the operator of the binary, so broad context such as `failed to load tenant config` is more valuable than a public enum for every low-level failure ✅[^1]
Rust stack rule RS-8 follows this split: library crates expose typed errors, while binaries add `anyhow` context at the edge.

## Mental model
**Analogy:** a library returns a labeled part number that another machine can sort; an application prints a shipping label a human can act on.
**Artifact:**
```rust
#[derive(Debug, thiserror::Error)]
pub enum RepoError {
    #[error("user {0} not found")]
    NotFound(UserId),
    #[error("database error")]
    Db(#[from] sqlx::Error),
}

fn main() -> anyhow::Result<()> {
    run().context("serve API")?;
    Ok(())
}
```
`thiserror` generates standard error implementations without becoming part of the public API, while `anyhow::Context` adds troubleshooting context in application code ✅[^1]

## How it works
1. Library code defines a narrow error enum, class hierarchy, or sentinel/typed error that names the failures callers may handle ✅[^2]
2. Lower-level causes are attached through `source`, `%w`, `raise ... from`, or `cause` so diagnostics keep the chain ✅[^3]
3. Application code uses broad context wrappers, logging, metrics, and exit/response mapping at the outer boundary ✅[^1]
4. Public libraries avoid returning catch-all application errors when callers need exhaustive or semantic matching ✅[^2]

```go
var ErrNotFound = errors.New("not found")
type ValidationError struct{ Field string }
func (e ValidationError) Error() string { return "invalid " + e.Field }
```
```python
class PaymentError(Exception): pass
class CardDeclined(PaymentError): pass
raise PaymentError("charge customer") from err
```
```rust
#[derive(thiserror::Error, Debug)]
pub enum PaymentError { #[error("card declined")] CardDeclined }
```
```ts
class PaymentError extends Error {}
class CardDeclined extends PaymentError {
  constructor(cause?: unknown) { super("card declined", { cause }); }
}
```

## Worked example
A Rust library `invoice-core` validates invoice state.
It returns `Result<T, InvoiceError>` where variants include `InvalidCurrency` and `LineTotalMismatch`, so callers can match those variants in tests and API mapping ✅[^2]
The binary `invoice-api` calls the library and uses `.context("create invoice")?`, so logs explain the operation without forcing every library function to know about HTTP routes or CLI commands ✅[^1]
The same split maps to Go packages returning sentinel or typed errors, Python modules raising subclasses of a component base exception, and TypeScript libraries exporting `Error` subclasses with optional `cause` ✅[^3]

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Rust library returns `anyhow::Error` | Callers lose a stable enum to match | `anyhow` is documented as convenient for application code, while `thiserror` supports library-defined error types ✅[^1] |
| Go package exposes raw SQL errors | Callers depend on implementation details | Go wrapping guidance says wrapping exposes underlying errors as API ✅[^4] |
| Python catches `Exception` broadly | Domain failures and programmer bugs can be mixed | Python exception matching is type-based and first matching handler wins ✅[^5] |
| TypeScript error loses cause | Diagnostics lose the original failure | JavaScript `Error` supports a `cause` option for chaining ✅[^3] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Typed library errors | Matchable, documented API | More design work and semver responsibility |
| Application context errors | Fast composition and rich operator messages | Poor as a reusable library contract |
| Opaque public error with private representation | API can evolve | Callers need accessor methods for matchable cases |

## Takeaways
- Libraries expose the errors callers are expected to branch on. [rule-candidate]
- Applications add human context and perform final mapping at the edge. [rule-candidate]
- Preserve causes across abstraction boundaries unless doing so would expose an implementation detail. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| stack idiom | RS-8 | Source: |

## Verification status
- Verified: 15 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [`anyhow`](https://docs.rs/anyhow/latest/anyhow/) and [`thiserror`](https://docs.rs/thiserror/latest/thiserror/) — David Tolnay / docs.rs, living. Backs: Rust application vs library patterns. [^1]
- [Rust API Guidelines: Errors](https://rust-lang.github.io/api-guidelines/interoperability.html#c-good-err) and [std::error::Error](https://doc.rust-lang.org/std/error/trait.Error.html) — Rust project, living. Backs: public error expectations and sources. [^2]
- [Error: cause](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause), [Errors and Exceptions](https://docs.python.org/3/tutorial/errors.html), and [Working with Errors in Go 1.13](https://go.dev/blog/go1.13-errors) — MDN, Python Software Foundation, and Go team, living/2019. Backs: cross-language cause chains. [^3]
- [Working with Errors in Go 1.13](https://go.dev/blog/go1.13-errors) — Go team, 2019. Backs: wrapping as API exposure. [^4]
- [Errors and Exceptions](https://docs.python.org/3/tutorial/errors.html) — Python Software Foundation, living. Backs: exception hierarchy matching. [^5]
- `copilot/frameworks/agentic-sdlc/stacks/rust/idioms.md` — cites this doc as RS-8.

## Related
- `error-handling/handle-errors-once.md`
- `web-apis/http-error-mapping.md`
- `operations/structured-logging.md`