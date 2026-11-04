---
schema: deep-dive/v1
topic: javascript/introduction
status: verified
applies-to: ["ECMAScript 2015–2025 editions, plus finished proposals expected in 2026 and 2027", "Node.js 24.22.1 (V8 13.6) support status"]
last-updated: 2026-11-04
last-verified: 2026-11-04
synthesized-into: []
tags: [javascript, ecmascript, es2015, es6, es2025, tc39, proposals, feature-support, modern-idioms, using, iterator-helpers, set-methods]
---

# Modern JavaScript by edition, ES2015 to ES2025 and beyond

## Summary
**TL;DR:** Since 2015 JavaScript has shipped one specification edition per year (ES2015 = "ES6", then ES2016 … ES2025). ES2015 was the big rewrite — `let`/`const`, arrows, classes, modules, promises, iterators and generators, `Map`/`Set`, symbols, destructuring, Proxy. Every later edition is small: a feature joins it once it reaches **stage 4** of the TC39 process. Node.js 24 supports everything through ES2025 except proper tail calls, plus several features scheduled for 2026 and 2027 (`using` declarations, `Error.isError`, `Array.fromAsync`), but not yet `Temporal`, `Math.sumPrecise` or base64 helpers. Most "modern JavaScript" books are lists of these features plus the idioms they replace; this dive is that list, verified.
**Use this when:** you need to know which edition introduced a feature, whether your runtime has it, what older pattern it replaces, or how a feature becomes standard.
**Depth:** the TC39 stage process; every edition's features in one table with Node 24 status measured; ES2015 in detail; finished proposals expected in 2026/2027 with status; an old-idiom → modern-idiom catalogue verified in the lab; `using`/`DisposableStack`, iterator helpers and Set methods in detail; how to check support. ✅[^2] marks a Node 24.22.1 lab result.

## 1. How a feature becomes JavaScript

