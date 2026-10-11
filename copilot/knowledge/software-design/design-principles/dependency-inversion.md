---
schema: knowledge-doc/v1
type: concept
topic: software-design/design-principles
status: verified
applies-to: ["any"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [solid, dip, dependency-injection, boundaries, ports]
---

# Dependency Inversion at policy boundaries

## Summary
**TL;DR:** Dependency Inversion means high-level policy depends on abstractions it owns, and details implement those abstractions. Dependency Injection is one wiring technique; DIP is the dependency-direction rule.
**Use this when:** domain or use-case code imports a database driver, HTTP client, framework model, or other low-level detail.
**Not this doc:** object construction styles and containers -> `software-design/oop/dependency-injection.md`.

## Problem
When policy imports concrete I/O details, a database, web framework, or vendor SDK change can force edits in the business rules. ✅[^1]

Applying interfaces everywhere also adds noise; this framework applies DIP at boundaries, not to every in-process helper. ✅[^1]

## Mental model
**Analogy:** a wall outlet defines the contract the appliance uses; the power plant and wiring details adapt to that outlet, not the toaster to a turbine.
**Artifact:**
```ts
// Owned by the use-case/policy layer.
interface ShipmentStore { save(shipment: Shipment): Promise<void> }
class BookShipment {
  constructor(private readonly store: ShipmentStore) {}
}
```
The SQL adapter imports `ShipmentStore`; the use case does not import SQL.

## How it works
Clean Architecture's dependency rule says source code dependencies point inward toward higher-level policy, and inner circles do not name outer details. ✅[^1]

Martin describes using DIP at boundary crossings so flow of control can go outward while source dependencies still point inward. ✅[^1]

Fowler defines Dependency Injection as a separate assembler providing plugin implementations to an object, removing the application's direct dependency on the concrete plugin class. ✅[^2]

Therefore DIP decides who owns the abstraction and which way code imports point; DI decides how an implementation instance is supplied at runtime.

Class-modeled code expresses DIP with constructor-injected ports owned by the policy layer. Functional-pipeline code expresses it by passing effect functions or capability records into a pure core while adapters live at the edge.

## Worked example
Violation:
```ts
import { Pool } from "pg";
class BookShipment {
  constructor(private readonly db: Pool) {}
  async book(input: BookingInput) { await this.db.query("insert ..."); }
}
```
Class-modeled boundary:
```ts
interface ShipmentStore { save(shipment: Shipment): Promise<void> } // policy-owned port
class BookShipment {
  constructor(private readonly store: ShipmentStore) {}
  async book(input: BookingInput) { await this.store.save(Shipment.create(input)); }
}
class PgShipmentStore implements ShipmentStore { async save(s: Shipment) { /* pg query */ } }
```
Functional variant:
```ts
type SaveShipment = (shipment: Shipment) => Promise<void>;
const makeBookShipment = (save: SaveShipment) => async (input: BookingInput) => {
  await save(Shipment.create(input));
};
```
The application composition root wires `PgShipmentStore` or `saveWithPg`; the policy code owns only the boundary shape.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Pure helper in same module | No interface needed | DIP is applied at boundaries where detail churn or test substitution matters. ✅[^1] |
| Interface declared in adapter package | Often backwards | The policy should own the abstraction it needs. ✅[^1] |
| Dependency Injection without DIP | Still possible to inject a concrete detail type | DI is wiring; it does not automatically invert source dependencies. ✅[^2] |
| Plugin architecture | Strong fit | Plugins depend on the core contract while the core does not know plugin classes. ✅[^3] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Policy-owned boundary port | Stable core and easier tests | Extra adapter and composition code |
| Concrete detail in policy | Simple first implementation | Detail churn leaks into policy |
| Interface for every class | Mockable everywhere | Boilerplate and weaker readability |

## Takeaways
- Put boundary abstractions in the policy layer that needs them. [rule-candidate]
- Use DI as a wiring tool, not as a substitute for dependency direction. [rule-candidate]
- Apply DIP where I/O, frameworks, or deployment details cross into policy. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| foundation rule | DP-5 | Source: |

## Verification status
- Verified: 9 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) — Robert C. Martin, 2012. Backs: Problem, How it works, Edge cases. [^1]
- [Inversion of Control Containers and the Dependency Injection pattern](https://martinfowler.com/articles/injection.html) — Martin Fowler, 2004. Backs: How it works, Edge cases. [^2]
- [Plugin](https://martinfowler.com/eaaCatalog/plugin.html) — Martin Fowler, 2002. Backs: Edge cases. [^3]
- [SOLID Relevance](https://blog.cleancoder.com/uncle-bob/2020/10/18/Solid-Relevance.html) — Robert C. Martin, 2020. Backs: Summary. [^4]
- `copilot/frameworks/agentic-sdlc/foundations/design/design-principles.md` — cites this doc as DP-5.

## Related
- `software-design/oop/dependency-injection.md`
- `software-design/ddd/layering.md`
- `software-design/functional-modeling/functional-core.md`
- `software-design/design-principles/separation-of-concerns.md`