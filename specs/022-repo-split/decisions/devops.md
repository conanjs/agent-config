# DevOps decisions for spec 022 (deployment topology, P4)

Role: devops, mode: decide, run R-001, 2026-11-13. Inputs: `spec.md` (G2 approved), `blueprint.md` v3.1, the current installers (`installers/`, `mapping.yaml`, `SETUP.md`), `.github/workflows/validate-docs.yml`. Ids `DR-2xx` are provisional: the Orchestrator renumbers them when it merges this file into `research.md`. Nothing here creates a credential, repo, tag or paid resource; those are human steps, listed at the end.

Words used once: CI = continuous integration (the automatic check on each pull request). SHA = the 40-character id of a git commit. Home = `{{AGENT_HOME}}`, `~/.agent-config`. Store = the folder of immutable version trees defined in DR-202. Generation = one complete set of links and generated files written by one install run.

## Summary of the walk (tree DT)

| Node | Answer | Why |
|---|---|---|
| DT-Q1 alters deployment? | YES | New install target (the home), a new Node installer, three new repos each needing CI, new local state files, merged hooks. Not fast-path eligible |
| DT-Q2 topology exists? | YES, inherit | Installers, `mapping.yaml`, one CI workflow `validate-docs` (required check on main), `scripts/check-docs.sh`. Add the minimum: one `check` workflow per new repo, one installer test matrix, one integration workflow |
| DT-Q3 who uses it? | Real users, adapted | V is the only user, but the installer writes every agent's start-up files on two machines, so a bad deploy breaks all sessions. Default (staging + production, manual promotion) kept; "staging" is the installer's own staging area plus a throwaway-home rehearsal (DR-201) |
| DT-Q4 rollback? | All three combine, strictest first | State move (home, compatibility links): expand-then-contract. Risky behaviour (new installer, hook merge): an escape lever kept for phases 2 to 4 (`install.sh --legacy`). Content and code: redeploy the previous version (DR-205) |
| DT-Q5 contract change? | YES | Provider first (contracts), then providers of content, then consumers, then the composition root pins them (DR-207) |

Escalation checks: no new cloud account, no paid service (public repos; GitHub-hosted runners for public repos are documented as free, unconfirmed here, confirm at repo creation against GitHub's Actions billing page), no production data migration (no server state; the only irreplaceable data is V's two local files, handled in DR-203). Nothing escalates on cost.

## DR-201: Environments and promotion
- **Tree path:** DT-Q1 (YES) → DT-Q2 (YES, inherit) → DT-Q3 (real users) → DT-Q4
- **Criteria:** FR-043 (each phase ends with install + `doctor` on Mac and Windows); AC-7.2 (failed update keeps the old version); the blueprint "Deploy impact" row; `release-pipeline.md` environments table (RLS-2, RLS-4).
- **Options considered:** (a) single environment, deploy on merge | (b) preview + staging + production with a manual gate | (c) like (b) plus a permanent second "canary" machine
- **Chosen:** (b), mapped as below.

| Environment | What it is here | Gate into it |
|---|---|---|
| preview | CI on every pull request: the installer runs against a throwaway home (`HOME` / `USERPROFILE` set to a temp folder) on ubuntu, macOS and Windows runners, with fixture components as local git remotes and `path` folders (no network) | `scripts/check` green |
| staging | On V's machine: `plan` (writes nothing), then the installer's own staging (version trees built and validated before any link moves, DR-202). For phases 2 and 5, first a rehearsal run with `HOME` / `USERPROFILE` pointed at a temp folder | `plan` reviewed; all checks inside `install` pass |
| production | V's real home and agent folders, Mac first, then Windows | Pull request merged by V (gate G5) only after both machines pass the phase runbook (DR-208) |

- **Rejected:** (a) one environment: a broken home is every agent's broken start-up, and the spec requires failure to keep the old state; (c) a canary machine: V has two machines and Mac then Windows already gives a staged promotion.
- **Confidence:** high. **Supersedes:** none. **Decided by:** devops · **Approved at:** pending G3.

