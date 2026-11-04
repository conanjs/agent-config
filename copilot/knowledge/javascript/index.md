---
schema: topic-index/v1
kind: topic
topic: javascript
last-updated: 2026-11-04
---

# JavaScript, the language

The JavaScript language as taught in Part 1 of javascript.info ("The JavaScript language"), consolidated into 24 docs written in our own words, one subtopic per chapter, from the basics (types, operators, functions) through objects, data types, closures, prototypes, classes, errors, promises and `async`/`await`, generators, modules and advanced features (Proxy, BigInt, Unicode, WeakRef). Seven deep dives go further: four built on You Don't Know JS (scope and closures; objects, `this` and delegation; types and coercion; async and performance) and two on Eloquent JavaScript (regular expressions; building a small language). Every behaviour was run in Node.js 24.22.1. Start with `learning-path.md`, which also maps all 94 lessons to their doc. Not covered: browser APIs (javascript.info Parts 2 and 3), engine and Node.js runtime internals (see `js-runtime/`).

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [learning-path.md](learning-path.md) | reference | Seven stages with an exercise and self-check each, plus a map of all 94 Part 1 lessons to the doc that covers them | verified |

## Subtopics
| Subtopic | Summary |
|---|---|
| [introduction/](introduction/index.md) | Engines, the ECMA-262 specification, MDN, support tables, editors and DevTools |
| [fundamentals/](fundamentals/index.md) | Strict mode, variables, the eight types and conversions, operators, `??`, control flow, function syntaxes |
| [code-quality/](code-quality/index.md) | Debugging, style, comments, tests with Mocha or `node --test`, transpilers and polyfills |
| [object-basics/](object-basics/index.md) | References and copying, garbage collection, `this`, `new`, optional chaining, symbols, conversion to primitives |
| [data-types/](data-types/index.md) | Numbers, strings, arrays, iterables, `Map`/`Set`/weak collections, destructuring, `Date`, JSON |
| [advanced-functions/](advanced-functions/index.md) | Closures, `var`, global object, recursion, rest/spread, function objects, timers, `call`/`apply`/`bind` |
| [object-properties/](object-properties/index.md) | Property flags and descriptors, freeze/seal, getters and setters |
| [prototypes/](prototypes/index.md) | Prototype chain, `F.prototype`, native prototypes, `Object.create(null)` |
| [classes/](classes/index.md) | Classes, `extends`/`super`, static and private members, built-in subclasses, `instanceof`, mixins |
| [error-handling/](error-handling/index.md) | `try…catch…finally`, custom error hierarchies, wrapping with `cause` |
| [async/](async/index.md) | Callbacks, promises, combinators, promisification, microtasks, `async`/`await` |
| [generators-iterators/](generators-iterators/index.md) | Generators, `yield*`, async iteration and async generators |
| [modules/](modules/index.md) | ES modules, export/import forms, live bindings, dynamic `import()` |
| [misc/](misc/index.md) | Proxy and Reflect, `eval`, currying, Reference Type, BigInt, Unicode, WeakRef; building a small language (deep dive) |
| [regular-expressions/](regular-expressions/index.md) | Flags, Unicode, groups, lookaround, backtracking and ReDoS, methods and `lastIndex` (deep dive) |

## References
- [The Modern JavaScript Tutorial, Part 1: The JavaScript language](https://javascript.info/js) — javascript.info, living. Backs: topic scope and structure.
- [ECMAScript Language Specification](https://tc39.es/ecma262/) — Ecma TC39, living. Backs: topic scope.

## Related
- `js-runtime/` — V8 and Node.js runtime behaviour.
- `floating-point/` — how JavaScript numbers are stored and rounded.
- `linux/lab-setup.md` — the lab every example ran in.
