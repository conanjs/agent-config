---
schema: knowledge-doc/v1
type: concept
topic: javascript/advanced-functions
status: verified
applies-to: ["ECMAScript 2025", "Node.js 24", "HTML timers in browsers"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [javascript, recursion, call-stack, rest-parameters, spread, function-object, nfe, new-function, settimeout, setinterval, call, apply, bind, decorators, arrow-functions]
---

# Function objects, calls, `call`/`apply`/`bind` and timers

## Summary
**TL;DR:** Functions are objects: they have `name` and `length`, can carry custom properties, and can be passed, wrapped and rebuilt. Each call pushes an execution context on the **call stack** (recursion depth is limited). `...rest` collects arguments into a real array, `...spread` expands an iterable. `func.call(ctx, ...args)`, `func.apply(ctx, args)` and `func.bind(ctx, ...preset)` set `this` explicitly — the basis of **decorators** (wrappers that add caching, logging, throttling). `setTimeout`/`setInterval` schedule a call *after* the current code and all queued work finish, never exactly on time. Arrow functions have no own `this`, `arguments` or `new`.
**Use this when:** writing wrappers or higher-order functions, fixing lost `this` in callbacks, scheduling work, or choosing recursion versus a loop.
**Not this doc:** closures and scope → `javascript/advanced-functions/scope-closures-and-var.md`; the event loop that runs timers → `javascript/async/event-loop-and-async-await.md`.

## Problem
A wrapper that caches a method breaks because `this` is lost; `setTimeout(fn, 0)` runs later than expected; deep recursion crashes with `RangeError`; code that needs "all arguments" uses `arguments` inside an arrow function and gets the wrong values.

## Mental model
**Analogy:** a function is a recipe card. `call`/`apply` say "cook this recipe in *this* kitchen right now"; `bind` staples a kitchen (and some ingredients) to the card and hands you a new card. A decorator is a cover sheet clipped on top: it does something extra, then follows the original card.

**Artifact:** `call`, `apply` and `bind` in Node 24 ✅[^1]:
```js
function hi(p) { return p + this.n }
const o = { n: 'X' };
hi.call(o, 'c:')                   // 'c:X'
hi.apply(o, ['a:'])                // 'a:X'
const b = hi.bind(o, 'b:');  b()   // 'b:X'
b.call({ n: 'Y' })                 // 'b:X' — a bound function ignores later this
hi.bind(o).bind({ n: 'Z' })('bb:') // 'bb:X' — binding again has no effect
```

## How it works
1. **Recursion and the stack.** Each call stores its execution context (variables, current position) on the stack until it returns; very deep recursion throws `RangeError` (the lab's simple recursion passed depth 1000 before failing) ✅[^1] ✅[^2]. Any recursion can be rewritten as a loop, usually with less memory ✅[^2].
2. **Rest and spread.**
   - `function f(a, ...r)` puts the remaining arguments into the real array `r`; `arguments` is an older array-like holding all of them ✅[^1] ✅[^3].
   - Spread expands iterables into arguments, arrays or objects: `Math.max(...[1,5,3])` is 5 and `[...'hi']` is `['h','i']` ✅[^1] ✅[^3].
   - Arrow functions have no own `arguments` ✅[^3].
3. **Function properties.** `name` is inferred from the variable or method name (`const f = function(){}` → `'f'`); `length` counts parameters before the first default or rest (`g(a, b = 1, ...c)` → 1) ✅[^1] ✅[^4]. A named function expression (`function inner(n) { … inner(n-1) }`) can call itself by a name invisible outside ✅[^1] ✅[^4].
4. **`new Function(args, body)`** compiles a string at run time; its scope is the global environment, so it cannot see the creator's local variables ✅[^1] ✅[^5].
5. **Timers.**
   - `setTimeout(fn, ms, ...args)` runs `fn` once after at least `ms` ms; `setInterval` repeats; both return an id for `clearTimeout`/`clearInterval` — an object with `ref`/`unref` in Node ✅[^1] ✅[^6] ✅[^9].
   - A zero-delay timer still waits for the current script: after 50 ms of synchronous work the `setTimeout(…, 0)` callback ran only once the work had finished ✅[^1] ✅[^6].
   - Browsers clamp nested timers to at least 4 ms after five levels of nesting ✅[^6] ✅[^8]; Node sets delays below 1 ms to 1 ✅[^9].
   - Nested `setTimeout` gives a fixed gap *between* runs, while `setInterval` counts from each start ✅[^6].
6. **Decorators with `call`/`apply`.** A wrapper must forward `this` and arguments: `function (...args) { return func.apply(this, args) }`. Borrowing a method works the same way: `[].join.call(arguments, '-')` gives `'1-2-3'` ✅[^1] ✅[^7]. Common decorators are caching, spying, debounce and throttle ✅[^7].
7. **`bind`.** Returns a new function with `this` fixed forever and optional preset leading arguments (partial application: `mul.bind(null, 2)` doubles) ✅[^1] ✅[^10].
8. **Arrow functions revisited.** No own `this`, `arguments` or `super`; they cannot be called with `new` (`TypeError`) ✅[^1] ✅[^11].

## Worked example
A caching decorator for a method:

| Step | Code | Result |
|---|---|---|
| 1 | `const worker = { slow(x) { return x * this.factor }, factor: 2 }` | — |
| 2 | Wrapper that loses `this`: `cache = new Map(); return x => cache.get(x) ?? func(x)` | `worker.slow(3)` throws `TypeError: Cannot read properties of undefined (reading 'factor')` — `this` was lost ✅[^1] |
| 3 | Correct wrapper: `return function (x) { if (!cache.has(x)) cache.set(x, func.call(this, x)); return cache.get(x); }` | — |
| 4 | `worker.slow = cachingDecorator(worker.slow); worker.slow(3)` | `6` ✅[^1] |
| 5 | `worker.slow(3)` again | `6` from the cache; the original ran only once ✅[^1] |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `bind` twice | First binding wins | A bound function has a fixed `this` ✅[^1] |
| `setTimeout(obj.method, 100)` | `this` lost | Method detached from its object ✅[^6] |
| `new Function` reading a local | `undefined` / `ReferenceError` | Global scope only ✅[^1] |
| Recursion over a 100 000-node linked list | `RangeError` risk | Stack depth limit ✅[^2] |
| `arguments` inside an arrow | Belongs to the enclosing function | Arrows have no own `arguments` ✅[^11] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Recursion | Natural for trees and nested data | Stack depth limit; per-call overhead |
| Loop | Constant stack | Harder for tree-shaped data |
| `bind` | Fixed `this`, partials | New function per bind; cannot be rebound |
| Arrow wrapper `() => obj.m()` | Always uses the current `obj.m` | Re-reads `obj` at call time |

## Takeaways
- In wrappers, forward `this` and all arguments with `func.apply(this, args)` or `func.call(this, ...args)`. [rule-candidate]
- Treat timer delays as minimums, never as exact schedules.
- Prefer loops for very deep or unbounded recursion.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 39 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- `linux/lab-setup.md` — the Node 24.22.1 lab where every behaviour marked with this note ran on 2026-11-04. [^1]
- [Recursion and stack](https://javascript.info/recursion) — javascript.info, living. Backs: execution context stack, depth limit, recursion versus loops. [^2]
- [Rest parameters and spread syntax](https://javascript.info/rest-parameters-spread) — javascript.info, living. Backs: rest, `arguments`, spread. [^3]
- [Function object, NFE](https://javascript.info/function-object) — javascript.info, living. Backs: `name`, `length`, custom properties, named function expressions. [^4]
- [The "new Function" syntax](https://javascript.info/new-function) — javascript.info, living. Backs: run-time compilation and global scope. [^5]
- [Scheduling: setTimeout and setInterval](https://javascript.info/settimeout-setinterval) — javascript.info, living. Backs: timer API, zero delay, nested versus interval, browser 4 ms clamp. [^6]
- [Decorators and forwarding, call/apply](https://javascript.info/call-apply-decorators) — javascript.info, living. Backs: forwarding `this`, method borrowing, caching decorator. [^7]
- [HTML Standard: timers](https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html) — WHATWG, living. Backs: nested-timer clamping to 4 ms. [^8]
- [Timers](https://nodejs.org/api/timers.html) — Node.js documentation, v24. Backs: `Timeout` object with `ref`/`unref`; delays below 1 become 1. [^9]
- [Function binding](https://javascript.info/bind) — javascript.info, living. Backs: `bind`, fixed `this`, partial functions. [^10]
- [Arrow functions revisited](https://javascript.info/arrow-functions) — javascript.info, living. Backs: no `this`, `arguments`, `super` or `new`. [^11]

## Related
- `javascript/advanced-functions/scope-closures-and-var.md`
- `javascript/misc/proxy-eval-currying-and-reference-type.md` — currying.
