---
schema: knowledge-doc/v1
type: concept
topic: javascript/error-handling
status: verified
applies-to: ["ECMAScript 2025", "Node.js 24"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [javascript, try-catch, finally, throw, error, custom-errors, error-cause, wrapping-exceptions, rethrow]
---

# Errors: `try…catch…finally`, custom error classes and wrapping

## Summary
**TL;DR:** `try…catch` catches errors thrown **synchronously** while the `try` block runs; it cannot catch an error thrown later in a callback scheduled from it. `finally` always runs — after `return` too — and a `return` inside `finally` overrides the earlier one. Errors are objects with `name`, `message` and `stack`; anything can be thrown, but throw `Error` subclasses. Build a hierarchy (`ValidationError extends Error`, `PropertyRequiredError extends ValidationError`) with `this.name = this.constructor.name`, check it with `instanceof`, **rethrow** what you do not handle, and wrap low-level errors in higher-level ones using `new Error(msg, { cause })`.
**Use this when:** designing error handling for a module, debugging an error that "escapes" a `try`, or deciding what a function should throw.
**Not this doc:** errors in promises and `async` functions → `javascript/async/promises.md` and `js-runtime/promise-rejections.md`; error-handling design across services → `error-handling/`.

## Problem
A `try` around `setTimeout` does not catch the callback's error; a `catch` that swallows everything hides programming bugs such as typos; callers cannot tell a missing field from a parse failure because everything is a generic `Error`; `finally` with `return` silently discards an exception.

## Mental model
**Analogy:** `try` is a safety net under the trapeze *right now*; an error thrown later, from a callback, falls where the net no longer is. A custom error hierarchy is a set of labelled bins: the handler picks out the bins it knows how to empty and passes the rest up.

**Artifact:** custom error hierarchy in Node 24 ✅[^1]:
```js
class ValidationError extends Error {
  constructor(m) { super(m); this.name = this.constructor.name; }
}
class PropErr extends ValidationError {}
try { throw new PropErr('no field'); }
catch (e) { [e.name, e instanceof ValidationError, e instanceof Error, e.message]; }
// ['PropErr', true, true, 'no field']
```

## How it works
1. **Flow.** Code in `try` runs; on an error, the rest of `try` is skipped and `catch (err)` runs; with no error, `catch` is skipped ✅[^2]. Only runtime errors in valid code are catchable — a `SyntaxError` in the script itself stops parsing before anything runs ✅[^2].
2. **Synchronous only.** Scheduling a callback inside `try` and throwing inside the callback is not caught by that `try`; put the `try` inside the callback ✅[^1] ✅[^2].
3. **The error object.** Built-in errors have `name` (`'TypeError'`), `message` and a non-standard but universal `stack` ✅[^1] ✅[^2]. `catch {` without a binding is allowed when the error is not needed ✅[^1] ✅[^2]. Any value can be thrown — `throw 42` gives a number in `catch` — but then there is no `stack` ✅[^1].
4. **Rethrowing.** Catch, check the type (`if (!(err instanceof SyntaxError)) throw err`), handle only what you know ✅[^2].
5. **`finally`.** Runs whether `try` returned, threw or completed: the lab recorded `try>finally` before the value was returned. A `return` in `finally` replaces the `try`'s return value ✅[^1] ✅[^2].
6. **Global handlers.** Browsers offer `window.onerror` and Node has `process.on('uncaughtException')` for logging errors nobody caught; they are for reporting, not recovery ✅[^2].
7. **Custom errors.** Extend `Error`, call `super(message)`, set `this.name` (using `this.constructor.name` saves repeating it in subclasses), and add fields such as `property` ✅[^3]. Check with `instanceof`, which also matches subclasses ✅[^1] ✅[^3].
8. **Wrapping exceptions.** A low-level error becomes the `cause` of a higher-level one: `new ReadError('Validation failed', { cause: err })`; the original stays available as `e.cause` ✅[^1] ✅[^3] ✅[^4].

## Worked example
Reading user JSON:

| Step | Code | Outcome |
|---|---|---|
| 1 | `JSON.parse('{')` inside `try` | `SyntaxError` caught |
| 2 | Missing `name` field → `throw new PropertyRequiredError('name')` | Custom error caught; `instanceof ValidationError` true ✅[^1] |
| 3 | Typo `usr.name` → `ReferenceError` | Not a `ValidationError`: rethrown ✅[^2] |
| 4 | Caller wraps: `throw new ReadError('cannot read user', { cause: e })` | Caller checks one type; `e.cause` keeps the detail ✅[^1] |
| 5 | `finally { file.close() }` | Runs in every path ✅[^1] |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `try { setTimeout(() => { throw … }) }` | Not caught by this `try` | Runs after `try` finished ✅[^1] |
| `return` in both `try` and `finally` | `finally`'s value wins | `finally` completes last ✅[^1] |
| Throwing a string or number | Caught, but no `stack` or `name` | Not an `Error` ✅[^1] |
| Catch-all `catch (e) {}` | Hides programming errors | Rethrow unknown types ✅[^2] |
| Custom error without setting `name` | `name` is `'Error'` | Inherited from `Error.prototype` ✅[^3] |

## Takeaways
- Throw `Error` subclasses with a meaningful `name`; never throw strings. [rule-candidate]
- Catch only errors you can handle; rethrow the rest. [rule-candidate]
- Wrap low-level errors with `{ cause }` instead of losing them.
- Never `return` from `finally`.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 29 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- `linux/lab-setup.md` — the Node 24.22.1 lab where every behaviour marked with this note ran on 2026-11-04. [^1]
- [Error handling, "try...catch"](https://javascript.info/try-catch) — javascript.info, living. Backs: flow, synchronous scope, error object, optional binding, rethrowing, `finally`, global handlers. [^2]
- [Custom errors, extending Error](https://javascript.info/custom-errors) — javascript.info, living. Backs: custom classes, `this.constructor.name`, `instanceof`, wrapping exceptions. [^3]
- [Error: cause](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause) — MDN, living. Backs: the `cause` option. [^4]

## Related
- `error-handling/` — error-handling design beyond the language.
- `javascript/async/promises.md`
