---
schema: deep-dive/v1
topic: javascript/prototypes
status: verified
applies-to: ["ECMAScript 2025", "Node.js 24 (V8)"]
last-updated: 2026-11-04
last-verified: 2026-11-04
synthesized-into: []
tags: [javascript, objects, this, call-site, binding-rules, prototype-chain, shadowing, classes, super, delegation, oloo, ydkjs]
---

# Objects, `this`, the prototype chain, classes and delegation, end to end

## Summary
**TL;DR:** An object is a container of properties whose behaviour is defined by descriptors and by a hidden `[[Prototype]]` link. A function's `this` is **not** decided where the function is written but by **how it is called**: four rules — `new`, explicit (`call`/`apply`/`bind`), implicit (`obj.f()`), default — applied in that order, plus arrow functions, which take `this` from their surroundings. Assigning to a property that exists further up the prototype chain does not always create an own property: a read-only or setter property up the chain changes the outcome. Classes are a syntax for prototype linkage where behaviour is **shared, not copied**; delegation ("objects linked to other objects") reaches the same composition with plain objects.
**Use this when:** `this` is wrong or `undefined`; an assignment "does nothing"; you are choosing between classes, factories and delegation; or you read the You Don't Know JS *Objects & Classes* / *this & Object Prototypes* books and want a verified companion.
**Depth:** object containers (names, symbols, concise methods, spread, existence checks, listing, delete, primitives); descriptors and object characteristics; the four `this` rules with precedence, every way implicit binding is lost, ignored `this`, arrow and tagged-template cases; prototype linkage and the three outcomes of assigning through the chain; classes (sharing, `super`, `new.target`, statics, privates); constructors versus factories versus delegation, including a corrected version of a book example that fails as printed; a failure matrix. All ✅[^2] rows ran in Node.js 24.22.1.

## 1. Objects as containers

