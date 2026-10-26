---
schema: foundation/v2
last-updated: 2026-10-25
rule-prefix: NAM
subject: code
---

# Naming

How engineering names types, functions, files, tests and terms so the code reads in the domain's own words. Analogy: street signs: one name per street, and the name tells you what is there. The stack profile supplies casing and file-name form. Reviews cite `NAM-n`.

## Rules

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| NAM-1 | Names reveal intent in domain terms; length grows with scope. | A reader can say what a thing is or does from its name alone | `data`, `info`, `process()`, `handleStuff()` | llm | — |
| NAM-2 | Use the project's ubiquitous language (`../design/domain-driven-design.md`, DDD-1). Consult `docs/glossary.md` before naming; add every new domain term to it in the same change. | Each domain term in code appears in the glossary with the same meaning | An engineer names a type `Privilege` while the spec and glossary say `Permission` | llm | — |
| NAM-3 | One term per concept. Pick one verb per kind of operation and one noun per idea, and do not mix synonyms (`create`/`compose`/`build`/`make`). | Grep for a concept finds one word, and the glossary records the chosen verb | `createRole()` next to `composeUser()` and `buildSession()` for the same idea | llm | — |
| NAM-4 | Types and modules are nouns; functions and methods are verbs. Queries (`get`, `find`, `list`) and commands (`grant`, `revoke`, `save`) are named apart, and a query has no side effect. | The verb tells whether the call only reads or also changes something | `getUser()` that also writes a login timestamp | llm | — |
| NAM-5 | Booleans read as true/false predicates (`isActive`, `hasAccess`, `canGrant`). Do not use negated names (`isNotReady`). | An `if` on the name reads as plain English | `status`, `flag`, `isNotActive` | llm | — |
| NAM-6 | A role suffix is used only when it states a real role, and only from the role glossary below. Meaningless suffixes are banned: `Manager`, `Helper`, `Util`, `Data`, `Info`, `Base`, `Impl`. | Every suffix on a type matches the glossary meaning | `RoleManager` that stores, validates and presents roles | llm | — |
| NAM-7 | Ports are named by capability, with no `I` prefix and no `Impl` suffix unless the stack idiom says so. Adapters name the technology or system plus the capability. | The port reads as the capability and the adapter reads as one way to provide it | `IRoleRepo` with `RoleRepoImpl` | llm | — |
| NAM-8 | File name equals the primary exported type, in the stack's file-name form. One primary type per file. No grab-bag files (`utils`, `helpers`, `common`, `misc`). | The file name predicts its main export | `helpers.ts` with 12 unrelated functions | llm | — |
| NAM-9 | Abbreviations are banned unless listed in `docs/glossary.md`. Universally known short forms (`id`, `url`, `http`) are allowed. | Every abbreviation is spelled out or glossary-listed | `usrPrmCnt`, `cfgMgr`, an acronym only the team knows | llm | — |
| NAM-10 | Units and currency are in the name or the type (`timeoutMs`, `sizeBytes`, `Money`). | No bare numeric quantity has an unstated unit (CS-14) | `timeout = 30`, `price` with no currency | llm | — |
| NAM-11 | Error types name the failed condition (`PermissionAlreadyGranted`); domain events are past tense (`RoleCreated`); commands are imperative (`GrantPermission`). | Each name says whether it is a failure, a fact, or a request | `RoleError`, `RoleEvent`, `DoRole` | llm | — |
| NAM-12 | Test titles state behaviour per `../delivery/testing-strategy.md` (TST-3) and start with the spec id they verify: `<ac-id> <behaviour sentence>`. | Each title starts with an id found in `spec.md` and reads as one behaviour | `it("works")`, or a title with no AC id | llm | — |

## Interpreting

**Role suffix glossary**