## DR-202: Agent home, staging store and atomic switch
- **Tree path:** DT-Q2 (inherit) → DT-Q4 (stateless code and state files) → rollback by repointing links
- **Criteria:** FR-013, FR-014, FR-015, FR-026, AC-7.1, AC-7.2, AC-16.2 (rendered target `../../knowledge/x.md` from `generated/<component>/foo.md`), existing `backup_existing` behaviour. Tested 2026-11-13 on macOS (Darwin 25.1.0, Node v24.22.1): Node `fs.renameSync(tmpLink, existingDirLink)` replaces an existing directory symlink in one step (`readlink` afterwards gives the new target). Not tested: Windows.
- **Options considered:** (a) mutate in place: `git checkout` in a managed clone, then re-link | (b) per-component immutable version trees plus link swap | (c) one `generations/<id>/` folder for the whole install behind a single `current` link
- **Chosen:** (b). Layout, extending the blueprint's home layout by one folder (`store/`):

```
H = ~/.agent-config  (Windows: %USERPROFILE%\.agent-config; AGENT_CONFIG_HOME moves it)
H/components/<name>/             managed git clone, a fetch cache only; never linked
H/store/<name>@<id>/             one immutable tree per version: a checked-out git tree, or a rendered/built copy
H/knowledge, H/companies, H/frameworks/<n>   links into store trees (linked class) or, for rendered components, to generated/
H/generated/<component>          link -> ../store/<name>@<id>   (rendered copies)
H/generated/*.md|json            single generated files: global-variables.md, index.md, codex/AGENTS.md, routes, hooks
H/components.local.yaml, variables.local.yaml, components.lock, install-state.json, install.log, install.lock
~/.agent-config-backups/<timestamp>/    outside the home on purpose (survives a home move and uninstall)
```

  `<id>` = first 12 hex characters of a hash over (source revision, home path, renderer version, adapter version). A new revision, a moved home or a new renderer rule therefore creates a new tree and never edits one in place, so read-only rendered files are safe and rollback is a link repoint.
