---
schema: knowledge-doc/v1
type: concept
topic: javascript/modules
status: verified
applies-to: ["ECMAScript 2025", "Node.js 24", "modern browsers"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [javascript, modules, esm, import, export, default-export, re-export, live-bindings, dynamic-import, import-meta]
---

# ES modules: `import`, `export` and dynamic `import()`

## Summary
**TL;DR:** A module is a file with its own top-level scope that shares values only through `export` and `import`. Modules are always strict, top-level `this` is `undefined`, and each module is **evaluated once** per program — every importer gets the same instance. Imports are **live, read-only bindings**: the importer sees later changes made by the exporting module but cannot assign to them. Use named exports by default, a default export for a module's single main thing, `export … from` to re-export, and `import()` (which returns a promise of the module namespace) to load code on demand.
**Use this when:** structuring a codebase into files, debugging "module code ran only once" or "binding is read-only", or adding lazy loading.
**Not this doc:** package-level `imports` aliases (`#x`) → `js-runtime/subpath-imports.md`; re-export index files and their cost → `js-runtime/barrel-files.md`.

## Problem
Shared state in a module surprises people (one instance for everyone); assigning to an imported variable throws; default and named exports get mixed up; a large feature loaded up front slows startup.

## Mental model
**Analogy:** a module is a shop with a shop window. `export` puts items in the window; `import` lets other shops look at them through the glass — they always see the current item, but cannot reach in and change it. The shop opens (evaluates) once, however many customers visit.

**Artifact:** evaluation once and live bindings, in Node 24 ✅[^1]:
```js
// mod-a.mjs
globalThis.__evalCount = (globalThis.__evalCount || 0) + 1;
export let count = 0;
export function inc() { count++; }
// main.mjs
const m1 = await import('./mod-a.mjs'), m2 = await import('./mod-a.mjs');
m1 === m2, globalThis.__evalCount   // true, 1
m1.count; m1.inc(); m1.count        // 0, then 1 — the binding is live
m1.count = 5                        // TypeError — imports are read-only
```

## How it works
1. **Module scope.** Top-level variables are local to the module; only exported names are visible to others ✅[^2].
2. **Always strict; `this` is `undefined`** at the top level ✅[^1] ✅[^2].
3. **Evaluated once.** The first import runs the module; later imports reuse the same instance and its state ✅[^1] ✅[^2].
4. **`import.meta`.** Holds information about the current module, such as `import.meta.url` (a `file://` URL in Node) ✅[^1] ✅[^2].
5. **Browsers.** `<script type="module">` is deferred by default, needs CORS for cross-origin files, requires full or relative paths (no bare names without an import map), and `nomodule` serves old browsers ✅[^2].
6. **Export forms.** `export const x`, `export function f`, `export { a as b }`, `export default expr`; a module has at most one default ✅[^3].
7. **Import forms.** `import { a as b } from`, `import def from`, `import * as ns from`; `export { name } from './x.js'` re-exports without creating a local binding — the lab's `reexported` came straight from `mod-a` ✅[^1] ✅[^3]. `export * from` re-exports named exports but not the default ✅[^3].
8. **Live, read-only bindings.** The importer reads the exporter's current value; assignment throws `TypeError` ✅[^1] ✅[^5].
9. **Dynamic import.** `import(path)` works anywhere (including non-module scripts) and returns a promise for the module namespace object; the default export is its `default` property ✅[^1] ✅[^4].

## Worked example
Lazy-load a chart library only when the user opens a report:

| Step | Code | Effect |
|---|---|---|
| 1 | `button.onclick = async () => {` | — |
| 2 | `const { renderChart } = await import('./chart.js');` | Downloads and evaluates `chart.js` on first click ✅[^4] |
| 3 | Second click | Same module instance, no re-evaluation ✅[^1] |
| 4 | `renderChart(data) }` | — |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Two files import the same module and mutate its exported object | Both see the change | One instance ✅[^1] |
| `import x from` a module with no default export | Error at link time | No `default` binding ✅[^3] |
| `export * from './m.js'` and expecting its default | Not re-exported | Default is excluded ✅[^3] |
| `import` statement inside an `if` | `SyntaxError` | Static imports must be top-level; use `import()` ✅[^4] |
| Assigning to an imported binding | `TypeError` | Read-only ✅[^1] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Named exports | Consistent names, better refactoring and tree-shaking | Longer import lists |
| Default export | Short import of the main thing | Importers choose arbitrary names |
| Static `import` | Analyzed ahead of time, early errors | Always loaded |
| Dynamic `import()` | Lazy loading, conditional code | Async; harder to analyze |

## Takeaways
- Prefer named exports; reserve default exports for a module's single main value.
- Keep mutable state out of module top level unless every importer is meant to share it.
- Use `import()` for code needed only on some paths.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 24 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- `linux/lab-setup.md` — the Node 24.22.1 lab where every behaviour marked with this note ran on 2026-11-04. [^1]
- [Modules, introduction](https://javascript.info/modules-intro) — javascript.info, living. Backs: module scope, strictness, single evaluation, `import.meta`, browser specifics. [^2]
- [Export and Import](https://javascript.info/import-export) — javascript.info, living. Backs: export and import forms, default exports, re-export rules. [^3]
- [Dynamic imports](https://javascript.info/modules-dynamic-imports) — javascript.info, living. Backs: `import()` returning a promise, use outside modules, static imports must be top-level. [^4]
- [JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) — MDN, living. Backs: live, read-only import bindings. [^5]

## Related
- `js-runtime/subpath-imports.md`
- `js-runtime/barrel-files.md`
