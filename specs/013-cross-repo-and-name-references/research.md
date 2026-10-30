# Research: References across repos, and by name

## How files actually refer to each other (measured 2026-10-30)

| Direction | Form found | Count |
|---|---|---|
| agent-config → reference repo | `github.com/conanjs/agentic-sdlc-reference-typescript-node/(blob\|tree)/<sha or tag>/…` | 17 links (most to folders or commits) |
| agent-config → reference repo | Bare paths in `stacks/typescript-node/reference.md`, which says "All paths are relative to the reference repo's root" (`src/modules/…`, `eslint.config.mjs`, `docs/architecture.md`) | the whole Choices table |
| reference repo → agent-config | `github.com/conanjs/agent-config/tree/main/copilot/frameworks/agentic-sdlc` | 1 (a folder) |
| inside the reference repo | `./X.js` imports of `X.ts`; `@/X.js` through `tsconfig.json` `paths` (`@/*` → `./src/*`, no `baseUrl`) | every module |

## Decisions

| Id | Question | Options | Chosen, and why |
|---|---|---|---|
| D-1 | How does a bare path know its repo? | (a) guess from which repo has the file; (b) a `cites` field on the kind | (b): `docs/architecture.md` exists in several repos, so a guess would be wrong silently. The pin file states its repo in prose; `cites` states it in the registry, where AT-6 checks it |
| D-2 | How is a web link matched to a repo? | (a) `url` only; (b) an optional `web` field, falling back to `url` less its ref | (b): agent-config's `url` is `—` (its map pages link locally), yet the reference repo links to it on GitHub |
| D-3 | Which ref does a link's file come from? | The link's ref; the registry's ref | The registry's: a link may name any commit. Among repos sharing one web home (two variants of one clone), the one whose ref equals the link's ref wins, else the first that has the file |
| D-4 | What counts as a name? | Any word equal to a file's stem; only distinctive ones | Hyphenated or PascalCase words, equal to exactly one file's stem: one-word stems (`index`, `setup`) and shared stems would be noise |
| D-5 | Do names make chains? | Yes; no | No, and they are listed apart. Measured: 2 of the 4 names for `module-boundaries` are a lint rule with the same name (`tests/validate-project/…`) |
| D-6 | TypeScript | Ignore; `.js` → `.ts` and root `tsconfig.json` `paths` | Both, as TypeScript resolves them: "File extension substitution" in the modules reference, and `paths` relative to `baseUrl` or the tsconfig file |

## Found while building

- **Ref-listed repos were read from the working tree.** A reference repo is listed at its ref (`git ls-tree`), but its text was read from disk, where another branch may be checked out. The layer-first variant shares the same clone. The text is now read at the ref with one `git cat-file --batch`.

## Verification

| What | How | Result |
|---|---|---|
| Scenarios first | 13 scenarios added and 3 reshaped, run against the old tool | 14 failed, as intended. Later scenarios (`.js`, alias, `baseUrl`) were each red before their code |
| Sabotage | 28 targeted mutations (spec 012's 11, retargeted to the new code, plus 17 new) | 28 of 28 caught. The first run left 2 alive (a unique-name scenario explaining the wrong file; an alias scenario whose order made the sort irrelevant), so both scenarios were sharpened |
| `fail`/`warn` | Each of the 16 calls switched off | 16 of 16 caught |
| Real repos, before → after | HEAD's `atlas.mjs` against the new one, same registry | `CompositionRoot.ts` 3 → 9 direct; `GetDocument.ts` 0 → 11 direct; `eslint.config.mjs` 3 → 4 and `docs/architecture.md` 5 → 6 (the pin file); `module-boundaries.md` 19 direct unchanged, plus 4 name mentions |
| Speed | `--explain` with all three repos present | under 1 s |
