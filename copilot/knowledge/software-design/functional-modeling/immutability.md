---
schema: knowledge-doc/v1
type: concept
topic: software-design/functional-modeling
status: verified
applies-to: ["TypeScript functional-pipeline cores"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [functional-modeling, immutability, typescript, structural-sharing]
---

# Immutable data in functional pipelines

## Summary
**TL;DR:** In a functional-pipeline core, each step treats its input as a value and returns a new value instead of changing the old one. TypeScript `readonly` types make that intent visible to the checker, while structural sharing avoids copying unchanged parts of a larger value. ✅[^1] ✅[^2]
**Use this when:** backing `PDM-functional-pipeline-R1`, designing transformation steps, or deciding how much copying is acceptable in TypeScript core code.
**Not this doc:** V8 object-shape performance details → `js-runtime/v8-hidden-classes.md`; shell I/O boundaries → `functional-core.md`.

## Problem
A pipeline becomes hard to reason about when one step mutates a shared request object and a later step sees hidden changes. Immutable inputs and outputs keep each step's contract local: the input value is the fact it received, and the returned value is the fact it produced. ✅[^2]

## Mental model
**Analogy:** Treat each domain value like a signed form. A reviewer does not erase fields on the original form; they attach a revised copy and leave the prior copy available for audit. ✅[^2]

**Artifact:**
```ts
type Role = "admin" | "viewer";
type Permission = "shipment:read" | "shipment:write";

type Grant = Readonly<{
  role: Role;
  permission: Permission;
  source: "policy" | "manual";
}>;

const addManualGrant = (
  grants: ReadonlyArray<Grant>,
  role: Role,
  permission: Permission,
): ReadonlyArray<Grant> => [
  ...grants,
  { role, permission, source: "manual" },
];
```
TypeScript's `Readonly<T>` marks properties as not reassignable, and `ReadonlyArray<T>` removes mutating array methods from that typed view. ✅[^1]

## How it works
1. **Input step:** A core function receives plain facts, such as `ReadonlyArray<Grant>`. ✅[^1]
2. **Transform step:** The function computes a replacement value rather than changing the input object or array. ✅[^2]
3. **Share step:** Only changed containers need a new object; unchanged nested values can be reused by reference, which is structural sharing. ✅[^2]
4. **Runtime step:** JavaScript engines still allocate real objects, and V8 optimizes property access using hidden classes that depend on object shape and property order. ✅[^3]
5. **Cost step:** Copying with spread syntax is simple, but hot paths should avoid needless shape churn and should be checked against `js-runtime/v8-hidden-classes.md` when object creation dominates a profile. ✅[^3]

Diagram:
```text
old grants ──┐
             ├─ addManualGrant ──▶ new grants array
new grant ───┘                     ├─ shares old grant objects
                                   └─ adds one new grant object
```

## Worked example
Input:
```ts
const before: ReadonlyArray<Grant> = [
  { role: "viewer", permission: "shipment:read", source: "policy" },
];
```

Pipeline step:
```ts
const after = addManualGrant(before, "admin", "shipment:write");
```

Output:
```ts
after === before;        // false
after[0] === before[0];  // true, unchanged item is shared
after[1];                // { role: "admin", permission: "shipment:write", source: "manual" }
```
The old array remains valid for tests, logging, or another branch, while the new array carries the added grant. ✅[^2]

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `readonly` at type level only | Runtime code can still mutate through an untyped alias | TypeScript checks assignments statically; it does not deep-freeze arbitrary objects by default. ✅[^1] |
| Deep nested update | Only each changed level needs a new container | Structural sharing reuses unchanged branches instead of deep-copying the whole tree. ✅[^2] |
| Large hot loop | Allocation and object-shape effects can matter | V8 uses hidden classes and different property representations for performance. ✅[^3] |
| Boundary API is mutable | Normalize once at the shell, then enter the core as readonly data | Functional-pipeline rules keep mutation out of core transformation steps. ✅[^4] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Spread-copy records and arrays | Simple TypeScript, no library required | Manual nested updates can get noisy. ✅[^2] |
| Immer-style drafts | More convenient nested updates and structural sharing | Adds a dependency and hides copying behind a proxy-based abstraction. ✅[^2] |
| Local mutation behind a pure boundary | Can reduce allocation in measured hot paths | Requires a recorded performance reason and tests proving no shared mutation leaks. ✅[^3] |

## Takeaways
- Return a new value or explicit failure from every core step. [rule-candidate]
- Use `Readonly<T>` and `ReadonlyArray<T>` for core inputs and outputs, then measure before optimizing away copies. [rule-candidate]
- For hot JavaScript object paths, read `js-runtime/v8-hidden-classes.md` before choosing an update shape. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| paradigm rule | PDM-functional-pipeline-R1 | Source: |

## Verification status
- Verified: 18 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [Readonly utility type](https://www.typescriptlang.org/docs/handbook/utility-types.html#readonlytype) — TypeScript, living. Backs: Summary, Mental model, How it works, Edge cases. [^1]
- [Immer introduction](https://immerjs.github.io/immer/) — Immer documentation, living. Backs: structural sharing, immutable update costs, Trade-offs. [^2]
- [Fast properties in V8](https://v8.dev/blog/fast-properties) — V8 team, 2017. Backs: runtime cost notes and hidden-class link. [^3]
- [Impureim sandwich](https://blog.ploeh.dk/2020/03/02/impureim-sandwich/) — Mark Seemann, 2020. Backs: boundary normalization at the shell edge. [^4]
- `copilot/frameworks/agentic-sdlc/paradigms/functional-pipeline.md` — cites this doc as PDM-functional-pipeline-R1.
- `copilot/frameworks/agentic-sdlc/stacks/typescript-node/paradigms/functional-pipeline.md` — TypeScript overlay using readonly records and arrays.
- Scott Wlaschin, *Domain Modeling Made Functional* (2018) — further reading; consolidated here through Wlaschin's free F# for Fun and Profit materials.

## Related
- `software-design/functional-modeling/functional-core.md`
- `software-design/functional-modeling/pipelines.md`
- `js-runtime/v8-hidden-classes.md`
