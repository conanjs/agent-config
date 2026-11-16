# Implementation Plan: agent-config as a motherboard of replaceable components

**Branch**: `feat/022-repo-split` | **Date**: 2026-11-13 | **Spec**: [spec.md](spec.md) (G2 approved 2026-11-13)

**Input**: `specs/022-repo-split/spec.md`, `blueprint.md` (v3.1, G0), the five P4 role records in `decisions/`, merged into [research.md](research.md).

**Gate**: G3 approved 2026-11-13 with every default except question 1 parts a and b, which V overrode (Node 24, TypeScript; record N-1); G4 approved 2026-11-13, all defaults (run R-001). Written by `architecture` (execute); amended by `engineering` in phase A of `tasks.md`. Risk tier **HIGH** (DR-001).

Words used once here. **Motherboard**: agent-config, in two parts: `contracts/` (schemas, a pure library, the build tool) and the **composition root** (the installer, the component lists, the renderer). **Component**: a folder with a valid `component.yaml`. **Slot**: a named socket in `slots/v1` that components fill. **Home**: `{{AGENT_HOME}}`, `~/.agent-config` from phase 2. **Delivery class**: how the installer places a file: **linked** (a link to the source folder, edits show at once), **rendered** (a read-only copy in `generated/<component>/` with real paths), **generated** (machine-specific files such as routes and `global-variables.md`), plus **compat** (a temporary link at an old `~/.copilot/…` path). **Privileged entry**: anything that makes code or always-loaded instructions run as V: a hook, an MCP service, a status line, a route, skill or agent text. **NEEDS**: the exit-10 report of what only V can supply.

## Summary

Contracts come first, then a minimal installer that composes components from `git` or `path` sources by slot, then content moves out one component at a time: company KB, then the build of skills and agents, the full installer with rendering, the knowledge base, the SDLC framework and the final layout. agent-config stays a modular monolith (DR-301) whose `contracts/` tier depends on nothing else (DR-302); the installer core is a TypeScript program that the latest Node 24 (from 24.12) runs directly by type stripping, with no build step (DR-101 as superseded by N-1), in the functional-pipeline paradigm, with feature-first modules (DR-303) around a pure planner whose single `Plan` drives `plan`, `apply`, the journal, consent and dry runs (DR-306). Security is HIGH: nine blocker mitigations are mapped to phases below, and two of them (consent for privileged entries, staying on the lock) change what V sees, so they arrive as spec amendments at G3.

## Technical Context

| Field | Value | Record |
|---|---|---|
| **Language/Version** | TypeScript (`.ts`) run directly by Node type stripping: erasable syntax only, `.ts` import specifiers, no build step; types checked by `tsc --noEmit` with `strict`; the latest Node 24 from 24.12 only (`.nvmrc` 24, `engines` `>=24 <25`); the legacy `.mjs` tools stay as they are | DR-101, DR-108 as superseded by N-1 (V, G3) |
| **Paradigm** | functional-pipeline@1 for `installers/core` and `contracts/lib`: immutable data types, pure functions composed into pipelines, effects at the edges through ports. The per-tier record is U-2 (task T003); type stripping rejects constructor parameter properties and `enum`, so these tiers use plain functions and `as const` objects | G4-3; U-2 |
| **Primary Dependencies** | None at run time except vendored `yaml` 2.9.1 (ISC); the `git` program ≥ 2.50.1 for `git` sources | DR-102, DR-105, C-5 |
| **Storage** | Files only: `components.lock`, `install-state.json`, the journal (JSON, sorted keys, temp file + rename); human files in YAML | DR-104 |
| **Testing** | `vitest` (unit, table-driven); Cucumber `~13.3.0` (one scenario per acceptance criterion); JSON Schema 2020-12 checked with `ajv` 8.20.0 in development plus a parity test against the reader | DR-103, DR-108 as superseded by N-1, DR-501 |
| **Target Platform** | macOS, Linux, Windows (Windows PowerShell 5.1 shim); Mac and Windows proven in CI and by hand each phase | DR-107, DR-206, DR-208 |
| **Project Type** | CLI plus libraries in one repo; four repos in total | DR-301 |
| **Performance Goals** | None beyond: session-start re-render ≤ 5 s by default, never blocking; unit layer < 60 s; scenario layer ≤ 3 min per OS (measured at the end of phase 0) | DR-406, QB-6 |
| **Constraints** | No run-time package install (FR-034); nothing generated or built committed (A-6), and the code has no build step; aliases come from `package.json` `imports` (`#` prefix), not `tsconfig` `paths`; Node older than 24.12 is refused before any write; unit ≤ 50 lines, complexity ≤ 10; nothing written before the home is confirmed (FR-013) | constitution, DR-101 as superseded by N-1 |
| **Scale/Scope** | One user, two machines, tens of components | A-1 |

## Constitution Check

*Checked against `.specify/memory/constitution.md` 1.0.0 before design and again after it.*

| Principle | Before design | After design |
|---|---|---|
| I. One source of truth | **Fails as written**: principle I mandates thin wrappers; G9 replaces them with one source built per platform | Passes once phase 0 amends I to "one source, generated per platform" (MAJOR, 2.0.0, AC-1.5). Compatibility links keep two paths per fact for one release (Complexity Tracking) |
| II. Typed and validated documents | Passes: every new file follows a schema; `scripts/check-docs.sh` stays the one entry | Passes: 15 contract schemas with examples, a parity test, `docs/architecture.md` in `repo-architecture/v2` |
| III. Verified, cited facts | Passes with a list: every unconfirmed agent behaviour is a P4 protocol item (Quality bar) | Passes: results go to `copilot/knowledge/` in the same change (QA §9.0). Phase 6 amends III because it names `copilot/knowledge` (AC-13.6) |
| IV. Mechanical tools have requirements and tests (NON-NEGOTIABLE) | Passes in plan: QB-1 to QB-3 | Passes: every new check traces to an AC id; characterization tests first for the old installers and validators (QB-3); golden plans recorded before phase 0 changes anything |
| V. Options, not overwrites | Passes: backups before every replace (DR-203), `uninstall --restore` (A-D1) | Passes: the plan keeps every rejected option in research.md; settings merge touches only installer-owned entries (M-09) |

## Architecture

Full description: [docs/architecture.md](../../docs/architecture.md). This section fixes what the tasks build against.

### Motherboard tiers (DR-301, DR-302)

```
            ┌──────────────── checks: tests/, scripts/ (may depend on everything) ───────────────┐
            │                                                                                    │
  installers/ (composition root) ──▶ contracts/ (schemas, lib, build tool) ◀── adapters/<name>/fields.yaml (data)
        │  reads every component only through its component.yaml + locations                    ▲
        ▼                                                                                        │
  core (home/, slot core) ─────────────────────────────── conforms to ─────────────────────────────┘
  agent-knowledge · agent-companies · agentic-sdlc (other repos, same rule)
```

- `contracts/` imports nothing else in the repo. Provider CI runs it from a checkout pinned to a `contracts/vM.m.p` tag (devops P-3).
- Shared pure rules live in `contracts/lib/`: manifest and list reader, slot and location classifier, citation classifier, render rules, character counter, the one `yaml` wrapper with `vendor/yaml/` (DR-304). The phase-0 baseline is `contracts/tools/build.ts budget --baseline` (dry run).
- The installer treats core like any component (slot `core`, reserved, DR-401). It never reads a content file except through a declared location.

### Installer core (DR-303, DR-305, DR-306)

`installers/core/main.ts` (entry) → `src/CompositionRoot.ts` (the only file that chooses adapters) → one composer per module. Paradigm: functional-pipeline@1 (G4-3): each use case is a pipeline of pure functions over immutable data; adapters sit at the edge behind the ports below.

