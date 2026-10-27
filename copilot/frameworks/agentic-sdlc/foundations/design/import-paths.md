---
schema: foundation/v2
last-updated: 2026-10-27
rule-prefix: IMP
subject: design
---

# Import Paths

How one source file refers to another: when a relative path is fine, when it must go through a stable alias or a module's public entry point, and how aliases stay valid at type-check time and at runtime. Analogy: a street address versus "go up two floors, left, then down the stairs": addresses survive a rebuild, directions do not. Layers and the allowed dependency graph come from `module-boundaries.md`; this file governs the path text. Reviews cite `IMP-n`.

## Rules

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| IMP-1 | A relative path may name only a file in the importing file's own folder (`./role`). Any other folder, whether parent, sibling or child, is reached through an alias (IMP-2). One mechanical rule, so no judgment about module edges is needed and nothing can drift. | No relative reference contains a parent step or a folder | `../errors`, `../../domain/role`, `./http/createApp` from a root file | lint | — |
| IMP-2 | Every reference outside the file's own folder goes through the alias of its layer or module, and into another module only to a file on its public surface (MOD-3, FF-1). The same rule applies to production code and tests. | Every non-same-folder import uses an alias or entry point | `../../infrastructure/pg-role-repository` from `application/`; `../support/fixtures` in a test | lint | — |
| IMP-3 | Import another module only through the files on its public surface (MOD-3, FF-3); never its internal files. | No import targets a non-public path of another module | `@/roles/internal/role-validator` from another module | script | — |
| IMP-4 | An alias resolves identically wherever code runs: type-check, build output at runtime, tests and the dev runner. One definition is the source for all of them. | Each alias is exercised by a smoke check that imports it from the built output and from tests | An alias the type checker accepts but the runtime cannot find | script | — |
| IMP-5 | No barrel files in application code. A barrel is a file that only re-exports other files (`index.ts` with `export * from …`, a re-exporting `__init__.py`). Every import names the file that declares the symbol. A module's public surface is declared as a list of files in `docs/architecture.md` §4, or by the language's own visibility where it has one (Go `internal/`, C# `internal`, Rust `pub(crate)`), and enforced by checks (MOD-3), never by a re-export file. The one exception is a published library's package entry point (`package.json` `exports`, a Rust library's `lib.rs`), which exists for outside consumers. | No application file only re-exports; every cross-file import resolves to the declaring file | `src/documents/index.ts` with `export * from "./application/ReviseDocument.js"`; a `utils/index.ts` that re-exports every helper | llm (fallback); stacks add lint where a rule exists (TypeScript: TSN-18) | — |
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

**Barrels (IMP-5).** Until 2026-10-27 this file allowed a barrel at a module's edge as its public surface. It no longer does, for four reasons:
- **Cost.** Importing one name through a barrel makes tools load every file the barrel lists. Marvin Hagemeister traced this as a main reason JavaScript tooling slows down in large projects. Atlassian removed barrels from Jira's frontend and reported about 75% fewer CI build minutes per commit, roughly 50% faster local unit tests, and over 30% faster TypeScript highlighting.
- **Cycles.** A barrel imports every file of its module, so any file that imports the barrel back closes a cycle (IMP-6).
- **Upkeep.** The barrel is a second list of what is public, which must be kept in sync by hand. It has no primary type of its own (NAM-8).
- **Not needed.** Go, C#, Java and Rust application code declares visibility in the language and imports the declaring file. A list in `docs/architecture.md`, plus a lint zone, does the same job in TypeScript and Python.

Analogy: a barrel is a receptionist who must be told about every person in the building before anyone can visit them, and who calls the whole building whenever one visitor arrives. Instead, give the visitor the person's real office number, and keep a guard (lint) at the doors that are not public.

Concrete: `comments` needs a document. It imports `@/documents/application/GetDocument.js` directly. `docs/architecture.md` §4 lists `documents/application/*.ts`, excluding `ports/`, as the public surface of `documents`. A lint zone rejects `@/documents/domain/Document.js` from `comments`.

**Resolving a violation**

1. Importing a sibling's internals? Add the file to that module's public surface in `docs/architecture.md` §4 if it is a use case or its input/output type, or call a use case that is already public, or move the code.
2. Needing a relative path outside the folder? Use the alias. If no alias reaches the target, the file likely sits in the wrong module (`module-boundaries.md`), or the layer is missing its alias (IMP-7).
3. A cycle? Extract the shared concept into the layer below both, or invert one edge with a port (`clean-architecture.md`).

## Tensions

| Rule A | Rule B | Default resolution |
|---|---|---|
| IMP-1, IMP-2 aliases everywhere | Move-friendly relative imports inside a module | Aliases win. Moving a folder means a search-and-replace on one alias prefix. A rule that needs a judgment about where a module ends drifts in practice. |
| IMP-5 no barrels | Moving a public file | Consumers' import paths change when a public file moves. Accept it: a search-and-replace beats the cost of a barrel, and moving a public file is a visible API change anyway. |
| IMP-7 one alias table | Small repos | Every repo with more than one folder of source declares aliases. The cost is one config entry per layer. |

## References

**Local artifacts:**
- `copilot/frameworks/agentic-sdlc/schemas/foundation.schema.md`: schema and required structure for this foundation.
- `copilot/frameworks/agentic-sdlc/schemas/_system.md`: shared rule-table, id, path and references rules.
- `foundations/design/import-paths.md`: this foundation file.
- `stacks/typescript-node/idioms.md`: TSN-15 to TSN-18 give the Node and TypeScript configuration and lint rules (TSN-18: no re-exports).

**External authoritative sources:**
- [Node.js packages, "Subpath imports"](https://nodejs.org/api/packages.html#subpath-imports) — `imports` entries must start with `#` and apply only inside the package.
- [TypeScript Modules Reference, "paths does not affect emit"](https://www.typescriptlang.org/docs/handbook/modules/reference.html) — path aliases that type-check can crash at runtime unless the runtime or the build resolves them.
- [TypeScript TSConfig reference, `paths`](https://www.typescriptlang.org/tsconfig/) — the option "does not change how import paths are emitted".
- [Google TypeScript Style Guide, "Imports"](https://google.github.io/styleguide/tsguide.html) — prefers relative imports within a project. Deliberately not followed here (see Tensions): one mechanical rule is chosen over move-friendliness.
- Knowledge: `knowledge/js-runtime/subpath-imports.md` — why Node aliases start with `#`, and the alternatives.
- Robert C. Martin, *Clean Architecture* (2017) — acyclic dependencies principle.
- [Marvin Hagemeister, "Speeding up the JavaScript ecosystem – The barrel file debacle"](https://marvinh.dev/blog/speeding-up-javascript-ecosystem-part-7/) — barrels make tools load large module graphs (IMP-5).
- [Atlassian Engineering, "How We Achieved 75% Faster Builds by Removing Barrel Files"](https://www.atlassian.com/blog/atlassian-engineering/faster-builds-when-removing-barrel-files) (2025-06-26) — measured results of removing barrels from Jira's frontend (IMP-5).
- [Node.js packages, `exports`](https://nodejs.org/api/packages.html#exports) — a published package's entry points: the IMP-5 exception.

## Related

- `module-boundaries.md` — MOD-2, MOD-3: the rules these path rules implement.
- `../review/fitness-functions.md` — FF-1, FF-2, FF-3: automated boundary checks.
- `clean-architecture.md` — layer direction.
- `../code/naming.md` — file name equals primary type.
