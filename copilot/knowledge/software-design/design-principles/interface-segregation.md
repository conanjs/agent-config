---
schema: knowledge-doc/v1
type: concept
topic: software-design/design-principles
status: verified
applies-to: ["any"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [solid, isp, interfaces, structural-typing]
---

# Interface Segregation with consumer-owned roles

## Summary
**TL;DR:** Interface Segregation means consumers depend only on operations they actually call. Prefer role interfaces owned by the consumer over header interfaces that mirror every public method of a supplier.
**Use this when:** a caller must implement, mock, import, or understand methods it never uses.
**Not this doc:** subtype contract correctness -> `software-design/design-principles/liskov-substitution.md`.

## Problem
A broad interface forces consumers to depend on methods they do not use, and Martin notes that such compile-time dependencies can force recompilation or redeployment even without runtime use. ✅[^1]

Header interfaces that copy every public method of a class hide the actual collaboration, while role interfaces show the methods a specific consumer needs. ✅[^2]

## Mental model
**Analogy:** a valet key starts the car but does not open the glove box; the user receives the capability required for the role.
**Artifact:**
```ts
interface CanPrice { price(input: QuoteInput): Money }
class QuoteController {
  constructor(private readonly pricing: CanPrice) {}
}
```
The controller owns `CanPrice` because that is the role it needs.

## How it works
A role interface is shaped by one supplier-consumer interaction; the same supplier may implement several such roles. ✅[^2]

A header interface mirrors a class's full public surface and tends to force implementers to provide methods irrelevant to their role. ✅[^3]

TypeScript compatibility is structural, so an object with the required members can satisfy a narrow interface without explicitly naming it. ✅[^4]

Go idiom favors small method sets such as one-method `Reader` and `Writer` interfaces, named for the operation they provide. ✅[^5]

Class-modeled code uses consumer-owned interfaces for collaborators. Functional-pipeline code uses narrow function types or records of functions at the point of consumption.

## Worked example
Bad broad interface:
```ts
interface ShipmentService {
  price(input: QuoteInput): Money;
  book(input: BookingInput): Promise<Booking>;
  cancel(id: string): Promise<void>;
  audit(id: string): string;
}
```
Class-modeled consumer role:
```ts
interface PricesShipments { price(input: QuoteInput): Money }
class QuotePage { constructor(private readonly prices: PricesShipments) {} }
```
Functional variant:
```ts
type PriceShipment = (input: QuoteInput) => Money;
const renderQuote = (price: PriceShipment, input: QuoteInput) => price(input);
```
A mock for `QuotePage` now supplies one operation, not four unrelated ones.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| One consumer needs all methods | A broader interface may be fine | ISP is about consumers being forced beyond their needs. ✅[^1] |
| TypeScript extra members | Usually accepted when assigned structurally | Compatibility checks target members, not supplier identity. ✅[^4] |
| Go interface placement | Define small interfaces near the consumer when practical | The role is discovered by use, not by the concrete type's package. ✅[^5] |
| Remote API response | Extra fields can travel over the wire | The consumer contract can still validate only the fields it needs. ✅[^2] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Consumer-owned role interfaces | Clear collaboration and easy substitutes | More named types in nominal languages |
| Header interface | Quick extraction from a class | Consumers inherit irrelevant dependencies |
| Single function type | Very small surface for FP pipelines | Less room for multiple related operations |

## Takeaways
- Put the interface where the consumer's need is clearest. [rule-candidate]
- Prefer role interfaces or function types over class-shaped headers. [rule-candidate]
- In structural languages, use the shape you need; do not require explicit adapter ceremony without value. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| foundation rule | DP-4 | Source: |

## Verification status
- Verified: 10 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [SOLID Relevance](https://blog.cleancoder.com/uncle-bob/2020/10/18/Solid-Relevance.html) — Robert C. Martin, 2020. Backs: Problem, Edge cases. [^1]
- [Role Interface](https://martinfowler.com/bliki/RoleInterface.html) — Martin Fowler, 2006. Backs: Problem, How it works, Edge cases. [^2]
- [Header Interface](https://martinfowler.com/bliki/HeaderInterface.html) — Martin Fowler, 2006. Backs: How it works. [^3]
- [Type Compatibility](https://www.typescriptlang.org/docs/handbook/type-compatibility.html) — TypeScript Handbook, living. Backs: How it works, Edge cases. [^4]
- [Effective Go: Interface names](https://go.dev/doc/effective_go#interfaces) — Go project, living. Backs: How it works, Edge cases. [^5]
- `copilot/frameworks/agentic-sdlc/foundations/design/design-principles.md` — cites this doc as DP-4.

## Related
- `software-design/design-principles/liskov-substitution.md`
- `software-design/oop/polymorphism.md`
- `software-design/functional-modeling/types-as-rules.md`
- `software-design/functional-modeling/testing.md`