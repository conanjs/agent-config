---
schema: knowledge-doc/v1
type: concept
topic: javascript/classes
status: verified
applies-to: ["ECMAScript 2025", "Node.js 24"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [javascript, class, constructor, extends, super, class-fields, homeobject, static, inheritance]
---

# Classes, `extends` and `super`

## Summary
**TL;DR:** `class` is mostly a structured way to build a constructor function and its `prototype`, with differences that matter: classes must be called with `new`, run in strict mode, are not hoisted into usability before their line, and their methods are non-enumerable. **Fields** (`name = 'x'`) are set on each instance. `class B extends A` links `B.prototype` to `A.prototype` *and* `B` to `A` (so statics inherit). A derived constructor must call `super(...)` before using `this`; `super.method()` calls the parent's version through the method's fixed `[[HomeObject]]`. Field initializers of a derived class run **after** the parent constructor finishes.
**Use this when:** writing or reading class hierarchies, debugging `this` before `super`, or explaining why a parent constructor sees the parent's field value.
**Not this doc:** statics, private fields, extending built-ins, `instanceof` and mixins → `javascript/classes/class-features-and-type-checks.md`; prototypes underneath → `javascript/prototypes/prototypal-inheritance.md`.

## Problem
A subclass constructor throws `ReferenceError` on `this`; a parent constructor logs `'animal'` even though the subclass overrides the field; a method copied to another object calls the wrong `super`; calling a class without `new` fails. These follow from how classes set up prototypes, fields and `[[HomeObject]]`.

## Mental model
**Analogy:** a class is a blueprint with a building crew (the constructor). In a subclass, the parent's crew must lay the foundation first (`super()`) before the child's crew can add rooms (`this`); the child's furniture (fields) is moved in only after the parent's crew leaves.

**Artifact:** class basics in Node 24 ✅[^1]:
```js
class User {
  static count = 0;
  name = 'def';
  constructor(n) { this.name = n; User.count++; }
  hi() { return this.name; }
  get up() { return this.name.toUpperCase(); }
}
const u = new User('a');
[typeof User, u.hi(), u.up, User.count, Object.keys(u)]  // ['function', 'a', 'A', 1, ['name']]
Object.getOwnPropertyDescriptor(User.prototype, 'hi').enumerable  // false
```

## How it works
1. **What `class` creates.** A function named after the class whose body is the `constructor`; methods go on `ClassName.prototype` as non-enumerable properties ✅[^1] ✅[^2]. Getters/setters and computed method names work as in object literals ✅[^2].
2. **Differences from a plain function.** Calling it without `new` throws `TypeError`; the body is always strict; using the class before its declaration throws `ReferenceError` (temporal dead zone) ✅[^1] ✅[^2].
3. **Fields.** `name = 'def'` is set on each instance (not on the prototype) before the constructor body runs in a base class ✅[^1] ✅[^2]. An arrow-function field (`click = () => this.v`) captures the instance, so it stays bound when passed as a callback ✅[^1] ✅[^2].
4. **`extends`.** `class B extends A` sets `Object.getPrototypeOf(B.prototype) === A.prototype` and `Object.getPrototypeOf(B) === A`; `extends` accepts any expression that returns a class ✅[^1] ✅[^3].
5. **Derived constructors.** A derived class without a constructor gets `constructor(...args) { super(...args) }`. With one, it must call `super(...)` before touching `this`; otherwise `ReferenceError` ✅[^1] ✅[^3].
6. **Overriding methods.** `super.speak()` inside `B.speak` calls `A.prototype.speak` with the same `this` ✅[^1] ✅[^3]. Arrow functions inside methods use the method's `super` ✅[^3].
7. **Field initialization order.** Base-class fields are initialized before the base constructor body; derived-class fields right after `super()` returns. So a parent constructor reading `this.name` sees the parent's field (`'animal'`), not the child's (`'rabbit'`) ✅[^1] ✅[^3].
8. **`[[HomeObject]]`.** A method defined with method syntax remembers the object it was defined in, and `super` resolves through it. Copying such a method to another object keeps the old `super`: the lab's copied `hi` still called `animal.hi` ✅[^1] ✅[^3].

## Worked example
Animal → Rabbit:

| Step | Code | Result |
|---|---|---|
| 1 | `class A { constructor(n) { this.n = n } speak() { return 'A:' + this.n } }` | — |
| 2 | `class B extends A { constructor(n) { super(n); this.k = 1 } speak() { return super.speak() + '+B' } }` | — |
| 3 | `new B('x').speak()` | `'A:x+B'` ✅[^1] |
| 4 | `new B('x') instanceof A` | `true` ✅[^1] |
| 5 | `class C extends A { constructor() { this.z = 1 } }; new C()` | `ReferenceError` — `this` before `super` ✅[^1] |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `User()` without `new` | `TypeError` | Classes require `new` ✅[^1] |
| `new L()` before `class L {}` | `ReferenceError` | Temporal dead zone ✅[^1] |
| Parent constructor uses an overridden field | Sees the parent's value | Derived fields initialize after `super()` ✅[^1] |
| Parent constructor calls an overridden **method** | Calls the child's method | Methods live on the prototype chain ✅[^3] |
| Method copied between objects uses `super` | Still refers to the original parent | `[[HomeObject]]` is fixed ✅[^1] |
| `for…in` over an instance | Methods not listed | Class methods are non-enumerable ✅[^1] |

## Takeaways
- Call `super(...)` first in every derived constructor. [rule-candidate]
- Do not rely on overridden fields inside a parent constructor; pass values as constructor arguments instead.
- Use arrow-function fields only for methods that are passed as callbacks; they cost one function per instance.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 30 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- `linux/lab-setup.md` — the Node 24.22.1 lab where every behaviour marked with this note ran on 2026-11-04. [^1]
- [Class basic syntax](https://javascript.info/class) — javascript.info, living. Backs: what `class` creates, differences from functions, fields, bound arrow fields. [^2]
- [Class inheritance](https://javascript.info/class-inheritance) — javascript.info, living. Backs: `extends`, `super`, derived constructors, field initialization order, `[[HomeObject]]`. [^3]
- [Classes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes) — MDN, living. Background: class syntax reference.

## Related
- `javascript/classes/class-features-and-type-checks.md`
- `javascript/prototypes/prototypal-inheritance.md`
