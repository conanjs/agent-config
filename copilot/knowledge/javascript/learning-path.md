---
schema: knowledge-doc/v1
type: reference
topic: javascript
status: verified
applies-to: ["the docs under knowledge/javascript/ as of 2026-11-04", "javascript.info Part 1 (The JavaScript language)"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [javascript, learning-path, curriculum, javascript-info]
---

# JavaScript language learning path

## Summary
**TL;DR:** Seven stages that follow the 14 chapters of javascript.info Part 1, "The JavaScript language": basics, objects, built-in data types, functions in depth, prototypes and classes, errors and asynchronous code, then modules and advanced features. Each stage lists the consolidated docs to read, the original lessons they summarize, an exercise to run in Node 24, and a self-check.
**Use this when:** you start learning JavaScript the language (not the browser APIs), or want to know which doc covers a javascript.info lesson.
**Not this doc:** engine and Node.js runtime internals → `js-runtime/`; number representation → `floating-point/`.

## Scope
The v1 docs under `knowledge/javascript/`, one subtopic per javascript.info Part 1 chapter, with all 94 lessons of that part mapped to a doc. Exercises run with `node:24.22.1-alpine` as described in `linux/lab-setup.md`.

## Catalog

### Stages

| # | Stage | Read | Exercise | Self-check: you can explain … |
|---|---|---|---|---|
| 1 | Basics | `introduction/engines-specs-and-tools.md` → `fundamentals/syntax-variables-and-types.md` → `fundamentals/operators-and-comparisons.md` → `fundamentals/control-flow-and-functions.md` → `code-quality/writing-and-testing-code.md` | Predict, then run, `null >= 0`, `0 ?? 1`, `'2' > '12'`; write one `node:test` spec | … why `null == 0` is false but `null >= 0` true, and when a function is usable before its line |
| 2 | Objects | `object-basics/objects-references-and-this.md` → `object-basics/symbols-and-primitive-conversion.md` | Copy a nested object with spread and with `structuredClone`, then mutate the original | … what `this` is in `const f = obj.m; f()` |
| 3 | Data types | `data-types/numbers-and-strings.md` → `data-types/arrays-and-iterables.md` → `data-types/maps-sets-and-weak-collections.md` → `data-types/destructuring-dates-and-json.md` | Make a `range` object iterable; sort `[1, 15, 2]` with and without a comparator | … the difference between an iterable and an array-like |
| 4 | Functions in depth | `advanced-functions/scope-closures-and-var.md` → `advanced-functions/function-objects-and-calls.md` | Write a caching decorator that keeps `this` | … why `let` loop callbacks see different values and `var` ones do not |
| 5 | Prototypes and classes | `object-properties/property-descriptors-and-accessors.md` → `prototypes/prototypal-inheritance.md` → `classes/classes-and-inheritance.md` → `classes/class-features-and-type-checks.md` | Freeze a config object; subclass `Array` and check what `filter` returns | … what `new` does with `F.prototype`, and why `super()` must come first |
| 6 | Errors and async | `error-handling/errors-and-custom-errors.md` → `async/promises.md` → `async/event-loop-and-async-await.md` → `generators-iterators/generators-and-async-iteration.md` | Log the order of `setTimeout`, `.then` and `queueMicrotask`; time sequential versus parallel awaits | … why `sync → microtasks → timers`, and when to use `Promise.allSettled` |
| 7 | Modules and advanced | `modules/es-modules.md` → `misc/proxy-eval-currying-and-reference-type.md` → `misc/bigint-unicode-and-weakrefs.md` | Import the same module twice and count evaluations; wrap a `Map` in a `Proxy` | … live bindings, and why proxies break `Map` and `#private` |

### Lesson-to-doc map (javascript.info Part 1)

| Chapter | Lessons | Doc(s) |
|---|---|---|
| 1 An introduction | intro, manuals-specifications, code-editors, devtools | `introduction/engines-specs-and-tools.md` |
| 2 Fundamentals | hello-world, structure, strict-mode, variables, types, alert-prompt-confirm, type-conversions, javascript-specials | `fundamentals/syntax-variables-and-types.md` |
| 2 Fundamentals | operators, comparison, logical-operators, nullish-coalescing-operator | `fundamentals/operators-and-comparisons.md` |
| 2 Fundamentals | ifelse, while-for, switch, function-basics, function-expressions, arrow-functions-basics | `fundamentals/control-flow-and-functions.md` |
| 3 Code quality | debugging-chrome, coding-style, comments, ninja-code, testing-mocha, polyfills | `code-quality/writing-and-testing-code.md` |
| 4 Objects: the basics | object, object-copy, garbage-collection, object-methods, constructor-new, optional-chaining | `object-basics/objects-references-and-this.md` |
| 4 Objects: the basics | symbol, object-toprimitive | `object-basics/symbols-and-primitive-conversion.md` |
| 5 Data types | primitives-methods, number, string | `data-types/numbers-and-strings.md` |
| 5 Data types | array, array-methods, iterable | `data-types/arrays-and-iterables.md` |
| 5 Data types | map-set, weakmap-weakset, keys-values-entries | `data-types/maps-sets-and-weak-collections.md` |
| 5 Data types | destructuring-assignment, date, json | `data-types/destructuring-dates-and-json.md` |
| 6 Advanced working with functions | closure, var, global-object | `advanced-functions/scope-closures-and-var.md` |
| 6 Advanced working with functions | recursion, rest-parameters-spread, function-object, new-function, settimeout-setinterval, call-apply-decorators, bind, arrow-functions | `advanced-functions/function-objects-and-calls.md` |
| 7 Object properties configuration | property-descriptors, property-accessors | `object-properties/property-descriptors-and-accessors.md` |
| 8 Prototypes, inheritance | prototype-inheritance, function-prototype, native-prototypes, prototype-methods | `prototypes/prototypal-inheritance.md` |
| 9 Classes | class, class-inheritance | `classes/classes-and-inheritance.md` |
| 9 Classes | static-properties-methods, private-protected-properties-methods, extend-natives, instanceof, mixins | `classes/class-features-and-type-checks.md` |
| 10 Error handling | try-catch, custom-errors | `error-handling/errors-and-custom-errors.md` |
| 11 Promises, async/await | callbacks, promise-basics, promise-chaining, promise-error-handling, promise-api, promisify | `async/promises.md` |
| 11 Promises, async/await | microtask-queue, async-await | `async/event-loop-and-async-await.md` |
| 12 Generators, advanced iteration | generators, async-iterators-generators | `generators-iterators/generators-and-async-iteration.md` |
| 13 Modules | modules-intro, import-export, modules-dynamic-imports | `modules/es-modules.md` |
| 14 Miscellaneous | proxy, eval, currying-partials, reference-type | `misc/proxy-eval-currying-and-reference-type.md` |
| 14 Miscellaneous | bigint, unicode, weakref-finalizationregistry | `misc/bigint-unicode-and-weakrefs.md` |

### Deep dives (read after the matching stage)

| After stage | Deep dive |
|---|---|
| 3 Data types | `data-types/types-and-coercion-deep-dive.md`, `regular-expressions/regular-expressions-deep-dive.md` |
| 4 Functions in depth | `advanced-functions/scope-and-closures-deep-dive.md` |
| 5 Prototypes and classes | `prototypes/objects-this-and-delegation-deep-dive.md` |
| 6 Errors and async | `async/async-patterns-and-performance-deep-dive.md` |
| 7 Modules and advanced | `misc/build-a-small-language-deep-dive.md` |

### Free, authoritative resources

| Resource | Why |
|---|---|
| [The Modern JavaScript Tutorial](https://javascript.info/) | The lesson sequence these docs consolidate, with tasks per lesson |
| [ECMAScript Language Specification](https://tc39.es/ecma262/) | The normative definition of every behaviour |
| [MDN JavaScript reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference) | Per-feature reference with examples and browser support |

### Not yet covered in this knowledge base

| Topic | Fits under | Start with |
|---|---|---|
| Browser APIs: DOM, events, forms (javascript.info Part 2) | new `browser/` topic | javascript.info Part 2 |
| Network requests, storage, workers (javascript.info Part 3) | new `browser/` topic | javascript.info Part 3 |
| `Temporal` and `Intl` date handling | `javascript/data-types/` | MDN `Intl` |

## Lookup notes
- Every behaviour in the stage docs was run in Node 24.22.1 on 2026-11-04; the Node container's time zone was UTC, which matters for `Date` examples.
- The docs summarize lessons in new words and add measured results; the lessons' tasks and longer explanations remain worth doing on javascript.info.

## Takeaways
- Follow the stages in order; later stages (classes, async) rely on `this`, closures and prototypes from earlier ones.
- Run every exercise in Node and compare with the doc before moving on.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 0 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [The Modern JavaScript Tutorial, Part 1: The JavaScript language](https://javascript.info/js) — javascript.info, living. Backs: chapter and lesson structure of the map.
- [ECMAScript Language Specification](https://tc39.es/ecma262/) — Ecma TC39, living. Backs: resources table.
- [MDN JavaScript reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference) — MDN, living. Backs: resources table.
- `linux/lab-setup.md` — the Node 24.22.1 lab every exercise runs in.

## Related
- `js-runtime/` — engine and Node.js runtime behaviour.
- `floating-point/` — how JavaScript numbers are stored and rounded.
