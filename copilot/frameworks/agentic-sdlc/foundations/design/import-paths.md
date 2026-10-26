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
| IMP-1 | A relative path may name only a file in the importing file's own folder (`./role`). Any other folder, whether parent, sibling or child, is reached through an alias (IMP-2). One mechanical rule, so no judgment about module edges is needed and nothing can drift. | No relative reference contains a parent step or a folder | `../errors`, `../../domain/role`, `./http/createApp` from a root file | lint | — |
| IMP-2 | Every reference outside the file's own folder goes through the alias of its layer or module, or the target module's public entry point (MOD-3, FF-1). The same rule applies to production code and tests. | Every non-same-folder import uses an alias or entry point | `../../infrastructure/pg-role-repository` from `application/`; `../support/fixtures` in a test | lint | — |
| IMP-3 | Import another module only through its public entry point (MOD-3, FF-3); never its internal files. | No import targets a non-public path of another module | `@/roles/internal/role-validator` from another module | script | — |
| IMP-4 | An alias resolves identically wherever code runs: type-check, build output at runtime, tests and the dev runner. One definition is the source for all of them. | Each alias is exercised by a smoke check that imports it from the built output and from tests | An alias the type checker accepts but the runtime cannot find | script | — |
| IMP-5 | An index file or barrel exists only as a module's public surface and re-exports only that surface. Internal folders have none. | Each barrel lists exactly the module's public API | An `index.ts` in an internal folder that re-exports every file | llm | — |
| IMP-6 | No circular imports between files, modules or layers (MOD-2, FF-2). | The import graph is acyclic | `role.ts` and `permission.ts` import each other | script | — |
| IMP-7 | Aliases are declared once, one per layer or module, as the `alias:` key of its entry in `docs/architecture.md` §4, and use a distinct prefix so they cannot be mistaken for a package name. | Every alias in config appears in §4, and every §4 alias appears in config | An ad hoc alias added in one file's config only | llm | — |
| IMP-8 | Boundary lint rules and the alias config are generated from or checked against `docs/architecture.md` §4 (FF-1). | Changing the architecture file changes the checks in the same change | Layer rules edited by hand and drifting from the documented layers | script | — |

## Interpreting

**When each form is right.** Examples write the alias prefix as `@/`. The stack decides the real mechanism and prefix (TypeScript: TSN-15 and its Options).

| Situation | Use | Example |
|---|---|---|
| Same folder | `./` | `./role` |
| Sibling or parent folder inside one layer | alias | `@/domain/value-objects/permission-key` |
| Child folder (e.g. the composition root reaching into a layer) | alias | `@/http/createApp` |
| Another layer of the same module | alias | `@/domain/role` |
| Another module | alias to its public entry | `@/billing` |
| Test reaching production code or a test helper | alias | `@/core/domain/Role`, `@/test/support/fixtures` |
| Third-party package | package name | `zod` |

**Allowed exceptions.** Only files the alias mechanism cannot serve: tool configuration at the repo root and scripts run before or without the build. Each exception is listed with its reason in `docs/architecture.md` §4 and excluded by name from the lint rule. Anything else is a finding.

**Which alias mechanism.** Any mechanism works if every tool resolves it the same way: the type checker, the dev runner, the test runner, the lint resolver and the built program (IMP-4). That leaves two kinds: the runtime owns the mapping, or the build rewrites aliases into real paths. Which one, and so the prefix, is a stack Option chosen per repo (TypeScript: TSN-15). Either way the prefix must not read as a package name (IMP-7): a bare `core/role` is looked up as an installed package called `core`.

**The type-checker-only alias pitfall (IMP-4).** Many type checkers let you declare aliases that only inform the checker. They do not change the import text in the emitted code, so the check passes and the program crashes with "module not found". In TypeScript this is the `paths` setting: it does not change the emitted import path, so aliases that type-check can fail at runtime unless a runtime resolver knows the same mapping or the build rewrites them.

