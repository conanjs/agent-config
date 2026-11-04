---
schema: knowledge-doc/v1
type: reference
topic: javascript/data-types
status: verified
applies-to: ["ECMAScript 2025", "Node.js 24"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [javascript, primitives, wrapper-objects, number, parseint, tofixed, math, string, unicode, localecompare]
---

# Primitive methods, numbers and strings

## Summary
**TL;DR:** Lookup tables for calling methods on primitives (a temporary wrapper object), writing and converting numbers (`toString(base)`, `toFixed`, `parseInt`, `Math.*`, `isNaN` vs `Number.isNaN`) and working with strings (indexing, searching, slicing, comparing, Unicode length) — every result measured in Node 24.
**Use this when:** you need the exact result of a number or string method, or a reminder of which variant to use.
**Not this doc:** why `0.1 + 0.2 !== 0.3` → `floating-point/rounding-and-error.md`; big integers → `javascript/misc/bigint-unicode-and-weakrefs.md`.

## Scope
`Number`, `Math` and `String` methods of ECMAScript 2025 as implemented in Node 24.22.1, measured on 2026-11-04 ✅[^1]. JavaScript numbers are IEEE 754 binary64 doubles; their limits are in `floating-point/binary-formats.md`.

## Catalog

### Primitives with methods ✅[^1] ✅[^2]

| Code | Result | Rule |
|---|---|---|
| `'abc'.toUpperCase()` | `'ABC'` | A temporary wrapper object provides the method, then is discarded |
| `s.x = 1` on a string, strict mode | `TypeError` | Cannot create a property on a primitive |
| `s.x = 1`, sloppy mode, then `s.x` | `undefined` | The property went to the discarded wrapper |
| `typeof new Number(1)` | `'object'` | Explicit wrappers are objects — avoid them |
| `new Boolean(false) ? 'truthy' : 'falsy'` | `'truthy'` | Every object is truthy |

### Writing and converting numbers ✅[^1] ✅[^3]

| Code | Result |
|---|---|
| `1e3`, `1_000_000`, `1e-6` | `1000`, `1000000`, `0.000001` |
| `0xff`, `0b101`, `0o17` | `255`, `5`, `15` |
| `(255).toString(16)`, `(255).toString(2)` | `'ff'`, `'11111111'` |
| `parseInt('2n9c', 36)` | `123456` |
| `(123.456).toFixed(1)`, `typeof (12.34).toFixed(1)` | `'123.5'`, `'string'` |
| `+(0.1 + 0.2).toFixed(2)` | `0.3` (unary `+` turns the string back into a number) |
| `parseInt('100px')`, `parseFloat('12.5em')`, `parseInt('12.3')` | `100`, `12.5`, `12` |
| `parseInt('a123')` | `NaN` — parsing stops at the first invalid character, so nothing was read |
| `Number('12px')` | `NaN` — `Number` is strict, `parseInt` is lenient |

### Rounding ✅[^1] ✅[^3]

| Function | `-1.5` | `1.5` |
|---|---|---|
| `Math.floor` | `-2` | `1` |
| `Math.ceil` | `-1` | `2` |
| `Math.round` | `-1` | `2` |
| `Math.trunc` | `-1` | `1` |

### Testing numbers ✅[^1] ✅[^3]

| Code | Result | Note |
|---|---|---|
| `isNaN('str')` / `Number.isNaN('str')` | `true` / `false` | Global versions convert first |
| `isFinite('15')` / `Number.isFinite('15')` | `true` / `false` | Same |
| `Object.is(NaN, NaN)`, `Object.is(0, -0)` | `true`, `false` | Same-value comparison |
| `Number.isInteger(5.0)` | `true` | 5.0 and 5 are the same double |
| `9007199254740993` | prints `9007199254740992` | Above `Number.MAX_SAFE_INTEGER` (9007199254740991) |

### Strings ✅[^1] ✅[^4]

| Code | Result | Note |
|---|---|---|
| `'Hello'.length`, `'Hello'[10]`, `'Hello'.at(-1)`, `'Hello'.charAt(10)` | `5`, `undefined`, `'o'`, `''` | `at` accepts negative indexes |
| `s[0] = 'H'` (strict) | `TypeError` | Strings are immutable |
| `'Hello'.indexOf('l')`, `'Hello'.includes('ell')` | `2`, `true` | `indexOf` returns -1 if absent — test `!== -1`, not truthiness |
| `'Widget'.indexOf('Widget')` | `0` | Falsy, though found |
| `'Hello'.slice(-3)`, `'Hello'.substring(4, 1)` | `'llo'`, `'ell'` | `substring` swaps reversed arguments; `slice` accepts negatives |
| `` `a${1 + 1}b` ``, `'x'.repeat(3)`, `' t '.trim()`, `'abc'.padStart(5, '*')`, `'a-b-c'.replaceAll('-', '+')` | `'a2b'`, `'xxx'`, `'t'`, `'**abc'`, `'a+b+c'` | — |
| `'a'.localeCompare('b')`, `'Österreich'.localeCompare('Zealand')` | `-1`, `-1` | Language-aware order; `'Ö' > 'Z'` by code units would be true |
| `'Z'.codePointAt(0)` | `90` | — |
| `'😀'.length`, `[...'😀'].length` | `2`, `1` | Length counts UTF-16 code units; iteration yields code points |

## Lookup notes
- Prefer `Number.isNaN` and `Number.isFinite`; the global versions convert their argument first ✅[^3].
- `toFixed` returns a string and inherits binary rounding: `(1.005).toFixed(2)` is `'1.00'` → `floating-point/rounding-and-error.md`.
- Use `localeCompare` or `Intl.Collator` to sort human text ✅[^4].
- Characters outside the Basic Multilingual Plane (emoji, many CJK extensions) take two code units → `javascript/misc/bigint-unicode-and-weakrefs.md`.

## Takeaways
- Use `Number()` for strict parsing and `parseInt`/`parseFloat` only to read a leading number from text like `'12px'`.
- Test `indexOf` results with `!== -1`, or use `includes`.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 13 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- `linux/lab-setup.md` — the Node 24.22.1 lab where every value in the catalog was produced on 2026-11-04. [^1]
- [Methods of primitives](https://javascript.info/primitives-methods) — javascript.info, living. Backs: wrapper objects, avoiding `new Number`. [^2]
- [Numbers](https://javascript.info/number) — javascript.info, living. Backs: literals, `toString(base)`, rounding functions, `isNaN`/`isFinite`, `parseInt`/`parseFloat`. [^3]
- [Strings](https://javascript.info/string) — javascript.info, living. Backs: access, immutability, search, substrings, comparison, `localeCompare`. [^4]

## Related
- `floating-point/choosing-and-comparing-numbers.md` — money, tolerances and safe integers.
- `javascript/data-types/arrays-and-iterables.md`
