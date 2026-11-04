---
schema: knowledge-doc/v1
type: concept
topic: javascript/data-types
status: verified
applies-to: ["ECMAScript 2025", "Node.js 24"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [javascript, map, set, weakmap, weakset, object-entries, fromentries, caching, garbage-collection]
---

# Map, Set, WeakMap, WeakSet and object entries

## Summary
**TL;DR:** A plain object converts every key to a string, so it is a poor dictionary for non-string keys. **`Map`** keeps keys of any type (objects, numbers, `NaN`) with their identity, remembers insertion order and has a `size`. **`Set`** stores unique values in insertion order. **`WeakMap`/`WeakSet`** accept only objects as keys and do not keep them alive, so entries vanish when the key object is garbage-collected — ideal for caches and per-object metadata; the price is no iteration and no `size`. `Object.entries`/`Object.fromEntries` bridge plain objects and these key-value tools.
**Use this when:** you need a dictionary with non-string keys, deduplication, metadata attached to objects you do not own, or a cache that must not leak memory.
**Not this doc:** the garbage collector itself → `javascript/object-basics/objects-references-and-this.md`; `WeakRef` → `javascript/misc/bigint-unicode-and-weakrefs.md`.

## Problem
Using objects as keys in a plain object silently collapses them all into the key `"[object Object]"`. A cache in a regular `Map` keyed by DOM nodes or request objects keeps them alive forever and leaks memory.

## Mental model
**Analogy:** a plain object is a filing cabinet whose labels must be written as text — two different people both get filed under "person". A `Map` files the actual person. A `WeakMap` is a coat check that throws the coat away once its owner has left the building.

**Artifact:** the plain-object key collapse versus `Map`, in Node 24 ✅[^1]:
```js
const o = {}, a = {}, b = { x: 1 };
o[a] = 1; o[b] = 2;
Object.keys(o)        // ['[object Object]'] — one key; o[a] is now 2
const m = new Map(); const k = {};
m.set('1', 's').set(1, 'n').set(k, 'o');
[m.get(1), m.get('1'), m.get(k), m.size]   // ['n', 's', 'o', 3]
```

## How it works
1. **`Map`.** `set` returns the map (chainable), `get`, `has`, `delete`, `clear`, `size`. Keys are compared with SameValueZero, so `NaN` works as a key ✅[^1] ✅[^2]. Iteration (`keys`, `values`, `entries`, `for…of`) follows insertion order ✅[^1] ✅[^2].
2. **`Set`.** `add` ignores duplicates: `new Set(['b','a','b','c','a'])` iterates `b, a, c` ✅[^1] ✅[^2]. Node 24 also has set algebra such as `intersection` and `union` ✅[^1] ✅[^5].
3. **Converting.** `new Map(Object.entries(obj))` and `Object.fromEntries(map)` convert in both directions ✅[^2]. To transform a plain object, go through entries: double every price with `Object.fromEntries(Object.entries(prices).map(([k, v]) => [k, v * 2]))` ✅[^1] ✅[^3].
4. **`Object.keys/values/entries`** return arrays (not iterators, unlike `map.keys()`) and skip symbol keys ✅[^3].
5. **Weak collections.**
   - `WeakMap` keys must be objects; `new WeakMap().set('k', 1)` throws `TypeError` ✅[^1] ✅[^4].
   - The entry does not keep its key reachable; once nothing else references the key, the entry can be collected ✅[^4].
   - There is no iteration and no `size` (`w.keys` is `undefined`), because contents depend on when the collector runs ✅[^1] ✅[^4].

## Worked example
Count visits per user object without leaking users who log out:

| Step | Code | State |
|---|---|---|
| 1 | `const visits = new WeakMap()` | empty |
| 2 | `let john = {name: 'John'}; visits.set(john, (visits.get(john) ?? 0) + 1)` | John → 1 |
| 3 | Another visit | John → 2 |
| 4 | `john = null` (user logs out, no other references) | Entry is eligible for collection with the object ✅[^4] |
| 5 | Same code with `Map` | The entry and `john`'s object stay in memory until removed by hand ✅[^4] |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `map[key] = v` instead of `map.set` | Creates a plain property, not a map entry | Square brackets use the object, not the `Map` API ✅[^2] |
| `new Map([[NaN, 1]]).get(NaN)` | `1` | SameValueZero ✅[^1] |
| Primitive key in `WeakMap` | `TypeError` | Primitives cannot be collected individually ✅[^1] |
| Need size or keys of a weak collection | Not available | Non-deterministic contents ✅[^4] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Plain object | JSON-friendly, literal syntax | String/symbol keys only; prototype keys may clash |
| `Map` | Any key type, ordered, `size`, fast add/delete | Not JSON-serializable without conversion |
| `WeakMap` | No leaks for object-keyed metadata | Object keys only; no iteration |

## Takeaways
- Use `Map` when keys are not strings or when entries are added and removed often. [rule-candidate]
- Use `WeakMap` for caches and metadata keyed by objects whose lifetime you do not control. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 24 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- `linux/lab-setup.md` — the Node 24.22.1 lab where every behaviour marked with this note ran on 2026-11-04. [^1]
- [Map and Set](https://javascript.info/map-set) — javascript.info, living. Backs: Map/Set API, ordering, key comparison, conversions. [^2]
- [Object.keys, values, entries](https://javascript.info/keys-values-entries) — javascript.info, living. Backs: array results, transforming through entries. [^3]
- [WeakMap and WeakSet](https://javascript.info/weakmap-weakset) — javascript.info, living. Backs: object-only keys, collection semantics, no iteration, caching use. [^4]
- [Set](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set) — MDN, living. Backs: set composition methods such as `intersection` and `union`. [^5]

## Related
- `javascript/data-types/arrays-and-iterables.md`
- `algorithms/data-structures/hash-tables.md` — how hash maps work underneath.
