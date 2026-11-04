---
schema: knowledge-doc/v1
type: reference
topic: javascript/fundamentals
status: verified
applies-to: ["ECMAScript 2025", "Node.js 24"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [javascript, operators, comparison, equality, logical-operators, nullish-coalescing, precedence]
---

# Operators, comparisons and logical operators

## Summary
**TL;DR:** Results of arithmetic, comparison, equality and logical operators in JavaScript, measured in Node 24: when `+` concatenates, how `==` converts, why `null >= 0` is true while `null == 0` is false, and what `||`, `&&` and `??` return (an operand, not a boolean).
**Use this when:** predicting the value of an expression, choosing between `==` and `===`, or between `||` and `??` for defaults.
**Not this doc:** conversion rules themselves → `javascript/fundamentals/syntax-variables-and-types.md`; object-to-primitive conversion → `javascript/object-basics/symbols-and-primitive-conversion.md`.

## Scope
Binary and unary arithmetic, assignment, increment, comparison, equality and logical operators of ECMAScript 2025, as run in Node 24.22.1 on 2026-11-04 ✅[^1].

## Catalog

### Arithmetic and assignment ✅[^1] ✅[^2]

| Expression | Result | Rule |
|---|---|---|
| `1 + '2'` | `"12"` | If either operand of binary `+` is a string, both become strings |
| `'1' + 2 + 3` / `1 + 2 + '3'` | `"123"` / `"33"` | Left to right |
| `'6' / '2'`, `'3' - 1` | `3`, `2` | Other arithmetic operators always convert to numbers |
| `+''`, `+true`, `+'x'` | `0`, `1`, `NaN` | Unary `+` is `Number(...)` |
| `2 ** 3 ** 2` | `512` | `**` is right-associative |
| `7 % 3`, `-7 % 3` | `1`, `-1` | Remainder takes the sign of the dividend |
| `a = b = 5` | Both 5; the expression's value is 5 | Assignment returns the assigned value |
| `x = i++` vs `y = ++i` (i starts at 1) | x 1, y 3 | Postfix returns the old value, prefix the new |
| `(1 + 2, 3 + 4)` | `7` | Comma evaluates all, returns the last |

### Comparison and equality ✅[^1] ✅[^3] ✅[^4]

| Expression | Result | Rule |
|---|---|---|
| `'Z' > 'A'`, `'Glow' > 'Glee'`, `'Bee' > 'Be'` | true, true, true | Strings compare code unit by code unit; longer wins on a common prefix |
| `'a' > 'B'` | true | Lower-case letters have larger codes |
| `'2' > '12'` / `2 > '12'` | true / false | Two strings compare as text; a number forces numeric comparison |
| `0 == ''`, `0 == '0'`, `'1' == 1`, `false == 0` | all true | `==` converts different types to numbers |
| `'' == '0'` | false | Same type (string): no conversion |
| `null == undefined` | true | Special rule: they equal each other and nothing else |
| `null == 0`, `undefined == 0` | false, false | Same special rule |
| `null > 0`, `null >= 0` | false, **true** | Relational operators convert `null` to 0, equality does not |
| `undefined > 0`, `undefined < 0`, `undefined == 0` | all false | `undefined` becomes `NaN` in comparisons |
| `NaN == NaN` | false | NaN is unequal to everything |
| `0 === ''`, `null === undefined`, `1 === '1'` | all false | `===` never converts |

### Logical operators ✅[^1] ✅[^5] ✅[^6]

| Expression | Result | Rule |
|---|---|---|
| `null \|\| 0 \|\| 'x'` | `'x'` | `\|\|` returns the first truthy operand, or the last |
| `1 && 0 && 'x'` / `1 && 2 && 3` | `0` / `3` | `&&` returns the first falsy operand, or the last |
| `!!'0'`, `!!''` | true, false | Double NOT converts to boolean |
| `true \|\| false && false` | true | `&&` binds tighter than `\|\|` |
| `true \|\| n++` | `n` unchanged | Short-circuit: the right side is not evaluated |
| `0 \|\| 100` / `0 ?? 100` | `100` / `0` | `??` only replaces `null` and `undefined` |
| `'' ?? 'd'`, `false ?? 'd'` | `''`, `false` | Same |
| `1 && 2 ?? 3` | `SyntaxError` | Mixing `??` with `&&`/`\|\|` needs parentheses |

## Lookup notes
- Use `===`/`!==` by default; the only common idiomatic `==` is `x == null`, which matches both `null` and `undefined` ✅[^4].
- Avoid `>`/`<` on values that may be `null` or `undefined`; check them first ✅[^3].
- Choose `??` for defaults where `0`, `''` or `false` are valid values; `||` treats them as missing ✅[^6].
- Number formatting and rounding errors such as `0.1 + 0.2` belong to IEEE 754 → `floating-point/rounding-and-error.md`.

## Takeaways
- Compare with `===`; reserve `==` for the `x == null` check. [rule-candidate]
- Default with `??` when falsy values like 0 or `''` are legitimate. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 12 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- `linux/lab-setup.md` — the Node 24.22.1 lab where every expression in the catalog ran on 2026-11-04. [^1]
- [Basic operators, maths](https://javascript.info/operators) — javascript.info, living. Backs: string concatenation, unary plus, exponent, assignment and increment. [^2]
- [Comparisons](https://javascript.info/comparison) — javascript.info, living. Backs: string comparison and the `null`/`undefined` comparison quirks. [^3]
- [Equality (==)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Equality) — MDN, living. Backs: loose equality algorithm. [^4]
- [Logical operators](https://javascript.info/logical-operators) — javascript.info, living. Backs: operand-returning `||`/`&&`, precedence, short-circuit. [^5]
- [Nullish coalescing operator '??'](https://javascript.info/nullish-coalescing-operator) — javascript.info, living. Backs: `??` semantics and the parentheses rule. [^6]

## Related
- `javascript/fundamentals/syntax-variables-and-types.md`
- `floating-point/special-values-and-exceptions.md` — NaN and signed zero.
