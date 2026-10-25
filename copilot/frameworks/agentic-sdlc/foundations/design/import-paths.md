---
schema: foundation/v2
last-updated: 2026-10-25
rule-prefix: IMP
subject: design
---

# Import Paths

How one source file refers to another: when a relative path is fine, when it must go through a stable alias or a module's public entry point, and how aliases stay valid at type-check time and at runtime. Analogy: a street address versus "go up two floors, left, then down the stairs": addresses survive a rebuild, directions do not. Layers and the allowed dependency graph come from `module-boundaries.md`; this file governs the path text. Reviews cite `IMP-n`.

## Rules

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| IMP-1 | Same-folder references use `./`. A parent step (`../`) climbs at most one level and stays inside the same module. | No reference has two or more parent steps | `../../../domain/role` | llm (fallback) | — |
| IMP-2 | Crossing a layer or module boundary goes through a stable alias or the target module's public entry point, never a relative path through folders (MOD-3, FF-1). | Every cross-boundary import uses an alias or entry point | `../../infrastructure/pg-role-repository` from `application/` | script | — |
| IMP-3 | Import another module only through its public entry point (MOD-3, FF-3); never its internal files. | No import targets a non-public path of another module | `#roles/internal/role-validator` from another module | script | — |
| IMP-4 | An alias resolves identically wherever code runs: type-check, build output at runtime, tests and the dev runner. One definition is the source for all of them. | Each alias is exercised by a smoke check that imports it from the built output and from tests | An alias the type checker accepts but the runtime cannot find | script | — |
| IMP-5 | An index file or barrel exists only as a module's public surface and re-exports only that surface. Internal folders have none. | Each barrel lists exactly the module's public API | An `index.ts` in an internal folder that re-exports every file | llm | — |
| IMP-6 | No circular imports between files, modules or layers (MOD-2, FF-2). | The import graph is acyclic | `role.ts` and `permission.ts` import each other | script | — |
| IMP-7 | Aliases are declared once, one per layer or module, as the `alias:` key of its entry in `docs/architecture.md` §4, and use a distinct prefix so they cannot be mistaken for a package name. | Every alias in config appears in §4, and every §4 alias appears in config | An ad hoc alias added in one file's config only | llm | — |
| IMP-8 | Boundary lint rules and the alias config are generated from or checked against `docs/architecture.md` §4 (FF-1). | Changing the architecture file changes the checks in the same change | Layer rules edited by hand and drifting from the documented layers | script | — |

## Interpreting

**When each form is right**

| Situation | Use | Example |
|---|---|---|
| Same folder | `./` | `./role` |
| Sibling folder inside one module | one `../` | `../value-objects/permission-key` |
| Another layer of the same module | alias | `#domain/role` |
| Another module | alias to its public entry | `#billing` |
| Third-party package | package name | `zod` |

**The type-checker-only alias pitfall (IMP-4).** Many type checkers let you declare aliases that only inform the checker. They do not change the import text in the emitted code, so the check passes and the program crashes with "module not found". In TypeScript this is the `paths` setting: it does not change the emitted import path, so aliases that type-check can fail at runtime unless a runtime resolver knows the same mapping.

```json
{ "compilerOptions": { "paths": { "@domain/*": ["./src/domain/*"] } } }
```

```js
// emitted JavaScript still contains: import { Role } from "@domain/role"
// Node cannot resolve "@domain/role" → runtime error
```

The fix is to let the runtime own the mapping and the checker follow it. For Node and TypeScript the platform's own mechanism is the `imports` field of `package.json`, with keys starting with `#`; see `stacks/typescript-node/idioms.md` (TSN-15, TSN-16). Other stacks use their module system's equivalent.

**Boundary checks must resolve aliases (IMP-4, IMP-8).** A lint rule or a custom import scan that cannot resolve a specifier usually skips it. That means introducing aliases can turn an enforced boundary into an unchecked one with no error at all. Concrete case: a test named "http does not import store (relative path or alias)" that resolves only paths starting with `.` passes `import … from "#store/…"`. Treat an unresolved internal specifier as a failure, and add one deliberately violating aliased import to the check's own test.

**Adopting in an existing repo.** IMP-1 and IMP-2 apply to new and touched files. Rewriting existing deep relative imports is its own task (`../code/refactoring.md`). Do not switch the lint rule to `error` until that task lands.

**Barrels.** A barrel is useful at the edge of a module because it is the public surface (MOD-3). Inside a module it hides real dependencies and creates cycles (IMP-6), so do not add one per folder.

**Resolving a violation**

1. Importing a sibling's internals? Export what is needed from that module's entry point, or move the code.
2. Needing `../../`? The file likely sits in the wrong module (`module-boundaries.md`) or needs an alias.
3. A cycle? Extract the shared concept into the layer below both, or invert one edge with a port (`clean-architecture.md`).

## Tensions

| Rule A | Rule B | Default resolution |
|---|---|---|
| IMP-2 aliases | Move-friendly relative imports | Relative inside a module, alias across modules; a module can move without edits to its own files. |
| IMP-5 barrels | IMP-6 no cycles | Import from the barrel only across modules; inside a module import files directly. |
| IMP-7 one alias table | Small repos | A single-module repo may skip aliases if it has no cross-layer imports beyond one `../`; record this simplification under MOD-8. |

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/schemas/foundation.schema.md`: schema and required structure for this foundation.
- `copilot/frameworks/agentic-sdlc/schemas/_system.md`: shared rule-table, id, path and references rules.
- `foundations/design/import-paths.md`: this foundation file.
- `stacks/typescript-node/idioms.md`: TSN-15 to TSN-17 give the Node and TypeScript configuration and lint rules.

**External authoritative sources:**
- [Node.js packages, "Subpath imports"](https://nodejs.org/api/packages.html#subpath-imports) — `imports` entries must start with `#` and apply only inside the package.
- [TypeScript Modules Reference, "paths does not affect emit"](https://www.typescriptlang.org/docs/handbook/modules/reference.html) — path aliases that type-check can crash at runtime; `package.json` `imports` is the standard replacement.
- [TypeScript TSConfig reference, `paths`](https://www.typescriptlang.org/tsconfig/) — the option "does not change how import paths are emitted".
- [Google TypeScript Style Guide, "Imports"](https://google.github.io/styleguide/tsguide.html) — prefer relative imports within a project and limit parent steps.
- Robert C. Martin, *Clean Architecture* (2017) — acyclic dependencies principle.

## Related

- `module-boundaries.md` — MOD-2, MOD-3: the rules these path rules implement.
- `../review/fitness-functions.md` — FF-1, FF-2, FF-3: automated boundary checks.
- `clean-architecture.md` — layer direction.
- `../code/naming.md` — file name equals primary type.
