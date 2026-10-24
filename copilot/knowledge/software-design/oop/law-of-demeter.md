---
schema: knowledge-doc/v1
type: concept
topic: software-design/oop
status: verified
applies-to: ["any"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [oop, law-of-demeter, coupling, tell-dont-ask]
---

# Law of Demeter

## Summary
**TL;DR:** The Law of Demeter limits how far one method reaches through an object graph. A method should talk to close collaborators instead of navigating strangers' internals.
**Use this when:** reviewing train-wreck calls, deciding whether to add a domain method, or balancing encapsulation against wrapper bloat.
**Not this doc:** broader encapsulation and tell-don't-ask → `software-design/oop/encapsulation.md`.

## Problem
Long chains such as `order.customer().address().country().taxZone()` make the caller know the route through several objects. The Demeter pages describe LoD as a style rule for object-oriented systems that reduces unnecessary coupling by limiting knowledge of other units. ✅[^1]

## Mental model
**Analogy:** ask your direct teammate for the report; do not walk through their manager's filing cabinet, then the finance shelf, then a locked archive.
**Artifact:**
```ts
// Train wreck: caller knows the path through Order -> Customer -> Address.
const zone = order.customer().address().taxZone();

// Demeter-friendly: Order exposes the fact this caller needs.
const zone = order.taxZone();
```
The second call lets `Order` decide where tax-zone knowledge lives.

## How it works
Lieberherr's Demeter page says the Law of Demeter was first proposed at Northeastern in 1987 by Ian Holland and is often summarized as “Only talk to your friends.” ✅[^1]

A general formulation says each unit should have only limited knowledge about closely related units. ✅[^2]

For object-oriented methods, closely related collaborators include `this`, method arguments, objects created inside the method, and immediate parts of the receiver. ✅[^2]

The rule targets coupling: a caller that reaches through returned objects becomes sensitive to intermediate structure changes. ✅[^2]

Tell-don't-ask is related because it moves behavior to the object that owns the data, rather than asking for data and making the decision elsewhere. ✅[^3]

Fluent builders and pipelines are not automatically LoD violations: Fowler describes fluent interfaces as APIs designed to read like an internal DSL, where chaining is part of the API contract. ✅[^4]

A stream or array pipeline such as `items.map(...).filter(...).join(",")` is also different from a train wreck because every step returns the same abstraction family rather than exposing nested domain internals. ✅[^4]

A known trade-off is wrapper method growth: the Demeter formulation notes that method-level LoD can lead to narrow method knowledge but wider class interfaces with many auxiliary methods. ✅[^2]

## Worked example
A shipping quote needs a destination country.
```ts
class Order {
  constructor(private customer: Customer) {}
  destinationCountry() { return this.customer.destinationCountry(); }
}
class Customer {
  constructor(private address: Address) {}
  destinationCountry() { return this.address.country; }
}
```
The application calls `order.destinationCountry()`. If the customer later supports multiple delivery addresses, only `Order` and `Customer` choose the new route; quote calculation keeps one direct conversation.

Acceptable fluent builder contrast:
```ts
const order = OrderBuilder
  .forCustomer("C-1")
  .withLine("SKU-1", 2)
  .rush()
  .build();
```
The chain is a purpose-built builder language, not navigation through hidden domain structure.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Data mapper or serializer | It may traverse structure intentionally | Boundary mapping is about shape translation, not domain decision logic. ✅[^2] |
| Fluent builder | Chaining can be acceptable | The chain is the designed DSL surface. ✅[^4] |
| Value pipeline | Chaining can be acceptable | Each step exposes a collection/value operation rather than nested object ownership. ✅[^4] |
| Every getter wrapped | The API can bloat | LoD can create many forwarding methods if applied mechanically. ✅[^2] |
| Query that is already the object's job | Keep the query | Fowler warns tell-don't-ask can be overused against useful information-providing methods. ✅[^3] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Follow LoD strictly | Lower structural coupling | More wrapper and forwarding methods |
| Allow selective traversal | Less boilerplate | Callers may depend on internals |
| Tell the owner to act | Behavior and data stay together | Owner may gain too many responsibilities |
| Fluent API | Readable domain language | More API design effort |

## Takeaways
- Replace domain train wrecks with intention-revealing methods on the nearest responsible object. [rule-candidate]
- Do not flag fluent builders or collection pipelines as LoD violations just because they chain calls. [rule-candidate]
- Watch for wrapper explosion; LoD is a coupling tool, not a ban on all queries. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 14 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [Law of Demeter: Principle of Least Knowledge](https://www.ccs.neu.edu/home/lieber/LoD.html) — Karl Lieberherr / Northeastern University, living. Backs: Problem, How it works. [^1]
- [Law of Demeter general formulation](https://www2.ccs.neu.edu/research/demeter/demeter-method/LawOfDemeter/general-formulation.html) — Demeter Project / Northeastern University, living. Backs: How it works, Edge cases, Trade-offs. [^2]
- [TellDontAsk](https://martinfowler.com/bliki/TellDontAsk.html) — Martin Fowler, 2013. Backs: How it works, Edge cases. [^3]
- [FluentInterface](https://martinfowler.com/bliki/FluentInterface.html) — Martin Fowler, 2005. Backs: How it works, Edge cases. [^4]

## Related
- `software-design/oop/encapsulation.md`
- `software-design/oop/core-concepts.md`
- `software-design/oop/composition-over-inheritance.md`
- `software-design/ddd/aggregates.md`