---
schema: deep-dive/v1
topic: javascript/advanced-functions
status: verified
applies-to: ["ECMAScript 2025", "Node.js 24 (V8)"]
last-updated: 2026-11-04
last-verified: 2026-11-04
synthesized-into: []
tags: [javascript, functional-programming, pure-functions, higher-order-functions, composition, currying, partial-application, immutability, memoization, trampoline, functor, maybe, either, point-free]
---

# Functional programming in JavaScript, end to end

## Summary
**TL;DR:** Functional programming (FP) in JavaScript rests on three language facts — functions are values, closures capture state, and arrays have `map`/`filter`/`reduce` — and on a discipline: write **pure functions** (same input → same output, no side effects), avoid mutation, and build programs by **composing** small functions. Currying and partial application make functions fit together; containers such as `Maybe` and `Either` push the handling of missing values and errors into the composition. JavaScript does not enforce any of it: mutating built-ins (`sort`), shallow `Object.freeze`, the extra index argument passed by `map`, and the absence of tail-call optimization are the traps, each with a known fix.
**Use this when:** you want the reasoning and the exact JavaScript behaviour behind FP techniques, are refactoring loops into pipelines, deciding how far to take FP in a codebase, or reading functional-JavaScript books and want a verified, open-source-based companion.
**Depth:** purity and referential transparency; first-class and higher-order functions; the map/filter/reduce trio; composition (`compose`/`pipe`) and its laws; currying, partial application and data-last design; point-free style and its pitfalls; memoization; immutability and structural sharing; recursion without tail calls (trampolines); functors, `Maybe` and `Either`; measured cost of chains versus loops versus lazy iterator helpers; a failure matrix. Every ✅[^2] row ran in Node.js 24.22.1.

## 1. Purity

A **pure function** returns the same result for the same arguments and has no observable side effects (no I/O, no mutation of outside state) ✅[^3]. Pure calls are **referentially transparent**: a call can be replaced by its value ✅[^3].

| Function | Same input twice | Lab |
|---|---|---|
| `x => x + 1` | equal | ✅[^2] |
| `x => x + (++counter)` (reads and changes outer state) | different | ✅[^2] |
| `a.sort()` | **mutates `a`** and returns the same array object | ✅[^2] |
| `a.toSorted()` | returns a new sorted array, `a` unchanged | ✅[^2] |

Why it pays: pure functions are cacheable, testable without setup, safe to run in parallel and easy to reason about ✅[^3]. Real programs still need effects; the usual architecture keeps a **functional core** and pushes effects to the edges (`software-design/functional-modeling/functional-core.md`).

## 2. Functions as values

- **First-class functions:** functions can be stored, passed and returned like any value ✅[^4] ✅[^5]. `greaterThan(10)` returns a new function `m => m > 10` that remembers `n` through a closure ✅[^2].
- **Higher-order functions** take or return functions; they let you abstract *actions*, not just values ✅[^1].
- **Avoid needless wrappers:** `xs.map(x => show(x))` and `xs.map(show)` are the same ✅[^2] ✅[^4] — but see §5 for when the wrapper matters.

## 3. map, filter, reduce

| Method | Role | Returns |
|---|---|---|
| `filter(pred)` | Keep elements | New, shorter array |
| `map(f)` | Transform each element | New array, same length |
| `reduce(f, init)` | Combine into one value | Anything |

`[1,2,3,4,5].filter(odd).map(square).reduce(add, 0)` → 35 ✅[^2] ✅[^1]. Always pass `reduce` an initial value (empty arrays throw otherwise — `javascript/data-types/arrays-and-iterables.md`).

## 4. Composition

`compose(f, g)(x) = f(g(x))` (right to left); `pipe(f, g)(x) = g(f(x))` (left to right, reads in execution order) ✅[^6]. With `inc = x => x + 1` and `dbl = x => x * 2`: `compose(inc, dbl)(5)` → 11, `pipe(inc, dbl)(5)` → 12 ✅[^2]. Composition is **associative** — `compose(f, compose(g, h))` equals `compose(compose(f, g), h)` (lab: true) — so pipelines can be grouped and named freely ✅[^2] ✅[^6].

