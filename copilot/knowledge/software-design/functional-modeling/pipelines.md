---
schema: knowledge-doc/v1
type: concept
topic: software-design/functional-modeling
status: verified
applies-to: ["TypeScript functional-pipeline cores"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [pipelines, railway-oriented-programming, result, composition]
---

# Functional workflow pipelines

## Summary
**TL;DR:** A functional workflow is a readable sequence of small named steps: parse, validate, decide, map, and then stop before effects. Railway-oriented programming uses a `Result` shape and `bind`-style chaining so failure values bypass later success-only steps. ✅[^1] ✅[^2]
**Use this when:** backing `PDM-functional-pipeline-R4`, splitting a large routine, or deciding where a pipeline should stop.
**Not this doc:** shell/core I/O separation → `functional-core.md`; type shapes for alternatives → `types-as-rules.md`.

## Problem
A single routine that parses input, validates permissions, calls repositories, and formats HTTP output hides the workflow order. Small named steps make the path visible, and Result chaining makes expected failures explicit. ✅[^2]

## Mental model
**Analogy:** A two-track railway carries good cargo on the top track and rejected cargo on the lower track. Each switch either keeps the cargo moving forward or sends it to the rejection track, where later success-only stations are skipped. ✅[^1]

**Artifact:**
```ts
type Result<T, E> = Readonly<{ ok: true; value: T } | { ok: false; error: E }>;

const bind = <A, B, E>(result: Result<A, E>, step: (value: A) => Result<B, E>): Result<B, E> =>
  result.ok ? step(result.value) : result;
```
Wlaschin's railway-oriented recipe uses a Result-like success/failure output and a bind adapter to connect one-track success functions into a two-track flow. ✅[^2]

## How it works
1. **Name the stations:** Each function says what stage it performs, such as `parseGrantRequest`, `validateGrantPolicy`, or `decideGrant`. ✅[^2]
2. **Keep stage shapes compatible:** A step that can fail returns `Result<NextValue, Error>`. ✅[^2]
3. **Use bind for dependent steps:** If one step fails, `bind` returns the existing failure instead of calling the next success-only step. ✅[^2]
4. **Stop before effects:** The pure pipeline returns a decision or command value; the shell performs database writes, logs, and HTTP responses after the pipeline. ✅[^3]
5. **Avoid pipeline worship:** Wlaschin warns that railway-oriented programming is useful but should not be taken to extremes. ✅[^1]

Diagram:
```text
raw input ─▶ parse ─▶ validate ─▶ decide ─▶ command data ─║ effect boundary ║─▶ save/respond/log
              │          │          │
              └─error────┴─error────┘
```

## Worked example
```ts
type Error =
  | { kind: "invalid_input"; field: "role" | "permission" }
  | { kind: "role_not_allowed" };

type Command = Readonly<{ kind: "grant_permission"; role: "admin" | "viewer"; permission: "shipment:read" | "shipment:write" }>;

const toCommand = (request: ParsedGrantRequest): Result<Command, Error> =>
  request.role === "viewer" && request.permission === "shipment:write"
    ? { ok: false, error: { kind: "role_not_allowed" } }
    : { ok: true, value: { kind: "grant_permission", ...request } };

const grantPipeline = (raw: { role: string; permission: string }): Result<Command, Error> =>
  bind(parseGrantRequest(raw), toCommand);
```

For `{ role: "viewer", permission: "shipment:write" }`, parsing succeeds and `toCommand` returns `{ ok: false, error: { kind: "role_not_allowed" } }`; no shell effect has happened yet. ✅[^2]

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Step needs current storage state | Load it in the shell before this pure pipeline, or split around the effect boundary | Pure functions cannot call impure actions in the functional-architecture model. ✅[^3] |
| Independent validations should accumulate | Use an error-list validation shape instead of short-circuit `bind` | Wlaschin's ROP material distinguishes custom error handling techniques beyond one happy path. ✅[^1] |
| One huge `pipe` expression | Readers still cannot see intent | Named steps matter more than clever composition syntax. ✅[^2] |
| Unexpected programmer bug | Let the stack's exceptional-error policy handle it outside expected Result flow | ROP is aimed at validation and expected service errors, not every possible fault. ✅[^1] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Named Result pipeline | Clear order and explicit expected failures | More small functions and types. ✅[^2] |
| One large procedure | Fewer symbols | Parsing, policy, effects, and formatting become tangled. ✅[^3] |
| Accumulating validation | Reports many input errors at once | More complex error-combination rules than short-circuit bind. ✅[^1] |

## Takeaways
- Compose workflows from small named steps in the order work happens. [rule-candidate]
- Use Result chaining for expected failures that should stop later success-only steps. [rule-candidate]
- End the pure pipeline at decision or command data; let the shell perform effects. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| paradigm rule | PDM-functional-pipeline-R4 | Source: |

## Verification status
- Verified: 18 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [Railway Oriented Programming](https://fsharpforfunandprofit.com/rop/) — Scott Wlaschin / F# for Fun and Profit, 2014. Backs: railway analogy, useful limits, error-handling techniques. [^1]
- [A recipe for a functional app, part 2](https://fsharpforfunandprofit.com/posts/recipe-part2/) — Scott Wlaschin / F# for Fun and Profit, 2013. Backs: Result shape, bind, connecting validation steps. [^2]
- [Impureim sandwich](https://blog.ploeh.dk/2020/03/02/impureim-sandwich/) — Mark Seemann, 2020. Backs: effect boundary around the pure middle. [^3]
- `copilot/frameworks/agentic-sdlc/paradigms/functional-pipeline.md` — cites this doc as PDM-functional-pipeline-R4.
- `copilot/frameworks/agentic-sdlc/stacks/typescript-node/paradigms/functional-pipeline.md` — TypeScript overlay for Result-shaped composition.
- Scott Wlaschin, *Domain Modeling Made Functional* (2018) — further reading; consolidated here through Wlaschin's free F# for Fun and Profit materials.

## Related
- `software-design/functional-modeling/functional-core.md`
- `software-design/functional-modeling/types-as-rules.md`
- `software-design/functional-modeling/testing.md`
