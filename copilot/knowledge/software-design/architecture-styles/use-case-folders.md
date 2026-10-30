---
schema: knowledge-doc/v1
type: concept
topic: software-design/architecture-styles
status: verified
applies-to: ["any layered or clean-architecture codebase", "TypeScript stack reference v3.1.0 (flat) and v4.0.0 (option B)"]
last-verified: 2026-10-29
last-updated: 2026-10-29
tags: [folder-structure, use-case, vertical-slice, cqrs, colocation, module-layout]
---

# Folders inside a module: per use case, vertical slice, or by kind

## Summary
**TL;DR:** Once a module has more than a handful of use cases, the flat `application/` and `interface/routes/` folders become long lists in which files that change together (a handler and its body schema, a use case and its test) are not grouped. Four shapes are possible. The framework default is **B: one folder per use case inside each layer**: it groups what changes together and keeps the layer folders the lint rules depend on. **C: full vertical slices** groups even more tightly but removes the layer folders. **D: commands and queries folders** groups by kind of code and pays off only when reads and writes really use separate models (CQRS). In every option `domain/` gets one folder per aggregate, because all use cases share the entities. Folder depth then shows scope: a use-case folder holds files used by one use case; the layer root holds files shared by several use cases of the module; `modules/shared/` holds files shared by several modules.
**Use this when:** a layer folder in a module grows past what fits on one screen, someone proposes vertical slices or CQRS folders, or deciding where a type used by several use cases goes.
**Not this doc:** the first grouping under `src/` (feature-first versus layer-first, MOD-9; see `screaming-architecture-deep-dive.md`).

## Problem
The stack reference's `documents` module at v3.1.0 has 12 files in `application/` and 9 in `interface/routes/`. `CreateDocumentBody.ts` is used only by `CreateDocumentHandler.ts`, but sits among the other handlers. `DocumentView.ts`, which every use case returns, looks the same as the use cases beside it. A reader, or an agent given a task, cannot see from the tree which files belong together or which ones are shared.

## Mental model
**Analogy:** a kitchen. Flat folders are one drawer holding every utensil. Option B gives each dish its own tray on each counter (prep counter, stove), and leaves the shared knives on the counter itself. Option C gives each dish one trolley with everything for it, from raw food to plate, so nobody can tell from the room which counter does what. Option D sorts trays into "cooking" and "serving" racks, which helps only if the kitchen really runs two separate lines.

**Artifact:** the same module in option B (stack reference v4.0.0).
```text
src/modules/documents/
  domain/
    document/Document.ts, Document.test.ts, DocumentError.ts   ← one folder per aggregate, not per use case (see How it works 4)
  application/
    DocumentView.ts, LookupError.ts ← layer root: shared by several use cases of this module
    ports/DocumentStore.ts, DocumentIds.ts
    create-document/CreateDocument.ts, CreateDocument.test.ts
    revise-document/ReviseDocument.ts, ReviseDocument.test.ts
    list-documents/ListDocuments.ts, ListDocuments.test.ts
    get-document/GetDocument.ts, GetDocument.test.ts
    …
  infrastructure/InMemoryDocumentStore.ts, UuidDocumentIds.ts
  interface/
    errors/HttpErrorMapper.ts       ← shared by every handler of this module
    routes/
      create-document/CreateDocumentHandler.ts, CreateDocumentBody.ts
      revise-document/ReviseDocumentHandler.ts, ReviseDocumentBody.ts
      list-documents/ListDocumentsHandler.ts, ListDocumentsQuery.ts
      …
```

