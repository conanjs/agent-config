---
schema: knowledge-doc/v1
type: concept
topic: js-runtime
status: verified
applies-to: ["TypeScript 5.8+", "Node.js type stripping (22.18+, 23.6+)"]
last-verified: 2026-10-28
last-updated: 2026-10-28
tags: [enum, as-const, string-literal-union, erasable-syntax, refactoring, type-stripping]
---

# Enums, `as const` objects and string literal unions

## Summary
**TL;DR:** TypeScript offers four ways to name a closed set of string values: `enum`, an `as const` object or an `as const` array with a derived type, and a plain string literal union. Memory is not the deciding factor: the difference is one small object per module, created once at load. The deciding factors are (1) `enum` is not erasable, so Node's built-in type stripping and the `erasableSyntaxOnly` flag reject it; (2) whether the set needs a runtime value (iterate it, validate input against it); (3) whether code refers to members by a name that is separate from the value; and (4) whether the project owns the values and writes them in several files. Codes the project owns and repeats (error reasons, statuses) belong in an `as const` object, so a value changes in one edit; the stack reference wrote its four reasons 35 times in total, in 16 files, before it moved to objects (measured below). A literal union stays for fixed vocabularies nobody renames, such as `asc` or `desc`.
**Use this when:** choosing how to model error reasons, statuses or modes; reviewing a proposal to replace string literals with an enum.
**Not this doc:** numeric flags and bit masks; zod's `z.enum`, which is a runtime schema, not a TypeScript enum; the full error-code pattern (which layer declares each object, the mapper, doc links, tests), in `error-handling/error-codes.md`.

## Problem
A string such as `"not-found"` appears in several files. Changing it means editing every copy: the compiler finds the typed ones, but each still needs an edit, and untyped copies in tests are found only when the tests run. An enum or constant object keeps the value in one place, but enums carry their own runtime costs and tool restrictions.

## Mental model
**Analogy:** a literal union is a printed list of allowed words that the compiler checks every sentence against. An `as const` object is the same list plus a phone book that maps short nicknames to the words. A TypeScript `enum` is the phone book written in a dialect only TypeScript's own compiler can translate.

**Artifact:**
```ts
// 1. enum: not erasable
export enum DocumentsError { NotFound = "not-found", VersionConflict = "version-conflict" }

// 2. as const object + derived type (the handbook's alternative)
export const DocumentsError = { NotFound: "not-found", VersionConflict: "version-conflict" } as const;
export type DocumentsError = (typeof DocumentsError)[keyof typeof DocumentsError];

// 3. literal union: erased completely
export type DocumentsError = "not-found" | "version-conflict";
```

## How it works
1. A TypeScript `enum` compiles to an object built by an IIFE; numeric enums also get a reverse mapping, string enums do not. ✅[^1]
2. The TypeScript handbook says that in modern TypeScript an object with `as const` may be enough instead of an enum, and that it keeps code aligned with JavaScript. ✅[^1] The handbook's own example derives the type with `typeof X[keyof typeof X]`. ✅[^1]
3. `const enum` inlines values but conflicts with `isolatedModules` when shared across projects; the handbook suggests not using const enums at all, or not publishing ambient ones. ✅[^1]
4. TypeScript 5.8's `--erasableSyntaxOnly` reports enums, runtime namespaces, parameter properties and `import =` aliases, because Node's type stripping can only delete types, not transform syntax. ✅[^2]
5. Node.js strips types by default (since 22.18.0 and 23.6.0) and lists `enum` declarations as the most prominent syntax that needs transformation and therefore errors. ✅[^3]
6. Measured emit, transpiled with TypeScript 6.0.3 to CommonJS for a three-member set: `enum` 387 bytes, `as const` object 228 bytes, literal union 77 bytes (only the module header; the type is gone). Tested 2026-10-28. Each object is created once when the module loads, so per-request cost is the same for all three.
7. Renaming a literal union member: the language service's rename and Find References on `"not-found"` inside `ReviseDocumentError` found only the 2 occurrences in the same file, not the mapper key or other use cases. Changing the member and running `tsc --noEmit` reported every typed use that broke, across 5 files (the use case's return, the mapper's `Record` key, three handlers). Test assertions written as `toEqual({ ok: false, error: "not-found" })` are not typed against the union; `tsc` missed them, and the unit test run failed on them instead. Tested 2026-10-28 on the stack reference v3.1.0, TypeScript 6.0.3, Vitest.
8. A fourth form, an `as const` **array** with the type derived by `(typeof X)[number]`, gives a runtime list with one declaration when names equal values. Tested 2026-10-28 with TypeScript 6.0.3 and zod 4.6.7 on the stack reference: `z.enum(DOCUMENT_STATUSES)` accepted the array, its parse result was assignable to the derived type, and assigning `"deleted"` failed with `TS2322` (not assignable to `"draft" | "published" | "archived"`).
9. Renaming an `as const` object's key is a symbol rename: the editor changes every `DocumentsError.NotFound` use in one step. Changing its value changes it everywhere too, including any wire output built from it. *(Standard language-service behavior; not separately measured here.)*
10. **Measured on the stack reference, v3.1.0 to v4.0.0** (TypeScript 6.0.3, Vitest, 2026-10-28). Before: the four reason values were written as raw strings 35 times in 16 files, in every layer (entity, port, adapter, use cases, mapper, handlers) and in the unit tests. After: each value is written once, in `DocumentError` (`domain/document/`), `LookupError` (`application/`) and `DocumentsRefusal` (`interface/errors/`, which spreads the other two and adds `InvalidRequest`). Changing `VersionConflict`'s value from `version-conflict` to another string was a one-line edit: `tsc` and all 16 unit tests passed, and only the HTTP contract test that expects `/problems/version-conflict` failed. The mapper keeps its completeness check with computed keys (`[DocumentsRefusal.NotFound]: …`): deleting one entry failed `tsc` with `TS2741`. The whole pattern, with its edge cases: `error-handling/error-codes.md`.

