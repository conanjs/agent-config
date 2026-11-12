---
schema: blueprint/v2
mission_type: new-feature
affected: [agent-config, agent-knowledge (new), agent-companies (new, private), agentic-sdlc (new)]
based_on: "none: agent-config has no docs/architecture.md yet; tree at main@825ea82"
approved_at: G0 2026-11-12
---

# Blueprint: agent-config as a motherboard of replaceable components (v3)

## Mission
V (2026-11-11): use the agentic SDLC to refactor agent-config. Every part is a replaceable component, like the cards in a computer: agent-config stays compact and talks to the others only through configuration files. Design the big-picture architecture first, with token and context cost as a first-class constraint. The knowledge base (KB) and the company KB each live in their own repo; the agentic SDLC framework gets its own repo; other frameworks split by stated principles. Skills and agents are optimized per platform (Claude Code, Copilot CLI / VS Code, Codex), replacing the "shared procedure + thin wrapper" practice.

v2 replaces v1 after V's G0 feedback (`changes G0 R-001`, 2026-11-11): v1 split repos first and kept thin wrappers; v2 defines the contracts first, adds the SDLC repo, and builds skills and agents from one source per platform. P1 was rerun with system-architecture.

v3 folds in the design decisions from V's G0 discussion on 2026-11-12: slots and slot names, component sources beyond git, the two component lists, per-component variables, the repo boundary rule, `provides.exports` in place of the path manifest, slot-based `depends` resolved recursively, the installer's exit codes and pipeline, and dropping the knowledge framework's "Used by" rule. V approved G0 (`approve G0 R-001`, ledger seq 5) and asked for these changes to be folded in ("changes G0 R-001 and approve it").

### Decisions from the G0 discussion
| Topic | Decision |
|---|---|
| Boundary | Each repo owns its files, checks and version. It publishes only `component.yaml`, `index.md` (content repos) and `provides.exports`; others use it only through those. No repo's checks read another repo's files |
| Slots | `contracts/slots.yaml` (`slots/v1`) defines the sockets: `knowledge-storage` (contract `knowledge-provider/v1`, count `0..1`), `company-knowledge-storage` (`company-kb/v1`, `0..n`), `framework` (`framework/v1`, `0..n`, per project). A component names its slot in its own `component.yaml`; the component lists never repeat it |
| Component lists | `components.yaml` (public, in agent-config): default components, name + source only. `~/.copilot/components.local.yaml` (never committed): extra components and source overrides, merged by name. Private sources (agent-companies) appear only in the local file |
| Sources | A source adapter per type, each with check, acquire and version: `git` (URL + ref; managed clone; lock holds the commit SHA), `path` (a local folder linked live; no copy, no rollback; `doctor` warns "not version-controlled"), `archive` (file or URL + sha256 checksum; later). A component only has to be a folder with a valid `component.yaml`; `init-component <path>` writes a starter one |
| Dependencies | `depends:` in `component.yaml` names a slot + contract (never a repo), the docs it cites, and runtimes (`node >=18`). The installer resolves recursively: a filled slot is reused, an empty one takes agent-config's slot default, otherwise it stops with NEEDS. Then it checks: no cycles, contract versions match, cited docs are exported, slot counts. It never fetches a source that only a component suggested without asking V |
| Exports | `provides.exports` in the provider's `component.yaml` lists the doc paths others may cite (41 today). Removing or renaming one is a major version. Each consumer's own validator checks its citations against it; the installer repeats the check across all installed components. This replaces the "path manifest" |
| "Used by" | Removed: the knowledge framework's rule and the backlink scan in `validate-knowledge.mjs` (which reads agentic-sdlc's files) go; the scan moves into each consumer's validator |
| Variables | Each variable is defined in the `component.yaml` of the component whose docs use it: `AGENT_HOME`, `AGENT_CONFIG_REPO`, `LANGUAGE` in agent-config; `REFERENCE_REPOS_ROOT` in agentic-sdlc; `OTS_REPOS_ROOT` in agent-companies; none in the KB. Values live in `~/.copilot/variables.local.yaml`; the installer renders a compact `~/.copilot/global-variables.md` at today's path. The core keeps one line defining `{{AGENT_HOME}}` |
| KB paths | The KB's 20 `{{AGENT_HOME}}` lines (10 files) become relative links (9 point inside the KB) or plain words (11 point at frameworks, companies, patterns, variables); a check forbids new ones |
| Installer | A Node core behind `install.sh` / `install.ps1`; pipeline read → resolve → plan (pure) → apply → report. Exit 0 done, 10 needs input (with a NEEDS report and nothing changed), 1 failed; `--json`. Two NEEDS stops in order: components (sources), then variables. Commands: `install`, `set NAME=value`, `add`, `use`, `init-component`, `plan`, `doctor`, `uninstall`. Acquire into staging; switch only after every check passes; reruns are idempotent |
| pnpm | Used inside each repo for its own dev tooling only; components are never installed through pnpm (it resolves by package name, not by slot) |

