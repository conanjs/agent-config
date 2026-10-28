---
schema: stack-reference/v1
last-updated: 2026-10-28
stack: typescript-node
repo: conanjs/agentic-sdlc-reference-typescript-node
pinned: v4.0.0
commit: ce689e533f4163d2f991c4cbfad9470f5d8fdae6
verified: 2026-10-28
layout: feature-first
variants:
  - { layout: layer-first, branch: layout/layer-first, pinned: v1.5.0, commit: 0269dae5009fa0452aaa7b2a34d7e55c3a3a036f, verified: 2026-10-28 }
---

# Reference: TypeScript on Node.js

## What it shows

A small Express service for text documents, built through every layer of one feature module (`src/modules/documents/`), next to a `src/modules/shared/` module: create (`POST /documents`, 201 + `Location`), list with a cursor (`GET /documents?cursor=&limit=`), read (`GET /documents/:id`), revise without overwriting a newer change (`PUT /documents/:id`, optimistic concurrency), version history (`GET /documents/:id/versions`) and delete (`DELETE /documents/:id`, 204). It shows entity, ports, use cases, adapters, one handler per route, error mapper, composition root, entry point, unit and integration tests. It exists to be read and copied, not deployed. Every file passes the stack's lint, including the documentation and import-path rules.

The code lives in its own repo, [`conanjs/agentic-sdlc-reference-typescript-node`](https://github.com/conanjs/agentic-sdlc-reference-typescript-node), pinned above by tag and full commit SHA (a tag can move; a SHA cannot). `main` is feature-first, the framework default (MOD-9). The same code with the four layers at the top of `src/` is kept current on branch `layout/layer-first` (tags `v1.x`), pinned under `variants`. This file is the framework's map of it: the Choices table below says which rule each file shows, so a role can find the right file before cloning anything. The repo's own records — `docs/architecture.md`, `.specify/memory/constitution.md`, `docs/glossary.md` — live only in the repo.

## Choices

All paths are relative to the reference repo's root, at the pinned (feature-first) commit. In the layer-first variant, drop the module folders: `src/modules/documents/domain/` is `src/domain/`, and `src/modules/shared/<layer>/` is `src/<layer>/`.

| Concern | Choice | Rule | Where |
|---|---|---|---|
| Packaging | Feature-first, modules under `src/modules/`: `src/modules/documents/` and `src/modules/shared/`, each with `domain`, `application`, `infrastructure`, `interface` (empty ones keep `.gitkeep`); composition root outside them. Inside a layer, one folder per use case (`application/revise-document/`, `interface/routes/revise-document/`) and one per aggregate in `domain/` (`domain/document/`); files shared by several use cases stay at the layer root | MOD-9, MOD-10, CA rules | `docs/architecture.md` §4 (`modules`), `specs/001-revise-document/research.md` DR-002, DR-004 |
| Module boundaries | Another module may import only `documents/application/**` outside `ports/`; `shared/` imports no module; module list read from `src/modules/` | MOD-3, MOD-4, TSN-17 | `eslint.config.mjs` (`moduleZones`) |
| Layer direction | Resolved-path zones inside every module, so aliases cannot bypass them; glob zones end in `/**` | FF-1, TSN-17 | `eslint.config.mjs` (`layerZones`) |
| Re-exports | None: every import names the declaring file; no `index.ts` barrels | IMP-5, TSN-18 | `eslint.config.mjs` (`noReExports`) |
| Import paths | Relative only within one folder; `@/` aliases everywhere else, in `src` and `test` | IMP-1, IMP-2, TSN-16 | `eslint.config.mjs` (`noRelativeOutsideFolder`) |
| Alias mechanism | tsconfig `paths` + `tsc-alias` in the build (stack Option default) | TSN-15 | `tsconfig.json`, `package.json` `build`, `specs/001-revise-document/research.md` DR-001 |
| Ports | Declared next to the use cases that consume them | TSN-2 | `src/modules/documents/application/ports/DocumentStore.ts` |
| Create contract | `201 Created`, `Location: /documents/<id>`, the new document as the body; the id comes from a `DocumentIds` port (UUID adapter in production, sequential in tests) | NAM-7, TSN-2 | `src/modules/documents/application/ports/DocumentIds.ts`, `src/modules/documents/interface/routes/create-document/CreateDocumentHandler.ts`, `specs/002-document-lifecycle/research.md` DR-006 |
| List contract | Cursor pagination: `{ items, nextCursor }`, ascending id, `limit` 1 to 100 (default 20), `nextCursor` `null` on the last page; a bad query is a 400 problem | EXP-7 | `src/modules/documents/application/list-documents/ListDocuments.ts`, `src/modules/documents/interface/routes/list-documents/ListDocumentsQuery.ts`, DR-005 |
| Queries and commands | One use case and one handler per route; queries (`Get…`, `List…`) change nothing | NAM-4, EXP-1 | `src/modules/documents/application/`, `src/CompositionRoot.ts` (route table) |
| Paradigm | class-modeled@1: entity state in `readonly #fields`, collaborators as `private readonly` parameters | PDM-class-modeled-R1, R7 | `src/modules/documents/domain/document/Document.ts`, `src/modules/documents/application/revise-document/ReviseDocument.ts` |
| Tier B files | Only `src/main.ts` and `src/modules/shared/infrastructure/config.ts` hold free functions | PDM-class-modeled-R7 | `docs/architecture.md` §7, `eslint.config.mjs` (`tierB`) |
| Port roles | Input port = the use case's public `run()` (no separate interface); gateway port = an explicit interface; no output port (request/response form) | CA-2 | `docs/architecture.md` §4 |
| Data across boundaries | Plain `<UseCase>Input` in, plain `<UseCase>Output` out; the entity never leaves the use case | CA-4 | `src/modules/documents/application/revise-document/ReviseDocument.ts` (`ReviseDocumentOutput`) |
| Expected failures | `Result` union; thrown `Error` only for the unexpected | TSN-4, TSN-5 | `src/modules/shared/domain/Result.ts` |
| Error codes | `as const` objects with a same-name derived type, each value written once in the layer that owns it (`DocumentError`, `LookupError`, `DocumentsRefusal` spreading both); keys in code and unit tests, literal values only in the contract test; no `enum` (`noEnums`) | TSN-20 | `src/modules/documents/domain/document/DocumentError.ts`, `src/modules/documents/application/LookupError.ts`, `src/modules/documents/interface/errors/HttpErrorMapper.ts`, `eslint.config.mjs` (`noEnums`) |
| Error to HTTP | One mapper per module; a `Record` over the refusal union makes a missing status a compile error | TSN-11, EXP-5 | `src/modules/documents/interface/errors/HttpErrorMapper.ts` |
| Error body | RFC 9457 problem, `application/problem+json`: `/problems/<reason>` for named refusals, `about:blank` otherwise; thrown errors through one shared middleware that logs every 500 | EXP-8 | `src/modules/shared/interface/ProblemDetails.ts`, `src/modules/shared/interface/ErrorMiddleware.ts`, `test/integration/documents.int.test.ts`, `docs/problem-types.md` (every type with its title and status, RFC 9457 §4) |
| Status codes | `http-status-codes` named constants, only in `interface/` (stack Option default); never a bare number where a status is set or compared | TSN-19 | `eslint.config.mjs` (`http-status-codes` restriction, `noRawStatusCodes`), `specs/001-revise-document/research.md` DR-003 |
| Doc comments | TSDoc on every export and public member; contract on the port; each adapter method has its own summary starting `{@link Port.member}`, so the editor shows it plus the port's notes; every parameter and return documented; summaries answer the contract questions; every `{@link}` resolves, checked by asking the language service as an editor does | CMT-5, CMT-6, CMT-12, CMT-13, TSN-13 | `src/modules/documents/application/ports/DocumentStore.ts`, `src/modules/documents/infrastructure/InMemoryDocumentStore.ts`, `src/modules/documents/application/revise-document/ReviseDocument.ts` (`run`), `scripts/check-doc-links.mjs` |
| Naming | File name equals the class; suffixes only from the role glossary (`Store`, `Handler`, `Mapper`) | NAM-8, NAM-6 | `docs/glossary.md` |
| Config | Parsed once, frozen, nothing else reads the environment | TSN-9 | `src/modules/shared/infrastructure/config.ts` |
| Logging | One pino logger made in `main.ts` and injected; `no-console` | TSN-10 | `src/main.ts`, `src/CompositionRoot.ts` |
| Tests | Unit tests next to the code; integration tests in `test/integration/`; helpers in `test/support/` via `@/test/*` | testing-strategy | `vitest.config.ts`, `vitest.integration.config.ts` |
| Framework sections of the constitution | Default paradigm, unit-size defaults, no deviations, budgets | constitution-sdlc/v1 | `.specify/memory/constitution.md` |
| Task-line suffixes | `touches:`, `refs:`, `procedure:` (+ `inputs:`) on every `[llm]` task; T002 names `typescript-node/add-port-and-adapter` | task-line/v1, D11 | `specs/001-revise-document/tasks.md` |

## File map

| Path | Role | Shows |
|---|---|---|
| `src/modules/shared/domain/Result.ts` | type | Expected-failure union |
| `src/modules/documents/domain/document/Document.ts` | entity | Private constructor, static `create`, `#fields`, invariant in `revise` |
| `src/modules/documents/application/ports/DocumentStore.ts` | port | The contract, written once, with `@remarks` and `@returns` |
| `src/modules/documents/domain/document/DocumentError.ts`, `src/modules/documents/application/LookupError.ts` | error codes | Each code declared once, in the layer that owns it (TSN-20) |
| `src/modules/documents/application/revise-document/ReviseDocument.ts` | use case | Constructor injection; a why-comment on the one non-obvious line |
| `src/modules/documents/infrastructure/InMemoryDocumentStore.ts` | adapter | Own summary linking the port member (CMT-12); implementation note as a body comment |
| `src/modules/shared/infrastructure/config.ts` | Tier B | zod config, `@throws` |
| `src/modules/documents/interface/routes/revise-document/ReviseDocumentBody.ts` | schema | Strict input validation at the boundary |
| `src/modules/documents/interface/routes/revise-document/ReviseDocumentHandler.ts` | handler | Parse, call one use case, map the result |
| `src/modules/documents/application/<use-case>/` (`create-document/`, `get-document/`, `list-documents/`, `delete-document/`, `get-document-history/`) | use cases | One folder per use case with its test (MOD-10); one per route; plain `DocumentView` out |
| `src/modules/documents/application/ports/DocumentIds.ts`, `src/modules/documents/infrastructure/UuidDocumentIds.ts` | port, adapter | Where new ids come from |
| `src/modules/documents/interface/routes/<use-case>/*Handler.ts`, `*Body.ts`, `*Query.ts` | handlers, schemas | One handler per route; strict request schemas |
| `src/modules/documents/interface/errors/HttpErrorMapper.ts` | mapper | Exhaustive refusal-to-problem table |
| `src/modules/shared/interface/ProblemDetails.ts` | value | The RFC 9457 body and how it is sent |
| `src/modules/shared/interface/ErrorMiddleware.ts` | middleware | Thrown errors to `about:blank` problems; logs every 500 |
| `src/CompositionRoot.ts` | composition root | The only importer of adapters; the route table |
| `src/main.ts` | Tier B entry | Config, logger, listen |
| `src/**/*.test.ts`, `test/integration/*.int.test.ts` | tests | Unit, concurrency and HTTP tests |
| `eslint.config.mjs` | lint | Every lint rule of the stack, with the flat-config pitfalls handled |
| `scripts/check-doc-links.mjs` | link check | Fails `pnpm run check` on any `{@link}` an editor could not follow (TSN-13) |
| `eslint/local-docs.mjs` | lint plugin | `specific-summary` (CMT-13 floor) and `implementation-summary` (CMT-12); copy it into each repo |
| `docs/`, `.specify/`, `specs/` | records | Architecture, glossary, constitution, decision records, task plan, as any project has |
| `.github/workflows/check.yml` | CI | `pnpm run check`, then this framework's `validate-project.mjs` at a pinned framework commit |

## How to fetch

Read-only, at the pinned commit. `{{REFERENCE_REPOS_ROOT}}` is defined in `{{AGENT_HOME}}/global-variables.md`.

1. Once: `git clone https://github.com/conanjs/agentic-sdlc-reference-typescript-node "{{REFERENCE_REPOS_ROOT}}/typescript-node"`.
2. Every time: `git -C "{{REFERENCE_REPOS_ROOT}}/typescript-node" fetch --tags --quiet` then `git -C "{{REFERENCE_REPOS_ROOT}}/typescript-node" checkout --quiet ce689e533f4163d2f991c4cbfad9470f5d8fdae6` (feature-first, `v4.0.0`), or `… checkout --quiet 0269dae5009fa0452aaa7b2a34d7e55c3a3a036f` for the layer-first variant (`v1.5.0`).
3. To look at one file without cloning: `https://github.com/conanjs/agentic-sdlc-reference-typescript-node/blob/ce689e533f4163d2f991c4cbfad9470f5d8fdae6/<path>`.

A role working on another project never edits this clone. A change to the reference is a pull request to its own repo.

## How to check

In the clone: `pnpm install`, then `pnpm run check` (format, lint, typecheck, doc links, unit and integration tests, build, smoke import of `dist/`). Then `node {{AGENT_HOME}}/frameworks/agentic-sdlc/tools/validate-project.mjs .`. The repo's CI runs both on every push, the second at a pinned framework commit. A failure means the reference no longer matches the stack's rules; fix the reference or the rule, as a pair of pull requests (below).

## Which layout

| Layout | Copy it when | Tag | Commit |
|---|---|---|---|
| Feature-first (`main`) | Always, by default (MOD-9): every new repo, even with one feature | `v4.0.0` | `ce689e533f4163d2f991c4cbfad9470f5d8fdae6` |
| Layer-first (`layout/layer-first`) | Only when the owner opted in with a decision record: one bounded context, at most three feature areas | `v1.5.0` | `0269dae5009fa0452aaa7b2a34d7e55c3a3a036f` |

Both variants get every rule fix, one pull request each (`{{AGENT_HOME}}/patterns/maintained-variant.pattern.md`).

## Using it in a repo

1. Copy the configs (`package.json` scripts, `tsconfig*.json`, `vitest*.config.ts`, `eslint.config.mjs`, `.prettierrc.json`) and adjust names.
2. Start feature-first (MOD-9, the default), as the pinned code does: one folder per feature area, `src/modules/<feature>/{domain,application,infrastructure,interface}/`, plus `src/modules/shared/` with the same four folders from day one (even empty), and the composition root at `src/`. List the modules and their public files in `docs/architecture.md` §4. Copy the layer-first variant only when the owner opts in with a decision record.
3. Record the repo's own decisions (alias Option, paradigm, Tier B files) in its `specs/<feature>/research.md` and `docs/architecture.md`; do not copy this reference's records.
4. Anything done differently goes in the constitution's "style deviations" table.

**Changing a rule that the reference shows:** one pull request in the reference repo (its CI can be pointed at the framework branch with the workflow's `framework-ref` input), then one here that changes the rule and bumps `pinned`, `commit` and `verified` together.

## References

- `idioms.md` — TSN rules and the tested lint snippets this code follows.
- `paradigms/class-modeled.md` — the paradigm overlay.
- `frameworks/express.md` — EXP rules.
- `../../schemas/stack-reference.schema.md` — schema for this file.
- `{{AGENT_CONFIG_REPO}}/proposals/agentic-sdlc-reference-repos-and-procedures.md` — Part A, why the code moved to its own repo.
- `{{AGENT_CONFIG_REPO}}/proposals/agentic-sdlc-reference-feature-first.md` — why `main` is feature-first and the layer-first variant is kept.
- [Express 5 error handling](https://expressjs.com/en/guide/error-handling.html) — rejected promises from handlers reach the error middleware.
- [TSDoc](https://tsdoc.org/) — doc-comment syntax.
- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use) — pin a full commit SHA because tags can move.

## Related

- `{{AGENT_HOME}}/procedures/typescript-node/index.md` — step-by-step procedures that produce code shaped like this reference.
- `index.md` — the stack's command slots.