## Worked example
Should `ReviseDocumentError = "not-found" | "version-conflict" | "invalid-body"` become an object? (Stack reference v3.1.0; decided 2026-10-28.)

| Question | Answer for this code |
|---|---|
| Is the value visible outside the process? | Yes: it becomes the problem `type` `/problems/not-found` (RFC 9457) |
| So is changing the value a refactor? | No, it is an API change; clients may match on it |
| Does code need the set at runtime (iterate, validate)? | No; the mapper's `Record<DocumentsRefusal, number>` already forces one entry per reason |
| Is there a separate display name? | No; the title comes from the HTTP status phrase |
| How many places write each value? | 35 raw strings in 16 files, in every layer and the tests (measured above) |
| Does the project own the values, and might one change? | Yes: they are this API's own reason codes |
| Verdict | **An `as const` object per owning layer.** One edit changes a value. Because a changed value is an API change, the HTTP contract test keeps the wire values literal, so the change fails there and is a deliberate decision |

The first four rows alone favour the literal union: the compiler does find every typed use. The last two decide it: finding 35 copies still means editing all of them, and the measurement above confirmed the one-edit change and the contract-test guard.

Where another form would win: a fixed vocabulary validated at runtime (an `as const` array feeding `z.enum`), or a set written in one file only (a literal union).

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `enum` in code run by `node --experimental-strip-types` or default type stripping | Error at startup | Enum needs transformation ✅[^3] |
| `enum` with `erasableSyntaxOnly: true` | Compile error | The flag targets non-erasable syntax ✅[^2] |
| Literal union value written in an untyped place (`toEqual`, JSON fixtures, other repos) | `tsc` cannot see it | Only contextually typed literals are checked (measured above) |
| Same text in two separate unions (`GetDocument`'s `"not-found"` and `ReviseDocument`'s, reference v3.1.0) | Independent types; renaming one leaves the other | Each union is its own type (measured above) |
| Turning on `erasableSyntaxOnly` to ban enums in the stack reference | 23 errors, all `TS1294` on constructor parameter properties (`constructor(private readonly documents: DocumentStore)`); no enum existed | The flag bans parameter properties too ✅[^2]. Tested 2026-10-28 on reference v3.1.0, TypeScript 6.0.3. A lint selector bans only enums: `no-restricted-syntax` with `TSEnumDeclaration` reported a planted enum in both a module file and a shared file, tested the same day. The reference adopted it as `noEnums` in v4.0.0, where planted enums in a use case, a domain file, a shared file, `main.ts`, a unit test and `test/support/` were all reported |
| `as const` object without the derived type | Members typed, but no type to annotate parameters | The type must be derived with `typeof X[keyof typeof X]` ✅[^1] |
| Unit tests compare with the object (`error: LookupError.NotFound`) | A changed value still passes them | They follow the object by design; only a contract test with literal values catches a wire change (measured above) |
| A wider set needs the values of narrower ones | Spread them: `{ ...DocumentError, ...LookupError, InvalidRequest: "invalid-request" } as const` | Each value still exists once; the spread keeps the literal types (measured above) |
| A function returns only one member of the set | Type it as `typeof DocumentError.InvalidBody` | The member's own literal type, without writing the string |

## Trade-offs
**Which to use:** read the last column first.

