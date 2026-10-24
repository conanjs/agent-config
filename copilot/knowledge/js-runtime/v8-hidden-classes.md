---
schema: knowledge-doc/v1
type: concept
topic: js-runtime
status: verified
applies-to: ["V8", "Node.js on V8", "Chromium on V8"]
last-verified: 2026-10-04
last-updated: 2026-10-04
tags: [performance, v8, objects, inline-caches]
---

# V8 hidden classes and inline caches

## Summary
**TL;DR:** V8 assigns objects an internal shape called a Map or hidden class, and property-access code is fastest when one access site repeatedly sees the same shape ✅[^1]
**Use this when:** Use this when writing hot-path TypeScript or JavaScript that creates many similar objects, especially before adding late fields, deleting fields, or mixing construction orders ✅[^1]
**Not this doc:** Use `js-runtime/promise-rejections.md` for async error handling and `js-runtime/abort-signal.md` for cancellation.

## Problem
JavaScript makes objects look like flexible dictionaries, but V8 uses specialized property layouts so common property reads do not need a full dictionary lookup each time ✅[^1]
Two objects with the same property names can have different shapes if their properties are added in different orders ✅[^1]
A hot call site that receives many shapes loses the simple cache path that made the property access cheap ✅[^2]

## Mental model
**Analogy:** Think of each object shape as a warehouse shelf map: if every box type puts `id` in slot 0 and `name` in slot 1, the worker reaches directly into the right slot; if every box has a different shelf map, the worker must check the map first ✅[^1]
**Artifact:**
```ts
const a = { id: "u1", name: "Ada" }; // shape: id then name
const b = { name: "Ada", id: "u1" }; // different shape: name then id
```
Object literals with different key order can produce different shape-transition paths because V8 transitions hidden classes as named properties are added ✅[^1]

## How it works
1. Every V8 heap object points at a Map, and that Map is the hidden class used to compare object shapes quickly ✅[^3]
2. A Map records property descriptors and transitions to later Maps, so adding a named property moves the object along a shape-transition tree ✅[^3]
3. Objects with the same named properties in the same order can share a HiddenClass, while adding a different property creates a different branch ✅[^1]
4. Named properties may be stored in-object, in a fast properties backing store, or in a slow dictionary representation ✅[^1]
5. V8 can use hidden classes with inline caches so a property-access site remembers how to load a property for shapes it has already seen ✅[^1]
6. A monomorphic inline cache has seen one shape at that site, a polymorphic cache has seen a small set of shapes, and a megamorphic cache stops tracking an unbounded local set ✅[^2]
7. Mrale's V8-focused explanation gives property-load inline caches an example threshold of four shapes before megamorphic state in that post ✅[^2]
8. Repeated add/delete churn can push named properties into dictionary mode, and dictionary properties are typically slower because inline caches do not work with them in the same way ✅[^1]

## Worked example
A constructor that always writes every field in the same order gives each instance the same transition path ✅[^1]
```ts
class UserRow {
  id: string;
  name: string;
  email: string | undefined;

  constructor(id: string, name: string, email?: string) {
    this.id = id;
    this.name = name;
    this.email = email;
  }
}
```
If a hot loop later runs `row.email` on `UserRow` instances, the access site can keep seeing one shape because all instances already have `email` ✅[^2]
By contrast, `const row = { id, name }; if (email) row.email = email;` creates different shapes for rows with and without the late field ✅[^1]
Using `delete row.email` on hot objects is risky because V8 supports slow dictionary properties for objects that need efficient property removal and addition ✅[^1]

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `delete obj.x` in hot code | The object can lose the fast shared-shape path and use dictionary-style properties ✅[^1] | Frequent additions and removals make descriptor-array maintenance expensive ✅[^1] |
| Class constructor initializes all fields | Instances tend to follow the same transition path ✅[^1] | The same property names are added in the same order ✅[^1] |
| Object-literal factory with conditional spread | The factory can emit multiple shapes ✅[^1] | Different key sets or key orders produce different hidden-class branches ✅[^1] |
| Arrays with holes or sparse indexes | Indexed elements have their own fast, holey, or dictionary representations ✅[^1] | V8 stores array-indexed elements separately from named properties ✅[^1] |
| Megamorphic property site | The site uses a broader cache strategy and is slower than a monomorphic hit in the cited explanation ✅[^2] | The local inline cache has seen too many shapes ✅[^2] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Class or factory that initializes all fields | Stable shape, easy TypeScript type alignment ✅[^1] | Less ad-hoc object mutation |
| Optional field initialized as `undefined` | Keeps the field present before hot use ✅[^1] | Slightly more memory than omitting the property |
| `delete` for semantic absence | Matches dynamic dictionary behavior ✅[^1] | Can hurt hot property access through slow properties ✅[^1] |
| Object literal per case | Very concise code | May produce multiple shapes when key order or key set varies ✅[^1] |

## Takeaways
- Initialize all hot-object fields in one place and in one order. [rule-candidate]
- Prefer assigning `undefined` over `delete` for hot objects whose shape should stay stable. [rule-candidate]
- Keep class and object-literal factories shape-stable before measuring micro-optimizations. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| stack idiom | TSN-12 | Source: |

## Verification status
- Verified: 34 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-04

## References
- [Fast properties in V8](https://v8.dev/blog/fast-properties) — V8 team, 2017. Backs: Problem, Mental model, How it works, Worked example, Edge cases, Trade-offs. [^1]
- [What's up with monomorphism?](https://mrale.ph/blog/2015/01/11/whats-up-with-monomorphism.html) — Vyacheslav Egorov, 2015. Backs: Problem, How it works, Worked example, Edge cases. [^2]
- [Maps (Hidden Classes) in V8](https://v8.dev/docs/hidden-classes) — V8 team, living. Backs: How it works. [^3]
- `copilot/frameworks/agentic-sdlc/stacks/typescript-node/idioms.md` — cites this doc as TSN-12.

## Related
- `js-runtime/promise-rejections.md` — async failure handling in Node.js.
- `js-runtime/abort-signal.md` — cancellation for async APIs.
- `nodejs/node-nvm-corepack-pnpm-yarn-architecture.md` — legacy Node.js runtime/toolchain context.