## How it works
1. **What the guidance says.** Angular's style guide asks to group closely related files in one directory, keep unit tests in the same directory as the code they test, avoid subdirectories named after the type of code, and split further as the number of files in a directory grows. ✅[^1] Bogard's vertical slice architecture puts each request's code together from front end to back, with the aim to minimize coupling between slices and maximize coupling within a slice. ✅[^2] Fowler describes CQRS as separate models for update and for display, and warns that for most systems it adds risky complexity. ✅[^3]
2. **Option A, flat (v3.1.0).** One folder per layer, every file of the module directly in it. Nothing to decide, but the folders grow with every use case.
3. **Option B, one folder per use case inside each layer (default).** A use case gets a kebab-case folder in each layer it has code in, named after the use case: `application/revise-document/`, `interface/routes/revise-document/`. Its test sits beside it. The layer folders stay, so the layer lint zones (`./src/modules/*/application/**` and so on) keep working unchanged. A file at a layer root is, by position, shared by several use cases of the module.
4. **The domain layer gets one folder per aggregate, not per use case (in B, C and D).** `application/` and `interface/` contain one piece of code per use case, so they are split that way. `domain/` contains the entities and their rules, and every use case uses them: `Document.revise` serves `ReviseDocument`, and the same `Document` is returned by `CreateDocument` and `GetDocument`. A `domain/revise-document/` folder would cut one entity into pieces. So `domain/` is split by **aggregate**: a cluster of domain objects treated as one unit, with one of them, the *root*, as the only object that outside code may refer to. Whole aggregates are loaded and saved, and a transaction does not cross an aggregate's boundary. ✅[^5] The folder is named after the root entity in kebab case:
   ```text
   domain/
     Money.ts, Money.test.ts                   ← value object used by several aggregates: domain root
     document/
       Document.ts, Document.test.ts           ← the root entity
       Revision.ts, Revision.test.ts           ← used only inside this aggregate
     reviewer/
       Reviewer.ts, Reviewer.test.ts
   ```
   The same scope rule as the other layers applies. A file in an aggregate folder belongs to that aggregate. A file at the `domain/` root is shared by several aggregates of the module, and `modules/shared/domain/` (`Result.ts`) is shared by several modules. Like a one-file use case, an aggregate with one file still gets a folder, so every path can be predicted. *(Folder mapping ours, from the aggregate definition.)*
5. **Option C, full vertical slice.** A slice folder per use case holds every layer's code for that request:
   ```text
   src/modules/documents/
     domain/document/Document.ts              ← still shared: every slice uses the entity (same aggregate folders as B)
     ports/DocumentStore.ts                   ← still shared
     slices/revise-document/
       ReviseDocument.ts                      (use case)
       ReviseDocumentHandler.ts               (HTTP)
       ReviseDocumentBody.ts                  (HTTP schema)
       ReviseDocument.test.ts
   ```
   It is the tightest grouping: a request is one folder, and deleting a feature deletes one folder. The costs: the layer is no longer a folder, so the dependency rule can no longer be checked by path. Each file's layer must come from its name (`*Handler.ts` is interface) or from a boundaries plugin that classifies files by pattern, which is easier to bypass by naming. The entity, the ports and shared views still need homes outside the slices, so the tree mixes two ideas. It suits CRUD-heavy modules with thin domain logic.

   **Vertical slices replace the layer rule with a slice rule.** Bogard's main rule is about slices, not layers. ✅[^2]
   - Keep coupling between slices low and coupling inside a slice high.
   - Each slice decides how it handles its request: a simple transaction script, a domain model, or raw SQL.
   - Share as little logic between slices as possible. A new feature then only adds code; it does not change shared code.
   - When a slice's code becomes complex, refactor to a pattern that fixes the code smell you see. This assumes a team that recognizes code smells and knows how to refactor.

   So option C works only with written rules that a tool checks. The set we would require *(our proposal; not yet in the framework)*:

   | # | Rule | Checked by |
   |---|---|---|
   | C1 | A slice never imports another slice | Boundaries plugin: each `slices/*` folder is its own element, so any import into another slice is blocked by `default: "disallow"` (tested, see below) |
   | C2 | A slice imports only its own files and the shared module code (`domain/`, `ports/`, shared views) | Boundaries plugin element types |
   | C3 | Shared module code never imports a slice | Boundaries plugin, or path zones (`domain/` and `ports/` are still folders) |
   | C4 | Code used by a second slice moves to the shared folders, with a review; it is not copied | Code review |
   | C5 | A slice that grows a domain rule moves that rule into `domain/`; the slice stays an orchestrator | Code review, Bogard's refactoring step ✅[^2] |

   `eslint-plugin-boundaries` can express C1 to C3. It assigns each file an element type by a path pattern (`boundaries/elements`) and allows or blocks imports between types (`boundaries/dependencies` policies). It can capture parts of the path, such as the slice name. Its selectors can compare a captured value with the importing file's own value: the documented example is `{{ from.element.captured.family }}`. ✅[^4] Tested 2026-10-28 with `eslint-plugin-boundaries` 7.2.0, ESLint 10.13.0 and the `typescript-eslint` 8.72.0 parser, on a throwaway tree shaped like this option (not on the stack reference itself):
   - A slice importing another slice was reported (C1).
   - A domain file importing a slice was reported (C3).
   - Imports between files of the same slice, and from a slice into `domain/` and `ports/`, were allowed (C2).
   - C1 needed no template: imports inside one element are not checked, and any other slice is a different element.
   - Adding `captured: { module: "{{ from.element.captured.module }}" }` to the slice-to-domain policy blocked a slice that imported another module's domain.

   Full treatment, with the configuration: `software-design/architecture-styles/vertical-slice-architecture.md`.
