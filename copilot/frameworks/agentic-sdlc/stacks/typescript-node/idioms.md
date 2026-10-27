---
schema: stack-idioms/v1
last-updated: 2026-10-28
stack: typescript-node
rule-prefix: TSN
---

# Idioms: TypeScript on Node.js (`typescript-node`)

Long form of the `idiom.*` slots in [index.md](index.md). Each idiom shows how stack-agnostic rules are written in TypeScript on Node.js; reusable explanations live in `{{AGENT_HOME}}/knowledge/` and are cited from rule `Source` cells when seeded.

## idiom.errors

Expected domain failures (not found, validation, conflict) are values, returned as a discriminated `Result`. Unexpected failures (I/O, bugs) are thrown as typed `Error` subclasses that keep the original error in `cause`. Never throw strings or plain objects. One mapper per module, in its interface ring (`src/modules/<module>/interface/errors/`), turns that module's errors into HTTP or CLI responses; thrown errors go through one shared error middleware in `src/modules/shared/interface/`.

```ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export class RepositoryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RepositoryError";
  }
}

async function findUser(id: string): Promise<Result<User, "not-found">> {
  try {
    const row = await db.users.get(id);
    return row ? { ok: true, value: toUser(row) } : { ok: false, error: "not-found" };
  } catch (err) {
    throw new RepositoryError(`load user ${id}`, { cause: err });
  }
}
```

## idiom.concurrency

Everything asynchronous is `async`/`await`. Every promise is awaited, returned, or explicitly handed to a supervisor — `@typescript-eslint/no-floating-promises` enforces this in `cmd.lint`. Cancellation and timeouts flow through `AbortSignal`; fan-out uses `Promise.all` (fail fast) or `Promise.allSettled` (collect all).

```ts
export async function fetchAll(urls: string[], signal: AbortSignal): Promise<string[]> {
  const timeout = AbortSignal.any([signal, AbortSignal.timeout(5_000)]);
  return Promise.all(
    urls.map(async (url) => {
      const res = await fetch(url, { signal: timeout });
      if (!res.ok) throw new Error(`GET ${url}: ${res.status}`);
      return res.text();
    }),
  );
}
```

## idiom.di

Use cases receive their ports through the constructor. Port interfaces are declared in `domain/` or `application/`; adapters in `infrastructure/` implement them. Only `src/main.ts` knows concrete classes — it is the composition root. Tests pass in-memory fakes.

```ts
// application/register-user.ts
export interface UserRepo { save(u: User): Promise<void> }

export class RegisterUser {
  constructor(private readonly repo: UserRepo, private readonly clock: () => Date) {}
  async run(email: string): Promise<User> {
    const user = User.create(email, this.clock());
    await this.repo.save(user);
    return user;
  }
}

// main.ts
const registerUser = new RegisterUser(new PgUserRepo(pool), () => new Date());
```

## idiom.config

Read `process.env` in exactly one module, validate it with a schema at startup, and export a typed, frozen object. Invalid config crashes the process before it serves traffic. Other modules receive config values through constructors, never by reading `process.env`.

```ts
// infrastructure/config.ts
import { z } from "zod";

const Schema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.string().url(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Config = Readonly<z.infer<typeof Schema>>;
export const loadConfig = (env = process.env): Config => Object.freeze(Schema.parse(env));
```

## idiom.logging

One structured JSON logger is created in `main.ts` and injected. Request handlers derive a child logger carrying correlation fields. Log events, not prose; never log secrets or full payloads; `console.log` is banned in `src/` by lint.

```ts
import pino from "pino";

export const rootLogger = pino({ level: config.LOG_LEVEL, redact: ["req.headers.authorization"] });

function handle(req: Request, log = rootLogger) {
  const reqLog = log.child({ requestId: req.headers.get("x-request-id") });
  reqLog.info({ route: "POST /users" }, "user.register.start");
}
```

