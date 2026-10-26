---
schema: repo-architecture/v2
last-updated: 2026-10-26
updated-by: specs/001-revise-document
---

# Architecture: typescript-node reference

## 1. Overview

The reference implementation of the `typescript-node` stack: one small HTTP service that lets a caller revise a document without overwriting a newer change by someone else (optimistic concurrency). It exists to show every stack choice in working code, not to be deployed. Risk tier: LOW.

## 2. System context

> _Standalone repo._

## 3. Components

```yaml
components:
  - {
      name: api,
      path: ./,
      kind: service,
      stack: typescript-node,
      framework: express,
      paradigm: class-modeled@1,
      decisions: [DR-001, PDM-api],
    }
```

One package, one deployable. `api` covers `src/` and `test/`. `scripts/smoke-aliases.mjs` is the only script.

## 4. Layers & dependency rules

```yaml
layers:
  - { name: domain, path: src/domain/, may-depend-on: [], alias: "@/domain/" }
  - { name: application, path: src/application/, may-depend-on: [domain], alias: "@/application/" }
  - {
      name: infrastructure,
      path: src/infrastructure/,
      may-depend-on: [application, domain],
      alias: "@/infrastructure/",
    }
  - {
      name: interface,
      path: src/interface/,
      may-depend-on: [application, domain],
      alias: "@/interface/",
    }
```

- Direction: `interface -> application -> domain`, and `infrastructure -> application, domain` (adapters implement ports declared in `application/ports/`). No other edges, no cycles.
- Ports, by role:
  - **Input port:** the public `run()` of each use case. There is no separate interface; the controller depends on the use-case class.
  - **Gateway port:** an explicit interface in `application/ports/` (`DocumentStore`).
  - **Output port:** none. A use case returns a plain output model (`ReviseDocumentOutput`), and the handler presents it.
    This is the request/response form, chosen on purpose. Extract an input-port interface when a second implementation must stand in for a use case (a controller-test fake, a decorator). Add an output port when one use case must feed several presenters or push results asynchronously.
- Data across boundaries is plain in both directions: use cases take `<UseCase>Input` and return `<UseCase>Output`, and entities never leave `application/` (CA-4).
- The composition root sits outside the layers: `src/CompositionRoot.ts` is the only file that imports adapters, and `src/main.ts` only starts the process.
- Aliases use tsconfig `paths` (`@/*` to `src/*`, `@/test/*` to `test/*`), rewritten in the build by `tsc-alias` (DR-001). A relative path names only a file in the same folder (IMP-1).
- Allowed exceptions to the alias rule: `scripts/smoke-aliases.mjs` (runs against `dist/`), and the root tool configs (`eslint.config.mjs`, `vitest.config.ts`, `vitest.integration.config.ts`).
- Enforced by `eslint.config.mjs`: `import-x/no-restricted-paths` zones (FF-1, resolved through the aliases), `import-x/no-cycle` (FF-2), and `no-restricted-imports` with `noRelativeOutsideFolder` (IMP-1). Test files are outside the layer zones, so a use-case test may use the in-memory adapter as its fake.

## 5. Data

| Store         | Kind                    | Owned entities | Notes                                                                              |
| ------------- | ----------------------- | -------------- | ---------------------------------------------------------------------------------- |
| In-memory map | `InMemoryDocumentStore` | `Document`     | Lost on restart. The version check and the write run with no `await` between them. |

## 6. External dependencies

| Dependency | Kind | Used for                                                                           | Doc |
| ---------- | ---- | ---------------------------------------------------------------------------------- | --- |
| none       | n/a  | Libraries only: express (HTTP), zod (input and config validation), pino (logging). | n/a |

## 7. Cross-cutting concerns

- **Config:** `src/infrastructure/config.ts` validates `PORT` and `LOG_LEVEL` once at startup and freezes the result (TSN-9).
- **Logging:** one pino logger created in `main.ts` and injected; `no-console` in lint (TSN-10).
- **Errors:** expected failures are `Result` values; `HttpErrorMapper` is the single place that turns them, and thrown errors, into HTTP responses (TSN-11, EXP-5).
- **Input validation:** zod schema `ReviseDocumentBody` at the HTTP boundary, strict (EXP-7).
- Tier B files: `src/main.ts` (process entry point), `src/infrastructure/config.ts` (config declaration). Everything else is Tier A (classes); lint enforces the list (PDM-class-modeled-R7).

## 8. Key decisions

| Id      | Topic                                   | Where                                 |
| ------- | --------------------------------------- | ------------------------------------- |
| DR-001  | Toolchain and alias mechanism for `api` | specs/001-revise-document/research.md |
| PDM-api | Paradigm for `api`                      | specs/001-revise-document/research.md |

## 9. Verification status

| Check                                                                                                                                     | Last run   | Result |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| `pnpm run check` (format, lint, typecheck, unit, integration, build, smoke)                                                               | 2026-10-26 | pass   |
| Lint catches seeded violations (relative path, cycle, layer zone, adapter import, R1, R7, missing doc, `@remarks` beside `{@inheritDoc}`) | 2026-10-26 | pass   |
| `validate-project.mjs`                                                                                                                    | 2026-10-26 | pass   |

## 10. Known gaps / out of scope

- No persistent store, authentication, or create/read endpoints: the reference shows one write path through every layer, nothing more.
- No CI workflow in this folder; run `pnpm run check` locally.
