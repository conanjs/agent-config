---
schema: knowledge-doc/v1
type: reference
topic: js-runtime
status: verified
applies-to: ["Node.js 24.12+ (stable type stripping); measured on 24.22.1 on macOS (Darwin 25.1.0, arm64), 2026-11-14"]
last-verified: 2026-11-14
last-updated: 2026-11-14
tags: [node, typescript, type-stripping, erasable-syntax, warning, tsconfig]
---

# Node.js type stripping: what runs, what fails, and what Node prints

## Summary
**TL;DR:** From Node 24.12.0, `node file.ts` runs a TypeScript file by deleting the type annotations and running what is left; it is Stability 2 (Stable) ✅[^docs]. Node 24.22.1 printed no warning for plain stripping (the warning was removed in 24.3.0) ✅[^docs][^probe]. Syntax that needs rewriting (enum, runtime namespace, parameter property, angle-bracket assertion) fails with `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`, a type import without `type` fails at run time, and `tsconfig.json` is ignored ✅[^docs][^probe]. The only warning text found is for `--experimental-transform-types`: `ExperimentalWarning: Transform Types is an experimental feature and might change at any time` ✅[^probe].
**Use this when:** writing or reviewing TypeScript that Node must run directly (tests, scripts, tools), or checking what a Node 24.12+ floor allows.
**Not this doc:** why `enum` is avoided and what replaces it → [enums-and-literal-unions.md](enums-and-literal-unions.md); why aliases start with `#` → [subpath-imports.md](subpath-imports.md).

## Scope
Node.js 24 line, `node <file>.ts` and `node --input-type=module-typescript -e`, one Mac (Node 24.22.1, bundled libuv 1.52.1, `process.features.typescript` is `"strip"`). Type stripping is like removing the pencilled notes from a printed page: the printed text stays exactly where it was, and anything that would need new text written in (an enum's lookup object) cannot be done. Example: `const x: number = 1` runs because only `: number` is blanked out.

## Catalog

| Item | Result on Node 24.22.1 (measured, file written in a temp folder) | Docs say | Evidence |
|---|---|---|---|
| Plain annotations, `interface`, `type` | Runs, prints nothing extra | Stable since v24.12.0 | ✅[^probe][^docs] |
| Warning for plain stripping | None | "Type stripping no longer emits an experimental warning." (v24.3.0) | ✅[^probe][^docs] |
| `--experimental-strip-types` flag | Accepted, still no warning | Flag from the experimental era | ✅[^probe] |
| `--no-strip-types` | The `.ts` file is parsed as JavaScript: `SyntaxError: Missing initializer in const declaration` | — | ✅[^probe] |
| `--experimental-transform-types` | Runs an `enum`, prints `ExperimentalWarning: Transform Types is an experimental feature and might change at any time` (the line after it is Node's `(Use node --trace-warnings ...` hint) | Flag added in v22.7.0 | ✅[^probe][^docs] |
| `enum` | `SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript enum is not supported in strip-only mode` | "Enum declarations" need transformation | ✅[^probe][^docs] |
| `namespace` holding runtime code | `... TypeScript namespace declaration is not supported in strip-only mode` | A `namespace` without runtime code is supported | ✅[^probe][^docs] |
| Parameter property (`constructor(private a: number)`) | `... TypeScript parameter property is not supported in strip-only mode` | Listed as needing transformation | ✅[^probe][^docs] |
| `<number>a` type assertion | `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX: The angle-bracket syntax for type assertions, `<T>expr`, is not supported in type strip mode. Instead, use the 'as' syntax: `expr as T`.` | Not listed in the quoted passage | ✅[^probe] |
| Decorators | Not run here | Parser error; Node adds no polyfill | ✅[^docs] |
| `import { T } from "./dep.ts"` where `T` is only a type | `SyntaxError: The requested module './dep.ts' does not provide an export named 'T'` | The `type` keyword is needed: `import type { T }` or `import { fn, type T }` | ✅[^probe][^docs] |
| `import type { T } from "./dep.ts"` | Runs | Same | ✅[^probe][^docs] |
| Relative import without extension (`"./dep"`) | `ERR_MODULE_NOT_FOUND` | Extensions mandatory in `import`, `import()` and `require()` | ✅[^probe][^docs] |
| `tsconfig.json` `paths` (`"@x/*"`) | `ERR_MODULE_NOT_FOUND: Cannot find package '@x/dep2.ts'` | tsconfig is ignored; closest feature is subpath imports starting with `#` | ✅[^probe][^docs] |
| `.mts` file | Runs | — | ✅[^probe] |
| `.ts` file in a `"type":"commonjs"` package, and `require("./c.ts")` | Runs | `require` needs the extension | ✅[^probe][^docs] |
| `.tsx` file | Fails (parsed as JavaScript, `const a: number` rejected) | "`.tsx` files are unsupported" | ✅[^probe][^docs] |
| `.ts` under `node_modules` | `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING: Stripping types is currently unsupported for files under node_modules` | Refused on purpose, to discourage publishing TypeScript | ✅[^probe][^docs] |
| `--input-type=module-typescript -e '…'` | Runs | — | ✅[^probe] |
| TypeScript in the REPL, `--check`, `inspect` | Not run here | Unsupported | ✅[^docs] |
| Source maps | Not run here | Node generates none for stripping; on by default with `--experimental-transform-types` | ✅[^docs] |

## Lookup notes
- **Stripping blanks the type text in place** (the `typeimp.ts` error showed `const a    = 1;`), so line and column numbers in stack traces stay the same.
- **"Exact warning text" for Node 24.12+:** there is none for stripping. If a warning like `Type Stripping is an experimental feature` appears, the Node is older than 24.3.0 (or 22.18 on the 22 line), not a 24.12+ one. The text recorded above is the only one measured.
- Each measurement used a one-line file in a fresh temp folder; reproduce with `node --experimental-transform-types enum.ts` after `echo 'enum E { A } console.log(E.A);' > enum.ts`.
- The TypeScript compiler flags that mirror these limits are `erasableSyntaxOnly` and `verbatimModuleSyntax` (enforces `import type`); see [enums-and-literal-unions.md](enums-and-literal-unions.md) for `erasableSyntaxOnly`.
- Windows: the same Node code runs there; this doc's results are from macOS. The Windows runner of the installer workflow (job `installer (windows)`, spec 022 T085) runs the `.ts` scenario steps with Node from `.nvmrc`, which exercises stripping there.

## Takeaways
- Write Node-run TypeScript with erasable syntax only: no `enum`, runtime `namespace`, parameter properties or `<T>expr`; use `import type` for type-only imports and keep `.ts` extensions in imports. [rule-candidate]
- Do not expect a warning from Node 24.12+ stripping; a warning means the flag `--experimental-transform-types` is on or the Node is older than 24.3.0.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 25 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-14

## References
- [Node.js 24 docs: Modules: TypeScript](https://nodejs.org/docs/latest-v24.x/api/typescript.html) — Node.js project, living (read 2026-11-14, v24.22.x). Backs: stability, version history, unsupported syntax, `import type`, extensions, tsconfig, node_modules, `.tsx`, decorators, source maps. [^docs]
- Local measurement, 2026-11-14 — Node.js v24.22.1 on macOS 26.1 (Darwin 25.1.0, arm64); one-line `.ts` files run with `node <file>` and the flags named in the Catalog. Backs: every "Result on Node 24.22.1" cell. [^probe]

## Related
- [js-runtime index](index.md)
- [enums-and-literal-unions.md](enums-and-literal-unions.md)
- [subpath-imports.md](subpath-imports.md)
- [private-fields.md](private-fields.md)
