---
schema: stack-reference/v1
last-updated: 2026-10-27
stack: typescript-node
repo: conanjs/agentic-sdlc-reference-typescript-node
pinned: v1.1.0
commit: 0f899099b469a63262fd113f2b0a88414c08f30e
verified: 2026-10-27
---

# Reference: TypeScript on Node.js

## What it shows

A small Express service with one feature, "revise a document without overwriting a newer change" (`PUT /documents/:id`, optimistic concurrency), built through every layer: entity, port, use case, adapter, HTTP handler, error mapper, composition root, entry point, unit and integration tests. It exists to be read and copied, not deployed. Every file passes the stack's lint, including the documentation and import-path rules.

The code lives in its own repo, [`conanjs/agentic-sdlc-reference-typescript-node`](https://github.com/conanjs/agentic-sdlc-reference-typescript-node), pinned above by tag and full commit SHA (a tag can move; a SHA cannot). This file is the framework's map of it: the Choices table below says which rule each file shows, so a role can find the right file before cloning anything. The repo's own records — `docs/architecture.md`, `.specify/memory/constitution.md`, `docs/glossary.md` — live only in the repo.

## Choices

All paths are relative to the reference repo's root, at the pinned commit.

| Concern | Choice | Rule | Where |
|---|---|---|---|
| Layers | `domain`, `application`, `infrastructure`, `interface` under `src/`; composition root outside them | CA rules, FF-1 | `docs/architecture.md` §4 |
| Layer direction | Resolved-path zones, so aliases cannot bypass them | FF-1, TSN-17 | `eslint.config.mjs` (`layerZones`) |
| Re-exports | None: every import names the declaring file; no `index.ts` barrels | IMP-5, TSN-18 | `eslint.config.mjs` (`noReExports`) |
| Import paths | Relative only within one folder; `@/` aliases everywhere else, in `src` and `test` | IMP-1, IMP-2, TSN-16 | `eslint.config.mjs` (`noRelativeOutsideFolder`) |
| Alias mechanism | tsconfig `paths` + `tsc-alias` in the build (stack Option default) | TSN-15 | `tsconfig.json`, `package.json` `build`, `specs/001-revise-document/research.md` DR-001 |
| Ports | Declared next to the use cases that consume them | TSN-2 | `src/application/ports/DocumentStore.ts` |
| Paradigm | class-modeled@1: entity state in `readonly #fields`, collaborators as `private readonly` parameters | PDM-class-modeled-R1, R7 | `src/domain/Document.ts`, `src/application/ReviseDocument.ts` |
| Tier B files | Only `src/main.ts` and `src/infrastructure/config.ts` hold free functions | PDM-class-modeled-R7 | `docs/architecture.md` §7, `eslint.config.mjs` (`tierB`) |
| Port roles | Input port = the use case's public `run()` (no separate interface); gateway port = an explicit interface; no output port (request/response form) | CA-2 | `docs/architecture.md` §4 |
| Data across boundaries | Plain `<UseCase>Input` in, plain `<UseCase>Output` out; the entity never leaves the use case | CA-4 | `src/application/ReviseDocument.ts` (`ReviseDocumentOutput`) |
| Expected failures | `Result` union; thrown `Error` only for the unexpected | TSN-4, TSN-5 | `src/domain/Result.ts` |
| Error to HTTP | One mapper; a `Record` over the error union makes a missing status a compile error | TSN-11, EXP-5 | `src/interface/errors/HttpErrorMapper.ts` |
| Doc comments | TSDoc on every export and public member; contract on the port; each adapter method has its own summary starting `{@link Port.member}`, so the editor shows it plus the port's notes; every parameter and return documented; summaries answer the contract questions | CMT-5, CMT-6, CMT-12, CMT-13, TSN-13 | `src/application/ports/DocumentStore.ts`, `src/infrastructure/InMemoryDocumentStore.ts`, `src/application/ReviseDocument.ts` (`run`) |
| Naming | File name equals the class; suffixes only from the role glossary (`Store`, `Handler`, `Mapper`) | NAM-8, NAM-6 | `docs/glossary.md` |
| Config | Parsed once, frozen, nothing else reads the environment | TSN-9 | `src/infrastructure/config.ts` |
| Logging | One pino logger made in `main.ts` and injected; `no-console` | TSN-10 | `src/main.ts`, `src/CompositionRoot.ts` |
| Tests | Unit tests next to the code; integration tests in `test/integration/`; helpers in `test/support/` via `@/test/*` | testing-strategy | `vitest.config.ts`, `vitest.integration.config.ts` |
| Framework sections of the constitution | Default paradigm, unit-size defaults, no deviations, budgets | constitution-sdlc/v1 | `.specify/memory/constitution.md` |
| Task-line suffixes | `touches:`, `refs:`, `procedure:` (+ `inputs:`) on every `[llm]` task; T002 names `typescript-node/add-port-and-adapter` | task-line/v1, D11 | `specs/001-revise-document/tasks.md` |

## File map

| Path | Role | Shows |
|---|---|---|
| `src/domain/Result.ts` | type | Expected-failure union |
| `src/domain/Document.ts` | entity | Private constructor, static `create`, `#fields`, invariant in `revise` |
| `src/application/ports/DocumentStore.ts` | port | The contract, written once, with `@remarks` and `@returns` |
| `src/application/ReviseDocument.ts` | use case | Constructor injection; a why-comment on the one non-obvious line |
| `src/infrastructure/InMemoryDocumentStore.ts` | adapter | Own summary linking the port member (CMT-12); implementation note as a body comment |
| `src/infrastructure/config.ts` | Tier B | zod config, `@throws` |
| `src/interface/routes/ReviseDocumentBody.ts` | schema | Strict input validation at the boundary |
| `src/interface/routes/ReviseDocumentHandler.ts` | handler | Parse, call one use case, map the result |
| `src/interface/errors/HttpErrorMapper.ts` | mapper | Exhaustive status table; error middleware |
| `src/CompositionRoot.ts` | composition root | The only importer of adapters; the route table |
| `src/main.ts` | Tier B entry | Config, logger, listen |
| `src/**/*.test.ts`, `test/integration/*.int.test.ts` | tests | Unit, concurrency and HTTP tests |
| `eslint.config.mjs` | lint | Every lint rule of the stack, with the flat-config pitfalls handled |
| `eslint/local-docs.mjs` | lint plugin | `specific-summary` (CMT-13 floor) and `implementation-summary` (CMT-12); copy it into each repo |
| `docs/`, `.specify/`, `specs/` | records | Architecture, glossary, constitution, decision records, task plan, as any project has |
| `.github/workflows/check.yml` | CI | `pnpm run check`, then this framework's `validate-project.mjs` at a pinned framework commit |

## How to fetch

Read-only, at the pinned commit. `{{REFERENCE_REPOS_ROOT}}` is defined in `{{AGENT_HOME}}/global-variables.md`.

1. Once: `git clone https://github.com/conanjs/agentic-sdlc-reference-typescript-node "{{REFERENCE_REPOS_ROOT}}/typescript-node"`.
2. Every time: `git -C "{{REFERENCE_REPOS_ROOT}}/typescript-node" fetch --tags --quiet` then `git -C "{{REFERENCE_REPOS_ROOT}}/typescript-node" checkout --quiet 0f899099b469a63262fd113f2b0a88414c08f30e`.
3. To look at one file without cloning: `https://github.com/conanjs/agentic-sdlc-reference-typescript-node/blob/0f899099b469a63262fd113f2b0a88414c08f30e/<path>`.

A role working on another project never edits this clone. A change to the reference is a pull request to its own repo.

## How to check

In the clone: `pnpm install`, then `pnpm run check` (format, lint, typecheck, unit and integration tests, build, smoke import of `dist/`). Then `node {{AGENT_HOME}}/frameworks/agentic-sdlc/tools/validate-project.mjs .`. The repo's CI runs both on every push, the second at a pinned framework commit. A failure means the reference no longer matches the stack's rules; fix the reference or the rule, as a pair of pull requests (below).

## Using it in a repo

1. Copy the configs (`package.json` scripts, `tsconfig*.json`, `vitest*.config.ts`, `eslint.config.mjs`, `.prettierrc.json`) and adjust names.
2. Start feature-first (MOD-9, the default): put the four layer folders inside one folder per feature area, `src/<feature>/{domain,application,infrastructure,interface}/`, with the composition root at `src/`. The pinned code is the layer-first variant until v2.0.0, so read its `src/<layer>/` as `src/<feature>/<layer>/`. Keep the four layers at the top only when the owner opts in to layer-first with a decision record.
3. Record the repo's own decisions (alias Option, paradigm, Tier B files) in its `specs/<feature>/research.md` and `docs/architecture.md`; do not copy this reference's records.
4. Anything done differently goes in the constitution's "style deviations" table.

**Changing a rule that the reference shows:** one pull request in the reference repo (its CI can be pointed at the framework branch with the workflow's `framework-ref` input), then one here that changes the rule and bumps `pinned`, `commit` and `verified` together.

## References

- `idioms.md` — TSN rules and the tested lint snippets this code follows.
- `paradigms/class-modeled.md` — the paradigm overlay.
- `frameworks/express.md` — EXP rules.
- `../../schemas/stack-reference.schema.md` — schema for this file.
- `{{AGENT_CONFIG_REPO}}/proposals/agentic-sdlc-reference-repos-and-procedures.md` — Part A, why the code moved to its own repo.
- [Express 5 error handling](https://expressjs.com/en/guide/error-handling.html) — rejected promises from handlers reach the error middleware.
- [TSDoc](https://tsdoc.org/) — doc-comment syntax.
- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use) — pin a full commit SHA because tags can move.

## Related

- `{{AGENT_HOME}}/procedures/typescript-node/index.md` — step-by-step procedures that produce code shaped like this reference.
- `index.md` — the stack's command slots.
