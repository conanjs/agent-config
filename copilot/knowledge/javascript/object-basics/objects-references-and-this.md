---
schema: knowledge-doc/v1
type: concept
topic: javascript/object-basics
status: verified
applies-to: ["ECMAScript 2025", "Node.js 24"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [javascript, objects, references, copying, structuredclone, garbage-collection, this, methods, constructors, new, optional-chaining]
---

# Objects: references, copying, garbage collection, `this` and constructors

## Summary
**TL;DR:** An object is a collection of keyed properties, and a variable holds a **reference** to it, not the object itself — assignment copies the reference, `===` compares references, and `Object.assign`/spread make only **shallow** copies (`structuredClone` makes deep ones). Objects live as long as they are **reachable** from roots; the garbage collector frees the rest. Inside a method, `this` is **the object before the dot at call time**, so a method detached from its object loses it (arrow functions take `this` from outside). `new F()` creates an object, runs `F` with `this` bound to it and returns it. `?.` stops a property chain at `null`/`undefined` instead of throwing.
**Use this when:** an object changes "by itself" after a copy, `this` is `undefined` in a callback, a constructor returns something unexpected, or you read deeply nested data that may be missing.
**Not this doc:** property flags and getters → `javascript/object-properties/property-descriptors-and-accessors.md`; prototypes → `javascript/prototypes/prototypal-inheritance.md`; symbol keys and conversion to primitives → `javascript/object-basics/symbols-and-primitive-conversion.md`.

## Problem
A copied settings object shares nested data with the original; a method passed as a callback throws `Cannot read properties of undefined`; iterating an object returns keys in an order that is neither alphabetical nor insertion order; a lookup on optional data crashes the page. These all come from the reference model and the `this` rule.

## Mental model
**Analogy:** a variable holding an object is a slip of paper with the object's address. Copying the slip gives two slips with the same address — both lead to one house. `this` is "whoever's name is on the doorbell I just rang": the same function rings different doorbells depending on how it is called.

**Artifact:** shallow versus deep copy in Node 24 ✅[^1]:
```js
const o = { n: { v: 1 }, d: new Date(0), m: new Map([[1, 2]]) };
const shallow = { ...o };
const deep = structuredClone(o);
o.n.v = 2;
shallow.n.v   // 2 — shares the nested object
deep.n.v      // 1 — independent; deep.d is still a Date, deep.m.get(1) is 2
```

## How it works
1. **Properties.** Keys are strings or symbols; reserved words such as `for` and `return` are allowed as keys ✅[^1] ✅[^2]. `obj[expr]` and computed keys `{[k + 'Key']: 1}` use any expression; shorthand `{x}` means `{x: x}` ✅[^1]. `'k' in obj` tells "absent" from "present with value `undefined`" ✅[^1] ✅[^2].
2. **Key order.** Integer-like keys come first in ascending order, then other string keys in creation order: `{b, 2, a, 1, '-1', '01'}` lists as `1, 2, b, a, -1, 01` ✅[^1] ✅[^2].
3. **References.** Assignment copies the reference; two distinct objects with equal contents are not `==` ✅[^1] ✅[^3]. `Object.assign({}, src)` and `{...src}` copy top-level properties only; `structuredClone` deep-copies, keeps `Date` and `Map`, and throws `DOMException` on functions ✅[^1] ✅[^3].
4. **Garbage collection.** Values reachable from roots (the running function's locals, globals, the call stack) stay in memory; anything unreachable — even a group of objects referencing each other — is freed. The basic algorithm is mark-and-sweep, with optimizations such as generational and incremental collection ✅[^4].
5. **Methods and `this`.** A function stored in a property is a method; `this` inside it is set at call time to the object before the dot. Copying `user.hi` into `f` and calling `f()` gives `this === undefined` in strict mode ✅[^1] ✅[^5]. An arrow function has no own `this` and uses the enclosing function's ✅[^1] ✅[^5].
6. **Constructors and `new`.** `new F()` creates an empty object, binds it to `this`, runs `F`, and returns `this` — unless `F` explicitly returns an *object*, which replaces it; returning a primitive is ignored ✅[^1] ✅[^6]. `new.target` is `F` when called with `new`, `undefined` otherwise ✅[^1] ✅[^6].
7. **Optional chaining.** `a?.b`, `a?.[k]` and `a?.m()` return `undefined` if `a` is `null`/`undefined`, and skip the rest of the chain — including side effects in later brackets ✅[^1] ✅[^7]. `delete a?.b` is allowed; `a?.b = 1` is not ✅[^7].

## Worked example
Passing a method as a callback:

| Step | Code | Result |
|---|---|---|
| 1 | `const user = { name: 'A', hi() { return this?.name } }` | — |
| 2 | `user.hi()` | `'A'` — `this` is `user` ✅[^1] |
| 3 | `const f = user.hi; f()` | `undefined` — no object before the dot ✅[^1] |
| 4 | `setTimeout(user.hi, 0)` | Same loss of `this` |
| 5 | Fix: `setTimeout(() => user.hi(), 0)` or `user.hi.bind(user)` | `'A'` (see `javascript/advanced-functions/function-objects-and-calls.md`) |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `const o = {}; o.a = 1` | Allowed | `const` fixes the reference, not the contents ✅[^1] |
| Constructor returns `{b: 2}` | `new` yields `{b: 2}` | Returned objects replace `this` ✅[^1] |
| `user?.address.street` with `user = null` | `undefined`, no error | The whole chain short-circuits ✅[^1] |
| Object with a cycle passed to `structuredClone` | Works | Structured cloning tracks visited objects ✅[^3] |
| `__proto__` as a key in a literal | Sets the prototype, not an own key | Special legacy accessor ✅[^1] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Spread / `Object.assign` | Fast, simple | Nested objects shared |
| `structuredClone` | True deep copy, handles cycles, `Map`, `Date` | Drops functions (throws), class prototypes are lost |
| Immutable updates (copy on write) | Safe sharing | More allocation |

## Takeaways
- Treat object variables as references; copy deliberately and know whether the copy is shallow. [rule-candidate]
- Never pass `obj.method` bare as a callback; wrap it or bind it. [rule-candidate]
- Use `?.` only where absence is legitimate; overusing it hides real bugs.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 31 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- `linux/lab-setup.md` — the Node 24.22.1 lab where every behaviour marked with this note ran on 2026-11-04. [^1]
- [Objects](https://javascript.info/object) — javascript.info, living. Backs: property syntax, `in`, key ordering. [^2]
- [Object references and copying](https://javascript.info/object-copy) — javascript.info, living. Backs: references, shallow copy, `structuredClone`. [^3]
- [Garbage collection](https://javascript.info/garbage-collection) — javascript.info, living. Backs: reachability, roots, mark-and-sweep and optimizations. [^4]
- [Object methods, "this"](https://javascript.info/object-methods) — javascript.info, living. Backs: `this` at call time; arrows have no own `this`. [^5]
- [Constructor, operator "new"](https://javascript.info/constructor-new) — javascript.info, living. Backs: steps of `new`, return override, `new.target`. [^6]
- [Optional chaining '?.'](https://javascript.info/optional-chaining) — javascript.info, living. Backs: short-circuiting, `delete` allowed, assignment not. [^7]

## Related
- `javascript/object-basics/symbols-and-primitive-conversion.md`
- `js-runtime/v8-hidden-classes.md` — how property order affects V8 object shapes.
