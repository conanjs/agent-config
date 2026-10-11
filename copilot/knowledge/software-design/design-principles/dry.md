---
schema: knowledge-doc/v1
type: concept
topic: software-design/design-principles
status: draft
applies-to: ["any"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [dry, duplication, abstraction, maintainability]
---

# DRY knowledge authority

## Summary
**TL;DR:** DRY means every rule, invariant, mapping, or decision has one authoritative representation, not that every similar-looking line must be merged. Two snippets that look alike can stay separate when they express different knowledge, especially across module or service boundaries.
**Use this when:** reviewing copied validation, mappings, generators, schemas, examples, or shared helpers.
**Not this doc:** SRP and reasons to change -> `software-design/design-principles/single-responsibility.md`.

## Problem
Teams often read DRY as "remove all textual duplication," but Hunt and Thomas define it as one authoritative, unambiguous representation of each piece of system knowledge. ✅[^1]

Merging similar code too early can create a shared abstraction that later needs flags and conditionals for unrelated cases. ✅[^2]

## Mental model
**Analogy:** keep the legal contract in one signed file, but let multiple teams print copies; the contract text is authority, while printed copies are derived artifacts.
**Artifact:**
```ts
const PermissionCatalog = {
  READ_SHIPMENT: "shipment:read",
  WRITE_SHIPMENT: "shipment:write",
} as const;

type Permission = (typeof PermissionCatalog)[keyof typeof PermissionCatalog];
```
The catalog is the authority for permission names; generated API docs, UI labels, and tests may repeat the strings only as derived checks.

## How it works
DRY asks where the knowledge lives: a validation rule, pricing formula, permission mapping, build setting, schema, or protocol contract should have one place that changes when the concept changes. ✅[^1]

Textual similarity is only evidence to inspect; it is not proof that two snippets express the same knowledge. ✅[^1]

Metz warns that duplication can be cheaper than the wrong abstraction when a shared helper becomes a condition-heavy procedure for several nearly related needs. ✅[^2]

Beck's simple design rules include both "no duplication" and "fewest elements," so duplication removal must not introduce extra elements that obscure intent. ✅[^3]

Within one module, DRY usually wins because the same maintainer can change the authority and all callers together. ✅[^1]

Across module or service boundaries, independence usually wins because sharing an authority can couple separate release cycles and ownership. ✅[^1]

In class-modeled code, put the authoritative invariant on the object or service that owns the state:
```ts
class Role {
  #permissions = new Set<Permission>();

  grant(permission: Permission): "granted" | "already_granted" {
    if (this.#permissions.has(permission)) return "already_granted";
    this.#permissions.add(permission);
    return "granted";
  }
}
```

In functional-pipeline code, put the authoritative rule in a pure transformation and call it from adapters:
```ts
type Grant = Readonly<{ permissions: ReadonlySet<Permission> }>;
const grantPermission = (grant: Grant, permission: Permission): Grant =>
  grant.permissions.has(permission)
    ? grant
    : { permissions: new Set([...grant.permissions, permission]) };
```

Use the rule of three as a practical discovery habit: tolerate two examples while learning, and extract when a third use shows the stable common knowledge. ⚠️ unverified

## Worked example
A product has three handlers: create role, update role, and import role. All require valid permission ids. The wrong fix is a shared `parseRoleRequest(body, mode)` with `mode === "create" | "update" | "import"`. The better DRY fix is one `parsePermissionId` authority plus three separate handlers that keep their different workflow knowledge local.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Generated files | Duplication is acceptable when generated output is not authoritative | Hunt and Thomas describe generators as a way to keep one source and derive byproducts. ✅[^1] |
| Similar code, different policy | Leave it duplicated until the shared rule is real | Metz shows how premature extraction becomes wrong abstraction pressure. ✅[^2] |
| Same rule in API and UI | Prefer a shared contract, generated client, or explicit test against one authority | DRY covers schemas, tests, docs, and build assets, not only source code. ✅[^1] |
| Cross-service rule | Prefer a protocol or published contract over shared internal code | This preserves service independence while still naming the authoritative knowledge. ✅[^1] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Keep duplication briefly | Faster learning; less accidental coupling | Must revisit once the real common rule appears |
| Extract shared authority | One change point; fewer divergent copies | Bad extraction creates flags, conditionals, and coupling |
| Generate derived artifacts | Keeps schema or metadata authoritative | Generator becomes a tool to maintain |

## Takeaways
- Identify the knowledge that must change together before removing duplicated text. [rule-candidate]
- Prefer duplication over a shared helper that needs mode flags for unrelated cases. [rule-candidate]
- Apply DRY inside a module by default; preserve independence across module or service boundaries unless a contract is the authority. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| foundation rule | DP-6 | Source: |

## Verification status
- Verified: 12 claims (✅) · Unverified: 1 claims (⚠️) · Last verified: 2026-10-04

## References
- [Orthogonality and the DRY Principle](https://www.artima.com/articles/orthogonality-and-the-dry-principle) — Bill Venners interview with Andy Hunt and Dave Thomas, 2003. Backs: Problem, How it works, Edge cases, Trade-offs. [^1]
- [The Wrong Abstraction](https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction) — Sandi Metz, 2016. Backs: Problem, How it works, Edge cases. [^2]
- [BeckDesignRules](https://martinfowler.com/bliki/BeckDesignRules.html) — Martin Fowler, 2015. Backs: How it works. [^3]
- `copilot/frameworks/agentic-sdlc/foundations/design/design-principles.md` — cites this doc as DP-6.

## Related
- `software-design/design-principles/kiss-and-yagni.md`
- `software-design/design-principles/cohesion-and-coupling.md`
- `software-design/design-principles/single-responsibility.md`
- `software-design/functional-modeling/functional-core.md`
