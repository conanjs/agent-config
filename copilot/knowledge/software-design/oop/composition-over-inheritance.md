---
schema: knowledge-doc/v1
type: concept
topic: software-design/oop
status: verified
applies-to: ["any"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [oop, composition, inheritance, delegation, strategy]
---

# Composition over inheritance

## Summary
**TL;DR:** Reuse behavior by wiring collaborators together before reaching for a base class. Use inheritance only when the subtype is truly substitutable for the base abstraction and that contract is stable.
**Use this when:** reviewing class hierarchies, extracting shared behavior, or applying DP-9.
**Not this doc:** constructor injection mechanics → `software-design/oop/dependency-injection.md`; polymorphic dispatch choices → `software-design/oop/polymorphism.md`.

## Problem
Inheritance used only to share helper methods couples subclasses to base-class internals and can force them to inherit operations that do not make sense for the subtype. The Rust book calls out this flexibility risk and notes that subclasses may share more than they should. ✅[^1]

## Mental model
**Analogy:** build a bicycle by bolting on a replaceable bell, light, and basket instead of making every bicycle inherit from `BellLightBasketBicycle`.
**Artifact:**
```ts
interface DiscountPolicy { apply(cents: number): number }
class PercentageDiscount implements DiscountPolicy {
  constructor(private percent: number) {}
  apply(cents: number) { return Math.round(cents * (100 - this.percent) / 100); }
}
class Checkout {
  constructor(private discount: DiscountPolicy) {}
  total(cents: number) { return this.discount.apply(cents); }
}
```
`Checkout` reuses behavior through a collaborator instead of a superclass.

## How it works
Design Patterns popularized object-oriented design patterns and its quoted OOP definition centers objects that package data with procedures. ✅[^1]

The composition-over-inheritance rule is the GoF-era principle commonly summarized as favoring object composition before class inheritance. ✅[^1]

Inheritance remains appropriate when it models a true is-a relationship whose inherited operations all satisfy the base contract. Liskov-style substitution requires implementations to honor abstraction contracts rather than surprise callers. ✅[^1]

Delegation moves work to a contained collaborator; the containing object owns orchestration while the collaborator owns a swappable policy or capability. ✅[^4]

Strategy is the common object form of this move: the context depends on a small behavior interface while concrete strategies implement variants. ✅[^4]

Go deliberately has no type hierarchy in the class-inheritance sense; its FAQ describes Go's type system as compositional rather than hierarchical. ✅[^2]

Go embedding promotes methods from an embedded field, but Effective Go warns that embedding differs from subclassing. ✅[^3]

Rust has no struct inheritance for fields and method implementations; the Rust book recommends traits, default trait methods, and trait objects depending on the inheritance use case. ✅[^1]

Mixins can share small capabilities across classes, but they still need narrow, explicit contracts to avoid hidden coupling. ✅[^5]

In a functional-pipeline design, the same principle appears as function composition and higher-order functions: pass behavior as a function and compose transformations at the edge. Rust function pointers and closure traits show this function-as-collaborator shape. ✅[^6]

## Worked example
Inheritance for helper reuse:
```ts
abstract class PricedService {
  protected format(cents: number) { return `$${(cents / 100).toFixed(2)}`; }
}
class InvoiceService extends PricedService {
  label(cents: number) { return this.format(cents); }
}
```
Composition for stable policy reuse:
```ts
class MoneyFormatter {
  format(cents: number) { return `$${(cents / 100).toFixed(2)}`; }
}
class InvoiceService {
  constructor(private money: MoneyFormatter) {}
  label(cents: number) { return this.money.format(cents); }
}
```
The second design lets `InvoiceService` change formatting without joining a hierarchy.

Language contrast:
```go
type Logger struct{}
func (Logger) Info(msg string) {}
type Service struct { Logger } // embedding promotes Info; it is not subclassing
```
```rust
trait Discount { fn apply(&self, cents: u64) -> u64; }
fn total<D: Discount>(discount: D, cents: u64) -> u64 { discount.apply(cents) }
```
Go embeds a field; Rust constrains behavior with a trait.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Framework base class | Inheritance may be required at the adapter edge | Some frameworks define lifecycle hooks as a base contract. ✅[^1] |
| True subtype with stable contract | Inheritance can be acceptable | The subtype can be used wherever the base is expected. ✅[^1] |
| Shared utility method only | Prefer helper, collaborator, or module function | Reuse alone is a weak reason for hierarchy. ✅[^1] |
| Go embedded field | Treat it as composition with promoted methods | Effective Go distinguishes embedding from subclassing. ✅[^3] |
| Rust GUI plugin list | Use trait objects when heterogeneous runtime values are needed | Trait objects enable runtime polymorphism without inheritance. ✅[^4] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Composition and delegation | Local contracts, swappable collaborators | More explicit wiring |
| Strategy object | Easy variant addition | More small types |
| Class inheritance | Shared default behavior and substitutability | Fragile base changes and unwanted inherited surface |
| Function composition | Simple pure transformations | Shared state must be passed explicitly |

## Takeaways
- Reuse helpers through collaborators or functions before creating a base class. [rule-candidate]
- Reserve inheritance for stable substitutable contracts, not convenience sharing. [rule-candidate]
- In Go and Rust, reach for embedding, interfaces, traits, and functions rather than implementation inheritance. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| foundation rule | DP-9 | Source: |

## Verification status
- Verified: 16 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [Characteristics of Object-Oriented Languages](https://raw.githubusercontent.com/rust-lang/book/main/src/ch18-01-what-is-oo.md) — Rust Project, living. Backs: Problem, How it works, Edge cases. [^1]
- [Go FAQ](https://go.dev/doc/faq#Is_Go_an_object-oriented_language) — Go Project, living. Backs: How it works. [^2]
- [Effective Go: Embedding](https://go.dev/doc/effective_go#embedding) — Go Project, 2009. Backs: How it works, Edge cases. [^3]
- [Using Trait Objects to Abstract over Shared Behavior](https://raw.githubusercontent.com/rust-lang/book/main/src/ch18-02-trait-objects.md) — Rust Project, living. Backs: How it works, Edge cases. [^4]
- [TypeScript Handbook: Mixins](https://www.typescriptlang.org/docs/handbook/mixins.html) — TypeScript team, living. Backs: How it works. [^5]
- [Advanced Functions and Closures](https://raw.githubusercontent.com/rust-lang/book/main/src/ch20-04-advanced-functions-and-closures.md) — Rust Project, living. Backs: How it works. [^6]
- `copilot/frameworks/agentic-sdlc/foundations/design/design-principles.md` — cites this doc as DP-9.
- Gamma, Helm, Johnson, Vlissides, *Design Patterns* (1994) — further reading on object composition and class inheritance.

## Related
- `software-design/oop/polymorphism.md`
- `software-design/oop/dependency-injection.md`
- `software-design/design-principles/liskov-substitution.md`
- `software-design/functional-modeling/pipelines.md`