| Option | Gains | Costs | Pick when |
|---|---|---|---|
| `enum` | Familiar to C#/Java readers; one name for value and type | Not erasable ✅[^2]; Node's type stripping rejects it ✅[^3]; extra emit (measured above) | Never in new code. Existing enums: replace with one of the rows below when the file is next changed |
| `as const` object + derived type `(typeof X)[keyof typeof X]` | **One place to change a value** (measured above); a runtime list (`Object.values(X)`); code names separate from values; erasable | Two declarations; callers import the object; changing a value in one place changes any wire output built from it, so contract tests must keep the wire values literal | **Default for codes the project owns and writes in more than one file** (error reasons, statuses), or when the name in code differs from the value (`Admin: "ROLE_ADMIN"`) |
| `as const` array + derived type `(typeof X)[number]` | A runtime list with one declaration; `z.enum(X)` accepts it (measured above); erasable | No separate code names; callers that need the list import the array | A fixed vocabulary needed **at runtime** |
| String literal union | Zero emit; erasable; the value is readable at every use; `tsc` lists every typed use a rename breaks (measured above) | No runtime list; untyped copies (test assertions, JSON fixtures) are found by tests, not the compiler | **Default for fixed vocabularies** nobody renames (`asc` or `desc`, HTTP methods) and for sets written in one file only |

Note `keyof typeof X` gives the *keys* (`"NotFound"`); the value type needs the indexed access `(typeof X)[keyof typeof X]` ✅[^1].

**Typical sets and their form:**

| Set | Owned and written in several files? | Needed at runtime? | Code name differs from value? | Form |
|---|---|---|---|---|
| A module's failure reasons (`"not-found"`, `"version-conflict"`) | Yes: entity, ports, use cases, mapper, tests | No | No | `as const` object |
| A status read from a request body or a database row (`"draft"`, `"published"`) | Yes | Yes: a zod schema validates it | No | `as const` object (`z.enum(X)` accepts the object: with zod 4.6.7 it parsed `"draft"`, rejected `"x"`, and its result was assignable to the derived type; tested 2026-10-28) |
| The `kind` tag of a union of shapes, used in one file (`{ kind: "text" }` or `{ kind: "image" }`) | No | No; checking `kind` narrows the type | No | Literal union |
| A function option (`order: "asc"` or `"desc"`) | No: a fixed vocabulary | No | No | Literal union |
| A fixed vocabulary a UI lists, or a test checks one by one | No | Yes: the code iterates over them | No | `as const` array |
| A role whose external value is `"ROLE_ADMIN"`, or HTTP status numbers named `NotFound: 404` | Usually | Sometimes | Yes | `as const` object |

**Moving from a union to an array or an object later is cheap.** For a fixed vocabulary, start with a literal union. Suppose a request body later sends a status, so a zod schema must check it against the list:

```ts
// Before: types only
export type DocumentStatus = "draft" | "published" | "archived";

// After: the list exists at runtime, and the type keeps its name
export const DOCUMENT_STATUSES = ["draft", "published", "archived"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];
```

Only this one file changes. Code such as `function publish(status: DocumentStatus)` or `status === "draft"` still compiles, because `DocumentStatus` is the same set of strings with the same name. Only the new schema imports `DOCUMENT_STATUSES`. So nothing is lost by starting with the simplest form. The same holds for an object: `export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus]` keeps the name, although code that wrote raw strings should then switch to the keys. *(Analysis, ours; the derived types were tested above.)*

**The stack reference declares its failure reasons as objects from v4.0.0** (`DocumentError`, `LookupError`, `DocumentsRefusal`; worked example above). Before that, v3.1.0 used literal unions; nothing read the list at runtime, but each value was written in up to 12 places.

## Takeaways
- Do not use TypeScript `enum`; it is not erasable. Declare codes the project owns and writes in several files as an `as const` object in the layer that owns them, use the keys in code, and keep wire values literal in contract tests. Use a literal union for fixed vocabularies, and an `as const` array when such a vocabulary is needed at runtime. Ban enums with a lint selector, not with `erasableSyntaxOnly`, while the code uses parameter properties. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| stack idiom | TSN-20 | Source: |

## Verification status
- Verified: 13 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-28

## References
- [TypeScript Handbook: Enums](https://www.typescriptlang.org/docs/handbook/enums.html) — TypeScript team, living. Backs: How it works 1–3, Edge cases. [^1]
- [Announcing TypeScript 5.8: `--erasableSyntaxOnly`](https://devblogs.microsoft.com/typescript/announcing-typescript-5-8/) — Microsoft, 2025. Backs: How it works 4, Trade-offs. [^2]
- [Node.js: Modules: TypeScript](https://nodejs.org/api/typescript.html) — Node.js project, living. Backs: How it works 5, Edge cases. [^3]
- `copilot/frameworks/agentic-sdlc/stacks/typescript-node/idioms.md` — `idiom.errors`, the literal-union reasons.
- `conanjs/agentic-sdlc-reference-typescript-node` v3.1.0 — `src/modules/documents/interface/errors/HttpErrorMapper.ts`, the measured rename.

## Related
- `error-handling/result-type.md` — where the reason literals come from.
- `error-handling/error-codes.md` — the error-code pattern in full: which layer declares each object, spreading, typing, the mapper, doc links and tests.
- `web-apis/http-error-mapping.md` — why the reason is wire-visible.