| Topic | Rule | Lab |
|---|---|---|
| Property names | Every key is a string or a symbol; other values are converted to strings (`o[1]` and `o[true]` create keys `"1"` and `"true"`) | ✅[^2] |
| Concise methods vs arrow properties | `m() { return this.v }` gets `this` from the call; `a: () => this` keeps the *surrounding* `this` (here the module's, not the object) | ✅[^2] |
| Object spread `{...src}` | Copies own enumerable properties (strings and symbols); **runs getters** and stores their values; ignores the prototype | ✅[^2] |
| Deep copy | `structuredClone` (see `javascript/object-basics/objects-references-and-this.md`) | — |
| Accessing properties on primitives | Primitives are boxed for the access: `(5).toFixed(1)` → `"5.0"`; `null.x` / `undefined.x` throw `TypeError` | ✅[^2] |
| `delete o.x` | Removes an **own** property only and returns `true`; afterwards `o.x` reads the inherited value, and a second `delete` still returns `true` without touching the prototype | ✅[^2] |
| Arrays are objects | A non-index key (`a.foo`) does not change `length`; an index key does (`a['5']` makes `length` 6) | ✅[^2] |

✅[^1]

### Existence checks and listing

| Question | Use | Note | Lab |
|---|---|---|---|
| Own property? | `Object.hasOwn(o, k)` | `o.hasOwnProperty(k)` throws `TypeError` on a null-prototype object | ✅[^2] |
| Own or inherited? | `k in o` | Includes the prototype chain | — |

| Function | Lists | Lab result for an object with own `a`, non-enumerable `hidden`, a symbol, and inherited `inh` ✅[^2] |
|---|---|---|
| `Object.keys` | Own, enumerable, string keys | `["a"]` |
| `Object.getOwnPropertyNames` | Own string keys, enumerable or not | `["a","hidden"]` |
| `Object.getOwnPropertySymbols` | Own symbol keys | 1 |
| `Reflect.ownKeys` | All own keys | 3 |
| `for…in` | Enumerable string keys, **own and inherited** | `["a","inh"]` |

## 2. How objects work: descriptors and characteristics

Each property has a descriptor (`value`/`writable` or `get`/`set`, plus `enumerable`, `configurable`), and each object is extensible, sealed or frozen. The details and measured behaviour are in `javascript/object-properties/property-descriptors-and-accessors.md` ✅[^3]. Two facts matter for the rest of this dive: a **read-only** or **accessor** property found up the prototype chain changes what assignment does (§5), and `Object.defineProperty` always creates an own property regardless of the chain (lab: `2`) ✅[^2].

## 3. `this`: decided by the call-site

**Analogy:** `this` is like the word "here" in a phone call — it means wherever the caller is standing at that moment, not where the speaker was born.

### 3.1 The four rules, in precedence order

| # | Rule | Call shape | `this` | Lab |
|---|---|---|---|---|
| 1 | **new** binding | `new F()` | The new object — even if `F` was hard-bound with `bind` (the bound arguments still apply) | `["arg", true, false]` ✅[^2] |
| 2 | **explicit** binding | `f.call(o)`, `f.apply(o)`, `f.bind(o)` | `o`; a `bind`-bound function ignores later `call` | `o2` ✅[^2] |
| 3 | **implicit** binding | `obj.f()` | `obj` (the object before the dot at call time) | `o1` ✅[^2] |
| 4 | **default** binding | `f()` | `undefined` in strict code; the global object in sloppy code | ✅[^2] |

Ask the questions in that order and stop at the first that applies ✅[^4] ✅[^5].

### 3.2 Every way implicit binding gets lost

| Call shape | `this` | Lab |
|---|---|---|
| `const f = o.f; f()` | default (`undefined`) | ✅[^2] |
| `(0, o.f)()` — comma or any other expression | default | ✅[^2] |
| `(o.f)()` — plain parentheses | still `o` (the reference survives) | ✅[^2] |
| `[1].map(o.f)` | default | ✅[^2] |
| `[1].map(o.f, o2)` — `thisArg` | `o2` | ✅[^2] |
| `const init = point.init; init(3)` where `init` writes `this.x` | `TypeError` in strict code | ✅[^2] |

The reason `(o.f)()` works but `(0, o.f)()` does not is the specification's Reference Record: parentheses keep it, other operators reduce it to a plain value (see `javascript/misc/proxy-eval-currying-and-reference-type.md`) ✅[^6].

### 3.3 Special cases

| Case | Behaviour | Lab |
|---|---|---|
| Ignored `this`: `f.call(null)` | Sloppy: global object; strict: `null` | `[true, null]` ✅[^2] |
| Arrow function | No own `this`; `call`/`bind` cannot change it (`'outer'`) | ✅[^2] |
| `new` on an arrow | `TypeError: A is not a constructor` | ✅[^2] |
| Tagged template `obj.tag\`x\`` | Implicit binding applies (`'tagobj'`); a bare `tag\`x\`` gets default binding | ✅[^2] ✅[^4] |
| Class methods | Class bodies are strict, so an extracted method sees `undefined` | ✅[^2] |
| Soft binding (a utility pattern, not built-in) | Falls back to a given object only when default binding would apply | ✅[^5] |

## 4. The prototype chain

- Every object has `[[Prototype]]` (or `null`); reads that miss own properties continue there. `Object.create(proto)` sets it at creation; `Object.getPrototypeOf` reads it; `F.prototype` is just the object that `new F()` uses as the new instance's `[[Prototype]]` ✅[^3].
- `isPrototypeOf` answers "is X anywhere in Y's chain?" without needing a constructor; `instanceof` asks the same about `F.prototype`. All four introspection checks agreed in the lab ✅[^2] ✅[^7].
- Full mechanics: `javascript/prototypes/prototypal-inheritance.md`.

## 5. Assigning through the chain: three outcomes

`o.foo = value`, when `o` has no own `foo` but something up the chain does ✅[^8]:

| What is up the chain | Strict | Sloppy | Own `foo` created? | Lab |
|---|---|---|---|---|
| Writable data property | Assignment succeeds | Same | **Yes** — shadows the inherited one; prototype unchanged | ✅[^2] |
| Read-only data property (`writable: false`) | `TypeError: Cannot assign to read only property` | Silently ignored | **No** | ✅[^2] |
| Setter | The setter runs with `this = o` | Same | **No** | ✅[^2] |

`Object.defineProperty(o, 'foo', …)` sidesteps all three and always creates an own property ✅[^2]. A sneaky case: `o.a++` on an inherited `a` reads the inherited value and **writes an own** `a` (`proto.a` stays 2, `o.a` becomes 3) ✅[^2] ✅[^8].

## 6. Classes

| Fact | Lab |
|---|---|
| "Inheritance" is **sharing, not copying**: a method added to `P.prototype` after an instance exists is immediately visible on that instance | ✅[^2] |
| `new.target` inside a parent constructor is the class actually being constructed (`'B'`) | ✅[^2] |
| `super.method()` works in object-literal methods too (`'base+o'`) — it resolves through the method's home object | ✅[^2] |
| `static make() { return new this() }` builds the subclass when called as `B.make()` | ✅[^2] |
| Private statics (`static #count`) work; `C.inc()` twice returns 2 | ✅[^2] |

Deciding *when* to use a class: the book recommends classes when many instances share behaviour and own separate state, and warns against single-instance classes that are really namespaces ✅[^9]. Syntax and mechanics: `javascript/classes/classes-and-inheritance.md` and `javascript/classes/class-features-and-type-checks.md`.

## 7. Constructors, factories, delegation

| Style | How behaviour is shared | `this` risk | Example |
|---|---|---|---|
| Constructor + `new` / class | Via `F.prototype` | Methods lose `this` when extracted | `new Point(1, 2)` |
| Factory function | Each object gets its methods (or links to a shared prototype) | Same, unless methods avoid `this` | `makePoint(1, 2)` → `"(1,2)"` ✅[^2] |
| **Delegation** (OLOO, "objects linked to other objects") | Peer objects; behaviour borrowed with `call` or reached via `Object.create` | Explicit by design | below |

✅[^10]

### Delegation, verified — and a corrected book example

The book illustrates delegation with two peer objects, `Coordinates` (setters) and `Inspect` (`toString`), applied to `point` with `Coordinates.setXY.call(point, 3, 4)` ✅[^10]. **As printed (repository state 2026-10-31), this throws** `TypeError: this.setX is not a function`, because `setXY` calls `this.setX(…)` and `point` has no `setX` ✅[^2]. Two working variants:

```js
const Coordinates = {
  setX(x) { this.x = x },
  setY(y) { this.y = y },
  setXY(x, y) { Coordinates.setX.call(this, x); Coordinates.setY.call(this, y) }, // delegate explicitly
};
const Inspect = { toString() { return `(${this.x},${this.y})` } };

const point = {};
Coordinates.setXY.call(point, 3, 4);          // explicit delegation
const another = Object.create(Coordinates);   // implicit delegation via [[Prototype]]
another.setXY(5, 6);
Inspect.toString.call(point);                 // "(3,4)"
Inspect.toString.call(another);               // "(5,6)"
```
Lab output: `(3,4) (5,6)`, and `another` owns only `x` and `y` ✅[^2]. The point of the pattern stands: no parent or child, just cooperating objects sharing context through `this` ✅[^10].

## 8. Failure matrix

| Symptom | Cause | Fix |
|---|---|---|
| `this` is `undefined` in a callback | Implicit binding lost (§3.2) | Arrow wrapper, `bind`, or `thisArg` |
| `this` is the global object | Sloppy default binding or `call(null)` | Strict mode |
| Assignment "does nothing" | Read-only property up the chain (sloppy) | Strict mode reveals it; `defineProperty` if an own property is intended |
| Assignment triggers unexpected code | Inherited setter | Check the chain with `Object.getOwnPropertyDescriptor` on each prototype |
| `o.a++` creates an own property | Implicit shadowing | Update the prototype deliberately, or keep state own from the start |
| `hasOwnProperty is not a function` | Null-prototype object | `Object.hasOwn` |
| Bound function ignores `call` | Hard binding | Bind later, or pass `this` explicitly |
| `new` on an arrow throws | Arrows are not constructors | Use a class or function |

## 9. How this deep dive was built
- **Primary narrative:** You Don't Know JS Yet, *Objects & Classes* (2nd edition, chapters 1–5) and the 1st-edition *this & Object Prototypes* (chapters 2, 5, 6) for the binding-precedence summary and prototype-assignment rules.
- **Checked against:** MDN and the ECMAScript specification.
- **Verified:** every ✅[^2] row ran in `node:24.22.1-alpine` on 2026-11-04 (lab files `objects.js`, `deleg.js`); the run also found the book example that fails as printed.

## References
- [You Don't Know JS Yet: Objects & Classes, ch. 1 "Object Foundations"](https://github.com/getify/You-Dont-Know-JS/blob/2nd-ed/objects-classes/ch1.md) — Kyle Simpson, 2nd ed., CC BY-NC-ND 4.0. Backs: containers, property names, spread, existence checks, listing, delete. [^1]
- `linux/lab-setup.md` — the Node.js 24.22.1 lab where every ✅[^2] behaviour ran on 2026-11-04. [^2]
- [You Don't Know JS Yet: Objects & Classes, ch. 2 "How Objects Work"](https://github.com/getify/You-Dont-Know-JS/blob/2nd-ed/objects-classes/ch2.md) — Kyle Simpson. Backs: descriptors, object characteristics, `[[Prototype]]` vs `prototype`. [^3]
- [You Don't Know JS Yet: Objects & Classes, ch. 4 "This Works"](https://github.com/getify/You-Dont-Know-JS/blob/2nd-ed/objects-classes/ch4.md) — Kyle Simpson. Backs: the four invocation forms, arrow `this`, indirect calls, tagged templates. [^4]
- [You Don't Know JS: this & Object Prototypes, ch. 2 "`this` All Makes Sense Now!"](https://github.com/getify/You-Dont-Know-JS/blob/1st-ed/this%20%26%20object%20prototypes/ch2.md) — Kyle Simpson, 1st ed. Backs: binding precedence, ignored `this`, soft binding. [^5]
- [ECMAScript: Reference Record specification type](https://tc39.es/ecma262/#sec-reference-record-specification-type) — Ecma TC39, living. Backs: why parentheses keep `this` and other operators lose it. [^6]
- [Object.prototype.isPrototypeOf()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/isPrototypeOf) — MDN, living. Backs: chain introspection without constructors. [^7]
- [You Don't Know JS: this & Object Prototypes, ch. 5 "Prototypes"](https://github.com/getify/You-Dont-Know-JS/blob/1st-ed/this%20%26%20object%20prototypes/ch5.md) — Kyle Simpson, 1st ed. Backs: the three outcomes of assignment through the chain; implicit shadowing. [^8]
- [You Don't Know JS Yet: Objects & Classes, ch. 3 "Classy Objects"](https://github.com/getify/You-Dont-Know-JS/blob/2nd-ed/objects-classes/ch3.md) — Kyle Simpson. Backs: when to use classes, sharing not copying, statics, privates. [^9]
- [You Don't Know JS Yet: Objects & Classes, ch. 5 "Delegation"](https://github.com/getify/You-Dont-Know-JS/blob/2nd-ed/objects-classes/ch5.md) — Kyle Simpson. Backs: constructors vs factories, delegation and OLOO; the `Coordinates`/`Inspect` example. [^10]
- [this](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/this) — MDN, living. Background: `this` in every context.

## Related
- `javascript/object-basics/objects-references-and-this.md`
- `javascript/prototypes/prototypal-inheritance.md`
- `javascript/classes/classes-and-inheritance.md`
