---
schema: topic-index/v1
kind: topic
topic: js-runtime
last-updated: 2026-10-25
---

# JavaScript runtime internals

JavaScript runtime internals covers engine and Node.js behaviors that affect correctness, cancellation, async failures, and hot-path performance. It does not cover package-manager dispatch details; see the legacy Node.js reference below.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [v8-hidden-classes.md](v8-hidden-classes.md) | concept | Object shapes, V8 Maps, inline caches, dictionary mode, and stable-field construction | verified |
| [promise-rejections.md](promise-rejections.md) | concept | Floating promises, unhandled rejection behavior, and why linting promise handling matters | verified |
| [subpath-imports.md](subpath-imports.md) | concept | `package.json` `imports`: why internal aliases start with `#`, versus `paths`, self-reference and relative paths | verified |
| [private-fields.md](private-fields.md) | concept | `#x` versus TypeScript `private`: runtime privacy, serialization leaks, measured performance | verified |
| [abort-signal.md](abort-signal.md) | concept | AbortController and AbortSignal as a cancellation contract across fetch and own APIs | verified |
| [Node.js / nvm / corepack / pnpm / yarn Architecture](../nodejs/node-nvm-corepack-pnpm-yarn-architecture.md) | legacy | Windows Node.js toolchain dispatch and Corepack behavior | — |

## References
- [V8 documentation](https://v8.dev/docs) — V8 team, living. Backs: topic scope.
- [Node.js API documentation](https://nodejs.org/api/) — Node.js project, living. Backs: topic scope.

## Related
- `operations/` — runtime configuration and logging practices that surround Node.js applications.
- `web-apis/` — HTTP API surface practices.
- `nodejs/node-nvm-corepack-pnpm-yarn-architecture.md` — legacy Node.js toolchain reference.