## Language conventions

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| TSN-1 | Use strict TypeScript with no unchecked indexed access | `tsconfig.json` enables `strict` and `noUncheckedIndexedAccess` | Code compiles because implicit `any` hides a missing field | typecheck | — |
| TSN-2 | Declare port interfaces next to their consumer | Application code imports abstractions it owns, not adapter concretes | A use case imports `PgUserRepo` directly | llm | — |
| TSN-3 | Use formatter and linter as the style authority | `cmd.format` and `cmd.lint` pass with zero warnings | Formatting or import style is debated in review | lint | — |
| TSN-4 | Return discriminated Results for expected domain failures | Callers narrow on `ok` and handle every expected case | A validation conflict is thrown as a generic Error | typecheck | — |
| TSN-5 | Throw only Error instances for unexpected failures | Thrown values have stack, name and optional `cause` | Code throws a string or plain object | lint | — |
| TSN-6 | Inject use-case dependencies through constructors | A use case can be constructed with fake ports in tests | A use case imports a singleton client | llm | — |
| TSN-13 | Every exported declaration and public member carries a TSDoc comment (`/** … */`), the TypeScript equivalent of C# XML doc comments: summary sentence, then `@remarks`, `@param name - …`, `@returns`, `@throws`, `@example` as needed. A method implementing a port member has its own summary that starts with `{@link Port.member}` and says what this implementation adds (CMT-12), and no block tags, so the editor shows the port's `@param`/`@returns` under it; an extra failure goes in the summary sentence. `{@inheritDoc}` is not used on implementations: the editor shows it as raw text. Implementation notes go in a why-comment in the body | Lint reports nothing for `tsdoc/syntax`, `jsdoc/require-jsdoc`, `jsdoc/informative-docs`, `jsdoc/require-param`, `jsdoc/check-param-names`, `jsdoc/require-returns`, `local-docs/specific-summary` and `local-docs/implementation-summary` (CMT-5, CMT-6, CMT-12, CMT-13) | A port method with no contract; `/** Applies one revision. */` on `ReviseDocument.run`; a public method missing `@param` for one parameter; `@param roleId The role id`; `/** {@inheritDoc DocumentStore.find} */` on an adapter (no visible summary); an adapter method with `@throws` (hides the port's notes in the editor) | lint | — |
| TSN-14 | TODO and FIXME carry an owner or task id | Every marker looks like `TODO(PROJ-123): ...` (CMT-10) | A bare `// TODO fix later` | script | — |
| TSN-15 | Aliases use the repo's chosen mechanism (Options below): tsconfig `paths` with an `@/` prefix plus a build-time rewrite (default), or `package.json` `imports` with a `#` prefix. Never `paths` without the rewrite | The same import specifier resolves under the type checker, the dev runner, the test runner, the lint resolver and `node dist/…` (IMP-4, IMP-7) | `paths` is set, the type checker passes, and the built output fails to load with module-not-found | script | `knowledge/js-runtime/subpath-imports.md` |
| TSN-16 | Relative imports name only same-folder files; everything else uses an alias, in `src` and `test` alike; no cycles | No relative specifier starts with `../` or contains a folder after `./`; the import graph is acyclic (IMP-1, IMP-2, IMP-6) | `../errors.js`, `./http/createApp.js` from a root file, `../support/fixtures.js` in a test | lint | — |
| TSN-17 | Each layer imports other layers only through their alias entry point; in a feature-first repo (MOD-9) the layer rule holds inside every module, a module imports another only through its public files (MOD-3), and `shared/` imports no module | Layer aliases come from `docs/architecture.md` §4; only the composition root imports adapters (IMP-2, IMP-3, PDM-class-modeled-R9) | A use case imports `@/infrastructure/pg-user-repo` | lint | — |
| TSN-18 | No barrel files (IMP-5): no file under `src/` re-exports (`export * from …`, `export { X } from …`). Import the file that declares the symbol; a module's public surface is the list of files in `docs/architecture.md` §4 (MOD-3), checked by lint zones. A published library's entry point, named in `package.json` `exports`, is the only exception | Lint reports nothing for the `noReExports` selectors | `src/modules/documents/index.ts` containing `export * from "./application/ReviseDocument.js"` | lint | `knowledge/js-runtime/barrel-files.md` |
| TSN-19 | HTTP status codes come from the repo's chosen source (Options: "HTTP status-code source") as named constants, never bare numbers, and only in the interface ring (`src/**/interface/**`). Domain and application return `Result` errors; each module's mapper turns them into statuses (TSN-11, EXP-8). Why: a status code is an HTTP delivery detail. A use case states a refusal as a `Result` reason, so the same use case serves a CLI, a queue consumer or another module, each choosing its own exit code, retry or status; and the HTTP mapping stays in one place per module | Lint reports nothing for the `http-status-codes` restriction outside `interface/` | `return { status: 409 }` in a use case; `res.status(404)` with a bare number | lint | `knowledge/web-apis/http-error-mapping.md` |

## Options

Per-repo choices this stack offers. The tech-stack role proposes the default at P4 (TC-Q3), shows the alternatives at the gate, and records the human's choice in the toolchain decision record and in the `alias:` prefixes of `docs/architecture.md` §4.

