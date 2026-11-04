---
schema: deep-dive/v1
topic: javascript/advanced-functions
status: verified
applies-to: ["ECMAScript 2025", "Node.js 24 (V8)", "browsers for the global-scope rows"]
last-updated: 2026-11-04
last-verified: 2026-11-04
synthesized-into: []
tags: [javascript, scope, lexical-scope, scope-chain, hoisting, tdz, shadowing, global-scope, closure, garbage-collection, module-pattern, commonjs, esm, ydkjs]
---

# Scope and closures, end to end

## Summary
**TL;DR:** JavaScript decides **where every variable lives while it compiles the program**, before any line runs; execution then only *looks up* those already-decided scopes. Everything else follows from that: hoisting and the temporal dead zone (TDZ) are the visible traces of the compile step; shadowing, the global scope and modules are rules about which scope a name resolves to; and a **closure** is simply a function that keeps using the scope it was compiled in after that scope's code has finished. In V8 that kept scope is a shared "context" object, so one closure can keep alive data that only its sibling uses.
**Use this when:** you need the full model behind a scoping bug (wrong variable seen, `ReferenceError` before a declaration, leaked global, memory held by a callback), want to understand modules as "closures with a public API", or are reading the You Don't Know JS Yet *Scope & Closures* book and want a verified companion.
**Depth:** the two processing phases and their proof; target/source references and lookup failures; runtime scope cheats; shadowing rules; function-name and parameter scopes; the global scope in six environments; declaration lifecycle (hoisting, redeclaration, TDZ, loops); block-level function declarations in strict and sloppy code; least exposure; closure definition, live links and per-iteration bindings; closure lifetime and V8 context sharing measured with `WeakRef`; the module pattern from IIFE to CommonJS and ES modules; an edge-case matrix. Every behaviour was run in Node.js 24.22.1 (✅ marks); the book chapter that develops each idea is cited for further reading.

## 1. Two phases: compile, then execute

A JavaScript engine processes a script in at least two phases: it **parses and compiles the whole unit first**, then executes it. The specification never says "compile", but it requires behaviour that is only practical that way ✅[^1]. Three observations prove it:

| Evidence | Program | What happens (Node 24) | Why it proves a compile phase |
|---|---|---|---|
| Syntax errors | `var g = "Hello"; console.log(g); g = ."Hi";` | Nothing is printed; `SyntaxError: Unexpected token '.'` ✅[^2] | The error on line 3 is found before line 2 runs |
| Early errors | `console.log("Howdy")` then a strict function with duplicate parameter names | Nothing is printed; `SyntaxError: Duplicate parameter name not allowed in this context` ✅[^2] | The engine already knew the function body was strict while reading its parameter list |
| Hoisting / TDZ | `var g='Hello'; { g='Howdy'; let g='Hi'; }` | `ReferenceError: Cannot access 'g' before initialization` on the *first* line of the block ✅[^2] | The block's `let g` was registered before the assignment ran |

**Analogy:** a stage manager reads the whole script and puts every actor's chair (variable) in the right room (scope) before the curtain rises; during the show, actors only walk to chairs that already exist.

Practical consequence: "JavaScript is interpreted line by line" is the wrong mental model for scope. Scope is **lexical** — fixed by where code is written — because it is settled at compile time ✅[^1].

## 2. Vocabulary

| Term | Meaning | Example |
|---|---|---|
| **Scope** | A region of code with its own set of declared identifiers | A function body; a `{ … }` block containing `let` |
| **Lexical scope** | Scope determined by where functions and blocks are *written*, not where they are called | An inner function sees its outer function's variables wherever it is later called |
| **Scope chain** | The nesting of scopes; lookups move outward only | block → function → module/global |
| **Target reference** | An occurrence that *receives* a value (an assignment target) | `x = 1`, `for (let s of list)` (`s`), parameter `id` receiving an argument, a function declaration's name |
| **Source reference** | An occurrence whose value is *read* | `console.log(x)`, `list` in `for (let s of list)` |
| **Declaration** | Handled at compile time; creates the identifier in a scope | `var x`, `let x`, `function f(){}` |

Compiler textbooks call targets and sources "LHS" and "RHS"; the book prefers *target/source* because a target is not always on the left of `=` (parameters, loop variables) ✅[^1].

## 3. Lookup, and what happens when it fails

At run time the engine resolves a name by starting in the current scope and walking outward until it finds a declaration. (Engines usually precompute where each name lives, so the "walk" is conceptual ✅[^3].) If nothing is found:

