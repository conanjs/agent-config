---
schema: knowledge-doc/v1
type: concept
topic: javascript/advanced-functions
status: verified
applies-to: ["ECMAScript 2025", "Node.js 24"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [javascript, closure, lexical-environment, scope, var, hoisting, iife, global-object, globalthis]
---

# Scope, closures, `var` and the global object

## Summary
**TL;DR:** Every block, function and script has a **Lexical Environment** — a record of its variables plus a link to the outer environment. A function remembers the environment where it was **created** (its `[[Environment]]`), so it can read and update those variables later, even after the outer function returned: that is a **closure**, and in JavaScript every function is one. Lookups walk outward through the chain and see the *current* value, not a snapshot. `var` ignores blocks, is hoisted as `undefined` and, at a script's top level, becomes a property of the **global object** (`globalThis`); IIFEs were the old way to get a private scope.
**Use this when:** a callback sees an unexpected variable value, you need private state without a class, you debug memory kept alive by a closure, or you read legacy `var` code.
**Not this doc:** `this` binding → `javascript/object-basics/objects-references-and-this.md`; function objects, `bind` and timers → `javascript/advanced-functions/function-objects-and-calls.md`.

## Problem
Counters created by the same factory interfere or do not; a log callback prints a variable's latest value instead of the value when it was scheduled; a `var` inside an `if` is visible after it; a global variable from one script collides with another. All come from how environments are created and linked.

## Mental model
**Analogy:** each function call opens a new notebook (its environment) with a sticky note saying "for anything not here, look in notebook X" (the outer environment). A function created during that call carries a copy of the sticky note, not a copy of the notebook — so it always reads what is *currently* written in notebook X.

**Artifact:** two counters from one factory, in Node 24 ✅[^1]:
```js
function makeCounter() { let count = 0; return () => ++count; }
const a = makeCounter(), b = makeCounter();
a(); a();
[a(), b()]     // [3, 1] — each call of makeCounter made its own environment
```

## How it works
1. **Environments are created per run.** Each call of a function, and each execution of a block with `let`/`const`, creates a new Lexical Environment. A `for (let …)` loop creates one per iteration ✅[^2] ✅[^1].
2. **Declarations are registered first.** Function declarations are fully initialized when the environment is created; `let`/`const` exist but are uninitialized until their line (the temporal dead zone) ✅[^2] ✅[^1].
3. **Functions capture their birthplace.** A function's hidden `[[Environment]]` points to the environment it was created in, not where it is called ✅[^2].
4. **Lookups are live.** Reading `name` walks the chain at call time: `let name = 'John'; const f = () => name; name = 'Pete'; f()` returns `'Pete'` ✅[^1] ✅[^2].
5. **Memory.** An environment stays alive as long as a function referencing it is reachable; engines may drop variables a closure never uses, which is why some are "optimized out" in a debugger ✅[^2].
6. **`var`.**
   - It has no block scope: `if (true) { var v = 1 } v` is `1` ✅[^1] ✅[^3].
   - It is hoisted with value `undefined`, so reading it before the assignment gives `undefined` instead of an error ✅[^1] ✅[^3].
   - Redeclaring it is allowed ✅[^1].
   - IIFEs — `(function () { … })()` — gave `var` code a private scope before blocks existed ✅[^1] ✅[^3].
7. **Global object.** `globalThis` is the standard name (`window` in browsers, `global` in Node) ✅[^4]. In a classic script, top-level `var` and function declarations become its properties; `let`/`const` do not (measured: `globalThis.topVarX` is 1, `globalThis.topLetY` is `undefined`) ✅[^1] ✅[^4]. ES modules have their own scope, so their top-level declarations are never global properties ✅[^4].

## Worked example
A private rate limiter using a closure:

| Step | Code | Environment state |
|---|---|---|
| 1 | `function limiter(max) { let used = 0; return () => used < max ? ++used : 'blocked'; }` | — |
| 2 | `const call = limiter(2)` | env₁ `{max: 2, used: 0}`; `call.[[Environment]] = env₁` |
| 3 | `call()` → 1, `call()` → 2 | env₁ `used` 1, then 2 |
| 4 | `call()` → `'blocked'` | env₁ `used` stays 2 |
| 5 | `limiter(2)()` → 1 | a new env₂, independent of env₁ (as in the artifact, `[3, 1]`) ✅[^1] |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Callbacks in a `for (var i…)` loop | All see the final `i` | One environment for the function ✅[^1] |
| Same loop with `let` | Each callback sees its own `i` | One environment per iteration ✅[^1] |
| Variable read in a closure after it changed | New value | Lookups are live ✅[^1] |
| `new Function` body referencing an outer local | Not visible | `new Function` closes over the global environment only (see `javascript/advanced-functions/function-objects-and-calls.md`) ✅[^1] |
| Large object referenced by a long-lived closure | Not collected | The environment is reachable ✅[^2] |

## Takeaways
- Use closures for small private state (counters, memo caches, configuration) instead of globals.
- Release long-lived callbacks (listeners, timers) when done; their environments stay in memory otherwise. [rule-candidate]
- Do not attach application state to `globalThis`; use modules.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 26 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- `linux/lab-setup.md` — the Node 24.22.1 lab where every behaviour marked with this note ran on 2026-11-04. [^1]
- [Variable scope, closure](https://javascript.info/closure) — javascript.info, living. Backs: Lexical Environment, `[[Environment]]`, live lookups, garbage collection of environments. [^2]
- [The old "var"](https://javascript.info/var) — javascript.info, living. Backs: no block scope, hoisting, IIFEs. [^3]
- [Global object](https://javascript.info/global-object) — javascript.info, living. Backs: `globalThis`, `var` versus `let` at top level, modules. [^4]
- [Closures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures) — MDN, living. Background: closures and scope chains.

## Related
- `javascript/fundamentals/control-flow-and-functions.md`
- `javascript/advanced-functions/function-objects-and-calls.md`
