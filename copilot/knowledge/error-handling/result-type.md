---
schema: knowledge-doc/v1
type: concept
topic: error-handling
status: verified
applies-to: ["TypeScript", "Rust", "Swift", "F#", "any language with tagged unions"]
last-verified: 2026-10-28
last-updated: 2026-10-28
tags: [result, errors-as-values, discriminated-union, railway-oriented-programming, expected-failures]
---

# Result: expected failures as values

## Summary
**TL;DR:** A `Result` is a value that is either a success carrying the output, or a failure carrying a named reason; never both, never neither. Functions return it when a failure is expected and the caller can act on it (not found, conflict, invalid input). Bugs and broken infrastructure are not expected failures; they are thrown and handled once at the edge. Rust, Swift and F# ship this type in their standard libraries, so the idea is mainstream, not a local convention.
**Use this when:** deciding whether a failure is returned or thrown, explaining why a use case returns `{ ok: false, error: "not-found" }` instead of throwing, or choosing the shape of a new failure reason.
**Not this doc:** chaining many Result steps into a pipeline (see `software-design/functional-modeling/pipelines.md`), or turning reasons into HTTP answers (see `web-apis/http-error-mapping.md`).

## Problem
An exception does not appear in a function's type. A caller of `revise()` cannot tell from the signature that a version conflict can happen, so the compiler cannot make it handle one. Expected outcomes then leak into one catch-all handler, or reach the user as a 500.

## Mental model
**Analogy:** a parcel locker slip. It says either "your parcel is in box 12" or "not delivered: address unknown". You must read the slip before you walk to a box. A fire alarm in the building is different: nobody writes it on the slip; everyone leaves (the process fails fast, the edge answers 500).

**Artifact:**
```ts
// src/modules/shared/domain/Result.ts (stack reference)
export type Result<T, E extends string> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

// The caller must narrow on `ok` before it can touch `value`.
const result = await reviseDocument.run(input);
if (!result.ok) return send(mapper.problemFor(result.error)); // LookupError | DocumentError: "not-found", "version-conflict", "invalid-body"
res.json(result.value);
```

## How it works
**What kind of type is it?** `Result` is a generic type that is always one of two shapes: `{ ok: true, value }` or `{ ok: false, error }`. Type theory calls this a *sum type*. It is not a domain concept; it sits in `modules/shared/domain/` only because domain methods such as `Document.revise` return it.

Domain-driven design sorts domain objects into two groups. ✅[^6]
- An **entity** has an identity that lasts through changes, like `Document` with its `id` and versions.
- A **value object** has no identity: it is defined only by its attributes, and it should be immutable.

`Result` is not a domain object, so neither group fits it exactly. It does behave like a value object, which shows in three ways:

| Property | What it means for `Result` |
|---|---|
| No identity | Two `{ ok: false, error: "not-found" }` mean the same thing; a caller never asks "which one is this?" |
| Equal by contents | Compare the case (`ok`) and then the payload. JavaScript `===` compares object references, so compare the fields instead (`toEqual` in tests) |
| Immutable | All fields are `readonly`; nobody changes a `Result` after it is returned |

The payload keeps its own kind. `Document.revise` returns `Result<Document, …>`, so a success carries an entity. Two such results are the same only if they carry the same document (same `id` and version). Wrapping an entity in a `Result` does not turn it into a value. *(Classification ours, from the definitions.)*

**The same type in four ecosystems:**

| Language | Type | Success / failure | What the source says |
|---|---|---|---|
| Rust | `Result<T, E>` (std) | `Ok(T)` / `Err(E)` | Returned when errors are expected and recoverable; ignoring one warns ✅[^1] |
| Swift | `Result<Success, Failure>` (std, SE-0235) | `.success` / `.failure` | Either a success or a failure, each with a value ✅[^2] |
| F# | `Result<'T,'TError>` (FSharp.Core) | `Ok` / `Error` | Used for railway-oriented error handling ✅[^3] |
| TypeScript | none built in; a discriminated union | `{ ok: true, value }` / `{ ok: false, error }` | Checking `ok` narrows to one branch ✅[^5] |