| Reference role | Strict mode | Sloppy (non-strict) mode | Lab |
|---|---|---|---|
| Source (`console.log(nope)`) | `ReferenceError` | `ReferenceError` | — |
| Target (`nope = 1`) | `ReferenceError` | **Silently creates a global variable** | `ReferenceError` in strict ✅[^2] |
| `typeof nope` | `"undefined"` (no error) | `"undefined"` | ✅[^2] |
| `typeof x` while `x` is in its TDZ | `ReferenceError` | `ReferenceError` | ✅[^2] |

The sloppy-mode "accidental global" is why strict mode (and modules, which are always strict) matter: a typo in an assignment becomes an error instead of a hidden global ✅[^4].

## 4. Cheating lexical scope at run time (sloppy mode only)

Two legacy features change scopes after compilation; both are disallowed or neutralized in strict mode ✅[^1]:

| Feature | Sloppy mode | Strict mode |
|---|---|---|
| `eval("var oops = 'Ugh!'")` inside a function | Adds `oops` to that function's scope: the function returns `'Ugh!'` ✅[^2] | The `var` stays inside eval's own scope: `typeof oops2` is `"undefined"` ✅[^2] |
| `with (obj) { oops }` | Treats `obj`'s properties as variables: returns `'Ugh!'` ✅[^2] | `SyntaxError: Strict mode code may not include a with statement` ✅[^2] |

Besides being confusing, both force engines to give up optimizations that depend on scopes being fixed ✅[^1].

## 5. Shadowing

A declaration in an inner scope with the same name as an outer one **shadows** it: inside the inner scope, the outer variable is unreachable by name ✅[^3].

| Case | Result | Lab |
|---|---|---|
| `let` in a block shadowing an outer `var` | Allowed; the outer `var` keeps its value (`'js'`) | ✅[^2] |
| `var` in a nested block "shadowing" an outer block's `let` | `SyntaxError: Identifier 's' has already been declared` — `var` would hoist through the `let`'s scope | ✅[^2] |
| Reaching a shadowed **global** `var` or function | Possible through `globalThis.name` (or `window.name` in a browser classic script), because those globals are also properties of the global object | ✅[^3] |
| Copying an outer value into an inner variable (`let local = outer`) | Creates an independent copy of a primitive; it is *not* access to the outer variable | ✅[^3] |

## 6. Function-name scope, arrow functions

- A **named function expression** (`const f = function askQuestion() {}`) puts its own name `askQuestion` in a small scope visible only inside the function. The name is read-only: assigning to it throws `TypeError: Assignment to constant variable.` in strict code and is silently ignored in sloppy code (`typeof q` stays `"function"`) ✅[^2] ✅[^3].
- **Arrow functions** follow exactly the same lexical scope rules as other functions; what they lack is their own `this`, `arguments` and `super` (see `javascript/advanced-functions/function-objects-and-calls.md`) ✅[^3].

## 7. Where the global scope lives — six environments

"Global" depends on how the code is loaded ✅[^5]:

| Environment | Top-level `var` / function declaration | Top-level `let`/`const`/`class` | Top-level `this` | Evidence |
|---|---|---|---|---|
| Browser classic `<script>` | Global variable **and** property of `window` | Global variable, *not* a `window` property | `window` | Book ch. 4 ✅[^5]; same split measured with indirect `eval` in Node (`javascript/advanced-functions/scope-closures-and-var.md`) |
| Browser ES module (`type="module"`) | Module-scoped | Module-scoped | `undefined` | Book ch. 4 ✅[^5] |
| Web Worker | Global, property of `self` | Global, not a property | `self` | Book ch. 4 ✅[^5] |
| DevTools console / REPL | *Emulates* a classic script's global scope; global-scope, hoisting and top-level `let`/`const` behaviour may be relaxed for convenience, so never use a console to settle a scoping question | — | — | Book ch. 4 ✅[^5] |
| Node CommonJS file | **Module-scoped** (the file is wrapped in a function): `typeof globalThis.cjsTopVar` is `"undefined"` | Module-scoped | `module.exports` (`true` in the lab) | ✅[^2] ✅[^6] |
| Node ES module (`.mjs`) | Module-scoped: `typeof globalThis.esmTopVar` is `"undefined"` | Module-scoped | `undefined` | ✅[^2] |