| Suffix | Means | Example |
|---|---|---|
| `Service` | An application service that sequences steps of one capability; for a single operation prefer a verb phrase | `PermissionService`, or one use case `GrantPermissionToRole` |
| `Repository` | Port and adapter that loads and saves an aggregate as if it were a collection | `RoleRepository`, `PgRoleRepository` |
| `Store` | Port and adapter for simple keyed storage that is not an aggregate | `SessionStore` |
| `Guard` | Checks a precondition and blocks the call when it fails; never transforms data | `PermissionGuard` |
| `Presenter` | Maps an internal entity to the public response shape (see below) | `RolePresenter` |
| `Factory` | Builds an object whose construction needs rules or collaborators | `SessionFactory` |
| `Policy` | Holds one business rule that varies; swappable | `PasswordPolicy` |
| `Adapter` | Translates between the app and an external system; suffix used for external systems only | `HrDirectoryAdapter` |
| `Handler` | Handles one inbound message, command, event or route | `GrantPermissionHandler` |
| `Middleware` | One step in a request pipeline that handles a cross-cutting concern | `RequestIdMiddleware` |
| `Mapper` | Translates internal results or errors into one outer protocol's terms (status codes, wire codes); no I/O, no business rules | `HttpErrorMapper` |
| port (no suffix) | The capability the app needs, named for what it does | `Clock`, `PasswordHasher` |

Choose `Repository` or `Store` once per project and record it in `docs/glossary.md`.

**Presenter in plain English.** A presenter is the mailroom clerk who copies only the public fields from an internal file onto an outgoing form. It maps an internal entity to the public response shape so secrets cannot leak by accident. Concrete example: the `User` entity holds `id`, `email` and `passwordHash`. `UserPresenter.toResponse(user)` returns `{ id, email }`. Because the response is built field by field, a later `passwordHash` field can never reach the client unless someone adds it to the presenter on purpose.

**One verb per kind of operation.** Record the project's choice, for example "build" for assembling an object graph from config and "create" for new domain objects. Then `composeApp()` and `createApp()` cannot both exist (NAM-3).

**Glossary file.** The location is `docs/glossary.md` in every project repo. Engineering reads it before writing code and extends it in the same change (NAM-2).

| Term | Meaning | Not to be called | Code form |
|---|---|---|---|
| Permission | One action a role may perform, for example `shipment:approve` | privilege, right, ability | `Permission`, `PermissionKey` |

**Test titles with spec ids.** `US1-AC2 rejects a duplicate grant` ties the test to acceptance criterion `US1-AC2` (`../quality/functional-suitability.md`, Q-FUNC-2). Use the exact id format of the project's `spec.md`.

**Legacy names.** Do not rename existing code just to comply. A rename is its own task (`refactoring.md`); new and touched code follows these rules.

## Tensions

| Rule A | Rule B | Default resolution |
|---|---|---|
| NAM-9 no abbreviations | NAM-2 domain language | A domain abbreviation the business itself uses is allowed once it is in the glossary. |
| NAM-1 long intent-revealing names | Readability of long call chains | Keep the long name and extract a variable or function; never shorten into an unclear name. |
| NAM-7 no `I` prefix | A stack where `I` is the idiom | The stack idiom wins on form (`coding-standards.md` tie-break); apply the stack's convention uniformly. |

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/schemas/foundation.schema.md`: schema and required structure for this foundation.
- `copilot/frameworks/agentic-sdlc/schemas/_system.md`: shared rule-table, id, path and references rules.
- `foundations/code/naming.md`: this foundation file.
- `docs/glossary.md` (project repo): the per-project glossary NAM-2 and NAM-9 depend on.

**External authoritative sources:**
- Eric Evans, *Domain-Driven Design* (2003) — ubiquitous language.
- [Martin Fowler, "UbiquitousLanguage"](https://martinfowler.com/bliki/UbiquitousLanguage.html) — one rigorous shared language between developers and domain experts.
- Robert C. Martin, *Clean Code* (2008), ch. 2 "Meaningful Names" — intention-revealing names, one word per concept, avoid noise words.
- [Google TypeScript Style Guide, "Naming"](https://google.github.io/styleguide/tsguide.html) — descriptive names, no ambiguous abbreviations, do not mark interfaces specially unless idiomatic.
- [Martin Fowler, "Repository" (PoEAA)](https://martinfowler.com/eaaCatalog/repository.html) — collection-like access to aggregates.
- [Alistair Cockburn, "Hexagonal architecture"](https://alistair.cockburn.us/hexagonal-architecture/) — ports and adapters.
- [Martin Fowler, "Data Transfer Object" (PoEAA)](https://martinfowler.com/eaaCatalog/dataTransferObject.html) — the public shape a presenter produces.

## Related

- `coding-standards.md` — CS-1 and CS-14 point here.
- `comments.md` — comments add what names cannot.
- `../design/domain-driven-design.md` — DDD-1 ubiquitous language.
- `../delivery/testing-strategy.md` — TST-3 test naming.
- `../../paradigms/class-modeled.md` — which role-suffixed types must be classes.
