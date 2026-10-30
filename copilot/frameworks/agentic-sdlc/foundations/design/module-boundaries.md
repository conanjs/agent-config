---
schema: foundation/v2
last-updated: 2026-10-29
rule-prefix: MOD
subject: design
---

# Module Boundaries

How the architecture role defines modules and layers inside one repo, checks dependency direction, and decides when to split or merge. Reviews cite `MOD-n`.

## Rules

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| MOD-1 | Modules by domain, layers inside. Top-level structure follows business capability (package by feature), not technical role (`controllers/`, `services/` at the root). | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| MOD-2 | Dependency direction is declared and acyclic. Every module-to-module dependency appears in the documented DAG; anything else is a violation. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| MOD-3 | Depend only on public surfaces. A module's public surface is its use cases and their input and output types, plus any domain events it publishes. It is listed in `docs/architecture.md` §4, or declared by the language's visibility. Other modules import those files directly, never internals, and never through a re-export file (IMP-5). | Every cross-module import targets a file on the listed surface | `comments` imports `@/modules/documents/domain/Document.js`, or `@/modules/documents/index.js` | llm | — |
| MOD-4 | Shared code is earned. A `shared`/`common` module holds only stable, domain-neutral utilities; business rules never go there. The folder itself exists from the start (MOD-9); what is earned is each file in it. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| MOD-5 | Cross-module communication is explicit: a direct call to a public use case, or a domain event. No reaching into another module's persistence. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| MOD-6 | One owner per table/collection. Only the owning module reads/writes its storage directly. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| MOD-7 | The composition root wires modules; modules don't instantiate each other's adapters (`idiom.di`). | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| MOD-8 | Simplifications are recorded. Collapsing a layer or skipping a module boundary is stated in `docs/architecture.md` with the reason. | The affected artifact demonstrably satisfies the rule. | The artifact violates this rule in the affected surface. | llm | — |
| MOD-9 | **Feature-first is the default packaging** for every new repo: the first grouping under `src/` is the module, and each module has the same layers inside. Modules live in `src/modules/`: one folder per feature area, plus `src/modules/shared/` with the same four layer folders, created from the start even while empty (MOD-4 governs what may go in). Even a repo with one feature starts as `src/modules/<feature>/{domain,application,infrastructure,interface}/` next to `src/modules/shared/{domain,application,infrastructure,interface}/`, because most applications grow and moving later costs more than one folder level now. The rest of `src/` holds only what is not a module: the composition root, the entry point, and later folders such as jobs, CLI entry points, migrations or generated code. **Layer-first** (`domain/`, `application/`, `infrastructure/`, `interface/` at the top of `src/`) is allowed only when the owner opts in explicitly, the repo serves one bounded context, and it has at most three feature areas. The opt-in is a decision record in `docs/architecture.md`. When an opted-in repo reaches its fourth feature area or second bounded context, it switches to feature-first as a recorded pure move with no behaviour change. | `docs/architecture.md` names the layout; every module is under `src/modules/`; a layer-first repo has an opt-in record and at most three feature areas; the tree matches the record | A new repo starts layer-first with no opt-in record; feature folders directly under `src/` next to `jobs/` and `cli/`; an opted-in layer-first repo with five feature areas spread over four layer folders | llm | — |
| MOD-10 | **One folder per use case inside each layer** of a module (default). A use case gets a kebab-case folder named after it in every layer it has code in (`application/revise-document/`, `interface/routes/revise-document/`), holding its files and their tests. `domain/` is split by aggregate instead, because every use case shares the entities: one kebab-case folder per aggregate, named after its root entity (`domain/document/Document.ts`), with value objects used only by that aggregate inside it. Depth shows scope: a file in a use-case folder serves that use case only; a file at a layer root (`application/DocumentView.ts`, `application/ports/`, `interface/errors/`, a value object at the `domain/` root) is shared by several use cases or aggregates of the module; `modules/shared/` is shared by several modules. Put each file in the deepest folder that contains all of its users. Inside a layer, code imports only from its own folder or a folder above it, never from a sibling use-case or aggregate folder; the one exception inside a module is its router at the `interface/routes/` root, a wiring file that imports the handler folders below it (EXP-2). A file moves up when a user appears outside its folder. Between layers, the layer rule decides. Full vertical slices across layers, or `commands/`/`queries/` folders, are allowed only with a decision record (see Interpreting) | Every use case has its own folder in each layer it touches, and every aggregate its own folder in `domain/`; nothing in a use-case folder is imported by another use case; files at a layer root have two or more users | `CreateDocumentBody.ts` beside every other handler in `interface/routes/`; `application/revise-document/` importing from `application/create-document/`; a view used by one use case left at the layer root | llm | `knowledge/software-design/architecture-styles/use-case-folders.md` |
| MOD-11 | **Wire modules with one composition root and one composer per module** (wiring shape W2, default). The composition root is the only place that chooses adapters and passes one module's public objects to another; each module's composer (`<Module>Module` at the module root, outside the layers) receives its adapters and builds that module's use cases and router. One root that builds every use case (W1) is fine while there is one module; a composition root per module (W3: its own container, config and store) needs a decision record. | Only the composition root imports adapters and composers; no composer imports an adapter; no layer imports a composer; lint enforces all three. | A composer that creates its own store; a use case that imports its module's composer; a root that builds every use case of five modules. | lint | knowledge/software-design/oop/dependency-injection.md |

