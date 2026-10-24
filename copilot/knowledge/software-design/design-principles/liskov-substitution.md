---
schema: knowledge-doc/v1
type: concept
topic: software-design/design-principles
status: draft
applies-to: ["any"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [solid, lsp, behavioral-subtyping, contracts]
---

# Liskov Substitution as behavioral compatibility

## Summary
**TL;DR:** Liskov Substitution Principle means an implementation can stand in for its abstraction without surprising callers. The promise is behavioral, not just syntactic: callers keep the same expectations about inputs, outputs, invariants, and failures.
**Use this when:** reviewing inheritance, interface implementations, adapters, mocks, or discriminated variants.
**Not this doc:** writing explicit contracts in classes -> `software-design/oop/design-by-contract.md`.

## Problem
A subtype that compiles but throws `NotSupportedError`, rejects valid base inputs, weakens the result guarantee, or mutates state in a new surprising way forces callers to special-case it. ✅[^3]

The classic Square/Rectangle mistake is using an "is-a" story from the real world while the mutable software contract says setters for width and height can vary independently. ⚠️ unverified

## Mental model
**Analogy:** any card accepted by a door reader must open or deny under the same posted rules; a card that sometimes jams the reader is not a valid substitute.
**Artifact:**
```ts
interface ReadableStore {
  get(id: string): Promise<Record | null>; // returns null when missing
}
```
Any implementation may use memory, SQL, or HTTP, but it must not throw for ordinary misses if the contract says misses return `null`.

## How it works
Liskov and Wing define subtype relationships by specifications so properties proved for supertype objects also hold for subtype objects. ✅[^1]

Design by Contract separates preconditions, postconditions, and class invariants: clients satisfy preconditions; suppliers guarantee postconditions and preserve invariants. ✅[^2]

A valid subtype does not require stronger preconditions than the abstraction, does not provide weaker postconditions, and preserves the abstraction's invariants. ✅[^2]

Martin summarizes LSP as interface users not being confused by implementations; violations usually spread `if implementation is X` checks. ✅[^3]

The history rule says a subtype must not allow state changes that invalidate expectations clients had from the supertype's observable history. ✅[^4]

Class-modeled code expresses LSP through base classes, interfaces, and overridden methods. Functional-pipeline code expresses it through function types, algebraic variants, and adapter contracts: a replacement transform must accept the same valid inputs and return the same kind of result.

## Worked example
Violation:
```ts
class ReadOnlyList<T> extends Array<T> {
  push(...items: T[]): number { throw new Error("NotSupported"); }
}
```
A caller typed as `Array<T>` expects `push` to work. Better class-modeled design:
```ts
interface ReadableList<T> { at(index: number): T | undefined; length: number }
class ReadOnlyList<T> implements ReadableList<T> { /* no mutating contract */ }
```
Functional variant:
```ts
type Discount = (amount: Money) => Money;
const tenPercent: Discount = amount => ({ cents: Math.floor(amount.cents * 0.9) });
const invalid: Discount = amount => { if (amount.cents === 0) throw new Error("unsupported"); return amount; };
```
`invalid` breaks the contract if zero is a valid amount for every discount.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `NotSupportedError` in subtype | Usually a violation | The base operation promised availability to callers. ✅[^3] |
| Narrower accepted input | Violation | It strengthens the precondition beyond the abstraction. ✅[^2] |
| Weaker return guarantee | Violation | It weakens the postcondition the caller relies on. ✅[^2] |
| Extra behavior after success | Accept only if it preserves invariants and expectations | Substitution is behavioral, not only type-shape. ✅[^1] |
| Test double | Must obey the same contract | A mock that lies can make invalid code pass. |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Small precise abstraction | Easier substitution and tests | More upfront contract naming |
| Broad base class | Reuse and fewer declarations | More inherited operations can become invalid |
| Runtime checks | Clear failures during development | Cannot replace designing the right contract |

## Takeaways
- Define the contract before accepting a subtype. [rule-candidate]
- Do not inherit operations an implementation cannot honor. [rule-candidate]
- Prefer narrower abstractions over throwing `NotSupported` from inherited members. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| foundation rule | DP-3 | Source: |

## Verification status
- Verified: 10 claims (✅) · Unverified: 1 claims (⚠️) · Last verified: 2026-10-04

## References
- [A Behavioral Notion of Subtyping](https://www.cs.cmu.edu/afs/cs/project/venari/www/subtype-toplas.html) — Barbara Liskov and Jeannette Wing, 1994. Backs: How it works, Edge cases. [^1]
- [Design by Contract, Assertions and Exceptions](https://www.eiffel.org/doc/eiffel/ET-_Design_by_Contract_%28tm%29%2C_Assertions_and_Exceptions) — Eiffel Software, living. Backs: How it works, Edge cases. [^2]
- [SOLID Relevance](https://blog.cleancoder.com/uncle-bob/2020/10/18/Solid-Relevance.html) — Robert C. Martin, 2020. Backs: Problem, How it works, Edge cases. [^3]
- [A Behavioral Notion of Subtyping (full paper, ACM TOPLAS 16(6))](https://www.cs.cmu.edu/~wing/publications/LiskovWing94.pdf) — Barbara Liskov and Jeannette Wing, 1994. Backs: How it works (history properties: properties over sequences of states that subtypes must preserve). [^4]
- `copilot/frameworks/agentic-sdlc/foundations/design/design-principles.md` — cites this doc as DP-3.

## Related
- `software-design/oop/design-by-contract.md`
- `software-design/oop/polymorphism.md`
- `software-design/oop/composition-over-inheritance.md`
- `software-design/functional-modeling/types-as-rules.md`