6. **Option D, split by kind: `commands/` and `queries/`.**
   ```text
   application/
     commands/CreateDocument.ts, ReviseDocument.ts, DeleteDocument.ts
     queries/GetDocument.ts, ListDocuments.ts, GetDocumentHistory.ts
   ```
   It shows the command/query separation the use cases already follow, and prepares for reads served by a separate model or store (CQRS), where queries may skip the domain entity and read a view directly. ✅[^3] Until reads and writes really diverge it is grouping by type of code, which Angular advises against. ✅[^1] Each folder grows again with every use case. A handler and its body schema stay apart, and the interface layer has no natural command/query split. It can be combined with B (`application/commands/revise-document/`) once a separate read model exists.
7. **Lint impact of B in the stack reference** (read from `eslint.config.mjs` at v3.1.0, then run): the module zones already allow another module's whole `application` folder and block `application/ports`, so use-case subfolders need no zone change. The public surface written in `docs/architecture.md` §4 changes from `application/*.ts` to `application/**` excluding `ports/`. Tested 2026-10-28: the stack reference v4.0.0 moved every file into use-case and aggregate folders with the zone configuration unchanged, and `pnpm run check` (lint included) passed with the same 23 tests.

**The placement rule behind every level.** Each nested folder is more specific than the folder around it, and code in an inner folder may use code in the folders around it. Stated precisely, as three rules:

1. A file lives in the deepest folder that contains every file that uses it: their nearest common folder.
2. Inside one layer, code imports from its own folder or from a folder above it. It never imports from a sibling folder, or from below one. `application/revise-document/` may import `application/DocumentView.ts`; it may not import `application/create-document/`.
3. When a file gets a user outside its folder, it moves up to the new nearest common folder.

| Level | Example | Holds files used by |
|---|---|---|
| All modules | `src/modules/shared/` | Several modules |
| One module | `src/modules/documents/` | One module only |
| Layer root | `application/` (`DocumentView.ts`, `LookupError.ts`), `domain/` (`Money.ts`) | Several use cases or aggregates of the module |
| Use case or aggregate | `application/revise-document/`, `domain/document/` | One use case, or one aggregate |

Five places where "outer is general, inner uses outer" needs a second rule:

