---
schema: deep-dive/v1
topic: javascript/data-types
status: verified
applies-to: ["ECMAScript 2025", "Node.js 24 (V8)"]
last-updated: 2026-11-04
last-verified: 2026-11-04
synthesized-into: []
tags: [javascript, types, primitives, coercion, toprimitive, tonumber, tostring, toboolean, equality, samevalue, loose-equality, relational-comparison, grammar, asi, ydkjs]
---

# Types, coercion, equality and grammar, end to end

## Summary
**TL;DR:** JavaScript values have types; variables do not. Every implicit conversion is a call to one of a handful of specification **abstract operations** — `ToPrimitive`, `ToString`, `ToNumber`, `ToBoolean` — and every comparison is one of `SameValue`, `SameValueZero`, `IsStrictlyEqual` (`===`), `IsLooselyEqual` (`==`) or `IsLessThan` (`<`). Once those few tables are known, the famous "WAT" results (`[] == ![]`, `{} + []`, `parseInt(0.0000005)`) become mechanical. The real culprits are a few conversion corner cases (`Number("")` is 0, `String([])` is `""`, `Number(false)` is 0), not `==` itself. Grammar has its own traps: statement completion values, automatic semicolons, and `arguments` aliasing in sloppy mode.
**Use this when:** you need to predict an implicit conversion or comparison exactly, decide between `==` and `===` with reasons, or debug a grammar surprise; or you are reading You Don't Know JS *Types & Grammar* and want a verified companion.
**Depth:** the eight types and `typeof`; primitives' immutability and wrappers; number and string internals relevant to coercion; each abstract operation as a table of inputs and outputs; the `+` operator; `SameValue` vs `SameValueZero` vs `===` vs `==` with the full loose-equality algorithm; relational comparison; corner cases traced step by step; the `==` versus `===` debate reconciled; grammar (completion values, labels, ASI, precedence, `arguments`, `finally`, `switch`). Every ✅[^2] row ran in Node.js 24.22.1.

## 1. Values, types and `typeof`

Seven primitive types — `undefined`, `null`, `boolean`, `number`, `bigint`, `string`, `symbol` — and `object` ✅[^1].

| Expression | `typeof` | Note |
|---|---|---|
| `null` | `"object"` | Historical bug kept for compatibility ✅[^2] |
| `[]` | `"object"` | Use `Array.isArray` |
| `function(){}`, `class{}` | `"function"` | Callable objects get their own answer ✅[^2] |
| `NaN` | `"number"` | "Not a number" is a number value ✅[^2] |
| `Symbol()`, `1n` | `"symbol"`, `"bigint"` | ✅[^2] |

**Primitives are immutable.** In strict code, `'abc'.x = 1` throws `TypeError`; reading a method on a primitive temporarily boxes it (`Object('abc')` is a `String` object, `typeof` `"object"`) ✅[^2] ✅[^3].

**Numbers** are IEEE 754 binary64 (limits: `Number.MAX_SAFE_INTEGER` 9007199254740991, `Number.EPSILON` = 2⁻⁵², `Number.MIN_VALUE` 5e-324; `2**53 === 2**53 + 1`) ✅[^2] — the full treatment is `floating-point/ieee-754-deep-dive.md`. **Bitwise operators convert to 32-bit integers**: `2**31 | 0` is −2147483648, `~~-3.7` is −3, `-1 >>> 0` is 4294967295 ✅[^2] ✅[^3].

**Strings** are sequences of UTF-16 code units: the family emoji 👨‍👩‍👧 has `length` 8, 5 code points and 1 grapheme (`Intl.Segmenter`) ✅[^2] ✅[^3]. Tagged templates receive both cooked and raw strings (`s.raw[0]` is `a\n` with a literal backslash) ✅[^2].

## 2. The abstract conversion operations

### 2.1 `ToBoolean` ✅[^2] ✅[^4]

| Falsy (exactly eight) | Truthy surprises |
|---|---|
| `false`, `0`, `-0`, `0n`, `""`, `null`, `undefined`, `NaN` | `"false"`, `"0"`, `[]`, `{}`, functions, `new Boolean(false)` (any object) |

### 2.2 `ToPrimitive(value, hint)`

Objects become primitives through `Symbol.toPrimitive`, else `valueOf`/`toString` in an order set by the hint (`"string"`, `"number"`, `"default"`); `Date` treats `"default"` as `"string"`. Measured hint table: `javascript/object-basics/symbols-and-primitive-conversion.md` ✅[^4].

