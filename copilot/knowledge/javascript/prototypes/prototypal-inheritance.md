---
schema: knowledge-doc/v1
type: concept
topic: javascript/prototypes
status: verified
applies-to: ["ECMAScript 2025", "Node.js 24"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [javascript, prototype, proto, prototype-chain, object-create, constructor-prototype, native-prototypes, null-prototype, setprototypeof]
---

# Prototypal inheritance, `F.prototype` and native prototypes

## Summary
**TL;DR:** Every object has a hidden link `[[Prototype]]` to another object or `null`. Reading a missing property follows that chain; **writing** always creates or changes an own property; `this` in an inherited method is still the object before the dot. `new F()` sets the new object's `[[Prototype]]` to `F.prototype`, whose default value is `{constructor: F}`. Built-ins work the same way: `[]` → `Array.prototype` → `Object.prototype` → `null`, and primitives borrow methods from `String.prototype`, `Number.prototype` and so on. Use `Object.create`, `Object.getPrototypeOf` and `Object.setPrototypeOf`, not `__proto__`, and `Object.create(null)` for a dictionary with no inherited keys.
**Use this when:** reading class or library internals, debugging a property that "comes from nowhere", writing a polyfill, or building a safe key-value store.
**Not this doc:** class syntax on top of prototypes → `javascript/classes/classes-and-inheritance.md`.

## Problem
A method defined once appears on every instance; `for…in` lists properties nobody set; storing the user-supplied key `"__proto__"` in a plain object does nothing; changing `Array.prototype` breaks third-party code. All follow from the prototype chain.

## Mental model
**Analogy:** asking a child for a phone number: if the child does not know it, they ask their parent, who may ask the grandparent. But when the child *learns* a new number, they write it in their own notebook — they never change the parent's.

**Artifact:** read through the chain, write to the own object, in Node 24 ✅[^1]:
```js
const animal = { eats: true, walk() { return 'walk' } };
const rabbit = { __proto__: animal, jumps: true };
rabbit.walk = () => 'own';
[rabbit.eats, rabbit.walk(), animal.walk(), Object.getPrototypeOf(rabbit) === animal]
// [true, 'own', 'walk', true]
```

## How it works
1. **Lookup.** A missing property is searched in `[[Prototype]]`, then its prototype, up to `null` ✅[^2]. Cycles are rejected: `Object.setPrototypeOf(a, b)` when `b` already inherits from `a` throws `TypeError` ✅[^1] ✅[^2].
2. **Writes and `this`.** Assignment creates an own property (unless an inherited setter exists). A method inherited from `proto` and called as `o.set(1)` stores `v` on `o`, not on `proto` ✅[^1] ✅[^2].
3. **Enumeration.** `for…in` includes inherited enumerable keys; `Object.keys` and `Object.hasOwn` consider own keys only ✅[^1] ✅[^2].
4. **`F.prototype`.** When `new F()` runs, the new object's `[[Prototype]]` becomes `F.prototype`. By default `F.prototype` is `{constructor: F}`, so `new F().constructor === F`. Arrow functions have no `prototype` ✅[^1] ✅[^3]. Replacing `F.prototype` entirely drops `constructor` unless you add it back ✅[^3].
5. **Native prototypes.** `{}` inherits from `Object.prototype`, whose prototype is `null`; `[]` from `Array.prototype`, which inherits from `Object.prototype`; the number `5` uses `Number.prototype` via a wrapper ✅[^1] ✅[^4]. Modifying native prototypes is acceptable only for polyfills ✅[^4].
6. **Modern API.** `Object.create(proto, descriptors)`, `Object.getPrototypeOf`, `Object.setPrototypeOf`. Changing a prototype after creation is slow in engines and should be avoided on hot paths ✅[^5] ✅[^6].
7. **Null-prototype objects.** `Object.create(null)` has no `toString` and treats `'__proto__'` as an ordinary key: after `d.__proto__ = 'x'`, `Object.keys(d)` is `['__proto__']` ✅[^1] ✅[^5].

## Worked example
Shared methods through `F.prototype`:

| Step | Code | Result |
|---|---|---|
| 1 | `function Rabbit(name) { this.name = name }` | `Rabbit.prototype` is `{constructor: Rabbit}` ✅[^1] |
| 2 | `Rabbit.prototype.hi = function () { return 'hi ' + this.name }` | One function object, shared |
| 3 | `const r = new Rabbit('W')` | `Object.getPrototypeOf(r) === Rabbit.prototype` ✅[^1] |
| 4 | `r.hi()` | `'hi W'` — found on the prototype, `this` is `r` |
| 5 | `Object.keys(r)` | `['name']` — `hi` is not own |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Plain object used as a dictionary, user key `'__proto__'` | Assignment changes or ignores the prototype | Legacy accessor on `Object.prototype` ✅[^5] |
| `Object.create(null)` dictionary | Safe for any key | No inherited accessors ✅[^1] |
| `for…in` over an object with an inherited enumerable property | Inherited key listed | `for…in` walks the chain ✅[^1] |
| `F.prototype = {...}` replaced | `new F().constructor` is `Object` | Default `constructor` lost ✅[^3] |
| Library adds `Array.prototype.x` | Every array everywhere sees it | Shared global prototype ✅[^4] |

## Takeaways
- Use `Map` or `Object.create(null)` for dictionaries with untrusted keys. [rule-candidate]
- Never modify built-in prototypes except to polyfill a standard method. [rule-candidate]
- Set prototypes at creation (`Object.create`, classes), not later with `setPrototypeOf`.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 25 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- `linux/lab-setup.md` — the Node 24.22.1 lab where every behaviour marked with this note ran on 2026-11-04. [^1]
- [Prototypal inheritance](https://javascript.info/prototype-inheritance) — javascript.info, living. Backs: lookup chain, writes go to the own object, `this`, `for…in`, no cycles. [^2]
- [F.prototype](https://javascript.info/function-prototype) — javascript.info, living. Backs: `new` sets `[[Prototype]]`, default `constructor`. [^3]
- [Native prototypes](https://javascript.info/native-prototypes) — javascript.info, living. Backs: built-in chains, primitives, polyfill-only modification. [^4]
- [Prototype methods, objects without __proto__](https://javascript.info/prototype-methods) — javascript.info, living. Backs: modern API, `Object.create(null)`, `__proto__` pitfalls. [^5]
- [Object.setPrototypeOf()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/setPrototypeOf) — MDN, living. Backs: changing a prototype is a very slow operation in every engine. [^6]
- [Inheritance and the prototype chain](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Inheritance_and_the_prototype_chain) — MDN, living. Background: the prototype chain in depth.

## Related
- `javascript/classes/classes-and-inheritance.md`
- `js-runtime/v8-hidden-classes.md`