| Place | What is different | Which rule decides |
|---|---|---|
| The layers themselves (`domain/`, `application/`, `interface/`) | Siblings at the same depth, yet one imports another | The layer rule: `interface` → `application` → `domain`, and `infrastructure` → `application`, `domain` |
| Across layers | `interface/routes/revise-document/` imports `application/revise-document/`, a use-case folder of another layer | The layer rule. A handler imports its own use case, or a shared file at the other layer's root |
| `modules/shared/` | A sibling of the modules it serves, not a folder around them | Rule 1 still holds: it sits in `modules/`, the modules' common folder. It imports no module (MOD-4) |
| Kind folders (`application/ports/`, `interface/errors/`, `interface/routes/`) | One level deeper, but not narrower: they sort a layer's shared files by kind | Count them as part of the layer root. `ports/` serves every use case and every adapter |
| `src/CompositionRoot.ts`, a module's router, and `test/support/` | The composition root, the outermost file, imports the innermost ones (every use case and adapter). A module's router (`interface/routes/DocumentsRouter.ts`) imports every handler folder below it. Test helpers sit outside `src/`, even when one module's tests use them | The composition root is the one place that wires the app (PDM-class-modeled-R9; Clean Architecture's Main, see `clean-architecture-deep-dive.md`). A module's router is that module's route table: it binds paths to handlers and receives its use cases already built (EXP-2), so it is a wiring file too, one per module. Tests are outside the layer graph, and lint rejects free functions in `src/` |

*(Rules and table: our synthesis of MOD-3, MOD-4, MOD-10 and the layer rule, checked against the stack reference v4.0.0 tree.)*

## Worked example
Adding `ArchiveDocument` to the `documents` module, in each option:

| Step | A flat | **B per use case** | C vertical slice | D by kind |
|---|---|---|---|---|
| New files | 3 files added to two long folders | `application/archive-document/` (use case + test), `interface/routes/archive-document/` (handler) | `slices/archive-document/` (use case, handler, test) | `application/commands/ArchiveDocument.ts`, handler in `routes/` |
| Agent task allowed-paths | `application/**`, `interface/routes/**` (the whole layer) | `application/archive-document/**`, `interface/routes/archive-document/**` | `slices/archive-document/**` | `application/commands/**`, `interface/routes/**` |
| Layer rule checked by | Path zones | Path zones (unchanged) | File-name patterns, plus the slice rules C1–C3 | Path zones |
| `domain/` changes | `domain/Document.ts` gains an `archive` method | `domain/document/Document.ts` gains an `archive` method; no new folder | Same as B | Same as B |
| Returns `DocumentView` from | `application/DocumentView.ts` | `application/DocumentView.ts` (layer root = shared) | A shared folder outside `slices/` | `application/DocumentView.ts` |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| A use case with one file (`get-document/GetDocument.ts`) | Still gets a folder | A predictable path for every use case beats saving one level; agents and readers guess paths right *(analysis, ours)* |
| A type first used by one use case, then by a second | Move it from the use-case folder to the layer root | Depth shows scope; the move is the signal that it became shared |
| A helper inside a use-case folder | Reachable by other modules under the `application/**` surface | Keep helpers private by convention, or list only the use-case files as public in §4 *(analysis, ours)* |
| `DocumentQueries.test.ts` covering several use cases | Split into one test per use case folder | Tests live beside the code they test ✅[^1] |
| Option C with a rich domain model | Slices start importing each other's helpers or duplicate rules | Coupling between slices should stay minimal ✅[^2]; the domain needs its own folder anyway |
| Option C without the slice rule (C1) checked by a tool | Slices import each other; the tree looks sliced but the code is coupled | Only a tool stops this; folder names alone do not *(analysis, ours)* |
| A domain rule used by only one use case | It still goes in `domain/`, on the entity | The rule belongs to the entity; a later use case may need it too *(analysis, ours)* |
| A value object first used by one aggregate, then by a second | Move it from the aggregate folder to the `domain/` root | Depth shows scope, as for use-case files |
| One aggregate's code imports another aggregate's inner object (`reviewer/` imports `document/Revision.ts`) | Breaks the aggregate | Outside references go only to the root ✅[^5]; import `Document`, or keep only its id |
| A module router mounted under a path prefix (`app.use("/documents/:id/comments", router)`) | At runtime the child sees the parent's `:id` only with `mergeParams: true` (default `false`) ✅[^6]. In types it never does: handlers typed `Request<{ id: string }>` fail `tsc` with `TS2345` (`Property 'id' is missing`), with or without `mergeParams` | `@types/express` infers params from the child's own path. Tested 2026-10-29 on the stack reference v4.1 branch (Express 5.3, `@types/express` 5.0.6). Use full paths and mount the router at the root |
| Option D without a separate read model | Two folders of the same kind of class | CQRS is worth it only for some systems ✅[^3] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| A flat | Simplest; shortest imports | Long folders; related files apart; shared files look like the rest |
| **B per use case (default)** | Groups what changes together ✅[^1]; tests beside code; layer lint unchanged; narrow task paths for agents; depth shows scope | One more import segment; single-file folders; a one-time move of every use-case file |
| C vertical slice | Tightest grouping; a feature is one folder ✅[^2] | Layer rule only by naming; the domain and ports sit outside slices anyway; needs refactoring discipline ✅[^2] |
| D commands / queries | Visible CQS; ready for a separate read model ✅[^3] | Groups by kind ✅[^1]; folders still grow; no help for the interface layer |

