---
schema: knowledge-doc/v1
type: concept
topic: js-runtime
status: verified
applies-to: ["ES2022+", "TypeScript ≥ 3.8", "V8 ≥ 9.7 (Node ≥ 18)"]
last-verified: 2026-10-25
last-updated: 2026-10-25
tags: [private-fields, encapsulation, typescript, serialization, performance, v8]
---

# Private class fields: `#x` versus TypeScript `private`

## Summary
**TL;DR:** TypeScript's `private` is checked only at compile time and is erased from the JavaScript output, so the field is an ordinary property at runtime. JavaScript's `#x` is private at runtime as well, so JSON, `Object.keys`, spread and loggers cannot see it. On a native ES2022+ target, reading and creating `#` fields costs the same as public fields.
**Use this when:** choosing how to hide a field, keeping a secret out of logs and responses, or someone worries that `#` is slow.
**Not this doc:** why a type should own its state at all → `software-design/oop/encapsulation.md`.

## Problem
A class marks `passwordHash` or a signing key as `private` and assumes it is hidden. At runtime it is a normal property, so `JSON.stringify(user)`, `{ ...user }`, or a logger that serializes objects prints it.

## Mental model
**Analogy:** `private` is a "staff only" sign on an unlocked door: the type checker reads the sign, but anyone at runtime can walk in. `#` is a locked door with no key outside the class.

**Artifact:**
```ts
class Soft { private passwordHash = "h"; id = 1; }
class Hard { #passwordHash = "h"; id = 1; }

JSON.stringify(new Soft()); // {"passwordHash":"h","id":1}
JSON.stringify(new Hard()); // {"id":1}
```

## How it works
1. `private` and `protected` are enforced only during type checking. Runtime lookups, and bracket notation even during type checking, still reach the member: it is "soft private". ✅[^1]
2. `#` fields stay private after compilation and have no bracket-notation escape hatch: they are "hard private". ✅[^1]
3. When compiling to ES2021 or lower, TypeScript replaces `#` with `WeakMap`s. The handbook notes that these runtime privacy checks could affect performance. ✅[^1]
4. Private elements are not properties. They cannot be enumerated, deleted, proxied, or reached through `Object` methods, and `structuredClone()` does not copy them. ✅[^2]
5. Reading a `#` field from an object whose class did not declare it throws a `TypeError`. `#x in obj` checks for it without throwing. ✅[^2]
6. V8 9.7 moved class-field initialization, including private fields, onto its inline-cache fast path. Before that it went through slower runtime calls. ✅[^3]

**Where each form fits**

| Field holds | Form | Why |
|---|---|---|
| Entity or value-object state | `readonly #x` | Only the type's methods may change or reveal it |
| A credential, key, hash or token, in any layer | `readonly #x` | Must not reach JSON, logs or spread copies |
| An injected collaborator (port, clock, logger) | `private readonly x` constructor parameter | A `#` name cannot be a parameter (TypeScript error TS18009) |
| A data shape meant to be serialized (DTO, view) | public `readonly x` | Being serialized is its job |

## Worked example
Measured 2026-10-25 on Node 24.22 (V8 13.6), target ES2023 (native `#`), each case in its own process after a warm-up run, three runs each.

| Case | Public field | `#` field |
|---|---|---|
| 2×10⁸ reads through a method | 126 ms | 126 ms |
| 3×10⁷ constructions (two fields) | 166–172 ms | 168–180 ms |
| `JSON.stringify` | Field present | Field absent |
| `Object.keys` | `['passwordHash', 'id']` | `['id']` |

The speed difference is within run-to-run noise. A first attempt that ran both cases in one process showed `#` 3× slower; that was an ordering effect from JIT warm-up, not the field type.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Object wrapped in a `Proxy` (some mocking and reactivity libraries) | `#` access does not go through the proxy | Private elements cannot be proxied ✅[^2] |
| Target ES2021 or lower | `#` becomes `WeakMap` lookups | TypeScript downlevels it ✅[^1] |
| `private` constructor parameter under Node's built-in type stripping | Rejected: `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` (also TS1294 with `erasableSyntaxOnly`) | Parameter properties emit code, so they cannot simply be stripped. Reproduced on Node 24.22 |
| Tests need to read a `#` field | Not possible from outside | Test through public behavior instead |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| `#` fields | Real runtime privacy; secrets cannot leak through serialization | Not usable as parameter properties; invisible through proxies |
| `private` | Concise parameter properties; tests can reach fields with brackets | Erased at runtime; serializers see it |

## Takeaways
- Store secrets and domain state in `readonly #` fields; never rely on `private` to keep a value out of logs. [rule-candidate]
- On an ES2022+ target, do not avoid `#` for speed; measured cost is nil. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 8 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-25

## References
- [TypeScript Handbook: Classes, member visibility caveats](https://www.typescriptlang.org/docs/handbook/2/classes.html) — TypeScript team, living. Backs: How it works 1–3, Edge cases. [^1]
- [Private elements](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_elements) — MDN, living. Backs: How it works 4–5, Edge cases. [^2]
- [Faster initialization of instances with new class features](https://v8.dev/blog/faster-class-features) — V8 team, 2022. Backs: How it works 6. [^3]
- `copilot/frameworks/agentic-sdlc/stacks/typescript-node/paradigms/class-modeled.md` — the State row that applies this.

## Related
- `js-runtime/v8-hidden-classes.md`
- `software-design/oop/encapsulation.md`
