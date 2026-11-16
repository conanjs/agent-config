---
schema: knowledge-doc/v1
type: reference
topic: js-runtime
status: verified
applies-to: ["ESLint 10.14.0 (npm), Node.js 24.22.1 on macOS, tested 2026-11-14"]
last-verified: 2026-11-14
last-updated: 2026-11-14
tags: [eslint, flat-config, monorepo, lint, config-files]
---

# Which `eslint.config.*` ESLint uses for each file

## Summary
**TL;DR:** ESLint looks for `eslint.config.*` first in the folder of each file it lints, then in that folder's parents, and uses the first one it finds ✅[^docs] So one `eslint .` at the repo root applies `installers/eslint.config.mjs` to files under `installers/` and `contracts/eslint.config.mjs` to files under `contracts/` ✅[^probe] Every linted file needs a config in its folder or above: one file at the root with no root config made the whole `eslint .` run fail with "ESLint couldn't find an eslint.config.* file", while a tree whose only files sat under `sub/` linted fine ✅[^probe] `-c`/`--config` skips the search and uses the named file ✅[^docs]
**Use this when:** one repo holds several code areas that need different lint rules, and you want one lint command.
**Not this doc:** how `#` import aliases resolve → [subpath-imports.md](subpath-imports.md).

## Scope
How ESLint's flat config picks a config file per linted file. It is like a building where each floor may post its own house rules: a resident reads the rules on their own floor, and only climbs to a higher notice board when their floor has none. Example: `installers/core/src/a.ts` is linted by `installers/eslint.config.mjs`, while a file in `docs/` is linted by the root config.

## Catalog

| Item | Fact | Evidence |
|---|---|---|
| Search order | The linted file's own folder first, then each parent folder, until an `eslint.config.*` is found | ✅[^docs] |
| Override | `-c`/`--config` uses the named file and skips the search | ✅[^docs] |
| Nested configs | Root `eslint . --max-warnings 0` reported a bad file under `installers/core/src` with the rules of `installers/eslint.config.mjs`, and linted that config file with itself | ✅[^probe] |
| Root config needed | With `sub/eslint.config.mjs` only: files under `sub/` were linted by it; adding `top.mjs` at the root made `eslint .` exit with "ESLint couldn't find an eslint.config.* file". In a real repo with root-level files, a root config that ignores everything outside the code areas avoids that | ✅[^probe] |

## Lookup notes
- The docs page does not say in which major version this lookup became the default, nor what happens when no config is found; the "Root config needed" row comes only from the local run.
- Keep the root config small (ignores plus the rules for its own file), so files outside the code areas are not linted by accident.

## Takeaways
- Put a lint config at the root of each code area and one at the repo root that ignores the rest; one `eslint .` then covers every area. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 8 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-14

## References
- [ESLint: Configuration Files](https://eslint.org/docs/latest/use/configure/configuration-files) — ESLint project, latest docs (site version list shows v10.15.0), read 2026-11-14, sections "Configuration File Resolution" and "Configuration File Precedence". Backs: Search order, Override. [^docs]
- Local measurement, 2026-11-14 — ESLint 10.14.0 with typescript-eslint 8.72.1, Node.js v24.22.1 on macOS, in a throwaway copy of the agent-config worktree for spec 022 (tasks T040, T041), and in scratch folders (`sub/eslint.config.mjs` with `no-var`, with and without a root `top.mjs`). Backs: Nested configs, Root config needed. [^probe]

## Related
- [js-runtime index](index.md)
- [subpath-imports.md](subpath-imports.md)