- **Why depth matters:** a store tree sits exactly two folders below the home, like `generated/<component>/`. The relative citation target `../../knowledge/x.md` therefore resolves to `H/knowledge/x.md` whether a reader opens the file through the `generated/` link or through its real `store/` path. Option (c) would put copies at three levels and break that target for any reader that resolves links physically. Plan input P-1 below.
- **Apply order (one install run):**
  1. Take `install.lock` (create-exclusive file holding pid and time; stale after 10 minutes). Session-start re-render only tries the lock and skips if held.
  2. Read, resolve, plan (pure, no writes).
  3. Acquire: fetch into `components/<name>/` (cache) and create new `store/` trees. Nothing live changes.
  4. Validate every staged tree: schema, cycles, contract majors, exports against citations, runtimes, build, render, per-component and total budget.
  5. Any failure so far: delete the unreferenced new trees, report the failing check, exit 1. Live links untouched.
  6. Back up every real file or folder about to be replaced (DR-203).
  7. Write a journal (`install-state.pending.json`: for each link, old target and new target).
  8. Switch: for each link create a temporary link beside it, then rename it over the old one. Write single generated files by temp file + rename. One-time exception: replacing a whole-folder link with a real folder of per-entry links (Copilot's own folders, FR-027) is unlink then rename, two steps.
  9. Write `components.lock` and `install-state.json` by temp file + rename: this is the commit point. Delete the journal.
  10. Prune: keep the current and the previous tree per component, remove older ones (clear read-only first).
  11. Report. Exit 0, or 1 on failure.
  Interrupted run: the next `install` or `doctor` finds the journal and restores the old links, then continues; `doctor` reports a half state (spec edge case).
- **Platform behaviour:** macOS and Linux: step 8 is atomic per link (POSIX `rename`). Windows: renaming over an existing directory link is not expected to work, so the swap is remove-then-create (a window of milliseconds, covered by the journal). Link ladder on Windows: symbolic link, then junction for folders; for files, a hash-tracked copy instead of the current hard-link step, because a hard link goes stale when a file is replaced by rename. Anything below a symbolic link is shown by `doctor` as "degraded". If none works, exit 1, nothing changed (spec edge case).
- **Rejected:** (a) in-place checkout changes the live version before the checks run and cannot keep the previous version linked; (c) breaks the relative citation target (above) and swaps all components or none, but gains little for a single user.
- **Confidence:** medium (Windows rename behaviour unconfirmed). **Supersedes:** none. **Decided by:** devops · **Approved at:** pending G3.

## DR-203: Backups and V's local files
- **Tree path:** DT-Q4 (schema / data → expand-then-contract; irreversible loss avoided) → backup before replace
- **Criteria:** AC-7.3, AC-12.3, FR-026; existing `installers/lib/link-or-copy.*` (one timestamped folder per run, created lazily, mirrors the source path, `.N` suffix on clash); `release-pipeline.md` RLS-5; reliability Q-REL-11. The two files `components.local.yaml` and `variables.local.yaml` are V's input, are never committed (AC-3.8) and are the only state that cannot be rebuilt from git. `variables.local.yaml` replaces the seed-once `global-variables.md`, which holds today's real values.
- **Options considered:** (a) back up only what `install` replaces | (b) (a) plus a copy of V's two local files before every `set`, `add` or `use` rewrites them | (c) put the local files in a private git repo
- **Chosen:** (b).
  - Folder: `~/.agent-config-backups/<yyyyMMddHHmmss>/` (Windows `%USERPROFILE%\.agent-config-backups\<…>\`), created on the first backup of a run, local time as today, mode 0700 on POSIX because a backed-up `~/.claude/settings.json` may hold tokens.
  - Each folder gets `backup-manifest.json`: original path, backup path, kind (file, folder, link), hash. The report names the folder (AC-7.3).
  - Backups are never deleted by any command. `doctor` prints the count and total size and warns above 20 folders; V prunes by hand.
  - Before `set`, `add`, `use` or an installer-driven edit of `~/.claude/settings.json`, `~/.claude/CLAUDE.md` or Codex files, the previous content is copied into the same run's folder.
  - The one-time move from `~/.copilot` backs up real `~/.copilot/global-variables.md` first and imports its values into `variables.local.yaml` as proposals (AC-6.4), never silently.
- **Rejected:** (a) loses the only copy of the previous variable values when `set` overwrites; (c) adds an account-level resource and risks publishing V's paths.
- **Confidence:** high. **Supersedes:** none. **Decided by:** devops · **Approved at:** pending G3.

## DR-204: Compatibility links and the move (expand-then-contract)
- **Tree path:** DT-Q4 (schema / data → expand-then-contract; combine with risky behaviour) → one release between expand and contract
- **Criteria:** FR-031, FR-032, AC-8.1 to AC-8.6, A-12, `mapping.yaml` (13 targets under `~/.copilot` today), `release-pipeline.md` RLS-6.
- **Options considered:** (a) move the home and retire old paths in the same release | (b) expand in phase 2, contract in a later tagged release | (c) never retire
- **Chosen:** (b).
  - Expand (phase 2 release): new home created; compatibility links created at every old agent-home path (knowledge, companies, frameworks, patterns, references, procedures, atlas, tracker, `global-variables.md`, `instructions/core.instructions.md`, plus any other target the AC-8.4 sorting classifies as agent-home). Copilot's own folders (`instructions`, `hooks`, `agents`) are never replaced by one whole-folder link; where an old path inside them is still referenced, an entry-level compatibility link is added. Every link is recorded in `install-state.json` with class `compat` and the release that retires it.
  - Contract: the next tagged agent-config release (A-12) lists them under `retired:`. `install` removes one only if it is still the installer's own link (AC-8.3).
  - Before tagging that release, V (or an agent) searches `~/.claude/settings.json`, `~/.codex/hooks.json`, `~/.copilot/hooks/*.json` and the memory folders for the old agent-home paths. `doctor` should print any hit (plan input P-5). A hit blocks retirement until fixed.
  - The 445 `{{AGENT_HOME}}` lines are not edited in phase 2 (AC-8.5); the 484 hard-coded lines are sorted before any retirement.
- **Rejected:** (a) running sessions and hook commands name `~/.copilot/…` and would break mid-session; (c) leaves two paths per fact forever (violates constitution principle I).
- **Confidence:** high. **Supersedes:** none. **Decided by:** devops · **Approved at:** pending G3.

## DR-205: Rollback paths
- **Tree path:** DT-Q4 → stateless code: redeploy previous; state: expand-then-contract; risky behaviour: keep an escape lever
- **Criteria:** OPS-R2, RLS-5 (a rollback must have been exercised), Q-REL-10, AC-7.2, AC-7.6.
- **Chosen:** every deployable class has a named rollback that needs no fetch where possible.

| What changed | Rollback | Needs network | Exercised by |
|---|---|---|---|
| A failed install (any check) | Automatic: live links never moved (DR-202 steps 3 to 5) | no | AC-7.2 scenario in CI |
| A failure or crash during the switch | Journal restore on the next `install` or `doctor` | no | scenario that kills the process between links |
| A content repo update (knowledge, companies) | `use <name> <url>#<previous sha>` then `install`; the previous tree is still in `store/` (kept: current + previous) | no | CI scenario; manual once per phase 3 and 6 |
| agentic-sdlc update | Revert the pin in `components.yaml` (a normal pull request) or `use`; same store rule | no for the previous tag | CI scenario |
| Installer or contracts code (agent-config itself) | `git checkout <previous tag>` in V's clone (the `core` link points at it), then `install`. State files carry `schema: install-state/v1`; an installer meeting a newer major refuses and says so (exit 1) instead of rewriting it | no | CI scenario with an older state file |
| Phase 2 to 4 as a whole (new installer misbehaves) | `uninstall`, then `installers/install.sh --legacy` (the old mapping logic kept as `installers/legacy/` until phase 5 merges and one tag later). Backed-up real files come back with `uninstall --restore` (amendment A-D1) | no | rehearsal in a throwaway home in phases 2 and 5; one manual drill on Windows |
| Merged hooks / agent files (phase 5) | `uninstall` removes only entries whose hash or command path matches the record; `--restore` puts back the backed-up `settings.json` | no | CI scenario with a pre-filled `settings.json` |
| Anything, worst case | `git checkout pre-022` (tag at main `825ea82`, proposed, see "Human steps") and run the old installer | yes (first clone) | none; last resort |

- **Rejected:** a `rollback` command (a ninth command adds surface for what `use` + `install` already do); automatic rollback on a trigger (RLS-9: there is no running service to measure; the install itself validates before it switches).
- **Confidence:** high. **Supersedes:** none. **Decided by:** devops · **Approved at:** pending G3.

## DR-206: Continuous integration per repo
- **Tree path:** DT-Q2 (inherit `validate-docs`) → add the minimum per new repo
- **Criteria:** RLS-1 (pipeline = one slot, `scripts/check.sh`), RLS-3/OPS-R4 (no secrets), RLS-4, FF-1, FF-2, FF-6, FF-7, FF-9; blueprint rows "Test depth" and "Build and checks"; `conventions.md` §13 and GitHub's secure-use guidance (pin a full commit SHA, tags can move).
- **Options considered:** (a) copy `validate-docs.yml` and adapt each | (b) one thin workflow per repo that only runs `scripts/check.sh`, same shape everywhere | (c) a shared reusable workflow in agent-config
- **Chosen:** (b). Every repo: `.github/workflows/check.yml`, one job named `check`, `permissions: contents: read`, triggers `pull_request` (no path filter, so the required check never stays pending), `push` to main, `workflow_dispatch`, and a weekly schedule. Steps: checkout and setup-node pinned to the full SHAs `validate-docs.yml` already uses, Node from `.nvmrc`, `corepack enable && pnpm install --frozen-lockfile` where the repo has a lockfile (the repo's own dev tools only, FR-034), then `scripts/check.sh`. No secrets are used anywhere; sibling repos are public and cloned without a token. Branch protection: required status check `check`, admins not enforced (the same setting agent-config has, human step).
  agent-config keeps `validate-docs` and `scripts/check-docs.sh` until phase 8 renames them in one pull request together with V changing branch protection; `repo-layout/v1` lists them as the one named exception.

| Repo | `scripts/check.sh` runs (beyond the common steps) | Extra workflow |
|---|---|---|
| agent-config | Existing `check-docs.sh`; contracts schemas and examples (AC-1.2); fitness check against the baseline (AC-1.6); `{{AGENT_HOME}}`-line sorting check (AC-8.4); local-file guard (AC-3.8); no generated-from line or build-output folder tracked (AC-16.10) | `installer.yml`: matrix {ubuntu, macos, windows} × throwaway home; fixtures only. Plus Node 18 and 24 on ubuntu, because A-2 declares 18 as the floor. Required checks from phase 2: `installer (macos)`, `installer (windows)`. `integration.yml` (nightly, and on pull requests that touch `components.yaml`): real `git` sources of the default list into a throwaway home, then `install`, `doctor`, `uninstall` |
| agent-knowledge | `validate-knowledge.mjs` and its tests; `component.yaml` schema; exports against the last tag (a removal or rename needs a major bump, AC-13.2); in-storage link rules (AC-13.5); 0 mentions of `agentic-sdlc`; `{{AGENT_HOME}}` banned | none |
| agent-companies | Company KB validator and tests; `component.yaml` schema; citations ⊆ provider exports (AC-10.6) | nightly: the same citation check against the provider's `main` (early warning, never blocks a pull request) |
| agentic-sdlc | `validate.mjs --knowledge <provider> --adapters <map>`; `check-graph`; workflow-graph tool checks; `--write` freshness of citation targets; build + per-component budget with the pinned `build@major`; interface catalog | nightly: citations against the provider's `main`; on tag push: tag equals `framework-version` |

- **How a provider repo gets the contracts tool without reading agent-config's content:** each repo holds `contracts.pin` (tag `contracts/vM.m.p` and the full SHA). `scripts/check.sh` runs a small fetch step that clones agent-config at that tag into a git-ignored `.cache/`, checks the SHA matches the pin, and runs the tool from there. This is the context map's "Conformist, pinned @major" edge. The check fails if the pinned major is neither the current nor the previous one. Plan input P-3.
- **How a consumer gets a provider to check citations against:** `providers.pin` (repo URL + full SHA of the provider, or for phases 3 to 5 the agent-config SHA whose `copilot/knowledge` is the provider). Pull requests check the pin; the nightly job checks `main`.
- **Dependency audit:** `pnpm audit` as part of `check.sh` where a lockfile exists (FF-9, RLS stage 7). Optional: a `dependabot.yml` for the `github-actions` ecosystem to keep pinned SHAs fresh (a config file; enabling alerts is a human step).
- **Rejected:** (a) four drifting copies; (c) a shared reusable workflow makes every repo's CI read agent-config's files at run time, against the boundary rule.
- **Confidence:** medium (Windows runner link permissions unconfirmed: if symbolic links are unavailable there, the junction path is what runs). **Supersedes:** none. **Decided by:** devops · **Approved at:** pending G3.

## DR-207: Release, tags and rollout order
- **Tree path:** DT-Q5 (YES) → provider deploys first; old contract live until all consumers migrate
- **Criteria:** blueprint "Versioning" row; `conventions.md` §13 (framework tag equals `framework-version`; current and previous major); CC-Q1 to CC-Q3 in the blueprint; A-5, A-12; AC-14.1.
- **Options considered:** (a) tag everything on every merge | (b) tags only where something pins or compares | (c) publish packages to a registry
- **Chosen:** (b).

| Repo | Tags | Who follows what |
|---|---|---|
| agent-config | `vM.m.p` for the installer and core (V cuts one at the end of phases 2, 5 and 8, and when retiring compatibility links); `contracts/vM.m.p` for the contracts tool and schemas | V's machines track `main` of the clone by default; a tag is the rollback anchor and the "release" in A-12 |
| agentic-sdlc | `vM.m.p`, annotated, equal to `framework-version` in its `index.md`; CI checks it on tag push | `components.yaml` pins the tag (`ref`); the lock stores the resolved SHA; the installer fails if a locked tag now resolves to a different SHA (plan input P-4) |
| agent-knowledge, agent-companies | A tag `vM.m.p` only when `component.yaml` `version` changes (needed as the baseline for the export-removal check) | Follow `main`; the lock stores the SHA; nothing updates until V runs `install` |

  Nothing publishes artifacts: components are git trees, so no registry and no GitHub Release assets; the changelog (`CHANGELOG.md`, `repo-layout/v1`) is the release note.
- **Rollout order for any contract change (also the order of the nine phases):**
  1. Contracts: new reader that accepts the current and previous major; tag `contracts/v…`.
  2. Providers of content (agent-knowledge), then consumers (agentic-sdlc, agent-companies): one pull request each moves its `contracts.pin` and migrates.
  3. Composition root: agent-config updates `components.yaml` pins; `integration.yml` must pass.
  4. Drop the old major only when `doctor` shows no enabled component needs it (a later release).
  Removing or renaming an export is a major bump of the provider; its old path keeps a stub for one release (AC-13.7); consumers' nightly job shows who still cites it.
- **Order in which the new repos come into being:** agent-companies (phase 3), agent-knowledge (phase 6), agentic-sdlc (phase 7). Each repo gets its CI (DR-206) in the same pull request that creates its content, and the repo's `check` must be green before the matching agent-config pull request removes the content.
- **Rejected:** (a) tags nobody reads; (c) a registry needs credentials and contradicts "components are never installed through a package manager" (FR-034).
- **Confidence:** high. **Supersedes:** none. **Decided by:** devops · **Approved at:** pending G3.

## DR-208: Per-phase install + `doctor` run on Mac and Windows
- **Tree path:** DT-Q3 (manual promotion gate) → FR-043
- **Criteria:** FR-043, SC-013, AC-1.9, AC-7.1, AC-8.6, `SETUP.md` step 7 (the chain check today). Before phase 2 there is no `doctor`; the installers V runs today are the old ones.
- **Chosen:** the same runbook for every phase, run from the phase branch, on Mac then Windows, evidence pasted in the pull request. V merges only after both pass.

| # | Step | Pass condition |
|---|---|---|
| 1 | Repo checks (`scripts/check-docs.sh`, later `scripts/check.sh`) and CI, including the macOS and Windows installer jobs | green |
| 2 | Before: save the install tree snapshot (every link and its target, sorted) and the ten sampled `~/.copilot/…` paths with content hashes | files saved outside the repo |
| 3 | `install plan` (phases 0 and 1: old installer in a throwaway home) | report matches what the phase should change; empty difference in phases 0, 1 and 8 |
| 4 | `install` (first run in phase 2: exit 10, confirm the home with the command in the needs report, rerun) | exit 0, backup folder named if anything real was replaced |
| 5 | `install` again | "no changes", exit 0, no file rewritten (AC-7.1) |
| 6 | `doctor`, twice | exit 0 both times, identical output (AC-7.7); warnings reviewed |
| 7 | Start Claude Code, Copilot CLI and Codex in a scratch folder; compare the loaded core text hash (AC-8.6); open the ten sampled paths | same hashes and content as before (phases 2 to 4); rendered text from phase 5 |
| 8 | Windows only: record the link kind `doctor` reports (symbolic link or junction), and run once in a folder whose path has a space | no degraded link unless accepted; paths resolve |
| 9 | After merge: `git pull` on both machines, `install`, `doctor` | "no changes" or only the intended change; exit 0 |

| Phase | Added to the runbook |
|---|---|
| 0 | No installed path changes: step 3 compares old-installer snapshots before and after (AC-1.9). Installer-snapshot helper script needs a requirement and a test (constitution IV) |
| 1 | Same as phase 0; checks only |
| 2 | Rehearsal in a throwaway home first; home confirmation (AC-2.1 to 2.5); compatibility links and backups; a rollback drill (`uninstall --restore`, then `--legacy`); run on Windows with and without symbolic-link permission |
| 3 | Install with and without `agent-companies` listed (AC-10.3); unplug the network once (AC-10.4) |
| 4 | Build twice, compare output (AC-11.1); skill-list size recorded against the phase 0 baseline |
| 5 | Highest risk: rehearsal first; `plan` shows the exact `settings.json` diff; confirm backup of `~/.claude/settings.json`; Codex `AGENTS.md` below 32 KiB; session-start re-render once with a changed `path` source; drill `uninstall --restore` |
| 6 | KB as `path` source and as `git` source give identical content (AC-13.8) |
| 7 | Pin and tag round trip (AC-14.1); open an SDLC and a non-SDLC project |
| 8 | Step 3 must show an empty difference (AC-15.2) |

- **Rejected:** a Mac-only run (Windows link behaviour is the main platform difference); skipping the runbook for checks-only phases (FR-043 requires it, and it costs minutes).
- **Confidence:** high. **Supersedes:** none. **Decided by:** devops · **Approved at:** pending G3.

## Reliability, observability and operations

| Topic | Decision | Rule |
|---|---|---|
| Service level | No SLO: this is a local tool, not a user-facing service. Recovery objective: back to the previous working state in one command, under 5 minutes, with no network for every row in DR-205 except the last | Q-REL-1 not applicable, Q-REL-10, Q-REL-11 |
| Concurrency | `install.lock` (DR-202). Three agents starting at once must not each re-render: the session-start hook only tries the lock and skips if held | DS-12 |
| Remote calls | Every git operation: no interactive prompt (`GIT_TERMINAL_PROMPT=0`), 60 s timeout, one retry after 2 s on a network error only. A private or unreachable source fails with the cause (AC-3.4, AC-10.4); never loops | DS-2, DS-3 |
| Idempotence | Rerun with unchanged input rewrites nothing (AC-7.1); an interrupted run is completed or restored | DS-4 |
| Hooks | The installer's hook commands call the installer by a stable path (`H/core/…`), always exit 0, have a short timeout, and never block a session (AC-16.9). Removed by `uninstall` | Q-REL-4 |
| Release observability | `install-state.json` records installer version and commit, run time, exit code and every component's SHA; `install.log` keeps the last 1 MB, one line per run, no secrets and no values of variables. `doctor --json` is the health signal for scripts and agents | RLS-8, OPS-R7 |
| Dependency health | Each repo's `check.sh` includes the audit command; the weekly schedule reruns it | FF-9 |
| Secrets | None in any repo, workflow or file the installer writes. Variable values stay in `variables.local.yaml` (outside every repo). Rendered copies hold the user name in real paths and are never tracked (AC-16.10) | OPS-R4, RLS-3 |
| Fitness functions this adds to delivery | FF-2 cycles (resolver and architecture map), FF-6 contract compatibility (exports against the last tag, contract majors), FF-7 consumer expectations (citations ⊆ exports, nightly against `main`), FF-9 dependency audit | review rubric OPS-R1, OPS-R6 |

## Inputs for the plan (P4 task authors)

- **P-1:** the store tree sits two folders below the home, and every relative citation target is computed for that depth (DR-202).
- **P-2:** apply order, journal and lock exactly as DR-202; the pure `plan` produces the journal.
- **P-3:** `contracts.pin` / `providers.pin` fetch steps in `scripts/check.sh` of every repo; this is the only cross-repo read at check time and both are pinned.
- **P-4:** the installer resolves `ref` to a SHA and compares with the lock; a moved tag fails naming the component.
- **P-5:** `doctor` prints references to old agent-home paths found in agent config files (supports DR-204), compatibility links still present (already AC-7.5), backup count and size, and degraded Windows links.
- **P-6:** the installer core must run on the declared floor (Node 18, A-2). The repo's TypeScript-by-type-stripping practice needs Node 24.12 or later, so either the installer is plain JavaScript or the floor rises. This is a tech-stack question, not decided here.
- **P-7:** `install.sh` / `install.ps1` check for Node first and, if missing, print the same style of need and exit 10 with nothing changed (no JSON in that case).
- **P-8:** all paths come from `HOME` / `USERPROFILE` and `AGENT_CONFIG_HOME`, never hard-coded, so CI can run in a throwaway home.

## Proposed spec amendments (for the Orchestrator, not made here)

- **A-D1:** `uninstall --restore` puts back every item in the newest `backup-manifest.json` that the install replaced (AC-7.6 today says backups remain and gives no way back; OPS-R2 asks for a rollback matching the plan). Without it, rolling back to the old installer loses V's seed-once variable values.
- **A-D2:** `installers/install.sh --legacy` kept through phase 5 plus one tag (FR-035 says the old installers keep working until phase 5; this fixes how they are reached after `install.sh` becomes the launcher).
- **A-D3:** AC-7.3 backups also cover V's two local files before `set`, `add` and `use` rewrite them (DR-203).

## Human steps (devops does not do these)

1. Create the three public repos under the same GitHub account before phases 3, 6 and 7; set branch protection (required check `check`, admins not enforced); enable secret scanning and push protection; optionally run the governance procedure (`init-github-governance`).
2. Create annotated tag `pre-022` at main `825ea82` before the phase 0 pull request merges (the worst-case rollback anchor) and the tags in DR-207 when each release is cut.
3. Confirm the home on first run (AC-2.1) and merge each phase (G5).
4. Confirm GitHub's free-minutes statement for public repos when the first repo is created.

## Unconfirmed (to test, then record in `copilot/knowledge/`, per the core rule; not recorded here because this task writes only this file)

- Windows: whether rename-over-existing works for directory links and junctions (assumed not); whether `windows-latest` runners can create symbolic links (assumed not guaranteed).
- Whether Codex and Copilot CLI follow a linked `~/.codex/AGENTS.md` (blueprint assumption; decides link vs copy in the Codex row).
- Free GitHub-hosted runner minutes on public repos for macOS and Windows runners.
- Tested: macOS rename over a directory symlink is a single replacing step (2026-11-13, Node v24.22.1, Darwin 25.1.0, local shell test).