## Proposals
| Area | Proposal | Confidence | Tree path | Role |
|---|---|---|---|---|
| Scope | Goals G1–G10 below. Non-goals: no change to KB content or schemas, no retrofit of legacy docs, no MCP server for the KB, no router agent in front of prompts, no multi-user publishing, no change to installed paths | medium | SCOPE | product-spec (run 1), revised from V's G0 feedback |
| Architecture | **Contracts first.** agent-config is the motherboard, in two parts: **contracts/** (schemas, build tool, adapters, layout validator; tagged on its own) and the **composition root** (installer, `components.yaml` + lock, renderer). Components plug into typed **slots**; only the composition root names a provider | medium | DDD-4, AP-Q2 | system-architecture |
| Architecture | **Four repos**, by the split test below: `agent-config` (public), `agent-knowledge` (public: KB content, knowledge framework, company-KB framework, validators, export list), `agent-companies` (private: company KB instances, routes, company variables, deny-list), `agentic-sdlc` (public: framework and the sources of its skills, agents and hooks; on per project). agent-foundry, atlas, tracker, hooks stay | medium | AP-Q2 | architecture (run 1), system-architecture |
| Architecture | **Skills and agents are built, not hand-wrapped.** One source per skill and per agent, per-platform overlays, adapter `fields.yaml`, build-time `{{include:}}`. Procedures become skills or `references/` files; thin wrappers retire. Needs a MAJOR amendment of constitution principle I in phase 0 ("one source, generated per platform") | high | — | system-architecture |
| Architecture | Layout without leading dots: `home/` (core), `skills/`, `agents/`, `adapters/claude|codex|copilot/`, `build/<target>/`, `installers/`, `components.yaml`. Every deployed path stays the same | medium | AP-Q2; MOD-2, CON-9, CON-12 | architecture (run 1) |
| Versioning | Pin contract majors only (`name/vN`, conventions §13). The motherboard reads the current and the previous major. A bump rolls out in 3 steps: new reader, migrate each component (one PR each), drop the old major when `doctor` shows no enabled component needs it. Content repos follow `main`, recorded with SHAs in `components.lock`; agentic-sdlc pins a tag | high | CC-Q1→CC-Q2→CC-Q3 | system-architecture |
| Cycles | Acyclic after phase 1 only when the knowledge base's 108 mentions of agentic-sdlc (67 files, most in References sections) are removed together with the "Used by" rule; the atlas, which belongs to the motherboard, may compute "cited by" across installed components. Fitness check: 0 mentions of `agentic-sdlc` in the knowledge area. Forbidden edges: knowledge → agentic-sdlc, knowledge → companies, contracts → any component; the resolver fails on any cycle | high | FF-2 | system-architecture |
| Integrations | Thirteen contracts, listed below with owner, consumers, versioning and failure mode | medium | — | system-architecture |
| Token budget | Idle cost counted in **characters** per install target (Claude Code and Codex budget skill lists in characters); the build measures it, the declared number is a ceiling; the installer and `doctor` check the total of all enabled components | medium | FF-14 | system-architecture |
| Test depth | Each repo keeps its own `scripts/check.sh` and required CI check; build freshness check (like the atlas map-freshness check); per-platform field check; per-component and total budget checks; installer scenarios for `components.yaml`, lock, render, `doctor`, `retired:` | medium | — (qa at P4) | architecture (run 1), system-architecture |
| Security tier | Not consulted at P1. Findings to carry: `conanjs/agent-config` is public and has held company content since its first commit; `global-variables.md` holds the `{{OTS_REPOS_ROOT}}` row | — | — (security at P4) | architecture (run 1), system-architecture |
| Deploy impact | Every phase ends with install + `doctor` on Mac and Windows; old targets backed up to `~/.agent-config-backups/<timestamp>/`; updates are atomic (fetch, validate, switch; the previous SHA stays linked on failure) | medium | — (devops at P4) | system-architecture |

### Goals
| Id | Goal | Measure: today → target |
|---|---|---|
| G1 | The KB is its own repo with its validator, schemas and tests | Its `check.sh` passes with no agent-config checkout |
| G2 | Every agent still reads each layer at the same path | `~/.copilot/knowledge/index.md` and `~/.copilot/companies/<co>/index.md` resolve after install |
| G3 | A new platform is one new adapter folder | Files edited outside `adapters/<name>/`: today ≥ 3 → 0 |
| G4 | The always-loaded block does not grow, and shrinks where a component is scoped per project | Per-agent baseline recorded in phase 0 (Claude Code skill list 9,900 tokens; `sdlc-*` 824 of them) → ≤ baseline everywhere, minus the `sdlc-*` share outside SDLC projects |
| G5 | One install command per machine, Mac and Windows | Same steps as today |
| G6 | No company name or host in any public repo's current tree | Deny-list search over public repos: 0 hits; company routes and variables come only from the private repo |
| G7 | agent-config's root holds only motherboard parts | Root entries today 25 plus `copilot/` with 11 subfolders; target set at P4 |
| G8 | Swapping a provider changes no core line | Replacing `agent-knowledge` in `components.yaml` edits 0 lines of `home/instructions/` |
| G9 | No hand-written per-platform wrapper | Agent files: 12 agents × 3 hand-written = 36 → 12 sources; skill bodies that only point at a procedure → 0 |
| G10 | Every component declares and stays within its idle cost | `idle-cost` (characters per target) in each `component.yaml`; per-component and total checks |
| G11 | A component can come from git or a local folder | Install and `doctor` pass with each non-core component given as a `git` source and as a `path` source |
| G12 | Each repo's checks run inside its own boundary | Checks that read another repo's files: today ≥ 2 ("Used by" backlink scan, deny-list) → 0 |

### Split test (what gets its own repo)
From the component principles in Robert C. Martin, *Clean Architecture* ch. 13–14: REP (Reuse/Release Equivalence), CCP (Common Closure), CRP (Common Reuse), ADP (Acyclic Dependencies). A part gets its own repo when (1) its readers differ (privacy alone is enough), or all of: (2) it has a user other than agent-config, (3) its own checks pass alone, (4) no dependency cycle with the rest.

| Part | Verdict | Reason |
|---|---|---|
| Company KB instances | Split, private, first | (1) |
| KB + knowledge framework + company-KB framework | Split → `agent-knowledge` | (2) every agent and project; company repos need only its schemas (CRP); cycle with agentic-sdlc cut first (4) |
| agentic-sdlc | Split → `agentic-sdlc` | (2) project repos; per-project scope removes its 824 tokens elsewhere |
| agent-foundry | Stays for now | Same kind as agentic-sdlc but 2 commits since 2026-08-01 and no outside user; split when a team repo installs it |
| contracts/ | Stays, tagged on its own | A 5th repo only if something uses the contracts without the installer |
| atlas, tracker, installer, adapters, hooks | Stay | They are the motherboard |

### Context map (system-architecture; A → B means A depends on B)
```
agent-config/composition root ──(by name, only in components.yaml + lock)──▶ each component
each component ──[Conformist, pinned @major]──▶ agent-config/contracts
agentic-sdlc ──[Customer/Supplier: depends on slot knowledge-storage; citations ∈ provides.exports]──▶ agent-knowledge
agent-companies ──[Customer/Supplier: depends on slot knowledge-storage; citations ∈ provides.exports]──▶ agent-knowledge
agent-companies ──[Conformist: company-kb/v1 schema + validator]──▶ agent-knowledge
agent-companies ──(read-only privacy audit)──▶ every public repo
```

### Contracts
| Contract | Owner → consumers | Rule | Missing or stale on a machine |
|---|---|---|---|
| `slots/v1` | agent-config → installer, doctor | Slot name, contract, count (`0..1`, `0..n`), scope; the slot default provider comes from `components.yaml` | Unknown slot in a component: that component is skipped |
| `component/v1` | agent-config → installer, build, atlas, doctor | `name`, `version`, `slot`, `provides` (contract, `index`, `exports`), `depends` (slot + contract major, cited `docs`, `runtime`), `mounts` (shared folders linked per entry), `routes`, `hooks`, `variables`, `scope` (`global`/`per-project`), `idle-cost` (characters per target). Unknown keys warn (tolerant reader, CON-10); an unsupported slot or major skips that component only | Manifest missing: component skipped, `doctor` fails; core still works |
| `components.yaml` + `components.lock` + `~/.copilot/components.local.yaml` | agent-config → installer, doctor | Name + source only (`git` URL + ref, `path`, later `archive`); local entries add components or override a default's source by name, and are written only by the installer's `add` / `use` commands or by V; the lock records the version per source type (commit SHA, `live`, sha256 checksum) | Acquire or validation fails: previous version stays linked; a missing `path` source fails `doctor` and leaves old links alone |
| `knowledge-provider/v1` | agent-config defines; agent-knowledge, agent-companies provide | Mount at `{{AGENT_HOME}}/knowledge/` or `{{AGENT_HOME}}/companies/<co>/`; `index.md` at the root is the only entry point and describes the storage's own architecture; links inside are relative and name no other component's path; `provides.exports` lists the citable docs; `scripts/check.sh` passes; a moved exported doc leaves a stub for one release (CON-12). The core says only: "installed knowledge layers and when to read each are listed in routes; read a layer's `index.md` before its docs" | Missing: no route, the layer is skipped; `doctor` lists citations that no longer resolve |
| `company-kb/v1` | agent-knowledge → agent-companies | Schema and validator for company instances | — |
| Generated routes | agent-config renderer, from each component's `routes` | Copilot: `~/.copilot/instructions/routes.instructions.md` with `applyTo: "**"` (no default pattern); Claude Code: one `@~/…` import in `~/.claude/CLAUDE.md`; Codex: `~/.codex/AGENTS.md` rendered as core + routes, checked against its 32 KiB limit. Rendered at install, never committed | Codex keeps stale core text until re-rendered: `doctor` compares a hash; a post-merge hook re-renders |
| `skill-source/v1` | agent-config → every skill provider | `skill.yaml` (standard fields, `metadata` for custom data, `platforms:` overlays) + `body.md` + `references/`; cascade common < adapter defaults < overlay. **One build target per discovery folder:** `claude` → `~/.claude/skills`; `agents` → `~/.agents/skills` (read by Copilot CLI, VS Code and Codex), linked per entry so claude.ai-synced skills stay out of Copilot and Codex | Same skill name from two components: install fails for the second |
| `agent-source/v1` | agent-config → agentic-sdlc, later agent-foundry | Intent fields mapped per adapter: `auto-delegate: false` → Copilot CLI `infer: false`, VS Code `disable-model-invocation`; `needs-project-instructions` → `include-custom-instructions: true`; `preload` → Claude `skills:` or an include in the Codex body; Codex cannot restrict tools in an agent file, so the build warns | Description budgets: Claude Code warns above 15,000 tokens |
| Adapter `fields.yaml` | agent-config → build | Each field with `source` (official doc URL, never a KB path), `verified`, `enforced`; a removed field is an adapter major bump | Stale date warns |
| Build and checks | tool in agent-config → every provider | Each provider runs the pinned `build@major` in its own CI and commits `build/<target>/`, stamped with source SHA and adapter version; freshness and per-component budget per repo; total budget at install and in `doctor` | Stamp/adapter major mismatch: `doctor` fails, previous output stays linked |
| `repo-layout/v1` | agent-config validator → every repo | `README.md` (humans), `component.yaml`, `index.md` (content repos), `atlas.yaml` fragment, `INTERFACES.md` + `catalog-info.yaml` (CON-15), `CHANGELOG.md`, `AGENTS.md`, `tools/ tests/ scripts/check.sh` | Repo CI fails |
| Hooks | agent-config renderer | Hooks are component entries merged at install, because Claude's `settings.json` is written once and Codex has one `hooks.json` | Missing: `doctor` warns |
| Variables | agent-config → all | Each component defines the variables its own docs use (description, optional `detect` rule); values in `~/.copilot/variables.local.yaml`; the installer renders `~/.copilot/global-variables.md`; `{{OTS_REPOS_ROOT}}` moves to agent-companies, `{{REFERENCE_REPOS_ROOT}}` to agentic-sdlc | Unresolved: install exits 10 with NEEDS and changes nothing; `doctor` fails |

### Dependency facts behind the proposal (measured 2026-11-11)
| Edge | Evidence | Size |
|---|---|---|
| agentic-sdlc → knowledge | Source and Reference-topic cells; `validate.mjs` hard-codes `copilot/knowledge` | 91 cells in 31 files |
| knowledge → agentic-sdlc (cycle) | Mentions in the knowledge area, mostly References sections ("cites this doc as DP-6"), plus 57 hand-written Used-by rows | 109 lines in 67 files (grep, orchestrator check) |
| knowledge → companies | The deny-list check reads `companies/*/repos` | 1 tool edge |
| agentic-sdlc → adapters (inverted) | `validate.mjs` hard-codes `copilot/agents`, `claude/agents`, `codex/agents`, `skills/` | tool |
| adapters → deployed hooks | `$HOME/.copilot/...` hook commands in `claude/settings.json` (seed-once), `codex/hooks.json`, `copilot/hooks/*.json` | deployed-path contract |
| Hand-written wrappers | 12 agents × 3 platform files whose bodies point at a charter; constitution principle I mandates thin wrappers | 36 agent files |
| Company data in public files | `global-variables.md` row `{{OTS_REPOS_ROOT}}`; company repo names in `core.instructions.md`; `copilot/companies/ots` | 3 places |
| Node on every machine | `copilot/tracker/tracker-hook.sh` already requires Node 18 or later | not a new requirement |
| Change coupling | 152 commits since 2026-08-01: knowledge in 73, 26 of them also touch agentic-sdlc; companies in 6; agent-foundry in 2 | git log |

Why no leading dots on adapter folders: this repo's own `.claude/` is its project config, Codex reads `.agents/skills` in parent folders, and whether Claude Code discovers nested `.claude/skills` is unconfirmed; ripgrep 14.1.1 also skips hidden folders by default, so agents searching the repo would miss the sources.

### Phases (one PR each; checks green before and after; install + doctor on Mac and Windows)
0. **Contracts and fitness (nothing moves):** contract schemas, including `slots/v1`, `component/v1` with `provides.exports` and `depends`, and both component-list schemas; constitution I amended (MAJOR); `atlas.yaml` components and allowed edges; per-agent start-up baseline (G4); privacy audit (G6).
1. **Cut the cycles:** `validate.mjs --knowledge <root> --adapters <map>`, `validate-knowledge --deny-list <file>`; the "Used by" rule and its backlink scan removed, the citation check moved into agentic-sdlc's validator; the 109 knowledge mentions removed; fitness check on.
2. **Minimal installer:** Node core and pipeline; both component lists; `git` and `path` source adapters; `component.yaml` reader; recursive `depends` resolve; the two NEEDS stops and exit codes; `set`, `add`, `use`, `init-component`; lock; per-entry mounts; rendered `global-variables.md`; `doctor`, `retired:`.
3. **Company KB → `agent-companies`** (private; `git filter-repo` keeps its history); company repo names, `{{OTS_REPOS_ROOT}}` and the deny-list move with it. Done early because every public commit widens the exposure, and company content has no skills or agents to build.
4. **Build step:** skill and agent sources, adapter `fields.yaml`, `build/<target>/`, freshness and budget checks; migrate the 12 agents and the wrapper skills; procedures become skills or `references/`.
5. **Installer, full:** generated routes per platform, the 2 skill targets, merged hooks, total budget.
6. **KB → `agent-knowledge`** with `provides.exports`; its 20 `{{AGENT_HOME}}` lines become relative links or plain words; amend constitution III and review-docs, which name `copilot/knowledge`. Before the move, the KB can already be a component through a `path` source pointing at `copilot/knowledge`.
7. **agentic-sdlc → `agentic-sdlc`**, tagged, enabled per project.
8. **Layout:** remaining content into `home/`, `adapters/`; only mapping sources change.

## System impact
> _Multi-repo outcome: the context map and contracts above come from system-architecture at the P1 rerun; P4 confirms them with devops and security. No Company KB system catalog covers these repos, so the run stays on the new-feature path._

## Assumptions
- V stays the only maintainer and user; no outside consumer pins any of these repos.
- Deployed paths under `~/.copilot`, `~/.claude`, `~/.codex` and `~/.agents` are the public interface and do not change; `{{AGENT_HOME}}` stays `~/.copilot`.
- `agent-companies` is private; the connection works the same for public and private repos (the installer clones with V's credentials).
- Content repos follow `main` with a lock file; agentic-sdlc pins a tag (system-architecture default).
- Built output is committed per provider repo; machine-dependent output (routes, Codex `AGENTS.md`, merged hooks) is rendered at install (resolves v2 draft open question 2).
- Characters are the budget unit; tokens are shown only as an estimate.
- Unconfirmed, to check at P4 on Copilot CLI and Codex with a cheap model: Codex accepting Copilot-only skill fields (decides whether 2 skill targets are enough); Copilot CLI applying `applyTo` to user instructions as VS Code does; VS Code's Local harness reads its user profile, not `~/.copilot`, so it gets neither core nor routes today; whether a skill with `disable-model-invocation` costs nothing in Copilot's list.
- `docs/architecture.md` does not exist; P4 writes it.
- Repo names: The slot is `knowledge-storage`; the repo that fills it on V's machine may keep the working name `agent-knowledge` or take the slot's name. decided at P3; nothing in the contracts depends on it.

## Open questions
1. **Company content already public.** `copilot/companies/ots` (22 files), the company repo names in `core.instructions.md` and `{{OTS_REPOS_ROOT}}` in `global-variables.md` are in the public history. Default: move them private, no history rewrite; one private repo for all companies.
2. **Constitution principle I, MAJOR amendment.** Today it says agent-specific files are thin wrappers. Default: amend it in phase 0 to "one source, generated per platform".
3. **How agentic-sdlc is enabled per project.** Default: links in the project's `.claude/` and `.agents/` folders, kept out of git through `.git/info/exclude`; the alternative commits generated copies so a team sees them. Whether VS Code's Copilot harness reads project skills outside `.github/skills` is unconfirmed.
