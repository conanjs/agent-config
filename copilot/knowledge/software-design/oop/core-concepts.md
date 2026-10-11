---
schema: knowledge-doc/v1
type: concept
topic: software-design/oop
status: verified
applies-to: ["any"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [oop, objects, classes, prototypes, identity]
---

# Object-oriented core concepts

## Summary
**TL;DR:** An object is a runtime thing with identity, state, and behavior; other code normally interacts with it by sending messages or calling methods. Classes, prototypes, traits, and interfaces are different language mechanisms for packaging or constraining that behavior.
**Use this when:** orienting a design discussion around OOP terms before choosing richer patterns such as encapsulation, polymorphism, or composition.
**Not this doc:** detailed encapsulation rules → `software-design/oop/encapsulation.md`; entity/value modeling → `software-design/ddd/building-blocks.md`.

## Problem
Teams often use “object,” “class,” and “type” as if they mean the same thing, which hides important design choices about identity, mutation, dispatch, and equality. The Rust book notes that there is no single community consensus on the exact feature list required for a language to count as object-oriented. ✅[^1]

## Mental model
**Analogy:** an object is a named service desk. It has a ticket number that identifies it, files behind the counter that form its state, and procedures the clerk follows when someone asks for work.
**Artifact:**
```ts
class Cart {
  #items = new Map<string, number>();

  add(sku: string, quantity: number) {
    this.#items.set(sku, (this.#items.get(sku) ?? 0) + quantity);
  }
}
```
The `Cart` instance has identity, private state, and behavior exposed through `add`.

## How it works
Objects package data with operations that act on that data; the GoF definition quoted by the Rust book calls those operations methods or operations. ✅[^1]

Alan Kay described his original OOP idea as objects like cells or networked computers that communicate by messages, with local retention and protection of state-process and late binding. ✅[^2]

In TypeScript, a `class` declaration creates fields, constructors, methods, inheritance clauses, and interface checks on top of JavaScript class syntax. ✅[^3]

JavaScript objects inherit from other objects through a prototype chain rather than requiring a class hierarchy for delegation. ✅[^4]

TypeScript's `implements` clause checks that a class can be treated as an interface type, but it does not change the class body's inferred types or runtime behavior. ✅[^3]

The four commonly named OOP pillars map to deeper docs this way: abstraction is choosing the public API; encapsulation is covered in `encapsulation.md`; inheritance is discussed here and in `composition-over-inheritance.md`; polymorphism is covered in `polymorphism.md`. ✅[^1]

Reference semantics compare whether two references point to the same object, while value semantics compare the described value; Fowler uses value objects and reference objects to separate those equality expectations. ✅[^5]

## Worked example
A request creates `const cart = new Cart()`, calls `cart.add("SKU-1", 2)`, then passes `cart` to a checkout service. The checkout service does not need to know whether the cart stores a `Map`, an array, or a database-backed collection; it sends messages such as `add` or `total`, and the object decides how to preserve its own rules.

```ts
const a = { sku: "SKU-1" };
const b = { sku: "SKU-1" };
console.log(a === b); // false: different identities
```
Two objects can carry equal-looking values but remain different identities.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Plain data transfer object | It may be an object at runtime but not a behavior-owning domain object | OOP design cares about behavior ownership, not only object syntax. ✅[^1] |
| JavaScript object literal | It still has a prototype chain unless created with a null prototype | JavaScript uses prototype delegation for object inheritance. ✅[^4] |
| TypeScript interface | It can constrain a class or object shape without creating runtime code | TypeScript erases most type constructs and `implements` is a type check. ✅[^3] |
| Value object modeled as a class | Equality should be value-based by convention or helper method | Value objects are equal because of their property values. ✅[^5] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Class with private state | Clear construction and behavior boundary | Can drift into deep inheritance if reused carelessly |
| Prototype delegation | Flexible object-to-object sharing | Prototype lookup can surprise readers from class-first languages |
| Value object | Simple equality and immutability | No lifecycle identity for tracking changes over time |
| Entity object | Stable identity and lifecycle | Must guard mutable state and invariants |

## Takeaways
- Ask whether the design needs identity, state, and behavior before adding a class. [rule-candidate]
- Treat messaging or method calls as the object boundary; do not make callers edit internals. [rule-candidate]
- Choose entity/value semantics deliberately, not by persistence shape. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 12 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [Characteristics of Object-Oriented Languages](https://raw.githubusercontent.com/rust-lang/book/main/src/ch18-01-what-is-oo.md) — Rust Project, living. Backs: Problem, How it works, Edge cases. [^1]
- [Clarification of "object-oriented"](http://www.purl.org/stefan_ram/pub/doc_kay_oop_en) — Alan Kay via Stefan Ram, 2003. Backs: How it works. [^2]
- [TypeScript Handbook: Classes](https://www.typescriptlang.org/docs/handbook/2/classes.html) — TypeScript team, living. Backs: How it works, Edge cases. [^3]
- [Inheritance and the prototype chain](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Inheritance_and_the_prototype_chain) — MDN Web Docs, living. Backs: How it works, Edge cases. [^4]
- [Value Object](https://martinfowler.com/bliki/ValueObject.html) — Martin Fowler, 2016. Backs: How it works, Edge cases. [^5]

## Related
- `software-design/oop/encapsulation.md`
- `software-design/oop/polymorphism.md`
- `software-design/oop/composition-over-inheritance.md`
- `software-design/ddd/building-blocks.md`