## Interpreting

**Procedure — defining modules**

1. **Start from the domain.** List the bounded contexts / sub-domains the repo serves (`../design/domain-driven-design.md`). Each becomes a candidate top-level module (vertical slice).
2. **Layer inside each module** per `../design/clean-architecture.md` (domain, application, adapters) using the stack profile's `project_layout`.
3. **Declare the public surface** of each module: the use cases, types, and events other modules may use. Everything else is internal.
4. **Draw the allowed-dependency graph** between modules (a DAG) and record it in `docs/architecture.md`.
5. **Encode the graph as checks** (`../review/fitness-functions.md`, FF-1 to FF-3) so violations fail the build, not just the review.
6. **Update at P7** — any new module, dependency edge, or simplification is reflected in `docs/architecture.md`.

**Rules**

**Dependency direction checks**

| Check | Fails when |
|---|---|
| Layer direction | An inner layer imports an outer one (domain → adapters) |
| Module DAG | An import edge isn't in the declared graph |
| Internals access | An import targets a non-public path of another module |
| Cycles | Any cycle among modules or layers |
| Framework leakage | A framework/driver import appears in domain or application |

Express these as automated rules (stack profile's `cmd.lint` configuration or a dedicated architecture test run by `cmd.test_unit`).

**When to split a module**

Split when **two or more** hold:
- Parts change for different reasons or on different cadences (`../design/design-principles.md`, DP-1).
- The module exceeds the size threshold in the constitution (default: ~30 files or ~3,000 lines of non-test code).
- Different parts use different vocabularies for the same word (a hidden second bounded context).
- Tests for one part routinely break from changes in another.

**When to merge**

Merge when two modules always change together, call each other in both directions, or one has no logic of its own.

**When a module should become a service**

Only when an independent deployment, scaling, ownership, or failure-isolation need exists **and** the module already has a clean public surface and owned data. Module first, service later — escalate to system-architecture.

**Packaging: feature-first by default, layer-first by opt-in (MOD-9)**

A *feature area* is a group of use cases around one aggregate or business capability, with its own vocabulary: for example `documents` (create, get, list, revise, delete, history) or `comments`. A use case is not a feature area; ten use cases on documents are still one.

| Repo | Layout | Top of `src/` | When |
|---|---|---|---|
| Any new repo | **Feature-first (default)** | `modules/` (holding `documents/ comments/ … shared/`) + composition root + entry point; each module has the four layers | Always, unless the owner opts in to layer-first. A one-feature repo is `src/modules/documents/{domain,application,infrastructure,interface}/`, `src/modules/shared/{domain,application,infrastructure,interface}/` and the composition root. `shared/` exists from day one, even empty (a `.gitkeep` holds an empty folder in git, which tracks only files), so nobody has to decide later where cross-cutting code goes; MOD-4 decides what may enter it. Delete a folder's `.gitkeep` in the commit that adds its first real file |
| One bounded context, 1–3 feature areas, owner opted in | Layer-first (opt-in) | `domain/ application/ infrastructure/ interface/` + composition root | The owner chose it and recorded why, for example a short-lived tool or a teaching example. The repo is one module, so MOD-1 holds at repo level |
| Opted-in repo reaching its 4th feature area or 2nd bounded context | Switch to feature-first | As the default row | Recorded pure move |

**Why feature-first by default.** Most applications grow, and the code should be grouped by what the system does before it is grouped by framework layer (Martin, Fowler, Brown; see References). Feature-first is about that first grouping, not about how deep it sits: `src/modules/documents/` is as feature-first as `src/documents/`; the extra folder only adds one segment to each import. Starting feature-first costs one folder level in a one-feature repo. Switching later costs a move of every file, a change to every import, and new lint zones, done while features are being added. Layer-first is still a valid, simpler shape for a repo that will stay small, so it remains as a deliberate choice, not an accident of starting small.

**Why a `modules/` folder.** `src/` soon holds things that are not modules: the composition root, the entry point, background jobs, CLI entry points, migrations, generated code. With modules directly under `src/`, a tool or a reader can tell a module apart only by "every folder except these"; under `src/modules/` it is simply every folder there. `shared` is a module too (it has the four layers and a public surface), so it sits with the others.

**Why the name `modules`, not `features`.**

| Name | Gains | Costs |
|---|---|---|
| `modules/` (chosen) | Matches the framework's own words (MOD-n rules, the `modules:` list in `docs/architecture.md` §4, "module boundaries"); fits `shared`, which is a module but not a feature; fits a bounded context that holds several features | In JavaScript and TypeScript, "module" also means one file (an ES module); the glossary defines the folder sense |
| `features/` | Says "user-facing capability" plainly; common in front-end projects | `shared` is not a feature, so it must stay outside; one bounded context with several features does not fit one folder; differs from the framework's vocabulary |

Analogy: a small shop could keep all tools on four shelves sorted by kind. A shop that expects to grow gives the first workbench its own shelves from day one, so adding a second bench never means re-sorting every shelf.

**Inside a module: one folder per use case (MOD-10)**

| Option | Shape | Use when |
|---|---|---|
| **B. Per use case inside each layer (default)** | `application/revise-document/ReviseDocument.ts` + test; `interface/routes/revise-document/{ReviseDocumentHandler, ReviseDocumentBody}.ts`; `domain/document/Document.ts` + test (per aggregate, in every option) | Always, unless a record below says otherwise. Layer folders stay, so the layer checks keep working by path |
| C. Full vertical slice | `slices/revise-document/{ReviseDocument, ReviseDocumentHandler, ReviseDocumentBody}.ts`; `domain/<aggregate>/` and ports outside the slices | A module with thin domain logic (mostly CRUD), with lint rules that block slice-to-slice imports and keep shared code from importing slices (`vertical-slice-architecture.md`). Record it as a simplification (MOD-8) |
| D. `commands/` and `queries/` | `application/commands/ReviseDocument.ts`, `application/queries/GetDocument.ts` | Reads are served by their own model or store (CQRS); can wrap option B folders. Record it |
| A. Flat | Every file directly in its layer folder | Not for new code; a module with only one or two use cases may stay flat until the third |

Option C and D are explained with full trees, costs and sources in `knowledge/software-design/architecture-styles/use-case-folders.md`. The same doc states the placement rule behind every level, and the five places where a second rule decides (sibling layers, imports across layers, `modules/shared/`, kind folders such as `ports/`, and the composition root with test helpers).

**Opting in to layer-first:** the decision record states the owner, the reason, the expected maximum of feature areas, and the trigger for switching. Concrete, where `D-007` is the repo's seventh decision record: "D-007 Layer-first: owner V, 2026-10-27; internal tool with one feature area (documents); switch to feature-first at the 4th area".

**Switching:** write the decision record, then move files without changing behaviour (all tests pass unchanged), then add the module-boundary checks (MOD-3, FF-1). The stack reference shows both layouts: `stacks/<stack>/reference.md` (feature-first on `main`, layer-first on a maintained branch).

**Wiring modules: W2 by default (MOD-11)**

Every option keeps one rule from Mark Seemann's composition root: the adapters are chosen in one place. They differ in who writes the `new` calls for a module's use cases.

| Option | Shape | Use when | Evidence |
|---|---|---|---|
| **W2. Root + module composers** (default) | `src/CompositionRoot.ts` chooses the adapters and creates shared instances; `src/modules/<module>/<Module>Module.ts` receives its adapters and the other modules' public objects, and builds its use cases and router | Two or more modules | Stack reference `v4.2.0`: `DocumentsModule.ts`, `CommentsModule.ts`; ASP.NET Core's `Add{Group}` extension methods; NestJS modules |
| W1. One root builds everything | The root builds every use case and hands each module's use cases to its router | One module; switch to W2 when the second module arrives | Stack reference `v4.1.0` (`src/CompositionRoot.ts`) |
| W3. A composition root per module | Each module chooses its own adapters, with its own container and config | Modules own separate infrastructure (own store, config or deployment path) or are about to be extracted to services; record it (MOD-8) | Kamil Grzybek, *Modular Monolith with DDD* §3.1 |

**Checks for W2:** two lint zones next to the layer zones: a composer may not import any `infrastructure/` folder, and no `domain/`, `application/`, `infrastructure/` or `interface/` file may import a composer. The module zones (MOD-3) already stop one composer from importing another module's composer.

**Switching W1 → W2** is a pure move: the use-case wiring of each module leaves the root for the module's composer, and every test passes unchanged. The stack reference did it from `v4.1.0` to `v4.2.0` with the same 27 unit and 21 integration tests.

**Application note:** stack profiles define concrete commands and idioms; this foundation defines stack-agnostic intent.

## Tensions

| Rule A | Rule B | Default resolution |
|---|---|---|
| Simplicity | Explicit boundaries | Add boundaries only where change rate, ownership or risk justifies them. |
| MOD-1 modules by domain | An opted-in layer-first repo | MOD-9: an opted-in layer-first repo is one module, so layer folders at the top satisfy MOD-1. Technical-role folders that cut across features (`controllers/`, `services/`) still do not. |
| MOD-9 feature-first by default | YAGNI for a one-feature repo | The default costs two folder levels (`modules/<feature>/`); a later switch costs a repo-wide move. A repo that will truly stay small opts in to layer-first with a record. |
| MOD-11 W2 composers | YAGNI for one module | W1 is fine while there is one module; the switch is a pure move, so wait for the second module. |
| MOD-10 one folder per use case | Languages where a folder is a package or module with its own namespace (Go, Rust) | The stack profile states the mapping; where a folder per use case would split one package into many, one file per use case named after it (`revise_document.go`) satisfies the intent. |

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/schemas/foundation.schema.md`: schema and required structure for this foundation.
- `copilot/frameworks/agentic-sdlc/schemas/_system.md`: shared rule-table, id, path and references rules.
- `foundations/design/module-boundaries.md`: this foundation file.

**External authoritative sources:**
- David Parnas, "On the Criteria To Be Used in Decomposing Systems into Modules" (CACM, 1972).
- [Mark Seemann, "Composition Root"](https://blog.ploeh.dk/2011/07/28/CompositionRoot/) (2011) — one place where modules are composed (MOD-11).
- [Dependency injection in ASP.NET Core: register groups of services with extension methods](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/dependency-injection#register-groups-of-services-with-extension-methods) — Microsoft, living (MOD-11, W2).
- [NestJS: Modules](https://docs.nestjs.com/modules) — NestJS, living: providers private by default, shared through `exports` (MOD-11, W2).
- [Kamil Grzybek, Modular Monolith with DDD](https://github.com/kgrzybek/modular-monolith-with-ddd) — §3.1, a composition root per module (MOD-11, W3).
- Robert C. Martin, *Clean Architecture* (2017) — component principles (ADP, SDP, SAP).
- Simon Brown, "Modular Monoliths" and the C4 model (c4model.com).
- [Robert C. Martin, "Screaming Architecture"](https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html) (2011) — the top level should show the use cases, not the framework (MOD-9).
- [Git FAQ (archived wiki), "Can I add empty directories?"](https://archive.kernel.org/oldwiki/git.wiki.kernel.org/index.php/GitFaq.html) — the index lists only files, so an empty folder needs a placeholder file (MOD-9's `.gitkeep`).
- [Martin Fowler, "PresentationDomainDataLayering"](https://martinfowler.com/bliki/PresentationDomainDataLayering.html) (2015) — for a larger system, split the top level into domain-oriented modules, each layered inside (MOD-9).

## Related

- `../design/clean-architecture.md` — the layer rules.
- `../quality/maintainability.md` — Q-MAINT-1, Q-MAINT-2.
- `../review/fitness-functions.md` — automated boundary checks.
- `../design/contract-design.md` — when boundaries become service contracts.
- `../design/import-paths.md` — how module references are written and checked (IMP-n).
- `knowledge/software-design/architecture-styles/clean-architecture-deep-dive.md` §8, §15 G2 — the packaging options MOD-9 chooses between.
- `copilot/patterns/maintained-variant.pattern.md` — how the stack reference keeps both layouts current.
