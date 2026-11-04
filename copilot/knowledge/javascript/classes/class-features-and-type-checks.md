---
schema: knowledge-doc/v1
type: concept
topic: javascript/classes
status: verified
applies-to: ["ECMAScript 2025", "Node.js 24"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [javascript, static, private-fields, protected, extends-array, symbol-species, instanceof, symbol-hasinstance, tostringtag, mixins]
---

# Static members, private fields, extending built-ins, type checks and mixins

## Summary
**TL;DR:** `static` members belong to the class itself and are inherited by subclasses (`B.make()` with `new this()` creates a `B`). **Private** members (`#x`) are enforced by the language: unreachable from outside, even through `this['#x']`, with `#x in obj` as a brand check; "protected" (`_x`) is only a naming convention. Subclasses of built-ins like `Array` return instances of the subclass from `filter`/`map` (via `Symbol.species`), but do not inherit the built-in's *static* methods. `instanceof` walks the prototype chain and can be customized with `Symbol.hasInstance`; `Object.prototype.toString` with `Symbol.toStringTag` gives a precise type string. Mixins copy methods into a prototype to share behaviour without inheritance.
**Use this when:** designing a class API, hiding internal state, extending `Array`/`Error`/`Map`, checking types at run time, or sharing behaviour across unrelated classes.
**Not this doc:** class basics and `super` → `javascript/classes/classes-and-inheritance.md`; how private fields compare with TypeScript `private` → `js-runtime/private-fields.md`.

## Problem
"Private" `_fields` get modified by callers; a custom `Array` subclass loses its methods after `filter`; `instanceof` fails across realms or for duck-typed objects; behaviour needed by two unrelated classes leads to an awkward common base class.

## Mental model
**Analogy:** a static method is the factory's front desk (one per factory, not per product); a private field is a sealed compartment only the factory's own tools can open; a mixin is a toolkit you bolt onto several different machines.

**Artifact:** a private field with a validating setter and a brand check, in Node 24 ✅[^1]:
```js
class C {
  #w = 0;
  set w(v) { if (v < 0) throw new Error('neg'); this.#w = v; }
  get w() { return this.#w; }
  static has(o) { return #w in o; }
}
const c = new C(); c.w = 5;
[c.w, C.has(c), C.has({})]     // [5, true, false]
eval('c.#w')                   // SyntaxError — not accessible outside the class body
```

## How it works
1. **Static members.** `static count = 0` and `static make()` live on the class; `this` inside a static method is the class it was called on, so `static make() { return new this() }` builds subclasses correctly; `Object.getPrototypeOf(B) === A` makes statics inherit ✅[^1] ✅[^2].
2. **Protected by convention.** A leading underscore signals "internal, subclasses may use" but is not enforced ✅[^3].
3. **Private members.** `#name` fields and methods are reachable only inside the class body; access from outside is a `SyntaxError` at parse time, and `#x in obj` checks whether an object has that private field ✅[^1] ✅[^3] ✅[^7]. Proxies cannot forward private access (see `javascript/misc/proxy-eval-currying-and-reference-type.md`) ✅[^1].
4. **Extending built-ins.** `class PowerArray extends Array` instances get the new methods, and `filter`/`map` return `PowerArray` instances because the built-ins create results via `this.constructor[Symbol.species]` ✅[^1] ✅[^4]. `PowerArray` inherits `Array`'s statics (`PowerArray.isArray`, `PowerArray.from`), but built-in classes do not inherit statics from each other: `Object.keys` exists while `Array.keys` (and so `PowerArray.keys`) is `undefined` ✅[^1] ✅[^4].
5. **`instanceof`.** `obj instanceof C` checks whether `C.prototype` is anywhere in `obj`'s chain, unless `C` defines `static [Symbol.hasInstance](obj)` — the lab's `B` accepted any object with `canEat` ✅[^1] ✅[^5].
6. **Type strings.** `Object.prototype.toString.call(x)` returns `[object Null]`, `[object Array]`, and for objects with `Symbol.toStringTag` the custom tag, e.g. `[object User]` ✅[^1] ✅[^5].
7. **Mixins.** `Object.assign(User.prototype, sayHiMixin)` copies methods so every `User` can call them; mixins can inherit from other mixins and use `super` within that chain ✅[^1] ✅[^6]. A typical use is an event-emitter mixin (`on`, `off`, `trigger`) ✅[^6].

## Worked example
A `PowerArray` that keeps its type through transformations:

| Step | Code | Result |
|---|---|---|
| 1 | `class PA extends Array { isEmpty() { return this.length === 0 } }` | — |
| 2 | `const a = PA.from([1, 2, 3])` | A `PA` (static `from` inherited from `Array`) |
| 3 | `const f = a.filter(x => x > 1)` | `f instanceof PA` is `true` ✅[^1] |
| 4 | `f.isEmpty()` | `false` ✅[^1] |
| 5 | Override `static get [Symbol.species]() { return Array }` | `filter` would return plain arrays ✅[^4] |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `this['#w']` | Reads a normal property named `'#w'`, not the private field | Private names are not strings ✅[^3] |
| Private field on a subclass instance accessed from the subclass | `SyntaxError` | Privacy is per class body ✅[^3] |
| Object from another realm (iframe) with `instanceof Array` | `false` | Different `Array.prototype`; use `Array.isArray` ✅[^5] |
| Mixin method name clashes with a class method | Last assignment wins | `Object.assign` overwrites ✅[^6] |
| `Symbol.hasInstance` defined | `instanceof` ignores the prototype chain | Custom check wins ✅[^1] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| `#private` | Enforced privacy, brand checks | Not visible to subclasses or proxies |
| `_protected` | Subclasses can use it; works with proxies | Not enforced |
| Inheritance | Shared implementation, `instanceof` | Rigid hierarchy |
| Mixin | Share behaviour across hierarchies | Name clashes; less obvious origin |

## Takeaways
- Use `#private` for invariants that callers must not break; use `_name` only when subclasses need access.
- Check arrays with `Array.isArray`, and other built-in types with `Object.prototype.toString`, rather than `instanceof` across realms.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 27 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- `linux/lab-setup.md` — the Node 24.22.1 lab where every behaviour marked with this note ran on 2026-11-04. [^1]
- [Static properties and methods](https://javascript.info/static-properties-methods) — javascript.info, living. Backs: static members, `this` in statics, static inheritance. [^2]
- [Private and protected properties and methods](https://javascript.info/private-protected-properties-methods) — javascript.info, living. Backs: `_` convention, `#` privacy, `this['#x']`. [^3]
- [Extending built-in classes](https://javascript.info/extend-natives) — javascript.info, living. Backs: subclass results via `Symbol.species`, static inheritance of built-ins. [^4]
- [Class checking: "instanceof"](https://javascript.info/instanceof) — javascript.info, living. Backs: prototype-chain check, `Symbol.hasInstance`, `toString` type strings, `Symbol.toStringTag`. [^5]
- [Mixins](https://javascript.info/mixins) — javascript.info, living. Backs: `Object.assign` mixins, mixin inheritance, event mixin. [^6]
- [Private properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_properties) — MDN, living. Backs: `#x in obj` brand checks, early `SyntaxError`. [^7]

## Related
- `js-runtime/private-fields.md`
- `javascript/object-basics/symbols-and-primitive-conversion.md`
