---
schema: deep-dive/v1
topic: javascript/misc
status: verified
applies-to: ["Any JavaScript engine (ES2015+)", "Node.js 24 for the lab"]
last-updated: 2026-11-04
last-verified: 2026-11-04
synthesized-into: []
tags: [javascript, interpreter, parser, ast, evaluator, scope, closures, special-forms, compilation, egg, eloquent-javascript]
---

# Building a small programming language in JavaScript (Egg), end to end

## Summary
**TL;DR:** A language implementation needs only three pieces: a **parser** that turns program text into a tree of expressions (an abstract syntax tree, AST), an **evaluator** that walks that tree, and a **scope** structure that maps names to values. Eloquent JavaScript's "Egg" does it in about 150 lines: every construct is either a value, a word (a name) or an *application* `op(args…)`; `if`, `while`, `do`, `define` and `fun` are **special forms** that control when their arguments are evaluated; scopes are objects chained through their prototypes, which gives lexical scope and closures almost for free. Building one is the fastest way to see what JavaScript itself does with scope, closures and compilation.
**Use this when:** you want to understand parsers, ASTs and interpreters concretely; need a tiny domain-specific language (configuration rules, formulas); or want an executable model of lexical scope and closures.
**Depth:** the grammar; the recursive parser with its regular expressions; the AST shape; the evaluator; each special form and why it must be special; the environment as a prototype chain; functions and closures; `define` versus `set` (the "fixing scope" exercise); arrays and comments (the other exercises); compiling the AST to JavaScript; a failure matrix. The full interpreter, the chapter's sample programs and all four exercises ran in Node.js 24.22.1 (✅[^2]).

## 1. The language

Egg has one syntactic idea: everything is an expression ✅[^1].

| Kind | Syntax | Example |
|---|---|---|
| Value | Number or double-quoted string (no escapes) | `10`, `"large"` |
| Word | Any run of characters that are not whitespace, `(`, `)`, `,`, `#` or `"` | `x`, `+`, `define` |
| Application | `expression(arg, arg, …)` | `>(x, 5)`, `print("small")` |

So `do(define(x, 10), if(>(x, 5), print("large"), print("small")))` is one nested application. There are no operators with precedence — `+` is just a word that names a function — which makes the parser tiny ✅[^1].

## 2. Parsing: text → AST

**AST node shapes** ✅[^1]:
```js
{ type: "value", value: 5 }
{ type: "word",  name: "x" }
{ type: "apply", operator: <node>, args: [<node>, …] }
```

**The parser** is *recursive descent*: a function per construct, calling itself for nested parts ✅[^1] ✅[^3].

1. `skipSpace` drops leading whitespace (and, after exercise 3, `#` comments up to end of line: `^(\s|#.*)*`) ✅[^2].
2. `parseExpression` tries three regular expressions at the start of the remaining text — string `^"([^"]*)"`, number `^\d+\b`, word `^[^\s(),#"]+` — builds a value or word node, and throws `SyntaxError` if none matches ✅[^1].
3. `parseApply` checks whether a `(` follows. If so it wraps the node in an `apply` node, parses arguments separated by `,` until `)`, then **calls itself again**, so `f(1)(2)` (applying the result of an application) also parses ✅[^1].
4. `parse` requires that nothing but whitespace remains after the top-level expression ✅[^1].

Lab: `parse("+(a, 10)")` → `{type:"apply", operator:{type:"word", name:"+"}, args:[{type:"word", name:"a"}, {type:"value", value:10}]}`; `parse("+(a 10)")` → `SyntaxError: Expected ',' or ')'` ✅[^2].

## 3. Evaluating: AST → value

`evaluate(node, scope)` ✅[^1]:

| Node | Result |
|---|---|
| value | Its value |
| word | `scope[name]` if `name in scope`, otherwise `ReferenceError: Undefined binding` |
| apply whose operator is a word naming a **special form** | Call the special form with the *unevaluated* argument nodes and the scope |
| other apply | Evaluate the operator; if it is a function, evaluate every argument and call it; otherwise `TypeError: Applying a non-function` |

### 3.1 Why special forms

A normal function receives *already evaluated* arguments. `if(cond, a, b)` must evaluate only one branch, and `while` must re-evaluate its condition — so they receive raw AST nodes and decide themselves ✅[^1] ✅[^3].

| Form | Behaviour | Note |
|---|---|---|
| `if(c, a, b)` | Evaluates `c`; anything except `false` counts as true | Egg has no truthiness rules beyond `false` ✅[^1] |
| `while(c, body)` | Loops while `c` is not `false`; returns `false` | Egg has no `undefined` |
| `do(e1, e2, …)` | Evaluates in order, returns the last | Sequencing |
| `define(name, e)` | Evaluates `e`, binds it in the **current** scope | |
| `fun(p1, p2, …, body)` | Creates a function (closure) | §4 |

Lab: `if(true, false, true)` → `false`; summing 1..10 with `while` printed `55` ✅[^2].

