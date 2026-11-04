---
schema: knowledge-doc/v1
type: reference
topic: javascript/data-types
status: verified
applies-to: ["ECMAScript 2025", "Node.js 24"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [javascript, array, splice, slice, sort, reduce, map, filter, iterable, symbol-iterator, array-from, array-like]
---

# Arrays, array methods and the iteration protocol

## Summary
**TL;DR:** Arrays are ordered, zero-indexed objects with a `length` that is one more than the highest index. This doc lists the core operations (`push`/`pop` fast, `shift`/`unshift` slow), the mutating versus copying methods (`splice` vs `slice`, `sort` vs `toSorted`), the search and transform methods, and the **iteration protocol** (`Symbol.iterator` returning `{next()}`) that makes `for…of`, spread and `Array.from` work — with each result measured in Node 24.
**Use this when:** choosing an array method, predicting its result or whether it mutates, or making your own object iterable.
**Not this doc:** `Map`/`Set` → `javascript/data-types/maps-sets-and-weak-collections.md`; generators as an easier way to write iterators → `javascript/generators-iterators/generators-and-async-iteration.md`.

## Scope
`Array` and the iteration protocol in ECMAScript 2025 / Node 24.22.1, measured on 2026-11-04 ✅[^1].

## Catalog

### Basics ✅[^1] ✅[^2]

| Code | Result | Note |
|---|---|---|
| `a=[1,2,3]; a.push(4); a.unshift(0); a.pop(); a.shift()` | `a` back to `[1,2,3]`; pop → 4, shift → 0 | `push`/`pop` work at the end (fast); `shift`/`unshift` renumber every element (slow) |
| `b=[]; b[5]=1; b.length` | `6` | `length` is highest index + 1 |
| `c=[1,2,3,4]; c.length=2` | `[1,2]` | Shrinking `length` truncates |
| `new Array(3).length`, `String(new Array('3'))` | `3`, `'3'` | One numeric argument means a length; avoid `new Array` |
| `[1,,3].length`, `1 in [1,,3]` | `3`, `false` | Holes are missing indexes |
| `String([1,[2,[3]]])` | `'1,2,3'` | `toString` joins with commas |
| `[] == []`, `0 == []`, `'0' == []` | `false`, `true`, `false` | Arrays compare by reference; with `==` against primitives they convert to strings |

### Mutating versus copying ✅[^1] ✅[^3]

| Code | Result | Mutates? |
|---|---|---|
| `a=[1,2,3,4,5]; a.splice(1, 2, 'x')` | returns `[2,3]`; `a` is `[1,'x',4,5]` | yes |
| `[1,2,3,4].slice(-2)` | `[3,4]` | no |
| `[1].concat([2,3],[[4]]).length` | `4` | no (nested arrays added as one element) |
| `[1,15,2].sort()` | `[1,15,2]` | yes — default sort compares as **strings** |
| `[1,15,2].sort((a, b) => a - b)` | `[1,2,15]` | yes |
| `[3,1].toSorted()` | `[1,3]`, original unchanged | no |
| `[1,2,3].with(0, 9)` | `[9,2,3]` | no |
| Stable sort of `{k:1,'a'},{k:0,'b'},{k:1,'c'}` by `k` | `b, a, c` | Equal keys keep their order |

### Searching ✅[^1] ✅[^3]

| Code | Result | Note |
|---|---|---|
| `[1,NaN].indexOf(NaN)`, `[1,NaN].includes(NaN)` | `-1`, `true` | `indexOf` uses `===`; `includes` uses SameValueZero |
| `[1,2,3].find(x => x > 1)`, `[1,2,3].findIndex(x => x > 5)` | `2`, `-1` | — |
| `[1,2,3,2].findLastIndex(x => x === 2)` | `3` | — |

### Transforming ✅[^1] ✅[^3]

| Code | Result |
|---|---|
| `[1,2,3].map(x => x * 2)` | `[2,4,6]` |
| `[1,2].forEach(x => x)` | `undefined` — use `map` for results |
| `'a,b,c'.split(',', 2)` | `['a','b']` |
| `[1,2,3].reduce((s, x) => s + x, 0)` | `6` |
| `[].reduce((a, b) => a + b)` | `TypeError: Reduce of empty array with no initial value` |
| `[1,[2,[3]]].flat(Infinity)`, `[1,2].flatMap(x => [x, x])` | `[1,2,3]`, `[1,1,2,2]` |
| `Object.groupBy([1,2,3], x => x % 2 ? 'odd' : 'even')` | `{odd:[1,3], even:[2]}` |
| `Array.isArray([])`, `typeof []` | `true`, `'object'` |

### Iteration protocol ✅[^1] ✅[^4] ✅[^5]

| Code | Result | Note |
|---|---|---|
| Object `range` with `[Symbol.iterator]()` returning `{ next() }` | `[...range]` → `[1,2,3,4]` | `next()` returns `{done, value}` |
| `Array.from(range, x => x * x)` | `[1,4,9,16]` | Optional map function |
| `Array.from({length: 2, 0: 'a', 1: 'b'})` | `['a','b']` | Works on array-likes too |
| `for (const x of {length: 1, 0: 'a'})` | `TypeError: … is not iterable` | Array-like ≠ iterable |
| `Array.prototype.map.call('ab', c => c + c)` | `['aa','bb']` | Borrowing array methods for array-likes |
| `[...new Map([['a', 1]])]` | `[['a', 1]]` | Maps iterate `[key, value]` pairs |

## Lookup notes
- Always pass a comparator to `sort` for numbers ✅[^3].
- `for…of` iterates values; `for…in` iterates keys including inherited ones — do not use `for…in` on arrays ✅[^2].
- An **iterable** has `Symbol.iterator`; an **array-like** has indexes and `length`. Strings are both; `{length, 0: …}` is only array-like ✅[^4].

## Takeaways
- Prefer the copying variants (`toSorted`, `toReversed`, `with`, `slice`) when the original must stay unchanged.
- Give `reduce` an initial value so empty arrays do not throw. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 15 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- `linux/lab-setup.md` — the Node 24.22.1 lab where every value in the catalog was produced on 2026-11-04. [^1]
- [Arrays](https://javascript.info/array) — javascript.info, living. Backs: `length`, push/pop versus shift/unshift performance, `new Array`, `for…in` warning. [^2]
- [Array methods](https://javascript.info/array-methods) — javascript.info, living. Backs: splice, slice, concat, search, map, sort, split, reduce. [^3]
- [Iterables](https://javascript.info/iterable) — javascript.info, living. Backs: `Symbol.iterator`, iterables versus array-likes, `Array.from`. [^4]
- [Iteration protocols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols) — MDN, living. Backs: iterator result shape. [^5]

## Related
- `javascript/data-types/maps-sets-and-weak-collections.md`
- `algorithms/fundamentals/amortized-analysis.md` — why `push` is cheap on average.
