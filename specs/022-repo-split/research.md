# Research: agent-config as a motherboard of replaceable components (spec 022)

**Phase:** P4 (plan) · **Run:** R-001 · **Written:** 2026-11-13 by `architecture` (execute) · **Gate:** G3 (pending)

This file holds every decision record of the P4 plan for spec 022, in `decision-record/v2` form. It merges the five role records in `decisions/` and adds the architecture records. The role files keep the full evidence (measurements, commands, sources); a record here states the decision, its options and why. Records are never edited after G3; a changed decision is a new record that names what it supersedes.

Words used once here: **G3** = the plan gate (the human approves `plan.md` and this file). **AP**, **TS**, **TC**, **RT**, **TD**, **DT**, **CC** = the decision trees for architecture pattern, tech stack, toolchain, risk tier, test depth, deployment topology and contract change (`copilot/frameworks/agentic-sdlc/trees/`). **Home** = the agent home `{{AGENT_HOME}}`, `~/.agent-config` after phase 2. **Precedence** = conventions §7, the table that says which role wins a conflict.

## Id ranges

| Range | Role | Source file | Note |
|---|---|---|---|
| DR-001 | security | `decisions/security.md` §1 | Id kept as the Orchestrator asked. `specs/001` and `specs/009` also hold a `DR-001`; ids are unique per feature, so `docs/architecture.md` §8 names the file next to the id |
| DR-101 to DR-109 | tech-stack | `decisions/tech-stack.md` | |
| DR-201 to DR-208 | devops | `decisions/devops.md` | Inline fields reformatted into the record schema; wording unchanged in substance |
| DR-301 to DR-309 | architecture | this file | New in this run |
| DR-401 to DR-418 | system-architecture | `decisions/system-architecture.md` §4 | "Contract facts" lines kept as an extra field |
| DR-501 | qa | `decisions/qa.md` §1 to §3 | The QA file calls it `DR-QA-1`, which is not a valid record id; renumbered here |
| DR-601 to DR-608, `PDM-installers-core`, `PDM-contracts-lib` | human (N-1 override, paradigm, swap everywhere), engineering (parser limits), security (duplicate keys) | this file, section "Overrides and additions after G3" | Added after G3, at G4 (2026-11-13); each supersedes a G3 record or clears an unlisted need |

## Conflicts between the role records, and how precedence resolves them

| # | Between | Conflict | Rule applied | Resolution | Status |
|---|---|---|---|---|---|
| C-1 | security M-02 vs devops DR-207, blueprint "content repos follow `main`" | Does `install` advance a `git` source to the tip of `main` or a new tag? DR-207 says "nothing updates until V runs install", which reads as "install advances" | §7: security can block; an unreviewed push reaching V's machine is fail-open (T-01, T-16) | Security wins. `install` checks out the SHA in `components.lock`. Advancing is an explicit `install --update [<name>]` that prints the commit range and goes through the M-01 consent. No ninth command (DR-205 rejected one) | Resolved; V confirms the default (Q3) |
| C-2 | security M-14 vs spec Edge Cases ("a hook for an agent that is not installed: `doctor` warns only") | A hook whose command no longer resolves turns the guard off silently in Claude Code | §7: security, fail-open | Security wins: `doctor` fails on any merged hook whose command does not resolve; the warning stays only for agents absent from the machine | Resolved; spec amendment S-6 |
| C-3 | security M-01 and M-11 vs spec FR-022 and AC-4.5 | FR-022 guards only the fetch of a suggested source; privileged entries (hooks, services, status line, routes, skill text) would merge without consent | §7: security, fail-open | Security wins: privileged changes exit 10 with a "privileged changes" need, approved only at an interactive terminal | Resolved; amendments S-1, S-5; V signs AR-1 (Q2) |
| C-4 | security M-16 (`install-log.jsonl`, append-only) vs devops (`install.log`, last 1 MB) | Two names and two retention rules for one log | §7 has no row; same intent (audit plus bounded disk) | One file `{{AGENT_HOME}}/install-log.jsonl`, one JSON line per run, rotated at 1 MB keeping one previous file (`install-log.1.jsonl`); no variable values, sources redacted | Resolved here; security confirms at the phase 2 review |
| C-5 | security M-05 vs tech-stack DR-105 | DR-105 declares `git` as a runtime with no version and no protocol limits | Additive; security's floor is stricter | `git` 2.50.1 or later in the runtime check (AC-5.9 pattern), `GIT_ALLOW_PROTOCOL=https:ssh`, `--no-recurse-submodules`, `--` before URLs, refs and URLs starting with `-` refused, 60 s timeout (devops) | Resolved |
| C-6 | security M-17 vs tech-stack DR-102 | DR-102 vendors `yaml` but sets no parser limits | Additive | The one wrapper sets: no custom tags, an alias limit, a 256 KiB size cap per file. Tech-stack confirms the option names against the `yaml` 2.9.1 documentation (unlisted need U-1) | Resolved in intent; option names unconfirmed |
| C-7 | devops DR-202 vs tech-stack DR-105 | Windows link ladder for files: devops uses a hash-tracked copy (a hard link goes stale when its file is replaced by rename); tech-stack uses a hard link, then a copy only with consent | §7 has no tech-stack vs devops row; this is deployment topology, which devops owns against architecture (by analogy) | Devops ladder: symbolic link, then junction for folders; for files a hash-tracked copy. DR-105's rule that every degradation is reported stays; `doctor` shows the copy as "degraded" | Proposed; approving G3 settles it, otherwise escalate |
| C-8 | devops DR-206 vs tech-stack DR-109 | Node 18 floor job on Ubuntu only (devops) or on Ubuntu and Windows (tech-stack) | Stricter wins (FR-033: Mac and Windows) | Node 18 job on Ubuntu and Windows; full matrix on Ubuntu, macOS and Windows on Node from `.nvmrc` | Moot: V's N-1 override removes the Node 18 job (DR-605) |
| C-9 | devops DR-206 vs tech-stack DR-109 | How a provider's CI gets the contracts tool: `contracts.pin` fetch inside `scripts/check.sh` (devops) or `actions/checkout` at a pinned SHA (tech-stack) | Devops owns CI topology | `contracts.pin` and `providers.pin` fetch steps in `check.sh` (they also run locally); both pin a full SHA | Resolved |
| C-10 | tech-stack DR-102, DR-106 vs architecture DR-304 | Module placement: `installers/core/vendor/yaml/` and `scripts/baseline.mjs` (tech-stack) vs `contracts/lib/` (architecture) | Conventions §1: module placement inside one repo is architecture's | Architecture wins on placement. Tech-stack's library, version pin, byte-compare test, "one wrapper is the only importer" rule and pure-module split all stay | Resolved |
| C-11 | system-architecture DR-411 vs spec FR-044 | One shared `cite` implementation vs "each consumer's validator generates the targets" | §7: system-architecture between repos | Same intent: each repo runs `build cite` on its own files, pinned by SHA (G12 holds) | Resolved; wording amendment S-16 |
| C-12 | system-architecture DR-404 vs spec AC-1.6, AC-9.1, AC-13.4 | Baseline 123 lines in 73 files (whole agent-knowledge component) vs 109 in 67; 42 more `{{AGENT_HOME}}` lines to convert | Changes approved acceptance criteria: only V | Default: adopt 123/73 and the 42 lines | Open (Q8) |
| C-13 | system-architecture DR-407, DR-408, DR-405 vs blueprint phases 3 to 5 | Routes renderer and per-entry skill and agent targets ship later than the content that needs them | Changes the G0-approved phase content: only V | Default: move them earlier (providers first) | Open (Q8) |
| C-14 | framework `lint-baseline` (stack `typescript-node`, enforced by `validate-project.mjs`) vs tech-stack DR-108, DR-109 | The validator fails every `typescript-node` component whose folder has no `eslint.config.*` holding the baseline rule names; DR-109 leaves moved `.mjs` tools unlinted and DR-108's lint rules do not list the baseline | Conventions §3: preset intent vs profile form; the constitution may record a style deviation; neither role can decide alone | Default: phase 0's ESLint config for `installers/core/` and `contracts/` carries the baseline names; the constitution records a style deviation for the legacy `.mjs` tools until each is touched | Open (Q1 d) |
| C-15 | security M-01 phase "2 (routes)" vs DR-407 | Routes are generated from phase 3, not phase 2 | Follows from C-13 | M-01 lands in phase 2 as the mechanism, and covers routes in phase 3, skill and agent text in phase 4, hooks, services and status line in phase 5 | Resolved (depends on Q8) |
| C-16 | devops DR-202 vs spec FR-014 | DR-202 adds `store/`, `install.lock`, the journal and the log to the home layout; FR-014 does not list them | Devops owns topology; the spec needs the list | Amend FR-014 | Resolved; amendment D-4 |
| C-17 | devops DR-202 store depth vs mount depths | A relative citation target computed for `generated/<component>/` (depth 2) misresolves when a reader opens the file through a mount of another depth (`companies/ots/`, `instructions/`) | Inside one repo: architecture | DR-307: agents load rendered files at their `generated/` path; mount paths are addresses for link text | Resolved |
| C-18 | qa TD-Q2 (fail-closed while no tier was recorded) vs security DR-001 | QA assumed YES because the tier was unknown | DR-001 sets HIGH | TD-Q2 is YES by the tier, so the negative cases are mandatory for every task | Resolved |

