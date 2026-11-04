---
schema: topic-index/v1
kind: subtopic
topic: javascript/misc
last-updated: 2026-11-04
---

# Miscellaneous

Proxy and Reflect, `eval`, currying, the Reference Type, BigInt, Unicode string internals, WeakRef and FinalizationRegistry. Consolidates javascript.info Part 1, chapter 14.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [proxy-eval-currying-and-reference-type.md](proxy-eval-currying-and-reference-type.md) | concept | Proxy traps with Reflect and their limits (internal slots, private fields), `eval` scopes, currying, and how the Reference Type carries `this` | verified |
| [bigint-unicode-and-weakrefs.md](bigint-unicode-and-weakrefs.md) | reference | Lookup tables for BigInt rules, UTF-16 surrogate pairs and normalization, and `WeakRef`/`FinalizationRegistry` behaviour | verified |

## References
- [The Modern JavaScript Tutorial, Part 1: The JavaScript language](https://javascript.info/js) — javascript.info, living. Backs: subtopic scope (one subtopic per chapter).
- [ECMAScript Language Specification](https://tc39.es/ecma262/) — Ecma TC39, living. Backs: topic scope.

## Related
- `javascript/learning-path.md` — where this subtopic sits in the learning order.
- `js-runtime/` — engine and Node.js runtime behaviour.
