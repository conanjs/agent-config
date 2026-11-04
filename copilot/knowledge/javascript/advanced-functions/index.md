---
schema: topic-index/v1
kind: subtopic
topic: javascript/advanced-functions
last-updated: 2026-11-04
---

# Advanced working with functions

Lexical environments and closures, `var` and the global object, recursion and the call stack, rest and spread, function objects, `new Function`, timers, decorators with `call`/`apply`, `bind` and arrow functions. Consolidates javascript.info Part 1, chapter 6.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [scope-closures-and-var.md](scope-closures-and-var.md) | concept | Lexical environments, why every function is a closure with live lookups, `var` hoisting and function scope, and `globalThis` | verified |
| [function-objects-and-calls.md](function-objects-and-calls.md) | concept | Recursion and the stack, rest/spread, function properties, `new Function`, timers, decorators with `call`/`apply`, `bind`, arrow functions | verified |
| [scope-and-closures-deep-dive.md](scope-and-closures-deep-dive.md) | deep-dive | Scope fixed at compile time, lookup failures, shadowing, global scope in six environments, hoisting/TDZ, parameter scope, closures and V8 context sharing measured, the module pattern | verified |
| [functional-programming-deep-dive.md](functional-programming-deep-dive.md) | deep-dive | Purity, higher-order functions, composition and its laws, currying and point-free traps, memoization, immutability and sharing, trampolines, functors/Maybe/Either, chain vs loop cost measured | verified |

## References
- [The Modern JavaScript Tutorial, Part 1: The JavaScript language](https://javascript.info/js) — javascript.info, living. Backs: subtopic scope (one subtopic per chapter).
- [ECMAScript Language Specification](https://tc39.es/ecma262/) — Ecma TC39, living. Backs: topic scope.

## Related
- `javascript/learning-path.md` — where this subtopic sits in the learning order.
- `js-runtime/` — engine and Node.js runtime behaviour.