### 2.3 `ToString` ✅[^2] ✅[^4]

| Input | Result |
|---|---|
| `-0` (via `String`, template, `JSON.stringify`) | `"0"` — the sign is lost |
| `[]`, `[null]`, `[undefined]` | `""` (null/undefined elements become empty) |
| `[1, [2, 3]]` | `"1,2,3"` |
| `{}` | `"[object Object]"` |
| `1e21`, `0.000001`, `1e-7` | `"1e+21"`, `"0.000001"`, `"1e-7"` — exponent form outside [1e-6, 1e21) |
| `Symbol('x')` | `String(s)` gives `"Symbol(x)"`; `s + ''` throws `TypeError` |

### 2.4 `ToNumber` ✅[^2] ✅[^4]

| Input | Result | Input | Result |
|---|---|---|---|
| `""`, `" \n\t"` | `0` | `[]` | `0` |
| `"0x10"`, `"0b11"`, `"1e3"` | `16`, `3`, `1000` | `["5"]` | `5` |
| `"-0"` | `-0` | `[1, 2]` | `NaN` |
| `"12px"`, `"1_000"` | `NaN` (numeric separators are not allowed in strings) | `{}` | `NaN` |
| `"Infinity"` | `Infinity` | `new Date(0)` | `0` |
| `null` / `undefined` | `0` / `NaN` | `true` | `1` |
| `Symbol()` | `TypeError` | `+1n` | `TypeError` (but `Number(1n)` is 1) |

**Parsing is not coercion.** `parseInt` reads the *string form* left to right and stops at the first invalid character ✅[^5]:

| Call | Result | Why |
|---|---|---|
| `parseInt(0.0000005)` | `5` | The number stringifies to `"5e-7"` |
| `parseInt(1/0, 19)` | `18` | `"Infinity"` → `I` is 18 in base 19, `n` is invalid |
| `parseInt(null, 36)` | `1112745` | `"null"` read in base 36 |
| `parseInt('08')`, `parseInt('')` | `8`, `NaN` | Modern engines no longer treat a leading 0 as octal |

✅[^2]

## 3. The `+` operator

`+` first converts both operands with `ToPrimitive` (hint `"default"`); if either result is a string it concatenates, otherwise it adds numbers ✅[^4]:

| Expression | Result | Lab |
|---|---|---|
| `[] + []` | `""` | ✅[^2] |
| `[] + {}` | `"[object Object]"` | ✅[^2] |
| `[1] + [2]` | `"12"` | ✅[^2] |
| `1 + null` / `1 + undefined` | `1` / `NaN` | ✅[^2] |
| `'a' + null` | `"anull"` | ✅[^2] |
| `true + true` | `2` | ✅[^2] |
| `[2] * [3]` | `6` (other arithmetic always uses numbers) | ✅[^2] |
| `{} + []` as a **statement** | `0` — `{}` is parsed as an empty block, then `+[]` | ✅[^2] |

## 4. Equality: four algorithms

| Algorithm | Exposed as | `NaN` vs `NaN` | `0` vs `-0` | Coerces? |
|---|---|---|---|---|
| `SameValue` | `Object.is` | equal | different | no |
| `SameValueZero` | `includes`, `Map`/`Set` keys | equal | equal | no |
| `IsStrictlyEqual` | `===` | **different** | equal | no |
| `IsLooselyEqual` | `==` | different | equal | yes, when types differ |

Lab: `Object.is(NaN, NaN)` true, `Object.is(0, -0)` false, `[NaN].includes(NaN)` true, `new Set([0, -0]).size` 1, `NaN === NaN` false ✅[^2] ✅[^6]. None of them normalizes Unicode: `'é' === 'é'` is false until both are `.normalize()`d ✅[^2].

### 4.1 `IsLooselyEqual(x, y)` step by step ✅[^7]

1. **Same type** → return `x === y`. (So `==` and `===` are *identical* whenever the types match ✅[^2].)
2. `null == undefined` (either order) → `true`; neither equals anything else.
3. Number vs string → convert the string with `ToNumber`.
4. BigInt vs string → convert the string to BigInt (`1n == '1'` is true).
5. **Boolean vs anything → convert the boolean to a number first** (`'2' == true` is `'2' == 1`, false).
6. Object vs primitive → `ToPrimitive` the object, then compare again.
7. BigInt vs number → compare mathematical values (`1n == 1`).
8. Otherwise → `false`.

