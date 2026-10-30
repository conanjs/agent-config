---
schema: knowledge-doc/v1
type: concept
topic: software-design/design-principles
status: draft
applies-to: ["any"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [separation-of-concerns, information-hiding, boundaries, architecture]
---

# Separation of concerns by change reason

## Summary
**TL;DR:** Separation of concerns keeps different kinds of knowledge in different units: domain rules, I/O, presentation, and orchestration should not be tangled. The goal is not more layers for their own sake; it is fewer reasons for one edit to force unrelated edits.
**Use this when:** business rules appear in controllers, SQL strings, templates, queue consumers, or UI event handlers.
**Not this doc:** aggregate transaction boundaries -> `software-design/ddd/aggregates.md`; functional shell mechanics -> `software-design/functional-modeling/functional-core.md`.

## Problem
When a request handler validates business rules, formats HTML, reads storage, and sends notifications, one unit has many change reasons and many dependencies.

Dijkstra's EWD447 is commonly cited as an early source for the phrase separation of concerns. ⚠️ unverified

Parnas argued that module boundaries should hide design decisions likely to change rather than simply follow processing steps. ✅[^4]

## Mental model
**Analogy:** a restaurant separates recipe design, cooking, table service, and accounting; changing the menu price should not require changing the oven procedure.
**Artifact:**
```ts
type Decision = Readonly<{ kind: "allow" } | { kind: "deny"; reason: string }>;

type AccessPolicy = {
  canReadShipment(role: "admin" | "viewer", owner: boolean): Decision;
};
```
The policy is the recipe; HTTP, database, and UI are the kitchen tools and dining room.

## How it works
A concern is a coherent kind of knowledge or change pressure, such as domain policy, persistence, transport, presentation, or orchestration.

Hunt and Thomas describe orthogonality as keeping conceptually unrelated things unrelated in the system, so a change in one concept does not force a change in another. ✅[^1]

For design-principle reviews, separate at least four concerns: domain logic, I/O, presentation, and orchestration.

Domain logic decides what is true or allowed; I/O obtains and persists facts; presentation formats data for a person or client; orchestration orders calls and handles workflow.

Class-modeled code realizes separation by putting invariants and behavior on domain objects, while application services orchestrate repositories and adapters:
```ts
class ShipmentPolicy {
  canCancel(status: "draft" | "sent"): boolean {
    return status === "draft";
  }
}

class CancelShipment {
  constructor(private readonly repo: { saveStatus(id: string, status: string): Promise<void> }) {}
}
```

Functional-core/imperative-shell code realizes separation by making the core produce values while the imperative shell handles database, network, stdin, and stdout effects. ✅[^2]
```ts
const decideCancellation = (status: "draft" | "sent"): Decision =>
  status === "draft" ? { kind: "allow" } : { kind: "deny", reason: "already_sent" };
```

Separation differs from over-layering: a boundary is useful when it protects a decision that changes for a different reason.

## Worked example
A `POST /shipments/42/cancel` endpoint receives an HTTP request. The adapter parses `shipmentId = "42"`; a repository loads `status = "sent"`; the domain policy returns `{ kind: "deny", reason: "already_sent" }`; the presenter maps it to HTTP 409. The business rule can be tested without HTTP or database, and the HTTP mapping can change without editing the rule.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Small script | A single file can still separate functions by concern | KISS can outweigh formal layers until changes diverge. ✅[^3] |
| SQL encodes a domain rule | Move the rule or make the query a named domain concept | Hidden rules in I/O are hard to test apart from storage. |
| UI-only formatting | Keep it in presentation | It changes with user display needs, not domain policy. |
| Cross-cutting logging | Keep logging at orchestration or shell edges | Effectful work belongs in the shell around the decision core. ✅[^2] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Separate domain, I/O, presentation, orchestration | Clear tests and lower unrelated change impact | More files and boundaries |
| Inline everything in handlers | Fast first edit | Business rules hide in transport code |
| Boundary only at proven change points | KISS-friendly | Requires reviewers to name the change pressure |

## Takeaways
- Keep domain decisions out of request handlers, query strings, and templates. [rule-candidate]
- Add a boundary when two concerns change for different reasons, not merely to satisfy a layer diagram. [rule-candidate]
- In functional code, keep effects at the shell; in class-modeled code, keep invariants on behavior-owning objects. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| foundation rule | DP-10 | Source: |

## Verification status
- Verified: 5 claims (✅) · Unverified: 1 claim (⚠️) · Last verified: 2026-10-04

## References
- [Orthogonality and the DRY Principle](https://www.artima.com/articles/orthogonality-and-the-dry-principle) — Bill Venners interview with Andy Hunt and Dave Thomas, 2003. Backs: How it works. [^1]
- [Functional Core, Imperative Shell](https://www.destroyallsoftware.com/screencasts/catalog/functional-core-imperative-shell) — Gary Bernhardt / Destroy All Software, 2012. Backs: How it works, Edge cases. [^2]
- [Yagni](https://martinfowler.com/bliki/Yagni.html) — Martin Fowler, 2015. Backs: Edge cases. [^3]
- [On the Criteria To Be Used in Decomposing Systems into Modules](https://wstomv.win.tue.nl/edu/2ip30/references/criteria_for_modularization.pdf) — David L. Parnas, Communications of the ACM, 1972. Backs: Problem (decompose by design decisions likely to change, not flowchart steps). [^4]
- `copilot/frameworks/agentic-sdlc/foundations/design/design-principles.md` — cites this doc as DP-10.

## Related
- `software-design/ddd/layering.md`
- `software-design/ddd/bounded-contexts.md`
- `software-design/functional-modeling/functional-core.md`
- `software-design/oop/encapsulation.md`
