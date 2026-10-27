# Proposal: A Feature-First, Fuller Stack Reference — Without Losing the Layer-First Example

**Status:** Approved 2026-10-27 by the owner (V), except H1, which is still open (§E). Answers that differ from the draft: L3 makes feature-first the default and layer-first an opt-in, with `shared/` created from day one; M1 bans barrel files everywhere in application code (IMP-5, TSN-18); F2 takes the revised plan (§C2). **Implemented:** reference v1.1.0 and v1.2.0 (layer-first, branch `layout/layer-first`, `a8e7766`) and **v2.0.0** (feature-first pure move on `main`, `171c3ba`, reference PR #6), both pinned in `stacks/typescript-node/reference.md` (`variants`, "Which layout"); MOD-3, MOD-4, MOD-9, IMP-5, CMT-12, TSN-17, TSN-18; `repo-architecture/v2` `modules`; the procedure's optional `module` input; `copilot/patterns/maintained-variant.pattern.md`; G2 closed. **Not started:** v2.1.0 (status codes + Problem Details) waits for H1; then v2.2.0 to v2.4.0, and the SQLite phase (F2).

**How to read:**
- Part A: how the code is organized as it grows, and how the current four-folder example stays available.
- Part B: where standard HTTP status codes come from and where they may be used.
- Part C: the features that make the app realistic.
- Part D: phasing and versions.
- §E: the decisions needed.

Every option table ends with a recommendation.

---

## Part A — From four top-level layers to feature modules

### A1. The problem

Today `src/` has four folders, one per layer: `domain/`, `application/`, `infrastructure/`, `interface/`. That is **layer-first** packaging. With one feature it is the clearest possible teaching layout. With ten features, every folder mixes all of them: adding "comments" touches four distant folders, and nothing stops `documents` code from reaching into `comments` internals.

The sources already say so:
- Martin: the top level should "scream" the use cases, not the framework.
- Fowler: for a larger system, "split your top level into domain oriented modules", each layered inside.
- Brown: package by component, with the compiler or lint enforcing it.

All three are cited in `knowledge/software-design/architecture-styles/clean-architecture-deep-dive.md` §8. That deep dive already records this as open gap **G2** ("top level does not scream"), with a fix "not applied yet": "feature-first top level, layers inside, once more than ~3 features".

Analogy: a small shop can keep all tools on four shelves sorted by kind (hammers, saws…). A workshop with ten benches gives each bench its own small set of shelves, plus one shared shelf; a bench may borrow only what the other bench puts on its counter.

### A2. The proposed layout

```text
src/
├── documents/                     ← feature module (one bounded part of the domain)
│   ├── domain/                    Document.ts
│   ├── application/               CreateDocument.ts, ReviseDocument.ts, GetDocument.ts, …
│   │   └── ports/                 DocumentStore.ts
│   ├── infrastructure/            InMemoryDocumentStore.ts
│   ├── interface/http/            DocumentRoutes.ts, handlers, request schemas
├── comments/                      ← second module; imports only documents' public use-case files (§A5)
│   └── …same four folders…
├── shared/                        ← no feature code; every module may use it, it uses no module; created from day one, even empty
│   ├── domain/                    Result.ts
│   ├── interface/http/            HttpErrorMapper.ts, problem details, status codes (Part B)
│   └── infrastructure/            config.ts, logger.ts
├── CompositionRoot.ts             ← still the only importer of adapters; mounts each module's routes
└── main.ts
```

**Rules, each enforced by lint (resolved-path zones, as today):**

| Rule | Example that fails |
|---|---|
| Inside a module, the existing layer rule holds: `domain` ← `application` ← `infrastructure` / `interface` | `documents/domain/Document.ts` imports `documents/application/...` |
| A module imports another module only through its public surface (§A5 decides how it is declared) | `comments/application/AddComment.ts` imports `@/documents/domain/Document.js` |
| No cycles between modules | `documents` → `comments` → `documents` |
| `shared/` imports no module | `shared/interface/http/HttpErrorMapper.ts` imports `@/documents/...` |
| The composition root may import every module's adapters | — (allowed) |

**When to use which layout** (`foundations/design/module-boundaries.md` MOD-9, closing G2): feature-first is the default for every new repo, even with one feature. Layer-first is an explicit opt-in for one bounded context with at most three feature areas, recorded as a decision, and switches to feature-first at the fourth area or the second bounded context. *(Owner's change, 2026-10-27: "recommend any application should always start with feature-first … The three cited rules for layer-first are still applied if the user explicitly chooses to opt-in".)*

### A3. Keeping the layer-first example: options

Many documents use the four-folder layout as their example:
- 5 knowledge docs;
- the stack's Choices table;
- the `add-port-and-adapter` procedure;
- this framework's worked examples.

Replacing it would leave no example of the layout that small projects should still use.

| Option | How | Gains | Costs |
|---|---|---|---|
| A. **Frozen tag** | `main` becomes feature-first (`v2.x`); the layer-first code survives only as tag `v1.x` | Zero extra work; every link pinned to a commit keeps working, because a commit permalink never changes | The layer-first example never gets fixes (for example the new `@param` rule); it slowly diverges from the rules |
| B. **Maintained branch** (recommended) | Branch `layout/layer-first` keeps today's code and its CI; `main` becomes feature-first. Tags `v1.x` come from the branch, `v2.x` from `main`. Rule fixes land on both, as two small PRs | Both layouts stay correct and CI-checked; old links keep working; each layout has its own pin | Rule changes are applied twice (small: the layer-first app stays one feature) |
| C. Two repos | `…-reference-typescript-node-layered` and `…-modular` | Fully separate | Two CIs and pins, duplicated configs that drift apart |
| D. Two apps in one repo | `apps/layered`, `apps/modular` in a pnpm workspace | One CI, always both current | The same feature written twice in one tree; agents copy the wrong one; the repo stops being "an ordinary project for its stack" |

**Recommendation: B.** It keeps the four-folder example truthful *and* current, at the cost of applying a rule fix twice to a one-feature app.

### A4. What changes in the framework, so both layouts are stated

- **`stacks/typescript-node/reference.md`** (`stack-reference/v1`; no version bump, as the framework is unpublished):
  - front-matter gains one entry per layout:
    ```yaml
    layouts:
      - { name: layer-first, branch: layout/layer-first, pinned: v1.1.0, commit: <sha> }
      - { name: feature-first, branch: main, pinned: v2.0.0, commit: <sha> }
    ```
  - a new section, "Which layout": the A2 rule, with one line each on when to copy which;
  - the Choices table gains a "Layout" column where a row differs.
- **Knowledge docs:** links stay pinned to the layer-first commit (they explain layers, and one feature shows them best). Each gets one added sentence: "for more than three features, see the feature-first layout (link)". The clean-architecture deep dive marks G2 as resolved.
- **`add-port-and-adapter`:** gains an input `module` (feature-first) and `allowed-paths` written as `src/{module}/application/**` etc. The validator substitutes `{module}`; for a layer-first repo the module is empty, and paths fall back to `src/application/**`.
- **The stack lint snippet** (`idioms.md`) gains the module-boundary zones from A2, tested in the reference like the other snippets.

### A5. A module's public surface: a barrel `index.ts` or not (decision M1)

The owner dislikes `index.ts` and asked for a comparison first. A **barrel** is a file that only re-exports other files, for example `export { ReviseDocument } from "./application/ReviseDocument.js";`. Other modules then import `@/documents/index.js`, never a file inside the module. Analogy: a shop counter. Customers may take only what is on the counter, and the counter is a separate piece of furniture that someone must keep stocked.

| Option | How the public surface is declared | Example import in `comments` | Gains | Costs |
|---|---|---|---|---|
| A. Barrel `index.ts` | One re-export file per module; lint allows other modules to import only that file | `import { GetDocument } from "@/documents/index.js"` | One obvious list of what is public; internals can move without touching consumers | Importing one name loads the whole module graph, which slows type checking, tests and dev servers. Hagemeister measured this, and Atlassian cut CI build time by about 75% by removing barrels from Jira's frontend. Barrels also create cycles easily (`import-x/no-cycle` noise), make IDE auto-import pick the barrel or the file inconsistently, and add a file that has no primary type (NAM-8) and must be kept in sync by hand |
| B. **Designated files, enforced by lint (recommended)** | Public = the module's use-case classes and their `Input`/`Output` types in `application/` (MOD-5's "public use case"), listed in `docs/architecture.md` §4. Lint zones forbid everything else | `import { GetDocument } from "@/documents/application/GetDocument.js"` | No extra file; each import names the real file; no graph-loading cost; follows IMP and NAM-8 as they are | The surface is a folder convention plus lint, not one file; moving a use case changes the consumers' import paths |
| C. Consumer-owned port | `comments` declares the port it needs (`DocumentLookup`); an adapter wired by the composition root calls `documents`' use case. Modules never import each other | `comments` imports nothing from `documents` | Lowest coupling; easiest later split into a service | One port, one adapter and one test per cross-module need: heavy for a reference |
| D. One package per module | pnpm workspace; each module's `package.json` `exports` lists its public files; Node refuses other paths | `import { GetDocument } from "@ref/documents"` | Enforced by the runtime, not only by lint | Workspace, build and versioning work per module; overkill inside one service |

**Lint for B** (to be tested in v2.0.0, like every snippet): with `import-x/no-restricted-paths`, one zone forbids `./src/documents` from `./src/comments` with `except: ["./application"]`, and a second zone forbids `./src/documents/application/ports`. Zones are checked independently, so the second still blocks ports.

**Recommendation: B**, with C when a consumer needs only a narrow capability, or when the module is a candidate for a later split. MOD-3's "public entry point" is then the use case itself. If B is chosen, the A2 tree has no `index.ts`.

**Sources:** [Marvin Hagemeister, "Speeding up the JavaScript ecosystem – The barrel file debacle"](https://marvinh.dev/blog/speeding-up-javascript-ecosystem-part-7/); [Atlassian, "How We Achieved 75% Faster Builds by Removing Barrel Files"](https://www.atlassian.com/blog/atlassian-engineering/faster-builds-when-removing-barrel-files) (2025-06-26); [Node.js, package `exports`](https://nodejs.org/docs/latest-v24.x/api/packages.html#exports).

---

## Part B — Standard HTTP status codes

### B1. Options

| Option | What you get | Checked 2026-10-27 | Verdict |
|---|---|---|---|
| Hand-written constants | Exactly the codes used | — | Fine for 3 codes; error-prone and duplicated as routes grow |
| `node:http` `STATUS_CODES` (built in) | Map from number to reason phrase (`409` → `"Conflict"`), 63 entries | Node 24.22 | No named constants, so code still writes `409` |
| [`http-status-codes`](https://www.npmjs.com/package/http-status-codes) | `StatusCodes.CONFLICT`, `getReasonPhrase(422)` | 2.3.0, last published 2023-09-20, MIT, ~10M downloads/week, no `exports` map (CommonJS-first) | Works here (spike below), but stale and CommonJS-first |
| [`http-status`](https://www.npmjs.com/package/http-status) (recommended) | `status.CONFLICT` → 409, `status[409]` → `"Conflict"` | 2.1.0, published 2025-01-04, BSD-3-Clause, ~1.3M/week, ESM with `exports` map and bundled types, zero dependencies | Native fit for this ESM + NodeNext project |

**Spike, on a throwaway branch of the reference (deleted afterwards):**
- `tsc --noEmit` passed with both packages imported;
- `tsx` printed `409 Conflict 422 409 Unprocessable Entity`;
- plain Node ESM imported both.

### B2. Where it goes

A status code is a **delivery detail** of HTTP, so it belongs only in the interface (adapter) ring:

| Ring | May use `http-status`? | What it uses instead |
|---|---|---|
| `domain/`, `application/` | **No** | Its own error union (`"not-found" \| "version-conflict" \| …`), as today |
| `interface/http/` (and `shared/interface/http/`) | Yes | `HttpErrorMapper` maps each error to `status.NOT_FOUND`, `status.CONFLICT`, …; handlers use `status.CREATED`, `status.NO_CONTENT` |

The rule is enforced by lint: `no-restricted-imports` for `http-status` everywhere except `src/**/interface/**`. That fits the existing layer zones: the same mechanism that keeps `express` out of the core.

**Also:** error bodies become **RFC 9457 Problem Details** (`application/problem+json`, with `type`, `title`, `status`, `detail`), which the existing knowledge doc `web-apis/http-error-mapping.md` already recommends. `title` comes from `status[code]`. RFC 9457 obsoletes RFC 7807.

### B3. H1 revisited: why not the most downloaded library?

The owner asked why the recommendation was not `http-status-codes`, the most downloaded. Registry data, re-read on 2026-10-27:
- `http-status-codes` 2.3.0: about 9.95M downloads/week; last published 2023-09-20.
- `http-status` 2.1.0: about 1.27M downloads/week.
- Both figures are from the npm downloads API, week 2026-06-25 to 2026-07-01.

**The first recommendation leaned on two weak reasons.**
- "ESM-native": true, but the spike showed `http-status-codes` imports fine in this ESM + NodeNext project.
- "Last published 2023": also true, but the constants mirror the IANA status-code registry. That registry rarely changes, so a quiet package is not a sign of neglect, as it would be for a parser or a framework. This is our reasoning, not a sourced fact.

**What favours `http-status-codes`:**
- About 8× more installs.
- Its `StatusCodes.CONFLICT` / `getReasonPhrase()` API is the form most developers, and the models agents run on, have seen most. That means fewer invented APIs in generated code.

**What favours `http-status`:**
- Native ESM, with an `exports` map.
- Reason phrases by number (`status[409]`).
- `status.extra` for codes outside the IANA registry used by common servers (per its README).

| Choice | Pick when |
|---|---|
| **`http-status-codes`** (revised recommendation) | Default: widest familiarity; works in this project as tested |
| `http-status` | The project needs codes outside the IANA registry (`status.extra`), or a strict ESM-only toolchain rejects packages without an `exports` map |
| Hand-written constants | A tiny service using a handful of codes that wants zero dependencies |
| `node:http` `STATUS_CODES` | Only reason phrases are needed, never named constants |

All four become one row of the stack's Options table (`stacks/typescript-node/idioms.md`). The row is added in v2.1.0, together with the tested lint configuration that keeps the library in the interface ring (B2), so that each option has a tested config, as the schema requires.

---

## Part C — A fuller, more realistic app

Every addition shows a rule that the current code cannot. Each is planned as a `tasks.md` task with `touches:`, `refs:` and `procedure:`, so the reference also demonstrates D11.

| Feature | Routes | Shows |
|---|---|---|
| Documents, full lifecycle | `POST /documents` → 201 + `Location`; `GET /documents/:id`; `GET /documents?cursor=&limit=` (cursor pagination); `PUT /documents/:id` (exists); `DELETE /documents/:id` → 204 | Several use cases per module; pagination contract; one handler per use case |
| Version history | `GET /documents/:id/versions` | A read model from the same store; a second port method |
| HTTP-native optimistic concurrency | `ETag` on reads; `If-Match` on `PUT`/`DELETE` → 412 when stale, 428 when missing | The HTTP form of the existing `expectedVersion` rule (RFC 9110 conditional requests; RFC 6585 for 428) |
| Comments (second module) | `POST /documents/:id/comments`, `GET /documents/:id/comments` | Cross-module access only through `documents`' public use-case files (§A5); the module-boundary lint |
| Operational | `GET /healthz`; request-id middleware; structured request logs | Cross-cutting code in `shared/`; logging rules (TSN-10) |
| Errors | Problem Details everywhere | Part B in practice |
| Persistence (later phase) | Same routes, a `SqliteDocumentStore` behind `DocumentStore` via `node:sqlite` | A second adapter for one port, with one shared contract test (procedure step 8). `node:sqlite` is "1.2 – Release candidate" in Node 24, so this waits until it is stable or uses a library |

Out of scope: authentication and authorization (a whole topic: its own proposal), deployment.

### C2. F2 revisited: in-memory documents, SQLite for another entity?

The owner suggested keeping `documents` in memory as the example and adding a SQLite adapter for another entity, such as comments. Analysis:

| Question | In-memory documents + SQLite comments | SQLite as a second adapter of `DocumentStore` (and later `CommentStore`) |
|---|---|---|
| Does it prove the port is a real abstraction? | No. Each port has one adapter, so nothing shows that the port is not shaped by its only adapter | Yes. One contract test suite runs against both adapters (procedure step 8), which is the classic hexagonal test |
| Is the data consistent? | No. After a restart, comments survive and their documents vanish, leaving orphan comments; the "comment needs an existing document" check passes when written and is broken after restart | Yes, when both modules use the same configured store |
| Is it realistic? | Mixed persistence for related data is a known production smell | `STORE=memory\|sqlite` in config; memory for unit tests and demos, SQLite for a run that keeps data |
| What does it teach about MOD-6 (one owner per table)? | Something, because each module owns its storage | The same, as long as each module has its own tables |

**Recommendation:**
- Do not split persistence by entity.
- Keep in-memory as the default adapter of every store: tests and the demo stay fast and dependency-free.
- In a later phase, add `SqliteDocumentStore` behind the same `DocumentStore` port, selected by config, with the shared contract test. Then do the same for comments.

**Driver:** `node:sqlite` is "1.2 – Release candidate" in Node 24; `better-sqlite3` is the mature alternative, but it is a native addon. Decide when the phase starts.

---

## Part D — Phasing and versions

Each step is one PR in the reference repo plus one pin bump here, and is checked by CI before the next starts.

| Version | Branch | Change | Behaviour change? |
|---|---|---|---|
| v1.1.0 | `main`, later `layout/layer-first` | Stack CI template, `.nvmrc`, `@param`/`@returns` rules — [PR #1](https://github.com/conanjs/agentic-sdlc-reference-typescript-node/pull/1), already open | No |
| — | — | Create `layout/layer-first` from v1.1.0; pointer lists both layouts | No |
| v2.0.0 | `main` | **Pure move** to feature-first: same feature, same tests, new folders, module-boundary lint | No — proves the mapping one-to-one |
| v2.1.0 | `main` (+ `layer-first` for the mapper part) | `http-status` in the interface ring, Problem Details | Error body format changes |
| v2.2.0 | `main` | Documents lifecycle and version history | New routes |
| v2.3.0 | `main` | ETag / If-Match | New headers, 412/428 |
| v2.4.0 | `main` | Comments module, `/healthz`, request id | New module and routes |

---

## E. Decisions needed

Answers from the owner, 2026-10-27. "Lands in" is the permanent home of each decision once implemented (`proposals/README.md`).

| # | Question | Recommended | Owner's answer | Lands in |
|---|---|---|---|---|
| A1, A2 | The problem, and the feature-first layout | As written | "Yes" | MOD-9 (done); reference v2.0.0 |
| L1 | Switch the reference to feature-first? | Yes, as v2.0.0, a pure move first | "ok" | `stacks/typescript-node/reference.md` (pins both layouts) |
| L2 | How to keep the layer-first example? | B: maintained branch `layout/layer-first`, tags `v1.x` | "ok for option B" | `copilot/patterns/maintained-variant.pattern.md` (done); `reference.md` |
| L3 | Threshold rule | Layer-first ≤ 3 features in one bounded context; feature-first beyond; recorded as a decision | Changed: feature-first is the default for every repo; layer-first only by explicit opt-in, under the ≤ 3 rule | MOD-9 (done) |
| M1 | How a module declares its public surface (§A5) | B: designated use-case files, enforced by lint; no barrel | "Use the recommendation", and record a rule against barrels with the evidence | IMP-5 and MOD-3 (done); TSN-18 + `noReExports` lint (done, reference PR pending); module zones in v2.0.0 |
| H1 | Status-code source | Revised: `http-status-codes` as default, three alternatives (§B3) | Open: owner asked why not the most downloaded | `idioms.md` Options row (v2.1.0) |
| H2 | Error body | RFC 9457 Problem Details | "ok" | `idioms.md` TSN rule + `knowledge/web-apis/http-error-mapping.md` |
| F1 | Feature scope | Part C table; auth out of scope | "ok" | Reference `specs/` tasks |
| F2 | Persistence | Revised: in-memory default for every store; SQLite later as a second adapter of the same port (§C2) | "ok, agree with that recommendation" | `reference.md` Choices row (when the SQLite phase lands) |

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/stacks/typescript-node/reference.md` — the current pointer and Choices table.
- `copilot/knowledge/software-design/architecture-styles/clean-architecture-deep-dive.md` §8, §15 G2 — the packaging options and the open gap this closes.
- `copilot/knowledge/software-design/architecture-styles/screaming-architecture-deep-dive.md` — the full packaging treatment.
- `copilot/knowledge/web-apis/http-error-mapping.md` — the existing error-mapping guidance (Problem Details).
- `copilot/procedures/typescript-node/add-port-and-adapter.procedure.md` — the procedure whose paths change.

**External authoritative sources:**
- [Screaming Architecture](https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html) — Robert C. Martin, 2011. Backs: A1.
- [Presentation Domain Data Layering](https://martinfowler.com/bliki/PresentationDomainDataLayering.html) — Martin Fowler, 2015. Backs: A1 ("split your top level into domain oriented modules").
- [Modular monolith and "package by component"](https://simonbrown.je/modular-monolith) — Simon Brown. Backs: A1, A2.
- [RFC 9457: Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457) — IETF, 2023. Backs: B2 (obsoletes RFC 7807).
- [RFC 9110 §13.1.1 If-Match](https://www.rfc-editor.org/rfc/rfc9110.html#name-if-match) — IETF, 2022. Backs: C (412).
- [RFC 6585 §3: 428 Precondition Required](https://www.rfc-editor.org/rfc/rfc6585#section-3) — IETF, 2012. Backs: C.
- [http-status on npm](https://www.npmjs.com/package/http-status), [http-status-codes on npm](https://www.npmjs.com/package/http-status-codes) — registry data checked 2026-10-27. Backs: B1.
- [Node.js 24 `node:sqlite`](https://nodejs.org/docs/latest-v24.x/api/sqlite.html) — Node.js, living. Backs: C (stability 1.2).
- [Node.js 24 `http.STATUS_CODES`](https://nodejs.org/docs/latest-v24.x/api/http.html#httpstatus_codes) — Node.js, living. Backs: B1.

## Related

- `proposals/agentic-sdlc-reference-repos-and-procedures.md` — the reference repo move and procedures (D11, D12).
- `copilot/patterns/revise-without-erasing.pattern.md` — why the layer-first example is kept, not replaced.
- `copilot/patterns/maintained-variant.pattern.md` — the technique chosen in L2.
- `proposals/README.md` — where each decision lands once implemented.
