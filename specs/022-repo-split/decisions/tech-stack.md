# Tech stack and toolchain decisions: spec 022 (repo split)

Written by `tech-stack` in decide mode, phase P4, run R-001. G2 approved 2026-11-13. These records feed `research.md` and the plan's technical context; they are approved at G3 (the P4 plan gate). Ids start at DR-101 so they cannot collide with records other roles write into `research.md`.

Words used once: **ESM** = ECMAScript modules (`import`/`export`, `.mjs` files). **JSDoc** = type comments in plain JavaScript that `tsc` can check. **CI** = continuous integration (the GitHub Actions run). **Floor** = the lowest Node version a machine may have (18). **Vendored** = a third-party library copied into the repo at a pinned version.

## Facts that drove every answer

| Fact | Source |
|---|---|
| The installer, renderer, build step and baseline script run on V's own machines, with no `pnpm install` ever run there, on Node 18 or later. | blueprint "Node on every machine" (line 127); spec A-2, FR-024, FR-034 |
| Components are never installed through a package manager; pnpm is for each repo's dev tooling only. | blueprint "pnpm" row; FR-034 |
| Node 24 is the development runtime (`.nvmrc` = 24, `engines` `>=24 <25`). Cucumber.js 13.3.0 needs Node 22 or 24+; ESLint 10.14.0 needs 20.19+; vitest needs a newer Node than 18. | `.nvmrc`, `package.json`; `npm view @cucumber/cucumber@13.3.0 engines`, `npm view eslint@10.14.0 engines` (2026-11-13) |
| Node's TypeScript type stripping is not available on Node 18, so `.ts` files cannot be the runtime code of the installer. (workflow-graph uses `.ts` only because it needs Node 24.12.) | `workflow-graph/package.json` `engines`; unconfirmed beyond that, no Node 18 on this machine |
| The existing validators are zero-dependency `.mjs` with hand-rolled parsing; the existing test harness is Cucumber with a `tool.mjs` per tool. | `validate-knowledge.mjs` imports (only `node:` modules); `cucumber.mjs`; `tests/installers/tool.mjs` |
| Constitution: unit size at most 50 lines and complexity at most 10 for new and touched code; principle IV requires a Given/When/Then scenario with an automated test per rule id; principle V requires a backup before any automatic overwrite. | `.specify/memory/constitution.md` |
| Spec fixes these interfaces: `component.yaml`, `components.yaml`, `components.local.yaml`, `variables.local.yaml`, `slots.yaml` (YAML), `install-state.json`, `components.lock`; exit codes 0, 10, 1, 2; `--json`. | spec FR-004, FR-016, FR-019, FR-026 |

