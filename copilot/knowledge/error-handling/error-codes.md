---
schema: knowledge-doc/v1
type: concept
topic: error-handling
status: verified
applies-to: ["TypeScript 5.8+ (tested on 6.0.3)", "stack reference v4.0.0 and layer-first v1.5.0", "any API that sends RFC 9457 problems"]
last-verified: 2026-10-28
last-updated: 2026-10-28
tags: [error-codes, as-const, result, problem-details, contract-test, single-source-of-truth]
---

# Error codes: one declared value, owned by one layer

## Summary
**TL;DR:** Expected failures carry a code such as `"not-found"`. The code is written into results, port signatures, the HTTP mapper, doc comments and tests, so as a raw string it ends up in many places: 35 times in 16 files in the stack reference before v4.0.0. Declare each code once instead, as a key of an `as const` object with a derived type of the same name, in the layer that owns the failure: `DocumentError` in the domain, `LookupError` in the application, and `DocumentsRefusal` in the interface, which spreads the other two. Code uses the key (`LookupError.NotFound`), so changing a value is one edit. The value is what clients see, though, so a change to it is an API change. That is why the HTTP contract test writes the values out literally: a changed value fails there, and someone has to decide it on purpose.
**Use this when:** adding a failure reason, choosing where it is declared, writing the mapper or a test that checks a failure, or changing a code's value.
**Not this doc:** why failures are returned instead of thrown (`error-handling/result-type.md`); choosing between `enum`, `as const` and a literal union in general (`js-runtime/enums-and-literal-unions.md`); how a code becomes an HTTP status and body (`web-apis/http-error-mapping.md`).

## Problem
In the stack reference v3.1.0, `"version-conflict"` was written in the entity, the storage port, the in-memory adapter, the use case's error type, the mapper and two tests. The compiler finds the typed copies when a member of a literal union changes, but each one still needs an edit, and copies in test assertions are not typed at all. The opposite risk is just as real: if a value can be changed in one place, a well-meant rename can silently change the problem `type` that clients match on.

## Mental model
**Analogy:** a shop's price codes. Each department prints its own codes once, in its own catalog (the domain's rules, the application's lookups, the shop front's form checks). The till's master list copies every catalog page, adding the front's codes. Staff say "code NotFound", never the number. Customers, though, keep the printed numbers on their receipts. So the shop keeps one old receipt in a drawer (the contract test) and checks it against the master list before any number changes.

**Artifact:** the three declarations in the stack reference v4.0.0.
```ts
// src/modules/documents/domain/document/DocumentError.ts — the aggregate's own refusals
export const DocumentError = {
  /** The body is longer than the document's maximum length. */
  InvalidBody: "invalid-body",
  /** The caller's expected version is not the current one: someone else revised the document first. */
  VersionConflict: "version-conflict",
} as const;
export type DocumentError = (typeof DocumentError)[keyof typeof DocumentError];

// src/modules/documents/application/LookupError.ts — shared by every use case that looks a document up
export const LookupError = { NotFound: "not-found" } as const;
export type LookupError = (typeof LookupError)[keyof typeof LookupError];

// src/modules/documents/interface/errors/HttpErrorMapper.ts — everything a route can refuse
export const DocumentsRefusal = { ...DocumentError, ...LookupError, InvalidRequest: "invalid-request" } as const;
export type DocumentsRefusal = (typeof DocumentsRefusal)[keyof typeof DocumentsRefusal];
```

## How it works
**Actors**

| Actor | Role |
|---|---|
| Domain object (`DocumentError`) | Declares the codes for rules of one aggregate; sits in that aggregate's folder |
| Application object (`LookupError`) | Declares codes for failures no entity can know about, such as "no document has this id"; sits at the application layer root because several use cases share it |
| Interface object (`DocumentsRefusal`) | Spreads the other two and adds codes only the HTTP layer can produce (`InvalidRequest`) |
| Mapper (`HttpErrorMapper`) | Turns each code into a status, with a `Record` that must list every code |
| Contract test | Sends real requests and checks the problem `type` values written out literally |

