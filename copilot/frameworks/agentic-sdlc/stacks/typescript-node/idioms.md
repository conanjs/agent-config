---
schema: stack-idioms/v1
last-updated: 2026-10-25
stack: typescript-node
rule-prefix: TSN
---

# Idioms: TypeScript on Node.js (`typescript-node`)

Long form of the `idiom.*` slots in [index.md](index.md). Each idiom shows how stack-agnostic rules are written in TypeScript on Node.js; reusable explanations live in `{{AGENT_HOME}}/knowledge/` and are cited from rule `Source` cells when seeded.

## idiom.errors

Expected domain failures (not found, validation, conflict) are values, returned as a discriminated `Result`. Unexpected failures (I/O, bugs) are thrown as typed `Error` subclasses that keep the original error in `cause`. Never throw strings or plain objects. One mapper in `src/interface/` turns errors into HTTP/CLI responses.

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
| TSN-13 | Exported API carries a TSDoc comment that adds information (contract, errors, side effects) | Every exported type, function and method has a doc comment that is not a paraphrase of its name; param and return tags appear only when they add meaning (CMT-5, CMT-6) | An exported use case has no doc comment, or `@param roleId The role id` | lint | — |
| TSN-14 | TODO and FIXME carry an owner or task id | Every marker looks like `TODO(PROJ-123): ...` (CMT-10) | A bare `// TODO fix later` | script | — |
| TSN-15 | Aliases are `package.json` `imports` entries with a `#` prefix, never `tsconfig` `paths` alone | The same import specifier resolves under Node, the dev runner, the test runner, the lint resolver and the type checker (IMP-4, IMP-7) | `paths` is set, the type checker passes, and the built output fails to load with module-not-found | script | — |
| TSN-16 | No climbing out with `../../`, no cycles | A parent step reaches at most one folder up; the import graph is acyclic (IMP-1, IMP-6) | `import { Role } from "../../../domain/role"` | lint | — |
| TSN-17 | Each layer imports other layers only through their alias entry point | Layer aliases come from `docs/architecture.md` §4; only the composition root imports adapters (IMP-2, IMP-3, PDM-class-modeled-R9) | A use case imports `#infrastructure/pg-user-repo` | lint | — |

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

| Rule | Tool config |
|---|---|
| TSN-1 | `tsc --noEmit`; `tsconfig.json` with `strict: true` and `noUncheckedIndexedAccess: true` |
| TSN-3 | `prettier --check .`; `eslint . --max-warnings 0` |
| TSN-4 | TypeScript discriminated-union narrowing checked by `tsc --noEmit` |
| TSN-5 | ESLint `no-throw-literal` / `@typescript-eslint/only-throw-error` |
| TSN-7 | `@typescript-eslint/no-floating-promises` |
| TSN-10 | ESLint `no-console` scoped to `src/**` |
| TSN-13 | `eslint-plugin-jsdoc`: `jsdoc/require-jsdoc` with `publicOnly: true`; `jsdoc/informative-docs`; set `jsdoc/require-param` and `jsdoc/require-returns` off so tags are written only when they add meaning |
| TSN-14 | CI script: fail on `grep -rnP '\b(TODO\|FIXME)\b(?!\([A-Za-z0-9_-]+\))' src` (ESLint `no-warning-comments` cannot allow a valid format, so use it only for `xxx` and `hack`) |
| TSN-15 | Smoke script: build, then import one aliased module from `dist/` with plain `node`, and once from `src/` under the dev runner with `--conditions=source`. `tsc --noEmit` alone cannot catch this failure; config as in the snippet below |
| TSN-16 | ESLint `no-restricted-imports` with `patterns: [{ regex: "^\\.\\./\\.\\./", message: "Use a #alias" }]`, repeated in every later block that sets `no-restricted-imports` (see the flat-config note below); `import-x/no-cycle`; optionally `import-x/no-relative-parent-imports` for the stricter zero-parent form |
| TSN-17 | ESLint `no-restricted-imports` `patterns` per layer, generated from `docs/architecture.md` §4 (for example `domain` forbids `#application/*`, `#infrastructure/*`, `#interface/*`); adapters allowed only in the composition root block |
| CS-2 (unit size) | ESLint `complexity` and `max-lines-per-function`, or `llm (fallback)` if not configured |
| FF-1 (layer deps) | ESLint `no-restricted-imports`/boundaries rules generated from `docs/architecture.md` §4 |
| FF-2 (cycles) | `import-x/no-cycle` (TSN-16) or a graph script |
| PDM-class-modeled-R7 | ESLint `no-restricted-syntax` allow-list, see `paradigms/class-modeled.md` |

### Import alias and lint configuration

Verified 2026-10-25 on a copy of `rbac-demo` (Node 24.22, TypeScript 6.0, tsx 4.23, Vitest 5.0 on Vite 8, eslint-plugin-import-x 4.17, NodeNext with `.js` relative specifiers). With this config, `tsc --noEmit`, `tsc` build, `node dist/…`, tsx and the full Vitest suite all pass.

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

```ts
// vitest.config.ts: since Vite 6, node-environment tests resolve through `ssr.resolve`,
// and setting conditions replaces Vite's defaults, so list them after "source".
export default defineConfig({
  resolve: { conditions: ["source", "module", "browser", "development|production"] }, // happy-dom/jsdom projects
  ssr: { resolve: { conditions: ["source", "module", "node", "development|production"] } }, // node projects
});
```

Pitfalls found in that check:

| Setup | What happens |
|---|---|
| Vitest with only `resolve.conditions` | Node-environment tests fail: `Cannot find module '#domain/…'` |
| tsx without `--conditions=source`, with `dist/` present | Runs silently against the stale build, mixed with the `src/` files it loaded directly |
| tsx without `--conditions=source`, no `dist/` | `ERR_MODULE_NOT_FOUND` |
| `node --conditions=source` (built-in type stripping) | Fails whenever relative specifiers say `.js`: Node requires the real `.ts` extension and ignores tsconfig. Use tsx unless the repo writes `.ts` specifiers |
| import-x resolver without `conditionNames` | `#…` resolves to `dist/`, so `import-x/no-restricted-paths` zones on `src/` never match: FF-1 **fails open** |
| A later flat-config block sets `no-restricted-imports` again | Its options replace the earlier ones, so the `../../` pattern silently disappears for that folder |

```js
// eslint.config.js (excerpt)
settings: {
  "import-x/resolver-next": [createNodeResolver({
    extensions: [".ts", ".js"],
    extensionAlias: { ".js": [".ts", ".js"] },
    conditionNames: ["source", "import", "node", "default"], // without this, aliased layer violations pass lint
  })],
},
{
  files: ["src/**/*.ts"],
  rules: {
    "no-restricted-imports": ["error", { patterns: [{ regex: "^\\.\\./\\.\\./", message: "Use a #alias (IMP-2)" }] }],
    "import-x/no-cycle": "error",
    "jsdoc/require-jsdoc": ["error", { publicOnly: true }],
    "jsdoc/informative-docs": "warn",
  },
},
```

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

## Related

- [index.md](index.md) - stack slot table.
- [Stack idioms schema](../../../schemas/stack-idioms.schema.md) - required structure for this file.
- [Error handling](../../foundations/code/error-handling.md) - [Clean architecture](../../foundations/design/clean-architecture.md) - [Design principles](../../foundations/design/design-principles.md).