## DR-101: Language and runtime for the runtime code (installer core, renderer, build step, baseline script)
- **Tree path:** TS-Q0 (constitution and company KB name no stack → NO) → TS-Q1 (blueprint states "a Node core" and "Node >= 18" → YES, use it) → TS-Q4 (no database: state is files, see DR-104) → outcome: Node, profile `typescript-node`, with one recorded deviation in language form.
- **Criteria:** Floor Node 18 (blueprint, spec A-2); no build or install step on the user's machine; `typescript-node` is the profile detected from the root `package.json` and `pnpm-lock.yaml`.
- **Options considered:** (A) TypeScript source compiled to JavaScript and the output committed | (B) TypeScript run by Node type stripping | (C) plain JavaScript ESM with JSDoc types, checked by `tsc --noEmit --checkJs` | (D) Bash and PowerShell only | (E) Go or Rust binary
- **Chosen:** (C) Plain ESM `.mjs` files, JSDoc-typed, strict `tsc` checking, zero runtime dependencies except the vendored `yaml` library (DR-102). Reason: it is the only option that runs unmodified on Node 18 with nothing committed that is generated, and the stack's `cmd.typecheck` slot (`tsc --noEmit`) is still filled with `strict` on.
- **Rejected:** (A) a committed compiled copy breaks spec A-6 and AC-16.10's spirit (nothing built is committed) and creates drift to police; (B) type stripping needs Node 22.6+ (stable later), not available at the floor; (D) two shell dialects cannot hold the resolver, hashing and rendering logic with tests, and duplicate every rule on Mac and Windows; (E) adds a second stack to the repo and a binary per platform (TS-Q2: never introduce a second stack as a side effect).
- **Confidence:** medium (language form deviates from the profile's "TypeScript"; see open question 1)
- **Supersedes:** none
- **Decided by:** tech-stack · **Approved at:** G3 pending (2026-11-13)

## DR-102: Runtime dependency policy and YAML handling
- **Tree path:** TS-Q1 (YAML files are fixed interfaces) → STK-R1/R2 check: Node has no built-in YAML parser → outcome: vendor one library.
- **Criteria:** The installer reads and edits human-written YAML (V's `components.local.yaml`, `variables.local.yaml`, every `component.yaml`); a misparse changes what gets linked into agent folders. `add`, `use` and `init-component` must edit V's files without deleting V's comments. `yaml` 2.9.1 is ISC licensed, has no dependencies, declares `node >= 14.6`, and is already a pinned dev dependency of workflow-graph.
- **Options considered:** (A) vendor `yaml` 2.9.1 | (B) hand-written YAML subset parser | (C) switch the interface files to JSON | (D) install `yaml` into the agent home with a package manager at run time
- **Chosen:** (A). Copy `node_modules/yaml/browser/dist/` (pure ESM) to `installers/core/vendor/yaml/` with its `LICENSE`. The repo's root `package.json` pins `yaml` `2.9.1` as a dev dependency, so `pnpm-lock.yaml` holds its integrity hash; a dev script `scripts/vendor-yaml.mjs` does the copy and a unit test fails if the vendored tree differs byte for byte from the locked package or the version drifts. One wrapper module (`installers/core/yaml.mjs`) is the only importer. Prettier and ESLint ignore `vendor/`.
- **Rejected:** (B) the existing hand parsers cover flat front matter only, and a silent misparse in the installer is a worse failure than in a validator, and it cannot keep comments when rewriting; (C) the spec fixes the file names and formats and V edits these files by hand; (D) violates FR-034, needs network and a package manager at install time.
- **Confidence:** high. Tested 2026-11-13: `browser/dist/index.js` of `yaml` 2.9.1 imports and round-trips a commented document (comment kept after a `set`) on Node 24.22.2 and 22.23.4. Not tested on Node 18 (none installed here); the floor CI job in DR-109 proves it.
- **Supersedes:** none
- **Decided by:** tech-stack · **Approved at:** G3 pending (2026-11-13)

## DR-103: Schema format for the contract files
- **Tree path:** TS-Q1 (spec FR-002: "machine-checkable schemas") → STK-R2 (do not duplicate a capability) → outcome: JSON Schema as the published contract, a small hand-written reader at run time, one parity test.
- **Criteria:** FR-003 needs messages that name a replacement ("`count` is now `required` and `multiple`"); FR-005 needs "warn on unknown keys, skip only that component"; both are behaviour JSON Schema validators do not give. The reader runs on Node 18 with no dependencies, so a JSON Schema engine cannot run there.
- **Options considered:** (A) JSON Schema 2020-12 files for editors and review, checked in development with `ajv` 8.20.0 (already pinned in workflow-graph), plus a hand-written zero-dependency reader, plus a parity test that feeds one shared set of valid and invalid fixtures to both and requires the same verdict | (B) hand-written reader only | (C) ship `ajv` standalone-compiled validators in the repo | (D) `zod` at run time
- **Chosen:** (A). The reader holds the cross-checks JSON Schema cannot express (unknown keys, removed keys, slot and location logic).
- **Rejected:** (B) no editor support and no neutral statement of the contract for other repos' authors; (C) a committed generated file, and it still could not give the custom messages; (D) a run-time dependency for no gain over the reader.
- **Confidence:** medium (the parity test is the price; architecture may prefer (B) if the contract folder should stay minimal)
- **Supersedes:** none
- **Decided by:** tech-stack · **Approved at:** G3 pending (2026-11-13)

## DR-104: Machine-owned state files and writes
- **Tree path:** TS-Q4 (state is two small files; no relational, document or cache need; no new store operated anywhere) → outcome: plain files, no database.
- **Criteria:** FR-026 (idempotent reruns, nothing replaced without a backup, previous links stay on failure); `install-state.json` already named as JSON; hashes for `doctor` and uninstall.
- **Options considered:** (A) JSON for machine-written files, YAML for human-edited files | (B) YAML everywhere | (C) SQLite
- **Chosen:** (A). `components.lock` and `install-state.json` are JSON written with sorted keys and two-space indent so identical input gives identical bytes; written to a temp file in the same folder and then `fs.renameSync` (replace in one step). Hashes are SHA-256 from `node:crypto`. No other store.
- **Rejected:** (B) V never edits these files, and a parse of JSON cannot silently differ; (C) a native dependency (`better-sqlite3` needs a compiled addon) on a no-install machine.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** tech-stack · **Approved at:** G3 pending (2026-11-13)

## DR-105: Source adapters and operating-system primitives
- **Tree path:** TS-Q1 (FR-020 fixes `git` and `path` adapters) → STK-R2 → outcome: standard library plus the `git` program.
- **Criteria:** A-17 (a clone uses V's credentials if the host asks), AC-10.4 (network or credential failure fails only that component and names the cause), AC-7.x (backup, read-only rendered files), the existing Windows link fallback in `installers/lib/link-or-copy.ps1`.
- **Options considered:** (A) run the `git` program with `child_process.execFile` and an argument array (no shell), `GIT_TERMINAL_PROMPT=0` so a missing credential fails at once instead of hanging, shallow fetch of the wanted ref into staging, `git rev-parse HEAD` for the lock | (B) a JavaScript git library (`isomorphic-git`) | (C) download GitHub tarballs over HTTP
- **Chosen:** (A). `git` is added to the declared runtimes checked before apply (FR-024). Links follow the order already proven in `link-or-copy.ps1`: symlink, then (directories) junction through `fs.symlinkSync(target, path, 'junction')`, then (files) hard link, then copy only with consent; each degradation is reported. Rendered copies are made read-only with `fs.chmod`.
- **Rejected:** (B) a large dependency tree and its own credential handling, against A-17; (C) cannot clone private forks or use V's credential helper, and gives no SHA to lock.
- **Confidence:** medium. Unconfirmed, to be proven by the Windows CI job: that `fs.chmod` to a read-only mode sets the read-only attribute on Windows (the Node `fs` documentation says only the write permission can be changed on Windows), and that a junction needs no administrator right. Source: Node.js documentation, `fs.chmod` and `fs.symlink`.
- **Supersedes:** none
- **Decided by:** tech-stack · **Approved at:** G3 pending (2026-11-13)

## DR-106: Renderer, build step and dry-run baseline script
- **Tree path:** TS-Q2 (inherit DR-101) → STK-R2 → outcome: three pure-function modules sharing one rules module, no Markdown or template library.
- **Criteria:** A-28 (the dry run and the phase-5 renderer must apply the same path swap and generated-from line so the two numbers stay comparable); FR-045 (a rendered file must differ from its source only at citations and the one added line); AC-11.1 (the same source built twice gives identical output); AC-11.5 (`{{include:}}` inlined, a missing file fails with its path); A-7 (characters are the unit).
- **Options considered:** (A) line scanner that skips fenced code and rewrites only `[{{AGENT_HOME}}/…](…)` links; a build that reads sources, front-matter via the vendored `yaml`, and emits Markdown front matter by `yaml` stringify and Codex TOML by a small emitter for strings, string lists and multi-line text only | (B) a Markdown parser (`remark`) or template engine (Handlebars) | (C) a TOML library
- **Chosen:** (A). Module split: `render-rules.mjs` (pure, no file access, the one place the swap and the generated-from line are defined), `render.mjs` (applies it to files at install), `scripts/baseline.mjs` (applies it in memory and counts Unicode code points with `Array.from(text).length`, recording method, Node version, date and commit in the output), `build.mjs` (phase 4, deterministic: sorted keys, LF endings, no timestamps; the stamp carries source revision and adapter version only). Phases 2 to 4 build only what their stories need; this record fixes the shape, not the schedule.
- **Rejected:** (B) a parser round trip reformats text the renderer must leave byte-identical outside citations, and is a run-time dependency; (C) the build only writes, and the Codex agent shape needs a few value types (spec 016); a reader is not needed.
- **Confidence:** medium (the Codex agent TOML shape must be re-checked in spec 016 before phase 4; the characters-versus-tokens counting for Claude Code and Codex stays as spec A-7 states, unconfirmed beyond that)
- **Supersedes:** none
- **Decided by:** tech-stack · **Approved at:** G3 pending (2026-11-13)

## DR-107: Entry points `install.sh` and `install.ps1`
- **Tree path:** TS-Q2 (existing `installers/` already has both) → outcome: thin shims.
- **Criteria:** FR-033 (same steps on Mac and Windows), FR-035 (until phase 5 the existing installers keep wiring agent folders), exit codes 0, 10, 1, 2 must pass through unchanged.
- **Options considered:** (A) each shim only finds `node` 18 or later (`NODE` override first, then `PATH`), prints one message and exits 1 if absent, otherwise `exec`s `node installers/core/main.mjs "$@"` and returns its exit code | (B) shims that hold install logic
- **Chosen:** (A). The shims contain no install logic and no other parsing, so there is one implementation to test. PowerShell target stays Windows PowerShell 5.1 (`#Requires -Version 5.1`, as `link-or-copy.ps1` already declares).
- **Rejected:** (B) two copies of the logic, which is the Mac-versus-Windows drift the spec exists to avoid.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** tech-stack · **Approved at:** G3 pending (2026-11-13)

## DR-108: Toolchain for `agent-config` (installer, contracts, renderer, build step, baseline script)
- **Tree path:** TC-Q1 (partial: Cucumber, pnpm, Node 24 pin and `check-docs.sh` exist; no format, lint or typecheck for `.mjs` tools) → inherit the configured slots → TC-Q2 (constitution: size and complexity limits, principle IV) → TC-Q3 for empty slots, with the Node 18 floor overriding two stack defaults.
- **Criteria:** Existing configuration is not replaced (TC-Q1 default). Stack default `cmd.test_unit` is vitest; vitest cannot run on the floor.

| Slot | Value | Source |
|---|---|---|
| `package_manager` | pnpm, pinned by `packageManager`; root `pnpm-lock.yaml` | existing config |
| language version | Node 24 for development (`.nvmrc`); runtime code limited to Node 18 APIs, enforced by tsc and ESLint below | existing config + DR-101 |
| `cmd.format` | `pnpm exec prettier --check .` (3.9.10, the version already locked); `vendor/` ignored | stack default |
| `cmd.lint` | `pnpm exec eslint . --max-warnings 0` (eslint 10.14.0, as locked) with `complexity` 10 and `max-lines-per-function` 50 (constitution), plus `eslint-plugin-n` `no-unsupported-features` rules reading `engines.node` `>=18` from `installers/core/package.json` | stack default + constitution + DR-101 |
| `cmd.typecheck` | `pnpm exec tsc --noEmit -p installers/core/tsconfig.json` (typescript 6.0.3 as locked); `allowJs`, `checkJs`, `strict`, `lib` `ES2022`, `types` from `@types/node` 18.19.130 so any API newer than Node 18 is a type error | stack default adapted to DR-101 |
| `cmd.test_unit` | `node --test installers/core` (the built-in runner; runs on Node 18 and on 24) | replaces stack default vitest for this package only: floor |
| acceptance scenarios | Cucumber `~13.3.0` (existing), one scenario per acceptance criterion, driving the CLI through the shims in a temporary home, as `tests/installers/tool.mjs` does | existing config + constitution IV |
| `cmd.test_integration` | n/a: the Cucumber scenarios are the integration level | n/a with reason |
| `cmd.build` | n/a: runs from source, nothing compiled (DR-101) | n/a with reason |
| `cmd.audit` | `pnpm audit --audit-level high` in CI (not in the pre-commit hook, because it needs the network) | stack default |
| check command | `scripts/check-docs.sh` stays the one entry (Node 24 picker, exit codes 3 and 4 unchanged) and gains the lines above | existing config |

- **Options considered:** vitest for unit tests | `node:test` | Jest. Prettier alone for format and lint | Biome. A separate `tsconfig` per runtime package (chosen) | one root `tsconfig`.
- **Chosen:** the table. New dev dependencies in `devDependencies`, exact versions, locked: `prettier` 3.9.10, `eslint` 10.14.0, `typescript` 6.0.3, `@types/node` 18.19.130, `eslint-plugin-n` 18.5.0 (latest on npm 2026-11-13; the plan re-checks its ESLint 10 support before pinning), `yaml` 2.9.1, `ajv` 8.20.0 (DR-103).
- **Rejected:** vitest here (needs a newer Node than 18, so the floor job could not run it); Jest and Biome (a second tool for a slot already filled, STK-R2); one root `tsconfig` (would force `@types/node` 18 on the Node 24 workflow-graph package).
- **Confidence:** medium
- **Supersedes:** none
- **Decided by:** tech-stack · **Approved at:** G3 pending (2026-11-13)

## DR-109: Check command and CI for each repo
- **Tree path:** TC-Q1 per repo (what each repo already runs) → inherit; empty slots get "n/a with reason" rather than new tools on moved code (TC-Q1 default, STK-R5).
- **Criteria:** Blueprint "Test depth": each repo keeps its own `scripts/check.sh` and required CI check; FR-043 (checks green before and after every phase, install plus `doctor` on Mac and Windows); no repo's checks read another repo's files (G12). Moved tools are moved unchanged; adopting format or lint on them would be an unrelated rewrite.

| Repo | Stack | `scripts/check.sh` runs | Package manager |
|---|---|---|---|
| `agent-config` | Node 24 dev, Node 18 runtime code | the DR-108 table, the layout validator (report mode), atlas, tracker, contract fixtures and parity test | pnpm |
| `agent-knowledge` | Node 24, plain `.mjs` validators | `validate-knowledge.mjs`, the company-KB framework validator, Cucumber scenarios moved with it; format, lint, typecheck: n/a (moved tools unchanged; adopting them is a separate change) | pnpm, only for Cucumber |
| `agentic-sdlc` | Node 24 (`typescript-node`) | exactly today's workflow-graph line: `check-graph`, prettier, tsc, eslint, doc-links, vitest, `interfaces`, then `validate.mjs` and `validate-project.mjs` and their scenarios; its pnpm workspace file and `allowBuilds better-sqlite3` move with it | pnpm |
| `agent-companies` | none (data only) | `node <knowledge-provider>/…/validate-company-kb.mjs` with the provider path given as an argument or `AGENT_KNOWLEDGE`; with none it exits naming slot `knowledge-storage` (AC-10.6) | none: no `package.json`, no lockfile |

- **CI shape (devops wires it):** one required check per repo; `agent-config` runs the check on `ubuntu-latest`, `macos-latest` and `windows-latest` with Node from `.nvmrc`; a second job on Node 18 (Ubuntu and Windows) runs only `node --test` and one smoke scenario `install plan --json` against a fixture, which is the proof of the floor; `pnpm audit` on a weekly schedule and on pull requests. Third-party actions are pinned to a full commit SHA, reusing the two already in `validate-docs.yml` (`actions/checkout` v7.0.1, `actions/setup-node` v7.1.0), per GitHub's secure-use guide.
- **Cross-repo use of contracts in CI:** `agentic-sdlc` and `agent-companies` get the build tool and validators by `actions/checkout` of the other repo at a pinned commit SHA into a temporary folder, never by npm or pnpm (FR-034, G12). The pin is a reviewed change; devops owns the wiring.
- **Options considered:** one shared check workflow reused by all four | a monorepo-style root task runner | per-repo `check.sh` (chosen, as the blueprint says).
- **Rejected:** a shared workflow (couples four repos' releases, against "each repo owns its checks"); a task runner such as Turborepo or Nx (nothing here is a multi-package build; extra tool for one script).
- **Confidence:** medium
- **Supersedes:** none
- **Decided by:** tech-stack · **Approved at:** G3 pending (2026-11-13)

## Technical context for `plan.md`

| Field | Value |
|---|---|
| Language/version | JavaScript ESM (`.mjs`, JSDoc, `strict` checkJs); runtime floor Node 18, development Node 24 |
| Primary dependencies | none at run time except vendored `yaml` 2.9.1; the `git` program for `git` sources |
| Storage | files only: `components.lock`, `install-state.json` (JSON); human files in YAML |
| Testing | `node --test` (unit, runs on 18), Cucumber ~13.3.0 (one scenario per acceptance criterion, constitution IV) |
| Target platform | macOS, Linux and Windows (PowerShell 5.1 shim); Mac and Windows proven in CI |
| Project type | CLI plus libraries in one repo, four repos in total |
| Performance goals | none stated in the spec beyond a quick `doctor`; the baseline script only counts characters |
| Constraints | no run-time package install; no committed generated output; unit at most 50 lines, complexity at most 10 |
| Scale | one user, tens of components |

## Review notes for the next role

- STK-R1: each addition is justified above (`yaml` DR-102, `ajv` DR-103, `eslint-plugin-n` and `@types/node` 18 DR-108).
- STK-R3 licences: `yaml` ISC, `ajv` MIT, `@cucumber/cucumber` MIT, `typescript` Apache-2.0, `prettier` MIT, `eslint` MIT, `@types/node` MIT (from `npm view`, 2026-11-13). Security should confirm the vendored-library update path in DR-102.
- STK-R4: all versions exact; `vendor/yaml` is held to the lockfile by a test, not by a second checksum list.
- STK-R5: nothing existing is replaced; vitest stays for workflow-graph and moves with it.
- Not decided here: lint rule content beyond the two constitution numbers (architecture and engineering), pipeline file contents (devops), test depth (qa).

## Open questions (max 3)

1. DR-101: is plain JavaScript with JSDoc and strict type checking acceptable instead of `.ts` for the run-time code? (Default: yes; `.ts` cannot run at the Node 18 floor.)
2. Node 18 left upstream support in April 2025. Keep the floor at 18 as the blueprint says, or raise it to 20 at this gate? (Default: keep 18; 20 would only add `import.meta.dirname` and a few array methods, nothing structural.)
3. DR-103: keep JSON Schema files plus a hand-written reader with a parity test, or the reader alone? (Default: both.)