| Choice | Default | Alternative | Choose the alternative when |
|---|---|---|---|
| Alias mechanism (TSN-15) | **tsconfig `paths`**, prefix `@/`, build rewritten by `tsc-alias` (or a bundler that reads `paths`) | **`package.json` `imports`**, prefix `#` or `#/` | No build-time rewrite wanted, or code runs without a build step (Node type stripping, published library sources) |
| HTTP status-code source (TSN-19) | **`http-status-codes`** (`StatusCodes.CONFLICT`, `getReasonPhrase(409)`): the most installed (about 9.95M downloads/week against 1.27M for `http-status`, npm, week of 2026-06-25), and the form most developers and models know | `http-status` (`status.CONFLICT`, `status[409]`); hand-written constants; `node:http` `STATUS_CODES` | `http-status`: the API needs codes outside the IANA registry (`status.extra`) or a toolchain that rejects packages without an `exports` map. Hand-written: a tiny service with a few codes and zero dependencies. `STATUS_CODES`: only reason phrases are needed |

## Runtime & performance

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| TSN-7 | Do not leave promises floating | Every promise is awaited, returned or intentionally supervised | An async call is started without awaiting it | lint | `knowledge/js-runtime/promise-rejections.md` |
| TSN-8 | Propagate cancellation with AbortSignal | Outbound I/O and timeouts accept a signal | A request keeps running after its caller timed out | llm | `knowledge/js-runtime/abort-signal.md` |
| TSN-9 | Read and validate environment variables once at startup | Runtime config is a typed frozen object passed to constructors | Business logic reads `process.env` directly | llm | `knowledge/operations/config-at-startup.md` |
| TSN-10 | Use structured logging and ban console output in source | Logs carry stable event names and structured fields | A handler uses `console.log` with prose or secrets | lint | `knowledge/operations/structured-logging.md` |
| TSN-11 | Keep HTTP error mapping in one interface-layer mapper | Handlers call the mapper instead of choosing status codes ad hoc | Two handlers map the same domain error differently | llm | `knowledge/web-apis/http-error-mapping.md` |
| TSN-12 | In hot paths, keep object shapes stable and initialize all fields in the constructor | Objects of one type receive the same fields in the same order before use | A loop adds `obj.extra = value` after construction | llm | `knowledge/js-runtime/v8-hidden-classes.md` |

## Enforcement

A project fails `tools/validate-project.mjs` unless the first config file found contains every string under `require`, plus the strings under each `require-if` whose file has that key. This makes the documentation (CMT-5, CMT-12) and import-path (IMP-1, IMP-2) rules part of every repo on this stack, not something each author remembers.

```lint-baseline
config: eslint.config.mjs | eslint.config.js | eslint.config.ts
require:
  - tsdoc/syntax
  - jsdoc/require-jsdoc
  - jsdoc/informative-docs
  - jsdoc/require-param
  - jsdoc/require-returns
  - local-docs/specific-summary
  - local-docs/implementation-summary
  - noReExports
  - noRelativeOutsideFolder
  - import-x/no-cycle
  - import-x/extensions
  - @typescript-eslint/no-extraneous-class
require-if: tsconfig.json paths
  - createTypeScriptImportResolver
require-if: package.json imports
  - conditionNames
```