```json
{ "compilerOptions": { "paths": { "@domain/*": ["./src/domain/*"] } } }
```

```js
// emitted JavaScript still contains: import { Role } from "@domain/role"
// Node cannot resolve "@domain/role" → runtime error
```

Two fixes: let the runtime own the mapping (Node: the `imports` field of `package.json`), or let the build rewrite the aliases into real paths in its output. Each stack documents its options with a tested configuration; see `stacks/typescript-node/idioms.md` (TSN-15, TSN-16).

**Boundary checks must resolve aliases (IMP-4, IMP-8).** A lint rule or a custom import scan that cannot resolve a specifier usually skips it. That means introducing aliases can turn an enforced boundary into an unchecked one with no error at all. Concrete case: a test named "http does not import store (relative path or alias)" that resolves only paths starting with `.` passes an aliased import of `store`. Treat an unresolved internal specifier as a failure, and add one deliberately violating aliased import to the check's own test.

**Adopting in an existing repo.** Converting the relative imports is one mechanical task (`../code/refactoring.md`), done for the whole repo at once. Half-converted code is the drift this rule exists to prevent: one reviewed repo had 279 alias imports next to 190 relative ones that crossed folders. The lint rule is switched to `error` in the same change.

**Barrels.** A barrel is useful at the edge of a module because it is the public surface (MOD-3). Inside a module it hides real dependencies and creates cycles (IMP-6), so do not add one per folder.

**Resolving a violation**

1. Importing a sibling's internals? Export what is needed from that module's entry point, or move the code.
2. Needing a relative path outside the folder? Use the alias. If no alias reaches the target, the file likely sits in the wrong module (`module-boundaries.md`), or the layer is missing its alias (IMP-7).
3. A cycle? Extract the shared concept into the layer below both, or invert one edge with a port (`clean-architecture.md`).

## Tensions

| Rule A | Rule B | Default resolution |
|---|---|---|
| IMP-1, IMP-2 aliases everywhere | Move-friendly relative imports inside a module | Aliases win. Moving a folder means a search-and-replace on one alias prefix. A rule that needs a judgment about where a module ends drifts in practice. |
| IMP-5 barrels | IMP-6 no cycles | Import from the barrel only across modules; inside a module import the file directly through its alias. |
| IMP-7 one alias table | Small repos | Every repo with more than one folder of source declares aliases. The cost is one config entry per layer. |

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/schemas/foundation.schema.md`: schema and required structure for this foundation.
- `copilot/frameworks/agentic-sdlc/schemas/_system.md`: shared rule-table, id, path and references rules.
- `foundations/design/import-paths.md`: this foundation file.
- `stacks/typescript-node/idioms.md`: TSN-15 to TSN-17 give the Node and TypeScript configuration and lint rules.

**External authoritative sources:**
- [Node.js packages, "Subpath imports"](https://nodejs.org/api/packages.html#subpath-imports) — `imports` entries must start with `#` and apply only inside the package.
- [TypeScript Modules Reference, "paths does not affect emit"](https://www.typescriptlang.org/docs/handbook/modules/reference.html) — path aliases that type-check can crash at runtime unless the runtime or the build resolves them.
- [TypeScript TSConfig reference, `paths`](https://www.typescriptlang.org/tsconfig/) — the option "does not change how import paths are emitted".
- [Google TypeScript Style Guide, "Imports"](https://google.github.io/styleguide/tsguide.html) — prefers relative imports within a project. Deliberately not followed here (see Tensions): one mechanical rule is chosen over move-friendliness.
- Knowledge: `knowledge/js-runtime/subpath-imports.md` — why Node aliases start with `#`, and the alternatives.
- Robert C. Martin, *Clean Architecture* (2017) — acyclic dependencies principle.

## Related

- `module-boundaries.md` — MOD-2, MOD-3: the rules these path rules implement.
- `../review/fitness-functions.md` — FF-1, FF-2, FF-3: automated boundary checks.
- `clean-architecture.md` — layer direction.
- `../code/naming.md` — file name equals primary type.