| Module | Owns | May depend on |
|---|---|---|
| `manifests` | Reading and validating `component.yaml`, both lists, `slots.yaml` through `contracts/lib`; name and path rules (M-03) | `shared` |
| `sources` | Source adapters `git`, `path`, `archive` (refused) behind a `Git`/`FileSystem` port; acquire into `store/` | `manifests`, `shared` |
| `resolution` | Pure resolver: reuse a filled slot, take the default, else a need; recursion, cycles, majors (N and N-1), exports, slot counts, fixed-point fallback (DR-418); needs ordering (components before variables) | `manifests`, `shared` |
| `variables` | Declarations, values, `set`, proposals from `detect` (declarative only, M-18), secret refusal (M-08) | `shared` |
| `rendering` | Rendered copies (render rules from `contracts/lib`), `generated/index.md`, `global-variables.md`, routes, the session-start re-render (M-06, M-13) | `manifests`, `variables`, `shared` |
| `wiring` | Agent targets: Claude import lines, Copilot instruction links and routes file, Codex `AGENTS.md` and `hooks.json`, per-entry skill and agent links, hooks merge (M-09, M-15), services, compatibility links and `retired:` (M-14); the privileged set (M-01) | `manifests`, `shared` |
| `state` | `components.lock`, `install-state.json`, journal, `install.lock` (M-12), backups and manifests (DR-203), `install-log.jsonl` (M-16, C-4), store pruning | `shared` |
| `commands` | The use cases `install` (`--update`), `plan`, `doctor`, `set`, `add`, `use`, `init-component`, `uninstall` (`--restore`), `rerender`: the pipeline read → resolve → plan → apply → report | every module above |
| `shared` | Domain-neutral only: path containment, hashing, shell quoting, redaction, exit codes, the report model and message catalog | nothing |

Each module has `domain/ application/ infrastructure/ interface/` (MOD-9). Inside the domain and application layers nothing touches the file system, the network, the clock or the process environment (CA-7); those come through ports owned by the application layer: `FileSystem`, `Links`, `Git`, `Clock`, `Environment`, `Terminal`, `Runtime`, `HomeLock` (DR-305).

**The plan is data** (DR-306). The pure planner returns one `Plan`: ordered operations (`backup`, `link`, `write`, `chmod`, `remove`, `merge-entry`), each with path, target or content hash, delivery class, owning component and a `privileged` flag. `plan` prints it; `apply` executes it; the journal is the plan plus old targets; the consent need is its privileged subset diffed against `install-state.json`; a dry run applies it to an in-memory recorder. Shape: [data-model.md](data-model.md).

**Load paths of rendered copies** (DR-307). Agents load a rendered file at `generated/<component>/<path>`; routes and every agent link point there. A citation's relative target is computed from that folder; mount paths (`companies/`, `frameworks/<name>/`) are addresses used in link text.

### Contracts (15, DR-401 to DR-418)