**Flow of one refusal** (a stale `PUT /documents/:id`)

1. `Document.revise` returns `{ ok: false, error: DocumentError.VersionConflict }`; at runtime the value is the string `"version-conflict"`.
2. `ReviseDocument.run` passes the result on; its error type is `LookupError | DocumentError`.
3. The handler calls `mapper.problemFor(result.error)`. The mapper looks the code up in its `Record` (`[DocumentsRefusal.VersionConflict]: StatusCodes.CONFLICT`) and builds the problem `type` `/problems/version-conflict`.
4. The client receives `409` with that `type`. Clients must use `type` as the problem's identifier. ✅[^1]

**The rules, one by one**

1. **Declare a code in the layer that owns the failure.** The layer rule decides the direction: the interface may import the application and the domain, the domain imports neither. So a domain rule cannot use a code from `application/`, and `DocumentsRefusal` can collect everything. The folder follows the placement rule: an aggregate folder for one aggregate's codes, the layer root for codes several use cases share (`use-case-folders.md`).
2. **Give the object and its type the same name.** `DocumentError` is both the value (`DocumentError.InvalidBody`) and the type of any one of its values. TypeScript keeps values and types in separate namespaces, so this compiles and reads as one name. Tested on the stack reference, TypeScript 6.0.3.
3. **Keys are PascalCase names for code; values are kebab-case**, because each value becomes the end of a problem `type` URL (`/problems/invalid-body`).
4. **Wider sets spread narrower ones.** `{ ...DocumentError, ...LookupError, InvalidRequest: "invalid-request" } as const` keeps every value's literal type, and each value still exists in one file only. Tested 2026-10-28.
5. **Type a result by what it can really return.** One member: `typeof DocumentError.InvalidBody` (`Document.create`). A whole set: `DocumentError` (`Document.revise`). Several sets: `LookupError | DocumentError` (`ReviseDocument.run`). The caller then sees exactly which codes to handle.
6. **The mapper's `Record` must list every code.** With computed keys (`[DocumentsRefusal.NotFound]: …`), deleting one entry failed `tsc` with `TS2741`. Tested 2026-10-28.
7. **Doc comments link the key, not the text.** Write `{@link LookupError.NotFound}`, not `` `not-found` ``, so the comment follows a renamed value. The editor resolves such a link to the property, but only where the object is in scope, which in practice means a file that already depends on it. Linking a caller fails: `DocumentError.ts` once linked `Document`, which imports it, and the link showed as plain text (`code-documentation/doc-comments.md`).
8. **Unit tests use the keys; the contract test uses the literal values.** A unit test checks behavior (`error: LookupError.NotFound`) and keeps passing when a value changes. The HTTP contract test checks what clients see (`"/problems/not-found"`), so it is the one that fails.
9. **A changed value is an API change.** Clients identify a problem by its `type` URI. ✅[^1] Changing `"version-conflict"` to another string breaks every client that matches on it, even though the code change is one line.
10. **At runtime the object is a list as well.** `Object.values(X)` lists the codes, and zod's `z.enum(X)` accepts the object directly (zod 4.6.7, tested 2026-10-28).
11. **No `enum`.** It is not erasable, so Node's type stripping rejects it; lint's `noEnums` selector bans it (TSN-20, `js-runtime/enums-and-literal-unions.md`).

**Cross-side interactions**

| Change | Effect elsewhere |
|---|---|
| Add a key to `DocumentError` | `DocumentsRefusal` gains it through the spread; the mapper fails `tsc` until it has a status for it |
| Change a value in `DocumentError` | All code and unit tests follow; the contract test for that status fails |
| Rename a key | An editor rename updates every use; nothing on the wire changes |
| Remove a key | Every use fails `tsc`; the mapper entry must go too |

## Worked example
Renaming `"version-conflict"` to `"edit-conflict"` in the stack reference v4.0.0 (run 2026-10-28, TypeScript 6.0.3, Vitest):

