---
schema: knowledge-doc/v1
type: concept
topic: software-design/architecture-styles
status: verified
applies-to: ["any codebase organized by request or feature", "TypeScript with eslint-plugin-boundaries 7.2.0, ESLint 10"]
last-verified: 2026-10-28
last-updated: 2026-10-28
tags: [vertical-slice, feature-folders, coupling, eslint-plugin-boundaries, transaction-script, module-layout]
---

# Vertical slice architecture

## Summary
**TL;DR:** A vertical slice groups all the code for one request in one folder: the HTTP handler, its body schema, the use case and its test. The layer rule ("inner code never imports outer code") then cannot be checked by folder, so a slice architecture needs a different rule: **a slice never imports another slice**, and shared code never imports a slice. Bogard, who named the style, puts it as low coupling between slices and high coupling inside one. ✅[^1] Without a lint tool that blocks slice-to-slice imports, the folders look sliced while the code stays coupled. In this framework, slices are option C of MOD-10, allowed only with a decision record. The default is one folder per use case inside each layer (option B).
**Use this when:** someone proposes vertical slices for a module, you review a module laid out in slices, or you need to configure the lint rules that keep slices apart.
**Not this doc:** the comparison of all four folder options and why B is the default (see `use-case-folders.md`); feature-first versus layer-first at the top of `src/` (MOD-9, see `screaming-architecture-deep-dive.md`).

## Problem
In a layered tree, one request is spread over several folders: a handler in `interface/routes/`, a use case in `application/`, a schema beside the other handlers. One change touches many layers. Bogard also argues that layered styles bring abstractions over things that should not be abstracted, many mocks and strict dependency rules. ✅[^1] Moving each request into its own folder fixes the spread, but it creates a new risk. When the layers are no longer folders, nothing in the tree stops one slice from calling into another, or a "shared" helper from growing into a second, hidden layer.

## Mental model
**Analogy:** a food court. Each stall (slice) cooks its own dishes from start to finish, with its own counter, stove and till. All stalls share the building's water, power and storeroom (domain, ports, adapters). A stall never walks into another stall's kitchen to borrow a pan; if two stalls need the same pan, the building buys one for the shared storeroom. The building manager (the lint rule) is the one who stops a cook from crossing into the next stall. Signs on the doors alone do not.

**Artifact:** one module laid out in slices, and the lint rules that keep it that way.
```text
src/modules/documents/
  domain/document/Document.ts, Document.test.ts   ← shared: one folder per aggregate, as in option B
  ports/DocumentStore.ts                          ← shared: interfaces the slices call
  infrastructure/InMemoryDocumentStore.ts         ← shared: adapters, wired in by the composition root
  views/DocumentView.ts                           ← shared: the shape several slices return
  http/HttpErrorMapper.ts                         ← shared: reason → HTTP status for every handler
  slices/
    create-document/CreateDocument.ts, CreateDocumentHandler.ts, CreateDocumentBody.ts, CreateDocument.test.ts
    revise-document/ReviseDocument.ts, ReviseDocumentHandler.ts, ReviseDocumentBody.ts, ReviseDocument.test.ts
```
```js
// eslint.config.mjs (tested, see How it works 4)
const sameModule = { module: "{{ from.element.captured.module }}" };

settings: {
  "boundaries/elements": [
    { type: "slice", pattern: "src/modules/*/slices/*", capture: ["module", "slice"] },
    { type: "domain", pattern: "src/modules/*/domain", capture: ["module"] },
    { type: "ports", pattern: "src/modules/*/ports", capture: ["module"] },
    { type: "views", pattern: "src/modules/*/views", capture: ["module"] },
    { type: "http", pattern: "src/modules/*/http", capture: ["module"] },
    { type: "infrastructure", pattern: "src/modules/*/infrastructure", capture: ["module"] },
  ],
},
rules: {
  "boundaries/dependencies": [2, {
    default: "disallow",
    policies: [
      // C1 + C2: a slice reaches only the shared code of its own module; never another slice
      { from: { element: { type: "slice" } },
        allow: { to: { element: { types: { anyOf: ["domain", "ports", "views", "http"] }, captured: sameModule } } } },
      { from: { element: { type: "ports" } }, allow: { to: { element: { type: "domain", captured: sameModule } } } },
      { from: { element: { type: "views" } }, allow: { to: { element: { type: "domain", captured: sameModule } } } },
      { from: { element: { type: "infrastructure" } },
        allow: { to: { element: { types: { anyOf: ["domain", "ports"] }, captured: sameModule } } } },
      // C3: no policy lets domain, ports, views, http or infrastructure import a slice
    ],
  }],
},
```

## How it works
**Actors**

