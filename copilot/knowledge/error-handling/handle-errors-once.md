---
schema: knowledge-doc/v1
type: concept
topic: error-handling
status: verified
applies-to: ["Go", "Python", "Rust", "TypeScript"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [errors, logging, go, wrapping]
---

# Handle errors once

## Summary
**TL;DR:** Either handle an error by recovering or logging it, or add context and return it; doing both at each layer creates duplicate noise ✅[^1]
**Use this when:** code catches, returns, wraps, logs, or translates errors across service, repository, or handler boundaries.
**Not this doc:** choosing library-facing error types → `error-handling/library-vs-application-errors.md`.

## Problem
Go 1.13 added wrapping so callers can inspect an error chain with `errors.Is` and `errors.As` after context has been added ✅[^1]
If an inner repository logs `query failed` and returns the same error for the handler to log again, the same failure appears twice with partial context instead of once with full request context.
Go review guidance notes that error strings are often combined with other context, which is why errors should be formatted as composable fragments rather than standalone log lines ✅[^3]

## Mental model
**Analogy:** an incident ticket should be announced once by the incident commander; every specialist adds notes to the ticket, but they do not page the company separately.
**Artifact:**
```go
func (r Repo) Get(ctx context.Context, id string) (User, error) {
    row, err := r.query(ctx, id)
    if err != nil {
        return User{}, fmt.Errorf("get user %s: %w", id, err)
    }
    return row, nil
}

func handler(w http.ResponseWriter, r *http.Request) {
    user, err := repo.Get(r.Context(), r.PathValue("id"))
    if err != nil { log.Error("request failed", "err", err); return }
    _ = user
}
```
The repository preserves cause with `%w`, and the handler logs once at the boundary with request context ✅[^1]

## How it works
1. A low layer detects a failure and returns an error value rather than logging it locally when it cannot recover ✅[^4]
2. Each crossing boundary adds operation-specific context with `%w`, `raise ... from`, `.context()`, or `new Error(message, { cause })` ✅[^1]
3. The first layer that can choose the user-visible response, retry, metric, or process exit handles the error exactly once.
4. Go callers branch on meaning with `errors.Is` for sentinels or `errors.As` for typed errors instead of parsing the message ✅[^1]

```go
if err != nil { return fmt.Errorf("load config %s: %w", path, err) }
if errors.Is(err, fs.ErrNotExist) { /* choose 404 or default */ }
```
```python
try:
    load(path)
except OSError as err:
    raise ConfigError(f"load config {path}") from err
```
```rust
let text = std::fs::read_to_string(path).context("load config")?;
```
```ts
throw new Error(`load config ${path}`, { cause: err });
```

## Worked example
A Go API handler calls `Repo.Get`, which calls SQL.
`Repo.Get` converts `sql.ErrNoRows` to a domain sentinel and wraps unexpected SQL failures with `fmt.Errorf("query user %s: %w", id, err)` ✅[^1]
The handler maps `errors.Is(err, ErrNotFound)` to HTTP 404, logs unexpected errors once with request ID, and returns a generic 500 body.
This preserves machine matching, human context, and one log record per failure.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Log and return | Duplicate logs and inflated alerts | More than one layer reports the same failure |
| Wrap with `%v` instead of `%w` in Go | Cause text remains, but `errors.Is` and `errors.As` cannot inspect that wrapped cause | `%w` is the wrapping verb ✅[^1] |
| Swallow after logging | Caller may continue as if the operation succeeded | Handling means recovery, fallback, or final reporting |
| Expose implementation details | Callers depend on lower-level errors | Go's error-wrapping guidance says wrapping exposes the underlying error to callers ✅[^1] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Log only at process/request boundary | Clean observability and full context | Inner layers need discipline not to log expected propagation |
| Wrap at every meaningful boundary | Strong traceback of intent | Messages can become verbose if wording repeats |
| Convert to typed/sentinel error | Stable caller behavior | Public error contracts must be maintained |

## Takeaways
- If you cannot recover, add context and return; do not also log. [rule-candidate]
- Log once where you decide the response, retry, or process exit. [rule-candidate]
- In Go, use `%w` plus `errors.Is` or `errors.As` for matchable causes. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| stack idiom | GO-7 | Source: |

## Verification status
- Verified: 10 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [Working with Errors in Go 1.13](https://go.dev/blog/go1.13-errors) — Go team, 2019. Backs: wrapping, `%w`, `errors.Is`, `errors.As`, abstraction boundaries. [^1]
- [Don't just check errors, handle them gracefully](https://dave.cheney.net/tag/error-handling) — Dave Cheney, 2016. Backs: opaque errors, avoiding error-string inspection, and error API coupling.
- [Go Code Review Comments: Error Strings](https://go.dev/wiki/CodeReviewComments#error-strings) — Go project, living. Backs: composable error text. [^3]
- [Errors are values](https://go.dev/blog/errors-are-values) — Go team, 2015. Backs: errors as values and explicit handling. [^4]
- `copilot/frameworks/agentic-sdlc/stacks/go/idioms.md` — cites this doc as GO-7.

## Related
- `error-handling/library-vs-application-errors.md`
- `operations/structured-logging.md`
- `web-apis/http-error-mapping.md`