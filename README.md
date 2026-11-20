# agent-config

A dotfiles-style repo for global AI-coding-agent configuration (Claude Code, GitHub Copilot CLI, OpenAI Codex CLI, and future agents) — single source of truth, symlinked into place per machine instead of copy-pasted by hand.

## Where to go

| If you want to... | Go to |
|---|---|
| Find anything: where a file is, what checks it, what links to it, where a task starts | The atlas is parked in `../agent-atlas` until it is updated for the split repos (TRACKER) |
| Set this repo up on a new machine | [`SETUP.md`](SETUP.md) |
| Keep track of work left for later, across sessions and repos (and get reminded at session start) | [`home/tracker/tracker.schema.md`](home/tracker/tracker.schema.md): a `TRACKER.md` per repo, `node ~/.agent-config/tracker/tracker.mjs --brief` / `--add` / `--close`; this repo's own: [`TRACKER.md`](TRACKER.md) |
| See what each Claude Code, Codex or GitHub Copilot turn used (tokens, tools, subagents, cost, 5-hour and weekly limits) and the running total | [`home/hooks/turn-tokens/turn-tokens.schema.md`](home/hooks/turn-tokens/turn-tokens.schema.md): a `Stop` hook in each tool (`SETUP.md` step 12); history in `~/.claude/turn-tokens/` and `~/.codex/turn-tokens/` |
| Keep every agentic-sdlc run on the workflow: no skipped gate, no loop past its budget, a ledger of every step | [`copilot/frameworks/agentic-sdlc/schemas/workflow-graph.schema.md`](copilot/frameworks/agentic-sdlc/schemas/workflow-graph.schema.md): the graph `workflow.graph.yaml`, the ledger `.specify/runs/<run>/ledger.jsonl`, guard and approval hooks for Claude Code, Copilot CLI and Codex (`SETUP.md` step 13, specs/019) |
| Let a program drive a whole agentic-sdlc run: roles headless in Claude Code, Copilot CLI or Codex, stopping at each gate for you | `workflow-graph run start … / run approve … / run resume …` ([`specs/020-workflow-runner/`](specs/020-workflow-runner/), `SETUP.md` step 14) |
| Reuse a design technique before improvising a one-off | [`home/patterns/index.md`](home/patterns/index.md) |
| Understand or extend the Company KB Framework | `frameworks/company-kb/index.md` in the private repo conanjs/agent-companies (`~/.agent-config/frameworks/company-kb`) |
| Write or check a global knowledge doc (schemas, deep dives, validator) | [`copilot/frameworks/knowledge/index.md`](copilot/frameworks/knowledge/index.md) |
| Work inside a specific company's KB (e.g. OTS) | `companies/ots/index.md` in conanjs/agent-companies (`~/.agent-config/companies/ots/index.md`) |
| Bootstrap Spec-Driven Development (Spec Kit) in a project | [`home/procedures/spec-driven-development.procedure.md`](home/procedures/spec-driven-development.procedure.md) |
| Review a knowledge doc or procedure before committing (validators + the checks they can't do) | [`home/procedures/review-docs.procedure.md`](home/procedures/review-docs.procedure.md); enable the automatic checks with `git config core.hooksPath .githooks` (see `SETUP.md` step 10) |
| Change a validator, installer or script in this repo (spec first, then its Cucumber scenarios) | [`.specify/memory/constitution.md`](.specify/memory/constitution.md) principle IV, [`specs/`](specs/) (one folder per change), [`tests/`](tests/) (one feature file per tool); `pnpm install` once, then `pnpm test` |
| Add standard GitHub repo governance to a repo | [`home/procedures/init-github-governance.procedure.md`](home/procedures/init-github-governance.procedure.md) |
| Install/update the eight Windows apps after a restart | Select `/agent windows-software`, then send `run`; see [`agents/windows-software.agent.md`](agents/windows-software.agent.md). Installers stay in Downloads; nvm, Notepad++, Git, and WinRAR go under `D:\win11 software`. |
| Look up a path/preference variable (`{{AGENT_HOME}}` etc.) | [`global-variables.md`](global-variables.md) |
| See exactly what gets installed where | [`mapping.yaml`](mapping.yaml), and "What's included" below |

This file (`README.md`) is the general reference for everything else — structure, install mechanics, what's excluded and why.

## How it works

Three tiers. The repos hold the sources; the **agent home `~/.agent-config`** (`%USERPROFILE%\.agent-config` on Windows) holds what every coding agent reads, as links; each coding agent's own folder holds only its entry files, its built agents and its plugins.

```
agent-config/ (this repo)                  # sources; installed by installers/install.sh (mapping.yaml) and scripts/build.mjs
├── home/                                  # -> ~/.agent-config/*: instructions, references, patterns, procedures, prompts,
│                                          #    hooks, tracker, frameworks/agent-foundry, global-variables.md (seeded once)
├── adapters/<agent>/                      # each coding agent's entry files (CLAUDE.md, settings.json, hooks.json) + adapter.yaml
├── agents/<name>/                         # agent sources: body.md + claude.yaml / copilot.yaml / codex.toml -> built into dist/
├── plugin/ + .claude-plugin/, .agents/plugins/   # the agent-config plugin: skills, one SKILL.md for every coding agent
├── installers/, scripts/, tests/          # install, build, checks (not deployed)
└── .specify/, specs/, proposals/          # design history (not deployed)

~/.agent-config/ (the agent home)          # real folder of links; core instructions read everything here
├── instructions/ references/ patterns/ procedures/ prompts/ hooks/ tracker/   -> agent-config/home/*
├── frameworks/agent-foundry               -> agent-config/home/frameworks/agent-foundry
├── knowledge/, frameworks/knowledge       -> agent-knowledge clone   (its README "Integrate into the agent home")
├── companies/, frameworks/company-kb      -> agent-companies clone   (same)
└── global-variables.md                    # machine values, seeded once

Each coding agent's own folder
├── ~/.claude/   CLAUDE.md (@imports ~/.agent-config/instructions/core.instructions.md), agents/<n>.md, plugins
├── ~/.codex/    AGENTS.md (-> core.instructions.md), hooks.json, agents/<n>.toml, plugins (copied to its cache)
└── ~/.copilot/  instructions/, hooks/, prompts/ (Copilot loads these itself, linked to the same home/ folders),
                 agents/<n>.agent.md, plugins; ~/.agents/skills ignored (ignoredSkillsLocations)
```

## Doc guards

Four layers keep knowledge docs, procedures and the agentic-sdlc framework from drifting or degrading. The technique is written up as `home/patterns/layered-guards.pattern.md`.

| Layer | Catches | Runs | Files |
|---|---|---|---|
| 1. Wiring | any validator failure | Claude Code after every edit here (`.claude/settings.json`); git pre-commit (enable once per clone: `git config core.hooksPath .githooks`); CI on every push/PR, **required to merge into `main`** (branch protection check `validate-docs`) | `scripts/check-docs.sh`, `scripts/claude-doc-hook.sh`, `.githooks/pre-commit`, `.github/workflows/validate-docs.yml` |
| 2. Mechanical checks | shape: unknown front-matter keys, malformed Verification status, copied blocks, repeated paragraphs, chat leftovers (warn) | inside the validators; each validator's own behavior is pinned by Cucumber scenarios in `tests/` (TST-14) | `copilot/frameworks/knowledge/tools/validate-knowledge.mjs`, `copilot/frameworks/agentic-sdlc/tools/validate.mjs`, `home/frameworks/agent-foundry/tools/validate-foundry.mjs`, `tests/<tool>/<tool>.feature` |
| 3. Judgment review | meaning: doc stands alone, sections do their job, claims sourced, tool facts current, nothing erased | before committing, by procedure (required by `core.instructions.md` and this repo's `AGENTS.md`; `review-docs` skill) | `home/procedures/review-docs.procedure.md`, `skills/review-docs/SKILL.md` |
| 4. Freshness | staleness: procedures record the version of each outside tool they describe; warns when unverified, > 90 days old, or behind upstream | validator on every run; upstream check weekly in CI | `home/procedures/procedure.schema.md`, `home/procedures/tools/validate-procedures.mjs` |

Run everything locally: `pnpm install` once, then `scripts/check-docs.sh` (finds Node.js 24 itself, the version in `.nvmrc`; the validators alone need ≥ 18). Rules: `copilot/frameworks/knowledge/schemas/_system.md` (KB-1 … KB-8), `knowledge-doc.schema.md` (KD-1 … KD-9), `procedure.schema.md` (PR-1 … PR-6).

## Path & preference variables

Docs across this repo and the deployed knowledge base reference `{{AGENT_HOME}}`, `{{AGENT_CONFIG_REPO}}`, `{{LANGUAGE}}`, and per-company variables like `{{OTS_REPOS_ROOT}}` instead of hardcoding literal paths. All of these are defined in exactly one place: `global-variables.md` (shipped template here in the repo; deployed to `~/.agent-config/global-variables.md` via the `seed-once` strategy, so a machine's filled-in values are never clobbered by a later `git pull`). `core.instructions.md` — the one file every agent always loads — points at it, so any agent reading a `{{VAR}}` placeholder knows where to resolve it.

Why not just keep hardcoding `~/.agent-config/knowledge/...` everywhere? Mostly future-proofing: if that live path is ever renamed (see "Related" below), there's one line to edit instead of 23. It does **not** fix a live problem today — agents already translate `~/.copilot/...` to `%USERPROFILE%\.copilot\...` on Windows correctly on their own.

## Company KB Framework

A reusable pattern for a per-company knowledge base — split into a shared *definition* (`frameworks/company-kb/` in conanjs/agent-companies) and one *instance* per company (`companies/<company>/`), so a second company can be onboarded later without copying the schema system. **Full explanation, structure, and how to bootstrap a new repo's KB entry: [`home/frameworks/company-kb/index.md`](home/frameworks/company-kb/index.md)** — not restated here.

OTS is the current worked instance: `companies/ots/index.md` in conanjs/agent-companies. `core.instructions.md` is what tells an agent this framework exists in the first place — without that pointer, the framework existing on disk doesn't mean an agent knows to look for it.

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
| `home/instructions/` | `core.instructions.md`, the one global instruction file every agent loads: Copilot natively, Claude Code through `~/.claude/CLAUDE.md`, Codex as `~/.codex/AGENTS.md` |
| `home/references/` | Files the core tells agents to read only when needed: the answer patterns other than the default, the code-review-graph guide, the SQL rules. Kept out of `home/instructions/` because Copilot loads everything there |
| `../agent-companies` (sibling clone, private) | The **Company KB Framework** (`frameworks/company-kb/`) and one KB per company (`companies/ots/`), conanjs/agent-companies: linked to `~/.agent-config/frameworks/company-kb` and `~/.agent-config/companies` |
| `home/frameworks/agent-foundry/` | The **Agent Foundry** (alias: Charter), v0.1 draft: builds scoped, learning agents from a Charter, a decision flow (`trees/`), a Resolver, non-waivable floors and a team Lens. First agent: `pr-reviewer`. Start at its [`index.md`](home/frameworks/agent-foundry/index.md); check with `node home/frameworks/agent-foundry/tools/validate-foundry.mjs` |
| `agents/` | Agent sources, one folder each: `body.md` (the text every coding agent shares) and one header file per coding agent that gets the agent, written in that agent's own keys: `claude.yaml`, `copilot.yaml`, `codex.toml` |
| `plugin/`, `.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json` | The `agent-config` plugin: `plugin/skills/<name>/SKILL.md`, one file per skill for Claude Code, Copilot CLI and Codex. Install from the clone: `claude plugin marketplace add <clone> && claude plugin install agent-config@agent-config`, the same with `copilot plugin …`, and `codex plugin marketplace add <clone> && codex plugin add agent-config@agent-config`. How it works: agent-knowledge `knowledge/ai-agents/plugin-marketplace-install-flow.md` |
| `adapters/<agent>/` | Per coding agent (`claude`, `copilot`, `codex`): `adapter.yaml` (where its built skills and agents go, which header file it reads, which keys are checked against its docs) and the files that agent loads as they are (`CLAUDE.md`, `settings.json`, `hooks.json`) |
| `scripts/build.mjs` | The agent build: reads `agents/`, writes one file per coding agent (that agent's header file plus `body.md`) and with `--link` links each into `~/.claude/agents`, `~/.copilot/agents` and `~/.codex/agents`. The installers run it. Skills are not built: they ship in `plugin/` |
| `../agent-knowledge` (sibling clone) | The knowledge base and its framework, [conanjs/agent-knowledge](https://github.com/conanjs/agent-knowledge): linked to `~/.agent-config/knowledge` and `~/.agent-config/frameworks/knowledge` |
| `../agentic-sdlc` (sibling folder) | The **Agentic SDLC Framework** with its `sdlc-*` skill and agent sources: linked to `~/.agent-config/frameworks/agentic-sdlc` |
| `home/prompts/` | Copilot slash-command prompts — currently `init-repo-kb`, which bootstraps `repo-overview` KB docs for one, several, or all undocumented repos in a company. VS Code Copilot Chat only (Local or Copilot mode) — Copilot CLI's terminal tool doesn't support prompts/agents at all, per `github-copilot/copilot-cli-internals.md`. |
| `home/hooks/` | User-authored hooks (e.g. `desktop-notify`) |
| `adapters/claude/CLAUDE.md` | Claude Code's global entrypoint. `@import`s `home/instructions/core.instructions.md` — Claude Code's `@import` requires individual file paths, unlike Copilot CLI which auto-loads every `.instructions.md` in the folder natively. A new file in `home/instructions/` needs its own `@import` line here. |
| `adapters/claude/plugins/blocklist.json` | Plugin blocklist (contains what look like test entries — worth reviewing before this repo is shared with anyone) |
| `~/.codex/AGENTS.md` | Codex CLI's global entrypoint: `mapping.yaml` links it straight to `home/instructions/core.instructions.md`. Until 2026-11-09 it was a pointer asking Codex to read the instruction files, which Codex did every session at the cost of an extra model request; `adapters/codex/README.md` has the history. |
| `AGENTS.md`, `CLAUDE.md` (repo root) | Rules only for working in this repo (knowledge-base schemas, review before commit, installer backups); `CLAUDE.md` imports `AGENTS.md` |
| `adapters/claude/settings.json` | **Not a copy of the real one.** The real `~/.claude/settings.json` on this Mac is ~150 permission entries full of this machine's absolute paths — not portable. This repo ships a minimal generic seed instead; see `seed-once` below. |
| `home/global-variables.md` | `{{AGENT_HOME}}` (OS-fixed, no setup), `{{AGENT_CONFIG_REPO}}` (this machine's clone path), `{{LANGUAGE}}` (default: English), and one company-repo-root variable per company (e.g. `{{OTS_REPOS_ROOT}}`) — all filled in / kept current by SETUP.md, extensible for more. |

## Integrating another repo

agent-config installs only its own files. Any other repo (today agent-knowledge and agent-companies) joins the agent home the same way, by its own README section **"Integrate into the agent home"**, which an agent follows when asked:

1. Clone the repo, for example into `~/workspace/<repo>`.
2. Link its folders into the agent home (`~/.agent-config/<name>`, `%USERPROFILE%\.agent-config\<name>` on Windows); or, for something read only once, point at the clone directly.
3. Install its plugin, if it ships skills (`.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json`).
4. Add one line to `home/instructions/core.instructions.md` that says when to read it, using the agent-home path (`~/.agent-config/<name>/index.md`), never a placeholder.

## What's deliberately excluded

- **Ephemeral/cache/session state** — `~/.copilot/session-state/` (179M), `session-store.db*` (11M), `logs/`, `command-history-state.json`, `copilot.zip`, `sidebar-sessions-state/`, `ide/`; `~/.claude/cache/`, `backups/`, `file-history/`, `shell-snapshots/`, `sessions/`, `telemetry/`, `session-env/`, `downloads/`, `ide/`. None of this is config — it's local runtime state, regenerated automatically.
- **Conversation transcripts** — `~/.claude/projects/*/*.jsonl` (24M total). Full chat history, large and not meant to be portable.
- **Secrets / machine-specific config** — `~/.copilot/config.json`, `mcp-config.json`, `permissions-config.json`. Never inspected or copied by this repo (deliberately not read while building this, to avoid handling tokens unnecessarily). Set these up manually per machine.
- **`~/.copilot/memory/`** — was included as an empty stub (`knowledge.md`, 0 bytes) in an earlier pass; removed since there was nothing real to track. Re-add to `mapping.yaml` if it ever holds real content.
- **Per-project memory** (`~/.claude/projects/*/memory/*.md` — e.g. this repo's own `MEMORY.md`) — deferred. It's keyed by a hash of the absolute working-directory path, so it only round-trips correctly if every machine clones each project repo to an identical path. Revisit once that's either guaranteed or a path-independent scheme is designed.

## Install strategies (`mapping.yaml`)

- **`symlink`** — target becomes a symlink into this repo. Edit either place, both stay in sync. Any existing real file/dir at the target is backed up first, once. **On Windows**, if a real symlink can't be created (see below), it degrades to a **Junction** (directories), **Hard Link** (files) or, with consent, a copy — see "Windows notes" below.
- **`seed-once`** — copied in only if the target doesn't already exist; never touched again after that. Used for `adapters/claude/settings.json` (accumulates machine-local permission grants) and `home/global-variables.md` (accumulates machine-specific variable values) — a symlink would sync those values across every machine, which isn't what you want.

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
- `home/patterns/shared-procedure-thin-wrapper.pattern.md` (catalogued in `home/patterns/index.md`) — the pattern this file's own `adapters/claude/CLAUDE.md` / `~/.codex/AGENTS.md` link / Copilot-native split follows.

**External authoritative sources:**
- [Claude Code — Advanced setup docs](https://code.claude.com/docs/en/setup) and [ClaudeLog — Where is Claude Code installed?](https://claudelog.com/faqs/where-is-claude-code-installed/) — confirm Windows native config lives at `%USERPROFILE%\.claude`.
- [GitHub Copilot CLI configuration directory — GitHub Docs](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference) — confirms Windows native config lives at `%USERPROFILE%\.copilot`.
- [PowerShell/PowerShell issue #5000](https://github.com/PowerShell/PowerShell/issues/5000) and [Winaero — Create Symbolic Link in Windows 10 with PowerShell](https://winaero.com/create-symbolic-link-windows-10-powershell/) — symlink creation needs admin or Developer Mode (Windows 10 build 14972+).
- [PowerShell/PowerShell issue #621](https://github.com/powershell/powershell/issues/621) and [zaur.it — Delete a symbolic link on Windows safely](https://zaur.it/delete-symbolic-link-windows/) — `Remove-Item -Recurse` on a symlink/junction directory deletes the real target's contents; never pass `-Recurse` when removing a link.

## Related

- `SETUP.md` — onboarding task list for a new machine.
- `home/patterns/index.md` — reusable design patterns, deployed globally to `{{AGENT_HOME}}/patterns/`, e.g. before adding another cross-tool capability or writing another "overwrite this path" script.
- `global-variables.md` — path/preference variable definitions.
- conanjs/agent-companies `companies/ots/index.md` — worked instance of the Company KB Framework.
- **Done (2026-11-20):** the agent home moved from `~/.copilot` to the neutral `~/.agent-config`; Copilot is one coding agent like the others, and only the folders it loads by itself (`instructions/`, `hooks/`, `prompts/`) are also linked into `~/.copilot`. (Declined on 2026-09-20, when Copilot was the only agent.)
- Consider a real Windows machine/VM test of the symlink-denied → Junction/HardLink fallback path — this Mac can't reproduce a denied-symlink PowerShell session to test it end-to-end.
- Consider a future pass on Linux support once actually needed on a second machine (stub exists, untested).
- Consider a path-independent scheme for per-project memory once cross-machine repo paths are settled.
