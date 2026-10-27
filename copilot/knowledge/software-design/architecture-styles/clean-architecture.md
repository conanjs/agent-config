---
schema: knowledge-doc/v1
type: concept
topic: software-design/architecture-styles
status: verified
applies-to: ["any"]
derived-from: [software-design/architecture-styles/clean-architecture-deep-dive.md]
last-verified: 2026-10-27
last-updated: 2026-10-27
tags: [clean-architecture, dependency-rule, interface-adapters, presenter, input-port, output-port, request-response, architecture]
---

# Clean architecture and the dependency rule

## Summary
**TL;DR:** Clean architecture draws the code as rings: business rules in the centre, then use cases, then interface adapters (controllers, presenters, gateways), then frameworks and drivers. The one rule is that source-code dependencies point only inward. When control must flow outward, an inner ring declares an interface and an outer ring implements it.
**Use this when:** checking an import's direction, deciding where a presenter or controller lives, naming the input, output and gateway ports, choosing between returning a result and calling an output port, or explaining why the domain must not import the framework.
**Not this doc:** inside/outside and adapter-to-adapter calls → `hexagonal-architecture.md`. How it combines with DDD and onion → `combining-styles.md`. The full treatment (origins, diagrams, every port, the stack reference reviewed line by line) → `clean-architecture-deep-dive.md`.

## Problem
When the business rules import the web framework or the database driver, every change to those details touches the rules, and the rules cannot be tested without them.

## Mental model
**Analogy:** an onion of rooms in a castle. People in an outer room may walk inward. Nobody in an inner room even knows the names of the outer rooms. Messages that must go outward are left in a mailbox the inner room owns.

**Artifact:**
```text
 ┌─ Frameworks & drivers: web server, DB driver ─────────────┐
 │ ┌─ Interface adapters: controllers, presenters, gateways ┐│
 │ │ ┌─ Use cases (application rules) ───────────────────┐ ││
 │ │ │ ┌─ Entities (enterprise / domain rules) ───────┐  │ ││
 │ │ │ └──────────────────────────────────────────────┘  │ ││
 │ │ └───────────────────────────────────────────────────┘ ││
 │ └────────────────────────────────────────────────────────┘│
 └───────────────────────────────────────────────────────────┘
  every import arrow points inward
```

## How it works
1. **Dependency rule.** Source-code dependencies can only point inward. ✅[^1]
2. **Interface adapters ring.** Adapters convert data between the form the use cases need and the form an external agent needs, such as the database or the web. Presenters, views and controllers all belong in this ring. ✅[^1]
3. **Crossing a boundary outward.** Control flows controller → use case → presenter, which is outward at the last step. In Martin's figure, the use case declares an output interface and the presenter implements it. That way the source-code dependency opposes the flow of control at the boundary. ✅[^1] This is the dependency inversion principle applied at the ring edge (`../design-principles/dependency-inversion.md`). It is one of two forms; the other is in item 7.
4. **The rings are schematic.** Four is not a law; you may need more. ✅[^1]
5. **Same goal as its peers.** Hexagonal, onion and similar architectures share the objective of separation of concerns. ✅[^1]
6. **Three ports, all owned by the use-case ring.** A port is an interface; the restaurant picture is a menu, a supplier order form and a serving hatch.

   | Port | Implemented by | Called by | Plain meaning | Restaurant |
   |---|---|---|---|---|
   | **Input port** | the interactor (the use case class) | the controller | What you can ask this use case to do | the menu |
   | **Output port** | the presenter | the interactor | How the use case hands back its result | the serving hatch |
   | **Gateway port** | a gateway adapter (database, API) | the interactor | What data the use case needs from outside | the supplier order form |

   The input and output ports are labelled in Martin's figure, gateways are named in the adapters ring, and "the same technique is used to cross all the boundaries". ✅[^1] An input port, written out:

   ```ts
   // src/application/ReviseDocumentInputPort.ts — the use case's ring owns it
   export interface ReviseDocumentInputPort {
     run(input: ReviseDocumentInput): Promise<Result<ReviseDocumentOutput, ReviseDocumentError>>;
   }
   export class ReviseDocument implements ReviseDocumentInputPort { /* the interactor */ }

   // the controller depends on the port, so a test can hand it a fake:
   const fake: ReviseDocumentInputPort = { run: async () => ({ ok: false, error: "not-found" }) };
   ```

   A port does not need its own `interface` keyword. In the stack reference the input port is simply the public `run()` method of `ReviseDocument`; the class's public shape plays the role. Write the interface once a second implementation must stand in for the use case, such as a test fake or a logging wrapper.