Two browser quirks belong here: an element with an `id` creates a matching global name on `window` (named access, defined by the HTML standard), and the global `name` property is a string-only setter inherited from `window`, so `var name = 42` in a classic script stores `"42"` ✅[^5] ✅[^7]. **Use `globalThis`** as the one portable name for the global object; in a sloppy plain function call `this` is also the global object (lab: `true`) ✅[^2].

## 8. The lifecycle of a declaration

### 8.1 Hoisting — what is registered before execution

| Declaration | At scope start | Before its line | Lab |
|---|---|---|---|
| `function f() {}` | Name created **and** bound to the function | Callable | ✅[^2] |
| `var v = 1` | Name created, initialized to `undefined` | Reads `undefined` | ✅[^2] |
| `let` / `const` / `class` | Name created, **uninitialized** | Any access throws `ReferenceError` (the TDZ) | ✅[^2] |

So `let` and `const` *are* hoisted — the name is reserved for the whole scope — they are just not initialized until their declaration runs; that is why the block in §1 errs instead of reading the outer `var` ✅[^8].

When a `var` and a function declaration share a name, the function binding is what exists at scope start (`typeof x` is `"function"`), and the later `var x = 1` assignment then overwrites it (`"number"`) ✅[^2].

### 8.2 Re-declaration

| Combination in one scope | Result | Lab |
|---|---|---|
| `var v = 1; var v;` | Allowed; the second is a no-op, `v` stays 1 | ✅[^2] |
| `let x; let x;` / `let x; var x;` | `SyntaxError` | ✅[^2] |
| `const c;` | `SyntaxError: Missing initializer in const declaration` | ✅[^2] |
| `const` reassignment | `TypeError: Assignment to constant variable.` | ✅[^2] |

### 8.3 Loops

Each loop iteration gets a **new** binding for `let`/`const` declared in the loop head:

| Loop | Result | Lab |
|---|---|---|
| `for (let i = 0; i < 3; i++)` callbacks | Each sees its own `i` (0, 1, 2) | ✅[^2] |
| `for (const x of [1, 2])` | Fine: a fresh `x` per iteration, never reassigned | ✅[^2] |
| `for (const i = 0; i < 3; i++)` | `TypeError: Assignment to constant variable.` — the `i++` step reassigns | ✅[^2] |

### 8.4 Implied scopes: parameters and `catch`

- If a function has **non-simple parameters** (any default value, rest parameter or destructuring), the parameter list gets its own scope, outside the body's scope ✅[^9] ✅[^10].
  - A default that reads a later parameter hits its TDZ: `function g(a = b, b)` throws `ReferenceError: Cannot access 'b' before initialization` ✅[^2].
  - A default closure sees the *parameter*, not a body `var` of the same name: `function f(id = 5, get = () => id) { var id = 10; return [id, get()] }` returns `[10, 5]` ✅[^2].
- A `catch (err)` parameter is scoped to the `catch` block only (`typeof err` after it is `"undefined"`), and `catch { … }` without a binding is allowed ✅[^2] ✅[^11].

## 9. Function declarations inside blocks

| Mode | `if (true) { function fib() {} }` | Lab |
|---|---|---|
| Strict | `fib` exists only inside the block (`typeof fib` outside is `"undefined"`) | ✅[^2] |
| Sloppy | Web-compatibility rules (ECMAScript Annex B) also create a function-scoped `var`-like `fib`: it is `undefined` before the block runs and the function after it | ✅[^2] ✅[^12] |

Because the two modes disagree, never declare functions inside blocks in code that might run sloppy; use a `const f = () => …` in the block or declare at function level ✅[^13].

## 10. Least exposure

The **principle of least exposure** says: declare each variable in the innermost scope that needs it ✅[^13]. Benefits: fewer name collisions, no unexpected outside changes, and earlier garbage collection.

| Tool | Use |
|---|---|
| Block with `let`/`const` | Variables needed only for a few statements (e.g. a swap temp) |
| Function scope | Helpers and state used by one function |
| IIFE `(function () { … })()` | A private scope in code that cannot use blocks, or to hide a cache next to a function ✅[^13] |
| Module | State and helpers shared by a file but not exported |

Caveats of an IIFE: because it is a function boundary it changes the meaning of `return`, `this`, `break` and `continue` inside it ✅[^13].

## 11. Closure

### 11.1 Definition

