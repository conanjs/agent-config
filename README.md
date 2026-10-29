# agent-config

A dotfiles-style repo for global AI-coding-agent configuration (Claude Code, GitHub Copilot CLI, OpenAI Codex CLI, and future agents) — single source of truth, symlinked into place per machine instead of copy-pasted by hand.

## Where to go

| If you want to... | Go to |
|---|---|
| Find anything: where a file is, what checks it, what links to it, where a task starts | [`copilot/atlas/index.md`](copilot/atlas/index.md) (the map of every file), or ask the `sdlc-coordinator` agent (Claude Code: `@agent-sdlc-coordinator where is …`, or a whole session with `claude --agent sdlc-coordinator`; see [Claude Code subagents](https://code.claude.com/docs/en/sub-agents)); one file: `node copilot/atlas/tools/atlas.mjs --explain <path>` |
| Set this repo up on a new machine | [`SETUP.md`](SETUP.md) |
| Reuse a design technique before improvising a one-off | [`copilot/patterns/index.md`](copilot/patterns/index.md) |
| Understand or extend the Company KB Framework | [`copilot/frameworks/company-kb/index.md`](copilot/frameworks/company-kb/index.md) |
| Write or check a global knowledge doc (schemas, deep dives, validator) | [`copilot/frameworks/knowledge/index.md`](copilot/frameworks/knowledge/index.md) |
| Work inside a specific company's KB (e.g. OTS) | [`copilot/companies/ots/index.md`](copilot/companies/ots/index.md) |
| Bootstrap Spec-Driven Development (Spec Kit) in a project | [`copilot/procedures/spec-driven-development.procedure.md`](copilot/procedures/spec-driven-development.procedure.md) |
| Review a knowledge doc or procedure before committing (validators + the checks they can't do) | [`copilot/procedures/review-docs.procedure.md`](copilot/procedures/review-docs.procedure.md); enable the automatic checks with `git config core.hooksPath .githooks` (see `SETUP.md` step 10) |
| Change a validator, installer or script in this repo (spec first, then its Cucumber scenarios) | [`.specify/memory/constitution.md`](.specify/memory/constitution.md) principle IV, [`specs/`](specs/) (one folder per change), [`tests/`](tests/) (one feature file per tool); `pnpm install` once, then `pnpm test` |
| Add standard GitHub repo governance to a repo | [`copilot/procedures/init-github-governance.procedure.md`](copilot/procedures/init-github-governance.procedure.md) |
| Install/update the eight Windows apps after a restart | Select `/agent windows-software`, then send `run`; see [`copilot/agents/windows-software.agent.md`](copilot/agents/windows-software.agent.md). Installers stay in Downloads; nvm, Notepad++, Git, and WinRAR go under `D:\win11 software`. |
| Look up a path/preference variable (`{{AGENT_HOME}}` etc.) | [`global-variables.md`](global-variables.md) |
| See exactly what gets installed where | [`mapping.yaml`](mapping.yaml), and "What's included" below |

This file (`README.md`) is the general reference for everything else — structure, install mechanics, what's excluded and why.

## How it works

`copilot/` and `claude/` mirror the *real*, non-ephemeral parts of `~/.copilot` and `~/.claude` (on Windows: `%USERPROFILE%\.copilot` and `%USERPROFILE%\.claude` — same relative layout, verified in both products' own docs, see References). `mapping.yaml` is the **one** source/destination routing table both platforms read — bash and PowerShell each have their own installer logic, but neither hardcodes a path; both just interpret the same file.

```
agent-config/
├── SETUP.md                        # onboarding task list for a new machine — start here
├── mapping.yaml                    # source -> destination routing table (shared by every OS)
├── global-variables.md             # shipped template for {{AGENT_HOME}}/{{AGENT_CONFIG_REPO}}/{{LANGUAGE}} etc.
├── installers/                     # every installer/uninstaller, grouped by OS
│   ├── install.sh / uninstall.sh       # macOS/Linux entrypoints (bash) — dispatch by OS
│   ├── install.ps1 / uninstall.ps1     # Windows entrypoint (PowerShell)
│   ├── macos/install.sh                # macOS-specific implementation
│   ├── linux/install.sh                # Linux-specific implementation (stub)
│   └── lib/
│       ├── os.sh, link-or-copy.sh      # bash: OS detection + symlink/seed logic
│       └── link-or-copy.ps1            # PowerShell: symlink/seed logic + Windows fallbacks
├── copilot/                        # -> ~/.copilot/* (or %USERPROFILE%\.copilot on Windows)
│   ├── instructions/                   # incl. personal-defaults.instructions.md
│   ├── knowledge/                      # cross-project knowledge base (general-purpose content, kept here for naming consistency — see note below)
│   ├── companies/                      # per-company knowledge base INSTANCES (content only — e.g. companies/ots/)
│   ├── frameworks/                     # framework DEFINITIONS — shared, not per-company (one subfolder per framework)
│   │   ├── company-kb/                     # per-company knowledge base framework
│   │   │   ├── index.md                        # start here: concise overview of this folder
│   │   │   ├── conventions.md
│   │   │   └── schemas/                        # one <type>.schema.md per document type
│   │   ├── knowledge/                      # knowledge framework for copilot/knowledge/ (store B)
│   │   │   ├── index.md                        # start here
│   │   │   ├── schemas/                        # knowledge-doc, deep-dive, topic-index
│   │   │   └── tools/validate-knowledge.mjs
│   │   └── agentic-sdlc/                   # hierarchical multi-agent, spec-driven engineering framework
│   │       ├── index.md                        # start here
│   │       ├── conventions.md, schemas/, agents/ (role definitions)
│   │       ├── foundations/                    # preset knowledge by subject: code/, design/, quality/, delivery/, review/
│   │       ├── trees/, stacks/<id>/, paradigms/ # decision trees; stack + paradigm profiles
│   │       └── tools/validate.mjs              # framework validator (node, no deps)
│   ├── procedures/                     # one <name>.procedure.md per recurring task — grouped by artifact type, not by which framework it's about
│   │   ├── init-repo-kb.procedure.md
│   │   ├── spec-driven-development.procedure.md    # bootstrap GitHub Spec Kit in a project
│   │   ├── init-github-governance.procedure.md     # add standard GitHub lifecycle/contribution files
│   │   ├── bootstrap-agentic-sdlc.procedure.md     # adopt agentic-sdlc in one project repo
│   │   └── init-system-workspace.procedure.md      # Company KB system/ docs + standard clone layout for a multi-repo system
│   ├── patterns/                       # reusable design techniques, globally available (not agent-config-specific)
│   │   ├── index.md                        # catalog — start here for pattern #4+
│   │   ├── shared-procedure-thin-wrapper.pattern.md
│   │   ├── backup-before-overwrite.pattern.md
│   │   └── explaining-mechanisms.pattern.md
│   ├── prompts/                        # Copilot slash-command prompts (thin wrappers, see patterns/)
│   └── agents/, hooks/                 # genuinely Copilot-CLI-specific features
├── claude/                         # -> ~/.claude/* (or %USERPROFILE%\.claude on Windows), incl. agents/ (sdlc-* role wrappers)
├── codex/AGENTS.md                 # -> ~/.codex/AGENTS.md (or %USERPROFILE%\.codex on Windows)
├── codex/agents/                   # -> ~/.codex/agents (sdlc-* role wrappers, TOML)
├── skills/                         # -> ~/.claude/skills AND ~/.agents/skills (Copilot + Codex) — tool-neutral SKILL.md
├── .specify/, specs/               # NOT deployed — Spec Kit for this repo: constitution + one spec folder per change
├── tests/                          # NOT deployed — Cucumber scenarios for every validator and installer (one folder per tool)
├── package.json, cucumber.mjs      # NOT deployed — test dependencies only (pnpm install)
└── templates/github-repo/          # NOT deployed via mapping.yaml — copied into OTHER repos on demand by
                                     # init-github-governance.procedure.md, not into ~/.copilot at all
    ├── CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, CODEOWNERS
    └── .github/ISSUE_TEMPLATE/*.md, .github/PULL_REQUEST_TEMPLATE.md
```

**A naming note, since this moved twice during design:** `knowledge/`, `companies/`, and `frameworks/company-kb/` aren't actually Copilot-specific — no tool reads them automatically, they only work because an instructions file tells an agent to go read a path there. They briefly lived at the repo's top level for that reason. They're under `copilot/` because the user wants to be able to say "global Copilot knowledge" in conversation and have that phrase map directly onto both the folder name and the concept (see `personal-defaults.instructions.md`'s term-recognition rules). Functionally this changes nothing — the deployed destination has always been `~/.copilot/knowledge` (and now `~/.copilot/frameworks/company-kb`) either way, since `mapping.yaml`'s `source` (repo-internal) and `target` (disk destination) are independent of each other.

## Doc guards

Four layers keep knowledge docs, procedures and the agentic-sdlc framework from drifting or degrading. The technique is written up as `copilot/patterns/layered-guards.pattern.md`.

| Layer | Catches | Runs | Files |
|---|---|---|---|
| 1. Wiring | any validator failure | Claude Code after every edit here (`.claude/settings.json`); git pre-commit (enable once per clone: `git config core.hooksPath .githooks`); CI on every push/PR, **required to merge into `main`** (branch protection check `validate-docs`) | `scripts/check-docs.sh`, `scripts/claude-doc-hook.sh`, `.githooks/pre-commit`, `.github/workflows/validate-docs.yml` |
| 2. Mechanical checks | shape: unknown front-matter keys, malformed Verification status, copied blocks, repeated paragraphs, chat leftovers (warn) | inside the validators; each validator's own behavior is pinned by Cucumber scenarios in `tests/` (TST-14) | `copilot/frameworks/knowledge/tools/validate-knowledge.mjs`, `copilot/frameworks/agentic-sdlc/tools/validate.mjs`, `copilot/frameworks/agent-foundry/tools/validate-foundry.mjs`, `tests/<tool>/<tool>.feature` |
| 3. Judgment review | meaning: doc stands alone, sections do their job, claims sourced, tool facts current, nothing erased | before committing, by procedure (required by `personal-defaults.instructions.md`; `review-docs` skill) | `copilot/procedures/review-docs.procedure.md`, `skills/review-docs/SKILL.md` |
| 4. Freshness | staleness: procedures record the version of each outside tool they describe; warns when unverified, > 90 days old, or behind upstream | validator on every run; upstream check weekly in CI | `copilot/procedures/procedure.schema.md`, `copilot/procedures/tools/validate-procedures.mjs` |

Run everything locally: `pnpm install` once, then `scripts/check-docs.sh` (finds Node.js 24 itself, the version in `.nvmrc`; the validators alone need ≥ 18). Rules: `copilot/frameworks/knowledge/schemas/_system.md` (KB-1 … KB-8), `knowledge-doc.schema.md` (KD-1 … KD-9), `procedure.schema.md` (PR-1 … PR-6).

## Path & preference variables

Docs across this repo and the deployed knowledge base reference `{{AGENT_HOME}}`, `{{AGENT_CONFIG_REPO}}`, `{{LANGUAGE}}`, and per-company variables like `{{OTS_REPOS_ROOT}}` instead of hardcoding literal paths. All of these are defined in exactly one place: `global-variables.md` (shipped template here in the repo; deployed to `~/.copilot/global-variables.md` via the `seed-once` strategy, so a machine's filled-in values are never clobbered by a later `git pull`). `personal-defaults.instructions.md` — the one file always loaded by both Claude Code and Copilot CLI — points at it, so any agent reading a `{{VAR}}` placeholder knows where to resolve it.

Why not just keep hardcoding `~/.copilot/knowledge/...` everywhere? Mostly future-proofing: if that live path is ever renamed (see "Related" below), there's one line to edit instead of 23. It does **not** fix a live problem today — agents already translate `~/.copilot/...` to `%USERPROFILE%\.copilot\...` on Windows correctly on their own.

## Company KB Framework

A reusable pattern for a per-company knowledge base — split into a shared *definition* (`copilot/frameworks/company-kb/`) and one *instance* per company (`copilot/companies/<company>/`), so a second company can be onboarded later without copying the schema system. **Full explanation, structure, and how to bootstrap a new repo's KB entry: [`copilot/frameworks/company-kb/index.md`](copilot/frameworks/company-kb/index.md)** — not restated here.

OTS is the current worked instance: [`copilot/companies/ots/index.md`](copilot/companies/ots/index.md). `personal-defaults.instructions.md` is what tells an agent this framework exists in the first place — without that pointer, the framework existing on disk doesn't mean an agent knows to look for it.

## Usage

**macOS / Linux:**
```bash
./installers/install.sh       # detects OS, applies mapping.yaml
./installers/uninstall.sh      # removes the symlinks it created (seed-once files are left alone)
```

**Windows (PowerShell):**
```powershell
.\installers\install.ps1       # applies mapping.yaml
.\installers\uninstall.ps1      # removes the links it created (seed-once files are left alone)
```

You only ever run **one** of `install.sh` / `install.ps1` on a given machine — whichever matches the OS you're currently on. They're not alternatives for the same OS; bash can't execute PowerShell syntax and vice versa. Each file also says so in its own header comment now.

Existing real content at a destination path is backed up before a link replaces it — nothing is deleted outright. All backups from one install run land in a single folder, `~/.agent-config-backups/<timestamp>/`, mirroring each entry's `mapping.yaml` source path (e.g. a pre-existing `~/.claude/CLAUDE.md` backs up to `~/.agent-config-backups/<timestamp>/claude/CLAUDE.md`) — not scattered `path.backup-<timestamp>` siblings next to each real path. The folder is only created if something actually needs backing up; a clean run creates nothing. One source can map to several targets (`skills/` does); if more than one of them needs backing up in the same run, later backups get a `.2`, `.3`… suffix instead of overwriting the first.

## What's included

| Path | What it is |
|---|---|
| `copilot/instructions/` | Global Copilot instruction files (incl. `personal-defaults.instructions.md`, loaded by `~/.claude/CLAUDE.md` too) |
| `copilot/knowledge/` | The cross-project knowledge base (ai-agents, analytics, documentation, gcp, grpc, etc.) |
| `copilot/frameworks/company-kb/` | The **Company KB Framework** definition (conventions, schemas, procedures) — shared, not tied to any one company. Start at its own [`index.md`](copilot/frameworks/company-kb/index.md). |
| `copilot/frameworks/knowledge/` | The **Knowledge Framework** for `copilot/knowledge/` (store B): doc schemas (`knowledge-doc`, `deep-dive`, `topic-index`) and `tools/validate-knowledge.mjs`. New docs only; legacy docs are never retrofitted. |
| `copilot/companies/ots/` | The **OTS Knowledge Base** — the current instance of the framework above: schema-typed docs (flow/feature/repo-overview/domain/infra/api-surface) so an agent can navigate a multi-repo system without full codebase exploration. Start at [`index.md`](copilot/companies/ots/index.md). |
| `copilot/frameworks/agentic-sdlc/` | The **Agentic SDLC Framework**: an Orchestrator plus department roles that run projects through Spec Kit phases using decision trees, per-language stack profiles and swappable paradigms. Start at its [`index.md`](copilot/frameworks/agentic-sdlc/index.md); design rationale in [`proposals/agentic-sdlc-architecture.md`](proposals/agentic-sdlc-architecture.md). |
| `copilot/frameworks/agent-foundry/` | The **Agent Foundry** (alias: Charter), v0.1 draft: builds scoped, learning agents from a Charter, a decision flow (`trees/`), a Resolver, non-waivable floors and a team Lens. First agent: `pr-reviewer`. Start at its [`index.md`](copilot/frameworks/agent-foundry/index.md); check with `node copilot/frameworks/agent-foundry/tools/validate-foundry.mjs` |
| `copilot/agents/` | Custom agent definitions (incl. `sdlc-*.agent.md` wrappers for agentic-sdlc roles) |
| `claude/agents/`, `codex/agents/` | `sdlc-*` role wrappers for Claude Code (markdown) and Codex (TOML) — each only points at `copilot/frameworks/agentic-sdlc/agents/<role>.md` |
| `skills/` | Tool-neutral Agent Skills (`SKILL.md`): the `agentic-sdlc` entry point, `sdlc-<role>-preset` role presets, and the `sdlc-stack-<id>` / `sdlc-paradigm-<id>` profiles. Linked to `~/.claude/skills` (Claude Code) and `~/.agents/skills` (read by both Copilot and Codex). |
| `copilot/prompts/` | Copilot slash-command prompts — currently `init-repo-kb`, which bootstraps `repo-overview` KB docs for one, several, or all undocumented repos in a company. VS Code Copilot Chat only (Local or Copilot mode) — Copilot CLI's terminal tool doesn't support prompts/agents at all, per `github-copilot/copilot-cli-internals.md`. |
| `copilot/hooks/` | User-authored hooks (e.g. `desktop-notify`) |
| `claude/CLAUDE.md` | Claude Code's global entrypoint. `@import`s all three `copilot/instructions/*.instructions.md` files explicitly — Claude Code's `@import` requires individual file paths, unlike Copilot CLI which auto-loads every `.instructions.md` in the folder natively. Missing an `@import` here silently means Claude Code never sees that file. |
| `claude/plugins/blocklist.json` | Plugin blocklist (contains what look like test entries — worth reviewing before this repo is shared with anyone) |
| `codex/AGENTS.md` | Codex CLI's global entrypoint — a thin pointer to the same `copilot/instructions/*.instructions.md` files, not duplicated content. **Unverified**: unlike the other two tools, this hasn't been tested against a real Codex CLI session — see the file's own note. |
| `claude/settings.json` | **Not a copy of the real one.** The real `~/.claude/settings.json` on this Mac is ~150 permission entries full of this machine's absolute paths — not portable. This repo ships a minimal generic seed instead; see `seed-once` below. |
| `global-variables.md` | `{{AGENT_HOME}}` (OS-fixed, no setup), `{{AGENT_CONFIG_REPO}}` (this machine's clone path), `{{LANGUAGE}}` (default: English), and one company-repo-root variable per company (e.g. `{{OTS_REPOS_ROOT}}`) — all filled in / kept current by SETUP.md, extensible for more. |

## What's deliberately excluded

- **Ephemeral/cache/session state** — `~/.copilot/session-state/` (179M), `session-store.db*` (11M), `logs/`, `command-history-state.json`, `copilot.zip`, `sidebar-sessions-state/`, `ide/`; `~/.claude/cache/`, `backups/`, `file-history/`, `shell-snapshots/`, `sessions/`, `telemetry/`, `session-env/`, `downloads/`, `ide/`. None of this is config — it's local runtime state, regenerated automatically.
- **Conversation transcripts** — `~/.claude/projects/*/*.jsonl` (24M total). Full chat history, large and not meant to be portable.
- **Secrets / machine-specific config** — `~/.copilot/config.json`, `mcp-config.json`, `permissions-config.json`. Never inspected or copied by this repo (deliberately not read while building this, to avoid handling tokens unnecessarily). Set these up manually per machine.
- **`~/.copilot/memory/`** — was included as an empty stub (`knowledge.md`, 0 bytes) in an earlier pass; removed since there was nothing real to track. Re-add to `mapping.yaml` if it ever holds real content.
- **Per-project memory** (`~/.claude/projects/*/memory/*.md` — e.g. this repo's own `MEMORY.md`) — deferred. It's keyed by a hash of the absolute working-directory path, so it only round-trips correctly if every machine clones each project repo to an identical path. Revisit once that's either guaranteed or a path-independent scheme is designed.

## Install strategies (`mapping.yaml`)

- **`symlink`** — target becomes a symlink into this repo. Edit either place, both stay in sync. Any existing real file/dir at the target is backed up first, once. **On Windows**, if a real symlink can't be created (see below), it degrades to a **Junction** (directories), **Hard Link** (files) or, with consent, a copy — see "Windows notes" below.
- **`link-each`** — the target stays a real folder, and each entry of the source folder is linked into it one by one (backups and Windows fallbacks as for `symlink`, per entry). Used for `skills/`: `~/.claude/skills` also holds `synced/`, the skills Claude Code downloads from claude.ai, which a whole-folder link would move into the backup (tested 2026-10-29: Claude Code 2.1.129 did not download them again on the next session). An older whole-folder link to this repo is replaced; uninstall removes only the entry links.
- **`seed-once`** — copied in only if the target doesn't already exist; never touched again after that. Used for `claude/settings.json` (accumulates machine-local permission grants) and `global-variables.md` (accumulates machine-specific variable values) — a symlink would sync those values across every machine, which isn't what you want.

## OS support

macOS is implemented (`installers/macos/install.sh`) and tested (idempotent re-runs, `uninstall.sh` safety, all re-verified after both the `installers/` reorg and the `knowledge/`/`companies/` move). Linux is stubbed (`installers/linux/install.sh`) — the underlying logic in `installers/lib/link-or-copy.sh` is plain POSIX-ish bash and should work unmodified.

**Windows** is implemented via `installers/install.ps1`/`uninstall.ps1` + `installers/lib/link-or-copy.ps1` (PowerShell 5.1+), tested with PowerShell 7.6 against a throwaway fake `$env:USERPROFILE`. Two things to know:

- **Symlinks need a privilege, whatever shell you use: admin rights, Developer Mode, or the "Create symbolic links" user right** ([Microsoft](https://blogs.windows.com/windowsdeveloper/2016/12/02/symlinks-windows-10/)). Windows PowerShell 5.1, PowerShell 7 and `mklink` all fail identically without one (tested with Developer Mode off), so installing PowerShell 7 is not a fix. Details: `copilot/knowledge/windows/symlinks-privilege.md`. Before creating any link the installer probes whether a real symlink is possible (`New-Item`, then `mklink`, then PowerShell 7 if already installed). If not, it **diagnoses and stops instead of degrading**: it prints the cause (Developer Mode state, elevation, PowerShell version, repo/home on different drives) and ranked fixes — (1) elevate once via a single UAC prompt (`AGENT_CONFIG_ELEVATE=1`, or choose it at the prompt), (2) enable Developer Mode, (3) grant the symlink user right. A non-interactive run (e.g. an AI agent) makes **no changes** and exits with code 2 so the agent can ask you. Degraded links are opt-in only (`AGENT_CONFIG_ALLOW_DEGRADED=1` or the prompt): **Junction** (dirs; works across drives), **Hard Link** (files; same drive only, so impossible when the repo and home differ), then a **Copy** needing further consent (`AGENT_CONFIG_ALLOW_COPY=1`). The probe runs only when a link actually needs creating, so re-running on an already-linked machine is a silent no-op; re-running after fixing the cause upgrades earlier junctions/hard links to real symlinks.
- **Hard Link caveat:** a hard link points at the same on-disk data as the source file, not at its path. If a file is later *replaced* (many editors/Git save by writing a new file and renaming it over the old one), the hard link at the target keeps pointing at the old, orphaned data. A Junction (used for directories) doesn't have this problem. If this bites you, delete the stale hard link and re-run `install.ps1`.
- `uninstall.ps1` deliberately never passes `-Recurse` to `Remove-Item` when removing a directory link — verified that `-Recurse` on a symlink/junction directory follows the link and deletes the *real* target's contents, not just the link entry (see References). Checked directly: uninstalling in a test run left the repo's real `copilot/knowledge/` file count unchanged.

No native Windows support was attempted via Git Bash / WSL — `install.sh` detects that environment and points you at `install.ps1` instead.

## References

**Local artifacts:**
- `{{AGENT_HOME}}/knowledge/ai-agents/loop-engineering.md`, `loop-engineering-playbook.md` — the loop-engineering concept this repo's own draft→check→decide-style install/verify flow borrows vocabulary from.
- `{{AGENT_HOME}}/knowledge/documentation/doc-template-base.md` — the format-redirect-table pattern `mapping.yaml` reuses at the filesystem level.
- `SETUP.md` — the onboarding flow that fills in `global-variables.md`'s machine-specific values.
- `copilot/patterns/shared-procedure-thin-wrapper.pattern.md` (catalogued in `copilot/patterns/index.md`) — the pattern this file's own `claude/CLAUDE.md`/`codex/AGENTS.md`/Copilot-native split follows.

**External authoritative sources:**
- [Claude Code — Advanced setup docs](https://code.claude.com/docs/en/setup) and [ClaudeLog — Where is Claude Code installed?](https://claudelog.com/faqs/where-is-claude-code-installed/) — confirm Windows native config lives at `%USERPROFILE%\.claude`.
- [GitHub Copilot CLI configuration directory — GitHub Docs](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference) — confirms Windows native config lives at `%USERPROFILE%\.copilot`.
- [PowerShell/PowerShell issue #5000](https://github.com/PowerShell/PowerShell/issues/5000) and [Winaero — Create Symbolic Link in Windows 10 with PowerShell](https://winaero.com/create-symbolic-link-windows-10-powershell/) — symlink creation needs admin or Developer Mode (Windows 10 build 14972+).
- [PowerShell/PowerShell issue #621](https://github.com/powershell/powershell/issues/621) and [zaur.it — Delete a symbolic link on Windows safely](https://zaur.it/delete-symbolic-link-windows/) — `Remove-Item -Recurse` on a symlink/junction directory deletes the real target's contents; never pass `-Recurse` when removing a link.

## Related

- `SETUP.md` — onboarding task list for a new machine.
- `copilot/patterns/index.md` — reusable design patterns, deployed globally to `{{AGENT_HOME}}/patterns/`, e.g. before adding another cross-tool capability or writing another "overwrite this path" script.
- `global-variables.md` — path/preference variable definitions.
- `copilot/companies/ots/index.md` — worked instance of the Company KB Framework.
- **Deferred (2026-09-20):** renaming the live disk destination itself — e.g. `{{AGENT_HOME}}` from `~/.copilot` to something neutral — was explicitly considered and declined. `{{AGENT_HOME}}` now makes this cheap *if* it's ever revisited (one line in `global-variables.md`), but there's still no live problem motivating it today.
- Consider a real Windows machine/VM test of the symlink-denied → Junction/HardLink fallback path — this Mac can't reproduce a denied-symlink PowerShell session to test it end-to-end.
- Consider a future pass on Linux support once actually needed on a second machine (stub exists, untested).
- Consider a path-independent scheme for per-project memory once cross-machine repo paths are settled.
