---
schema: knowledge-doc/v1
type: concept
topic: software-design/design-principles
status: verified
applies-to: ["any"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [solid, srp, cohesion, modularity]
---

# Single Responsibility as one actor to satisfy

## Summary
**TL;DR:** Single Responsibility Principle means a unit has one reason to change: one actor, policy, or tightly related group of people it serves. It does not mean "does one small thing"; a unit can contain several operations when they change for the same reason.
**Use this when:** deciding whether to split a class, function module, service, or pipeline stage.
**Not this doc:** broad separation between layers -> `software-design/design-principles/separation-of-concerns.md`.

## Problem
A module that serves finance rules, persistence mechanics, and audit reporting changes whenever any of those actors changes its mind, so unrelated edits can break each other. ✅[^1]

Treating SRP as "one method" or "one tiny class" creates needless fragments; Martin's clarification is about the people or policies that request changes, not about counting functions. ✅[^1]

## Mental model
**Analogy:** a restaurant ticket should go to one station; mixing grill, pastry, and cashier instructions on the same ticket makes every station disturb the others.
**Artifact:**
```ts
// One actor: pricing policy.
class ShippingQuote {
  constructor(private readonly policy: PricingPolicy) {}
  price(input: QuoteInput): Money {
    return this.policy.calculate(input);
  }
}
```
The class can have helpers for discounts, caps, and rounding if all are owned by the pricing policy.

## How it works
1. Find the change request that would force the unit to change.
2. Name the actor or policy behind that request.
3. Keep together code that changes for that same actor; split code that changes for different actors. ✅[^1]
4. In class-modeled code, responsibility usually follows the domain concept that owns the invariant.
5. In functional-pipeline code, responsibility usually follows a pure transformation boundary: one module exports functions for one policy and leaves I/O at the edge.

## Worked example
A shipment quote feature begins with this mixed service:
```ts
class QuoteService {
  quote(input: QuoteInput) { /* validate, price, save SQL row, format audit line */ }
}
```
Class-modeled split:
```ts
class QuotePolicy { calculate(input: QuoteInput): Money { /* pricing rules */ } }
class QuoteRepository { save(quote: Quote): Promise<void> { /* database detail */ } }
class QuoteAuditor { line(quote: Quote): string { /* audit format */ } }
```
Functional variant:
```ts
type QuotePolicy = (input: QuoteInput) => Quote;
const validateQuoteInput = (input: QuoteInput): QuoteInput => input;
const calculateQuote: QuotePolicy = input => ({ id: input.id, total: input.weightKg * 120 });
const quotePipeline = (input: QuoteInput) => calculateQuote(validateQuoteInput(input));
// saveQuote and writeAudit are effects at the edge, not part of the pricing transform.
```
If audit wording changes, only `QuoteAuditor` or the edge formatter changes; if pricing changes, only the pricing policy changes.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| One actor, many helpers | Keep helpers together | SRP is about one reason to change, not one function. ✅[^1] |
| Two actors share identical text | Duplicate until a real shared policy appears | Shared text can represent different knowledge and different change pressure. |
| Thin orchestration | A use case may coordinate validation, domain work, and I/O ports | Its responsibility is the application workflow; the policies remain separate. ✅[^3] |
| Functional module | A file can export several pure functions | It still has one responsibility if they implement one transformation policy. |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Split by actor or policy | Lower accidental coupling between unrelated changes | Requires naming the change pressure clearly |
| Split by tiny operation | Easy local reading | Too many units and weak cohesion |
| Keep one broad service | Fast initial coding | Later changes have wider regression risk |

## Takeaways
- State the actor or policy before citing SRP. [rule-candidate]
- Split only when parts change for different reasons. [rule-candidate]
- Do not translate SRP into "one method per class". [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| foundation rule | DP-1 | Source: |

## Verification status
- Verified: 5 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [Single Responsibility Principle](https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html) — Robert C. Martin, 2014. Backs: Problem, How it works, Edge cases. [^1]
- [SOLID Relevance](https://blog.cleancoder.com/uncle-bob/2020/10/18/Solid-Relevance.html) — Robert C. Martin, 2020. Backs: Summary, Takeaways. [^2]
- [The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) — Robert C. Martin, 2012. Backs: Edge cases. [^3]
- `copilot/frameworks/agentic-sdlc/foundations/design/design-principles.md` — cites this doc as DP-1.

## Related
- `software-design/design-principles/cohesion-and-coupling.md`
- `software-design/design-principles/separation-of-concerns.md`
- `software-design/ddd/building-blocks.md`
- `software-design/functional-modeling/functional-core.md`