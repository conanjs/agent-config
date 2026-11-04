---
schema: knowledge-doc/v1
type: concept
topic: javascript/object-basics
status: verified
applies-to: ["ECMAScript 2025", "Node.js 24"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [javascript, symbol, symbol-for, well-known-symbols, toprimitive, valueof, tostring, type-conversion]
---

# Symbols and object-to-primitive conversion

## Summary
**TL;DR:** A **symbol** is a unique primitive used as a "hidden" property key: it does not collide with string keys, and `for…in`, `Object.keys` and `JSON.stringify` skip it. `Symbol.for(name)` returns one shared symbol per name from a global registry. Built-in **well-known symbols** (`Symbol.iterator`, `Symbol.toPrimitive`, …) let objects hook into language features. When an object is used where a primitive is needed, JavaScript calls `obj[Symbol.toPrimitive](hint)` with hint `"string"`, `"number"` or `"default"`, or falls back to `toString`/`valueOf` in an order set by the hint.
**Use this when:** adding metadata to objects you do not own, designing an object that prints or compares meaningfully, or explaining why `obj + 1` gives a strange string.
**Not this doc:** iteration via `Symbol.iterator` → `javascript/data-types/arrays-and-iterables.md`; operators in general → `javascript/fundamentals/operators-and-comparisons.md`.

## Problem
Libraries that add a property named `id` to shared objects can overwrite each other's data. Objects in templates print `[object Object]`; `date1 - date2` gives a number but `date + 1` a string. Both are solved by understanding symbols and the conversion protocol.

## Mental model
**Analogy:** a symbol is a key cut for one lock only; two keys with the same label ("id") are still different keys. `Symbol.for('app')` is the key cabinet at reception — anyone asking for "app" gets the same key. The conversion hint is the question the language asks the object: "as text?", "as a number?", or "you choose".

**Artifact:** which hint each operation passes, recorded in Node 24 ✅[^1]:
```js
const o = { [Symbol.toPrimitive](hint) { seen.push(hint); return hint === 'number' ? 42 : 'str'; } };
`${o}`;  +o;  o + '';  o < 1;
seen   // ['string', 'number', 'default', 'number']
```

## How it works
1. **Creating symbols.** `Symbol('id')` makes a new unique value each call; the text is only a description (`sym.description`) ✅[^1] ✅[^2]. `Symbol('a') === Symbol('a')` is false ✅[^1].
2. **Hidden keys.** Symbol-keyed properties are skipped by `for…in`, `Object.keys` and `JSON.stringify`, but `Object.getOwnPropertySymbols` lists them and `Object.assign` copies them ✅[^1] ✅[^2].
3. **Global registry.** `Symbol.for('app')` returns the same symbol everywhere; `Symbol.keyFor` gives its name back, and returns `undefined` for non-registry symbols ✅[^1] ✅[^2].
4. **Well-known symbols.** The language reads properties such as `Symbol.iterator`, `Symbol.toPrimitive`, `Symbol.hasInstance` and `Symbol.toStringTag` to customize iteration, conversion, `instanceof` and `Object.prototype.toString` ✅[^2] ✅[^4].
5. **Conversion protocol.**
   - **Hint choice:** `"string"` for template literals and `String(o)`; `"number"` for unary `+`, arithmetic other than `+` and `<`/`>`; `"default"` for binary `+` and `==` ✅[^1] ✅[^3].
   - **Lookup:** if `Symbol.toPrimitive` exists it is called and must return a primitive. Otherwise, for `"string"` try `toString` then `valueOf`; for the other hints try `valueOf` then `toString` ✅[^3] ✅[^4].
   - **Defaults:** a plain object's `toString` returns `"[object Object]"` and its `valueOf` returns the object itself (ignored), so `{} + ''` is `"[object Object]"` ✅[^1] ✅[^3].
   - **Dates:** `Date` treats `"default"` as `"string"`, so `date + 1` is a string while `date - 1` is a number ✅[^1].

## Worked example
A `Money` object that prints and compares naturally:

| Step | Code | Result (lab) |
|---|---|---|
| 1 | `const m = { cents: 1250, toString() { return '$12.50' }, valueOf() { return this.cents } }` | — |
| 2 | `String(m)` / `` `${m}` `` | `'$12.50'` — string hint uses `toString` first ✅[^1] |
| 3 | `m + 1` | `1251` — default hint uses `valueOf` first ✅[^1] |
| 4 | `m * 2` | `2500` — number hint ✅[^1] |
| 5 | `m > otherMoney` | Compares cents ✅[^3] |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `[1, 2] + [3]` | `"1,23"` | Arrays convert via `toString` (`join`) ✅[^1] |
| `toPrimitive` returns an object | `TypeError` | It must return a primitive ✅[^3] |
| Symbol key in `JSON.stringify` | Omitted | Symbols are not JSON ✅[^1] |
| `String(Symbol('x'))` | `"Symbol(x)"`; implicit `'' + sym` throws | Symbols refuse implicit string conversion ✅[^1] ✅[^2] |

## Takeaways
- Use symbols for library metadata on objects you do not own; use `Symbol.for` only when separate code must share the key.
- Implement `Symbol.toPrimitive` (or `toString`/`valueOf`) only when an object has one obvious primitive meaning; otherwise convert explicitly.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 26 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- `linux/lab-setup.md` — the Node 24.22.1 lab where every behaviour marked with this note ran on 2026-11-04. [^1]
- [Symbol type](https://javascript.info/symbol) — javascript.info, living. Backs: uniqueness, hidden keys, global registry, system symbols. [^2]
- [Object to primitive conversion](https://javascript.info/object-toprimitive) — javascript.info, living. Backs: hints, lookup order, plain-object defaults. [^3]
- [Symbol.toPrimitive](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/toPrimitive) — MDN, living. Backs: hint values and the primitive return requirement. [^4]

## Related
- `javascript/object-basics/objects-references-and-this.md`
- `javascript/classes/class-features-and-type-checks.md` — `Symbol.hasInstance` and `Symbol.toStringTag` in use.
