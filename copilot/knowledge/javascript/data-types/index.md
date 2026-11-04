---
schema: topic-index/v1
kind: subtopic
topic: javascript/data-types
last-updated: 2026-11-04
---

# Data types

Methods of primitives, numbers, strings, arrays and their methods, the iteration protocol, `Map`/`Set`/`WeakMap`/`WeakSet`, object entries, destructuring, `Date` and JSON. Consolidates javascript.info Part 1, chapter 5.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [numbers-and-strings.md](numbers-and-strings.md) | reference | Lookup tables for primitive wrappers, number literals, parsing, rounding and tests, and string access, search, slicing, comparison and Unicode length | verified |
| [arrays-and-iterables.md](arrays-and-iterables.md) | reference | Lookup tables for array basics, mutating versus copying methods, search and transform methods, and the `Symbol.iterator` protocol | verified |
| [maps-sets-and-weak-collections.md](maps-sets-and-weak-collections.md) | concept | `Map` and `Set` versus plain objects, `Object.entries`/`fromEntries`, and `WeakMap`/`WeakSet` for leak-free object-keyed caches | verified |
| [destructuring-dates-and-json.md](destructuring-dates-and-json.md) | reference | Lookup tables for destructuring patterns, `Date` (0-based months, overflow, timestamps) and JSON (what `stringify` drops, replacers, revivers) | verified |
| [types-and-coercion-deep-dive.md](types-and-coercion-deep-dive.md) | deep-dive | Abstract conversion operations as tables, the `+` operator, four equality algorithms with the loose-equality steps, relational comparison, `==` vs `===` reconciled, grammar traps | verified |
| [data-structures-in-javascript-deep-dive.md](data-structures-in-javascript-deep-dive.md) | deep-dive | V8 elements kinds, measured costs (includes vs Set, shift queues, object vs Map churn, unshift, typed arrays), sorting rules, binary search, heap top-k, trie, decision table | verified |

## References
- [The Modern JavaScript Tutorial, Part 1: The JavaScript language](https://javascript.info/js) — javascript.info, living. Backs: subtopic scope (one subtopic per chapter).
- [ECMAScript Language Specification](https://tc39.es/ecma262/) — Ecma TC39, living. Backs: topic scope.

## Related
- `javascript/learning-path.md` — where this subtopic sits in the learning order.
- `js-runtime/` — engine and Node.js runtime behaviour.