| Expression | Result | Expression | Result |
|---|---|---|---|
| `'42' == 42` | true | `null == false` | **false** |
| `'0' == false` | true | `undefined == false` | false |
| `'' == false` | true | `null == 0` | false |
| `[] == false` | true | `'1' == true` / `'2' == true` | true / **false** |
| `['0'] == false` | true | `({}) == '[object Object]'` | true |
| `'\n' == 0` | true | `NaN == NaN` | false |

✅[^2]

### 4.2 Tracing `[] == ![]` ✅[^8] ✅[^2]

| Step | Expression | Rule |
|---|---|---|
| 1 | `[] == ![]` | `![]` is `!true` (objects are truthy) |
| 2 | `[] == false` | boolean → number (step 5) |
| 3 | `[] == 0` | object → primitive: `String([])` |
| 4 | `"" == 0` | string → number: `Number("")` |
| 5 | `0 == 0` | same type → `===` → **true** |

The book's point: the absurdity comes from three conversion corner cases — `String([])` is `""`, `Number("")` is 0, `Number(false)` is 0 — not from `==`'s design ✅[^8].

## 5. Relational comparison (`<`, `>`, `<=`, `>=`) ✅[^2] ✅[^7]

1. `ToPrimitive` both operands with hint `"number"`.
2. If **both** are strings → compare code units lexicographically (`'10' < '9'` is true).
3. Otherwise → convert to numbers (or BigInt) and compare numerically (`10 < '9'` is false).

| Expression | Result | Why |
|---|---|---|
| `[2] < [10]` | false | Both become strings `"2"` and `"10"` → text comparison |
| `null < 1` / `undefined < 1` | true / false | `0 < 1` / `NaN < 1` |
| `1n < 2`, `'1' < 2n` | true, true | Mixed numeric comparison works |
| `({}) < ({})` / `({}) <= ({})` | false / **true** | `<=` is defined as "not greater than" |
| `1 < 2 < 3` / `3 > 2 > 1` | true / **false** | Left to right: `true < 3` is `1 < 3`; `true > 1` is `1 > 1` |

## 6. `==` or `===`? Two positions, reconciled

| Position | Argument | Source |
|---|---|---|
| Common style guides and `javascript/fundamentals/operators-and-comparisons.md` | Use `===` everywhere; keep `== null` as the one idiom | MDN equality guidance ✅[^6] |
| You Don't Know JS Yet (2nd ed.) | When types are known to match, `==` and `===` behave identically; when they may differ, the code should know that and `==` documents intended coercion — so prefer `==` in type-aware code | ✅[^8] |

**What both agree on** (and the lab confirms): (1) with matching types the operators are interchangeable ✅[^2]; (2) the dangerous comparisons are those involving `""`, `"0"`, `[]` and booleans ✅[^2]; (3) never compare with `true`/`false` directly — `'2' == true` is false although `'2'` is truthy ✅[^2]. **Practical rule for this knowledge base:** keep `===` as the default (it needs no knowledge of operand types and linters enforce it), allow `x == null`, and never compare against boolean literals.

## 7. Grammar traps

| Topic | Behaviour | Lab |
|---|---|---|
| Statement completion values | Statements have values only `eval`/REPL show: `if (true) { 42 }` → 42; `var x = 5` → `undefined`; `x = 6` → 6 | ✅[^2] ✅[^9] |
| `{ a: 1 }` as a statement | A **block** with a label `a:` and expression `1`, not an object | ✅[^2] |
| ASI: `return` + newline + value | Returns `undefined` | ✅[^2] |
| ASI: `a` newline `++b` | Parsed as `a; ++b;` → `[1, 2]` | ✅[^2] |
| Precedence | `&&` binds tighter than `\|\|`; `**` is right-associative (`2 ** 3 ** 2` = 512); `typeof typeof 1` is `"string"` | ✅[^2] |
| `arguments` aliasing | Sloppy, simple parameters: assigning a parameter changes `arguments[0]` (2); strict: unlinked (1); any default parameter also unlinks it, even in sloppy code (1) | ✅[^2] ✅[^9] |
| `finally` | A `return` in `finally` overrides an earlier `return` **and swallows a thrown error** | ✅[^2] |
| `switch` | Uses `===` (`'1'` does not match `case 1`); `switch (true) { case v == 1: … }` gives loose matching | ✅[^2] ✅[^9] |
| Annex B / host environment | Web-legacy features (`__proto__`, HTML comments, sloppy block functions), DOM globals and host objects behave outside the core language rules | ✅[^10] |

