---
schema: knowledge-doc/v1
type: concept
topic: software-design/design-principles
status: draft
applies-to: ["any"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [cohesion, coupling, connascence, modularity]
---

# Cohesion and coupling vocabulary

## Summary
**TL;DR:** Cohesion asks whether the things inside a unit belong together; coupling asks how strongly one unit depends on another. Connascence gives modern names for coupling forces by strength, degree, and locality.
**Use this when:** explaining SRP, ISP, separation of concerns, dependency direction, or why a change ripples through many files.
**Not this doc:** individual SOLID rules -> `software-design/design-principles/`.

## Problem
Without a vocabulary for cohesion and coupling, reviews become vague: "this feels messy" instead of "this module has low cohesion because persistence, pricing, and rendering change for different reasons."

Constantine and Yourdon are commonly cited for structured-design vocabulary around cohesion and coupling. ⚠️ unverified

## Mental model
**Analogy:** a toolbox is cohesive when it holds tools for one job; it is highly coupled to another toolbox if every screwdriver only works with one matching screw stored elsewhere.
**Artifact:**
```ts
type ShipmentPolicy = {
  canCancel(status: "draft" | "sent"): boolean;
};

type ShipmentRepository = {
  saveStatus(id: string, status: "cancelled"): Promise<void>;
};
```
The policy and repository are separate because rule decisions and storage mechanisms change for different reasons.

## How it works
Cohesion is high when a unit's elements serve one purpose or change for one reason.

Coupling is low when a unit can change without forcing many other units to change.

Hunt and Thomas describe orthogonality as keeping unrelated concepts independent, which is the same design pressure as high cohesion and low coupling. ✅[^1]

Connascence is a taxonomy and metric for coupling. ✅[^2]

Connascence evaluates a dependency by strength, degree, and locality. ✅[^2]

Stronger connascence is harder to discover or refactor; higher degree means more affected entities; distant locality is worse than nearby locality. ✅[^2]

Common coupling examples include shared mutable globals, control flags, positional arguments, duplicated meanings, and required call timing.

Class-modeled code improves cohesion by grouping state with the behavior that protects it:
```ts
class Shipment {
  constructor(private status: "draft" | "sent") {}
  canCancel(): boolean { return this.status === "draft"; }
}
```

Functional-pipeline code improves cohesion by grouping pure transformations around one data concept:
```ts
type Shipment = Readonly<{ status: "draft" | "sent" }>;
const canCancel = (shipment: Shipment): boolean => shipment.status === "draft";
```

SRP uses cohesion language: one responsibility means one actor or policy reason to change. ISP uses coupling language: consumers should not depend on operations they do not call. SoC uses both: separate concerns to raise cohesion inside units and lower coupling between unrelated concerns.

## Worked example
A `ShipmentService` validates cancel rules, builds SQL, formats HTTP errors, and emails customers. Splitting creates a cohesive `ShipmentPolicy`, `ShipmentRepository`, `ShipmentPresenter`, and `ShipmentNotificationPort`. Coupling remains where it is useful: orchestration knows all collaborators, but policy does not know SQL or HTTP.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Tiny feature | One cohesive module may be simpler than four tiny files | KISS prevents ceremony when change reasons have not diverged. |
| Shared enum across services | Treat it as a contract, not casual reuse | Wide degree and distant locality make changes expensive. ✅[^2] |
| Positional tuple parameters | Prefer named objects when values can be confused | Connascence of position is stronger than name-based coupling. ✅[^2] |
| Temporal protocol | Make order explicit in a state machine or type | Hidden call timing is high-risk dynamic coupling. ✅[^2] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| High cohesion, low coupling | Local changes and clearer tests | More deliberate boundaries |
| One broad service | Fewer files initially | Many reasons to change collide |
| Shared contracts at boundaries | Consistent integration | Versioning and release coordination |

## Takeaways
- Use cohesion to ask whether a unit's contents belong together. [rule-candidate]
- Use coupling and connascence to name how a change propagates. [rule-candidate]
- Relate SRP, ISP, and SoC findings to a concrete cohesion or coupling pressure. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 7 claims (✅) · Unverified: 1 claims (⚠️) · Last verified: 2026-10-04

## References
- [Orthogonality and the DRY Principle](https://www.artima.com/articles/orthogonality-and-the-dry-principle) — Bill Venners interview with Andy Hunt and Dave Thomas, 2003. Backs: How it works. [^1]
- [What is Connascence?](https://connascence.io/) — connascence.io, living. Backs: How it works, Edge cases. [^2]

## Related
- `software-design/design-principles/single-responsibility.md`
- `software-design/design-principles/interface-segregation.md`
- `software-design/design-principles/separation-of-concerns.md`
- `software-design/oop/dependency-injection.md`