## 5. Currying, partial application, point-free style

| Technique | Meaning | Lab |
|---|---|---|
| Currying | Turn `f(a, b, c)` into `f(a)(b)(c)`, accepting several at a time too: `add3(1)(2)(3)` and `add3(1)(2, 3)` both 6 | ✅[^2] ✅[^7] |
| Partial application | Fix some arguments now: `((a, b) => a * b).bind(null, 6)(7)` → 42 | ✅[^2] |
| Data-last design | Put the data argument last so curried functions slot into `pipe`: `pipe(filter(x => x > 1), map(x => x * 10))([1,2,3])` → `[20, 30]` | ✅[^2] ✅[^7] |
| Point-free style | Define functions without naming their data (`const process = pipe(trim, toUpper)`) | ✅[^6] |

**The classic point-free trap:** `['1','2','3'].map(parseInt)` → `[1, NaN, NaN]`, because `map` passes `(value, index, array)` and `parseInt` treats the index as a radix ✅[^2]. Wrap functions whose extra parameters mean something: `.map(s => parseInt(s, 10))`. Generic `curry` relies on `fn.length`, which ignores default and rest parameters (`javascript/misc/proxy-eval-currying-and-reference-type.md`).

## 6. Memoization

Caching a pure function's results by argument turns repeated work into lookups: a memoized recursive Fibonacci computed `fib(40)` = 102334155 with 41 underlying calls instead of hundreds of millions ✅[^2]. Only memoize pure functions, and bound the cache (or key it by object identity in a `WeakMap`) to avoid leaks.

## 7. Immutability

| Technique | Behaviour | Lab |
|---|---|---|
| `Object.freeze` | **Shallow**: `s.user.name = 'mutated'` still worked on a frozen `s` | ✅[^2] |
| Copy-on-update `{...s, n: 2}` | Original unchanged; untouched nested objects are **shared** (`next.user === s.user`) | ✅[^2] |
| Structural sharing | A persistent list `cons(1, l1)` reuses `l1` as its tail instead of copying | ✅[^2] |
| Copying array methods | `toSorted`, `toSpliced`, `with` (ES2023) | ✅[^2] |

Sharing is what makes immutable updates cheap; libraries such as Immutable.js generalize it with tries. Design guidance and costs: `software-design/functional-modeling/immutability.md`.

## 8. Recursion without tail calls

FP favours recursion, but V8 does not implement proper tail calls: `sumR(1e6)` written tail-recursively throws `RangeError` ✅[^2]. A **trampoline** returns a thunk instead of recursing and loops until a value comes back; the same sum then returned 500000500000 ✅[^2]. Alternatives: plain loops, or `reduce`.

## 9. Containers: functors, `Maybe`, `Either`

- A **functor** is a container with a `map` that obeys two laws: mapping identity changes nothing, and mapping `f` then `g` equals mapping their composition. `Array.prototype.map` satisfies both (lab: true, true) ✅[^2] ✅[^8].
- **`Maybe`** maps only when a value is present: `Maybe(user).map(u => u.address).map(a => a.street).get('none')` → `'Main'`, and `'none'` for an empty user ✅[^2] ✅[^8]. In everyday JavaScript, `?.` with `??` does the same for property access (`'none'`) ✅[^2].
- **`Either`** carries either a success (`Right`) or a failure (`Left`); `map` skips over a `Left`, and `fold` handles both at the end: parsing `'{"a":1}'` → `'ok 1'`, parsing `'{'` → `'err Expected'` without a `try` in the pipeline ✅[^2] ✅[^9]. Monads (`chain`/`flatMap`) extend this to functions that themselves return containers; `Promise.then` behaves like one for async values ✅[^9]. Related: `error-handling/result-type.md`.

## 10. Cost, measured

Sum of doubled odd numbers over 2 million integers (after warm-up, single run, Apple M2 host) ✅[^2]:

| Style | Time (ms) | Allocations |
|---|---|---|
| `filter().map().reduce()` chain | 35 | Two intermediate arrays |
| One `for…of` loop | 21 | None |
| Lazy iterator helpers `values().filter().map().reduce()` | 48 | No arrays; per-element iterator overhead |

