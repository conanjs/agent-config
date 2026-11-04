---
schema: topic-index/v1
kind: subtopic
topic: javascript/object-basics
last-updated: 2026-11-04
---

# Objects: the basics

Objects as references, copying and `structuredClone`, garbage collection by reachability, methods and `this`, constructors and `new`, optional chaining, symbols and object-to-primitive conversion. Consolidates javascript.info Part 1, chapter 4.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [objects-references-and-this.md](objects-references-and-this.md) | concept | Objects are held by reference; shallow versus deep copy, reachability-based garbage collection, `this` set at call time, what `new` does, optional chaining | verified |
| [symbols-and-primitive-conversion.md](symbols-and-primitive-conversion.md) | concept | Symbols as unique hidden keys and the global registry; `Symbol.toPrimitive` hints and the `toString`/`valueOf` fallback order | verified |

## References
- [The Modern JavaScript Tutorial, Part 1: The JavaScript language](https://javascript.info/js) — javascript.info, living. Backs: subtopic scope (one subtopic per chapter).
- [ECMAScript Language Specification](https://tc39.es/ecma262/) — Ecma TC39, living. Backs: topic scope.

## Related
- `javascript/learning-path.md` — where this subtopic sits in the learning order.
- `js-runtime/` — engine and Node.js runtime behaviour.
