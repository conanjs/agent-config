---
schema: stack-reference/v1
last-updated: 2026-10-26
stack: typescript-node
verified: 2026-10-26
---

# Reference: TypeScript on Node.js

## What it shows

A small Express service with one feature, "revise a document without overwriting a newer change" (`PUT /documents/:id`, optimistic concurrency), built through every layer: entity, port, use case, adapter, HTTP handler, error mapper, composition root, entry point, unit and integration tests. It exists to be read and copied, not deployed. Every file passes the stack's lint, including the documentation and import-path rules.

## Choices

| Concern | Choice | Rule | Where |
|---|---|---|---|
| Layers | `domain`, `application`, `infrastructure`, `interface` under `src/`; composition root outside them | CA rules, FF-1 | `docs/architecture.md` §4 |
| Layer direction | Resolved-path zones, so aliases cannot bypass them | FF-1, TSN-17 | `eslint.config.mjs` (`layerZones`) |
| Import paths | Relative only within one folder; `@/` aliases everywhere else, in `src` and `test` | IMP-1, IMP-2, TSN-16 | `eslint.config.mjs` (`noRelativeOutsideFolder`) |
| Alias mechanism | tsconfig `paths` + `tsc-alias` in the build (stack Option default) | TSN-15 | `tsconfig.json`, `package.json` `build`, `specs/001-revise-document/research.md` DR-001 |
| Ports | Declared next to the use cases that consume them | TSN-2 | `src/application/ports/DocumentStore.ts` |
| Paradigm | class-modeled@1: entity state in `readonly #fields`, collaborators as `private readonly` parameters | PDM-class-modeled-R1, R7 | `src/domain/Document.ts`, `src/application/ReviseDocument.ts` |
| Tier B files | Only `src/main.ts` and `src/infrastructure/config.ts` hold free functions | PDM-class-modeled-R7 | `docs/architecture.md` §7, `eslint.config.mjs` (`tierB`) |
| Port roles | Input port = the use case's public `run()` (no separate interface); gateway port = an explicit interface; no output port (request/response form) | CA-2 | `docs/architecture.md` §4 |
| Data across boundaries | Plain `<UseCase>Input` in, plain `<UseCase>Output` out; the entity never leaves the use case | CA-4 | `src/application/ReviseDocument.ts` (`ReviseDocumentOutput`) |
| Expected failures | `Result` union; thrown `Error` only for the unexpected | TSN-4, TSN-5 | `src/domain/Result.ts` |
| Error to HTTP | One mapper; a `Record` over the error union makes a missing status a compile error | TSN-11, EXP-5 | `src/interface/errors/HttpErrorMapper.ts` |
| Doc comments | TSDoc on every export and public member; contract on the port, `{@inheritDoc}` on the adapter | CMT-5, CMT-12, TSN-13 | `src/application/ports/DocumentStore.ts`, `src/infrastructure/InMemoryDocumentStore.ts` |
| Naming | File name equals the class; suffixes only from the role glossary (`Store`, `Handler`, `Mapper`) | NAM-8, NAM-6 | `docs/glossary.md` |
| Config | Parsed once, frozen, nothing else reads the environment | TSN-9 | `src/infrastructure/config.ts` |
| Logging | One pino logger made in `main.ts` and injected; `no-console` | TSN-10 | `src/main.ts`, `src/CompositionRoot.ts` |
| Tests | Unit tests next to the code; integration tests in `test/integration/`; helpers in `test/support/` via `@/test/*` | testing-strategy | `vitest.config.ts`, `vitest.integration.config.ts` |

## File map

| Path | Role | Shows |
|---|---|---|
| `src/domain/Result.ts` | type | Expected-failure union |
| `src/domain/Document.ts` | entity | Private constructor, static `create`, `#fields`, invariant in `revise` |
| `src/application/ports/DocumentStore.ts` | port | The contract, written once, with `@remarks` and `@returns` |
| `src/application/ReviseDocument.ts` | use case | Constructor injection; a why-comment on the one non-obvious line |
| `src/infrastructure/InMemoryDocumentStore.ts` | adapter | `{@inheritDoc}`; implementation note as a body comment |
| `src/infrastructure/config.ts` | Tier B | zod config, `@throws` |
| `src/interface/routes/ReviseDocumentBody.ts` | schema | Strict input validation at the boundary |
| `src/interface/routes/ReviseDocumentHandler.ts` | handler | Parse, call one use case, map the result |
| `src/interface/errors/HttpErrorMapper.ts` | mapper | Exhaustive status table; error middleware |
| `src/CompositionRoot.ts` | composition root | The only importer of adapters; the route table |
| `src/main.ts` | Tier B entry | Config, logger, listen |
| `src/**/*.test.ts`, `test/integration/*.int.test.ts` | tests | Unit, concurrency and HTTP tests |
| `eslint.config.mjs` | lint | Every lint rule of the stack, with the flat-config pitfalls handled |
| `docs/`, `specs/` | records | Architecture, glossary, decision records, as any project has |

## How to check

From this folder: `pnpm install`, then `pnpm run check`. It runs format, lint, typecheck, unit tests, integration tests, the build and a smoke import of `dist/`. Then `node ../../../tools/validate-project.mjs .` from this folder. A failure means the reference no longer matches the stack's rules; fix the reference or the rule in the same change.

## Using it in a repo

1. Copy the configs (`package.json` scripts, `tsconfig*.json`, `vitest*.config.ts`, `eslint.config.mjs`, `.prettierrc.json`) and adjust names.
2. Keep the four layer folders and the composition root; put the repo's own features in them.
3. Record the repo's own decisions (alias Option, paradigm, Tier B files) in its `specs/<feature>/research.md` and `docs/architecture.md`; do not copy this reference's records.
4. Anything done differently goes in the constitution's "style deviations" table.

## References

- `../idioms.md` — TSN rules and the tested lint snippets this code follows.
- `../paradigms/class-modeled.md` — the paradigm overlay.
- `../frameworks/express.md` — EXP rules.
- `../../../schemas/stack-reference.schema.md` — schema for this file.
- [Express 5 error handling](https://expressjs.com/en/guide/error-handling.html) — rejected promises from handlers reach the error middleware.
- [TSDoc](https://tsdoc.org/) — doc-comment syntax.

## Related

- `{{AGENT_HOME}}/procedures/typescript-node/index.md` — step-by-step procedures that produce code shaped like this reference.
- `../index.md` — the stack's command slots.