All three gave the same result. Chains cost little at typical sizes; switch to a loop only in measured hot paths, and use lazy helpers when the source is huge or infinite (they avoid building arrays, not CPU time) ✅[^2].

## 11. Failure matrix

| Symptom | Cause | Fix |
|---|---|---|
| A "pure" helper changes its input | Mutating built-in (`sort`, `reverse`, `splice`) | Copying variants, or copy first |
| Frozen state still changes | `Object.freeze` is shallow | Deep-freeze, or keep state updates copy-on-write |
| `map(parseInt)` returns `NaN`s | Extra index argument | Wrap: `s => parseInt(s, 10)` |
| Curried function never completes | `fn.length` ignores defaults/rest | Curry fixed-arity functions only |
| Deep recursion crashes | No tail-call optimization | Trampoline or loop |
| Memoized function returns stale data | Function was impure | Memoize pure functions only |
| Memory grows with a memo cache | Unbounded cache | LRU limit or `WeakMap` keys |

## 12. How this deep dive was built
- **Sources:** Eloquent JavaScript ch. 5 (higher-order functions), *Professor Frisby's Mostly Adequate Guide to Functional Programming* (CC BY-SA 4.0) for purity, currying, composition, functors and monads, MDN, javascript.info (currying). It covers the subjects of the functional-JavaScript books (beginning and mastering FP, functional data structures) from these open sources only.
- **Reconciled with:** the existing `software-design/functional-modeling/` docs, which carry the design view; this dive carries the JavaScript mechanics.
- **Verified:** `node:24.22.1-alpine` on 2026-11-04 (lab file `fp.mjs`).

## References
- [Eloquent JavaScript, ch. 5 "Higher-Order Functions"](https://eloquentjavascript.net/05_higher_order.html) — Marijn Haverbeke, 4th ed. Backs: abstraction with functions, map/filter/reduce, composability. [^1]
- `linux/lab-setup.md` — the Node.js 24.22.1 lab where every ✅[^2] result was produced on 2026-11-04. [^2]
- [Mostly Adequate Guide, ch. 3 "Pure Happiness with Pure Functions"](https://github.com/MostlyAdequate/mostly-adequate-guide/blob/master/ch03.md) — Brian Lonsdorf, CC BY-SA 4.0. Backs: purity, side effects, referential transparency, benefits. [^3]
- [Mostly Adequate Guide, ch. 2 "First Class Functions"](https://github.com/MostlyAdequate/mostly-adequate-guide/blob/master/ch02.md) — Brian Lonsdorf. Backs: functions as values; needless wrappers. [^4]
- [First-class Function](https://developer.mozilla.org/en-US/docs/Glossary/First-class_Function) — MDN, living. Backs: definition. [^5]
- [Mostly Adequate Guide, ch. 5 "Coding by Composing"](https://github.com/MostlyAdequate/mostly-adequate-guide/blob/master/ch05.md) — Brian Lonsdorf. Backs: compose, associativity, point-free style. [^6]
- [Mostly Adequate Guide, ch. 4 "Currying"](https://github.com/MostlyAdequate/mostly-adequate-guide/blob/master/ch04.md) — Brian Lonsdorf. Backs: currying, data-last argument order. [^7]
- [Mostly Adequate Guide, ch. 8 "Tupperware"](https://github.com/MostlyAdequate/mostly-adequate-guide/blob/master/ch08.md) — Brian Lonsdorf. Backs: functors, functor laws, `Maybe`, `Either`. [^8]
- [Mostly Adequate Guide, ch. 9 "Monadic Onions"](https://github.com/MostlyAdequate/mostly-adequate-guide/blob/master/ch09.md) — Brian Lonsdorf. Backs: `chain`/monads; error containers. [^9]
- [Currying](https://javascript.info/currying-partials) — javascript.info, living. Background: curry implementation.

## Related
- `software-design/functional-modeling/` — the design side: functional core, immutability, pipelines, types as rules.
- `javascript/advanced-functions/scope-and-closures-deep-dive.md` — closures underneath.
- `error-handling/result-type.md` — result types in practice.
