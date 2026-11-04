---
schema: knowledge-doc/v1
type: concept
topic: javascript/fundamentals
status: verified
applies-to: ["ECMAScript 2025", "Node.js 24"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [javascript, syntax, semicolons, strict-mode, let, const, var, tdz, types, typeof, type-conversion]
---

# Script structure, strict mode, variables and the eight types

## Summary
**TL;DR:** A script is a list of statements; line breaks *usually* end a statement, but not always, so write semicolons. Put `"use strict"` at the top (modules and classes are strict automatically) to turn silent mistakes into errors. Declare with `const` by default and `let` when the value changes; `var` is the legacy form with function scope. JavaScript has **seven primitive types** (number, bigint, string, boolean, null, undefined, symbol) plus **object**, and converts between them implicitly — to string, to number or to boolean — following fixed tables worth memorizing.
**Use this when:** reading or writing any JavaScript, debugging a `ReferenceError`/`TypeError` around variables, or predicting what an implicit conversion produces.
**Not this doc:** operators and `==` → `javascript/fundamentals/operators-and-comparisons.md`; `var` and closures in depth → `javascript/advanced-functions/scope-closures-and-var.md`.

## Problem
Code that "looks fine" fails: a missing semicolon glues two lines into one expression, a typo creates a global variable instead of an error, `typeof null` says `"object"`, `Number("12px")` is `NaN` while `Number("")` is `0`. Each follows a rule; not knowing the rules turns them into mystery bugs.

## Mental model
**Analogy:** variables are labelled boxes. `const` glues the label to one box forever (the box's contents may still change if it holds an object); `let` lets you move the label; `var` is an old label that is visible in the whole room (function), not just on the shelf (block) where you put it.

**Artifact:** conversion results measured in Node 24 ✅[^1]:
```js
Number("")        // 0        Number(" 12 ")  // 12      Number("12px")  // NaN
Number(true)      // 1        Number(null)    // 0       Number(undefined) // NaN
Boolean("0")      // true     Boolean(" ")    // true    Boolean([])     // true
String(null)      // "null"   String([1,2])   // "1,2"   String({})      // "[object Object]"
```

## How it works
1. **Statements and semicolons.** A line break is usually treated as a semicolon (automatic semicolon insertion), but not when the next line can continue the expression — a line starting with `[` or `(` joins the previous one ✅[^2] ✅[^1].
2. **Strict mode.** `"use strict"` must be the first statement of a script or function ✅[^3]. In strict mode, assigning to an undeclared name throws `ReferenceError`, `this` in a plain function call is `undefined`, and `with` is a `SyntaxError` ✅[^1] ✅[^4]. ES modules and class bodies are always strict ✅[^3] ✅[^1].
3. **Declarations.**
   - `let` and `const` are block-scoped; using them before the declaration line throws `ReferenceError: Cannot access 'x' before initialization` — the temporal dead zone ✅[^1] ✅[^5].
   - `const` forbids reassignment (`TypeError`) but not mutation of the object it holds ✅[^1].
   - `var` is function-scoped, hoisted with value `undefined`, may be redeclared, and at the top level of a classic script becomes a property of `globalThis` (a top-level `let` does not) ✅[^1].
   - Names may contain letters, digits, `$` and `_`, must not start with a digit, and are case-sensitive ✅[^6].
4. **The eight types and `typeof`.** `typeof` returns `"number"`, `"bigint"`, `"string"`, `"boolean"`, `"undefined"`, `"symbol"`, `"object"` and `"function"`; `typeof null` is `"object"` — a historical mistake kept for compatibility — and arrays are `"object"` too ✅[^1] ✅[^7]. `typeof` on an undeclared name returns `"undefined"` instead of throwing ✅[^1].
5. **Conversions.**
   - *To string:* `String(v)` or template/`+` with a string ✅[^1].
   - *To number:* whitespace is trimmed; empty string → 0; any other non-numeric text → `NaN`; `true`/`false` → 1/0; `null` → 0; `undefined` → `NaN` ✅[^1] ✅[^8].
   - *To boolean:* exactly `0`, `-0`, `0n`, `""`, `null`, `undefined` and `NaN` are falsy; everything else — including `"0"`, `" "`, `[]` and `{}` — is truthy ✅[^1] ✅[^8].
6. **Simple interaction (browser only).** `alert` shows a message, `prompt` returns the typed string or `null` on cancel, `confirm` returns `true`/`false`; all three are modal and block the page ✅[^9].

## Worked example
Reading a quantity from a form field and checking it:

| Step | Code | Value |
|---|---|---|
| 1 | `const raw = " 12 "` (form fields are strings) | `" 12 "` |
| 2 | `const qty = Number(raw)` | `12` (whitespace trimmed) ✅[^1] |
| 3 | `Number("12px")` for bad input | `NaN` ✅[^1] |
| 4 | `if (!qty)` | Wrongly rejects a legitimate `0` too — 0 is falsy ✅[^1] |
| 5 | Better: `if (Number.isNaN(qty))` | Rejects only non-numbers |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `let x = 1` then a next line starting with `[1,2].forEach(...)` | `TypeError` | No semicolon inserted; parsed as `1[1,2].forEach` ✅[^1] |
| `x = 5` with no declaration, non-strict script | Creates a global silently | Sloppy-mode legacy; strict mode throws ✅[^1] |
| `var` declared twice | Allowed | `let` twice is a `SyntaxError` ✅[^1] |
| `Number([])`, `Number([5])`, `Number({})` | 0, 5, `NaN` | Objects convert through their string form ✅[^1] |
| `typeof function(){}` | `"function"` | Functions are objects but get their own `typeof` result ✅[^7] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| `const` by default | Fewer accidental reassignments; clearer intent | One more keyword to choose |
| `let` | Reassignable, block-scoped | — |
| `var` | Works in very old engines | Function scope, hoisting surprises, global leakage |

## Takeaways
- Use strict mode (or modules) everywhere; never rely on sloppy-mode globals. [rule-candidate]
- Declare with `const` unless the binding must change, then `let`; do not use `var` in new code. [rule-candidate]
- Check for invalid numbers with `Number.isNaN`, not with truthiness.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 30 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- `linux/lab-setup.md` — the Node 24.22.1 lab where every behaviour marked with this note ran on 2026-11-04. [^1]
- [Code structure](https://javascript.info/structure) — javascript.info, living. Backs: automatic semicolon insertion and where it fails. [^2]
- [The modern mode, "use strict"](https://javascript.info/strict-mode) — javascript.info, living. Backs: directive position; classes and modules are strict. [^3]
- [Strict mode](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode) — MDN, living. Backs: errors strict mode adds. [^4]
- [let](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let) — MDN, living. Backs: block scope and temporal dead zone. [^5]
- [Variables](https://javascript.info/variables) — javascript.info, living. Backs: naming rules, `let` and `const`. [^6]
- [Data types](https://javascript.info/types) — javascript.info, living. Backs: eight types, `typeof` results, `typeof null`. [^7]
- [Type Conversions](https://javascript.info/type-conversions) — javascript.info, living. Backs: numeric and boolean conversion tables. [^8]
- [Interaction: alert, prompt, confirm](https://javascript.info/alert-prompt-confirm) — javascript.info, living. Backs: modal dialogs and return values. [^9]
- [Hello, world!](https://javascript.info/hello-world) — javascript.info, living. Background: the `<script>` tag and external scripts.

## Related
- `javascript/fundamentals/operators-and-comparisons.md`
- `javascript/fundamentals/control-flow-and-functions.md`
- `floating-point/` — why numbers behave as IEEE 754 doubles.