1. Rust defines `Result<T, E>` as the type for returning and propagating errors, with `Ok(T)` for success and `Err(E)` for failure, and says functions return it when errors are expected and recoverable. ✅[^1]
2. Rust marks `Result` as `#[must_use]`, so ignoring one is a compiler warning; the `?` operator returns an `Err` early to the caller. ✅[^1] TypeScript has no must-use check; the type system only forces narrowing before `value` is read.
3. Swift added `Result` to its standard library (SE-0235) as a value that represents either a success or a failure, each with an associated value, for cases its `throws` model does not cover well, such as asynchronous completion handlers and handling a failure later. ✅[^2]
4. F# ships `Result<'T,'TError>` with `Ok` and `Error` cases; Microsoft's docs tie it to railway-oriented programming and note that it forces pattern matching at the end of a validation chain. ✅[^3]
5. Joe Duffy's account of the Midori error model separates bugs from recoverable errors; bugs end the process (fail fast) instead of being handled. ✅[^4] This is the line the stack draws between `Result` (expected) and thrown `Error` subclasses (unexpected).
6. In TypeScript the type is a discriminated union: checking the literal `ok` field narrows the value to one branch. ✅[^5]

## Worked example
`ReviseDocument.run` in the stack reference, one request at a time:

| Input | What happens | Returned value | HTTP answer (interface ring) |
|---|---|---|---|
| Unknown id | `find` returns nothing | `{ ok: false, error: "not-found" }` | 404 problem |
| Stale `expectedVersion` | `Document.revise` refuses | `{ ok: false, error: "version-conflict" }` | 409 problem |
| Valid revision | Saved | `{ ok: true, value: { id, body, version } }` | 200 |
| Database down | Adapter throws `RepositoryError` with `cause` | — (thrown) | 500 via the shared error middleware |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Caller ignores the Result entirely | TypeScript compiles it | No must-use check exists in TypeScript; Rust warns ✅[^1]. A lint for unused expressions only catches bare calls |
| Two use cases both fail with "not found" | Both return `LookupError.NotFound`, one declared value | Codes the project owns and writes in several files are an `as const` object, declared once (TSN-20, `error-handling/error-codes.md`). Two separate literal unions would instead be independent types that only happen to share text |
| Failure needs data (which field was invalid) | Use an object error: `{ kind: "invalid-body", field: "body" }` | A string reason carries no payload *(analysis, ours)* |
| Bug inside a use case (undefined access) | Thrown, not returned | Bugs are not recoverable errors ✅[^4] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Return `Result` for expected failures | The signature lists every failure; the compiler forces a check | Each step must forward failures by hand (no `?` in TypeScript) |
| Throw for everything | Short happy path | Failures are invisible in types; expected cases end up in a catch-all |
| Library (`neverthrow`, Effect) | `map`/`andThen` helpers, async chaining | A dependency and a vocabulary every reader must learn *(analysis, ours)* |

## Takeaways
- Return a `Result` for failures the caller is expected to handle; throw an `Error` subclass for bugs and broken infrastructure. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| stack idiom | TSN-4 | Source: |

## Verification status
- Verified: 13 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-28

## References
- [Module `std::result`](https://doc.rust-lang.org/std/result/) — Rust project, living. Backs: How it works 1–2, Edge cases. [^1]
- [SE-0235: Add Result to the Standard Library](https://github.com/swiftlang/swift-evolution/blob/main/proposals/0235-add-result.md) — Swift project, 2018. Backs: How it works 3. [^2]
- [Results (F#)](https://learn.microsoft.com/en-us/dotnet/fsharp/language-reference/results) — Microsoft, living. Backs: How it works 4. [^3]
- [The Error Model](https://joeduffyblog.com/2016/02/07/the-error-model/) — Joe Duffy, 2016. Backs: How it works 5, Edge cases. [^4]
- [TypeScript Handbook: Discriminated unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions) — TypeScript team, living. Backs: How it works 6. [^5]
- [EvansClassification](https://martinfowler.com/bliki/EvansClassification.html) — Martin Fowler, 2005. Backs: How it works (entity versus value object). [^6]
- [Railway Oriented Programming](https://fsharpforfunandprofit.com/rop/) — Scott Wlaschin, 2014. Background for chaining Results.
- `copilot/frameworks/agentic-sdlc/stacks/typescript-node/idioms.md` — `idiom.errors`, TSN-4 and TSN-5 apply this.

## Related
- `error-handling/handle-errors-once.md` — where thrown errors are logged.
- `software-design/functional-modeling/pipelines.md` — chaining Results.
- `web-apis/http-error-mapping.md` — reasons to RFC 9457 problems.
- `error-handling/error-codes.md` — how the reasons themselves are declared, named and tested.
