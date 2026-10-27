---
schema: deep-dive/v1
topic: software-design/architecture-styles
status: verified
applies-to: ["any"]
last-updated: 2026-10-27
last-verified: 2026-10-25
synthesized-into: []
tags: [hexagonal, ports-and-adapters, driving, driven, configurator, test-harness, cockburn]
---

# Hexagonal Architecture (Ports and Adapters), end to end

## Summary
**TL;DR:** Alistair Cockburn's 2005 pattern splits a system into an **inside** (the application) and an **outside** (people, programs, tests, databases). The inside talks to the outside only through **ports**, which are technology-free conversations. Each technology connects through an **adapter**. Driving actors start conversations; the application starts conversations with driven actors. Clean Architecture later put concentric circles (layers) *inside* this hexagon.
**Use this when:** naming ports, deciding whether a class is a driving or a driven adapter, wiring adapters in a configurator (composition root), or testing without a database or UI.
**Depth:** intent and motivation; vocabulary; analogies; driving vs. driven with Cockburn's own code; the configurator; the discount and tax examples step by step; how many ports; known uses; related patterns; costs; edge cases; mapping to the stack reference; self-check.

## 1. The problem it solves

Cockburn names the long-standing problem: the "infiltration of business logic into the user interface code" ✅[^1]. Such a system "can't neatly be tested with automated test suites", because the logic depends on visual details ✅[^1]. On the other side, "when the database server goes down or undergoes significant rework or replacement, the programmers can't work" ✅[^1].

**Intent** (first clause): "Allow an application to equally be driven by users, programs, automated test or batch scripts" ✅[^1]. The intent continues: develop and test the application in isolation from its eventual run-time devices and databases ✅[^1].

## 2. Vocabulary

| Term | Meaning | Source |
|---|---|---|
| Inside / outside | The application vs. everything else. "Code pertaining to the inside part should not leak into the outside part" | ✅[^1] |
| Port | "A port identifies a purposeful conversation". The application "communicates over ports to external agencies", using a protocol that "takes the form of an application program interface (API)" | ✅[^1] |
| Adapter | Converts between a port's API and one technology. "A graphical user interface or GUI is an example of an adapter" | ✅[^1] |
| Primary (driving) actor | "An actor that drives the application" | ✅[^1] |
| Secondary (driven) actor | "One that the application drives, either to get answers from or to merely notify" | ✅[^1] |
| Configurator | The code that creates the adapters and hands them to the application; in the book's example, `main()` | ✅[^2] |

## 3. Analogies

| Analogy | Source |
|---|---|
| **Operating-system ports:** any device that follows the port's protocol can be plugged in | Cockburn ✅[^1] |
| **Electronics ports:** any device fitting the mechanical and electrical protocol plugs in | Cockburn ✅[^1] |
| **USB:** many devices talk to one computer, "as long as they use a USB adapter" | AWS ✅[^3] |
| **Travel plug** *(teaching analogy, ours)*: the hotel's wall socket is the port, owned by the building. Your plug adapter is the adapter. The hotel never rewires for your hair-dryer | — |
| **A TV with HDMI inputs** *(teaching analogy, ours)*: games console, laptop and test-signal generator all drive the same TV through one HDMI port. The test generator is the "automated test" actor | — |

## 4. Why a hexagon?

"The hexagon is not a hexagon because the number six is important" ✅[^1]. The shape leaves room to draw ports and adapters on each side. Cockburn's own count "tends to favor a small number, two, three or four ports" ✅[^1]. The weather-system case had "four natural ports": the feed, the administrator, the subscribers and the subscriber database ✅[^1].

## 5. Driving vs. driven: the asymmetry that matters

"The distinction between primary and secondary lies in who triggers or is in charge of the conversation" ✅[^1]. Cockburn draws primary adapters on the left (or top) and secondary ones on the right (or bottom) ✅[^1]. The left/right placement is only a drawing aid; the real asymmetry is inside/outside ✅[^1].

### Diagram