A closure is observed when **a function uses variables from an outer scope while running in a different scope** — typically after the outer function has returned. The function keeps a link to the scope instance where it was created ✅[^14] ✅[^15]. Formally every function closes over its creation scope; the book's narrower, *observable* definition counts only functions that actually reference outer variables and are invoked elsewhere ✅[^14].

### 11.2 Live link, not snapshot

| Program | Result | Lab |
|---|---|---|
| Two counters from one factory, `a()` called three times, `b()` once | `[3, 1]` — each factory call created a separate scope instance | ✅[^2] |
| Read an outer variable after it changed | The new value: lookups are live | ✅[^2] |
| `var` loop callbacks vs `let` loop callbacks | `[3,3,3]` vs `[0,1,2]` | ✅[^2] |

Event handlers, timers and `fetch` callbacks are the everyday closures: they run long after the code that created them returned, and read its variables ✅[^14].

### 11.3 Closure lifetime and garbage collection — measured

Conceptually a closure keeps only the variables it references ✅[^14]. Engines implement this per **scope instance**: V8 allocates one shared *context* object per scope instance for all variables captured by *any* closure created in it. Lab (`node --expose-gc`, objects tracked with `WeakRef`, two forced collections) ✅[^2]:

| Case | Code shape | Large object still alive after GC? |
|---|---|---|
| A | Outer function creates `big`; returns `() => 1`; nothing references `big` | **No** — `big` was never captured |
| B | Same, but a **sibling** closure `const u = () => big` is created (and discarded); the returned `() => 1` never mentions `big` | **Yes** — both closures share one context that holds `big` |
| C | Returned closure references `big` | **Yes** — expected |

A side lesson from the same lab: the first attempt reported everything collected, because the variable holding the closures was itself not referenced by any later code, so V8 collected the closures too. Liveness follows reachability, not source text ✅[^2].

**Practical rules:** release long-lived callbacks (listeners, intervals, caches) when done; do not create throwaway closures that capture large data inside a scope whose other closures live long; set large captured variables to `null` when no longer needed ✅[^14].

### 11.4 Synchronous callbacks

A callback passed to `array.map` runs immediately, in the same scope chain it was written in. The book argues closure only becomes *observable* when a function runs in a different scope or later; for a synchronous callback the distinction makes no practical difference ✅[^9].

## 12. The module pattern

| Shape | State? | Access control? | Example |
|---|---|---|---|
| Namespace | No | No | `const Utils = { formatDate() {…} }` |
| Data structure | Yes | No (everything public) | `const Store = { items: [], add(x) {…} }` |
| **Module** | Yes | **Yes** — private by closure | Factory or IIFE returning a public API |

✅[^16]

- **Module factory** (multiple instances): `function Counter() { let c = 0; return { inc() { return ++c } } }` — two instances keep separate counts (`[2, 1]` in the lab) ✅[^2] ✅[^16].
- **Classic (singleton) module**: the same body wrapped in an IIFE.
- **CommonJS** (Node): one file is one module; `module.exports` is the public API; `require` evaluates a file once and caches it — two `require` calls returned the same object and the file ran once ✅[^2] ✅[^6].
- **ES modules**: file-based, always strict, static `import`/`export`, live read-only bindings, evaluated once (`javascript/modules/es-modules.md`) ✅[^16].
- **AMD and UMD** were loader conventions of the pre-ESM era; UMD wraps one module so it works under AMD, CommonJS or a browser global ✅[^9].

## 13. Edge-case matrix

| Symptom | Root cause | Fix |
|---|---|---|
| `ReferenceError: Cannot access 'x' before initialization` though an outer `x` exists | An inner `let x` later in the same block shadows it from the block's start (TDZ) | Rename, or move the inner declaration to the top |
| A typo creates a global silently | Sloppy-mode target lookup failure | Strict mode or ES modules |
| `typeof x` throws | `x` is in its TDZ | Declare before use |
| Default parameter sees the "wrong" value | Parameter scope is separate from the body | Do not redeclare parameters with `var` |
| Function declared in an `if` exists before the `if` in old code | Annex B sloppy semantics | Strict mode; function expressions in blocks |
| Node file's top-level `var` is not on `globalThis` | CommonJS wraps files in a function | Export it, or assign `globalThis.x` deliberately |
| Memory held by a callback that never uses the data | Sibling closure captured it into the shared context | Narrow scopes; null out large captured data |
| `eval` code changes a local variable | Direct `eval` in sloppy mode | Strict mode, or avoid `eval` |

