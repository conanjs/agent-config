---
schema: knowledge-doc/v1
type: concept
topic: software-design/functional-modeling
status: verified
applies-to: ["TypeScript functional-pipeline cores"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [types, discriminated-unions, parse-dont-validate, workflow-outcomes]
---

# Types as business rules

## Summary
**TL;DR:** Model workflow alternatives as explicit data shapes so invalid states cannot be built accidentally. In TypeScript, discriminated unions let code narrow by a tag, and parse-don't-validate moves boundary checks into constructors that return stronger domain types. ✅[^1] ✅[^2] ✅[^3]
**Use this when:** backing `PDM-functional-pipeline-R3`, replacing boolean flags, or defining success, rejection, and validation-failure outcomes.
**Not this doc:** chaining those outcomes through a workflow → `pipelines.md`; testing those shapes → `testing.md`.

## Problem
Boolean flags and optional fields often allow combinations the domain does not allow, such as `{ allowed: false, grant: ... }` or a grant request with both success and failure data. Wlaschin's type-oriented modeling advice is to encode the valid cases directly, so the missing case is not representable. ✅[^3]

## Mental model
**Analogy:** A train ticket has one printed class: economy, business, or first. It does not have three independent checkboxes that can all be ticked at once.

**Artifact:**
```ts
type Permission = "shipment:read" | "shipment:write";

type ParsedGrantRequest = Readonly<{
  role: "admin" | "viewer";
  permission: Permission;
}>;

type GrantOutcome = Readonly<
  | { kind: "granted"; request: ParsedGrantRequest }
  | { kind: "rejected"; reason: "role_not_allowed" | "permission_not_allowed" }
  | { kind: "invalid_input"; field: "role" | "permission" }
>;
```
The `kind` tag is the discriminant, and each union member carries only the fields valid for that member. ✅[^1]

## How it works
1. **Name each valid state:** Give every meaningful alternative its own union member, such as `granted`, `rejected`, or `invalid_input`. ✅[^1]
2. **Parse at the boundary:** Convert raw strings into `ParsedGrantRequest` once, returning an error when input cannot become the stronger type. ✅[^2]
3. **Use the stronger type inside the core:** Core functions accept `ParsedGrantRequest`, so they do not repeat raw string checks. ✅[^2]
4. **Handle outcomes exhaustively:** A `switch` over the discriminant can use `never` to catch unhandled union members when the union grows. ✅[^1]
5. **Return workflow outcomes explicitly:** Expected business rejections travel as data, not as hidden exceptions or unrelated booleans. ✅[^4]

## Worked example
Parser:
```ts
type ParseResult =
  | { ok: true; value: ParsedGrantRequest }
  | { ok: false; error: Extract<GrantOutcome, { kind: "invalid_input" }> };

const parseGrantRequest = (raw: { role: string; permission: string }): ParseResult => {
  if (raw.role !== "admin" && raw.role !== "viewer") return { ok: false, error: { kind: "invalid_input", field: "role" } };
  if (raw.permission !== "shipment:read" && raw.permission !== "shipment:write") {
    return { ok: false, error: { kind: "invalid_input", field: "permission" } };
  }
  return { ok: true, value: { role: raw.role, permission: raw.permission } };
};
```

Decision:
```ts
const decideGrant = (request: ParsedGrantRequest): GrantOutcome =>
  request.role === "viewer" && request.permission === "shipment:write"
    ? { kind: "rejected", reason: "role_not_allowed" }
    : { kind: "granted", request };
```

Renderer:
```ts
const renderOutcome = (outcome: GrantOutcome): number => {
  switch (outcome.kind) {
    case "granted": return 201;
    case "rejected": return 403;
    case "invalid_input": return 400;
    default: {
      const _exhaustive: never = outcome;
      return _exhaustive;
    }
  }
};
```
The parser preserves the knowledge it gained by returning `ParsedGrantRequest`, which is the central parse-don't-validate move. ✅[^2]

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Optional fields on one broad type | Callers can create invalid combinations | A union member per case removes fields that do not belong to that case. ✅[^1] |
| Raw input used deep in the core | Checks are repeated or forgotten | Parsing up front preserves boundary knowledge in the returned type. ✅[^2] |
| New outcome added later | Exhaustive `never` checks fail until every switch handles it | TypeScript uses `never` for impossible narrowed states. ✅[^1] |
| Many validation errors required | Return a validation-error union or list as data | Railway-oriented workflows can carry custom error types along the failure track. ✅[^4] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Discriminated union outcomes | Exhaustive, readable workflow branches | More type definitions up front. ✅[^1] |
| Boolean flags | Quick to write | Allows unrelated flags to drift into impossible combinations. ✅[^3] |
| Parse once at boundary | Fewer repeated checks inside core | Requires clear parser functions and error shapes. ✅[^2] |

## Takeaways
- Replace flag clusters with discriminated unions named after the domain alternatives. [rule-candidate]
- Parse raw boundary data into stronger core types before the first business decision. [rule-candidate]
- Return expected workflow outcomes as explicit values. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| paradigm rule | PDM-functional-pipeline-R3 | Source: |

## Verification status
- Verified: 18 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [Discriminated unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions) — TypeScript, living. Backs: discriminants, narrowing, exhaustiveness. [^1]
- [Parse, don't validate](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/) — Alexis King, 2019. Backs: parse-before-core and preserving knowledge in types. [^2]
- [Designing with types: making illegal states unrepresentable](https://fsharpforfunandprofit.com/posts/designing-with-types-making-illegal-states-unrepresentable/) — Scott Wlaschin / F# for Fun and Profit, 2013. Backs: invalid-state modeling. [^3]
- [Railway Oriented Programming](https://fsharpforfunandprofit.com/rop/) — Scott Wlaschin / F# for Fun and Profit, 2014. Backs: custom error outcomes and Result-shaped workflows. [^4]
- [Domain Modeling Made Functional](https://fsharpforfunandprofit.com/ddd/) — Scott Wlaschin / F# for Fun and Profit, living. Backs: type-driven domain modeling. [^5]
- `copilot/frameworks/agentic-sdlc/paradigms/functional-pipeline.md` — cites this doc as PDM-functional-pipeline-R3.
- `copilot/frameworks/agentic-sdlc/stacks/typescript-node/paradigms/functional-pipeline.md` — TypeScript overlay for discriminated Result and exhaustive errors.
- Scott Wlaschin, *Domain Modeling Made Functional* (2018) — further reading; consolidated here through Wlaschin's free F# for Fun and Profit materials.

## Related
- `software-design/functional-modeling/functional-core.md`
- `software-design/functional-modeling/pipelines.md`
- `software-design/ddd/building-blocks.md`