TC39 (Ecma's technical committee 39) moves proposals through stages 0 → 4. **Stage 4 ("finished")** requires two shipping implementations and tests in the shared conformance suite; finished proposals go into the next yearly edition, published around June ✅[^1] ✅[^3]. The TC39 finished-proposals list therefore gives each feature an *expected publication year* — the same year as its edition name ✅[^1].

**Analogy:** proposals are bills in a parliament; stage 4 is the final vote, and the yearly edition is the printed law book.

## 2. Every edition at a glance (with Node 24 status)

| Edition | Main features | Node 24 |
|---|---|---|
| **ES2015** | `let`/`const`, arrow functions, classes, template literals, destructuring, default/rest/spread parameters, modules, `Promise`, iterators and `for…of`, generators, `Map`/`Set`/`WeakMap`/`WeakSet`, `Symbol`, `Proxy`/`Reflect`, typed arrays, `new.target` | yes ✅[^2]; **proper tail calls: no** (`RangeError` at depth 10⁶) ✅[^2] |
| ES2016 | `**`, `Array.prototype.includes` | yes ✅[^2] |
| ES2017 | `async`/`await`, `Object.values`/`entries`, `getOwnPropertyDescriptors`, `padStart`/`padEnd`, trailing commas in calls, `SharedArrayBuffer`/`Atomics` | yes ✅[^2] |
| ES2018 | Async iteration (`for await`), `Promise.prototype.finally`, object rest/spread, regex named groups, lookbehind, `s` flag, `\p{…}` | yes ✅[^2] |
| ES2019 | `flat`/`flatMap`, `Object.fromEntries`, `trimStart`/`trimEnd`, optional `catch` binding, `Symbol.prototype.description`, well-formed `JSON.stringify` | yes ✅[^2] |
| ES2020 | `?.`, `??`, `BigInt`, `globalThis`, dynamic `import()`, `import.meta`, `matchAll`, `Promise.allSettled` | yes ✅[^2] |
| ES2021 | `\|\|=`, `&&=`, `??=`, numeric separators `1_000`, `WeakRef`/`FinalizationRegistry`, `Promise.any`, `replaceAll` | yes ✅[^2] |
| ES2022 | Class fields, private `#x` members, static blocks, `#x in obj`, `.at()`, `Object.hasOwn`, `Error` `cause`, top-level `await`, regex `d` flag | yes ✅[^2] |
| ES2023 | `toSorted`/`toReversed`/`toSpliced`/`with`, `findLast`/`findLastIndex`, hashbang `#!`, symbols as `WeakMap` keys | yes ✅[^2] |
| ES2024 | `Object.groupBy`/`Map.groupBy`, `Promise.withResolvers`, regex `v` flag, resizable and transferable `ArrayBuffer`, `isWellFormed`/`toWellFormed`, `Atomics.waitAsync` | yes ✅[^2] |
| ES2025 | `Set` methods (`union`, `intersection` …), iterator helpers (`Iterator.prototype.map/filter/take…`), `RegExp.escape`, regex modifiers `(?i:…)`, duplicate named groups, `Promise.try`, `Float16Array`/`Math.f16round`, import attributes and JSON modules | yes ✅[^2] |

Feature lists: TC39 finished proposals ✅[^1]; ES2015 contents: You Don't Know JS *ES6 & Beyond* ✅[^4] and MDN ✅[^5].

A measurement trap found on the way: testing hashbang support with `new Function('#!…')` reports *no*, because a hashbang is only legal as the first characters of a script or module file; a real file with `#!/usr/bin/env node` runs fine ✅[^2].

## 3. ES2015 in more detail

| Area | Features | Deep coverage |
|---|---|---|
| Declarations and scope | `let`, `const`, block scope, TDZ | `javascript/advanced-functions/scope-and-closures-deep-dive.md` |
| Syntax | Arrows, template and tagged literals, destructuring, default/rest/spread, shorthand and computed properties, `for…of` | `javascript/fundamentals/`, `javascript/data-types/destructuring-dates-and-json.md` |
| Organization | Modules, classes with `extends`/`super` | `javascript/modules/es-modules.md`, `javascript/classes/` |
| Async | `Promise`, generators | `javascript/async/`, `javascript/generators-iterators/` |
| Collections and meta | `Map`/`Set`/weak collections, `Symbol`, iterators, `Proxy`/`Reflect`, typed arrays | `javascript/data-types/`, `javascript/misc/` |

✅[^4]

## 4. Finished proposals expected in 2026 and 2027

Status in Node 24.22.1 (V8 13.6), measured by feature detection ✅[^2]; years from the TC39 list ✅[^1]:

| Expected year | Feature | Node 24 |
|---|---|---|
| 2026 | `Error.isError` (reliable error check across realms) | yes — `Error.isError(new TypeError())` true, a look-alike object false |
| 2026 | `Array.fromAsync` | yes — collected `[1, 2]` from an async generator |
| 2026 | `JSON.parse` source text access (`JSON.rawJSON`) | yes |
| 2026 | `Math.sumPrecise` | no |
| 2026 | `Uint8Array` to/from base64 | no |
| 2026 | Upsert (`Map.prototype.getOrInsert`) | no |
| 2026 | Iterator sequencing (`Iterator.concat`) | no |
| 2027 | Explicit resource management (`using`, `DisposableStack`) | yes |
| 2027 | `Atomics.pause` | yes |
| 2027 | `Temporal` (modern date/time API) | no |
| 2027 | Joint iteration (`Iterator.zip`) | no |

## 5. Old idiom → modern idiom (verified)

| Old pattern | Modern replacement | Edition | Lab |
|---|---|---|---|
| `var` | `const` / `let` | 2015 | ✅[^2] |
| `'a' + x + 'b'` | ``a${x}b`` | 2015 | ✅[^2] |
| `arguments`, `fn.apply(null, arr)` | `...rest`, `fn(...arr)` | 2015 | ✅[^2] |
| Callback pyramids, `.then` chains | `async`/`await` | 2017 | ✅[^2] |
| `Object.assign({}, o)` | `{...o}` | 2018 | ✅[^2] |
| `arr.indexOf(x) !== -1` | `arr.includes(x)` (also finds `NaN`) | 2016 | ✅[^2] |
| `x \|\| def` for "missing" | `x ?? def` | 2020 | ✅[^2] |
| `a && a.b && a.b.c` | `a?.b?.c` | 2020 | ✅[^2] |
| `o.a = o.a \|\| 5` | `o.a \|\|= 5` (right side evaluated only when needed: 1 of 2 side effects ran) | 2021 | ✅[^2] |
| `arr[arr.length - 1]` | `arr.at(-1)` (strings too) | 2022 | ✅[^2] |
| `Object.prototype.hasOwnProperty.call(o, k)` | `Object.hasOwn(o, k)` | 2022 | ✅[^2] |
| `arr.slice().sort()` | `arr.toSorted()`; also `toSpliced`, `with` (original `[3,1,2]` unchanged) | 2023 | ✅[^2] |
| Hand-written group-by `reduce` | `Object.groupBy` / `Map.groupBy` | 2024 | ✅[^2] |
| Deferred pattern `let res; new Promise(r => res = r)` | `Promise.withResolvers()` | 2024 | ✅[^2] |
| Hand-written set algebra | `a.union(b)`, `intersection`, `difference`, `symmetricDifference`, `isSubsetOf` | 2025 | ✅[^2] |
| Eager `arr.filter().map()` on huge or infinite sources | Lazy iterator helpers: `nat().filter(odd).map(x10).take(3).toArray()` → `[10,30,50]`, generating only 6 values | 2025 | ✅[^2] |
| `try { … } finally { r.close() }` | `using r = …` (§6) | 2027 (shipped) | ✅[^2] |

## 6. `using` and `DisposableStack`

`using x = resource` calls `x[Symbol.dispose]()` when the enclosing block exits — normally or by an exception — in **reverse declaration order** ✅[^6]:

| Case | Lab result |
|---|---|
| `using a`, `using b`, then the block body | `body`, `dispose b`, `dispose a` ✅[^2] |
| Block throws | `disposed` runs before the `catch` sees the error ✅[^2] |
| `DisposableStack` with two `defer` callbacks | Run in reverse: `deferred 2`, `deferred 1` ✅[^2] |

`await using` does the same with `Symbol.asyncDispose` for async cleanup ✅[^6].

## 7. Checking support in your environment

1. Look up the feature on MDN; each page has a browser-compatibility table ✅[^5].
2. For Node, check the V8 version (`process.versions.v8` — `13.6` for Node 24.22.1) and test with feature detection, as this lab did ✅[^2].
3. For older targets, transpile syntax and polyfill APIs (`javascript/code-quality/writing-and-testing-code.md`).

## 8. How this deep dive was built
- **Sources:** the TC39 finished-proposals list (authoritative feature-to-year mapping), MDN, the ECMAScript specification, and You Don't Know JS *ES6 & Beyond* (1st ed.) for ES2015. It covers the subjects of the "modern JavaScript" books (ES-next surveys and idiom guides) from these open sources only.
- **Verified:** `node:24.22.1-alpine` on 2026-11-04 — lab files `es.mjs` (feature detection by edition), `hb.mjs` (hashbang recheck), `idioms.mjs` (idioms, `using`, iterator helpers, Set methods).

## References
- [TC39 finished proposals](https://github.com/tc39/proposals/blob/main/finished-proposals.md) — Ecma TC39, living. Backs: each feature's edition (expected publication year), stage-4 status. [^1]
- `linux/lab-setup.md` — the Node.js 24.22.1 lab where every ✅[^2] result was produced on 2026-11-04. [^2]
- [The TC39 Process](https://tc39.es/process-document/) — Ecma TC39, living. Backs: stages 0–4 and the stage-4 criteria. [^3]
- [You Don't Know JS: ES6 & Beyond](https://github.com/getify/You-Dont-Know-JS/blob/1st-ed/es6%20%26%20beyond/README.md) — Kyle Simpson, 1st ed., CC BY-NC-ND 4.0. Backs: ES2015 feature set. [^4]
- [JavaScript reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference) — MDN, living. Backs: per-feature documentation and compatibility tables. [^5]
- [using](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/using) — MDN, living. Backs: disposal at block exit, reverse order, `await using`. [^6]
- [ECMAScript Language Specification](https://tc39.es/ecma262/) — Ecma TC39, living. Background: the current draft.

## Related
- `javascript/introduction/engines-specs-and-tools.md`
- `javascript/learning-path.md`