| Step | Action | Result |
|---|---|---|
| 1 | Edit one line in `DocumentError.ts`: `VersionConflict: "edit-conflict"` | One file changed |
| 2 | `tsc --noEmit` | Passes: every use goes through the key |
| 3 | Unit tests | 16 of 16 pass: they compare with `DocumentError.VersionConflict` |
| 4 | Integration (contract) tests | 1 fails: "answers 409 for a stale version" expected `/problems/version-conflict` |
| 5 | Decide | This is an API change. Either keep the old value, or change the contract test on purpose and announce the new problem type to clients |

Before v4.0.0 the same change meant editing 9 raw strings in 7 files, with the compiler pointing at the typed ones and the unit tests at the rest.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Two spread objects have the same key | No error: the later value silently wins, and the earlier value leaves the set | Spread overwrites. Tested 2026-10-28: the mapper then rejected an entry for the lost value with `TS2353`, so a mapper that lists every value catches it |
| Two keys have the same value | The mapper fails with `TS1117` (duplicate property) | Computed keys resolve to the same literal. Tested 2026-10-28 |
| A test writes the raw value (`error: "not-found"`) | It passes today and breaks on the next value change | Only the contract test should write values; unit tests use keys |
| A code is used in one file only (an internal parser state) | An `as const` object is optional; a literal union is fine | The one-edit gain needs more than one place (`enums-and-literal-unions.md`) |
| The domain needs "not found" | Return `undefined` or a domain code; do not import `LookupError` | The domain imports no other layer |
| Another module needs the same code text | It declares its own object | A module's codes are its own; `modules/shared/` holds only codes every module shares |
| A client stores the value (logs, dashboards, retry rules) | No compiler or test in this repo sees it | Only versioning and announcing protects them. ✅[^1] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Raw strings with literal-union types | Nothing to import; the value is visible at every use | Each value written many times (35 in 16 files in the reference); untyped copies in tests |
| **`as const` objects per owning layer** | One edit per value; layer ownership visible; mapper still checked for completeness; runtime list | An import per use; two declarations per set; a value change is easy to make by accident, so the contract test must keep literal values |
| One module-wide object in the domain | One file to read | The domain would declare HTTP-only codes such as `invalid-request`, against the layer rule |
| `enum` | Familiar | Not erasable; Node rejects it ✅[^2] |

## Takeaways
- Declare each error code once, as a key of an `as const` object with a same-name derived type, in the layer that owns the failure; wider layers spread the narrower objects. [rule-candidate]
- Use the keys in code, doc comments and unit tests; write the values out only in the HTTP contract test, because a changed value is an API change. [rule-candidate]

## Used by
- _Not cited by any rule yet._ TSN-20 (stack `typescript-node`) states the rule; its Source is `js-runtime/enums-and-literal-unions.md`.

## Verification status
- Verified: 4 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-28

## References
- [RFC 9457: Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html) — IETF, 2023. Backs: How it works flow step 4 and rule 9, Edge cases (§3.1.1: consumers must use the `type` URI as the problem type's primary identifier). [^1]
- [Node.js: Modules: TypeScript](https://nodejs.org/api/typescript.html) — Node.js project, living. Backs: Trade-offs (`enum` needs transformation, so type stripping rejects it). [^2]
- `conanjs/agentic-sdlc-reference-typescript-node` v4.0.0 — `domain/document/DocumentError.ts`, `application/LookupError.ts`, `interface/errors/HttpErrorMapper.ts`, `test/integration/documents.int.test.ts`; every measurement above was run there on 2026-10-28.
- `copilot/frameworks/agentic-sdlc/stacks/typescript-node/idioms.md` — TSN-4 (Results), TSN-11 (one mapper), TSN-20 (the rule).

## Related
- `error-handling/result-type.md` — the `Result` these codes travel in.
- `js-runtime/enums-and-literal-unions.md` — the general choice between `enum`, `as const` and literal unions, with the emit sizes and the rename experiment.
- `web-apis/http-error-mapping.md` — from code to status and RFC 9457 body.
- `code-documentation/doc-comments.md` — why `{@link}` must point at something in scope.
- `software-design/architecture-styles/use-case-folders.md` — the placement rule that decides which folder holds each object.
