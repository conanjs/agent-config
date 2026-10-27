---
schema: stack/v2
last-updated: 2026-10-27
id: typescript-node
detect-by: [package.json, pnpm-lock.yaml, tsconfig.json]
frameworks: [express]
paradigms: [class-modeled, functional-pipeline]
---

# Stack: TypeScript on Node.js (`typescript-node`)

**Applies to:** server-side services, CLIs and libraries written in TypeScript and run on Node.js ·

**Detection:** [package.json, pnpm-lock.yaml, tsconfig.json]

**Framework profiles:**
- `frameworks/express.md`

**Paradigm overlays:**
- `paradigms/class-modeled.md`
- `paradigms/functional-pipeline.md`

**Reference implementation:** `reference.md` — pointer to `conanjs/agentic-sdlc-reference-typescript-node`, pinned by tag and commit.

**Procedures:** `{{AGENT_HOME}}/procedures/typescript-node/index.md` — bounded code tasks the planner assigns with a task line's `procedure:` (D11).

## Slots
| Slot | Value |
|---|---|
| `language_version` | Node.js 24 LTS (pinned in `.nvmrc` and `engines.node`); TypeScript current stable major, pinned in `devDependencies`; `"strict": true` |
| `package_manager` | pnpm, pinned per project via `"packageManager": "pnpm@<exact version>"` in `package.json` and dispatched by corepack (bundled with Node ≤ 24; on Node 25+ install it once with `npm install -g corepack`) |
| `project_layout` | `src/domain/` (entities, value objects, ports — no imports from other layers) · `src/application/` (use cases; depends on `domain` only) · `src/infrastructure/` (DB, HTTP clients, queues — implements ports) · `src/interface/` (HTTP routes, CLI, message handlers) · `src/main.ts` (composition root). Unit tests colocated as `*.test.ts`; integration tests in `test/integration/*.int.test.ts` with their own `vitest.integration.config.ts` |
| `style_guide` | https://google.github.io/styleguide/tsguide.html |
| `cmd.install` | `corepack enable && pnpm install --frozen-lockfile` |
| `cmd.format` | `pnpm exec prettier --check .` |
| `cmd.lint` | `pnpm exec eslint . --max-warnings 0` |
| `cmd.typecheck` | `pnpm exec tsc --noEmit` |
| `cmd.test_unit` | `pnpm exec vitest run` |
| `cmd.test_integration` | `pnpm exec vitest run --config vitest.integration.config.ts` |
| `cmd.build` | `pnpm run build` |
| `cmd.audit` | `pnpm audit --audit-level high` |
| `idiom.errors` | Typed `Error` subclasses with `cause`; `Result` union for expected domain failures; never throw strings |
| `idiom.concurrency` | `async`/`await` only; no floating promises (lint-enforced); `AbortSignal` for cancellation and timeouts |
| `idiom.di` | Constructor injection of port interfaces; wiring only in `src/main.ts`; no DI container by default |
| `idiom.config` | Parse and validate `process.env` once at startup into a typed, frozen object; fail fast on invalid config |
| `idiom.logging` | Structured JSON logger created once and injected; child loggers carry request context; never `console.log` in `src/` |
| `ci_template` | see below |
| `tools` | `pnpm, corepack, prettier, eslint, tsc, vitest` |

Notes: `pnpm run build` must be defined in `package.json` (e.g. `"build": "tsc -p tsconfig.build.json && tsc-alias -p tsconfig.build.json"` with the default alias option; plain `tsc -p tsconfig.build.json` with `package.json` `imports`; see idioms "Options"). `vitest.config.ts` must restrict `include` to `src/**/*.test.ts` so `cmd.test_unit` never picks up integration tests. Commands assume a POSIX shell (bash, Git Bash).

## Foundation mapping
| Foundation rule | How it's expressed in this stack |
|---|---|
| `foundations/design/clean-architecture.md` | Layer folders under `src/`; dependency direction enforced by an import-restriction lint rule (e.g. `no-restricted-imports` per folder) |
| `foundations/design/design-principles.md` | Small modules with explicit exports; interfaces declared next to their consumer; composition over class inheritance |
| `foundations/code/error-handling.md` | `idiom.errors`: `Result` for expected failures, typed errors with `cause` for unexpected ones, one error-to-response mapper in `interface/` |
| `foundations/code/coding-standards.md` | `cmd.format` + `cmd.lint` + `cmd.typecheck` with `strict`, `noUncheckedIndexedAccess`; zero warnings allowed |
| `foundations/delivery/testing-strategy.md` | Unit tests on `domain`/`application` with in-memory fakes; integration tests against real adapters via `cmd.test_integration` |
| `foundations/delivery/release-pipeline.md` | CI template below; lockfile frozen; build output in `dist/` from `cmd.build` |
| `foundations/delivery/threat-modeling.md` | `cmd.audit` on every run; validate all input at `interface/` boundary; no secrets in `src/` or logs |

