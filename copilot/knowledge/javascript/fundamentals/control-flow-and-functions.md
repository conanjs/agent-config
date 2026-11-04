---
schema: knowledge-doc/v1
type: concept
topic: javascript/fundamentals
status: verified
applies-to: ["ECMAScript 2025", "Node.js 24"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [javascript, if, loops, switch, labels, functions, function-expression, arrow-function, hoisting, default-parameters]
---

# Control flow and functions

## Summary
**TL;DR:** `if`/`?:`, `while`/`do…while`/`for`, `switch` and labelled `break`/`continue` steer execution; `switch` compares with `===`. Functions come in three syntaxes: **declarations** (hoisted — callable before the line that defines them), **expressions** (created when execution reaches them) and **arrow functions** (short, no own `this`/`arguments`). Parameters are local copies, missing arguments are `undefined`, default values are evaluated on each call, and a function without `return` returns `undefined`.
**Use this when:** writing loops or branches, choosing a function syntax, or explaining "called before defined" and closure-in-loop behaviour.
**Not this doc:** closures and scope in depth → `javascript/advanced-functions/scope-closures-and-var.md`; `this` in methods → `javascript/object-basics/objects-references-and-this.md`.

## Problem
A `switch` on a string from user input never matches a numeric `case`; callbacks created in a `var` loop all see the final counter; calling a function expression before its line throws while a declaration works; an arrow function meant to return an object returns `undefined`. All are rule-driven.

## Mental model
**Analogy:** a function declaration is printed in the programme before the show starts, so you can call on it any time; a function expression is an actor who only arrives on stage when the script reaches their line.

**Artifact:** loop closures with `let` versus `var` in Node 24 ✅[^1]:
```js
const a = []; for (let i = 0; i < 3; i++) a.push(() => i);   a.map(f => f()) // [0, 1, 2]
const b = []; for (var i = 0; i < 3; i++) b.push(() => i);   b.map(f => f()) // [3, 3, 3]
```
`let` creates a fresh binding per iteration; `var` has one binding for the whole function.

## How it works
1. **Branches.** `if` converts its condition to boolean; `cond ? a : b` is an expression and can be chained, but `if` reads better for side effects ✅[^2].
2. **Loops.** `while` checks before each pass, `do…while` after; `for (begin; cond; step)` runs `begin` once. `break` leaves the loop, `continue` jumps to the next pass; a label (`outer:`) lets `break outer` leave nested loops — the lab found `[1, 2]` as the first pair with product 2 ✅[^3] ✅[^1].
3. **`switch`.** Compares with strict equality: `'3'` does not match `case 3` ✅[^4] ✅[^1]. Without `break`, execution falls through into the next case ✅[^4].
4. **Function declarations** are created before the code of their scope runs, so they can be called earlier in the file ✅[^5] ✅[^1]. In strict mode a declaration inside a block is visible only in that block ✅[^1].
5. **Function expressions** (`const f = function () {}`) exist only from the line that assigns them; calling earlier throws `ReferenceError` (for `let`/`const`) ✅[^6] ✅[^1].
6. **Parameters.**
   - Missing arguments are `undefined` ✅[^1].
   - A default like `function f(a = compute())` is evaluated on every call that omits the argument: three calls, two without the argument, ran `compute` twice ✅[^5] ✅[^1].
   - A function without `return`, or with a bare `return`, returns `undefined` ✅[^5] ✅[^1].
7. **Arrow functions.** `(a, b) => a + b` returns the expression; with braces you need `return`. To return an object literal, wrap it in parentheses: `() => ({a: 1})`; `() => {a: 1}` is a block with a label and returns `undefined` ✅[^1] ✅[^7]. Arrows have no own `this` or `arguments` ✅[^7].

## Worked example
Validate an age from a prompt with all three function syntaxes:

| Step | Code | Result |
|---|---|---|
| 1 | `checkAge(20)` called on line 1 | Works: `function checkAge(age) { return age >= 18 }` declared on line 5 is hoisted ✅[^1] |
| 2 | `const isAdult = function (age) { return age >= 18 }` | Usable only after this line ✅[^1] |
| 3 | `const isAdult2 = age => age >= 18` | Same result, shortest form |
| 4 | `switch (prompt('Age?')) { case 18: … }` | Never matches: `prompt` returns a string ✅[^4] |
| 5 | Fix: `switch (Number(answer))` | Matches `case 18` |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `switch` with `case` values of another type | No match | `===` comparison ✅[^1] |
| Missing `break` in a `case` | Falls through to the next case | By design ✅[^4] |
| `for (var …)` with callbacks | All callbacks see the final value | One shared binding ✅[^1] |
| `return` followed by a newline and then the value | Returns `undefined` | A semicolon is inserted after `return` ✅[^5] |
| `?:` used for side effects | Works but is hard to read | Prefer `if` ✅[^2] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Declaration | Hoisted; named in stack traces | Can be called before its dependencies are ready |
| Expression | Created exactly where needed; can be conditional | Not usable before its line |
| Arrow | Shortest; inherits `this` | No own `this`/`arguments`; not a constructor |

## Takeaways
- Declare loop counters with `let` so each iteration gets its own binding.
- Convert input to the case type before a `switch`; `switch` uses `===`.
- Wrap object literals in parentheses when an arrow function returns them.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 28 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- `linux/lab-setup.md` — the Node 24.22.1 lab where every behaviour marked with this note ran on 2026-11-04. [^1]
- [Conditional branching: if, '?'](https://javascript.info/ifelse) — javascript.info, living. Backs: `if` conversion and `?` usage. [^2]
- [Loops: while and for](https://javascript.info/while-for) — javascript.info, living. Backs: loop forms, `break`/`continue`, labels. [^3]
- [The "switch" statement](https://javascript.info/switch) — javascript.info, living. Backs: strict comparison and fall-through. [^4]
- [Functions](https://javascript.info/function-basics) — javascript.info, living. Backs: parameters, defaults, return rules. [^5]
- [Function expressions](https://javascript.info/function-expressions) — javascript.info, living. Backs: declaration versus expression timing. [^6]
- [Arrow functions, the basics](https://javascript.info/arrow-functions-basics) — javascript.info, living. Backs: arrow syntax and lack of own `this`. [^7]
- [JavaScript specials](https://javascript.info/javascript-specials) — javascript.info, living. Background: recap of the fundamentals chapter.

## Related
- `javascript/fundamentals/syntax-variables-and-types.md`
- `javascript/advanced-functions/scope-closures-and-var.md`
