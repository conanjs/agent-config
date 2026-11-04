---
schema: knowledge-doc/v1
type: reference
topic: javascript/misc
status: verified
applies-to: ["ECMAScript 2025", "Node.js 24"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [javascript, bigint, unicode, utf-16, surrogate-pairs, code-points, normalize, weakref, finalizationregistry]
---

# BigInt, Unicode strings, WeakRef and FinalizationRegistry

## Summary
**TL;DR:** Lookup tables for three specialised features: **BigInt** (arbitrary-size integers with the `n` suffix, which cannot be mixed with numbers), **Unicode in strings** (UTF-16 code units, surrogate pairs, escapes, normalization) and **`WeakRef`/`FinalizationRegistry`** (a reference that does not keep its target alive, and a callback that *may* run after collection) — with results measured in Node 24.
**Use this when:** working with integers beyond 2⁵³, counting or slicing user-visible characters, comparing strings that look identical, or building a cache that must not prevent garbage collection.
**Not this doc:** number limits → `floating-point/binary-formats.md`; `WeakMap` → `javascript/data-types/maps-sets-and-weak-collections.md`.

## Scope
ECMAScript 2025 `BigInt`, string Unicode handling, `WeakRef` and `FinalizationRegistry` as run in Node 24.22.1 on 2026-11-04 ✅[^1].

## Catalog

### BigInt ✅[^1] ✅[^2]

| Code | Result | Rule |
|---|---|---|
| `typeof 1n` | `'bigint'` | Separate primitive type |
| `2n ** 64n` | `18446744073709551616n` | Exact at any size |
| `5n / 2n` | `2n` | Division truncates toward zero |
| `1n + 1` | `TypeError` | No implicit mixing; convert with `BigInt()` or `Number()` |
| `+1n` | `TypeError` | Unary plus is not supported |
| `Math.max(1n)` | `TypeError` | `Math` works on numbers only |
| `1n == 1`, `1n === 1` | `true`, `false` | Different types; loose equality compares values |
| `2n > 1` | `true` | Relational comparison across types works |
| `Boolean(0n)`, `0n \|\| 2` | `false`, `2` | `0n` is falsy |
| `Number(9007199254740993n)` | `9007199254740992` | Precision lost when converting back |
| `JSON.stringify(1n)` | `TypeError` | JSON has no BigInt; convert to a string first |

### Unicode in strings ✅[^1] ✅[^3]

| Code | Result | Rule |
|---|---|---|
| `'©'`, `'\u{1F600}'` | `©`, `😀` | `\uXXXX` for 4 hex digits; `\u{…}` for any code point up to `10FFFF` |
| `'😀'.length` | `2` | Characters above U+FFFF take two UTF-16 code units (a surrogate pair) |
| `[...'😀'].length`, `Array.from('a😀').length` | `1`, `2` | Iteration yields whole code points |
| `'😀'.codePointAt(0).toString(16)`, `'😀'.charCodeAt(0).toString(16)` | `'1f600'`, `'d83d'` | `codePointAt` reads the full pair; `charCodeAt` reads one unit |
| `String.fromCodePoint(0x1F600) === '😀'` | `true` | Inverse of `codePointAt` |
| `'Ṩ' === 'Ṩ'` | `false` | Same look, different combining-mark order |
| `.normalize()` on both | equal; length `1` | Normalization (NFC default) composes to `U+1E68` |
| `'x'.isWellFormed()` | `true` | Detects lone surrogates |

### WeakRef and FinalizationRegistry ✅[^1] ✅[^4] ✅[^5]

| Code | Result | Rule |
|---|---|---|
| `new WeakRef(obj).deref()` while `obj` is reachable | the object | — |
| `obj = null`, then `gc()` (with `--expose-gc`), then `deref()` | `undefined` | The weak reference did not keep it alive |
| `registry.register(obj, 'held-1')`, object collected | Callback did **not** run before the lab process exited | Cleanup callbacks are not guaranteed to run, or to run promptly |
| `typeof FinalizationRegistry` | `'function'` | Available in Node 24 |

## Lookup notes
- Use BigInt for IDs, counters or cryptographic arithmetic beyond 2⁵³ − 1; send such values as strings in JSON (`JSON.stringify(1n)` throws) ✅[^2].
- Count user-visible characters with `Intl.Segmenter`, never with `.length`: the family emoji 👨‍👩‍👧 has `length` 8 but is one grapheme ✅[^1] ✅[^3].
- Normalize before comparing or storing user-typed text ✅[^3].
- Treat `WeakRef` and `FinalizationRegistry` as last resorts for caches of expensive objects; never put correctness logic in a finalizer ✅[^4] ✅[^5].

## Takeaways
- Never mix BigInt and Number in arithmetic; convert explicitly at boundaries.
- Normalize strings before equality checks on user input. [rule-candidate]
- Do not rely on finalizers to release resources; close them explicitly. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 14 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- `linux/lab-setup.md` — the Node 24.22.1 lab (with `--expose-gc` for the collection test) where every value in the catalog was produced on 2026-11-04. [^1]
- [BigInt](https://javascript.info/bigint) — javascript.info, living. Backs: operators, no mixing, no unary plus, comparisons, truthiness. [^2]
- [Unicode, String internals](https://javascript.info/unicode) — javascript.info, living. Backs: escapes, surrogate pairs, combining marks, normalization. [^3]
- [WeakRef and FinalizationRegistry](https://javascript.info/weakref-finalizationregistry) — javascript.info, living. Backs: weak references, cache use, advice to avoid. [^4]
- [FinalizationRegistry](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/FinalizationRegistry) — MDN, living. Backs: callbacks are not guaranteed to be called. [^5]

## Related
- `javascript/data-types/numbers-and-strings.md`
- `floating-point/choosing-and-comparing-numbers.md`
