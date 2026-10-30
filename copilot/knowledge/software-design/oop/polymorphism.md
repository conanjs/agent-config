---
schema: knowledge-doc/v1
type: concept
topic: software-design/oop
status: verified
applies-to: ["any"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [oop, polymorphism, dispatch, generics, type-systems]
---

# Polymorphism in object-oriented design

## Summary
**TL;DR:** Polymorphism lets one piece of code work with several shapes of data or behavior. It can come from subtypes, generics, overloads, traits, type classes, structural interfaces, or runtime dispatch.
**Use this when:** replacing conditionals, choosing between classes and discriminated unions, or comparing TypeScript, Go, and Rust abstraction styles.
**Not this doc:** dependency inversion at boundaries → `software-design/oop/dependency-injection.md`.

## Problem
A growing `switch` over a type code is easy at first, but every new behavior or variant reopens the central branch and risks inconsistent edits. Fowler's catalog records “Replace Conditional with Polymorphism” as the refactoring that moves per-variant behavior behind polymorphic operations. ✅[^1]

## Mental model
**Analogy:** a universal remote has one `play` button. A TV, speaker, and projector each respond differently, but the user presses the same button.
**Artifact:**
```ts
interface PriceRule { price(cents: number): number }
class Standard implements PriceRule { price(cents: number) { return cents; } }
class Sale implements PriceRule { price(cents: number) { return Math.round(cents * 0.8); } }

function quote(rule: PriceRule, cents: number) {
  return rule.price(cents);
}
```
`quote` is polymorphic over any object with a compatible `price` behavior.

## How it works
Subtype polymorphism lets a value of a more specific type be used through a shared supertype, interface, trait object, or protocol. ✅[^5]

Parametric polymorphism uses type parameters so one implementation can work for many types while preserving type information, as TypeScript generics and Rust trait bounds do. ✅[^2]

Ad-hoc polymorphism gives the same operation name multiple implementations, such as TypeScript overload signatures or Rust traits implemented for different types. ✅[^2]

Dynamic dispatch selects a method implementation at runtime when the compiler cannot know the concrete receiver type; Rust trait objects use dynamic dispatch for this case. ✅[^5]

TypeScript type compatibility is structural: a value is compatible when it has the target type's required members, unlike nominal systems that require explicit declarations. ✅[^3]

Go interfaces are satisfied implicitly by any type whose method set matches the interface, so a type does not announce the relationship in its declaration. ✅[^4]

Rust traits define shared behavior and trait bounds constrain generic parameters to types that provide that behavior. ✅[^6]

Wadler's expression problem frames a trade-off: functional data variants make it easy to add new functions, while OO subclasses make it easy to add new variants. ✅[^7]

A discriminated union with an exhaustive `switch` is better when the set of variants is closed and the system mainly adds new operations over those variants. TypeScript uses narrowing and `never` checks to support exhaustive handling. ✅[^8]

## Worked example
Start with a conditional:
```ts
type Shipping = { kind: "flat" } | { kind: "weight"; grams: number };
function cost(s: Shipping) {
  switch (s.kind) {
    case "flat": return 500;
    case "weight": return 300 + Math.ceil(s.grams / 1000) * 120;
  }
}
```
If product teams keep adding shipping kinds but all clients only ask for `cost`, replace the branch with polymorphism:
```ts
interface ShippingRule { cost(): number }
class Flat implements ShippingRule { cost() { return 500; } }
class ByWeight implements ShippingRule {
  constructor(private grams: number) {}
  cost() { return 300 + Math.ceil(this.grams / 1000) * 120; }
}
```
If teams mostly add reports such as `label`, `audit`, and `explain` over a stable two-case set, keep the discriminated union and add exhaustive functions instead.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| One variant exists | Prefer a simple function or union | YAGNI avoids speculative subclasses before a second variant. ✅[^7] |
| Closed protocol messages | Use discriminated union plus exhaustive switch | TypeScript can narrow branches and detect unhandled `never` cases. ✅[^8] |
| Public plugin API | Prefer interface or trait object | Callers can add new implementations without editing the central package. ✅[^5] |
| TypeScript private members | Compatibility becomes tied to the same class origin | Private/protected members affect structural compatibility. ✅[^3] |
| Rust homogeneous list | Prefer generics over trait objects | Generics are monomorphized; trait objects use runtime dispatch. ✅[^5] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Subtype polymorphism | Adds new variants by adding classes | Harder to add new required operations to every subtype |
| Parametric polymorphism | Reusable and statically checked | Constraints can become abstract and hard to read |
| Ad-hoc polymorphism | Same operation name across types | Resolution rules are language-specific |
| Discriminated union | Exhaustive handling of closed cases | Central switches grow when new variants appear |

## Takeaways
- Replace a type-code conditional with polymorphism when new variants are the common change. [rule-candidate]
- Keep a discriminated union when the variant set is intentionally closed and exhaustive operations matter. [rule-candidate]
- Know whether your language's interfaces are nominal, structural, or implicit before designing boundaries. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 15 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [Replace Conditional with Polymorphism](https://refactoring.com/catalog/replaceConditionalWithPolymorphism.html) — Martin Fowler, living. Backs: Problem, How it works. [^1]
- [TypeScript Handbook: Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html) and [Function overloads](https://www.typescriptlang.org/docs/handbook/2/functions.html#function-overloads) — TypeScript team, living. Backs: How it works. [^2]
- [Type Compatibility](https://www.typescriptlang.org/docs/handbook/type-compatibility.html) — TypeScript team, living. Backs: How it works, Edge cases. [^3]
- [Go Language Specification: Interface types](https://go.dev/ref/spec#Interface_types) — Go Project, living. Backs: How it works. [^4]
- [Using Trait Objects to Abstract over Shared Behavior](https://raw.githubusercontent.com/rust-lang/book/main/src/ch18-02-trait-objects.md) — Rust Project, living. Backs: How it works, Edge cases. [^5]
- [Defining Shared Behavior with Traits](https://raw.githubusercontent.com/rust-lang/book/main/src/ch10-02-traits.md) — Rust Project, living. Backs: How it works. [^6]
- [The Expression Problem](https://homepages.inf.ed.ac.uk/wadler/papers/expression/expression.txt) — Philip Wadler, 1998. Backs: How it works, Edge cases. [^7]
- [TypeScript Handbook: Exhaustiveness checking](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#exhaustiveness-checking) — TypeScript team, living. Backs: How it works, Edge cases. [^8]

## Related
- `software-design/oop/core-concepts.md`
- `software-design/oop/composition-over-inheritance.md`
- `software-design/oop/dependency-injection.md`
- `software-design/functional-modeling/types-as-rules.md`