The spec counts fifteen (the blueprint's fourteen plus `framework/v1`, DR-415, Q8, amendment A-3). Every schema lands in phase 0 under `contracts/<name>/v1/` (`schema.json`, `README.md`, `examples/`), listed in `contracts/index.md`, tagged `contracts/v1.0.0`. Sketches: [contracts/](contracts/README.md).

| # | Contract | Owner | Main consumers | Missing or stale on a machine |
|---|---|---|---|---|
| 1 | `slots/v1` | agent-config | installer, doctor, `build cite`, renderer | Unknown slot: only that component skipped, warning |
| 2 | `component/v1` | agent-config | installer, build, atlas, doctor, renderer, `build cite` | Manifest missing: component skipped, `doctor` fails, core still works |
| 3 | `components-list/v1`, `components-lock/v1` | agent-config | installer, doctor, `add`, `use`, `plan` | Acquire or validation fails: previous version stays linked |
| 4 | `knowledge-provider/v1` | agent-config defines; agent-knowledge, agent-companies provide | core, agentic-sdlc, agent-companies, installer | No route, layer skipped; `doctor` lists dead citations |
| 5 | `company-kb/v1` | agent-knowledge (in agent-config until phase 6) | agent-companies, `init-repo-kb`, agentic-sdlc | agent-companies not installed; NEEDS names `knowledge-storage` |
| 6 | `rendered-copy/v1` | agent-config renderer | agents, doctor, uninstall, session-start hook | `doctor` fails naming the source; `install` restores |
| 7 | `routes/v1` | agent-config renderer | the three agents | `doctor` hash check; post-merge and session-start re-render |
| 8 | `skill-source/v1` | agent-config | build; providers agent-config, agentic-sdlc | Same skill name twice: the second fails |
| 9 | `agent-source/v1` | agent-config | build; providers agentic-sdlc, agent-config | Description budget warning; Codex tool restriction warning |
| 10 | `adapter-fields/v1` | agent-config | build, doctor | Stale `verified` warns; stamp mismatch fails `doctor` |
| 11 | `build/v1` (tool: `build`, `budget`, `cite`, `layout`) | agent-config | every repo's CI, installer, doctor | Stamp or adapter-major mismatch fails `doctor`; previous output stays |
| 12 | `repo-layout/v1` | agent-config | CI of all four repos | Repo CI fails (report mode in agent-config until phase 8) |
| 13 | `hooks/v1` | agent-config renderer | `~/.claude/settings.json`, `~/.copilot/hooks/agent-config.json`, `~/.codex/hooks.json` | A merged hook whose command does not resolve: `doctor` fails (M-14) |
| 14 | `variables/v1` | agent-config | every component, installer, agents | Required value missing: exit 10, nothing changed |
| 15 | `framework/v1` | agent-config | installer (`enable`, `disable`), doctor | Not enabled in a project: no skills or agents there |

In-repo interfaces (not cross-repo contracts, owned here by architecture, CON-15): the installer CLI (commands, exit codes 0/10/1/2, `--json` report) and `install-state/v1`: [contracts/installer-cli.md](contracts/installer-cli.md).

## Security: threat model (from DR-001 and `decisions/security.md` §2 to §5)

Risk tier HIGH. In P6 the `security` role reviews only the tasks that implement the nine blocker mitigations (M-01, M-02, M-03, M-04, M-05, M-09, M-11, M-14, M-18; V, G4, 2026-11-13); every other task is reviewed by `engineering` and `qa` only. Security signs off each phase's blocker tasks before G5. Read-only rendered files are **not** a security control: they stop accidental edits only.

### Scope

| Id | Asset | Why it matters |
|---|---|---|
| A1 | V's user account on Mac and Windows | Every hook, service and built skill script runs with its full rights |
| A2 | `~/.claude/settings.json`, `~/.codex/hooks.json`, `~/.copilot/hooks/*.json`, MCP registrations | They decide what runs; settings may hold tokens |
| A3 | V's secrets on disk (`~/.ssh`, `~/.aws`, git credential store, tokens in settings `env`) | Reachable by any code the agents run, and by copies the renderer makes |
| A4 | Always-loaded agent text: core, routes, rendered copies, skill list | Instructions every agent obeys; also sent to model providers |
| A5 | The governance guard (workflow-graph `PreToolUse` and `UserPromptSubmit` hooks) | Enforces gates; spec 019 D6 chose fail-closed |
| A6 | `components.lock`, `install-state.json`, backups | The record of what is installed and the way back |
| A7 | V's username in rendered paths | Personal data, low sensitivity |

| Actor | Trust |
|---|---|
| V at a terminal | Trusted; the only one who can consent |
| An agent driving the installer (AC-4.3) | Semi-trusted: obeys whatever text it reads, injected text included |
| A component (git repo or local folder) | Untrusted input: a stolen token, a hostile merged pull request or a `path` source at a downloaded folder makes it hostile |
| GitHub and the network | Untrusted transport and host |
| Another session starting at the same moment | Concurrent writer |

Entry points: `install`, `plan`, `doctor`, `set`, `add`, `use`, `init-component`, `uninstall`, `--json`; the session-start re-render hook; the post-merge hook; each provider's CI build.

### Data flow and trust boundaries

```
GitHub ──B1 (fetch)──▶ managed clone ─┐
local folder ──B8 (live link)─────────┤
                                       ▼
                    B2: installer parses component.yaml, docs, sources
                       │ build (FR-038)  │ render (FR-045)  │ merge (FR-039)
                       ▼                 ▼                  ▼
          generated/ skills, copies   routes, core      hook files, MCP registrations
                       └──────B4──────────┴───────B3─────────┘
                                       ▼
                     agent session (V's rights) ──▶ model provider (A4, A7 leave the machine)
   NEEDS report / --json ──B5──▶ agent or script that drives the installer
   session start ──B6──▶ re-render hook ──▶ generated/
   installer ──B7──▶ backups, lock, install-state on disk
```

| Boundary | Crossing | Less trusted → more trusted |
|---|---|---|
| B1 | Network fetch of `git` sources | GitHub → V's disk |
| B2 | Parsing a component's files | Component → installer process |
| B3 | Writing hook files and MCP registrations | Installer output → code the agents execute |
| B4 | Rendered or linked text loaded at session start | Component text → agent instructions |
| B5 | Report text read by an agent | Component strings → agent actions |
| B6 | Unattended re-render at every session start | Changed source → generated copy |
| B7 | Backups and state files | Installer → disk readable by other local processes |
| B8 | `path` source linked live | Any folder V names → agent home |

### Threats (STRIDE-lite; rating = likelihood × impact on a single-user machine)

| Id | B | STRIDE | Threat | Rating | Mitigation |
|---|---|---|---|---|---|
| T-01 | B1 B3 | E, T | A hostile or compromised component adds or changes a hook, MCP service, status line or skill script; the next `install` merges it and it runs as V at every session start or tool call. FR-022 guards only fetching a suggested source; content repos follow `main`, so one push is enough | High | M-01, M-02 |
| T-02 | B2 | T, E, I | Path traversal through component-controlled names and paths (`name`, `locations`, `exports`, route, skill and agent names, `{{include:}}` targets, citation paths with `..`): writes outside the home (`~/.claude/settings.json`, `~/.ssh/authorized_keys`) or reads any file into a copy | High | M-03 |
| T-03 | B2 B4 B8 | I | A symlink inside a component points at `~/.ssh/id_ed25519` or `~/.aws/credentials`; the renderer copies it into `generated/`, agents load it, the secret reaches a model provider | High | M-04 |
| T-04 | B1 | E | The clone runs code: recursive submodules (CVE-2024-32002 on case-insensitive file systems, the Mac and Windows default; CVE-2025-48384 through a carriage return in `.gitmodules`); a URL or ref starting with `-`; `ext::` or `file::` transports | Medium | M-05 |
| T-05 | B6 B8 | E | The session-start hook runs git in a `path` source; that folder's `.git/config` `core.fsmonitor` names a command `git status` runs at every session | Medium | M-06 |
| T-06 | B5 B7 | I | A source URL with credentials is echoed in the lock, `plan`, `doctor`, `--json` and NEEDS, which agents send to their provider | Medium | M-07 |
| T-07 | B4 | I | A secret stored as a variable value is rendered into `generated/global-variables.md`, which every agent loads | Medium | M-08 |
| T-08 | B3 | T | The settings merge corrupts or drops V's keys (parse error, a concurrent write by Claude Code, a whole-file rewrite) or lets a component add `permissions.allow`, `env`, `apiKeyHelper` or MCP auto-approval | High | M-09 |
| T-09 | B7 | I | Backups of `settings.json` and of replaced folders are readable by other local users or processes | Medium | M-10 |
| T-10 | B4 B5 | S, E | Prompt injection: (a) route, core or skill text tells agents to run commands or send files; (b) a NEEDS "suggested source" phrased as a ready command makes an agent run `add` + `install`, bypassing "never fetch without asking V"; the same for the first-run home confirmation | High | M-11, M-01 |
| T-11 | B6 | T | Two sessions start together or an install is interrupted, and an agent reads a half-written copy or hook file | Medium | M-12 |
| T-12 | B6 | D | The re-render hook hangs or runs long and delays every session start | Low | M-13 |
| T-13 | B3 | E (fail-open) | The guard hook moves to agentic-sdlc; if its command stops resolving (a retired compatibility link, the component off in this project, a changed rendered path) the shell exits 127, which Claude Code treats as non-blocking, so the guard turns off silently, against spec 019 D6 | High | M-14 |
| T-14 | B3 | E | Command injection in generated hook commands through a home path with spaces, `$`, backticks or quotes | Medium | M-15 |
| T-15 | B7 | R | Nothing records who installed which code when | Low | M-16 |
| T-16 | B1 | T | A tag moves or `main` advances, and a different commit installs while the lock suggests a pin | Medium | M-02 |
| T-17 | B2 | T, D | The YAML parser parses untrusted input: custom tags, alias expansion, very large files | Medium | M-17 |
| T-18 | B2 | E | A variable `detect` rule or a build step runs a command the component supplied | High if allowed | M-18 |
| T-19 | B4 | I | V's username in rendered paths leaves the machine in agent context and in pasted `doctor` output | Low | AR-3; AC-16.10 keeps it out of repos |
| T-20 | B1 | T | Provider CI pins `build@major`, and a major tag can move | Low | M-19 |

### Required mitigations, with phase and requirement

**Blocker** = in this plan before G3, its task done before that phase's pull request merges. "Amend" = changes what V sees, so the spec is amended (section "Spec and blueprint amendments for G3"). Every mitigation becomes a P5 task with mandatory unit and negative scenarios (DR-501); the nine blockers also get the `security` review in P6, and the others (M-06, M-07, M-08, M-10, M-12, M-13, M-15, M-16, M-17, M-19) get `engineering` and `qa` review only.

| Id | Mitigation (testable) | Threats | Phase | Severity | Requirements | Design home |
|---|---|---|---|---|---|---|
| **M-01** | **Consent for privileged entries.** `plan` computes the privileged set per agent (each hook with event, matcher and command; MCP service; status line; route; skill and agent text). When `install` finds an entry new or changed against `install-state.json`, it exits 10 with a "privileged changes" need showing each entry in full with its component and commit, and writes nothing. Approval records the approved set's hash. The session-start and post-merge hooks never change the privileged set; they re-render content only and leave a pending change for `doctor` | T-01, T-10, T-20 | 2 (mechanism), 3 (routes), 4 (skill and agent text), 5 (hooks, services, status line) | blocker | FR-016, FR-022, FR-039, FR-046; amend: new AC under US4 and US12 (S-1) | `wiring` privileged set; `commands/install`; `Plan.privileged` (DR-306) |
| **M-02** | **Install stays on the lock.** `install` checks out the SHA in `components.lock`. Advancing a `git` source is `install --update [<name>]`, which prints the commit range and, through M-01, any privileged change. A pinned tag that now resolves to another SHA exits 1 ("tag moved") | T-01, T-16 | 2 | blocker | FR-020, AC-3.1; amend S-2; Q3 | `sources`, `state` (lock), `commands/install` |
| **M-03** | **Names and paths are allow-listed and contained.** Component, skill, agent, route and hook ids match `^[a-z0-9][a-z0-9-]{0,63}$`. Every path field from a component is relative, with no `..` segment, drive letter, `\` or NUL. Before each read or write, the resolved real path (links followed) lies under the expected root (component root for reads; the home or the named agent folder for writes). `uninstall` uses `lstat`, removes links without following them, never deletes recursively through a link | T-02 | 0 (schema), 2, 4, 5 | blocker | FR-004, FR-005, FR-021, FR-030; clarify S-8 | `contracts/lib` schema rules; `shared` path containment used by every `FileSystem` and `Links` call |
| **M-04** | **No symlink escape.** Managed clones use `core.symlinks=false`. The renderer and build refuse any symlink whose real path leaves the component root: that component fails, the others install. `doctor` reports out-of-root symlinks in linked `path` sources (the KB) | T-03 | 2, 4, 5 | blocker | FR-045, FR-029; amend: new `doctor` fault in AC-7.5 (S-7) | `sources/git`; `rendering`; build in `contracts/tools`; `commands/doctor` |
| **M-05** | **Safe git invocation.** No shell; `--` before URLs and paths; refs and URLs starting with `-` refused; `GIT_ALLOW_PROTOCOL=https:ssh`; `--no-recurse-submodules` (a `.gitmodules` warns that submodules are ignored); `GIT_TERMINAL_PROMPT=0` when stdin is not a terminal; every fetch has a timeout (60 s, one retry after 2 s on a network error only); git ≥ 2.50.1 checked as a runtime | T-04 | 2 | blocker | FR-020, FR-024 | `sources/git` adapter; `Runtime` port |
| M-06 | No git porcelain in `path` sources: change detection by file times or by reading `.git/HEAD` and the ref file; if git must run, `git -c core.fsmonitor= rev-parse HEAD`, never `git status` | T-05 | 5 | major | FR-046 | `rendering` re-render change detector |
| M-07 | No credentials in sources: a URL with a user-info part fails validation naming the component only; every report redacts user-info and `?token=` parts | T-06 | 2 | major | FR-019; amend S-3 | `manifests` validation; `shared` redaction in the report presenter |
| M-08 | Variables are not secrets: `component/v1` states variables are public values loaded by agents; `set` refuses names containing `TOKEN`, `SECRET`, `PASSWORD`, `APIKEY`/`API_KEY` and values with common token prefixes (`ghp_`, `github_pat_`, `sk-`, `AKIA`, `xox`); `doctor` re-checks the rendered file | T-07 | 2 | major | FR-025, AC-6.1; amend S-4 | `variables` |
| **M-09** | **Scoped, atomic settings merge.** The merge touches only installer-owned entries under `hooks` (and the core's `statusLine`), each recorded in `install-state.json`; a component can contribute no other key (`permissions`, `env`, `apiKeyHelper`, MCP auto-approval). An unparsable file: exit 1, nothing written. Write = temporary file + rename after re-reading the file and checking its hash is unchanged since read; backup first. Same rules for `~/.codex/hooks.json` and `~/.copilot/hooks/agent-config.json` | T-08 | 5 | blocker | FR-039, AC-12.3; extend S-10 | `wiring` hooks merge; `state` backups |
| M-10 | Private files stay private: home, backups folder and every backup owner-only (`0700` folders, `0600` files; Windows: the user's own access list, inheritance off); `doctor` warns when any is readable by others | T-09 | 2 | major | AC-7.3; extend S-9 | `state`; `FileSystem` adapter |
| **M-11** | **Reports are data, and consent is V's.** A NEEDS item from component text is labelled "suggested by `<component>`, unverified" and never printed as a ready-to-run command. Home confirmation and privileged-change approval need an interactive terminal; with none they exit 10. The core gains one line: agents never run `add`, `use` or an approval from a NEEDS report without V's approval in chat. Route and skill text is in the M-01 set; ordinary doc changes are AR-2 | T-10 | 2, 5 | blocker | AC-4.5, AC-2.1, AC-2.5, FR-048; amend S-5 | `shared` report presenter; `Terminal` port; core instructions |
| M-12 | One writer at a time: home-wide `install.lock` with a stale timeout (10 minutes), taken by `install`, `uninstall` and the re-render hook (which only tries and skips); every write to `generated/` and to hook files is temporary file + rename; a second concurrent run waits or exits 1 naming the lock | T-11 | 2, 5 | major | Edge Cases (interrupted install) | `state` (`HomeLock` port) |
| M-13 | Bounded session-start hook: no network I/O, only changed components, own time budget below the agent's hook timeout (default 5 s), keeps the old copy on timeout, caps rendered file size | T-12 | 5 | major | AC-16.8, AC-16.9 | `commands/rerender` |
| **M-14** | **The guard stays fail-closed through the move.** `doctor` fails on any merged hook whose command path does not resolve (the warning stays only for agents absent from the machine); `retired:` refuses to remove a compatibility link any merged hook command still uses; merged hook commands use the real home path, never a compatibility path; phase 5 adds a test that deletes the guard script and checks `doctor` exits 1 | T-13 | 2 (`retired:`), 5 | blocker | FR-029, FR-031, AC-7.5, AC-8.3; amend S-6 (Edge Cases) | `wiring` (compat links, hooks); `commands/doctor` |
| M-15 | Quoting per shell: one tested function for bash, one for PowerShell; tests with a home containing a space (`Vinh Do`), `$`, a backtick, `'`, `"`; a home with a newline or NUL is refused | T-14 | 5 | major | Edge Cases (spaces) | `shared` quoting |
| M-16 | Install log: `{{AGENT_HOME}}/install-log.jsonl` outside `generated/`, one line per run with time, command, component, redacted source, SHA before and after, approved privileged changes; rotated at 1 MB keeping one previous file (C-4) | T-15 | 2 | minor | — | `state` |
| M-17 | YAML parser risk record: pinned by lockfile, `cmd.audit` clean, no custom tags, alias limit, 256 KiB cap per file; hooks stay parser-free (spec 019 D9) | T-17 | 2 | major | — (unlisted need U-1) | `contracts/lib/yaml.ts` wrapper |
| **M-18** | **No component code at install.** `detect` rules are declarative only (an environment variable name, a path probe inside the home) and never run a command; the build runs only agent-config's pinned build tool and never a component script; `{{include:}}` follows M-03 | T-18 | 2, 4 | blocker | FR-025, FR-038, AC-6.4, AC-11.5 | `variables` detect; `contracts/tools` build |
| M-19 | CI pins by SHA: provider CI references the build tool by full commit SHA; the contract still promises compatibility by major | T-20 | 4 | minor | AC-11.9 | `contracts.pin` (DR-206) |

**Fail-open review (SEC-R1).** Unknown keys warn: acceptable (M-01 still sees every privileged entry the reader understands). Unsupported slot or major skips that component: acceptable (less installed, never more). A failed re-render keeps the old copy and the session starts: acceptable (content V already accepted; `doctor` fails). A missing hook command is non-blocking in Claude Code: **fail-open, fixed by M-14**. The guard wrapper skips when no Node ≥ 24.12 is found: already fail-open today, not new in 022, but the move makes Node lookups vary (AR-4, Q4). Privileged entries merged without consent as the spec stands: **fail-open, fixed by M-01 and M-11**; not a veto at P4, but a veto at P6 if a phase-5 hook-merge task ships without M-01. Missing `path` source (exit 1, old links kept) and unresolved variables (exit 10, nothing changed): fail-closed.

**Accepted risks for V to sign** (`Decided by: human`; Q2, Q4): AR-1 approved hooks and MCP services run with V's full rights, nothing sandboxed (accept, with M-01 consent per change). AR-2 ordinary doc content changes without consent and is loaded as context (accept). AR-3 V's username in rendered paths reaches model providers (accept). AR-4 the guard does nothing when Node is missing (V decides).

## Quality bar and testability (DR-501, `decisions/qa.md`)

**Levels on every phase**: unit (pure functions, table-driven), scenario (the CLI run as a process on a temporary home, Gherkin, one `.feature` per story under `tests/<tool>/`), contract (the shipped schemas and worked examples, run by provider and consumer). Negative cases are mandatory (TD-Q2 forced by HIGH).

| Id | Bar (design constraint) | How the design meets it |
|---|---|---|
| QB-1 | Every AC has a scenario whose title starts with its id; a coverage check reads `spec.md` ids and `tests/**/*.feature` titles and fails on an AC of a delivered phase with none (111 ACs counted 2026-11-13; 14 edge cases as `EDGE-<n>`) | A phase-0 check script with its own scenario (constitution IV) |
| QB-2 | An AC that cannot be automated is on one reviewed exemption list with a reason and its manual replacement | The list below; the coverage check reads it |
| QB-3 | Test first for new tools; characterization tests before changing the old installers (phase 0) and validators (phase 1) | Golden plans recorded as the first task of phase 0 |
| QB-4 | Deterministic: no real network, clock, home, random value or agent | Ports and the fault adapter (DR-305); local bare git repos |
| QB-5 | The previous phase's scenarios run unchanged; an old scenario changes only when its own AC changes, named in the pull request | Phase exit checks below |
| QB-6 | Unit layer < 60 s; scenario layer budget 3 min per OS, measured at the end of phase 0 and written into the constitution | Fast set per commit, full set per pull request if exceeded |
| QB-7 | Mutation proof per new validator or fitness check: disable it, a named scenario fails; recorded once in the phase's research | A P5 task per check |
| QB-8 | Synthetic data only: fake users (`Vinh Do`, `v`), `example.invalid` URLs, local bare repos, no real tokens | Fixture rule in review |
| QB-9 | Windows is a real runner for links, `%USERPROFILE%`, `install.ps1`, `uninstall.ps1` | `installer.yml` matrix (DR-206) |

| Id | Testability need (QA) | Design answer |
|---|---|---|
| TR-1 | Home, platform and clock are inputs, never read deep inside logic | `Environment` and `Clock` ports, read only in the composition root (DR-305) |
| TR-2 | Git through a port with a real adapter; scenarios use local bare repos | `Git` port; the real adapter runs against `file://` bare repos in tests only (production allows `https` and `ssh`, M-05) |
| TR-3 | Fault injection: fail the n-th write, links not permitted, fetch fails for component X | A fault adapter wrapping `FileSystem`, `Links`, `Git`, built only by the test composition; it can only make operations fail |
| TR-4 | `plan` and the dry run share the apply path up to the write | One `Plan` (DR-306); a scenario compares `plan` with the diff after `apply` |
| TR-5 | Messages produced in one place, compared as exact text | Report model and message catalog in `shared` |
| TR-6 | Swap rules and citation classifier are one module each, used by dry run, `--write` and renderer | `contracts/lib` (DR-304); one shared rule-table fixture file for all three |
| TR-7 | The checked runtime version comes through a replaceable command | `Runtime` port; `NODE` override in the shims (DR-107) |
| TR-8 | Hooks print one machine-readable result line | Every hook command ends with one JSON line; scenarios read it |

**Exemption list (QB-2).** AC-8.6, SC-002 and AC-12.1: the files each agent receives are hashed and resolved automatically; that an agent loads them is checked by P4-14, P4-26b and the runbook step 7. AC-14.2: the skill-list size in characters is automated; the token figure is a Claude Code measurement, only with V's go-ahead. AC-16.8 (Codex part): P4-18. AC-2.2, AC-7.3 (Windows), AC-12.3: the Windows runner, plus a real Windows account by hand each phase. A-19: P4-19 by hand. SC-004, SC-015: token figures stay estimates (A-7).

**P4 agent-behaviour protocol** (`decisions/qa.md` §9; not run yet). Codex CLI `codex exec -m gpt-6-luna` and Copilot CLI `copilot --model gpt-5.4-mini` only; never Claude Code, Opus, Sonnet or `gpt-6.1-sol` without V (AGENTS.md). Isolated `CODEX_HOME`, `COPILOT_HOME` and a fake `HOME`; each probe twice with a negative control; results recorded in `copilot/knowledge/` in the same change. Items and when they must be answered: P4-22, P4-26a, P4-26d before phase 4; P4-14, P4-18, P4-26b before phase 5; P4-19, P4-20, P4-26c (VS Code, V by hand) before phase 5; P4-21, P4-23, P4-24, P4-25 become scenarios. Codex is not on `PATH` on this Mac (2026-11-13): V supplies the binary.

## Delivery: environments, topology, rollback and CI (DR-201 to DR-208)

**Environments** (DR-201): preview = CI on every pull request with a throwaway home on Ubuntu, macOS and Windows; staging = `plan` plus the installer's own staging on V's machine, after a throwaway-home rehearsal in phases 2 and 5; production = V's real home, Mac first, then Windows, merged by V (G5).

**Home layout** (FR-014 as amended, DR-202, DR-416):

```
H = ~/.agent-config  (Windows: %USERPROFILE%\.agent-config; AGENT_CONFIG_HOME moves it; owner-only, M-10)
H/core, H/instructions, H/patterns, H/procedures, H/references, H/atlas, H/tracker, H/frameworks/agent-foundry
                                    core locations (slot core); from phase 5 links into generated/core/
H/knowledge, H/frameworks/knowledge, H/frameworks/company-kb      linked class: links into store/ (agent-knowledge)
H/companies/<entry>                 shared location, linked entry by entry; H/companies/index.md generated
H/frameworks/<name>                 per-project framework files (agentic-sdlc)
H/global-variables.md               link to generated/global-variables.md
H/components/<name>/                managed git clone: fetch cache only, never linked
H/store/<name>@<id>/                one immutable tree per version (checked-out tree or rendered or built copy)
H/generated/<component>             link to ../store/<name>@<id> (rendered copies; agents load here, DR-307)
H/generated/{index.md, global-variables.md, routes.md, codex/AGENTS.md, codex/hooks.json, …}   generated class
H/components.local.yaml, H/variables.local.yaml          V's input, never tracked (AC-3.8)
H/components.lock, H/install-state.json, H/install-state.pending.json (journal), H/install.lock, H/install-log.jsonl
~/.agent-config-backups/<yyyyMMddHHmmss>/  outside the home; backup-manifest.json per folder; never deleted by a command
```

**Apply order** (DR-202): lock → read, resolve, plan (pure) → acquire into cache and new store trees → validate every staged tree (schema, cycles, majors, exports, runtimes, build, render, per-component and total budget, M-01 consent) → any failure: delete new trees, exit 1, live links untouched → back up → write the journal → switch each link (temporary link + rename; Windows remove-then-create) → write lock and `install-state.json` (commit point), delete the journal → prune to current + previous → report. Interrupted runs restore from the journal. Windows link ladder: symbolic link, junction (folders), hash-tracked copy (files), each degradation reported (C-7).

**Rollback** (DR-205):

| What changed | Rollback | Network | Exercised by |
|---|---|---|---|
| A failed install | Automatic: live links never moved | no | AC-7.2 scenario |
| A crash during the switch | Journal restore on the next `install` or `doctor` | no | Scenario killing the process between links |
| A content repo update | `use <name> <url>#<previous sha>` + `install` (previous tree kept in `store/`) | no | CI scenario; by hand in phases 3 and 6 |
| agentic-sdlc update | Revert the pin in `components.yaml`, or `use` | no | CI scenario |
| Installer or contracts code | `git checkout <previous tag>` in V's clone + `install`; a newer state-file major is refused | no | Scenario with an older state file |
| Phases 2 to 4 as a whole | `uninstall`, then `installers/install.sh --legacy` (kept until phase 5 plus one tag); `uninstall --restore` returns backed-up files | no | Rehearsal in phases 2 and 5; one Windows drill |
| Merged hooks and agent files (phase 5) | `uninstall` removes only matching entries; `--restore` returns `settings.json` | no | Scenario with a pre-filled `settings.json` |
| Anything, worst case | Tag `pre-022` at `825ea82` and the old installer | yes | Last resort |

**CI per repo** (DR-206 and DR-109 as superseded by N-1, C-9; C-8 is moot): one `.github/workflows/check.yml` per new repo, job `check`, read-only permissions, `pull_request` with no path filter, push to main, manual, weekly; actions pinned to full SHAs; no secrets. agent-config keeps `validate-docs` until phase 8 and adds `installer.yml` (Ubuntu, macOS, Windows with a throwaway home, each on the Node from `.nvmrc`; required from phase 2: `installer (macos)`, `installer (windows)`) and `integration.yml` (nightly and on `components.yaml` changes). Provider repos fetch the contracts tool through `contracts.pin` and check citations against `providers.pin`; the nightly job checks the provider's `main`.

**Releases** (DR-207): agent-config `vM.m.p` at the end of phases 2, 5 and 8 and when retiring compatibility links; `contracts/vM.m.p` for contracts; agentic-sdlc annotated tags equal to `framework-version`, pinned; content repos tag only when `component.yaml` `version` changes. Rollout of any contract change: contracts → content providers → consumers → composition-root pins → drop N-1 later.

**Per-phase runbook** (DR-208), Mac then Windows, evidence in the pull request: checks and CI green; snapshot of the install tree and ten sampled `~/.copilot/…` paths; `plan`; `install` (first run exits 10, confirm); `install` again → "no changes"; `doctor` twice → identical, exit 0; start the three agents and compare the loaded core text hash; Windows link kind and a path with a space; after merge, pull + `install` + `doctor` on both machines.

**Operations**: no SLO (a local tool); recovery to the previous working state in one command, under 5 minutes, offline for every rollback row but the last. `install-state.json` records installer version and commit, run time, exit code and every component SHA; `doctor --json` is the health signal for scripts and agents.

## Phases (revised order: providers ship first)

One pull request per phase; checks green before and after; the runbook on Mac and Windows; security review on the blocker tasks only (G4-1), engineering and qa review on every task. The phase content follows system-architecture's corrections (DR-405, DR-407, DR-408), pending Q8. **Exit check** = what must hold before V merges the phase (G5 for that pull request).

| # | Phase | Content (providers before consumers) | Blocker mitigations | Exit check |
|---|---|---|---|---|
| 0 | **Contracts and fitness** (nothing installed changes) | 1) Golden plans of the old installers recorded first (Mac, Linux, Windows; QB-3). 2) 15 schemas with examples, `contracts/index.md`, `contracts/slots.yaml`; `contracts/lib/` (reader, classifiers, render rules, character counter, `yaml` wrapper and vendor); JSON Schema parity test. 3) `build` tool skeleton: `budget --baseline` (dry run) and `layout` (report mode). 4) Constitution I amended (2.0.0). 5) `atlas.yaml` components, allowed and forbidden edges, baselines (Q8: 123/73 or 109/67; core → agentic-sdlc 20; core → companies 1), fitness checks in report mode failing only on a rise. 6) Toolchain (DR-108 as superseded by N-1: `.nvmrc` 24, `engines`, `tsconfig` for `tsc --noEmit`, `vitest`, `package.json` `imports` aliases) and the ESLint config carrying the stack baseline names for new code (Q1 d). 7) `installer.yml` matrix on the Node from `.nvmrc`, no older-Node job. 8) V tags `pre-022`; release `contracts/v1.0.0` | M-03 (schema rules) | `check-docs.sh` green; the three golden plans unchanged (AC-1.9); AC-1.1 to AC-1.9 scenarios pass; baseline file recorded with method, tool version, date (AC-1.7); QB-6 scenario budget measured; matrix job required |
| 1 | **Cut the cycles** | Characterization tests of `validate-knowledge.mjs` and `validate.mjs` first; `validate.mjs --knowledge <root> --adapters <map>`; "Used by" rule and backlink scan removed; deny-list check retired; `build cite [--write]`; knowledge mentions of `agentic-sdlc` → 0 (scope per Q8); core `{{VAR}}` rule "read locally, never fetch" | — | Fitness count → 0 and the check on for good (AC-9.1); AC-9.1 to AC-9.8 pass; QB-7 mutation proof recorded; runbook shows an empty install difference |
| 2 | **Minimal installer** | Installer core modules `manifests`, `sources`, `resolution`, `variables`, `state`, `commands`, the compat-link part of `wiring`, the `global-variables.md` and `generated/index.md` part of `rendering`; home and confirmation; both lists, lock, `git` and `path` sources, `archive` refused; resolve, NEEDS, exit codes, `--json`; `set`, `add`, `use`, `init-component`, `plan`, `doctor`, `uninstall --restore`, `install --update`; store, journal, atomic switch, backups, install log; DR-414 variable import; compatibility links and `retired:`; the entry scripts find Node 24.12 or later and run `main.ts` (older Node: exit 10, nothing changed); the old installer moved to `installers/legacy/` behind `install.sh --legacy`; core's `component.yaml` and in-repo stand-in manifests for the KB and agentic-sdlc (`path` sources). The old installers keep wiring agent folders, pointed at the new home (FR-035) | M-01 (mechanism, privileged set, consent), M-02, M-03, M-04 (clones, `doctor`), M-05, M-11, M-14 (`retired:`), M-18 (`detect`) | Stories 2 to 8 scenarios on three OS runners; Windows runner green; rehearsal in a throwaway home; rollback drill (`uninstall --restore`, then `--legacy`); 10 sampled old paths resolve; AC-8.6 hash compare; agent-config tag `vM.m.p` |
| 3 | **Company KB → `agent-companies`, with a minimal routes renderer** | `routes/v1` renderer: Copilot `routes.instructions.md` (`applyTo: "**"`), one Claude import line, Codex `AGENTS.md` as core + routes (< 32 KiB); then V creates `agent-companies` (public, history kept with `git filter-repo`), its `component.yaml` and CI pinned to `contracts/v1` and to agent-config as provider; then agent-config removes `copilot/companies`, the company lines in core, `init-repo-kb:61` as plain words, and adds the entry to `components.yaml` | M-01 (routes) | Story 10 passes; 0 company names in core and variables source (AC-10.1); install with and without the entry; network-unplug drill (AC-10.4); FF-1 core → companies 1 → 0 |
| 4 | **Build step and per-entry targets** | `skill-source/v1`, `agent-source/v1`, `adapter-fields/v1`, `build` subcommand; per-entry linking of built output into `~/.claude/skills`, `~/.agents/skills` and the three agent folders in the same pull request as the first migrated source (DR-408, DR-409); migrate the 12 agents and the wrapper skills; procedures become skills or `references/`; the 4 SDLC procedures move into the in-repo agentic-sdlc folder (DR-405); provider CI pins the tool by SHA | M-01 (skill and agent text), M-03, M-04, M-18 (build) | P4-22, P4-26a, P4-26d answered before start; Story 11 passes; same source built twice is byte-identical; 0 hand-written agent files; FF-1 core → agentic-sdlc 20 → 0; skill-list size against the baseline |
| 5 | **Installer, full** | `rendering`: rendered copies, generated-from line, `generated/index.md`, read-only, session-start re-render; load paths at `generated/` (DR-307); routes and skill and agent links switched to rendered copies; `wiring`: hooks merge, services, status line; total budget; `doctor` drift checks; then, with rendering in place, the 484 hard-coded `~/.copilot` lines are classified and the agent-home ones converted to `{{AGENT_HOME}}` (FR-032, AC-8.4), leaving the lines in knowledge files for phase 6 | M-01 (hooks, services, status line), M-03, M-04, M-09, M-11, M-14 (guard-deletion test) | P4-14, P4-18, P4-26b, P4-19, P4-20, P4-26c answered; Stories 12 and 16 pass; rendered size ≤ baseline everywhere (SC-004); rehearsal with the exact `settings.json` diff in `plan`; backup of `settings.json` confirmed; Codex `AGENTS.md` < 32 KiB; `--restore` drill; security sign-off; agent-config tag |
| 6 | **KB → `agent-knowledge`** | V creates the repo (history kept); `component.yaml` with `provides.contracts: [knowledge-provider/v1, company-kb/v1]` and the exports (41+); the 20 (+ 42 per Q8) `{{AGENT_HOME}}` lines converted, so every knowledge file goes straight to its final form on arrival (not converted in phase 5 and again here); self-containment blocking; constitution III and `review-docs` stop naming `copilot/knowledge`; then agent-config switches `knowledge-storage` to the `git` source and removes the KB and both frameworks; then `cite --write` in core, the in-repo SDLC and agent-companies | M-03, M-04 (linked KB) | Story 13 passes; KB alone in a clean checkout passes its check; `path` and `git` sources give identical content (AC-13.8) |
| 7 | **agentic-sdlc → own repo** | V creates the repo; tag `vM.m.p` = `framework-version`; `framework/v1` `enable` and `disable` per project (links kept out of git through `.git/info/exclude`); agent-config pins the tag and removes the folder; the workflow-graph hook entries move with it (DR-413) | M-01, M-14 (the guard's new command path) | Story 14 passes; pin and tag round trip; SDLC and non-SDLC project compared; guard still blocks after the move |
| 8 | **Layout** | Move to the target root set (DR-308): `home/`, `adapters/`, `skills/`, `agents/`; `mapping.yaml` into `installers/legacy/` (or removed if the legacy installer has retired); `repo-layout/v1` blocking; retire compatibility links in a separate release once DR-417's evidence holds | M-14 (`retired:` guard) | Story 15 passes; the three golden files and the install state identical before and after (AC-15.2); root entries equal the DR-308 set |

**Order of the path conversion** (V, G4-5; spec A-15). The 484 hard-coded `~/.copilot` lines are converted in phase 5, after rendering exists, and before the compatibility links retire in phase 8. Knowledge files are not touched in phase 5: they go straight to their final form in phase 6, when they move to `agent-knowledge`.

## Project Structure

### Documentation (this feature)

```text
specs/022-repo-split/
├── blueprint.md         # G0 (not edited here)
├── spec.md              # G2 (not edited here; amendments listed below)
├── decisions/           # the five P4 role records (evidence)
├── plan.md              # this file
├── research.md          # every decision record, conflicts, context map
├── data-model.md        # entities, fields, invariants, state transitions
├── contracts/           # contract sketches for the 15 contracts and the installer CLI
└── tasks.md             # P5 (not created here)
```

`quickstart.md` is not written in this run (not in the launch prompt's file list); the per-phase runbook (DR-208) is the manual walk-through.

### Source code (repository root, target after phase 8)

```text
contracts/                     # tier 1: depends on nothing else in the repo; tagged contracts/vM.m.p
├── index.md
├── slots.yaml
├── <name>/v1/{schema.json, README.md, examples/}    # 15 contracts
├── lib/                       # pure: reader, slots and locations, citations, render rules, char counter
│   ├── yaml.ts
│   └── vendor/yaml/           # yaml 2.9.1, byte-compared with the lockfile
└── tools/                     # build/v1: build.ts build | budget [--baseline] | cite [--write] | layout
installers/                    # composition root
├── install.sh, install.ps1, uninstall.sh, uninstall.ps1   # shims (DR-107)
├── core/
│   ├── main.ts, package.json (engines >=24 <25, imports), tsconfig.json
│   └── src/
│       ├── CompositionRoot.ts
│       └── modules/{manifests,sources,resolution,variables,rendering,wiring,state,commands,shared}/
│           └── {<Module>Module.ts, domain/, application/<use-case>/, infrastructure/, interface/}
└── legacy/                    # old bash and PowerShell installer + mapping.yaml (until phase 5 + one tag)
home/                          # core content (slot core): instructions, patterns, procedures, references,
                               # atlas, tracker, frameworks/agent-foundry, hooks, prompts, templates, efficiency-audit
adapters/{claude,codex,copilot}/fields.yaml
skills/<name>/{skill.yaml, body.md, references/}      # core-owned skill sources
agents/<name>/{agent.yaml, body.md}                   # core-owned agent sources (foundry, windows-software)
component.yaml                 # core's manifest (slot core)
components.yaml                # public default component list
tests/<tool>/{*.feature, tool.ts, fixtures/}, tests/support/
scripts/                       # check-docs.sh (check.sh after phase 8), hooks for the repo itself
docs/architecture.md
```

**Structure Decision**: modular monolith with four code tiers (DR-301, DR-302), the installer core feature-first with W2 wiring (DR-303), shared pure rules in `contracts/lib` (DR-304), the target root set of DR-308. Until phase 8 the content stays at today's paths; `docs/architecture.md` §3 maps each folder to its target.

## Spec and blueprint amendments for G3

The plan does not edit `spec.md` or `blueprint.md`. Each row is a change the roles asked for; V approves them with G3, and the Orchestrator applies them (spec amendments at the start of the phase they concern, per the spec's "Depth" rule).

| Id | Target | Amendment | Source record |
|---|---|---|---|
| S-1 | spec US4 and US12, FR-016, FR-039 | New ACs: `install` exits 10 with a "privileged changes" need listing every new or changed hook, MCP service, status line, route and skill or agent text, in full, with component and commit, and writes nothing; approval records the set's hash; session-start and post-merge hooks never change the privileged set | security M-01 |
| S-2 | spec AC-3.1, FR-020, FR-028 | `install` checks out the locked SHA; `install --update [<name>]` advances and prints the commit range; a locked tag resolving to another SHA exits 1 ("tag moved") | security M-02; conflict C-1 |
| S-3 | spec FR-019 | A source URL with a user-info part fails validation naming the component only; every report redacts user-info and token query parts | security M-07 |
| S-4 | spec AC-6.1, FR-025 | `set` refuses secret-like names and values; variables are public values | security M-08 |
| S-5 | spec AC-4.5, AC-2.1, AC-2.5, FR-048 neighbour | Suggested sources labelled "suggested by `<component>`, unverified", never a ready command; confirmation and approval need an interactive terminal, else exit 10; one core line: agents never run `add`, `use` or an approval from a NEEDS report without V's approval in chat | security M-11 |
| S-6 | spec Edge Cases, AC-7.5, AC-8.3 | "A hook for an agent that is not installed: `doctor` warns only" narrows to agents absent from the machine; `doctor` fails on a merged hook whose command does not resolve; `retired:` refuses to remove a compatibility link a merged hook command uses | security M-14; conflict C-2 |
| S-7 | spec AC-7.5 | New `doctor` fault: a symlink in a linked `path` source whose real path leaves the component root | security M-04 |
| S-8 | spec FR-004, FR-005 | Clarify: ids match `^[a-z0-9][a-z0-9-]{0,63}$`; path fields are relative with no `..`, drive letter, `\` or NUL | security M-03 |
| S-9 | spec AC-7.3 | Home, backups folder and backups are owner-only; `doctor` warns otherwise | security M-10 |
| S-10 | spec AC-12.3 | The merge touches only installer-owned `hooks` entries (and core's `statusLine`); an unparsable file exits 1 writing nothing; hash re-checked before rename | security M-09 |
| S-11 | spec Edge Cases | Concurrent runs: one home-wide lock; a second run waits or exits 1 naming the lock | security M-12 |
| S-12 | research (no spec change) | Tech-stack records the YAML parser limits for `yaml` 2.9.1 (unlisted need U-1) | security M-17 |
| D-1 | spec AC-7.6, FR-030 | `uninstall --restore` puts back every item in the newest `backup-manifest.json` the install replaced | devops A-D1 |
| D-2 | spec FR-035 | `installers/install.sh --legacy` (and `install.ps1 -Legacy`) kept through phase 5 plus one tag | devops A-D2 |
| D-3 | spec AC-7.3, FR-026 | Backups also cover V's two local files before `set`, `add` and `use` rewrite them | devops A-D3 |
| D-4 | spec FR-014 | The home also holds `store/`, `install.lock`, `install-state.pending.json` (journal) and `install-log.jsonl` | devops DR-202, security M-12, M-16; conflict C-16 |
| D-5 | spec AC-7.5 (warnings) | `doctor` also prints references to old agent-home paths found in agent config files, backup count and size, and degraded Windows links | devops P-5 |
| A-1 | spec AC-1.6, AC-9.1 | Baseline and zero target cover the whole agent-knowledge component: 123 lines in 73 files, not 109 in 67 | system-architecture §8, DR-404; Q8 |
| A-2 | spec AC-13.4, FR-040 | Add the 42 `{{AGENT_HOME}}` lines in 11 files of the two frameworks to the phase-6 conversion | system-architecture §8, DR-404; Q8 |
| A-3 | spec FR-001, AC-1.1 | Fourteen contracts become fifteen, adding `framework/v1` | system-architecture §8, DR-415; Q8 |
| A-4 | blueprint phases 3, 4, 5 | Minimal routes renderer into phase 3; per-entry skill and agent targets into phase 4; the 4 SDLC procedures move to agentic-sdlc in phase 4 | system-architecture §8, DR-405, DR-407, DR-408; Q8 |
| A-5 | blueprint contract table | The `slots/v1` row loses `count`; the `knowledge-provider/v1` row loses the "name no other component's path" rule (now a slot rule) and the `companies/<co>/` mount | system-architecture §8, DR-401, DR-404 |
| A-6 | spec FR-014 | Add the core locations (`instructions/`, `patterns/`, `procedures/`, `references/`, `atlas/`, `tracker/`, `frameworks/agent-foundry/`) and the `global-variables.md` link | system-architecture §8, DR-401 |
| P-1 | security record M-01 phase column | Consent for routes lands in phase 3, for skill and agent text in phase 4 (consequence of A-4) | conflict C-15 |
| P-2 | spec FR-044 wording | "Each consumer's validator" reads "each consumer's check, running the shared `build cite`" | system-architecture DR-411; conflict C-11 |
| P-3 | constitution "style deviations" | Record the lint-baseline exemption for legacy `.mjs` tools (if Q1 d is approved as default) | conflict C-14 |

## Questions for V at G3

At most 8, deduplicated across the five roles. Each has a default; replying `approve G3 R-001` accepts every default.

1. **Toolchain** (tech-stack Q1 to Q3, conflict C-14). (a) **Overridden by V (G3, 2026-11-13):** plain JavaScript with JSDoc instead of `.ts`. New runtime code is TypeScript run directly by Node type stripping. (b) **Overridden by V (G3, 2026-11-13):** a runtime floor older than the latest Node 24. The runtime is the latest Node 24 from 24.12, with no older-Node job. (c) keep JSON Schema files plus a hand-written reader with a parity test; (d) the stack's lint baseline applies to new code (`contracts/`, `installers/core/`), and the constitution records a style deviation for the legacy `.mjs` tools until each is touched. **Default: yes to c and d; a and b are V's override (N-1).**
2. **Consent model and accepted risks** (security AR-1, AR-2, AR-3). Approved hooks and MCP services run with your full rights, unsandboxed, with consent per change at an interactive terminal (M-01, M-11); doc content changes without consent; your username appears in rendered paths sent to model providers. **Default: accept all three, recorded as `Decided by: human`.**
3. **Updates stay on the lock** (security M-02, conflict C-1). `install` never moves a `git` source; `install --update [<name>]` advances it and shows the commit range and any privileged change. **Default: yes.**
4. **The guard when Node is missing** (security AR-4). Today the wrapper lets every tool call through when no Node ≥ 24.12 is found, against spec 019 D6. Keep that, or deny only inside folders that have `.specify/runs`? Security gave no default. **Default (architecture's proposal): deny only where `.specify/runs` exists, allow elsewhere.**
5. **Agent runs for the P4 checks** (QA). May one Claude Code session confirm P4-22 (the generated-from line after front matter) and the phase-7 skill-list figure, or do they stay on Codex and Copilot with cheap models? And will you do the by-hand items (trust the Codex hooks for P4-14 and P4-18; P4-19, P4-20, P4-26c in VS Code), and give the Codex binary path? **Default: no Claude Code run; you schedule the by-hand items before phase 5.**
6. **Rollback levers and Windows** (devops A-D1 to A-D3, DR-202). Add `uninstall --restore`, keep `install.sh --legacy` through phase 5 plus one tag, back up your two local files before `set`, `add`, `use`; accept that on Windows each link switch is remove-then-create (milliseconds, covered by the journal), not atomic. **Default: yes to all.**
7. **Human set-up steps** (devops). You create the annotated tag `pre-022` at `825ea82` before phase 0 merges; the three public repos (branch protection with required check `check`, secret scanning and push protection) before phases 3, 6 and 7; and you confirm GitHub's free runner minutes for public repos on the first one. **Default: yes, at those points.**
8. **Scope corrections from system-architecture** (DR-404, DR-405, DR-407, DR-408, DR-415). (a) The knowledge fitness baseline covers the two frameworks too (123 lines in 73 files) and phase 6 converts 42 more lines; (b) `framework/v1` becomes the fifteenth contract; (c) the phase content is reordered so providers ship first (routes renderer in phase 3; skill and agent targets and the SDLC procedures in phase 4). **Default: yes to all three.**

## Complexity Tracking

| Violation | Why needed | Simpler alternative rejected because |
|---|---|---|
| Two paths per fact for one release (compatibility links), against principle I | Open sessions, memories and hook commands name `~/.copilot/…` (DR-204, DR-417) | Switching in one step breaks them mid-move |
| Two forms of each contract (JSON Schema and the reader), a DP-6 risk | Editors and other repos need a neutral schema; the reader gives the custom messages FR-003 and FR-005 need (DR-103) | Reader alone gives no neutral contract; schema alone cannot give the messages |
| An extra folder in the home (`store/`) that FR-014 does not list | Immutable version trees make rollback a link repoint and keep read-only copies safe (DR-202) | Mutating in place changes the live version before checks run |
| Nine modules in a single-user CLI | MOD-9 requires feature-first above three feature areas; the installer has eight | Layer-first is allowed only up to three; pipeline-stage folders package by technical role (DR-303) |

## Unconfirmed, to check before the phase that needs it

Node 24.12 running `.ts` files without a flag, and the exact rules of type stripping (erasable syntax only, `.ts` specifiers, no stripping inside `node_modules`): the stack idioms record a check on Node 24.22 (2026-10-25), not on 24.12 itself (phase 0). `package.json` `imports` aliases resolving under `vitest`, under Cucumber step files and under plain `node` (TSN-15; phase 0). Cucumber `~13.3.0` loading `.ts` step files under type stripping (phase 0). The Windows PowerShell 5.1 shim finding Node 24.12 (phase 2). Windows: rename over a directory link, symbolic links on `windows-latest` runners, `fs.chmod` read-only, junctions without administrator rights, `os.homedir()` reading `USERPROFILE` (phases 0 and 2). Codex reading a linked `~/.codex/AGENTS.md` and `hooks.json`, and its session-start hook (P4-14, P4-18). Copilot CLI and Codex behaviour on a missing hook command (security §7; M-14 applies to all three until checked). VS Code relative-target clicks (P4-19, DR-307). The `yaml` 2.9.1 parser option names (U-1). Whether Claude Code accepts unknown keys inside hook entries (DR-413 avoids relying on it).

## References

**Local artifacts:**
- `specs/022-repo-split/research.md`: every decision record and the conflict table.
- `specs/022-repo-split/decisions/*.md`: the role records with full evidence.
- `docs/architecture.md`: the repo architecture this plan writes.
- `copilot/frameworks/agentic-sdlc/conventions.md` §5, §7, §10: phases, precedence, records.
- `copilot/frameworks/agentic-sdlc/foundations/design/module-boundaries.md`: MOD-9 to MOD-11.

**External authoritative sources:**
- [github/spec-kit](https://github.com/github/spec-kit): the plan template this file follows.
- [Node.js: running TypeScript natively](https://nodejs.org/api/typescript.html): type stripping rules behind the Language/Version row (to be re-read at the start of phase 0, see Unconfirmed).
- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks): exit-code behaviour behind T-13.
- [CVE-2024-32002](https://nvd.nist.gov/vuln/detail/CVE-2024-32002), [CVE-2025-48384](https://nvd.nist.gov/vuln/detail/CVE-2025-48384): the git floor in M-05.
- [Git `GIT_ALLOW_PROTOCOL`](https://git-scm.com/docs/git#Documentation/git.txt-codeGITALLOWPROTOCOLcode), [`core.fsmonitor`](https://git-scm.com/docs/git-config#Documentation/git-config.txt-corefsmonitor): M-05, M-06.
- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use): SHA pins (DR-206, M-19).
