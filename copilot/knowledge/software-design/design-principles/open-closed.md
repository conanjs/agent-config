---
schema: knowledge-doc/v1
type: concept
topic: software-design/design-principles
status: verified
applies-to: ["any"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [solid, ocp, polymorphism, yagni]
---

# Open/Closed extension points after the second variant

## Summary
**TL;DR:** Open/Closed means established behavior can be extended by adding new code instead of editing a central decision point. This framework applies YAGNI first: wait until a second concrete variant proves the axis of change.
**Use this when:** a switch or `if type == ...` chain grows for every new variant.
**Not this doc:** speculative future-proofing -> `software-design/design-principles/kiss-and-yagni.md`.

## Problem
A central switch edited for every new payment, shipment, or document type makes old, working cases risky to change while adding a new case. ✅[^1]

Adding an abstraction before a second variant can create the carrying cost Fowler describes for presumptive features and future abstractions. ✅[^3]

## Mental model
**Analogy:** a power strip is useful after you own several plugs; installing a full patch panel for one lamp is speculative infrastructure.
**Artifact:**
```ts
type PriceRule = { supports(kind: string): boolean; price(input: QuoteInput): Money };
const rules: PriceRule[] = [new ParcelRule(), new FreightRule()];
const price = (input: QuoteInput) => rules.find(r => r.supports(input.kind))!.price(input);
```
New established variants add a rule; they do not edit a pricing switch.

## How it works
Meyer's original framing says modules should be open for extension but closed as stable, usable modules with a published interface; Martin restates the core as extending behavior without modifying the existing system. ✅[^1]

Martin's polymorphic version uses abstraction and dependency direction so high-level policy does not know plugin details. ✅[^1]

The framework default is not "abstract everything"; YAGNI says to delay extension points whose only justification is a presumed future capability. ✅[^3]

In class-modeled code, OCP often appears as a stable interface plus implementations. In functional-pipeline code, it often appears as a registry of pure handlers, pattern matching at the boundary, or data-driven composition.

## Worked example
First variant: keep it simple.
```ts
function priceParcel(input: QuoteInput): Money {
  return { cents: input.weightKg * 120 };
}
```
Second variant arrives: introduce the extension axis.
```ts
interface PricingRule { kind: string; price(input: QuoteInput): Money }
class ParcelPricing implements PricingRule { kind = "parcel"; price(i: QuoteInput) { return { cents: i.weightKg * 120 }; } }
class FreightPricing implements PricingRule { kind = "freight"; price(i: QuoteInput) { return { cents: 5000 + i.weightKg * 80 }; } }
```
Functional variant:
```ts
type PricingRule = (input: QuoteInput) => Money;
const pricingByKind: Record<string, PricingRule> = {
  parcel: i => ({ cents: i.weightKg * 120 }),
  freight: i => ({ cents: 5000 + i.weightKg * 80 }),
};
const price = (input: QuoteInput) => pricingByKind[input.kind](input);
```
Adding `refrigerated` adds one entry or implementation once the variant is real.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| One variant | Keep direct code | YAGNI avoids unused extension mechanisms. ✅[^3] |
| Variants differ only in data | Prefer a table or config | Polymorphism is not required when data drives the variation. |
| Plugin boundary | Keep dependencies pointing from plugin to core | Martin uses plugin architecture as a strong OCP example. ✅[^1] |
| Exhaustive domain union | Editing a match can be acceptable | Closed sets are clearer as explicit cases than hidden plugins. |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Add extension point after second variant | Good timing; proven change axis | Requires refactor at second variant |
| Add extension point immediately | Later additions may be localized | Risk of wrong abstraction and complexity |
| Keep central switch forever | Simple for tiny closed sets | Repeated edits and regression risk for open sets |

## Takeaways
- Prefer YAGNI until a second concrete variant exists. [rule-candidate]
- Replace growing central switches with added handlers, rules, or implementations. [rule-candidate]
- Use OCP at stable variation points, not as a blanket ban on editing code. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| foundation rule | DP-2 | Source: |

## Verification status
- Verified: 7 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [The Open Closed Principle](https://blog.cleancoder.com/uncle-bob/2014/05/12/TheOpenClosedPrinciple.html) — Robert C. Martin, 2014. Backs: Problem, How it works, Edge cases. [^1]
- [SOLID Relevance](https://blog.cleancoder.com/uncle-bob/2020/10/18/Solid-Relevance.html) — Robert C. Martin, 2020. Backs: Summary. [^2]
- [Yagni](https://martinfowler.com/bliki/Yagni.html) — Martin Fowler, 2015. Backs: Problem, How it works, Edge cases. [^3]
- `copilot/frameworks/agentic-sdlc/foundations/design/design-principles.md` — cites this doc as DP-2.

## Related
- `software-design/design-principles/kiss-and-yagni.md`
- `software-design/oop/polymorphism.md`
- `software-design/oop/composition-over-inheritance.md`
- `software-design/functional-modeling/pipelines.md`