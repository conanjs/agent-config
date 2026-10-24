---
schema: knowledge-doc/v1
type: concept
topic: software-design/functional-modeling
status: verified
applies-to: ["TypeScript functional-pipeline cores"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [functional-core, imperative-shell, ports-and-adapters, decisions-as-data]
---

# Functional core and imperative shell

## Summary
**TL;DR:** Put business decisions in pure functions, and put I/O in a thin shell that gathers facts before the core and applies decisions after it. This is the same pressure behind functional core / imperative shell, the impure-pure-impure sandwich, and functional architecture as ports and adapters. ✅[^1] ✅[^2] ✅[^3]
**Use this when:** backing `PDM-functional-pipeline-R2` and `PDM-functional-pipeline-R5`, moving logic out of controllers/jobs/adapters, or choosing what a pipeline step may call.
**Not this doc:** explicit alternative shapes → `types-as-rules.md`; Result chaining → `pipelines.md`.

## Problem
When validation code queries storage, logs, sends messages, and decides outcomes in the same function, tests need mocks and readers cannot tell which branch is business logic versus infrastructure. Functional core / imperative shell separates those concerns: the core receives facts and returns decisions; the shell performs effects. ✅[^1]

## Mental model
**Analogy:** A judge reads an evidence packet and writes a verdict; clerks gather the evidence and file the verdict. The verdict logic stays in the judge's written reasoning, not in the clerk's trip to the archive. ✅[^2]

**Artifact:**
```ts
type Grant = Readonly<{ role: "admin" | "viewer"; permission: "shipment:read" | "shipment:write" }>;
type Request = Readonly<{ actorRole: Grant["role"]; permission: Grant["permission"] }>;
type Decision = Readonly<
  | { kind: "allow"; audit: string }
  | { kind: "deny"; reason: "missing_grant" }
>;

const decideAccess = (grants: ReadonlyArray<Grant>, request: Request): Decision =>
  grants.some(g => g.role === request.actorRole && g.permission === request.permission)
    ? { kind: "allow", audit: `${request.actorRole}:${request.permission}` }
    : { kind: "deny", reason: "missing_grant" };
```
The `Decision` value is data the shell can enact, so the core does not need a logger, database client, or HTTP response object. ✅[^1]

## How it works
**3 actors:**
- **Adapter** — its job: load external facts, via database, HTTP, queue, file, or environment.
- **Core** — its job: compute domain decisions, via pure TypeScript functions.
- **Effect applier** — its job: enact decisions, via repository, logger, response, or message client.

**Artifact shape:**
```ts
type AccessFacts = Readonly<{ grants: ReadonlyArray<Grant>; request: Request }>;
type AccessCommand = Readonly<{ kind: "record_audit"; message: string }>;
```

**Sequence:**
1. **Adapter (local or network):** reads the current grants and request facts from external sources. ✅[^3]
2. **Adapter → Core (in-process):** calls `decideAccess(facts.grants, facts.request)` with plain values. ✅[^1]
3. **Core (in-process):** returns a `Decision` value and does not call external systems. ✅[^2]
4. **Effect applier (local or network):** maps `Decision` to a response, audit write, or rejected command. ✅[^3]

Diagram:
```text
[Adapter / impure] ──facts──▶ [Functional core / pure] ──decision data──▶ [Effect applier / impure]
 database, HTTP                  no I/O calls                         response, save, log
```

## Worked example
Shell:
```ts
async function authorizeShell(role: Grant["role"], permission: Grant["permission"], repo: { grants(): Promise<Grant[]> }) {
  const grants = await repo.grants();
  const decision = decideAccess(grants, { actorRole: role, permission });

  switch (decision.kind) {
    case "allow":
      return { status: 200, audit: decision.audit };
    case "deny":
      return { status: 403, reason: decision.reason };
  }
}
```
The shell is thin because it only loads facts, calls the core, and translates the returned decision to effects. ✅[^2]

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Core needs current database state | The shell loads that state first and passes it as a fact | Seemann's sandwich gathers impure data before the pure middle. ✅[^2] |
| Core needs to choose multiple effects | Return a list of command values | Decisions-as-data keeps the effect choice testable without executing it. ✅[^1] |
| Shell has conditionals | Keep them mechanical: translate decision tags to adapters | Bernhardt describes a shell with few conditionals around an easy-to-test core. ✅[^1] |
| External service fails before core | Return or throw according to stack error policy before calling the core | The core cannot decide from facts it never received. ✅[^3] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Pure core plus thin shell | Easy core tests and fewer mocks | Requires explicit data shapes for facts and decisions. ✅[^1] |
| Inject repositories into core steps | Fewer shell lines | Business logic becomes coupled to effects and harder to test without doubles. ✅[^3] |
| Ports-and-adapters boundary | Clear adapter/core separation | Needs discipline in TypeScript because purity is not enforced by the language. ✅[^3] |

## Takeaways
- Core transformation steps receive facts and return decisions without external calls. [rule-candidate]
- Keep controllers, handlers, jobs, and adapters as the thin impure shell. [rule-candidate]
- Prefer decision values over callbacks when the core must tell the shell what to do. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| paradigm rule | PDM-functional-pipeline-R2 | Source: |
| paradigm rule | PDM-functional-pipeline-R5 | Source: |

## Verification status
- Verified: 18 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [Functional Core, Imperative Shell](https://www.destroyallsoftware.com/screencasts/catalog/functional-core-imperative-shell) — Gary Bernhardt / Destroy All Software, 2012. Backs: Problem, Mental model, decisions-as-data, testing implications. [^1]
- [Impureim sandwich](https://blog.ploeh.dk/2020/03/02/impureim-sandwich/) — Mark Seemann, 2020. Backs: Summary, How it works, shell thinness. [^2]
- [Functional architecture is Ports and Adapters](https://blog.ploeh.dk/2016/03/18/functional-architecture-is-ports-and-adapters/) — Mark Seemann, 2016. Backs: ports/adapters mapping and I/O boundary. [^3]
- [Domain Modeling Made Functional](https://fsharpforfunandprofit.com/ddd/) — Scott Wlaschin / F# for Fun and Profit, living. Backs: domain decisions represented with functional types. [^4]
- `copilot/frameworks/agentic-sdlc/paradigms/functional-pipeline.md` — cites this doc as PDM-functional-pipeline-R2 and PDM-functional-pipeline-R5.
- `copilot/frameworks/agentic-sdlc/stacks/typescript-node/paradigms/functional-pipeline.md` — TypeScript overlay for shell/core separation.
- Scott Wlaschin, *Domain Modeling Made Functional* (2018) — further reading; consolidated here through Wlaschin's free F# for Fun and Profit materials.

## Related
- `software-design/functional-modeling/immutability.md`
- `software-design/functional-modeling/types-as-rules.md`
- `software-design/functional-modeling/testing.md`
- `software-design/ddd/layering.md`
