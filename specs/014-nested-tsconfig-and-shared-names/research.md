# Research: Nested and inherited tsconfig, one-word and shared names

## How TypeScript picks and merges a config (tested 2026-10-30, `tsc` 6.0.3)

A test project in the scratchpad, checked with `tsc -p <dir> --traceResolution` and `--showConfig`:

| Case | Result |
|---|---|
| Base sets `"@b/*": ["./lib/*"]`, child in another folder `extends` it | `@b/x.js` → `<base folder>/lib/x.ts`: relative to the base file |
| Base sets `"@c/*": ["${configDir}/src/*"]` | `@c/y.js` → `<child folder>/src/y.ts` |
| Nested `tsconfig.json` with no `paths`, file imports `@c/y.js` | TS2307: cannot find module; the outer config's aliases do not apply |
| `"extends": ["./one.json", "./two.json"]`, each with its own `paths` | Only `two.json`'s aliases resolve: `paths` is replaced whole |
| Child sets `"baseUrl": "./src"`, base sets `"@q/*": ["./*"]` | `@q/w.js` → `<child folder>/src/w.ts`; `baseUrl` also gives TS5101 "deprecated and will stop functioning in TypeScript 7.0" |
| Line comment and trailing comma in `tsconfig.json` | Accepted |

The docs agree: `tsc` searches for `tsconfig.json` "starting in the current directory and continuing up the parent directory chain"; relative paths in a config are "resolved relative to the configuration file they originated in"; an `extends` array works like a chain where "the latter entry wins" (TypeScript 5.0); `${configDir}` is "the containing directory of the configuration file in a given compilation" (TypeScript 5.5).

## How names appear (measured 2026-10-30)

| Measure | agent-config | reference repo (v4.2.0) |
|---|---|---|
| Plain one-word words equal to some file's name | 25,305 | 347 |
| One-word names in Markdown code (`` `qa` ``) naming one file | 62 | 8 |
| ... naming several files, one nearest | 36 | 0 |
| ... naming several files, tied | 35 (ties of 2 to 44 files: `index`, `SKILL`) | 0 |
| Hyphenated or PascalCase names naming several files, one nearest | 20 | 11 |
| ... tied | 99 (ties of 2 or 4 files) | 2 (ties of 2) |

Measured after leaving out a file's own name, which caused most ties before (`claude/agents/sdlc-qa.md` saying `sdlc-qa` named its Codex copy).

## Decisions

| Id | Question | Options | Chosen, and why |
|---|---|---|---|
| D-1 | Which `tsconfig.json` applies to a file? | Root only; nearest at or above the file | Nearest: what `tsc` finds from that folder and what editors use; the measured nested config proves root-only wrong |
| D-2 | Which `extends` are followed? | Relative files; packages too | Relative files only: a package lives in `node_modules`, outside every file list; bases from packages (`@tsconfig/node20`) set no `paths` |
| D-3 | Other config names (`tsconfig.build.json`)? | Read them; skip | Skip: TypeScript uses them only when passed with `-p`; the reference repo's one only changes the build output |
| D-4 | One-word names? | Every word; Markdown code only; never | Markdown code only: plain words matched 25,305 times; a code span is the author marking a name |
| D-5 | Shared names? | Drop; nearest wins; list all | Nearest wins (as for path endings). A tie is listed for each tied file and marked for hyphenated and PascalCase names (ties of 2 or 4, mostly one agent's copies for several tools); dropped for one-word names (ties up to 44) |
| D-6 | A file's own name? | Count; skip | Skip: a file naming itself is not pointing at a namesake |

## Verification

| What | How | Result |
|---|---|---|
| Scenarios first | 10 scenarios added (the one-word one replacing spec 013's "does not count"), run against the old tool | 10 failed, as intended; "names itself" already passed and is proven by its sabotage |
| Sabotage | 46 targeted mutations (spec 013's 28, 3 retargeted, plus 18 new) | 45 of 46 caught. The first run left 3 alive: two scenarios were rescued by the "nearest file with that ending" rule (sharpened), and the `extends` loop guard was hidden by a `catch` that also caught the stack overflow (the catch now takes only invalid JSON). The survivor is that narrowed catch: alone it changes nothing while the loop guard holds |
| Real repos | `--explain` before and after, same registry | Role files gain name mentions (`coordinator.md` 0 → 3, `engineering.md` 0 → 6); the four copies of one agent show as marked ties; `Result.ts`, `Document.ts`, `HttpErrorMapper.ts` gain 1-2 each; direct counts unchanged; under 1.5 s |

## References

- [TSConfig reference: `extends`, `paths`](https://www.typescriptlang.org/tsconfig/#extends) — TypeScript team.
- [What is a tsconfig.json](https://www.typescriptlang.org/docs/handbook/tsconfig-json.html) — the upward search.
- [TypeScript 5.0: multiple configuration files in `extends`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html).
- [TypeScript 5.5: `${configDir}`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-5.html).
- [Standalone Server (tsserver)](https://github.com/microsoft/TypeScript/wiki/Standalone-Server-%28tsserver%29) — no config in the folder or its parents: inferred project.
