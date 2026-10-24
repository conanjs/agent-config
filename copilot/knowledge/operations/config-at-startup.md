---
schema: knowledge-doc/v1
type: concept
topic: operations
status: verified
applies-to: ["TypeScript", "Python", "Go", "12-factor services"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [configuration, environment, startup, validation]
---

# Configuration at startup

## Summary
**TL;DR:** Store deploy-varying config in environment variables, validate it once at process startup, then pass typed immutable config objects to the code that needs them ✅[^1]
**Use this when:** Use this when designing service startup, replacing scattered `process.env` or `os.environ` reads, or aligning TypeScript, Python, and Go services ✅[^1]
**Not this doc:** Use `operations/structured-logging.md` for logger setup and redaction.

## Problem
The Twelve-Factor App defines config as values that vary between deploys, such as backing-service handles, credentials, and per-deploy hostnames ✅[^1]
Twelve-Factor requires strict separation between config and code, and it recommends storing config in environment variables ✅[^1]
Deep modules that read environment variables during request handling hide dependencies and can observe different values at different times.
A startup validation boundary turns missing or malformed config into one early failure instead of many delayed runtime failures ✅[^2]

## Mental model
**Analogy:** Config is the service's boarding pass: check it once at the gate, then hand the stamped pass to each part of the trip instead of asking every passenger to re-check the airport database ✅[^1]
**Artifact:**
```ts
const Schema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.string().url(),
});
export type Config = Readonly<z.infer<typeof Schema>>;
export const loadConfig = (env = process.env): Config => Object.freeze(Schema.parse(env));
```
Zod schemas can parse and validate runtime data, and TypeScript can infer a static type from a Zod schema ✅[^2]

## How it works
1. The process starts and the composition root reads raw environment variables once ✅[^1]
2. A schema validates and coerces raw strings into application-level types before serving traffic ✅[^2]
3. Invalid configuration fails startup, which keeps the service from accepting work with unknown or partial settings ✅[^2]
4. The startup code freezes or otherwise treats the resulting config as immutable before injection into constructors ✅[^2]
5. TypeScript commonly uses Zod to parse `process.env` and export a `Readonly<z.infer<typeof Schema>>` object ✅[^2]
6. Python can use Pydantic Settings because `BaseSettings` reads missing initializer values from environment variables and validates settings values ✅[^3]
7. Pydantic models support `frozen=True`, and static type checkers can flag instance mutation for that configuration ✅[^4]
8. Go services commonly collect settings into a typed `struct`, and Go struct types are sequences of named fields with individual types ✅[^5]

## Worked example
Startup reads environment variables and constructs dependencies once ✅[^1]
```ts
const config = loadConfig(process.env);
const logger = createLogger(config.LOG_LEVEL);
const repo = new PgUserRepo(config.DATABASE_URL, logger);
const app = createApp({ repo, logger });
```
The request handler receives already-built dependencies and never reaches back into `process.env`.
The same shape translates to Python by constructing `Settings(BaseSettings, frozen=True)` in `main.py` and passing it to services ✅[^3]
In Go, `main` can parse `os.Getenv` values into a `Config` struct and pass that struct into constructors ✅[^5]

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Secret missing at boot | Startup validation fails before traffic is served ✅[^2] | Required schema fields reject absent values ✅[^2] |
| Env var misspelled | Validation catches it only if the expected field is required ✅[^2] | Settings loaders validate known fields, not every possible typo ✅[^3] |
| Runtime env var changes | Existing config object does not change | Config is read once and passed down as immutable data ✅[^1] |
| Tests need overrides | Tests can call the loader with a fake env mapping ✅[^2] | The loader accepts data as input rather than reading globally |
| Per-request feature flag | Do not hide it in startup config if it varies per request | Twelve-Factor config is deploy-varying config ✅[^1] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Startup schema plus immutable object | Early failure and explicit dependencies ✅[^2] | Requires a composition root and typed config module |
| Lazy environment reads | Simple at first | Hidden dependencies and delayed failures |
| Language-specific settings library | Better type and validation support ✅[^3] | Adds dependency and library conventions |
| Plain Go struct with manual parsing | Minimal dependency surface ✅[^5] | More manual validation code |

## Takeaways
- Read deploy config from the environment at the composition root. [rule-candidate]
- Validate config before serving traffic and fail fast on invalid values. [rule-candidate]
- Pass typed immutable config to constructors instead of reading globals in business code. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| stack idiom | TSN-9 | Source: |
| stack idiom | PY-7 | Source: |

## Verification status
- Verified: 28 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [The Twelve-Factor App: Config](https://12factor.net/config) — Adam Wiggins, living. Backs: Summary, Problem, Mental model, How it works, Edge cases. [^1]
- [Zod documentation](https://zod.dev/) — Zod project, living. Backs: Mental model, How it works, Edge cases, Trade-offs. [^2]
- [Pydantic Settings: Settings Management](https://docs.pydantic.dev/latest/concepts/pydantic_settings/) — Pydantic project, living. Backs: How it works, Worked example, Edge cases, Trade-offs. [^3]
- [Pydantic configuration: frozen](https://docs.pydantic.dev/latest/concepts/config/#frozen) — Pydantic project, living. Backs: How it works. [^4]
- [Go Specification: Struct types](https://go.dev/ref/spec#Struct_types) — Go project, living. Backs: How it works, Worked example, Trade-offs. [^5]
- `copilot/frameworks/agentic-sdlc/stacks/typescript-node/idioms.md` — cites this doc as TSN-9.
- `copilot/frameworks/agentic-sdlc/stacks/python/idioms.md` — cites this doc as PY-7.

## Related
- `operations/structured-logging.md` — logger construction belongs beside config loading.
- `js-runtime/promise-rejections.md` — startup failures should reject or throw visibly, not float.
- `nodejs/node-nvm-corepack-pnpm-yarn-architecture.md` — legacy Node.js runtime setup context.