**Unlisted needs** (the plan did not list them; the next gate sees them): U-1 tech-stack confirms the parser limits in `yaml` 2.9.1 (C-6; done at G4: DR-606). U-2 engineering walks the paradigm tree for `installers/core` (done at G4: `PDM-installers-core`, `PDM-contracts-lib`; the constitution's default paradigm is `none`; DR-303 assumes a pure core with effects at the edges, which suits either listed paradigm). U-3 `docs/integrations/` docs for GitHub and the three agents' configuration folders (architecture §6), written in phases 2 and 5.

---

## DR-001: Risk tier
- **Tree path:** RT-Q1 (YES) → HIGH. RT-Q2 and RT-Q3 also answer YES (recorded for the P6 re-check; the first YES decides).
- **Criteria:** RT-Q1, secrets and personal data: the installer merges into `~/.claude/settings.json` (AC-12.3), which can hold `env` tokens and an `apiKeyHelper`; it copies that file into `~/.agent-config-backups/<timestamp>/` (AC-7.3); it clones with V's git credentials (A-17); rendered copies hold V's username in real paths, and agents send loaded text to their model providers. RT-Q2, exposure: the feature decides which code runs with V's full user rights at every session start, prompt and tool call (merged hooks FR-039, MCP servers AC-12.7, the session-start re-render FR-046), and each `component.yaml` can contribute such entries. RT-Q3, untrusted input: new parsing of fetched files and git fetches from URLs in two lists; content repos follow `main`. No regulated data class, so the RT-Q1 escalation clause does not fire.
- **Options considered:** LOW | MEDIUM | HIGH
- **Chosen:** HIGH — the feature controls what code and what always-loaded instructions every agent runs with V's rights, and it handles a file that can hold secrets.
- **Rejected:** MEDIUM — it would skip the threat table before G3 and the per-task security review, yet one malformed `component.yaml` can make an agent run any command at session start; LOW — the fast path's LOW requirement (conventions §8) cannot hold for an installer that writes agent hook files.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** security · **Approved at:** G3 (pending, 2026-11-13)

What HIGH switches on: the STRIDE table in `plan.md` before G3; the test-depth tree's security branch forced; security review on every task of this feature (narrowed at G4 to the nine blocker-mitigation tasks, plan.md Security); security sign-off before G5. A tier only rises; lowering it needs a new record approved by V.

---

## DR-101: Language and runtime for the runtime code (installer core, renderer, build step, baseline)
- **Tree path:** TS-Q0 (constitution and company KB name no stack → NO) → TS-Q1 (blueprint states "a Node core" and "Node >= 18" → YES, use it) → TS-Q4 (no database: state is files, DR-104) → Node, profile `typescript-node`, with one recorded deviation in language form.
- **Criteria:** Floor Node 18 (blueprint, spec A-2); no build or install step on the user's machine; `typescript-node` is the profile detected from the root `package.json` and `pnpm-lock.yaml`; Node's type stripping is not available on Node 18.
- **Options considered:** (A) TypeScript compiled to JavaScript, output committed | (B) TypeScript run by Node type stripping | (C) plain JavaScript ESM with JSDoc types, checked by `tsc --noEmit --checkJs` | (D) Bash and PowerShell only | (E) Go or Rust binary
- **Chosen:** (C) — plain ESM `.mjs`, JSDoc-typed, strict `tsc` checking, no runtime dependency except the vendored `yaml` (DR-102); the only option that runs unmodified on Node 18 with nothing generated committed, and `cmd.typecheck` stays filled with `strict` on.
- **Rejected:** (A) — a committed compiled copy breaks spec A-6 and the spirit of AC-16.10, and creates drift to police; (B) — needs Node 22.6 or later, not available at the floor; (D) — two shell dialects cannot hold the resolver, hashing and rendering logic with tests, and duplicate every rule on Mac and Windows; (E) — a second stack and a binary per platform (TS-Q2: no second stack as a side effect).
- **Confidence:** medium (the language form deviates from the profile's "TypeScript"; Q1)
- **Supersedes:** none
- **Decided by:** tech-stack · **Approved at:** G3 (pending, 2026-11-13)

## DR-102: Runtime dependency policy and YAML handling
- **Tree path:** TS-Q1 (YAML files are fixed interfaces) → STK-R1 and STK-R2 check: Node has no built-in YAML parser → vendor one library.
- **Criteria:** The installer reads and edits human-written YAML (`components.local.yaml`, `variables.local.yaml`, every `component.yaml`); a misparse changes what is linked into agent folders. `add`, `use` and `init-component` must keep V's comments. `yaml` 2.9.1 is ISC licensed, has no dependencies, declares `node >= 14.6`, and is already a pinned dev dependency of workflow-graph.
- **Options considered:** (A) vendor `yaml` 2.9.1 | (B) hand-written YAML subset parser | (C) switch the interface files to JSON | (D) install `yaml` into the home with a package manager at run time
- **Chosen:** (A) — copy `node_modules/yaml/browser/dist/` (pure ESM) with its `LICENSE`; the root `package.json` pins `yaml` 2.9.1 as a dev dependency so the lockfile holds its integrity hash; a dev script does the copy, and a unit test fails if the vendored tree differs byte for byte from the locked package or the version drifts; one wrapper module is the only importer; Prettier and ESLint ignore `vendor/`. (Folder placement: DR-304, conflict C-10. Parser limits: C-6.)
- **Rejected:** (B) — the existing hand parsers cover flat front matter only, a silent misparse in the installer is worse than in a validator, and it cannot keep comments when rewriting; (C) — the spec fixes the file names and formats and V edits these files by hand; (D) — violates FR-034 and needs network and a package manager at install time.
- **Confidence:** high (tested 2026-11-13: `browser/dist/index.js` of `yaml` 2.9.1 imports and round-trips a commented document on Node 24.22.2 and 22.23.4; Node 18 is proven by the floor CI job, DR-109)
- **Supersedes:** none
- **Decided by:** tech-stack · **Approved at:** G3 (pending, 2026-11-13)

## DR-103: Schema format for the contract files
- **Tree path:** TS-Q1 (FR-002: "machine-checkable schemas") → STK-R2 (do not duplicate a capability) → JSON Schema as the published contract, a small hand-written reader at run time, one parity test.
- **Criteria:** FR-003 needs messages that name a replacement; FR-005 needs "warn on unknown keys, skip only that component"; JSON Schema validators give neither. The reader runs on Node 18 with no dependencies, so a JSON Schema engine cannot run there.
- **Options considered:** (A) JSON Schema 2020-12 files for editors and review, checked in development with `ajv` 8.20.0, plus a zero-dependency reader, plus a parity test feeding one shared fixture set to both | (B) hand-written reader only | (C) `ajv` standalone-compiled validators committed | (D) `zod` at run time
- **Chosen:** (A) — the reader holds the cross-checks JSON Schema cannot express (unknown keys, removed keys, slot and location logic).
- **Rejected:** (B) — no editor support and no neutral statement of the contract for other repos' authors; (C) — a committed generated file that still could not give the custom messages; (D) — a run-time dependency for no gain over the reader.
- **Confidence:** medium (the parity test is the price; Q1)
- **Supersedes:** none
- **Decided by:** tech-stack · **Approved at:** G3 (pending, 2026-11-13)

## DR-104: Machine-owned state files and writes
- **Tree path:** TS-Q4 (state is two small files; no relational, document or cache need) → plain files, no database.
- **Criteria:** FR-026 (idempotent reruns, nothing replaced without a backup, previous links kept on failure); `install-state.json` already named as JSON; hashes for `doctor` and `uninstall`.
- **Options considered:** (A) JSON for machine-written files, YAML for human-edited files | (B) YAML everywhere | (C) SQLite
- **Chosen:** (A) — `components.lock` and `install-state.json` are JSON with sorted keys and two-space indent, so identical input gives identical bytes; written to a temporary file in the same folder, then `fs.renameSync`; SHA-256 from `node:crypto`; no other store.
- **Rejected:** (B) — V never edits these files, and a JSON parse cannot silently differ; (C) — a native addon (`better-sqlite3`) on a no-install machine.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** tech-stack · **Approved at:** G3 (pending, 2026-11-13)

## DR-105: Source adapters and operating-system primitives
- **Tree path:** TS-Q1 (FR-020 fixes `git` and `path` adapters) → STK-R2 → standard library plus the `git` program.
- **Criteria:** A-17 (a clone uses V's credentials), AC-10.4 (a network or credential failure fails only that component and names the cause), AC-7.x (backup, read-only rendered files), the Windows link fallback in `installers/lib/link-or-copy.ps1`.
- **Options considered:** (A) run `git` with `child_process.execFile` and an argument array (no shell), `GIT_TERMINAL_PROMPT=0`, shallow fetch of the wanted ref into staging, `git rev-parse HEAD` for the lock | (B) a JavaScript git library (`isomorphic-git`) | (C) download GitHub tarballs over HTTP
- **Chosen:** (A) — `git` joins the declared runtimes checked before apply (FR-024); links follow the order proven in `link-or-copy.ps1` (symbolic link, then junction for folders) and each degradation is reported; rendered copies are made read-only with `fs.chmod`. (File fallback on Windows: conflict C-7. Git version and protocol limits: C-5.)
- **Rejected:** (B) — a large dependency tree with its own credential handling, against A-17; (C) — cannot clone private forks or use V's credential helper, and gives no SHA to lock.
- **Confidence:** medium (unconfirmed until the Windows CI job: that `fs.chmod` sets the read-only attribute on Windows, and that a junction needs no administrator right)
- **Supersedes:** none
- **Decided by:** tech-stack · **Approved at:** G3 (pending, 2026-11-13)

## DR-106: Renderer, build step and dry-run baseline
- **Tree path:** TS-Q2 (inherit DR-101) → STK-R2 → pure-function modules sharing one rules module; no Markdown or template library.
- **Criteria:** A-28 (the dry run and the phase-5 renderer apply the same path swap and generated-from line); FR-045 (a rendered file differs from its source only at citations and the added line); AC-11.1 (the same source built twice gives identical output); AC-11.5 (`{{include:}}` inlined, a missing file fails with its path); A-7 (characters are the unit).
- **Options considered:** (A) a line scanner that skips fenced code and rewrites only `[{{AGENT_HOME}}/…](…)` links; front matter through the vendored `yaml`; Codex TOML by a small emitter for strings, string lists and multi-line text | (B) a Markdown parser (`remark`) or a template engine | (C) a TOML library
- **Chosen:** (A) — one pure rules module is the only place the swap and the generated-from line are defined; the renderer applies it to files; the baseline applies it in memory and counts Unicode code points (`Array.from(text).length`), recording method, Node version, date and commit; the build is deterministic (sorted keys, LF endings, no timestamps; the stamp carries source revision and adapter version only). (Module placement: DR-304.)
- **Rejected:** (B) — a parser round trip reformats text that must stay byte-identical outside citations, and is a run-time dependency; (C) — the build only writes, and the Codex agent shape needs a few value types (spec 016).
- **Confidence:** medium (the Codex agent TOML shape is re-checked against spec 016 before phase 4)
- **Supersedes:** none
- **Decided by:** tech-stack · **Approved at:** G3 (pending, 2026-11-13)

## DR-107: Entry points `install.sh` and `install.ps1`
- **Tree path:** TS-Q2 (`installers/` already has both) → thin shims.
- **Criteria:** FR-033 (same steps on Mac and Windows), FR-035 (until phase 5 the existing installers keep wiring agent folders), exit codes 0, 10, 1 and 2 pass through unchanged.
- **Options considered:** (A) each shim only finds `node` 18 or later (`NODE` override first, then `PATH`), prints one message and exits if absent, otherwise runs `node installers/core/main.mjs "$@"` and returns its exit code | (B) shims that hold install logic
- **Chosen:** (A) — no install logic and no other parsing in the shims, so there is one implementation to test; the PowerShell target stays Windows PowerShell 5.1. (Devops P-7: a missing Node prints a need and exits 10, nothing changed.)
- **Rejected:** (B) — two copies of the logic, the Mac-versus-Windows drift the spec exists to avoid.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** tech-stack · **Approved at:** G3 (pending, 2026-11-13)

## DR-108: Toolchain for agent-config (installer, contracts, renderer, build step, baseline)
- **Tree path:** TC-Q1 (partial: Cucumber, pnpm, the Node 24 pin and `check-docs.sh` exist; no format, lint or typecheck for `.mjs` tools) → inherit the configured slots → TC-Q2 (constitution size and complexity limits, principle IV) → TC-Q3 for empty slots, with the Node 18 floor overriding two stack defaults.
- **Criteria:** Existing configuration is not replaced (TC-Q1 default); the stack default `cmd.test_unit` is vitest, which cannot run on the floor.

| Slot | Value |
|---|---|
| `package_manager` | pnpm, pinned by `packageManager`; root `pnpm-lock.yaml` |
| language version | Node 24 for development (`.nvmrc`); runtime code limited to Node 18 APIs, enforced by tsc and ESLint |
| `cmd.format` | `pnpm exec prettier --check .` (3.9.10); `vendor/` ignored |
| `cmd.lint` | `pnpm exec eslint . --max-warnings 0` (10.14.0) with `complexity` 10 and `max-lines-per-function` 50, plus `eslint-plugin-n` `no-unsupported-features` reading `engines.node >=18` |
| `cmd.typecheck` | `pnpm exec tsc --noEmit -p <package>/tsconfig.json` (typescript 6.0.3); `allowJs`, `checkJs`, `strict`, `lib ES2022`, `@types/node` 18.19.130 so any newer API is a type error |
| `cmd.test_unit` | `node --test` (built-in; runs on 18 and 24) |
| acceptance scenarios | Cucumber `~13.3.0`, one scenario per acceptance criterion, driving the CLI through the shims in a temporary home |
| `cmd.test_integration` | n/a: the Cucumber scenarios are the integration level |
| `cmd.build` | n/a: runs from source |
| `cmd.audit` | `pnpm audit --audit-level high` in CI |
| check command | `scripts/check-docs.sh` stays the one entry and gains the lines above |

- **Options considered:** vitest | `node:test` | Jest for unit tests; Prettier alone | Biome for format and lint; one `tsconfig` per runtime package | one root `tsconfig`
- **Chosen:** the table — new exact dev dependencies: `prettier` 3.9.10, `eslint` 10.14.0, `typescript` 6.0.3, `@types/node` 18.19.130, `eslint-plugin-n` 18.5.0 (ESLint 10 support re-checked before pinning), `yaml` 2.9.1, `ajv` 8.20.0. (Lint-baseline conflict: C-14.)
- **Rejected:** vitest here — needs a newer Node, so the floor job could not run it; Jest and Biome — a second tool for a filled slot (STK-R2); one root `tsconfig` — it would force `@types/node` 18 on the Node 24 workflow-graph package.
- **Confidence:** medium
- **Supersedes:** none
- **Decided by:** tech-stack · **Approved at:** G3 (pending, 2026-11-13)

## DR-109: Check command and CI for each repo
- **Tree path:** TC-Q1 per repo (what each repo already runs) → inherit; empty slots get "n/a with reason" rather than new tools on moved code (STK-R5).
- **Criteria:** Blueprint "Test depth": each repo keeps its own `scripts/check.sh` and required CI check; FR-043; G12. Moved tools move unchanged.

| Repo | `scripts/check.sh` runs | Package manager |
|---|---|---|
| agent-config | the DR-108 table, the layout validator (report mode), atlas, tracker, contract fixtures and parity test | pnpm |
| agent-knowledge | `validate-knowledge.mjs`, the company-KB validator, their Cucumber scenarios; format, lint, typecheck n/a (moved tools unchanged) | pnpm, only for Cucumber |
| agentic-sdlc | today's workflow-graph line (`check-graph`, prettier, tsc, eslint, doc-links, vitest, `interfaces`), then `validate.mjs` and `validate-project.mjs` and their scenarios | pnpm |
| agent-companies | the company-KB validator from the knowledge provider passed as an argument; with none it exits naming slot `knowledge-storage` (AC-10.6) | none |

- **Options considered:** one shared check workflow reused by all four | a monorepo task runner | per-repo `check.sh`
- **Chosen:** per-repo `check.sh` (the blueprint's choice); CI matrix and floor job wired by devops (DR-206, C-8, C-9); third-party actions pinned to full SHAs.
- **Rejected:** a shared workflow — couples four repos' releases, against "each repo owns its checks"; a task runner such as Turborepo or Nx — nothing here is a multi-package build.
- **Confidence:** medium
- **Supersedes:** none
- **Decided by:** tech-stack · **Approved at:** G3 (pending, 2026-11-13)

---

## DR-201: Environments and promotion
- **Tree path:** DT-Q1 (YES) → DT-Q2 (YES, inherit) → DT-Q3 (real users) → DT-Q4
- **Criteria:** FR-043 (each phase ends with install + `doctor` on Mac and Windows); AC-7.2; blueprint "Deploy impact"; release-pipeline RLS-2 and RLS-4.
- **Options considered:** (a) single environment, deploy on merge | (b) preview + staging + production with a manual gate | (c) like (b) plus a permanent canary machine
- **Chosen:** (b) — preview = CI on every pull request with a throwaway home on Ubuntu, macOS and Windows runners and fixture components (no network); staging = on V's machine, `plan`, then the installer's own staging (version trees validated before any link moves), with a throwaway-home rehearsal first in phases 2 and 5; production = V's real home, Mac first, then Windows, merged by V (G5) only after both pass the runbook (DR-208).
- **Rejected:** (a) — a broken home is every agent's broken start-up, and failure must keep the old state; (c) — two machines, Mac then Windows, already give a staged promotion.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** devops · **Approved at:** G3 (pending, 2026-11-13)

## DR-202: Agent home, staging store and atomic switch
- **Tree path:** DT-Q2 (inherit) → DT-Q4 (stateless code and state files) → rollback by repointing links
- **Criteria:** FR-013 to FR-015, FR-026, AC-7.1, AC-7.2, AC-16.2; existing `backup_existing`. Tested 2026-11-13 on macOS (Darwin 25.1.0, Node v24.22.1): `fs.renameSync(tmpLink, existingDirLink)` replaces a directory symlink in one step. Windows not tested.
- **Options considered:** (a) mutate in place (`git checkout` in a managed clone, then re-link) | (b) per-component immutable version trees plus link swap | (c) one `generations/<id>/` folder for the whole install behind one `current` link
- **Chosen:** (b) — `components/<name>/` is a fetch cache, never linked; `store/<name>@<id>/` holds one immutable tree per version, `<id>` = first 12 hex characters of a hash over (source revision, home path, renderer version, adapter version); mounts link into store trees (linked class) or into `generated/`; `generated/<component>` links to `../store/<name>@<id>`; single generated files are written by temporary file and rename; backups live outside the home. Apply order: take `install.lock` (stale after 10 minutes; the session-start hook only tries it) → read, resolve, plan (pure) → acquire into cache and new store trees → validate every staged tree (schema, cycles, majors, exports, runtimes, build, render, budgets) → on any failure delete the new trees and exit 1 with live links untouched → back up → write the journal `install-state.pending.json` → switch each link by temporary link plus rename → write lock and `install-state.json` (the commit point) and delete the journal → prune to current + previous per component → report. An interrupted run is restored from the journal by the next `install` or `doctor`. Windows: remove-then-create per link, covered by the journal; link ladder symbolic link, junction, hash-tracked copy (C-7).
- **Rejected:** (a) — changes the live version before the checks run and cannot keep the previous version linked; (c) — puts copies three levels deep, breaking the relative citation target, and swaps all components or none for little gain.
- **Confidence:** medium (Windows rename behaviour unconfirmed)
- **Supersedes:** none
- **Decided by:** devops · **Approved at:** G3 (pending, 2026-11-13)

## DR-203: Backups and V's local files
- **Tree path:** DT-Q4 (data → expand-then-contract; irreversible loss avoided) → backup before replace
- **Criteria:** AC-7.3, AC-12.3, FR-026; `installers/lib/link-or-copy.*` (one timestamped folder per run, created lazily, `.N` suffix on clash); RLS-5; Q-REL-11. `components.local.yaml` and `variables.local.yaml` are the only state that cannot be rebuilt from git.
- **Options considered:** (a) back up only what `install` replaces | (b) (a) plus a copy of V's two local files before every `set`, `add` or `use` | (c) keep the local files in a private git repo
- **Chosen:** (b) — `~/.agent-config-backups/<yyyyMMddHHmmss>/` (Windows `%USERPROFILE%\.agent-config-backups\<…>\`), mode 0700, with `backup-manifest.json` (original path, backup path, kind, hash); never deleted by any command; `doctor` prints count and size and warns above 20 folders; before `set`, `add`, `use` or an edit of `~/.claude/settings.json`, `~/.claude/CLAUDE.md` or Codex files the previous content is copied into the run's folder; the one-time move backs up the real `~/.copilot/global-variables.md` and offers its values as proposals.
- **Rejected:** (a) — loses the only copy of the previous variable values when `set` overwrites; (c) — an account-level resource that risks publishing V's paths.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** devops · **Approved at:** G3 (pending, 2026-11-13)

## DR-204: Compatibility links and the move (expand-then-contract)
- **Tree path:** DT-Q4 (data → expand-then-contract; combined with risky behaviour) → one release between expand and contract
- **Criteria:** FR-031, FR-032, AC-8.1 to AC-8.6, A-12, `mapping.yaml` (13 targets under `~/.copilot`), RLS-6.
- **Options considered:** (a) move the home and retire old paths in the same release | (b) expand in phase 2, contract in a later tagged release | (c) never retire
- **Chosen:** (b) — expand: the new home plus a compatibility link at every old agent-home path (knowledge, companies, frameworks, patterns, references, procedures, atlas, tracker, `global-variables.md`, `instructions/core.instructions.md`, and anything else the AC-8.4 sorting classifies as agent-home); Copilot's own folders never replaced by a whole-folder link, entry-level links where needed; each recorded with class `compat` and its retiring release. Contract: the next tagged agent-config release lists them under `retired:`; `install` removes one only if it is still the installer's own link. Before that tag the hook files and memory folders are searched for old paths (`doctor` prints hits, P-5); a hit blocks retirement.
- **Rejected:** (a) — running sessions and hook commands name `~/.copilot/…` and would break mid-session; (c) — two paths per fact forever, against constitution I.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** devops · **Approved at:** G3 (pending, 2026-11-13)

## DR-205: Rollback paths
- **Tree path:** DT-Q4 → stateless code: redeploy previous; state: expand-then-contract; risky behaviour: keep an escape lever
- **Criteria:** OPS-R2, RLS-5 (a rollback must have been exercised), Q-REL-10, AC-7.2, AC-7.6.
- **Options considered:** a named rollback per deployable class using `use`, `install`, `uninstall --restore`, `--legacy` and git tags | a `rollback` command | automatic rollback on a trigger
- **Chosen:** a named rollback per class, needing no fetch where possible: failed install → automatic (live links never moved); crash during the switch → journal restore; content repo update → `use <name> <url>#<previous sha>` + `install` (previous tree kept in `store/`); agentic-sdlc → revert the pin or `use`; installer or contracts code → `git checkout <previous tag>` in V's clone + `install` (state files carry a schema major; a newer major is refused); phases 2 to 4 as a whole → `uninstall`, then `installers/install.sh --legacy` (old mapping logic kept in `installers/legacy/` until phase 5 plus one tag), with `uninstall --restore` returning backed-up files (A-D1); merged hooks (phase 5) → `uninstall` removes only matching entries, `--restore` returns `settings.json`; worst case → tag `pre-022` at `825ea82` and the old installer.
- **Rejected:** a `rollback` command — a ninth command for what `use` + `install` already do; automatic rollback on a trigger — no running service to measure (RLS-9), and the install validates before it switches.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** devops · **Approved at:** G3 (pending, 2026-11-13)

## DR-206: Continuous integration per repo
- **Tree path:** DT-Q2 (inherit `validate-docs`) → add the minimum per new repo
- **Criteria:** RLS-1, RLS-3, OPS-R4 (no secrets), RLS-4, FF-1, FF-2, FF-6, FF-7, FF-9; blueprint "Test depth" and "Build and checks"; conventions §13 and GitHub's secure-use guidance (pin full SHAs).
- **Options considered:** (a) copy `validate-docs.yml` and adapt each | (b) one thin workflow per repo that only runs `scripts/check.sh` | (c) a shared reusable workflow in agent-config
- **Chosen:** (b) — `.github/workflows/check.yml`, one job `check`, `permissions: contents: read`, triggers `pull_request` (no path filter), `push` to main, `workflow_dispatch`, weekly schedule; checkout and setup-node pinned to the SHAs `validate-docs.yml` uses; `pnpm install --frozen-lockfile` where a lockfile exists; no secrets. agent-config keeps `validate-docs` and `check-docs.sh` until phase 8 (the one named `repo-layout/v1` exception), and adds `installer.yml` (matrix Ubuntu, macOS, Windows with a throwaway home, plus the Node 18 job; required from phase 2: `installer (macos)`, `installer (windows)`) and `integration.yml` (nightly and on changes to `components.yaml`: real `git` sources into a throwaway home, `install`, `doctor`, `uninstall`). Providers get the contracts tool through `contracts.pin` (tag + full SHA, fetched into a git-ignored `.cache/`, SHA checked) and the provider to check citations against through `providers.pin`; pull requests check the pin, the nightly job checks `main`.
- **Rejected:** (a) — four drifting copies; (c) — every repo's CI would read agent-config's files at run time, against the boundary rule.
- **Confidence:** medium (Windows runner link permissions unconfirmed)
- **Supersedes:** none
- **Decided by:** devops · **Approved at:** G3 (pending, 2026-11-13)

## DR-207: Release, tags and rollout order
- **Tree path:** DT-Q5 (YES) → provider deploys first; old contract live until all consumers migrate
- **Criteria:** blueprint "Versioning"; conventions §13; CC-Q1 to CC-Q3; A-5, A-12; AC-14.1.
- **Options considered:** (a) tag everything on every merge | (b) tags only where something pins or compares | (c) publish packages to a registry
- **Chosen:** (b) — agent-config: `vM.m.p` at the end of phases 2, 5 and 8 and when retiring compatibility links, and `contracts/vM.m.p` for the contracts tool and schemas; agentic-sdlc: annotated `vM.m.p` equal to `framework-version`, pinned in `components.yaml`, lock stores the SHA, a moved tag fails (P-4); agent-knowledge and agent-companies: a tag only when `component.yaml` `version` changes, otherwise follow `main` recorded by SHA. Nothing publishes artifacts; `CHANGELOG.md` is the release note. Rollout for any contract change: contracts reader accepting N and N-1 and a tag → providers of content, then consumers, one pull request each → the composition root updates pins (`integration.yml` green) → drop N-1 later when `doctor` shows no enabled component needs it. New repos appear in the order agent-companies (phase 3), agent-knowledge (6), agentic-sdlc (7), each with CI in its first pull request and green before agent-config removes the content. (How updates reach V's machine: C-1.)
- **Rejected:** (a) — tags nobody reads; (c) — a registry needs credentials and contradicts FR-034.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** devops · **Approved at:** G3 (pending, 2026-11-13)

## DR-208: Per-phase install + `doctor` run on Mac and Windows
- **Tree path:** DT-Q3 (manual promotion gate) → FR-043
- **Criteria:** FR-043, SC-013, AC-1.9, AC-7.1, AC-8.6, `SETUP.md` step 7. Before phase 2 there is no `doctor`; the old installers are what V runs.
- **Options considered:** the same runbook for every phase on Mac then Windows | a Mac-only run | skipping the runbook for checks-only phases
- **Chosen:** the same runbook every phase, from the phase branch, Mac then Windows, evidence in the pull request: (1) repo checks and CI including the macOS and Windows installer jobs; (2) save the install tree snapshot and ten sampled `~/.copilot/…` paths with hashes; (3) `install plan` (phases 0 and 1: old installer in a throwaway home), empty difference in phases 0, 1 and 8; (4) `install` (first run exits 10, confirm, rerun); (5) `install` again → "no changes"; (6) `doctor` twice → exit 0, identical; (7) start the three agents and compare the loaded core text hash; (8) Windows: record the link kind and run once in a path with a space; (9) after merge: pull, `install`, `doctor` on both machines. Per-phase additions are in `plan.md` "Phases".
- **Rejected:** a Mac-only run — Windows link behaviour is the main platform difference; skipping checks-only phases — FR-043 requires it and it costs minutes.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** devops · **Approved at:** G3 (pending, 2026-11-13)

---

## DR-301: Architecture pattern for agent-config
- **Tree path:** AP-Q1 (single team: V is the only maintainer and user, A-1; independent deployment is needed only between repos, which system-architecture already decided at P1 and confirms in DR-401 to DR-418) → AP-Q2 (moderate, modular growth: four kinds of motherboard part with different change rates, measured coupling of 26 of 73 knowledge commits touching agentic-sdlc) → modular monolith inside agent-config.
- **Criteria:** Blueprint "Architecture" rows (contracts first; motherboard in two parts; four repos); spec Key Entities ("Motherboard"); G7 (the root holds only motherboard parts); MOD-1, MOD-2; the AP trade-off table (modular monolith is the default, cheap to split later). AP-Q1's microservices branch is not reached: the split into repos is a component split under one maintainer, not independently operated services.
- **Options considered:** single layered project | modular monolith (contracts, composition root, core content, platform adapters, checks as modules with a declared dependency direction) | a fifth repo for `contracts/`
- **Chosen:** modular monolith — agent-config keeps one deploy (V's clone) and gets explicit module seams, so contracts can be tagged on their own (`contracts/vM.m.p`) and the installer core can grow without touching content.
- **Rejected:** single layered project — the contracts, the installer and core content change for different reasons and at different cadences (DP-1), and the provider repos pin the contracts alone; a fifth repo for contracts — the blueprint's split test fails it (nothing uses the contracts without the installer), and a separate tag already gives provider CI a pin.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** architecture · **Approved at:** G3 (pending, 2026-11-13)

## DR-302: Motherboard tiers and dependency direction inside agent-config
- **Tree path:** n/a (follows from DR-301; MOD-2, CA-1, CA-8)
- **Criteria:** System-architecture's allowed and forbidden edges (section "Context map" below): contracts → any component forbidden; required components never cite optional ones. Devops P-3: provider repos run the contracts tool from a checkout of `contracts/` at a pinned tag, so the tool must not import anything outside `contracts/`. TR-6 and A-28: one rules module shared by dry run, `cite --write` and renderer.
- **Options considered:** (A) four tiers in one direction: `contracts/` (schemas, examples, a pure library, the `build/v1` tool) ← `installers/` (composition root: the installer core, the shims, `components.yaml`) and core content (a component like any other, slot `core`) and `adapters/` (data read by the build tool) ← checks (`tests/`, `scripts/`) | (B) the installer core owns the shared rules and the build tool imports it | (C) no declared direction, reviewed by hand
- **Chosen:** (A) — `contracts/` depends on nothing else in the repo; the installer core depends on `contracts/` and reads every component (core included) only through its `component.yaml` and declared locations; core content conforms to the contracts and cites `agent-knowledge` exports only; `adapters/<name>/fields.yaml` is data the `build` subcommand reads; tests and scripts may depend on everything and nothing depends on them. Enforced by FF-1 and FF-2: `atlas.yaml` edges for the content tiers, lint import zones and an architecture test for the code tiers.
- **Rejected:** (B) — provider CI would need the installer to check citations, and the contracts tag would carry installer code (a contracts → composition-root edge); (C) — the cycles this feature exists to cut would come back unnoticed.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** architecture · **Approved at:** G3 (pending, 2026-11-13)

## DR-303: Installer core packaging and wiring
- **Tree path:** n/a (MOD-9, MOD-10, MOD-11; CA-1 to CA-10)
- **Criteria:** The installer has more than three feature areas (home, sources, resolution, variables, rendering, agent wiring, state and safety, commands), so MOD-9 rules out the layer-first opt-in. The spec's pipeline read → resolve → plan → apply → report (FR-016) needs a pure core with effects at the edges (CA-7, Q-MAINT-9). Constitution limits: 50 lines and complexity 10 per unit.
- **Options considered:** (A) feature-first modules under `installers/core/src/modules/`, each with `domain/ application/ infrastructure/ interface/`, wired by one composition root and one composer per module (W2) | (B) folders per pipeline stage (`read/ resolve/ plan/ apply/ report/`) | (C) layer-first (opt-in)
- **Chosen:** (A) — modules `manifests`, `sources`, `resolution`, `variables`, `rendering`, `wiring`, `state`, `commands` and `shared`; allowed edges: `commands` → every other module; `resolution`, `sources`, `rendering`, `wiring` → `manifests`; `rendering` → `variables`; every module → `shared`; nothing → `commands`. `installers/core/main.mjs` is the entry point, `installers/core/src/CompositionRoot.mjs` the only place that picks adapters. Each module's public surface is its application use cases and their input and output types (MOD-3). Paradigm left to engineering (U-2).
- **Rejected:** (B) — package by technical role (MOD-1): every new feature edits all five stage folders, and the stages share no vocabulary; (C) — MOD-9 allows it only up to three feature areas and one bounded context.
- **Confidence:** medium (the module cut is checked against the phase 2 tasks at P5; merging two thin modules is a recorded pure move)
- **Supersedes:** none
- **Decided by:** architecture · **Approved at:** G3 (pending, 2026-11-13)

## DR-304: Shared pure rules live in `contracts/lib/`; the baseline is a `build` subcommand
- **Tree path:** n/a (DR-302; DP-6, MOD-4)
- **Criteria:** TR-6 (the swap rules and the citation classifier are one module each, imported by dry run, `--write` and renderer); A-28 (the phase-0 baseline and the phase-5 renderer stay comparable); DR-102 ("one wrapper is the only importer" of `yaml`); devops P-3 (provider CI runs only `contracts/`); conflict C-10.
- **Options considered:** (A) `contracts/lib/` holds the pure modules: manifest and list reader, slot and location classifier, citation classifier, render rules, character counter, the `yaml` wrapper with `vendor/yaml/`; the installer core imports them; the phase-0 baseline is `contracts/tools/build.mjs budget --baseline` (dry run, writes nothing) | (B) tech-stack's placement: `installers/core/vendor/yaml/`, `installers/core/yaml.mjs`, `scripts/baseline.mjs` | (C) copy the rules into both the installer and the build tool
- **Chosen:** (A) — the lowest tier owns the published language; the installer and every provider CI use the same bytes at a pinned tag.
- **Rejected:** (B) — the build tool, which provider CI runs from `contracts/` alone, would import from `installers/` (a forbidden edge), and the baseline script would sit outside both; (C) — duplicated knowledge that A-28 says must not drift.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** architecture · **Approved at:** G3 (pending, 2026-11-13)

## DR-305: Ports, seams and one report model (testability TR-1 to TR-8)
- **Tree path:** n/a (CA-2, CA-7, CA-9, CA-10; QA TR-1 to TR-8)
- **Criteria:** QA's eight testability needs; QB-4 (no real network, clock, home or agent in the automated suite); security M-07 (redaction in every report) and M-11 (consent needs an interactive terminal); CON-15 (the installer's commands, exit codes and `--json` report are an interface).
- **Options considered:** (A) driven ports owned by the application layer: `FileSystem`, `Links`, `Git`, `Clock`, `Environment` (home, platform, variables of the process), `Terminal` (is it interactive, prompt), `Runtime` (versions of `node` and `git`), `HomeLock`; a fault-injection adapter that wraps `FileSystem`, `Links` and `Git` and is built only by the test composition (selected through one environment variable read by the composition root alone, and able only to make operations fail); one report model (status, exit code, needs, findings, changes) rendered by one text and one JSON presenter, with redaction and the message catalog in the presenter | (B) mock modules in tests and messages written where they occur | (C) a hidden `--test-*` flag family on the CLI
- **Chosen:** (A) — scenarios run the real CLI on a temporary home with local bare git repos (TR-2), inject faults (TR-3), fake `node --version` through `Runtime` (TR-7), and compare exact text (TR-5); every hook command prints one machine-readable result line (TR-8).
- **Rejected:** (B) — mocks test the mocks, and scattered messages cannot be compared exactly or redacted in one place; (C) — test flags become public interface that CON-15 must describe and agents may call.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** architecture · **Approved at:** G3 (pending, 2026-11-13)

## DR-306: The plan is data
- **Tree path:** n/a (DR-305; TR-4, DR-202 step 7, M-01)
- **Criteria:** AC-7.4 (`plan` lists every change and writes nothing); TR-4 ("plan = what apply does" must be provable); DR-202's journal; M-01's privileged set computed by `plan`; AC-1.7's dry run writes nothing.
- **Options considered:** (A) the pure planner returns one `Plan`: an ordered list of operations (`backup`, `link`, `write`, `chmod`, `remove`, `merge-entry`), each with path, target or content hash, delivery class, owning component and a `privileged` flag; `plan` presents it, `apply` executes it, the journal is it plus the old targets, the consent need is its privileged subset diffed against `install-state.json`, a dry run applies it to an in-memory recorder | (B) apply computes as it goes and `plan` re-runs the logic with writes disabled | (C) `plan` is a separate code path
- **Chosen:** (A) — one structure makes the four behaviours agree by construction; a scenario compares `plan` output with the file-system diff after `apply`.
- **Rejected:** (B) — every write site needs a guard, and one missed guard writes during `plan`; (C) — two implementations of the same knowledge (DP-6).
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** architecture · **Approved at:** G3 (pending, 2026-11-13)

## DR-307: Load paths of rendered copies
- **Tree path:** n/a (rendered-copy/v1 DR-406; store depth DR-202; conflict C-17)
- **Criteria:** AC-16.2 fixes the target of a citation in `generated/agentic-sdlc/foo.md` as `../../knowledge/x.md`, computed from the copy's `generated/` folder; AC-16.5 says routes, instruction links and skill folders resolve under `generated/`; A-27 says `{{AGENT_HOME}}/companies/` and `{{AGENT_HOME}}/frameworks/<name>/` show the rendered files; mounts sit at depth 1 (`instructions`, `companies`), 2 (`frameworks/<name>`, `companies/ots`) or more, while every `generated/<component>/` and `store/<name>@<id>/` sits at depth 2.
- **Options considered:** (A) agents load a rendered file at its `generated/<component>/<path>` path (routes, Claude import lines, Copilot instruction links, skill and agent links all point there); a citation's relative target is computed from that folder to the cited file's mount path; mount paths of rendered components are addresses, used in link text and by people; a check resolves every rendered target from the copy's folder | (B) compute targets from the mount path and load through mounts | (C) lay out `generated/` by mount path
- **Chosen:** (A) — it is what AC-16.2 and AC-16.5 already say, and it resolves the same way through a link or a real path because `generated/<component>` and its store tree have the same depth.
- **Rejected:** (B) — contradicts AC-16.2, and a rendered file has one target per citation but can be reached through mounts of different depths; (C) — every target gains one `../` against the spec's worked example, and shared mounts (`companies/`) still differ by entry.
- **Confidence:** medium (whether VS Code resolves a relative target lexically or through the link is unconfirmed, P4-19; agents read the absolute link text, which is right in every case)
- **Supersedes:** none
- **Decided by:** architecture · **Approved at:** G3 (pending, 2026-11-13)

## DR-308: Target root set of agent-config (G7, AC-15.1)
- **Tree path:** n/a (DR-301; blueprint "Layout without leading dots"; `repo-layout/v1`)
- **Criteria:** AC-15.1 and SC-007 ("the target set fixed at P4"); blueprint layout `home/`, `skills/`, `agents/`, `adapters/claude|codex|copilot/`, `installers/`, `components.yaml`; `repo-layout/v1` required files (DR-412); constitution: `proposals/` is kept as it is; no leading dots on adapter folders (blueprint reason: discovery and search tools skip hidden folders).
- **Options considered:** (A) the set below | (B) keep `copilot/` as the core folder | (C) put content sources under `src/`
- **Chosen:** (A) — folders: `.claude/`, `.githooks/`, `.github/`, `.specify/`, `adapters/`, `agents/`, `contracts/`, `docs/`, `home/`, `installers/`, `proposals/`, `scripts/`, `skills/`, `specs/`, `tests/`. Files: `.gitignore`, `.ignore`, `.nvmrc`, `AGENTS.md`, `CHANGELOG.md`, `CLAUDE.md`, `CODEOWNERS`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `INTERFACES.md`, `README.md`, `SECURITY.md`, `SETUP.md`, `TRACKER.md`, `TRACKER.done.md`, `atlas.yaml`, `catalog-info.yaml`, `component.yaml`, `components.yaml`, `cucumber.mjs`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`. Gone from the root: `copilot/` (split: content to the three repos, core to `home/`), `claude/` and `codex/` (to `adapters/` and built output), `templates/` (to `home/templates/`), `global-variables.md` (declared in `component.yaml`, rendered), `mapping.yaml` (to `installers/legacy/` until the legacy installer retires).
- **Rejected:** (B) — the name is one agent's folder and hides that the content is agent-neutral; (C) — `src/` suggests compiled code, and the core is Markdown read by agents.
- **Confidence:** medium (the folder `home/` is the blueprint's working name)
- **Supersedes:** none
- **Decided by:** architecture · **Approved at:** G3 (pending, 2026-11-13)

## DR-309: Shape of `docs/architecture.md` for a repo of documents and tools
- **Tree path:** n/a (MOD-8, CA "Acceptable simplifications"; `repo-architecture/v2`)
- **Criteria:** `repo-architecture/v2` §3 kinds are `service`, `library`, `script`, `datastore`, with no kind for agent-read documents; §3 and §4 paths must exist on disk, and the motherboard's `contracts/` and `installers/core/` do not exist until phase 0 and 2; MOD-8 says a simplification is stated in `docs/architecture.md`.
- **Options considered:** (A) §3 lists today's folders, each with a `target:` key naming the component it becomes; document folders use `kind: datastore`; §4's validated block lists tiers by target component with a representative path; the planned modules sit in a second, clearly marked block that P7 promotes | (B) describe only the target, with paths that do not exist yet | (C) leave §3 and §4 for P7
- **Chosen:** (A) — the file stays true of the tree today and still shows where each folder goes.
- **Rejected:** (B) — the validator fails it, and readers at P5 and P6 would look for folders that are not there; (C) — P0 needs §3 now to resolve profiles, and P5 needs the module map.
- **Confidence:** medium
- **Supersedes:** none
- **Decided by:** architecture · **Approved at:** G3 (pending, 2026-11-13)

---

## Context map (system-architecture, measured 2026-11-13 at `09d7082`)

```
agent-config / composition root ──(names providers only in components.yaml, the local list and the lock)──▶ every component
every component, core included ──[Conformist, pinned @major]──▶ agent-config / contracts
core              ──[Customer/Supplier: slot knowledge-storage; citations ∈ provides.exports]──▶ agent-knowledge
agentic-sdlc      ──[Customer/Supplier: slot knowledge-storage; citations ∈ provides.exports]──▶ agent-knowledge
agentic-sdlc      ──[Customer/Supplier: slot core; citations ∈ core's provides.exports]──▶ core
agentic-sdlc      ··[optional, no doc citations: slot company-knowledge-storage]··▶ agent-companies
agent-companies   ──[Customer/Supplier: slot knowledge-storage, contract company-kb/v1; citations ∈ exports]──▶ agent-knowledge
agent-companies   ──[Conformist: company-kb/v1 schemas and validator]──▶ agent-knowledge
```

| Edge | Status | Why |
|---|---|---|
| any component → contracts | allowed (pinned major) | Conformist (DDD-4) |
| core → agent-knowledge | allowed | Routes and cited exports |
| agentic-sdlc → agent-knowledge, agentic-sdlc → core | allowed | An optional, per-project component may depend on required ones |
| agentic-sdlc → agent-companies | allowed only as an optional slot dependency, no doc citations | Its 5 occurrences are patterns such as `companies/<co>/system/` |
| agent-companies → agent-knowledge | allowed | Company KB schemas and KB exports |
| agent-knowledge → any component | forbidden | Keeps the KB linked, not rendered, and the graph acyclic |
| core → agentic-sdlc, core → agent-companies | forbidden | A required component must not cite an optional one; G8 |
| agent-companies → agentic-sdlc | forbidden | Not needed |
| contracts → any component | forbidden | Unchanged from the blueprint |

Baselines for the fitness checks: knowledge mentions of `agentic-sdlc` 109 lines in 67 files (spec) or 123 lines in 73 files with the two frameworks (DR-404, Q8); core → agentic-sdlc 20 occurrences (18 in 4 procedure files, 2 in agent-foundry), to 0 at the end of phase 4; core → companies 1 (`init-repo-kb.procedure.md:61`), to 0 at the end of phase 3. Data ownership: one writer per data set (DS-9); `~/.claude/settings.json` is V's, and the installer owns only the entries `install-state.json` records.

---

## DR-401: Contract slots/v1 (new)
- **Tree path:** CC-Q1 (YES: no published version; the draft keys `count` and `mounts` were never released) → v1.0.
- **Criteria:** FR-003; AC-1.3, AC-1.4, AC-5.7, AC-5.8, AC-5.10; blueprint "Refinements for P3". Measured citation prefixes: `knowledge`, `frameworks/{knowledge, company-kb, agentic-sdlc, agent-foundry}`, `companies`, `procedures`, `patterns`, `atlas`, `global-variables.md`; AC-8.5 needs them to keep resolving, so they become the location mounts.
- **Options considered:** A: `required`, `multiple`, `locations` (each with `mount`, `required`, `shared`, `index`), plus a reserved `core` slot | B: A without a `core` slot (consumers name agent-config in `depends`) | C: no slots file; components declare their own sockets
- **Chosen:** A — the approved spec; the `core` slot makes core's exports citable by slot, so `depends` never names a repo; AC-1.4 still describes the three pluggable slots, and `core` is `reserved: true`.
- **Rejected:** B — `depends` would name a repo; C — a typo would create a new slot, and swapping a provider (G8) would stop being a list edit.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** system-architecture · **Approved at:** G3 (pending, 2026-11-13)
- **Contract facts:** owner agent-config; consumers installer, doctor, `build cite`, renderer; missing or stale: AC-5.8; rollout phase 0 schema and instance, phase 2 reader; a `contract` list means all of the listed contracts.

## DR-402: Contract component/v1 (new)
- **Tree path:** CC-Q1 (YES: new; nothing reads a component manifest today) → v1.0.
- **Criteria:** FR-004, FR-005, FR-017, FR-022 to FR-025, AC-1.2, AC-4.5, AC-5.9, AC-9.7, AC-12.7; spec A-4.
- **Options considered:** A: one `component.yaml` with typed `provides` and `depends` | B: separate files for exports, variables and hooks | C: `package.json` fields
- **Chosen:** A — one published file per repo, as the G0 Boundary row requires.
- **Rejected:** B — three files for one interface, and the layout check gets harder; C — FR-034 keeps package managers out of component installs, and slots do not fit package names.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** system-architecture · **Approved at:** G3 (pending, 2026-11-13)
- **Contract facts:** owner agent-config; consumers installer, build, atlas, doctor, renderer, `build cite`; unknown keys warn (CON-10); `repository` required when `provides.exports` is not empty; `depends.slots[].docs` generated, never hand-edited; core writes its manifest in phase 2, agent-companies in 3, agent-knowledge in 6, agentic-sdlc in 7 (in-repo stand-ins from phase 2). Security adds M-03 (name and path rules), M-08 (variables are public values) and M-18 (declarative `detect`).

## DR-403: Contract components-list/v1 and components-lock/v1 (new; they replace the installer's use of `mapping.yaml`)
- **Tree path:** CC-Q1 (YES: new; `mapping.yaml` stays readable by the old installers until phase 5, FR-035) → v1.0.
- **Criteria:** FR-014, FR-019, FR-020, FR-028; AC-3.1 to AC-3.8; the lock records `live` and a resolved path for `path` sources; DR-104.
- **Options considered:** A: one schema for both lists (the local list sets `local: true`), lock in the home | B: commit the lock to agent-config | C: one list with per-machine overrides inline
- **Chosen:** A.
- **Rejected:** B — lock entries hold local paths and the user name, and FR-014 puts the lock in the home; reproducibility across machines is not a requirement (A-1); C — private sources would end up in a public file.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** system-architecture · **Approved at:** G3 (pending, 2026-11-13)
- **Contract facts:** owner agent-config; consumers installer, doctor, `add`, `use`, `plan`; a component no list names is never fetched (AC-4.5); a slot's default provider is the `components.yaml` entry whose manifest names that slot. Security M-02 (stay on the lock) and M-07 (no credentials in a source URL) apply.

## DR-404: Contract knowledge-provider/v1 (new), and self-containment as a slot rule
- **Tree path:** CC-Q1 (YES: the KB keeps `{{AGENT_HOME}}/knowledge/` and its `index.md`; removing "Used by" relaxes a rule) → v1.0.
- **Criteria:** agent-companies also provides this contract; AC-1.4; G2's "the KB is linked, not rendered" needs the whole knowledge component to cite nothing outside itself; 42 `{{AGENT_HOME}}` lines in 11 framework files cite core, agentic-sdlc and companies today.
- **Options considered:** A: entry point, exports, relative internal links, own check and moved-doc stubs in the contract; self-containment as a rule of the `knowledge-storage` slot; `company-knowledge-storage` takes `[company-kb/v1, knowledge-provider/v1]` | B: self-containment as a contract rule | C: render agent-knowledge's framework locations, link only its content
- **Chosen:** A — every provider follows the same entry and link rules, and only the base layer must stand alone. Fallback if V reads AC-1.4 as one contract: `company-kb/v1` alone, including these rules by reference.
- **Rejected:** B — it would forbid agent-companies' 21 allowed citations of the KB; C — one component in two delivery classes, and a cycle at repo level.
- **Confidence:** medium (depends on Q8)
- **Supersedes:** none
- **Decided by:** system-architecture · **Approved at:** G3 (pending, 2026-11-13)
- **Contract facts:** providers agent-knowledge, agent-companies; consumers core, agentic-sdlc, agent-companies, installer, doctor; report mode in phases 2 to 5, blocking from phase 6.

## DR-405: Contract company-kb/v1 (owner repo moves), and the SDLC procedures go to agentic-sdlc
- **Tree path:** CC-Q1 (YES: the schemas keep their shape and their path `{{AGENT_HOME}}/frameworks/company-kb/`, 43 citations; only the owning repo changes) → v1.0.
- **Criteria:** the blueprint edge agent-companies → agent-knowledge; AC-10.6; phase 3 precedes phase 6, so agent-companies' CI gets the provider passed in as an argument (agent-config at a pinned SHA plus a stand-in manifest).
- **Options considered:** A: agent-knowledge owns it; agent-companies depends on `(knowledge-storage, company-kb/v1)` | B: agent-companies owns the schemas of its own instances | C: core owns it
- **Chosen:** A — the blueprint split test (CRP: company repos need only the schemas). Same root cause, same record: the core → agentic-sdlc cycle (18 occurrences in `bootstrap-agentic-sdlc`, `init-system-workspace`, `typescript-node/index`, `typescript-node/add-port-and-adapter`, plus 2 in agent-foundry) is cut by moving those 4 procedures into agentic-sdlc in phase 4 and turning agent-foundry's 2 mentions into plain words; `init-repo-kb.procedure.md:61` becomes plain words in phase 3; P5 confirms the list.
- **Rejected:** B — a second company repo would copy the schemas; C — the core would grow (G4), and core → company edges return.
- **Confidence:** medium
- **Supersedes:** none
- **Decided by:** system-architecture · **Approved at:** G3 (pending, 2026-11-13)

## DR-406: Contract rendered-copy/v1 (new)
- **Tree path:** CC-Q1 (YES: new; agents keep loading source files until phase 5, AC-8.6) → v1.0.
- **Criteria:** FR-045, FR-046; AC-16.1 to AC-16.10; A-20 to A-22, A-24, A-27; Q-REL-4, DS-2.
- **Options considered:** A: rendering follows from citations (any `depends.slots[].docs`, or a location-path citation in a loaded file); a rendered component's mounts point at `generated/<component>/`; the session-start re-render has a time limit | B: a `render: true` flag | C: render every component, the KB included
- **Chosen:** A — a flag could disagree with the content.
- **Rejected:** B — duplicated knowledge (DP-6); C — G2 chose to link the KB so edits show at once.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** system-architecture · **Approved at:** G3 (pending, 2026-11-13)
- **Contract facts:** first line exactly ``Generated from `<source path>`; edit that file, not this copy.``; mode read-only (0444; the Windows read-only attribute); the hook re-renders only changed components, keeps the previous copy and exits 0 on timeout or failure; default time limit 5 s; a placeholder path such as `companies/<co>/` is not a citation (A-24). Load paths: DR-307. Security M-04, M-06, M-12, M-13 apply.

## DR-407: Contract routes/v1 (new), with the provider moved before phase 3
- **Tree path:** CC-Q1 (YES: additive, a routes file appears beside the core; removing the company lines from the core is the one non-additive step, so the provider ships first) → v1.0, provider before consumer.
- **Criteria:** AC-10.1 and AC-10.3 (phase 3: company routes appear, core names no company); FR-039 (phase 5: routes per platform); `core.instructions.md:27` holds today's company routing.
- **Options considered:** A: a minimal routes renderer in phase 3 (Copilot `routes.instructions.md` with `applyTo: "**"`, one Claude import line, Codex `AGENTS.md` as core plus routes); phase 5 points routes at rendered copies | B: move phase 3 after phase 5 | C: keep the company line in the core until phase 5
- **Chosen:** A.
- **Rejected:** B — changes the G0 phase order the spec's priorities rely on; C — AC-10.1 would fail at the end of phase 3.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** system-architecture · **Approved at:** G3 (pending, 2026-11-13)
- **Contract facts:** Codex `AGENTS.md` stays under 32 KiB (AC-12.2); a blueprint change for G3 (Q8); M-01 consent covers routes from phase 3 (C-15).

## DR-408: Contract skill-source/v1 (new), with target wiring moved into phase 4
- **Tree path:** CC-Q1 (YES for the source format; NO for discovery if the sources land first: `mapping.yaml` links the whole `skills/` folder, and once `SKILL.md` gives way to `skill.yaml` plus `body.md` the agents find nothing) → provider (per-entry linking of built output) first, in the same phase.
- **Criteria:** FR-027, FR-038, FR-047; AC-11.1, AC-11.8, AC-12.4.
- **Options considered:** A: phase 4 also ships the two skill targets linked entry by entry to the built output; phase 5 relinks them to the rendered copies | B: keep hand-written `SKILL.md` beside the sources until phase 5 | C: commit the built output until phase 5
- **Chosen:** A.
- **Rejected:** B — two sources per skill, against constitution I (amended) for a whole phase; C — G2 forbids committed build output (FR-047).
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** system-architecture · **Approved at:** G3 (pending, 2026-11-13)
- **Contract facts:** providers agent-config and agentic-sdlc; layout `skills/<name>/skill.yaml`, `body.md`, `references/`; cascade common < adapter defaults < overlay; targets `claude` → `~/.claude/skills`, `agents` → `~/.agents/skills`.

## DR-409: Contract agent-source/v1 (new)
- **Tree path:** CC-Q1 (YES for the format; the discovery folders `~/.claude/agents`, `~/.codex/agents`, `~/.copilot/agents` need per-entry links in the same phase, as in DR-408) → v1.0.
- **Criteria:** blueprint row; AC-11.1, AC-11.3, AC-11.4; `copilot/agents/` holds 9 `sdlc-*`, 3 `foundry-*` and `windows-software`.
- **Options considered:** A: intent fields (`auto-delegate`, `needs-project-instructions`, `preload`, `tools.intent`, `model-tier`) mapped per adapter | B: per-platform front matter written in the source
- **Chosen:** A (G9).
- **Rejected:** B — three hand-written copies again.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** system-architecture · **Approved at:** G3 (pending, 2026-11-13)
- **Contract facts:** providers agentic-sdlc and agent-config (agent-foundry agents exist today, not "later"); Codex cannot restrict tools, so the build warns.

## DR-410: Contract adapter-fields/v1 (new)
- **Tree path:** CC-Q1 (YES: new) → v1.0; the adapter major is separate from the contract major and is stamped into the output.
- **Criteria:** blueprint row; AC-11.1, AC-11.2, AC-11.7 (G3: a new platform is one adapter folder).
- **Options considered:** A: one `fields.yaml` per adapter listing fields, targets and hook events, each field with `source`, `verified`, `enforced` | B: field knowledge written into the build code
- **Chosen:** A.
- **Rejected:** B — adding a platform would edit the build code, so G3 fails.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** system-architecture · **Approved at:** G3 (pending, 2026-11-13)
- **Contract facts:** a field's `source` is an official doc URL, never a KB path, so adapters keep no edge into agent-knowledge; each adapter maps the neutral hook event names (DR-413).

## DR-411: Contract build/v1, the shared tool, with citation checking in it
- **Tree path:** CC-Q1 (YES: new tool; FR-036's change to `validate.mjs` is internal and lands in phase 1) → v1.0.
- **Criteria:** FR-038, FR-044, FR-047; AC-9.5 to AC-9.7, AC-11.6, AC-11.9; G12 (a provider's `component.yaml` is a published interface, not a private file).
- **Options considered:** A: one tool with subcommands `build`, `budget`, `cite [--write]`, `layout`, run by each repo's `check.sh` pinned to a `contracts/v…` SHA | B: each consumer writes its own citation code | C: citation checking only in the installer
- **Chosen:** A.
- **Rejected:** B — the same rule in three repos would drift (DP-6); C — errors would show on V's machine instead of in CI (AC-9.6 needs a repo check).
- **Confidence:** medium (target branch `main` versus a SHA is a readability trade-off)
- **Supersedes:** none
- **Decided by:** system-architecture · **Approved at:** G3 (pending, 2026-11-13)
- **Contract facts:** usage KDL plus a JSON report schema (CON-15, CON-16); exit codes 0, 1, 2; `cite --provider <component.yaml path or URL>` (repeatable) plus the slots file; classifies by the longest mount, fails on a path under no location, writes `depends.slots[].docs` and the GitHub target `<repository>/blob/<default branch>/<folder>/<path>`, fails on stale ones; after phase 6 every consumer runs `cite --write` once. Architecture adds `budget --baseline` (DR-304).

## DR-412: Contract repo-layout/v1 (new)
- **Tree path:** CC-Q1 (YES: new; report-only in agent-config until phase 8, FR-012) → v1.0.
- **Criteria:** blueprint row; CON-15.
- **Options considered:** A: blocking in each new repo from its first commit, report mode in agent-config until phase 8 | B: blocking everywhere from phase 0
- **Chosen:** A.
- **Rejected:** B — agent-config cannot meet it before phase 8 moves the content.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** system-architecture · **Approved at:** G3 (pending, 2026-11-13)
- **Contract facts:** consumers the CI of all four repos; each repo's `INTERFACES.md` lists its `component.yaml` as a provided file interface linking to the `component/v1` schema.

## DR-413: Contract hooks/v1 (new; replaces hand-placed hook files)
- **Tree path:** CC-Q1 (NO for what is deployed today: `claude/settings.json` is `seed-once`, so V's copy keeps `$HOME/.copilot/…` commands a re-seed never updates) → CC-Q2 (both live: compatibility links keep old command paths resolving; the phase-5 merge replaces installer-owned entries) → CC-Q3 (keep the links until every machine had the phase-5 merge and `doctor` finds no hook command under an old path; DR-417).
- **Criteria:** blueprint fact "adapters → deployed hooks"; AC-12.3; DR-204; `copilot/hooks/workflow-graph.json` belongs to agentic-sdlc.
- **Options considered:** A: hook entries declared in `component.yaml` with neutral event names, merged per agent, each merged entry recorded in `install-state.json` by hash | B: a marker key inside each entry
- **Chosen:** A — whether Claude Code accepts unknown keys inside hook entries is unconfirmed, so the record lives outside the file.
- **Rejected:** B — an unknown key could invalidate `settings.json`.
- **Confidence:** medium
- **Supersedes:** none
- **Decided by:** system-architecture · **Approved at:** G3 (pending, 2026-11-13)
- **Contract facts:** event mapping in `adapters/<name>/fields.yaml`; Codex session start unconfirmed (A-18). Security M-01, M-09, M-14, M-15 apply.

## DR-414: Contract variables/v1 (new; `global-variables.md` becomes rendered)
- **Tree path:** CC-Q1 (YES for readers: agents still read a variables table at `{{AGENT_HOME}}/global-variables.md`, linked to `generated/global-variables.md`; the values in the `seed-once` copy must migrate) → v1.0 plus a one-time import.
- **Criteria:** FR-025; AC-6.1 to AC-6.6, AC-8.1; `mapping.yaml` (`seed-once`); A-D1.
- **Options considered:** A: the first phase-2 install reads the old file's values and offers them in the needs report; V confirms with `set`; the old file is backed up | B: import silently | C: ask V to type each value again
- **Chosen:** A — follows A-10: a detected value is a proposal.
- **Rejected:** B — against A-10; C — needless work, and values get lost.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** system-architecture · **Approved at:** G3 (pending, 2026-11-13)
- **Contract facts:** declarations agent-config (`AGENT_HOME` computed by the installer, `AGENT_CONFIG_REPO`, `LANGUAGE`), agentic-sdlc (`REFERENCE_REPOS_ROOT`), agent-companies (`OTS_REPOS_ROOT`); a name declared twice with different descriptions fails install. Security M-08 (no secret-like names or values) applies.

## DR-415: Contract framework/v1 (missing from the spec's 14)
- **Tree path:** CC-Q1 (YES: new) → v1.0.
- **Criteria:** AC-1.4 names `framework/v1` as the `framework` slot's contract; AC-14.2, AC-14.3; FR-001 and AC-1.1 count fourteen contracts and leave it out.
- **Options considered:** A: a small contract: `index.md` at the root of the `framework` location; `provides.skills` and `provides.agents` exposed only where enabled; `enable` and `disable`; validators take inputs as arguments (AC-14.4) | B: no contract, `component/v1` alone
- **Chosen:** A, pending Q8.
- **Rejected:** B — per-project enablement (A-13) would have no defined interface, and AC-14.3 could not be checked against anything.
- **Confidence:** medium
- **Supersedes:** none
- **Decided by:** system-architecture · **Approved at:** G3 (pending, 2026-11-13)

## DR-416: Location mounts for shared folders and multi-provider slots
- **Tree path:** n/a (follows from DR-401)
- **Criteria:** FR-027; AC-10.3 (`{{AGENT_HOME}}/companies/index.md` must resolve, and no such file exists today); 98 citations of `companies/ots/…` must keep resolving; `frameworks/` gets entries from core, agent-knowledge and agentic-sdlc.
- **Options considered:** A: a `shared: true` location is linked entry by entry, two components supplying the same entry fail install naming both, and the root `index.md` of a `multiple: true` slot is generated | B: one subfolder per provider (`companies/<component>/ots/…`)
- **Chosen:** A.
- **Rejected:** B — every `companies/ots/…` citation would change, against AC-8.5.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** system-architecture · **Approved at:** G3 (pending, 2026-11-13)

## DR-417: The agent-home path, an existing interface that changes incompatibly
- **Tree path:** CC-Q1 (NO: the same names start to mean another folder) → CC-Q2 (both live: `~/.agent-config` is the new home and old `~/.copilot/…` agent-home paths resolve through compatibility links; the phase-2 installer ships first; consumers migrate after: 484 hard-coded lines in 131 files, memories, open sessions, hook commands) → CC-Q3 (keep the links until all hold: the next tagged agent-config release, 0 hard-coded agent-home lines in the four repos, the DR-204 search finds nothing, V signs off).
- **Criteria:** blueprint "Agent home" and "Transition"; FR-013, FR-031, FR-032; AC-8.1 to AC-8.6; V decided the move on 2026-11-13, so it is recorded, not escalated.
- **Options considered:** A: expand-then-contract over one release | B: switch in one step | C: keep both paths forever
- **Chosen:** A — matches DR-204.
- **Rejected:** B — open sessions and hooks would break mid-move; C — two paths per fact, against constitution I.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** system-architecture · **Approved at:** G3 (pending, 2026-11-13)

## DR-418: Contract version rollout and consistency across components
- **Tree path:** CC-Q2 rule, applied to every future major of any contract above.
- **Criteria:** FR-006, FR-026; AC-3.4, AC-3.5, AC-7.2, AC-10.4; DS-1, Q-REL-4.
- **Options considered:** A: per-component fallback with a cross-check to a fixed point | B: all or nothing for the whole install | C: switch each component alone with no cross-check
- **Chosen:** A — (1) resolve the candidate set; (2) a component that fails acquire or validation goes back to its locked previous version, or is left out if it has none; (3) re-run the cross-checks (majors, exports, slot counts, budget) until nothing changes; (4) switch every passing component in one apply and report. A major bump: reader accepts N and N-1 and `contracts/v…` is tagged; one pull request per repo, providers first, moves `contracts.pin`; N-1 is dropped later when `doctor` on both machines shows no enabled component pinning it.
- **Rejected:** B — against AC-3.5 and AC-10.4; C — leaves sets that break cross-checks, against AC-5.6.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** system-architecture · **Approved at:** G3 (pending, 2026-11-13)

---

## DR-501: Test depth
- **Tree path:** TD-Q1 (YES: constitution principle IV fixes a bar) → TD-Q2 (YES: the installer replaces and deletes user files, merges `~/.claude/settings.json`, clones with V's credentials; risk tier HIGH by DR-001) → TD-Q3 (YES: git, the file system, hooks and four repos meeting through contracts) → unit + scenario + contract tests on every phase, negative cases mandatory.
- **Criteria:** constitution IV (a Given/When/Then scenario with an automated test per rule id, characterization tests before changing an untested tool); TST-5, TST-7, TST-10, TST-12 to TST-14; spec 008 finding F-1 (PowerShell needs a Windows runner); the spec states file outcomes, not model behaviour.
- **Options considered:** unit tests only for the installer | unit + scenario (the CLI as a process on a throwaway home, Gherkin) + contract (shipped schemas and worked examples run by provider and consumer), on real Mac, Linux and Windows runners, with no network, real clock, real home or real agent | end-to-end tests with real Claude Code, Copilot CLI and Codex on every change | network tests against the real GitHub repos | Windows covered by bash with a fake `uname` | pinning today's byte counts as expected values
- **Chosen:** unit + scenario + contract, on three real operating systems, deterministic — with the bar QB-1 to QB-9 (`plan.md`, "Quality bar"), the testability needs TR-1 to TR-8 (met by DR-305 and DR-306), and a one-off P4 agent-behaviour protocol on Codex CLI and Copilot CLI with cheap models for A-14 and A-18 to A-26.
- **Rejected:** unit tests only — misses link creation, backups, exit codes, output text and Windows differences; end-to-end with real agents per change — costs V's subscription limits and is not deterministic; network tests — flaky (replaced by local bare repos); fake-`uname` Windows — proves routing, not links or paths; pinned byte counts — the core text changes in phase 1, so the test pins the method and "measured ≤ recorded baseline" instead.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** qa · **Approved at:** G3 (pending, 2026-11-13)

---

## Overrides and additions after G3 (run R-001, G4 approved 2026-11-13)

V approved G4 on 2026-11-13 with every default. The records below do not edit the G3 records above: each one names what it supersedes. DR-601 to DR-605 carry the N-1 Node override ("latest Node 24 from 24.12 only; TypeScript run directly by Node type stripping"). Word used once here: **type stripping** = Node deletes the type annotations of a `.ts` file when it loads it and runs what is left, without compiling or checking types (Node.js 24 docs, "Modules: TypeScript"). Example: `const n: number = 1` runs as `const n = 1`.

Measured 2026-11-13 on Node.js v24.22.1 (macOS): a class with `constructor(private readonly x: number)` fails with `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` ("TypeScript parameter property is not supported in strip-only mode"); the same class with an explicit field declaration and `this.x = x` in the constructor runs; `import { f } from "#lib/a.ts"` resolves through `package.json` `"imports": { "#lib/*.ts": "./lib/*.ts" }`, while a key without `.ts` makes the specifier lose its extension. Node.js 24 docs, "Modules: TypeScript": type stripping is stable from v24.12.0; `enum`, namespaces with runtime code, parameter properties and import aliases need `--experimental-transform-types`; `tsconfig.json` (so `paths`) is ignored; `.ts` files under `node_modules` are refused; `import type` is required for type-only imports.

## DR-601: Language and runtime for the runtime code (N-1 override of DR-101)
- **Tree path:** TS-Q0 (constitution and company KB name no stack → NO) → TS-Q1 (blueprint states a Node core → YES, keep it) → TS-Q2 and TS-Q4 unchanged from DR-101 → profile `typescript-node`; V overrode the version floor and the language form (G4, N-1).
- **Criteria:** V's override N-1: latest Node.js 24 from 24.12 only. Type stripping is stable from v24.12.0 (Node.js 24 docs), so the Node 18 reason for plain JavaScript in DR-101 no longer exists; no build step and nothing generated committed (A-6) still hold; the stack profile is already `typescript-node`.
- **Options considered:** (A) TypeScript run directly by Node type stripping, erasable syntax only | (B) plain ESM `.mjs` with JSDoc types (DR-101's choice) | (C) TypeScript compiled to JavaScript, output committed | (D) a loader package such as `tsx` | (E) `--experimental-transform-types`
- **Chosen:** (A) — `.ts` files run with `node installers/core/main.ts`; erasable syntax only (no `enum`, no namespace with runtime code, no constructor parameter properties, no import aliases, `import type` for types); every relative or alias import keeps its `.ts` extension; `engines.node` is `>=24.12 <25`; `tsc --noEmit` type-checks and `erasableSyntaxOnly` makes a non-erasable construct a type error before Node meets it; no build step.
- **Rejected:** (B) — V chose TypeScript, and the only reason for JSDoc types was Node 18; (C) — a committed compiled copy breaks A-6 and creates drift; (D) — a run-time dependency, against FR-034; (E) — an experimental flag every shim and test would have to pass, and it enables source maps by default.
- **Confidence:** high (the stripping rules are in the Node.js 24 docs and the parameter-property failure was measured above)
- **Supersedes:** DR-101
- **Decided by:** human · **Approved at:** G4 (2026-11-13)

## DR-602: Entry points `install.sh` and `install.ps1` (N-1 override of DR-107)
- **Tree path:** TS-Q2 (`installers/` already has both) → thin shims, as in DR-107; only the runtime they look for changes.
- **Criteria:** FR-033, FR-035, exit codes 0, 10, 1 and 2 pass through; N-1 (no Node 18).
- **Options considered:** (A) each shim finds `node` (the `NODE` override first, then `PATH`), reads its version, and when it is not 24.12 or later within 24, prints one need and exits 10 with nothing changed (devops P-7); otherwise runs `node installers/core/main.ts "$@"` and returns its exit code | (B) shims that hold install logic | (C) shims that pass `--experimental-strip-types`
- **Chosen:** (A) — no flag is needed because type stripping is on by default from Node 24.12; the PowerShell target stays Windows PowerShell 5.1.
- **Rejected:** (B) — two copies of the logic, the drift the spec exists to avoid; (C) — the flag is not needed on the supported runtime, and passing it hides a runtime that is too old.
- **Confidence:** high
- **Supersedes:** DR-107
- **Decided by:** human · **Approved at:** G4 (2026-11-13)

## DR-603: Toolchain for agent-config (N-1 override of DR-108)
- **Tree path:** TC-Q1 (partial: Cucumber, pnpm, the Node 24 pin and `check-docs.sh` exist) → inherit the configured slots → TC-Q2 (constitution size and complexity limits) → TC-Q3 for empty slots; the Node 18 floor no longer overrides the stack defaults.
- **Criteria:** N-1; the stack default `cmd.test_unit` is vitest and vitest 5.0.5 is already locked in this repo; C-14 (the stack's `lint-baseline` is enforced by `validate-project.mjs`); IMP-4 and TSN-15 (an alias resolves the same way for type-check, run and test); Node.js 24 docs (`tsconfig.json` is ignored at run time).

| Slot | Value |
|---|---|
| `package_manager` | pnpm, pinned by `packageManager`; unchanged |
| language version | Node.js 24 from 24.12 only (`engines.node` `>=24.12 <25`; `.nvmrc` stays `24`); no Node 18 API limit |
| `cmd.format` | `pnpm exec prettier --check .` (3.9.10); `vendor/` ignored; unchanged |
| `cmd.lint` | `pnpm exec eslint . --max-warnings 0` (eslint 10.14.0 with typescript-eslint 8.72.1, as locked): one lint baseline for all new code, that is the stack's `lint-baseline` rule names plus `complexity` 10 and `max-lines-per-function` 50 (constitution); `eslint-plugin-n` is not added (its only job was the Node 18 API floor) |
| `cmd.typecheck` | `pnpm exec tsc --noEmit -p <package>/tsconfig.json` (typescript 6.0.3); `strict`, `module` and `moduleResolution` `nodenext`, `target` `esnext`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `allowImportingTsExtensions`; `@types/node` 24.19.2 as locked |
| `cmd.test_unit` | `pnpm exec vitest run` (vitest 5.0.5 as locked), replacing `node --test` |
| alias mechanism | `package.json` `imports` with `#` keys that end in `.ts` (so a specifier keeps its extension), one key per module as in `docs/architecture.md` §4 (IMP-7); no `tsconfig` `paths` and no build rewrite because nothing is built (TSN-15 option "Node type stripping") |
| acceptance scenarios | Cucumber `~13.3.0`, one scenario per acceptance criterion, driving the CLI through the shims in a temporary home; unchanged |
| `cmd.test_integration`, `cmd.build` | n/a: scenarios are the integration level; runs from source |
| `cmd.audit` | `pnpm audit --audit-level high` in CI; unchanged |
| check command | `scripts/check-docs.sh` stays the one entry |

- **Options considered:** vitest | `node:test` (DR-108's choice) | Jest for unit tests; one lint baseline for new code | a lighter baseline for the installer; `package.json` `imports` | `tsconfig` `paths` with a rewrite step for aliases
- **Chosen:** the table — new exact dev dependencies are only `prettier`, `eslint`, `typescript`, `@types/node`, `vitest`, `typescript-eslint`, `yaml` and `ajv` at the versions above and in DR-102 and DR-103; `eslint-plugin-n` drops out.
- **Rejected:** `node:test` — vitest is the stack default and the floor that blocked it is gone; Jest — a second tool for a filled slot (STK-R2); a lighter lint baseline — C-14 shows `validate-project.mjs` fails a `typescript-node` folder without the baseline names; `paths` plus rewrite — it needs the build step this override removes, and the type checker alone would accept an alias Node cannot resolve (IMP-4).
- **Confidence:** medium (unconfirmed until phase 0: that vitest and the ESLint import resolver both read `package.json` `imports` keys that end in `.ts`; the smoke check of TSN-15 proves it)
- **Supersedes:** DR-108
- **Decided by:** human · **Approved at:** G4 (2026-11-13)

## DR-604: Check command for each repo (N-1 override of DR-109)
- **Tree path:** TC-Q1 per repo → inherit; only the agent-config row of DR-109 changes.
- **Criteria:** N-1; DR-603 replaces the DR-108 table that the agent-config row cites.
- **Options considered:** (A) the agent-config row runs the DR-603 table, the layout validator (report mode), atlas, tracker, contract fixtures and the parity test; the other three rows of DR-109 stay | (B) keep the DR-109 wording "Node 18 runtime code"
- **Chosen:** (A) — `scripts/check.sh` per repo, as in DR-109; agent-config's line points at DR-603; `agent-knowledge`, `agentic-sdlc` and `agent-companies` rows are unchanged.
- **Rejected:** (B) — it states a Node 18 limit that no longer exists.
- **Confidence:** high
- **Supersedes:** DR-109
- **Decided by:** human · **Approved at:** G4 (2026-11-13)

## DR-605: Continuous integration without a Node 18 job (N-1 override of the Node 18 job of DR-206)
- **Tree path:** DT-Q2 (inherit) → the rest of DR-206 stands; only the Node 18 job is removed.
- **Criteria:** N-1; conflict C-8 (Ubuntu only or Ubuntu and Windows) is about a job that no longer exists.
- **Options considered:** (A) `installer.yml` runs one matrix: Ubuntu, macOS and Windows with a throwaway home, Node from `.nvmrc` (latest 24) | (B) the same matrix plus a job pinned to Node 24.12.0 | (C) keep the Node 18 job
- **Chosen:** (A) — required checks `installer (macos)` and `installer (windows)` stay; everything else in DR-206 is unchanged.
- **Rejected:** (B) — V chose latest Node 24 only, and the shim check (DR-602) already refuses a version below 24.12; (C) — type stripping does not exist on Node 18.
- **Confidence:** high
- **Supersedes:** none
- **Narrows:** devops DR-206 in `decisions/devops.md`: only its Node 18 job is dropped; the rest of DR-206 stays in force.
- **Decided by:** human · **Approved at:** G4 (2026-11-13)

## DR-606: YAML parser limits for `yaml` 2.9.1 (clears unlisted need U-1; backs M-17; settles C-6)
- **Tree path:** TS-Q1 (the YAML files are fixed interfaces; DR-102 chose the library) → STK-R2 (no second parser) → the limits go in the one wrapper (DR-102, DR-304); option names read from the installed package and measured.
- **Criteria:** M-17 and T-17 (custom tags, alias expansion, very large files); C-6; `yaml` 2.9.1 `dist/options.d.ts` and `dist/compose/compose-node.js` read in the working copy; probes run on Node.js v24.22.1 on 2026-11-13 (findings in `copilot/knowledge/js-runtime/yaml-comment-round-trip.md`). Interface files use no anchors or aliases (no match in the contracts folder or the data model).
- **Options considered:** (A) the wrapper (1) refuses text over 262 144 bytes (256 KiB, UTF-8) before parsing, (2) calls `parseDocument(text, { resolveKnownTags: false, logLevel: 'error' })` with the defaults `schema: 'core'`, `merge: false`, `uniqueKeys: true` kept and no `customTags`, (3) fails the file on any entry of `doc.errors` or `doc.warnings`, (4) reads values with `doc.toJS({ maxAliasCount: 0 })`, also before any edit through the document API | (B) library defaults only | (C) `schema: 'failsafe'` | (D) scan the text for `!`, `&` and `*`
- **Chosen:** (A) — each option name is real in 2.9.1: `resolveKnownTags` and `logLevel` are parse options; `maxAliasCount` is a `toJS` option, listed under `ToJSOptions` and not among the parse options; the library has no size option, so the cap is the wrapper's own check; the library has no depth option, but a stack overflow is caught and reported as error `RESOURCE_EXHAUSTION`, which rule (3) turns into a failed file. Measured effects: an unknown tag, or `!!binary` and `!!set` once `resolveKnownTags` is `false`, gives warning `TAG_RESOLVE_FAILED` and is read as an ordinary value, which is why warnings fail the file; with the default `true`, `!!binary` silently becomes a `Buffer`; `maxAliasCount: 0` makes any alias throw ("Alias resolution is disabled"), and the default 100 stopped a nested-alias bomb with "Excessive alias count"; a duplicate key is error `DUPLICATE_KEY` and a second document is error `MULTIPLE_DOCS` by default (and with `logLevel: 'error'`, but with `logLevel: 'silent'` the library skips the check and drops the second document without any error, measured 2026-11-13, so the wrapper uses `'error'`); `<<` is a plain key because `merge` defaults to `false` for YAML 1.2.
- **Rejected:** (B) — defaults accept `!!binary` and `!!set` silently, treat an unknown tag as a warning only and set no size cap; (C) — measured: `schema: 'failsafe'` still turned `!!binary` into a `Buffer` in 2.9.1, so it does not stop known tags; (D) — a text scan is not a parser: `!` and `&` also occur inside quoted text.
- **Confidence:** high (names read from the package and each effect measured; the 256 KiB figure is M-17's own number)
- **Supersedes:** none
- **Decided by:** engineering · **Approved at:** G4 (2026-11-13)

## DR-607: The path swap applies everywhere, code blocks included (narrows DR-106)
- **Tree path:** conflict between DR-106 ("a line scanner that skips fenced code") and AC-16.3 / RC-5 (0 `{{AGENT_HOME}}` path placeholders in a rendered file) → human decision.
- **Criteria:** AC-16.3 and RC-5 (no placeholder left for an agent to resolve); T057 review (QA, 2026-11-14); FR-045 says a rendered file differs from its source only at citations and the added line, which this choice widens to every path placeholder.
- **Options considered:** (A) swap `{{AGENT_HOME}}/<path>` and `~/.copilot/<path>` in link text, prose, code spans and code blocks alike; link targets are left for the renderer to set relative (A-20) | (B) skip fenced code, as DR-106 wrote
- **Chosen:** (A) — `contracts/lib/render-rules.ts` `swapLine`, pinned by the unit test "a path in a code block is swapped too (RC-5)".
- **Rejected:** (B) — a command in a code block would keep a placeholder the agent must resolve itself, against AC-16.3.
- **Confidence:** high
- **Supersedes:** none
- **Narrows:** tech-stack DR-106: only its "skips fenced code" clause is replaced; the rest of DR-106 stands. FR-045's wording needs aligning with this (tracked).
- **Decided by:** human · **Approved at:** P6 (2026-11-14)

## DR-608: Duplicate keys are found in one pass, not by the library (narrows DR-606)
- **Tree path:** security review of T054/T055 (M-17, T-17) → the wrapper keeps the library out of the duplicate-key check.
- **Criteria:** M-17 and T-17 (denial of service under the 256 KiB cap); measured 2026-11-14 on Node.js v24.22.1 with `yaml` 2.9.1: with `uniqueKeys: true` a flat mapping of 20 000 keys took 1.08 s and 38 000 keys 4.16 s (0.11 s and 0.18 s with `false`), and the security role measured 27 s for a flow mapping under the cap (`copilot/knowledge/js-runtime/yaml-comment-round-trip.md`); the library also lets `1` and `"1"` both stand.
- **Options considered:** (A) `uniqueKeys: false`, then one `visit` over every map with a set of each key's text form, giving `DUPLICATE_KEY` with its line and `NON_STRING_KEY` for a collection key | (B) keep `uniqueKeys: true` and cap the key count | (C) keep DR-606 as written
- **Chosen:** (A) — `contracts/lib/yaml.ts` `keyFindings`, with unit tests for each key form and a full-size flow map.
- **Rejected:** (B) — the cost still grows with the square of the keys below any cap; (C) — a hostile file stalls install, `doctor` and every provider's CI.
- **Confidence:** high
- **Supersedes:** none
- **Narrows:** engineering DR-606: only its `uniqueKeys: true` default is replaced; the other limits of DR-606 stand.
- **Decided by:** security, engineering · **Approved at:** P6 (2026-11-14)

## PDM-installers-core: Paradigm for the installer core (`installers/core`, clears unlisted need U-2)
- **Tree path:** PDM-Q1 (greenfield: `installers/core` does not exist yet → NO) → PDM-Q2 (does it own invariants enforced across operations? The cross-checks, such as majors, exports, "plan equals what apply does" and the approved privileged set, are rules over plain data; durable state lives in `components.lock` and `install-state.json`, not in objects with identity and lifecycle → NO) → PDM-Q3 (an input to output transform: files in, a plan as data (DR-306), effects at the edge, a report out → YES) → functional-pipeline. PDM-Q4 not reached; the constitution default is `none`.
- **Criteria:** DR-303 (a pure core with effects at the edges, modules with `domain`, `application`, `infrastructure`, `interface`); DR-305 and DR-306 (ports, one report model, the plan is data); spec pipeline read → resolve → plan → apply → report (FR-016); Node type stripping rejects constructor parameter properties (measured on v24.22.1 and stated in the Node.js 24 docs), so a class-modeled choice would need explicit field declarations and constructor assignments; no layer override.
- **Options considered:** functional-pipeline | class-modeled | ASK at G0
- **Chosen:** functional-pipeline (`functional-pipeline@1`) for every module of `installers/core` — immutable data types, pure transformation functions composed into the pipeline, effects only in `infrastructure` and `interface` and wired at the composition root.
- **Rejected:** class-modeled — no entity has a lifecycle or identity that must stay valid across operations, and under type stripping it would need explicit field declarations in every class; ASK at G0 — V answered at G4 with the proposed default.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** human · **Approved at:** G4 (2026-11-13)

## PDM-contracts-lib: Paradigm for the shared pure rules (`contracts/lib`)
- **Tree path:** PDM-Q1 (greenfield → NO) → PDM-Q2 (NO: the manifest and list readers, the slot and location classifier, the citation classifier, the render rules, the character counter and the `yaml` wrapper hold no state across calls) → PDM-Q3 (YES: text in, value or finding out) → functional-pipeline.
- **Criteria:** DR-304 (`contracts/lib/` holds the pure modules every repo's CI shares at a pinned tag); TR-6 (one rules module shared by dry run, `cite --write` and renderer); the Node type stripping rule above (explicit field declarations if a class were ever chosen).
- **Options considered:** functional-pipeline | class-modeled | ASK at G0
- **Chosen:** functional-pipeline (`functional-pipeline@1`) — pure functions over immutable data, no module state, no effects; the `yaml` wrapper is the one place that touches the library.
- **Rejected:** class-modeled — there are no invariants held across operations and nothing has identity; ASK at G0 — answered at G4.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** human · **Approved at:** G4 (2026-11-13)

## QB-7 mutation proof (T087)

Each new phase 0 check was disabled, or the rule it enforces broken, in a temporary copy of the work tree outside the repository (a fresh `git init` of the copy, all `node_modules` copied). The unmutated copy gave `scripts/check-docs.sh` exit 0. After each change the named scenario or test was run, then the whole `scripts/check-docs.sh`; the copy was reset between runs. Node 24.22.1 on macOS, 2026-11-14. "Exit 1" is `check-docs.sh`; a check in report mode (layout) is meant to keep exit 0 on a finding, so its proof is that the scenarios fail and the finding appears.

| Check | How disabled | What failed | check-docs | Date |
|---|---|---|---|---|
| Schema check (rule) | `shape.ts`: the moved-key rule (`count`, `mounts`) returns no finding | Scenarios "AC-1.3 A slots file that still uses count fails, naming the key and its replacement" and "...uses mounts..." (`tests/contracts/schemas.feature`); 3 unit tests of `reader.test.ts` | exit 1 | 2026-11-14 |
| Schema check (shipped files) | `contracts/slots.yaml`: `scope: global` changed to `scope: bogus` | `check-schemas.ts` prints `contracts/slots.yaml: error: slots[0].scope: must be one of: global, per-project`, exit 1 | exit 1 | 2026-11-14 |
| Fitness | `check-fitness.ts`: the rise comparison `current > recorded` made `false` | 5 scenarios "AC-1.6 One more mention/file/check ... is a rise and fails" (`tests/fitness/fitness.feature`); 2 unit tests of `check-fitness.test.ts` | exit 1 | 2026-11-14 |
| Fitness (real tree) | `docs/baselines/fitness.json`: `core-to-agentic-sdlc-lines` 20 lowered to 19 | `FIT-2 core-to-agentic-sdlc-lines rose from 19 to 20`, exit 1 | exit 1 | 2026-11-14 |
| Coverage | `check-ac-coverage.ts`: the uncovered ids are dropped from the findings | "QB-1 An acceptance criterion with no scenario fails and is named with its phase", "QB-1 A scenario for AC-1.1 does not cover AC-1.10", "QB-2 Removing an id from the exemption list makes it a failure" and 2 more; 3 unit tests of `check-ac-coverage.test.ts` | exit 1 | 2026-11-14 |
| Coverage (real spec) | every `Scenario: AC-1.9` renamed `AC-1.99` | `QB-1 AC-1.9 has no scenario (phase 0)`, exit 1 | exit 1 | 2026-11-14 |
| Layout (report mode) | `layout.ts`: the missing-entry filter returns nothing | 6 scenarios of `tests/repo-layout/layout.feature`, among them "FR-012 A missing required file is reported and is not fatal in report mode" and "FR-012 Every violation is listed, not only the first"; 4 unit tests of `layout.test.ts` | exit 1 (from the scenarios) | 2026-11-14 |
| Layout (finding appears) | `rules.yaml`: a required entry `NOPE.md` added | `layout --report` prints `finding: missing required entry NOPE.md` and `repo-layout: 5 findings (report mode)`; exit 0 as designed | exit 0 for this step | 2026-11-14 |
| Budget baseline | `budget.ts`: characters counted on the source text, without the swap and the generated-from line | "AC-1.7 The size is measured on the rendered text, so it is larger than the 149 characters written" (`tests/baseline/baseline.feature`); 1 unit test of `budget.test.ts` | exit 1 | 2026-11-14 |
| Golden plan | `mapping.yaml`: target `~/.claude/CLAUDE.md` changed to `~/.claude/CHANGED.md` | "AC-1.9 The Mac plan equals the golden file darwin.txt" and "AC-1.9 A copy with an unchanged mapping still equals the golden file" (`tests/installers/golden.feature`) | exit 1 | 2026-11-14 |
| Pending guard | `tasks.md`: T038 and T083 ticked, so every task a `@pending` scenario names is done | "QB-1 Every acceptance criterion of phase 0 in the real spec ..." fails with "@pending, but T083, T038, T045, ... are done in tasks.md: remove the tag"; with the guard line disabled the same ticks pass (control) | exit 1 | 2026-11-14 |
| Parity test | `component/v1/schema.json`: the id pattern of `$defs/id` replaced by `.*` | `parity.test.ts` component/v1 `invalid/bad-name.yaml`, `bad-route-id.yaml`, `name-65-characters.yaml` | exit 1 | 2026-11-14 |
| Format | `value-problems.ts`: extra spaces in one declaration | `prettier --check` names the file, exit 1 | exit 1 | 2026-11-14 |
| Lint | `render-rules.ts`: a `debugger;` statement added | `eslint --max-warnings 0`: `no-debugger`, exit 1 | exit 1 | 2026-11-14 |
| Typecheck | `render-rules.ts`: `const x: number = "x"` added | `tsc --noEmit`: `TS2322 Type 'string' is not assignable to type 'number'`, exit 2 (prettier also objected to the quote style in this line) | exit 1 | 2026-11-14 |

Gaps this exercise found, not fixed here:
- Removing the "is required" rule from the shape checker is caught by 13 unit tests of `reader.test.ts` and by no scenario: `tests/contracts/schemas.feature` has none for a missing required field. The unit tests satisfy QB-7, but a scenario would be the named proof.
- A pending scenario also inherits the task tags of its feature (here `@T083` on `coverage.feature`), so the guard fires only when those are ticked too.

## References

**Local artifacts:**
- `specs/022-repo-split/decisions/{security,tech-stack,qa,devops,system-architecture}.md`: the role records merged here, with their evidence.
- `specs/022-repo-split/spec.md`, `blueprint.md`: the approved inputs (G2, G0).
- `copilot/frameworks/agentic-sdlc/schemas/decision-record.schema.md`: record shape.
- `copilot/frameworks/agentic-sdlc/conventions.md` §1 and §7: ownership and precedence.
- `copilot/frameworks/agentic-sdlc/trees/architecture-pattern-selection.tree.md`: AP-Q1, AP-Q2.

**External authoritative sources:**
- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks): exit 2 blocks; other non-zero codes do not (T-13).
- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use): pin full commit SHAs.
- [Mark Seemann, "Composition Root"](https://blog.ploeh.dk/2011/07/28/CompositionRoot/): one place that chooses adapters (DR-303).
