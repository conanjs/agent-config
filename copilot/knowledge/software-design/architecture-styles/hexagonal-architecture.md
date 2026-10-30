---
schema: knowledge-doc/v1
type: concept
topic: software-design/architecture-styles
status: verified
applies-to: ["any"]
last-verified: 2026-10-25
last-updated: 2026-10-25
tags: [hexagonal-architecture, ports-and-adapters, driving-adapter, driven-adapter, architecture]
---

# Hexagonal architecture (ports and adapters)

## Summary
**TL;DR:** The application sits in the middle and talks to the outside world only through ports, which are interfaces it owns. Adapters translate a technology (HTTP, SQL, a test script) into calls on those ports. Every request passes through the application, so adapters never call each other.
**Use this when:** deciding whether a controller may call a repository directly, naming ports, or explaining why an HTTP layer must not import a storage layer.
**Not this doc:** concentric rings and the dependency rule → `clean-architecture.md`. How this fits with DDD → `combining-styles.md`. Wiring mechanics → `../oop/dependency-injection.md`.

## Problem
Business logic leaks into UI code and database code, which makes it hard to test and ties it to a technology that may change. Cockburn names the same mistake on both sides: business logic tangled up with talking to external things. ✅[^1]

A second, quieter failure: an HTTP handler that reads storage directly skips the application. It skips every check the application would have run, such as authorization.

## Mental model
**Analogy:** a restaurant kitchen with hatches. Waiters (driving adapters) hand orders through the front hatch. Suppliers (driven adapters) deliver through the back hatch. A waiter never walks into the storeroom: every order goes through the kitchen, which decides what is allowed.

**Artifact:**
```text
          driving side                        driven side
 [HTTP controller] ─┐                    ┌─▶ [SqlDocumentStore]
 [CLI command]     ─┼─▶ ( APPLICATION ) ─┼─▶ [JwtTokenService]
 [Test script]     ─┘   owns the ports   └─▶ [PinoAuditLogger]

 allowed:   controller → use case → DocumentStore (port) ← SqlDocumentStore
 forbidden: controller → SqlDocumentStore
```

## How it works
**Actors**

| Actor | Role |
|---|---|
| Application (inside) | Holds use cases and business rules; declares the ports it needs |
| Driving port | The interface outsiders call to make the application do something |
| Driving adapter | Converts an outside event (HTTP request, CLI args, test call) into a driving-port call |
| Driven port | The interface the application calls when it needs something outside (storage, tokens, logging) |
| Driven adapter | Implements a driven port with one technology |

**Flow**

1. An outside event reaches a driving adapter. The adapter converts it into a call or message the application understands. ✅[^1]
2. The application runs the use case and its rules. It does not know which device is on the other side of any adapter. ✅[^1]
3. When it needs something outside, the application calls out through a port to a driven adapter. ✅[^1]
4. The result goes back the same way.

**Cross-side interactions**

| Change on one side | Effect on the other sides |
|---|---|
| Swap the driven adapter (SQL → in-memory) | The driving adapter and the application are unchanged |
| Add a driving adapter (CLI next to HTTP) | The new adapter reuses the same use cases. The rules are not duplicated |
| A driving adapter calls a driven adapter directly | The application is bypassed. Rules and checks in the use case no longer run for that path |

The pattern lets the same application be driven by users, programs, automated tests or batch scripts. It can be tested apart from its eventual UI and database. ✅[^1] Cockburn's sample code has the UI and test adapters call the application, never each other. ✅[^1]

## Worked example
`DELETE /api/documents/7` from a user whose only role is `viewer`.

1. The HTTP adapter parses the id `7` and calls `DocumentService.delete(principal, 7)`.
2. The use case asks the access policy whether `viewer` may delete. The answer is no, so it returns `forbidden`.
3. The HTTP adapter maps `forbidden` to status 403. Storage is never touched.

If the handler had imported `SqlDocumentStore` and called `remove(7)` directly, step 2 would not exist and the document would be deleted.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Controller imports a repository implementation | Rules in the use case are skipped for that path | All traffic is meant to go through the application ✅[^1] |
| Port declared next to its SQL adapter | The inside now depends on the outside's module | Ports belong to the application side ✅[^1] |
| Composition root imports both sides | Allowed | It only wires the parts together and makes no decisions |
| Read-only query path | Some teams let a query adapter read storage directly | A deliberate simplification. Record it, because it is still an exception |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Strict ports and adapters | Swappable technology; every path runs the rules; fast tests with fake adapters | More interfaces and mapping code |
| Adapters may call each other | Fewer files | Rules can be bypassed; technology changes ripple across adapters |

## Takeaways
- Adapters do not depend on each other; a driving adapter reaches a driven adapter only through a use case and its port. [rule-candidate]
- Declare ports on the application side, in the application's vocabulary. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| foundation rule | CA-10 | Source: |

## Verification status
- Verified: 8 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-25

## References
- [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/) — Alistair Cockburn, 2005. Backs: Problem, How it works, Edge cases. [^1]
- `copilot/frameworks/agentic-sdlc/foundations/design/clean-architecture.md` — cites this doc as CA-10.

## Related
- `software-design/architecture-styles/clean-architecture.md`
- `software-design/architecture-styles/combining-styles.md`
- `software-design/ddd/layering.md`
- `software-design/oop/dependency-injection.md`
