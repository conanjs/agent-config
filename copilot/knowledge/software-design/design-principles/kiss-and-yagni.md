---
schema: knowledge-doc/v1
type: concept
topic: software-design/design-principles
status: verified
applies-to: ["any"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [kiss, yagni, simple-design, speculative-generality]
---

# KISS and YAGNI simplicity pressure

## Summary
**TL;DR:** KISS chooses the simplest design that satisfies the current requirement; YAGNI rejects extension points built only for a guessed future. For new code, this means YAGNI wins over Open/Closed until a second concrete variant proves the extension axis.
**Use this when:** reviewing abstract bases with one implementation, configuration flags nobody sets, plugin systems without variants, or speculative options.
**Not this doc:** extension after a stable variation point exists -> `software-design/design-principles/open-closed.md`.

## Problem
Speculative generality adds code that is not needed by the current requirement and makes every later change carry that extra complexity. ✅[^1]

Fowler names four YAGNI costs: build cost, delay cost, carry cost, and repair cost. ✅[^1]

## Mental model
**Analogy:** do not build a railway station because someone might travel there next year; keep the road clear so the station can be built when tickets are actually sold.
**Artifact:**
```ts
// Speculative
interface DiscountStrategy { apply(total: number): number }
class NoDiscount implements DiscountStrategy { apply(total: number) { return total; } }

// Current requirement
const totalWithNoDiscount = (total: number): number => total;
```
The interface is useful when there are real strategies; before that, it is a station with no passengers.

## How it works
YAGNI says a presumed future capability should not be built now merely because it might be needed later. ✅[^1]

YAGNI does not forbid refactoring, tests, or delivery practices that make code easier to change; Fowler says YAGNI depends on a malleable codebase. ✅[^1]

Beck's simple design rules are: passes tests, reveals intention, no duplication, and fewest elements. ✅[^2]

The rules are priority ordered, so code that passes tests and reveals intention can still reject extra abstractions that serve only future flexibility. ✅[^2]

A code smell is a quick surface signal that may indicate a deeper design problem, not proof by itself. ✅[^3]

Speculative generality is the smell where abstractions, parameters, hooks, or layers exist for imagined future cases rather than current use. ✅[^1]

Class-modeled KISS starts with a concrete object and extracts an interface when another implementation or boundary substitution appears:
```ts
class PriceQuote {
  constructor(private readonly cents: number) {}
  total(): number { return this.cents; }
}
```

Functional-pipeline KISS starts with a direct pure function and composes more steps when real variants arrive:
```ts
const quoteTotal = (cents: number): number => cents;
```

Open/Closed is valuable for an established kind of variation, but YAGNI is the default for new code because the first implementation rarely proves the right extension shape. ✅[^1]

## Worked example
A team needs one CSV import path today. A speculative design adds `ImporterPlugin`, `ImporterRegistry`, `JsonImporter`, a disabled XML flag, and lifecycle hooks. KISS/YAGNI keeps `importCsv(rows)` plus tests. When JSON becomes a real second importer, the team extracts a shared `Importer` interface from two real shapes instead of guessing from one.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Security, compliance, or audit hook required now | Build the hook | It is a current requirement, not speculation. ✅[^1] |
| One implementation, external boundary | An interface may still be useful | Dependency inversion at I/O boundaries can serve testing or replacement pressure now. ✅[^1] |
| Refactoring toward clarity | Allowed and encouraged | YAGNI rejects presumptive features, not malleability work. ✅[^1] |
| Performance optimization | Keep the simple design until measurement shows need | A smell or hunch is only a prompt to inspect. ✅[^3] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| KISS/YAGNI first | Low carry cost; clear current behavior | Later extraction may be needed |
| Extension point first | Easy if the guessed axis is correct | Often wrong axis; every caller pays now |
| Refactor when second variant arrives | Abstraction is based on evidence | Requires tests and discipline |

## Takeaways
- Prefer direct code for the first concrete variant; extract extension points when a second real variant arrives. [rule-candidate]
- Treat unused flags, hooks, and abstract bases as speculative generality findings. [rule-candidate]
- Do refactor for malleability; do not build future capabilities. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| foundation rule | DP-7 | Source: |
| foundation rule | DP-8 | Source: |

## Verification status
- Verified: 13 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [Yagni](https://martinfowler.com/bliki/Yagni.html) — Martin Fowler, 2015. Backs: Problem, How it works, Edge cases, Trade-offs. [^1]
- [BeckDesignRules](https://martinfowler.com/bliki/BeckDesignRules.html) — Martin Fowler, 2015. Backs: How it works. [^2]
- [CodeSmell](https://martinfowler.com/bliki/CodeSmell.html) — Martin Fowler, 2006. Backs: How it works, Edge cases. [^3]
- `copilot/frameworks/agentic-sdlc/foundations/design/design-principles.md` — cites this doc as DP-7 and DP-8.

## Related
- `software-design/design-principles/dry.md`
- `software-design/design-principles/open-closed.md`
- `software-design/design-principles/cohesion-and-coupling.md`
- `software-design/oop/dependency-injection.md`