## Reference topics
| Topic | Attach when | Path |
|---|---|---|
| V8 hidden classes | task touches a hot path, or a profile shows megamorphic/deopt sites | {{AGENT_HOME}}/knowledge/js-runtime/v8-hidden-classes.md |
| Promise rejections | task starts background async work or changes process error handlers | {{AGENT_HOME}}/knowledge/js-runtime/promise-rejections.md |
| AbortSignal cancellation | task adds outbound I/O, timeouts or long-running operations | {{AGENT_HOME}}/knowledge/js-runtime/abort-signal.md |
| Structured concurrency | task fans out with Promise.all/allSettled | {{AGENT_HOME}}/knowledge/concurrency/structured-concurrency.md |
| Config at startup | task adds or reads environment variables | {{AGENT_HOME}}/knowledge/operations/config-at-startup.md |
| Structured logging | task adds or changes logging | {{AGENT_HOME}}/knowledge/operations/structured-logging.md |
| HTTP error mapping | task adds an HTTP route or changes error responses | {{AGENT_HOME}}/knowledge/web-apis/http-error-mapping.md |
| Node, corepack, pnpm and yarn dispatch chain | task changes Node version, package manager pinning, corepack setup or install/bootstrap scripts | {{AGENT_HOME}}/knowledge/nodejs/node-nvm-corepack-pnpm-yarn-architecture.md |

## CI template

```yaml
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          package-manager-cache: false
      - run: corepack enable && pnpm install --frozen-lockfile            # cmd.install
      - run: pnpm exec prettier --check .                                  # cmd.format
      - run: pnpm exec eslint . --max-warnings 0                           # cmd.lint
      - run: pnpm exec tsc --noEmit                                        # cmd.typecheck
      - run: pnpm exec vitest run                                          # cmd.test_unit
      - run: pnpm exec vitest run --config vitest.integration.config.ts    # cmd.test_integration
      - run: pnpm run build                                                # cmd.build
      - run: pnpm audit --audit-level high                                 # cmd.audit
```

## Toolchain defaults rationale

- **pnpm via corepack** — content-addressed store and strict `node_modules` stop phantom dependencies; corepack pins the exact pnpm version per repo from `packageManager`, so local and CI use the same binary.
- **prettier** — opinionated formatter with near-zero config, so formatting is never a review topic.
- **eslint** (flat config + typescript-eslint type-aware rules) — the only linter that can enforce type-aware rules such as no floating promises.
- **tsc --noEmit** — the reference type checker; the build may use a faster transpiler, so type checking is a separate gate.
- **vitest** — native TypeScript/ESM support, Jest-compatible API, separate configs for unit and integration runs.
- **pnpm audit** — built into the package manager, reads the lockfile directly, exits non-zero at or above `--audit-level`.

## References

**Local artifacts:**
- `schemas/stack.schema.md`: schema for this stack index.
- `stacks/typescript-node/idioms.md`: long-form idioms for the slot table.

**External authoritative sources:**
- https://nodejs.org/en/about/previous-releases
- https://github.com/nodejs/corepack
- https://pnpm.io/cli/install
- https://pnpm.io/cli/audit
- https://prettier.io/docs/cli
- https://eslint.org/docs/latest/use/command-line-interface
- https://www.typescriptlang.org/docs/handbook/compiler-options.html
- https://vitest.dev/guide/cli
- https://github.com/actions/setup-node

## Related

- [idioms.md](idioms.md) - long-form `idiom.*` slots.
- [Stack schema](../../../schemas/stack.schema.md) - required structure for this file.
- [Clean architecture](../../foundations/design/clean-architecture.md) - [Error handling](../../foundations/code/error-handling.md) - [Testing strategy](../../foundations/delivery/testing-strategy.md).
- Other stacks: [go](../go/index.md) - [python](../python/index.md) - [rust](../rust/index.md).
- [Express framework profile](frameworks/express.md) - HTTP framework rules for Express components.
- Node/corepack/pnpm dispatch chain: `{{AGENT_HOME}}/knowledge/nodejs/node-nvm-corepack-pnpm-yarn-architecture.md`.