| Actor | Role |
|---|---|
| Slice | One folder per request (`slices/revise-document/`): handler, body schema, use case, tests. Decides for itself how to handle its request |
| Shared module code | `domain/` (aggregates), `ports/`, `views/`, `http/`: used by several slices, never importing a slice |
| Infrastructure | Adapters that implement the ports. Slices never import them; they receive ports |
| Composition root | `src/CompositionRoot.ts`: builds the adapters and passes them to each slice's use case and handler |
| Lint plugin | `eslint-plugin-boundaries`: gives every file an element type by path and blocks imports no policy allows |

**Flow of one request** (`PUT /documents/:id`)

1. The router passes the request to `slices/revise-document/ReviseDocumentHandler.ts`.
2. The handler checks the body with `ReviseDocumentBody.ts` in the same folder and calls `ReviseDocument.run`.
3. The use case loads the aggregate through the `DocumentStore` port, calls `Document.revise`, and saves the result.
4. The handler turns the `Result` into a response, using the shared `http/HttpErrorMapper.ts` for failures and the shared `views/DocumentView.ts` for success.

Steps 1, 2 and 4 stay inside one folder; step 3 uses only shared code. No other slice takes part.

1. **What Bogard says.** A slice is built around one distinct request and holds all its concerns, from the front end to the back. ✅[^1] Coupling follows the axis of change: minimize coupling between slices and maximize it inside a slice. ✅[^1] Each slice decides how best to fulfil its request. A team can start with a simple transaction script and refactor toward richer patterns when code smells appear. ✅[^1] Cross-slice sharing is kept to a minimum, so a new feature adds code instead of changing shared code. ✅[^1] The style assumes a team that knows code smells and refactoring, and that sees when a service does too much and logic must move into the domain. ✅[^1] Splitting by request also separates commands from queries, which Bogard notes gives CQRS from the start. ✅[^1]
2. **The rules this framework requires for slices** *(our proposal; MOD-10 option C needs a decision record that adopts them)*:

   | # | Rule | Checked by |
   |---|---|---|
   | C1 | A slice never imports another slice | Lint (tested) |
   | C2 | A slice imports only its own files and its module's shared code (`domain/`, `ports/`, `views/`, `http/`), never `infrastructure/` | Lint (tested) |
   | C3 | Shared code never imports a slice | Lint (tested) |
   | C4 | Code a second slice needs moves to the shared folders, with a review; it is not copied and not imported from the first slice | Code review |
   | C5 | A business rule that grows inside a slice moves onto the aggregate in `domain/`; the slice stays an orchestrator | Code review, Bogard's refactoring step ✅[^1] |
3. **How the plugin decides.** `boundaries/elements` gives each file an element type from a path pattern, and `capture` stores parts of that path (here the module and the slice name). ✅[^2] The `boundaries/dependencies` rule takes a `default` and a list of `policies`, each allowing or disallowing imports `from` one kind of element `to` another. ✅[^3] A selector can compare a captured value with the importing file's own, with a template such as `{{ from.element.captured.family }}`. ✅[^4]
4. **Tested 2026-10-28** with `eslint-plugin-boundaries` 7.2.0, ESLint 10.13.0 and the `typescript-eslint` 8.72.0 parser, on a throwaway tree shaped like the artifact (two slices, every shared folder, a second module), not on the stack reference:
   - Reported: a slice importing another slice (C1); a slice importing `infrastructure/` (C2); a domain file importing a slice (C3); a slice importing another module's `domain/` (only because of the `sameModule` template).
   - Allowed: imports between files of the same slice; a slice importing its module's `domain/`, `ports/`, `views/` and `http/`; `infrastructure/` importing `ports/` and `domain/`; `ports/` and `views/` importing `domain/`.
   - C1 needed no template. Imports inside one element are not checked, and every other slice is a different element, so `default: "disallow"` blocks it.
   - Not tested: the stack reference's `@/` path alias with `.js` import suffixes, which needs `eslint-import-resolver-typescript` (its native dependency's install script was blocked in the throwaway project); the probe used relative imports without suffixes and the Node resolver.

**Cross-side interactions**

| Change on one side | Effect on the other sides |
|---|---|
| Edit a file inside one slice | No other slice can be affected; it cannot import the file (C1) |
| Change an aggregate in `domain/` | Every slice that uses it may break; run all slice tests |
| Change a shared view or the error mapper | Every slice that returns or uses it changes its response |
| Delete a slice folder | Nothing else breaks, because nothing imports it (C1, C3); only the router entry goes |
| Swap an adapter in `infrastructure/` | Slices are unchanged; the composition root wires the new adapter |

## Worked example
Adding `ArchiveDocument` to a module laid out in slices, with one mistake on the way:

| Step | Action | Result |
|---|---|---|
| 1 | Create `slices/archive-document/` with `ArchiveDocument.ts`, `ArchiveDocumentHandler.ts`, `ArchiveDocument.test.ts` | One new folder; no other slice is touched |
| 2 | Add `Document.archive()` to `domain/document/Document.ts` with its test | The rule sits on the aggregate (C5); other slices can use it later |
| 3 | Suppose the handler needs a `loadOrNotFound` helper defined in `revise-document/ReviseDocument.ts`, and the author imports it from there | Lint reports `There is no policy allowing dependencies from elements of type "slice" … slice="archive-document" to elements of type "slice" … slice="revise-document"` (C1; message shape from the test) |
| 4 | Move `loadOrNotFound` to a shared place (a method on the port, or a function beside it), with a review (C4); both slices import it from there | Lint passes |
| 5 | Register the route and wire the use case in the composition root | `DELETE /documents/:id/archive` works; `git rm -r slices/archive-document/` plus one router line would remove it again |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Slices without the lint rule | Slices start importing each other; deleting one breaks others | Only a tool stops this; folder names do not *(analysis, ours)* |
| Two slices copy the same 30 lines instead of sharing | Fixes must be made twice | Bogard keeps sharing minimal ✅[^1]; C4 asks for a reviewed move to shared code, not a copy |
| A rich domain (many rules, invariants) | Slices grow into large transaction scripts that repeat rules | Push logic into the domain when a service does too much ✅[^1]; keep `domain/` outside slices |
| A "shared" folder grows into a second application layer | Slices become thin wrappers again, and the old layer problems return | Move only what a second slice really needs (C4) *(analysis, ours)* |
| A slice imports an adapter directly | Lint reports it (C2, tested) | Slices receive ports from the composition root |
| Files outside every element pattern (`src/CompositionRoot.ts`) | Not classified as any element type | Only files that match `boundaries/elements` get a type ✅[^2]; how the plugin treats imports from unclassified files was not tested |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Vertical slices (MOD-10 option C) | One request is one folder; deleting a feature deletes one folder; each slice can pick its own approach ✅[^1]; a plain slice-to-slice lint rule | Layers are no longer folders; needs a lint plugin and C4/C5 reviews; assumes a team that refactors ✅[^1]; shared folders are needed anyway |
| One folder per use case inside each layer (option B, default) | Groups what changes together; layer rules stay path-based and unchanged; narrow task paths for agents | One request still spans two or three folders |
| Flat layers (option A) | Simplest | Folders grow with every use case; related files sit apart |

## Takeaways
- Adopt vertical slices only with a lint rule that blocks slice-to-slice imports and shared-to-slice imports; folder names alone do not keep slices apart. [rule-candidate]
- In a slice layout, keep aggregates in `domain/<aggregate>/` outside the slices, and move business rules there when a slice grows. [rule-candidate]

## Used by
- _Not cited by any rule yet._ MOD-10's Interpreting table points here for option C.

## Verification status
- Verified: 17 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-28

## References
- [Vertical Slice Architecture](https://www.jimmybogard.com/vertical-slice-architecture/) — Jimmy Bogard, 2018-04-19. Backs: Summary, Problem, How it works 1, Edge cases, Trade-offs. [^1]
- [JS Boundaries: Elements](https://www.jsboundaries.dev/docs/setup/elements/) — `eslint-plugin-boundaries` project, living. Backs: How it works 3 (element types, `capture`), Edge cases. [^2]
- [eslint-plugin-boundaries README](https://github.com/javierbrea/eslint-plugin-boundaries) — Javier Brea, living. Backs: How it works 3 (`boundaries/dependencies`, `default`, `policies`). [^3]
- [JS Boundaries: Selectors](https://www.jsboundaries.dev/docs/setup/selectors/) — `eslint-plugin-boundaries` project, living. Backs: How it works 3 (templated captured values). [^4]
- `copilot/frameworks/agentic-sdlc/foundations/design/module-boundaries.md` — MOD-10 and its option C row.
- Throwaway probe, 2026-10-28: `eslint-plugin-boundaries` 7.2.0, ESLint 10.13.0, `typescript-eslint` 8.72.0, Node 24; the configuration in the Mental model is the one that ran.

## Related
- `software-design/architecture-styles/use-case-folders.md` — all four folder options and why per use case inside each layer is the default.
- `software-design/architecture-styles/clean-architecture.md` — the layer rule that slices replace with a slice rule.
- `software-design/architecture-styles/screaming-architecture-deep-dive.md` — the level above: what the top of `src/` shows.
- `software-design/architecture-styles/hexagonal-architecture.md` — ports and adapters, which slices still use.