## Takeaways
- Inside each layer of a module, give every use case its own folder with its test; keep files shared by several use cases at the layer root. [rule-candidate]
- Put each file in the deepest folder that contains all of its users; inside a layer, import only from your own folder or a folder above it. [rule-candidate]
- Use full vertical slices only for thin-domain modules whose layer rule can still be checked; use command/query folders only once reads have their own model. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| foundation | MOD-10 | Source: |

## Verification status
- Verified: 19 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-29

## References
- [Angular coding style guide](https://angular.dev/style-guide) — Angular team (Google), living. Backs: How it works 1, 6; Edge cases; Trade-offs. [^1]
- [Vertical Slice Architecture](https://www.jimmybogard.com/vertical-slice-architecture/) — Jimmy Bogard, 2018. Backs: How it works 1, 5; Edge cases; Trade-offs. [^2]
- [CQRS](https://martinfowler.com/bliki/CQRS.html) — Martin Fowler, 2011. Backs: How it works 1, 6; Edge cases; Trade-offs. [^3]
- [JS Boundaries: Elements](https://www.jsboundaries.dev/docs/setup/elements/) and [Selectors](https://www.jsboundaries.dev/docs/setup/selectors/) — `eslint-plugin-boundaries` project, living. Backs: How it works 5 (element types, captured path values, templated selectors). [^4]
- [DDD_Aggregate](https://martinfowler.com/bliki/DDD_Aggregate.html) — Martin Fowler, 2013. Backs: How it works 4, Edge cases (aggregate, root, unit of loading and transactions). [^5]
- [Express 5.x API: Router](https://expressjs.com/en/5x/api/router/) — Express project, living. Backs: Edge cases (`mergeParams`: preserves the parent's `req.params`, default `false`). [^6]
- [Screaming Architecture](https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html) — Robert C. Martin, 2011. Background: folders should show the use cases.
- `copilot/frameworks/agentic-sdlc/foundations/design/module-boundaries.md` — MOD-9 (first grouping) and MOD-10 (inside a module).
- `conanjs/agentic-sdlc-reference-typescript-node` v3.1.0 — `src/modules/documents/` (the flat tree measured above) and `eslint.config.mjs` (`layerZones`, `moduleZones`); v4.0.0 — the same module in option B, the artifact above; v4.1 branch — `interface/routes/DocumentsRouter.ts`, `CommentsRouter.ts` (module routers) and the prefix-mount typing test.

## Related
- `software-design/architecture-styles/screaming-architecture-deep-dive.md` — the level above: what the top of `src/` shows.
- `software-design/architecture-styles/vertical-slice-architecture.md` — option C in full: Bogard's rules, the slice rules C1–C5 and the tested lint configuration.
- `software-design/architecture-styles/clean-architecture.md` — the layer rule that option C weakens.
- `js-runtime/barrel-files.md` — why the public surface is a list of files, not an index file.