## 4. Scope, functions and closures

- **Environment as a prototype chain.** The global scope is `Object.create(null)` holding `true`, `false`, arithmetic and comparison functions and `print`. A program runs in `Object.create(topScope)`. When a function is called, its local scope is `Object.create(<scope where the function was created>)` ✅[^1].
- **Lookup** uses `name in scope`, which follows the prototype chain — exactly the outward walk of lexical scope in JavaScript (`javascript/advanced-functions/scope-and-closures-deep-dive.md`) ✅[^1].
- **Closures come free:** the function value captures the scope it was created in, so `do(define(f, fun(a, fun(b, +(a, b)))), f(4)(5))` returns 9 (exercise 2) ✅[^2] ✅[^1].
- **Recursion** works because the function's own name is in the scope its body extends: a recursive `pow(2, 10)` returned 1024 ✅[^2].

### 4.1 `define` versus `set` (exercise "Fixing scope")

Because `define` always writes to the **current** scope, `define(x, 9)` inside a function creates a local `x` and leaves the outer `x` at 4 (lab) ✅[^2]. The exercise adds `set(name, value)`, which walks up the chain with `Object.getPrototypeOf` until it finds the scope that **owns** the binding (`hasOwnProperty`) and updates it there: `do(define(x, 4), define(setx, fun(val, set(x, val))), setx(50), x)` → 50; `set(quux, true)` with no binding → `ReferenceError: Setting undefined variable quux` ✅[^2] ✅[^1]. This is the same distinction JavaScript makes between declaring (`let x`) and assigning (`x = …`).

### 4.2 Arrays (exercise "Arrays")

Adding three host functions — `array(...values)`, `length(array)`, `element(array, i)` — to the top scope is enough to write loops over arrays in Egg; the lab's Egg `sum(array(1, 2, 3))` returned 6 ✅[^2] ✅[^1].

## 5. Compilation instead of interpretation

The chapter's "Compilation" section points out that walking the AST on every run is slow; a compiler can translate it once into another language — for Egg, into JavaScript source handed to `new Function` — so the engine's own optimizer does the rest ✅[^1]. Lab: a 3-line translator turned `+(2, *(3, 4))` into `s["+"](2, s["*"](3, 4))`, compiled with `new Function('s', …)`, and returned 14 ✅[^2]. (Special forms would need their own translation: `if` → `?:`, `while` → a loop, `define` → a variable.)

The "Cheating" section notes the trade-off: much of Egg's power is borrowed from JavaScript (numbers, strings, functions). Real languages either reuse a host this way or implement their own runtime ✅[^1].

## 6. Failure matrix

| Symptom | Cause | Fix |
|---|---|---|
| `SyntaxError: Unexpected syntax` | Text matches none of the three token patterns (e.g. a string with an escaped quote) | Extend the token regexes |
| `Expected ',' or ')'` | Missing comma between arguments | — |
| `Undefined binding: x` | Name not in any scope on the chain | `define` it first |
| A function "doesn't change" an outer variable | `define` created a local | Use `set` (exercise 4) |
| `if` evaluates both branches | Implemented as a normal function | Make it a special form |
| Slow on hot loops | Tree walking each time | Compile to JavaScript |

## 7. How this deep dive was built
- **Primary narrative:** Eloquent JavaScript (4th edition) chapter 12, "Project: A Programming Language", and its four exercises, read from the author's repository; the interpreter code follows the chapter's MIT-licensed listings.
- **Reconciled with:** the interpreter vocabulary of *Crafting Interpreters* (scanning/parsing, ASTs, tree-walk evaluation, environments) and MDN's `Function` constructor reference.
- **Verified:** the whole interpreter and every example and exercise ran in `node:24.22.1-alpine` on 2026-11-04 (lab file `egg.mjs`).

## References
- [Eloquent JavaScript, ch. 12 "Project: A Programming Language"](https://eloquentjavascript.net/12_language.html) — Marijn Haverbeke, 4th ed., text CC BY-NC 3.0, code MIT. Backs: grammar, parser, evaluator, special forms, scopes, functions, compilation, cheating, exercises. [^1]
- `linux/lab-setup.md` — the Node.js 24.22.1 lab where the interpreter and every ✅[^2] result ran on 2026-11-04. [^2]
- [Crafting Interpreters](https://craftinginterpreters.com/contents.html) — Robert Nystrom, 2021. Backs: recursive-descent parsing, ASTs, tree-walk interpreters, environments; why control flow needs special evaluation. [^3]
- [Function() constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/Function) — MDN, living. Background: compiling source text at run time.

## Related
- `javascript/advanced-functions/scope-and-closures-deep-dive.md` — the same scope model in JavaScript itself.
- `javascript/regular-expressions/regular-expressions-deep-dive.md` — the token patterns the parser uses.
- `javascript/misc/proxy-eval-currying-and-reference-type.md` — `eval` and `new Function`.