| Rule | Tool config |
|---|---|
| TSN-1 | `tsc --noEmit`; `tsconfig.json` with `strict: true` and `noUncheckedIndexedAccess: true` |
| TSN-3 | `prettier --check .`; `eslint . --max-warnings 0` |
| TSN-4 | TypeScript discriminated-union narrowing checked by `tsc --noEmit` |
| TSN-5 | ESLint `no-throw-literal` / `@typescript-eslint/only-throw-error` |
| TSN-7 | `@typescript-eslint/no-floating-promises` |
| TSN-10 | ESLint `no-console` scoped to `src/**` |
| TSN-13 | `eslint-plugin-tsdoc` (`tsdoc/syntax`) plus `eslint-plugin-jsdoc` in `typescript` mode: `jsdoc/require-jsdoc` (`publicOnly`, classes, methods, functions, getters, and the TS contexts in the snippet below) and `jsdoc/informative-docs`, plus `jsdoc/require-param`, `require-param-description`, `check-param-names`, `require-returns` and `require-returns-description` (CMT-6: every parameter and non-void return documented, C# parity with StyleCop SA1611/SA1615). Getters are exempt from `require-returns` (the summary describes the value), and so is a method of a class that `implements` an interface whose comment links `{@link Port.member}`, through a context plus `comment` selector, because the editor shows the port's notes there (CMT-12). Two rules from a small local plugin, copied from the stack reference's `eslint/local-docs.mjs`: `local-docs/implementation-summary` (CMT-12) uses type information to find methods that implement an interface member, and fails one documented only with `{@inheritDoc}`, one without a link to its contract, or one with a block tag; `local-docs/specific-summary` (CMT-13) fails a method or function summary with fewer than three words left after removing stop words and the member, class and interface names. Snippet: "Documentation lint configuration" below |
| TSN-14 | CI script: fail on `grep -rnP '\b(TODO\|FIXME)\b(?!\([A-Za-z0-9_-]+\))' src` (ESLint `no-warning-comments` cannot allow a valid format, so use it only for `xxx` and `hack`) |
| TSN-15 | Smoke script: build, then import one aliased module from `dist/` with plain `node`, and once from `src/` under the dev runner. `tsc --noEmit` alone cannot catch this failure; config per option in "Import alias and lint configuration" below |
| IMP-1, IMP-2 | TSN-16 configuration: relative paths only within the folder, aliases everywhere else |
| TSN-16 | ESLint `no-restricted-imports` with the `noRelativeOutsideFolder` pattern from the snippet below, on `src/**` and `test/**`, repeated in every later block that sets `no-restricted-imports` (see the flat-config note below); `import-x/no-cycle`. Exceptions (root tool config, pre-build scripts) only by file name, mirroring `docs/architecture.md` §4 |
| TSN-17 | ESLint `no-restricted-imports` `patterns` per layer, generated from `docs/architecture.md` §4 (for example `domain` forbids `@/application/*`, `@/infrastructure/*`, `@/interface/*`); adapters allowed only in the composition root block. Feature-first (MOD-9): `import-x/no-restricted-paths` with layer zones per module and module zones, snippet "Module-boundary lint configuration" below |
| TSN-18 | ESLint `no-restricted-syntax` selectors `ExportAllDeclaration` and `ExportNamedDeclaration[source]` (the `noReExports` list in the snippet below), added to **every** block that sets `no-restricted-syntax`, including a block for the Tier B files, because a later block's options replace earlier ones |
| TSN-19 | ESLint `no-restricted-imports` `paths: [{ name: "http-status-codes" }]` in a block for `src/**/*.ts` that ignores `src/modules/*/interface/**` (`src/interface/**` in an opted-in layer-first repo) and tests, repeating `patterns: [noRelativeOutsideFolder]` because a later block's options replace earlier ones. Snippet: "Status-code lint configuration" below |
| CS-2 (unit size) | ESLint `complexity` and `max-lines-per-function`, or `llm (fallback)` if not configured |
| FF-1 (layer deps) | ESLint `no-restricted-imports`/boundaries rules generated from `docs/architecture.md` §4 |
| FF-2 (cycles) | `import-x/no-cycle` (TSN-16) or a graph script |
| PDM-class-modeled-R7 | ESLint `no-restricted-syntax` allow-list, see `paradigms/class-modeled.md` |

### Import alias and lint configuration

A complete project using option B and every snippet in this file: the stack reference repo, pinned in `reference.md`.

Both options were verified on 2026-10-25 with Node 24.22, TypeScript 6.0, tsx 4.23, Vitest 5.0 on Vite 8, ESLint 10, eslint-plugin-import-x 4.17, NodeNext with `.js` relative specifiers. Option A on a copy of `rbac-demo` (full suite passing); option B on a small ESM project, step by step in the table under its config.

**Shared by both options:** the relative-path rule, the cycle rule, and the setting that lets import-x parse `.ts` files.

```js
// eslint.config.js (excerpt)
const noRelativeOutsideFolder = { regex: "^(\.\./|\./[^/]+/)", message: "Use an alias (IMP-1)" };
settings: {
  "import-x/extensions": [".ts", ".js"], // without this, import-x/no-cycle silently reports nothing
  "import-x/resolver-next": [/* the option's resolver, below */],
},
{
  files: ["src/**/*.ts", "test/**/*.ts"],
  rules: {
    // Spread this pattern into every later block that sets no-restricted-imports.
    "no-restricted-imports": ["error", { patterns: [noRelativeOutsideFolder] }],
    "import-x/no-cycle": "error",
  },
},
```

#### Option B (default): tsconfig `paths` + `tsc-alias`

```jsonc
// tsconfig.json: include the test files, or Vitest ignores the paths for them
{ "compilerOptions": { "module": "nodenext", "moduleResolution": "nodenext", "paths": { "@/test/*": ["./test/*"], "@/*": ["./src/*"] } },
  "include": ["src", "test"] }
// package.json scripts
{ "build": "tsc -p tsconfig.build.json && tsc-alias -p tsconfig.build.json",
  "dev": "tsx watch src/main.ts" }  // tsx reads tsconfig paths itself
// Specifiers keep the NodeNext extension: `@/core/domain/role.js`.
```

```ts
// vitest.config.ts
export default defineConfig({ resolve: { tsconfigPaths: true } });
```

```js
// eslint.config.js: resolve through tsconfig, so aliased imports reach the boundary and cycle rules
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
settings: { "import-x/resolver-next": [createTypeScriptImportResolver({ project: "tsconfig.json" })] },
```

| Step | Without the setting | With it |
|---|---|---|
| `tsc --noEmit`, `tsx src/main.ts` | Pass | — |
| Vitest | `Cannot find package '@/core/role.js'` | Pass with `resolve.tsconfigPaths: true` and tests in `include` |
| `node dist/main.js` after `tsc` | `ERR_MODULE_NOT_FOUND: Cannot find package '@/core'`: `dist/` still says `@/core/role.js` | Pass after `tsc-alias`, which rewrites it to `./core/role.js` |
| ESLint with the Node resolver | An aliased cycle and an aliased `http → store` import both pass: FF-1 and FF-2 **fail open** | Both reported with `createTypeScriptImportResolver` |

`tsconfig-paths` is a different tool: it resolves `paths` at runtime through a `require` hook (`node -r tsconfig-paths/register`, with `TS_NODE_BASEURL=./dist` for built output). Its README documents only that CommonJS route, so it is not used here. NestJS uses the same build-time approach as this option: its CLI rewrites `paths` aliases while compiling.

#### Option A: `package.json` `imports`

```jsonc
// package.json
{
  "type": "module",
  "imports": {
    "#domain/*": { "source": "./src/domain/*.ts", "default": "./dist/domain/*.js" },
    "#application/*": { "source": "./src/application/*.ts", "default": "./dist/application/*.js" }
  },
  "scripts": {
    // Every tsx entry needs the condition, including `node --import tsx …` and child processes that tests spawn.
    "dev": "tsx watch --conditions=source src/main.ts"
  }
}
// tsconfig.json: "moduleResolution": "nodenext", "rootDir": "./src", "outDir": "./dist", "customConditions": ["source"]
// Specifiers carry no extension: `#domain/role` (the pattern adds `.ts` or `.js`).
```

The snippet above maps layer folders (an opted-in layer-first repo). For the default feature-first layout, one key covers all of `src/`, plus one for test helpers:

```jsonc
// package.json (feature-first, MOD-9). "#/" keys need Node ≥ 24.14.
"imports": {
  "#/*": { "source": "./src/*.ts", "default": "./dist/*.js" },
  "#test/*": "./test/*.ts"
}
// imports read: "#/modules/documents/application/ReviseDocument", "#/CompositionRoot", "#test/support/results"
// build is plain `tsc -p tsconfig.build.json` (no tsc-alias); dist keeps "#/…" and Node resolves it through "default".
```

Verified 2026-10-28 on a throwaway copy of the stack reference v3.0.0 (Node 24.22, TypeScript 6.0, tsx 4.23, Vitest 5, ESLint 10, eslint-plugin-import-x 4.17), converted to this option: `tsconfig` `paths` removed and `customConditions: ["source"]` added, Vitest `ssr.resolve.conditions` as below, the import-x node resolver with `conditionNames` as below, and every `@/….js` import rewritten to `#/…`. Format, lint, typecheck, 7 unit and 5 integration tests, the build and the `dist/` smoke import all passed. The module-boundary zones still reported a seeded `#/modules/documents/domain/Document` import from another module and a seeded `domain → application` import. `tsx --conditions=source src/main.ts` served a request (404 problem body); without the condition and with no `dist/`, tsx failed with `ERR_MODULE_NOT_FOUND`, as the pitfall table says.

```ts
// vitest.config.ts: since Vite 6, node-environment tests resolve through `ssr.resolve`,
// and setting conditions replaces Vite's defaults, so list them after "source".
export default defineConfig({
  resolve: { conditions: ["source", "module", "browser", "development|production"] }, // happy-dom/jsdom projects
  ssr: { resolve: { conditions: ["source", "module", "node", "development|production"] } }, // node projects
});
```

```js
// eslint.config.js
settings: {
  "import-x/resolver-next": [createNodeResolver({
    extensions: [".ts", ".js"],
    extensionAlias: { ".js": [".ts", ".js"] },
    conditionNames: ["source", "import", "node", "default"], // without this, aliased layer violations pass lint
  })],
},
```

Node requires every `imports` key to start with `#`, "to ensure they are disambiguated from external package specifiers"; since Node 24.14 a key may also start with `#/`. This `#` is unrelated to `#private` class fields. Detail: `knowledge/js-runtime/subpath-imports.md`.

**Pitfalls**

| Option | Setup | What happens |
|---|---|---|
| Both | import-x without `import-x/extensions` (or `import-x/parsers`) for `.ts` | `import-x/no-cycle` reports nothing, even for a direct two-file cycle |
| Both | A later flat-config block sets `no-restricted-imports` again | Its options replace the earlier ones, so the relative-path pattern silently disappears for that folder |
| B | tsconfig without the test files in `include` | Vitest cannot resolve aliases in tests, even with `resolve.tsconfigPaths` |
| B | Build without `tsc-alias` | Type check and dev pass; the built app fails to start |
| A | Vitest with only `resolve.conditions` | Node-environment tests fail: `Cannot find module '#domain/…'` |
| A | tsx without `--conditions=source`, with `dist/` present | Runs silently against the stale build, mixed with the `src/` files it loaded directly |
| A | tsx without `--conditions=source`, no `dist/` | `ERR_MODULE_NOT_FOUND` |
| A | `node --conditions=source` (built-in type stripping) | Fails whenever relative specifiers say `.js`: Node requires the real `.ts` extension and ignores tsconfig. Use tsx unless the repo writes `.ts` specifiers |
| A | import-x resolver without `conditionNames` | `#…` resolves to `dist/`, so `import-x/no-restricted-paths` zones on `src/` never match: FF-1 **fails open** |
| Both | A glob zone without a trailing `/**` (`target: "./src/modules/*/domain"`) | import-x matches a glob against the full file path, so a bare folder glob matches no file: the zone **fails open**. A plain path (`"./src/domain"`) matches everything under it; a glob needs `"./src/modules/*/domain/**"`. Found 2026-10-27 in the reference (eslint-plugin-import-x 4.17) when a seeded `domain → application` import passed |

### Module-boundary lint configuration (feature-first, MOD-3, MOD-9)

Verified 2026-10-27 in the stack reference v2.0.0 and again on 2026-10-28 in v3.0.0, with modules under `src/modules/` (eslint-plugin-import-x 4.17): seeded imports of another module's `domain/` and `application/ports/`, of the composition root from a module, of a module from `shared/`, and `domain → application` and `application → infrastructure` inside a module were each reported; an import of another module's public use case passed.

```js
// eslint.config.mjs (excerpt): layers inside every module, then module-to-module rules.
import { readdirSync } from "node:fs";
const modules = readdirSync("src/modules", { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== "shared").map((d) => d.name);
const layerZones = [   // globs end in /** (see the pitfall table above)
  { target: "./src/modules/*/domain/**", from: ["./src/modules/*/application/**", "./src/modules/*/infrastructure/**", "./src/modules/*/interface/**"] },
  { target: "./src/modules/*/application/**", from: ["./src/modules/*/infrastructure/**", "./src/modules/*/interface/**"] },
  { target: "./src/modules/*/infrastructure/**", from: ["./src/modules/*/interface/**"] },
  { target: "./src/modules/*/interface/**", from: ["./src/modules/*/infrastructure/**"] },
  { target: ["./src/!(CompositionRoot|main).ts", "./src/modules/*/**"], from: ["./src/CompositionRoot.ts", "./src/main.ts"] },
];
const moduleZones = [
  ...modules.flatMap((target) => modules.filter((from) => from !== target).flatMap((from) => [
    { target: `./src/modules/${target}`, from: `./src/modules/${from}`, except: ["./application"], message: `${target} may import only ${from}/application (MOD-3)` },
    { target: `./src/modules/${target}`, from: `./src/modules/${from}/application/ports`, message: `Ports of ${from} are not public (MOD-3)` },
  ])),
  ...modules.map((from) => ({ target: "./src/modules/shared", from: `./src/modules/${from}`, message: "shared/ imports no feature module (MOD-4)" })),
];
// rules: { "import-x/no-restricted-paths": ["error", { zones: [...layerZones, ...moduleZones] }] }
```

### Status-code lint configuration (TSN-19)

Verified 2026-10-27 in the stack reference v2.1.0 (ESLint 10, `http-status-codes` 2.3.0 under NodeNext ESM: `import { StatusCodes, getReasonPhrase } from "http-status-codes"` typechecks and runs). A seeded import in `documents/application/` was reported, and a seeded `../` import in the same file still was, so the repeated pattern works.

```js
// eslint.config.mjs (excerpt), after the block that sets noRelativeOutsideFolder for src and test
{
  files: ["src/**/*.ts"],
  ignores: ["src/modules/*/interface/**", "src/**/*.test.ts"],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [noRelativeOutsideFolder],
      paths: [{ name: "http-status-codes", message: "Status codes belong to the interface ring; return a Result error (TSN-19)" }],
    }],
  },
},
```

### Documentation lint configuration

Verified 2026-10-25 on a copy of `rbac-demo` with ESLint 10, eslint-plugin-jsdoc 65.4 and eslint-plugin-tsdoc 0.5. It found every undocumented port member, exported constant and public method (232 in that repo), plus 3 TSDoc syntax errors.

```js
// eslint.config.js (excerpt): C#-parity documentation for TypeScript (TSN-13, CMT-5, CMT-12)
import jsdoc from "eslint-plugin-jsdoc";
import tsdoc from "eslint-plugin-tsdoc";
import localDocs from "./eslint/local-docs.mjs"; // copied from the stack reference
{
  files: ["src/**/*.ts"],
  plugins: { jsdoc, tsdoc, "local-docs": localDocs },
  settings: { jsdoc: { mode: "typescript" } },
  rules: {
    "tsdoc/syntax": "error",
    // CMT-13: a summary must add facts beyond the member and class names.
    "local-docs/specific-summary": ["error", { minWords: 3 }],
    // CMT-12: an implementation has its own summary and links the contract it fulfils.
    "local-docs/implementation-summary": "error",
    "jsdoc/require-jsdoc": ["error", {
      publicOnly: true,
      require: { ClassDeclaration: true, MethodDefinition: true, FunctionDeclaration: true },
      checkGetters: true,
      contexts: ["TSInterfaceDeclaration", "TSTypeAliasDeclaration", "TSMethodSignature",
                 "TSPropertySignature", "ExportNamedDeclaration > VariableDeclaration"],
    }],
    "jsdoc/informative-docs": "error",
    // CMT-6: every parameter and non-void return documented; an implementation that links its contract inherits them (CMT-12).
    "jsdoc/require-param": ["error", { checkDestructured: false, contexts: notInheriting }],
    "jsdoc/require-param-description": "error",
    "jsdoc/check-param-names": "error",
    "jsdoc/require-returns": ["error", { forceReturnsWithAsync: true, checkGetters: false, contexts: notInheriting }],
    "jsdoc/require-returns-description": "error",
  },
},
// defined above the config array:
const implementing = "ClassDeclaration[implements.length>0] > ClassBody > MethodDefinition > FunctionExpression";
const notInheriting = [
  { context: "ArrowFunctionExpression" },
  { context: "FunctionDeclaration" },
  { context: `FunctionExpression:not(${implementing})` },
  { context: implementing, comment: 'JsdocBlock:not(:has(JsdocInlineTag[tag="link"][namepathOrURL=/\\./]))' },
];
// TSN-18: spread into every block that sets no-restricted-syntax (a later block's options replace earlier ones).
const noReExports = [
  { selector: "ExportAllDeclaration", message: "No re-exports: import the declaring file (TSN-18)" },
  { selector: "ExportNamedDeclaration[source]", message: "No re-exports: import the declaring file (TSN-18)" },
];
```

The `require-param` / `require-returns` additions were verified on 2026-10-27 in the stack reference (eslint-plugin-jsdoc 65.4): with the rules on, 12 gaps were reported; the `comment` selector removed exactly the 5 on `{@inheritDoc}`-only adapters; a removed `@param` and a misnamed `@param` were each reported. `local-docs/specific-summary` was verified the same day there: it inspected all 15 method and function summaries and reported only `Applies one revision.` on `ReviseDocument.run`. `local-docs/implementation-summary` and `noReExports` were verified there later that day: they reported both `{@inheritDoc}`-only adapter methods, a seeded adapter summary without its link, a seeded `@throws` on an adapter, and a seeded `export { X } from` and `export * from`; with the adapters rewritten, lint is clean and `require-param` no longer reports them.

| C# XML doc | TSDoc | Note |
|---|---|---|
| `/// <summary>…</summary>` | first sentence of `/** … */` | Required on every public declaration |
| `<remarks>` | `@remarks` | |
| `<param name="id">` | `@param id - …` | The hyphen is required by `tsdoc/syntax` |
| `<returns>` | `@returns` | |
| `<exception cref="X">` | `@throws X when …` | One per expected failure |
| `<example>` | `@example` | |
| `<inheritdoc cref="Port.M"/>` | Not used on implementations: own summary starting `{@link Port.member}`, no block tags | `{@inheritDoc Port.member}` is valid TSDoc and TypeDoc resolves it, but the editor shows it as raw text, and TSDoc forbids a summary beside it (`tsdoc-inheritdoc-incompatible-summary`). The editor inherits the port's `@param`/`@returns` only while the implementation has no block tag (measured below) |
| `<see cref>` | `{@link X}` | |

What lint cannot judge: `jsdoc/informative-docs` rejects `/** The update. */` on `update()`, but accepts `/** Gets the probe adapter. */`, and it compares a summary with its own symbol only, so `/** Applies one revision. */` on `ReviseDocument.run` passes it. `local-docs/specific-summary` closes that case by also removing the class and interface names, but it is a floor: it counts words, so a long vague summary still passes. Whether a summary states a real contract stays an `llm` review check (RUB-10, the swap test in CMT-13).

An adapter method with its own summary, linking its port's contract (CMT-12):

```ts
/** {@link DocumentStore} backed by one SQLite file. */
export class SqliteDocumentStore implements DocumentStore {
  /**
   * {@link DocumentStore.update} in one SQLite transaction, durable once it resolves; rejects with
   * `SqliteError` when the file stays locked past the busy timeout.
   */
  public async update(id: DocumentId, body: string, expectedVersion: number): Promise<Document> {
    // One transaction, so the version check and the write cannot interleave with another writer.
    …
  }
}
```

What the editor shows on hover over the adapter's method, measured on 2026-10-27 with the TypeScript 6.0.3 language service (the API editors call) on `InMemoryDocumentStore.find` in the stack reference:

| Adapter comment | Summary shown | `@param` / `@returns` shown |
|---|---|---|
| `/** {@inheritDoc DocumentStore.find} */` (the form used until 2026-10-27) | `{@inheritDoc DocumentStore.find}`, raw text | The port's |
| No comment | The port's summary | The port's |
| Own summary starting `{@link DocumentStore.find}`, no block tags (current form) | The adapter's own summary | The port's |
| Own summary plus `@see` or `@throws` | The adapter's own summary | None |
| Own summary plus `{@inheritDoc}` | Rejected by `tsdoc/syntax` (`tsdoc-inheritdoc-incompatible-summary`) | — |

The earlier note here called the first row a "known gap, accepted"; the current form removes the gap. Unverified: whether TypeDoc fills in `@param`/`@returns` for a member that has its own summary; its documentation does not say, and the reference does not generate TypeDoc output.

## References

**Local artifacts:**
- `stacks/typescript-node/index.md`: slot table that points to these idioms.
- `schemas/stack-idioms.schema.md`: schema for this file.

**External authoritative sources:**
- https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause
- https://typescript-eslint.io/rules/no-floating-promises/
- https://nodejs.org/api/globals.html#class-abortsignal
- https://zod.dev/
- https://getpino.io/
- https://nodejs.org/api/packages.html#subpath-imports
- https://www.typescriptlang.org/docs/handbook/modules/reference.html
- https://www.typescriptlang.org/tsconfig/
- https://vite.dev/config/shared-options
- https://v6.vite.dev/guide/migration — "`ssr.resolve.conditions` no longer uses `resolve.conditions` as the default value"
- https://nodejs.org/api/typescript.html — type stripping: file extensions are mandatory; tsconfig `paths` unsupported
- https://eslint.org/docs/latest/use/configure/rules — a later config object's rule options replace earlier ones
- https://tsx.is/
- https://github.com/gajus/eslint-plugin-jsdoc
- https://github.com/un-ts/eslint-plugin-import-x
- https://eslint.org/docs/latest/rules/no-restricted-imports
- https://eslint.org/docs/latest/rules/no-warning-comments
- https://tsdoc.org/
- https://tsdoc.org/pages/packages/eslint-plugin-tsdoc/
- https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-jsdoc.md
- https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/xmldoc/recommended-tags
- https://nodejs.org/api/packages.html#self-referencing-a-package-using-its-name
- https://github.com/justkey007/tsc-alias — rewrites `paths` aliases in emitted JavaScript (option B)
- https://github.com/import-js/eslint-import-resolver-typescript — resolves `paths` for import-x (option B)
- https://github.com/dividab/tsconfig-paths — runtime `require` hook; documented for CommonJS only
- https://docs.nestjs.com/cli/libraries — NestJS maps aliases "through tsconfig path mapping"
- https://github.com/nestjs/nest-cli/blob/master/lib/compiler/hooks/tsconfig-paths.hook.ts — the Nest CLI rewrites aliases at build time
- https://tsdoc.org/pages/tags/inheritdoc/ — what `{@inheritDoc}` copies; no summary or `@remarks` beside it
- https://typedoc.org/documents/Tags.__inheritDoc_.html — TypeDoc accepts inline and block forms
- https://www.npmjs.com/package/http-status-codes — the default status-code source (TSN-19 Option)
- https://www.npmjs.com/package/http-status — the alternative with `status.extra` (TSN-19 Option)
- https://marvinh.dev/blog/speeding-up-javascript-ecosystem-part-7/ — barrels make tools load large module graphs (TSN-18)
- https://www.atlassian.com/blog/atlassian-engineering/faster-builds-when-removing-barrel-files — about 75% fewer CI build minutes after removing barrels (TSN-18)

## Related

- [index.md](index.md) - stack slot table.
- [Stack idioms schema](../../../schemas/stack-idioms.schema.md) - required structure for this file.
- [Error handling](../../foundations/code/error-handling.md) - [Clean architecture](../../foundations/design/clean-architecture.md) - [Design principles](../../foundations/design/design-principles.md).