7. **Two ways to hand back a result.** Calling the presenter by name is forbidden: "this call must not be direct because that would violate The Dependency Rule". ✅[^1] That leaves two allowed forms:

   | Form | Use-case code | Names anything outer? |
   |---|---|---|
   | ✗ Direct call | `import { Handler } from "…/interface/…"; this.handler.show(out);` | Yes: forbidden |
   | A. Output port (Martin's figure) | `output.revised(out);`, where `output` is the ring's own interface | No |
   | B. Return (request/response) | `return { ok: true, value: out };` | No: a `return` has no target name |

   Form B needs no inversion, because to *call* something your code must write its name, but to *return* it writes only `return value`. The language delivers the value to whoever called. Cockburn's own hexagonal example works this way: `public double discount(double amount)` returns a value that the UI adapter displays. ✅[^2] Martin's later OpenChat code also returns from its use cases, with no presenter. ✅[^3] The cost of form B: a return gives one value, once, to one caller. Feeding several presenters, or pushing progress over time, needs form A. Record which form a project uses.
8. **Only simple data crosses a boundary.** "We don't want to cheat and pass Entities or Database rows." ✅[^1] So a use case returns (or hands the output port) a plain output model, not the entity. One honest exception: Martin's own OpenChat demo returns entities and lets its API class pick the JSON fields. ✅[^3][^4] The written rule is the safer default, because otherwise every caller depends on the entity's shape.

**What a presenter is here.** A presenter is the adapter that turns a use case's output into the shape the outside world sees (a view model, or a JSON body for an API). Example: given a user entity holding `id`, `username` and `passwordHash`, `UserPresenter` returns `{ id, username }`. A later field never leaks unless someone adds it to the presenter on purpose. The name has an older, different meaning in Model-View-Presenter UI design (an object that reacts to user input). A project should say which one it means. In form B, the controller does the presenter's job: it chooses the status code and the JSON shape for each outcome.

## Worked example
A login request (an illustration, not code in the repo).

| Step | Ring | What happens | Import direction |
|---|---|---|---|
| 1 | Frameworks | The web server hands the request to the controller | Framework code → controller |
| 2 | Adapters | The controller builds `LoginInput` and calls the `Login` use case | Adapter → use case ✓ |
| 3 | Use cases | `Login` checks the password through the `PasswordHasher` port, which it declares | Use case → its own port ✓ |
| 4 | Entities | `User` and `Role` decide the principal's permissions | Use case → entity ✓ |
| 5 | Adapters | `Login` returns its output; `UserPresenter` maps it to `{ id, username, roles }` | Presenter → use-case output type ✓ |
| ✗ | Entities | `User` imports the web framework's `Request` | Inner → outer: violates the rule |

Step 5 uses form B (item 7): `Login` returns, and no output port is involved. Here the user has roles, so the presenter includes them; the `{ id, username }` example above has none.

**The same flow in the stack reference** ([conanjs/agentic-sdlc-reference-typescript-node @ v1.2.0](https://github.com/conanjs/agentic-sdlc-reference-typescript-node/tree/a8e776660fe686a716fc1f80550f2671c972cc7b)), for `PUT /documents/42` with `{"body":"new text","expectedVersion":2}`:

| Step | Ring | What happens (file:line) | Import direction |
|---|---|---|---|
| 1 | Frameworks | Express calls `revise.handle(req, res)` (`CompositionRoot.ts:38`) | Framework glue → controller |
| 2 | Adapters | `ReviseDocumentHandler` checks the body and calls the input port: `this.reviseDocument.run({ id: req.params.id, ...parsed.data })` (`ReviseDocumentHandler.ts:31`) | Adapter → use case ✓ |
| 3 | Use cases | `ReviseDocument` loads and saves through the gateway port `DocumentStore` (`ReviseDocument.ts:46,54`) | Use case → its own port ✓ |
| 4 | Entities | `current.revise(input.body, input.expectedVersion)` applies the rule (`ReviseDocument.ts:49`) | Use case → entity ✓ |
| 5 | Use cases | Returns the plain output `{ id, body, version }`, not the entity (`ReviseDocument.ts:57–58`) | Form B: no outward name |
| 6 | Adapters | The handler presents it: `res.json(result.value)` → `{"id":"42","body":"new text","version":3}`; a refusal gets its status from `HttpErrorMapper` (`ReviseDocumentHandler.ts:33,37`) | Adapter → use-case output type ✓ |

Until 2026-10-26, step 5 returned the `Document` entity itself. That was a mistake under item 8, and it is now guarded by a test (`ReviseDocument.test.ts:25`).

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Entity imports a framework type | The rule is broken; the entity can no longer be tested alone | Dependencies must point inward ✅[^1] |
| Use case needs storage | It declares a gateway interface; an outer adapter implements it | Dependency inversion at the boundary ✅[^1] |
| Two adapters in the same ring call each other | The dependency rule alone does not forbid it | It only speaks about inward direction. Hexagonal architecture adds the "through the application" rule |
| A project needs five rings | Fine | The rings are schematic ✅[^1] |
| Use case calls the presenter or handler by name | The rule is broken | "This call must not be direct" ✅[^1]. Use an output port, or return the result |
| Use case returns the entity | Callers couple to the entity's shape; a new field can reach clients unplanned | "We don't want to cheat and pass Entities" ✅[^1]. Return a plain output model |
| Gateway port passes entities to and from the storage adapter | Accepted | Microsoft's guide: core interfaces work with entities, and only "sometimes" with DTOs ✅[^5] |
| A controller test needs a fake use case | A class with private fields cannot be faked by a plain object in TypeScript | A private member must come "from the same class" ✅[^6]. Extract an explicit input-port interface (item 6) |
| One result must reach several presenters, or arrive over time | Form B cannot do it without changing its signature | Switch to an output port (item 7) |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Full rings with input/output ports | Maximum isolation and testability | Many small types for simple CRUD |
| Collapsed rings for a small component | Less ceremony | The collapse must be recorded so reviewers do not see it as drift |
| Request/response (return, no output port) | No presenter object per request; simple control flow | One result, once, to one caller; differs from Martin's figure, so record it |
| Input port as the class's public method (no interface) | One less type | The controller cannot get a hand-written fake |

## Takeaways
- Check every import against the inward direction; inner code never names outer code. [rule-candidate]
- Put presenters and controllers in the adapter ring and keep them free of business decisions. [rule-candidate]
- A use case hands back a plain output model, never the entity, whether it returns it or calls an output port.
- Choosing return over an output port is legitimate; record the choice and when to switch.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 18 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-27

## References
- [The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) — Robert C. Martin, 2012. Backs: How it works 1–8, Edge cases. [^1]
- [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/) — Alistair Cockburn, 2005. Backs: How it works 7 (`discount()` returns a value). [^2]
- [OpenChat `GetSubscribedDocuments.java`, branch `openchat-unclebob`](https://github.com/sandromancuso/cleancoders_openchat/blob/openchat-unclebob/src/main/java/org/openchat/usecases/GetSubscribedDocuments.java) — Cleancoders OpenChat repository. Backs: How it works 7–8 (use case returns `List<Document>` entities, no presenter). [^3]
- [OpenChat `GetSubscribedDocumentsAPI.java`, branch `openchat-unclebob`](https://github.com/sandromancuso/cleancoders_openchat/blob/openchat-unclebob/src/main/java/org/openchat/api/GetSubscribedDocumentsAPI.java) — the API class that builds JSON from the entities. Backs: How it works 8. [^4]
- [Common web application architectures](https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/common-web-application-architectures) — Microsoft, living. Backs: Edge cases (gateway ports and entities). [^5]
- [Type Compatibility](https://www.typescriptlang.org/docs/handbook/type-compatibility.html) — TypeScript Handbook, living. Backs: Edge cases (private members and structural typing). [^6]
- [GUI Architectures](https://martinfowler.com/eaaDev/uiArchs.html) — Martin Fowler, 2006. Backs: the Model-View-Presenter meaning of "presenter".
- `copilot/frameworks/agentic-sdlc/foundations/design/clean-architecture.md` — the CA rules this doc explains.
- `copilot/frameworks/agentic-sdlc/foundations/code/naming.md` — the `Presenter` role suffix.
- [`src/` of the stack reference at v1.2.0](https://github.com/conanjs/agentic-sdlc-reference-typescript-node/tree/a8e776660fe686a716fc1f80550f2671c972cc7b/src) — `ReviseDocument.ts`, `ReviseDocumentHandler.ts`, `ports/DocumentStore.ts`, `CompositionRoot.ts`: the second worked example. Pointer: `copilot/frameworks/agentic-sdlc/stacks/typescript-node/reference.md`. The same code in the default feature-first layout (MOD-9): [@ v2.0.0](https://github.com/conanjs/agentic-sdlc-reference-typescript-node/tree/171c3ba548fd5b00913f8c6a62acdd591f278c91) (`src/documents/`, `src/shared/`).
- `copilot/knowledge/software-design/architecture-styles/clean-architecture-deep-dive.md` — the deep dive this doc was distilled from (§6.3, §6.6, §6.7, §7).

## Related
- `software-design/architecture-styles/clean-architecture-deep-dive.md` — the full treatment.
- `software-design/architecture-styles/hexagonal-architecture.md`
- `software-design/architecture-styles/combining-styles.md`
- `software-design/design-principles/dependency-inversion.md`