## 14. How this deep dive was built
- **Primary narrative:** You Don't Know JS Yet, *Scope & Closures* (2nd edition), chapters 1–8 and appendices A–B, read from the author's repository.
- **Checked against:** the ECMAScript specification and MDN for normative behaviour; Node.js documentation for CommonJS.
- **Verified:** every ✅[^2] row ran in `node:24.22.1-alpine` on 2026-11-04 (lab files `s1-syntax.js`, `s2-early.js`, `s3.js`, `s4-gc.js`, `s5.mjs`). Browser-only rows cite their sources and were not run.

## References
- [You Don't Know JS Yet: Scope & Closures, ch. 1 "What's the Scope?"](https://github.com/getify/You-Dont-Know-JS/blob/2nd-ed/scope-closures/ch1.md) — Kyle Simpson, 2nd ed., CC BY-NC-ND 4.0. Backs: two-phase processing, target/source references, runtime cheats. [^1]
- `linux/lab-setup.md` — the Node.js 24.22.1 lab where every ✅[^2] behaviour ran on 2026-11-04. [^2]
- [You Don't Know JS Yet: Scope & Closures, ch. 2–3](https://github.com/getify/You-Dont-Know-JS/blob/2nd-ed/scope-closures/ch3.md) — Kyle Simpson. Backs: conceptual lookup, shadowing rules, function-name scope, arrow functions. [^3]
- [Strict mode](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode) — MDN, living. Backs: accidental globals become errors. [^4]
- [You Don't Know JS Yet: Scope & Closures, ch. 4 "Around the Global Scope"](https://github.com/getify/You-Dont-Know-JS/blob/2nd-ed/scope-closures/ch4.md) — Kyle Simpson. Backs: global scope per environment, DOM globals, `window.name`. [^5]
- [Modules: CommonJS modules](https://nodejs.org/api/modules.html) — Node.js documentation, v24. Backs: module wrapper, caching. [^6]
- [HTML Standard: named access on the Window object](https://html.spec.whatwg.org/multipage/nav-history-apis.html#named-access-on-the-window-object) — WHATWG, living. Backs: `id` globals. [^7]
- [let: temporal dead zone](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let) — MDN, living. Backs: `let` is hoisted but uninitialized. [^8]
- [You Don't Know JS Yet: Scope & Closures, Appendix A](https://github.com/getify/You-Dont-Know-JS/blob/2nd-ed/scope-closures/apA.md) — Kyle Simpson. Backs: parameter scope, synchronous callbacks, AMD/UMD. [^9]
- [ECMAScript: FunctionDeclarationInstantiation](https://tc39.es/ecma262/#sec-functiondeclarationinstantiation) — Ecma TC39, living. Backs: separate environment for non-simple parameters. [^10]
- [try...catch](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch) — MDN, living. Backs: catch binding scope; optional binding. [^11]
- [ECMAScript Annex B.3.2: block-level function declarations web legacy compatibility semantics](https://tc39.es/ecma262/#sec-block-level-function-declarations-web-legacy-compatibility-semantics) — Ecma TC39, living. Backs: sloppy function-in-block behaviour. [^12]
- [You Don't Know JS Yet: Scope & Closures, ch. 6 "Limiting Scope Exposure"](https://github.com/getify/You-Dont-Know-JS/blob/2nd-ed/scope-closures/ch6.md) — Kyle Simpson. Backs: least exposure, IIFE caveats, function declarations in blocks. [^13]
- [You Don't Know JS Yet: Scope & Closures, ch. 7 "Using Closures"](https://github.com/getify/You-Dont-Know-JS/blob/2nd-ed/scope-closures/ch7.md) — Kyle Simpson. Backs: observable closure definition, live links, per-variable view, GC advice. [^14]
- [Closures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures) — MDN, living. Backs: closure as function plus lexical environment. [^15]
- [You Don't Know JS Yet: Scope & Closures, ch. 8 "The Module Pattern"](https://github.com/getify/You-Dont-Know-JS/blob/2nd-ed/scope-closures/ch8.md) — Kyle Simpson. Backs: namespace vs data structure vs module, factories, CommonJS and ESM. [^16]

## Related
- `javascript/advanced-functions/scope-closures-and-var.md` — the short concept doc on the same mechanism.
- `javascript/fundamentals/syntax-variables-and-types.md` — declarations and strict mode basics.
- `javascript/modules/es-modules.md` — ES modules in detail.