```text
     DRIVING side (they start the talk)               DRIVEN side (the app starts the talk)
  ┌────────────────┐                                         ┌────────────────────┐
  │ HTTP controller│──calls──►┌──────────────────────┐──calls──►│ SQL repository     │
  │ CLI            │          │  port: ForRevising   │          │ (implements        │
  │ Test harness   │          │  APPLICATION         │          │  ForStoringDocs)   │
  └────────────────┘          │  port: ForStoringDocs│          └────────────────────┘
   adapter → port the app     └──────────────────────┘           adapter implements the
   IMPLEMENTS                                                     port the app USES
```

### Cockburn's own code (tax calculator) ✅[^2]

```java
interface ForCalculatingTaxes { double taxOn(double amount); }   // driving port
interface ForGettingTaxRates  { double taxRate(double amount); } // driven port

class TaxCalculator implements ForCalculatingTaxes {           // the application
  private ForGettingTaxRates taxRateRepository;
  public TaxCalculator(ForGettingTaxRates r) { this.taxRateRepository = r; }
  public double taxOn(double amount) { return amount * taxRateRepository.taxRate(amount); }
}
class FixedTaxRateRepository implements ForGettingTaxRates {    // driven adapter
  public double taxRate(double amount) { return 0.15; }
}
// main(): creates FixedTaxRateRepository, passes it to TaxCalculator, calls taxOn(100)
```

The book's notes, verified ✅[^2]:
- "ForCalculatingTaxes" is the driving port; "ForGettingTaxRates" is the driven port.
- "The TaxCalculator implements the driving port, and uses the driven port."
- "Main acts as both the configurator and, in this tiny case, also the driving actor."

**The rule to remember:**

| | The application… | The adapter… |
|---|---|---|
| Driving port | **implements** it | **calls** it |
| Driven port | **uses** it | **implements** it |

**Naming:** Cockburn's examples name ports for their purpose, as `For<Verb>ing`: `ForCalculatingTaxes`, `ForGettingTaxRates` ✅[^2].

## 6. Step-by-step: building the system in stages

Cockburn's discount example computes `discount(amount) = amount * rate(amount)` and grows in stages ✅[^1]:

| Stage | Driving adapter | Driven adapter | What it proves |
|---|---|---|---|
| 1 | FIT test harness | A constant as the "mock database" | The application logic works with no UI and no database |
| 2–3 | FIT or a UI | An in-memory mock database | UI and storage can be swapped behind their ports |
| Real use | A person using the UI | The live database | Same application code |

The book's tax example grows the same way ✅[^2]:
1. constructor injection;
2. the same code in Ruby, with no declared interfaces;
3. setter injection;
4. dependency lookup through a "rate repository broker" that picks a repository per country, which needs its own port, test double and configurator.

## 7. Where it was used, and related patterns

Known-uses headings in the article: Mac, Windows, Google, Flickr, Web 2.0; Stored Outputs; Distributed, Large-Team Development; Separating Development of UI and Application Logic ✅[^1].
- In the UI-separation case, the UI was unstable because the team had not chosen "a driving technology or a metaphor yet". "The application team creates FIT tests and mocks to isolate their application" ✅[^1].

Related patterns listed: Adapter; Model-View-Controller; Mock Objects and Loopback; Pedestals; Checks; Dependency Inversion (Dependency Injection) and SPRING ✅[^1].
- "A mock object is a 'double agent' used to test the behaviour of other objects" ✅[^1].
- "The Loopback pattern is an explicit pattern for creating an internal replacement for an external device" ✅[^1].
- On dependency injection, Cockburn points to Fowler's article, which shows "how to create swappable secondary actor adapters" ✅[^1].

**Use cases:** "use cases should generally be written at the application boundary", describing functions "regardless of external technology" ✅[^1].

## 8. Relationship to other styles

| Style | Relationship | Source |
|---|---|---|
| Clean Architecture | Lists Hexagonal first among its five sources, noting Freeman and Pryce adopted it in *Growing Object Oriented Software* | ✅[^4] |
| Fowler's layering | "A common variation is to arrange things so that the domain does not depend on its data sources", often called Hexagonal | ✅[^5] |
| Functional core | "Good Functional design is equivalent to the Ports and Adapters architecture" | ✅[^6] |
| Microsoft guide | Hexagonal → Ports-and-Adapters → Onion → Clean: names for one architecture | ✅[^7] |

## 9. When it pays, and its cost

