---
schema: knowledge-doc/v1
type: concept
topic: js-runtime
status: verified
applies-to: ["Node ≥ 14.6 / 12.19", "TypeScript ≥ 4.7 (node16/nodenext/bundler resolution)"]
last-verified: 2026-10-30
last-updated: 2026-10-30
tags: [subpath-imports, package-json, imports, aliases, module-resolution]
---

# Subpath imports: why Node aliases start with `#`

## Summary
**TL;DR:** The `imports` field of `package.json` is Node's built-in alias table for code inside one package. Every key must start with `#`, so that an alias can never be mistaken for an installed package. A bare prefix like `core/role` is read as package `core`. TypeScript `paths` cannot fix that on its own, because it does not change the emitted code; it works only with a build step that rewrites the aliases, or a runtime hook.
**Use this when:** choosing an alias scheme for a Node or TypeScript repo, or someone asks why the imports look like `#core/domain/Role`.
**Not this doc:** making aliases work in tsx, Vitest and ESLint → framework `stacks/typescript-node/idioms.md`, "Import alias and lint configuration".

## Problem
Relative paths like `../../core/domain/Role` break when files move, and a team that allows some relative paths ends up with a mix: one reviewed repo had 279 alias imports next to 190 relative imports that crossed folders. Teams then reach for an alias, but a home-made prefix only works where some tool knows about it.

## Mental model
**Analogy:** in a phone system, numbers starting with `#` are internal extensions and every other number dials out. The `#` tells the switchboard, before it even looks the number up, that the call stays inside the building.

**Artifact:**
```jsonc
// package.json
{
  "imports": {
    "#core/*": { "source": "./src/core/*.ts", "default": "./dist/core/*.js" }
  }
}
```
```ts
import { Role } from "#core/domain/Role";   // internal: resolved through "imports"
import { z } from "zod";                     // external: a package in node_modules
import { Role as R } from "core/domain/Role"; // read as package "core" → not found
```

## How it works
1. Subpath imports were added in Node 14.6.0 and 12.19.0. ✅[^1]
2. Entries in the `imports` field must always start with `#`, to keep them distinct from external package specifiers. ✅[^1]
3. Node 25.4.0 and 24.14.0 also allow keys that start with `#/`. ✅[^1]
4. `imports` applies only inside the package that declares it. The other standard route, self-reference by the package's own name, works only when `package.json` has `exports`, and only for what `exports` allows. ✅[^1]
5. TypeScript `paths` "does not change how import paths are emitted", so an alias that only `paths` knows type-checks and then fails at runtime. ✅[^2]
6. With Node's built-in TypeScript type stripping, tsconfig `paths` are not applied either. The documented alternative is subpath imports, which must start with `#`. ✅[^3]
7. `paths` targets are read relative to `baseUrl` when it is set, otherwise relative to the tsconfig file itself. ✅[^2]
8. An import written with `.js` (`import x from "./mod.js"`) is looked up by TypeScript as `./mod.ts` first, then `./mod.d.ts`, then `./mod.js` ("file extension substitution"); this holds in every `moduleResolution` mode. So a TypeScript ESM import names the compiled file, and tools that map imports to sources must read `.js` as `.ts`. ✅[^5]

**Choices compared**

| Form | Resolved by the runtime | Visible to package consumers | Notes |
|---|---|---|---|
| `#core/role` (`imports`) | Yes ✅[^1] | No (package-internal) ✅[^1] | The Node standard for internal aliases |
| `my-app/core/role` (self-reference via `exports`) | Yes ✅[^1] | Yes: same paths are public | Mixes internal structure with the public API |
| `core/role` with tsconfig `paths` only | No ✅[^2] | — | Type-checks, then fails at runtime |
| `@/core/role` with `paths` + build-time rewrite (`tsc-alias`, a bundler, the Nest CLI) | Yes, the built files hold real relative paths | No | Tested 2026-10-25: `node dist/main.js` fails without `tsc-alias` and runs with it. Also needs Vitest `resolve.tsconfigPaths` and a lint resolver that reads `paths` |
| `@/core/role` with `paths` + `tsconfig-paths` runtime hook | Yes, through a `require` hook ✅[^4] | No | README documents only the CommonJS route (`node -r tsconfig-paths/register`) |
| `../../core/role` | Yes | — | Breaks on moves; mixes with aliases over time |

