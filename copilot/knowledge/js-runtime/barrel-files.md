---
schema: knowledge-doc/v1
type: concept
topic: js-runtime
status: verified
applies-to: ["ES modules and CommonJS", "TypeScript", "Python packages", "any JS tool that follows imports (bundlers, test runners, type checkers)"]
last-verified: 2026-10-27
last-updated: 2026-10-28
tags: [barrel-files, index-ts, re-export, module-graph, build-performance, module-boundaries]
---

# Barrel files and their cost

## Summary
**TL;DR:** A barrel is a file that only re-exports other files, usually `index.ts`. Importing one name through a barrel makes tools load every file the barrel lists, and every file those import. On large codebases that cost is measured in minutes of CI time. A barrel also invites import cycles and is a second, hand-kept list of what is public. Application code does better without them: import the file that declares the symbol, and enforce what is public with lint.
**Use this when:** someone proposes an `index.ts` per folder or per module, a build or test run is slow for no clear reason, or a team decides how a module declares its public surface.
**Not this doc:** the rules themselves. IMP-5 and MOD-3 (framework foundations) and TSN-18 (TypeScript lint) apply this doc.

## Problem
Barrels look tidy: one short import line, and internals can move without touching consumers. The cost is invisible in a small repo and grows with every file. A test that needs one function ends up loading half the codebase, and an import cycle appears that nobody wrote on purpose.

## Mental model
**Analogy:** a barrel is a receptionist who must be told about every person in the building. Each time a visitor asks for one person, the receptionist phones the whole building first. Giving the visitor the person's office number skips the receptionist. A guard on the non-public doors (lint) keeps visitors where they belong.

**Artifact:**
```ts
// src/modules/documents/index.ts: a barrel
export * from "./application/ReviseDocument.js";
export * from "./application/GetDocument.js";
export * from "./infrastructure/InMemoryDocumentStore.js";

// consumer: needs one class, loads all three files and everything they import
import { GetDocument } from "@/modules/documents/index.js";

// without a barrel: loads only GetDocument.ts and what it imports
import { GetDocument } from "@/modules/documents/application/GetDocument.js";
```

## How it works
1. A tool that follows imports (bundler, test runner, type checker, dev server) must load every module a barrel re-exports before the importer can use any one name, so the module graph each import pulls in grows with the barrel. Barrels are a main reason JavaScript tooling slows down in large projects, and removing them is a simple speed-up. ✅[^1]
2. Atlassian removed barrel files from Jira's frontend codebase. They reported about 75% fewer CI build minutes per commit, local unit tests about 50% faster on average, and TypeScript highlighting more than 30% faster. The cause they name is the large dependency graphs that made TypeScript, Jest and CI test selection process modules they did not need. ✅[^2]
3. A barrel imports every file of its module. If any of those files imports the barrel back, for example to reach a sibling, the import graph has a cycle. *(Analysis, ours.)*
4. A published package needs one public entry. Node's `exports` field in `package.json` names it, and blocks every other path. That is the legitimate barrel: an API for outside consumers, not a convenience inside one application. ✅[^3]

## Worked example
The stack reference (`conanjs/agentic-sdlc-reference-typescript-node`) has a `comments` module that needs to check that a document exists.

| Step | With a barrel | Without (framework choice) |
|---|---|---|
| Import in `comments` | `@/modules/documents/index.js` | `@/modules/documents/application/GetDocument.js` |
| What `documents` declares public | Whatever `index.ts` happens to re-export | The list in `docs/architecture.md` §4: `application/*.ts`, excluding `ports/` (MOD-3) |
| What stops `comments` from importing `modules/documents/domain/Document.ts` | Nothing, unless a second rule exists | A lint zone on resolved paths |
| Loaded when the test runs | Every file `index.ts` lists | `GetDocument.ts` and its own imports |
| Lint check on `src/` | `index.ts` is allowed | `noReExports`: `ExportAllDeclaration`, `ExportNamedDeclaration[source]` fail (TSN-18) |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Barrel in a published library (`package.json` `exports` → `dist/index.js`) | Fine | It is the package's API for outside consumers ✅[^3] |
| A public file moves | Consumers' import paths change | No indirection layer; a search-and-replace, and a visible API change anyway |
| `export type { X } from` only | Still a re-export file and still a second list | The load cost is lower, the upkeep and the hidden public surface are not *(analysis, ours)* |
| Bundler with tree shaking | Production bundle may be small | Tree shaking runs after loading; dev servers, tests and type checks still pay the load cost ✅[^1] |
| Python package with a re-exporting `__init__.py` | Same shape | Importing a package, or any module inside it, runs its `__init__.py` ✅[^4], so a re-exporting one is a barrel. Keep it empty in application code |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Barrel per module | One import line; internals can move | Load cost ✅[^2]; cycles; a hand-kept second list; a file with no primary type (NAM-8) |
| Import the declaring file, lint-enforced public list | Loads only what is used; the public list lives in one place | Longer import paths; moving a public file changes consumers |
| One package per module (`exports`) | The runtime enforces the boundary ✅[^3] | A workspace and build per module; heavy inside one service |

## Takeaways
- In application code, import the file that declares the symbol; never add a re-export file. [rule-candidate]
- Declare a module's public surface as a list of files and enforce it with lint, not with a barrel. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| foundation | IMP-5 | Source: |
| stack idiom | TSN-18 | Source: |

## Verification status
- Verified: 8 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-27

## References
- [Speeding up the JavaScript ecosystem – The barrel file debacle](https://marvinh.dev/blog/speeding-up-javascript-ecosystem-part-7/) — Marvin Hagemeister, 2023. Backs: How it works 1, Edge cases (tree shaking). [^1]
- [How We Achieved 75% Faster Builds by Removing Barrel Files](https://www.atlassian.com/blog/atlassian-engineering/faster-builds-when-removing-barrel-files) — Atlassian Engineering, 2025-06-26. Backs: How it works 2, Trade-offs. [^2]
- [Node.js Packages: `exports`](https://nodejs.org/api/packages.html#exports) — Node.js project, living. Backs: How it works 4, Edge cases, Trade-offs. [^3]
- [Python Language Reference §5.2.1, Regular packages](https://docs.python.org/3/reference/import.html#regular-packages) — Python Software Foundation, living. Backs: Edge cases (Python row). [^4]
- `copilot/frameworks/agentic-sdlc/foundations/design/import-paths.md` — IMP-5 applies this.
- `copilot/frameworks/agentic-sdlc/foundations/design/module-boundaries.md` — MOD-3, the public surface as a list of files.
- `copilot/frameworks/agentic-sdlc/stacks/typescript-node/idioms.md` — TSN-18 and the `noReExports` lint.
- `proposals/agentic-sdlc-reference-feature-first.md` §A5 — the four options compared before the decision.

## Related
- `js-runtime/subpath-imports.md` — how the alias in the import path resolves.
- `software-design/architecture-styles/clean-architecture.md` — the layers whose public surface this protects.