From AWS's applicability list ✅[^3]. Use it when:
- you want fully testable components;
- multiple types of clients use the same domain logic;
- UI or database need technology refreshes;
- there are many inputs and outputs.

Costs ✅[^3]:
- The adapter code is "justified only if" there are several input sources and output destinations, or they change over time. Otherwise it is "maintenance overhead".
- The extra layer "might result in latency".

AWS also shows one port with two adapters: adding a GraphQL adapter beside a REST adapter without changing the port or the application ✅[^3].

## 10. Edge cases

| # | Situation | Answer | Source |
|---|---|---|---|
| H1 | A driving adapter calls a driven adapter directly | Breaks the inside/outside rule; the application is the only hub | inside must not leak ✅[^1]; CA-10 in this framework |
| H2 | Port named after a technology (`SqlPort`) | Wrong: a port is a *purposeful* conversation | ✅[^1][^2] |
| H3 | How many ports? | Taste: usually 2–4 | ✅[^1] |
| H4 | A test harness replaces the UI | Intended: tests are one more driving actor | ✅[^1] |
| H5 | An in-memory database in tests | The Loopback / mock-database pattern | ✅[^1] |
| H6 | Who creates the adapters? | The configurator (`main`), never the application | ✅[^2] |

## 11. Mapping to the stack reference

| Hexagonal | Stack reference |
|---|---|
| Driving port | `ReviseDocument.run()`, used directly without a separate interface (analysis, ours: allowed because the application implements it) |
| Driving adapter | `src/interface/routes/ReviseDocumentHandler.ts` |
| Driven port | `src/application/ports/DocumentStore.ts` |
| Driven adapter | `src/infrastructure/InMemoryDocumentStore.ts` |
| Configurator | `src/CompositionRoot.ts` (+ `main.ts`) |
| Test harness as driving actor | `test/integration/*.int.test.ts` (over HTTP) and unit tests calling `run()` |

## 12. Check yourself
1. Which side implements the driving port? *(The application.)*
2. `InMemoryDocumentStore`: driving or driven? *(Driven.)*
3. Rename `PostgresPort` the way Cockburn would. *(`ForStoringDocuments`.)*
4. Who is the configurator in the reference? *(`CompositionRoot` + `main.ts`.)*

## References
- [^1]: [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/) — Alistair Cockburn, 2005. Backs: §1–§7, §10.
- [^2]: [Hexagonal Architecture Explained, code preview v0.9a (PDF)](https://alistaircockburn.com/code%20hexarch%20book%20v0.9a.pdf) — Alistair Cockburn and Juan Manuel Garrido de Paz, 2024. Backs: §2, §5, §6, H2, H6.
- [^3]: [Hexagonal architecture pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/hexagonal-architecture.html) — AWS Prescriptive Guidance, living. Backs: §3, §9.
- [^4]: [The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) — Robert C. Martin, 2012. Backs: §8.
- [^5]: [Presentation Domain Data Layering](https://martinfowler.com/bliki/PresentationDomainDataLayering.html) — Martin Fowler, 2015. Backs: §8.
- [^6]: [Functional architecture is Ports and Adapters](https://blog.ploeh.dk/2016/03/18/functional-architecture-is-ports-and-adapters/) — Mark Seemann, 2016. Backs: §8.
- [^7]: [Common web application architectures](https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/common-web-application-architectures) — Microsoft, living. Backs: §8.
- [conanjs/agentic-sdlc-reference-typescript-node @ v1.2.0](https://github.com/conanjs/agentic-sdlc-reference-typescript-node/tree/a8e776660fe686a716fc1f80550f2671c972cc7b) — mapped in §11 (the stack reference, pinned by `copilot/frameworks/agentic-sdlc/stacks/typescript-node/reference.md`). The same code in the default feature-first layout (MOD-9): [@ v2.0.0](https://github.com/conanjs/agentic-sdlc-reference-typescript-node/tree/171c3ba548fd5b00913f8c6a62acdd591f278c91) (`src/documents/`, `src/shared/`).

## Related
- `software-design/architecture-styles/hexagonal-architecture.md` — the short concept doc.
- `software-design/architecture-styles/clean-architecture-deep-dive.md`
- `software-design/architecture-styles/onion-architecture-deep-dive.md`
- `software-design/functional-modeling/functional-core.md`