## Worked example
`src/http/routes/AuthRoutes.ts` needs `CookiePolicy` from `src/http/` and `Role` from `src/core/domain/`.

| Specifier | Resolves to (dev, `source` condition) | Resolves to (built, `default`) |
|---|---|---|
| `#http/CookiePolicy` | `./src/http/CookiePolicy.ts` | `./dist/http/CookiePolicy.js` |
| `#core/domain/Role` | `./src/core/domain/Role.ts` | `./dist/core/domain/Role.js` |

Moving `routes/` to another folder changes no import in it, because none of its imports is relative.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Key without `#` in `imports` | Invalid | Keys must start with `#` ✅[^1] |
| Another package imports `#core/…` from yours | Not resolved | `imports` is private to the declaring package ✅[^1] |
| Only tsconfig `paths` is set | Type-check passes, runtime fails | `paths` does not affect emit ✅[^2] |
| `#` in an import versus `#field` in a class | Unrelated | One is a module specifier, the other a private class field |
| One `#/*` key for a whole `src/` tree (`"#/*": { "source": "./src/*.ts", "default": "./dist/*.js" }`) | Works with tsc (`customConditions: ["source"]`), tsx `--conditions=source`, Vitest `ssr.resolve.conditions` and the built `dist/`; tested 2026-10-28 on Node 24.22 in a copy of the typescript-node stack reference | Keys may start with `#/` from Node 24.14; the `source`/`default` conditions pick `.ts` in development and `.js` after the build |

## Takeaways
- Use an alias every tool resolves: `package.json` `imports`, or tsconfig `paths` with a build-time rewrite. Never rely on `paths` alone. [rule-candidate]
- Allow relative paths only for files in the same folder, so aliases and relative paths never mix. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| stack idiom | TSN-15 | Source: |

## Verification status
- Verified: 16 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-30

## References
- [Node.js Packages: subpath imports, self-referencing](https://nodejs.org/api/packages.html#subpath-imports) — Node.js project, living. Backs: How it works 1–4, Choices, Edge cases. [^1]
- [TSConfig reference: paths](https://www.typescriptlang.org/tsconfig/#paths) — TypeScript team, living. Backs: How it works 5, 7. [^2]
- [Node.js: Modules: TypeScript](https://nodejs.org/api/typescript.html) — Node.js project, living. Backs: How it works 6. [^3]
- [tsconfig-paths README](https://github.com/dividab/tsconfig-paths) — tsconfig-paths maintainers, living. Backs: Choices, runtime hook row. [^4]
- [TypeScript Handbook: Modules — Reference, "File extension substitution"](https://www.typescriptlang.org/docs/handbook/modules/reference.html) — TypeScript team, living; read 2026-10-30. Backs: How it works 8. [^5]
- [tsc-alias](https://github.com/justkey007/tsc-alias) — tsc-alias maintainers, living. The build-time rewrite tool in the tested row.
- [NestJS: Libraries](https://docs.nestjs.com/cli/libraries) — NestJS, living. NestJS aliases through tsconfig path mapping and resolves them in its build.
- `copilot/frameworks/agentic-sdlc/foundations/design/import-paths.md` — IMP-1, IMP-2 apply this.
- `copilot/frameworks/agentic-sdlc/stacks/typescript-node/idioms.md` — TSN-15, TSN-16 and the tested tool config.
- `copilot/atlas/tools/atlas.mjs` — `--explain` applies How it works 7 and 8 to find which files import a `.ts` file (`specs/013-cross-repo-and-name-references/`).

## Related
- `js-runtime/private-fields.md`
- `code-documentation/doc-comments.md`