## 8. Failure matrix

| Symptom | Cause | Fix |
|---|---|---|
| `if (x == true)` fails for `'2'` | Boolean converts to number first | Test truthiness (`if (x)`) or the real type |
| Form input `""` treated as 0 | `Number("")` is 0 | Check for empty string before converting |
| `-0` printed as `0`, sign lost in JSON | `ToString` drops the sign | `Object.is(x, -0)` before serializing if the sign matters |
| `parseInt(smallNumber)` wrong | `parseInt` reads the exponent string | `Math.trunc` for numbers; `parseInt` only for strings |
| Version strings sort wrong (`'10' < '9'`) | Both strings → text comparison | Convert to numbers or use `localeCompare` with `numeric: true` |
| `arguments[0]` changes when the parameter is reassigned | Sloppy-mode aliasing | Strict mode; use rest parameters |
| Error vanishes in a `try…finally` | `return` in `finally` | Never return from `finally` |

## 9. How this deep dive was built
- **Primary narrative:** You Don't Know JS Yet, *Types & Grammar* (2nd edition, rough draft, chapters 1–4) and the 1st edition's chapters 4–5 and Appendix A (grammar, ASI, `arguments`, Annex B).
- **Reconciled with:** the ECMAScript abstract operations and MDN; the `==`/`===` disagreement is presented with both sides.
- **Verified:** every ✅[^2] row ran in `node:24.22.1-alpine` on 2026-11-04 (lab file `types.js`).

## References
- [You Don't Know JS Yet: Types & Grammar, ch. 1 "Primitive Values"](https://github.com/getify/You-Dont-Know-JS/blob/2nd-ed/types-grammar/ch1.md) — Kyle Simpson, 2nd ed. (rough draft), CC BY-NC-ND 4.0. Backs: value types, `typeof`, number and string internals. [^1]
- `linux/lab-setup.md` — the Node.js 24.22.1 lab where every ✅[^2] behaviour ran on 2026-11-04. [^2]
- [You Don't Know JS Yet: Types & Grammar, ch. 2 "Primitive Behaviors"](https://github.com/getify/You-Dont-Know-JS/blob/2nd-ed/types-grammar/ch2.md) — Kyle Simpson. Backs: immutability, string length and i18n, bitwise operators. [^3]
- [ECMAScript: Type Conversion abstract operations](https://tc39.es/ecma262/#sec-type-conversion) — Ecma TC39, living. Backs: `ToPrimitive`, `ToBoolean`, `ToNumber`, `ToString`. [^4]
- [parseInt()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/parseInt) — MDN, living. Backs: parsing stops at invalid characters; non-strings are stringified first. [^5]
- [Equality comparisons and sameness](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Equality_comparisons_and_sameness) — MDN, living. Backs: the four equality algorithms and where each is used. [^6]
- [ECMAScript: IsLooselyEqual and IsLessThan](https://tc39.es/ecma262/#sec-islooselyequal) — Ecma TC39, living. Backs: loose equality and relational comparison steps. [^7]
- [You Don't Know JS Yet: Types & Grammar, ch. 4 "Coercing Values"](https://github.com/getify/You-Dont-Know-JS/blob/2nd-ed/types-grammar/ch4.md) — Kyle Simpson. Backs: abstract operations, `[] == ![]` trace, type-aware equality argument. [^8]
- [You Don't Know JS: Types & Grammar, ch. 5 "Grammar"](https://github.com/getify/You-Dont-Know-JS/blob/1st-ed/types%20%26%20grammar/ch5.md) — Kyle Simpson, 1st ed. Backs: completion values, ASI, precedence, `arguments`, `finally`, `switch`. [^9]
- [You Don't Know JS: Types & Grammar, Appendix A "Mixed Environment JavaScript"](https://github.com/getify/You-Dont-Know-JS/blob/1st-ed/types%20%26%20grammar/apA.md) — Kyle Simpson, 1st ed. Backs: Annex B, host objects, DOM globals. [^10]

## Related
- `javascript/fundamentals/operators-and-comparisons.md` — the short catalog this dive explains.
- `javascript/fundamentals/syntax-variables-and-types.md`
- `floating-point/ieee-754-deep-dive.md`
