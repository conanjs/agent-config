# Data model: agent-config as a motherboard of replaceable components (spec 022)

**Phase:** P4 · **Run:** R-001 · **Written:** 2026-11-13 by `architecture` · **Gate:** G3 (pending)

The entities the installer, the build tool and `doctor` read and write, with their fields, invariants and state changes. Terms are the spec's Key Entities (DDD-1). The field-level shapes of the published files are in [contracts/](contracts/README.md); this file says how the entities relate and what must always hold. Files V edits are YAML; files the installer writes are JSON with sorted keys (DR-104). Every `schema:` value is `name/vN`, pinned by major (FR-006).

## 1. Overview

```
slots.yaml ──defines──▶ Slot ──has──▶ Location (mount)
                         ▲
components.yaml ─┐       │ fills (by name in its own manifest)
components.local ┴─▶ ListEntry ──source──▶ Source ──acquire──▶ StoreTree ──holds──▶ Component (component.yaml)
                                              │                                      │ provides: Export, Route, Hook, Service, Skill, Agent
                                              ▼                                      │ depends: SlotDependency (+ generated docs)
                                         LockEntry                                   │ declares: VariableDeclaration
                                                                                     ▼
resolver(Components, Slots, Lock, VariableValues) ──▶ Resolution ──planner──▶ Plan (Operations) ──apply──▶ InstallState entries
                                       │                                       │                         (linked | rendered | generated | compat)
                                       └──▶ Needs (components, then variables, then privileged changes) ─▶ exit 10
```

## 2. Configuration entities (published or human-edited)

### Slot (`slots/v1`, `contracts/slots.yaml`)

| Field | Type | Rule |
|---|---|---|
| `name` | id | Unique; `core`, `knowledge-storage`, `company-knowledge-storage`, `framework` today |
| `reserved` | bool | `true` only for `core`: filled by agent-config's own manifest; a list entry naming it is an error |
| `contract` | string or list | A list means the filler offers **all** of them (DR-401) |
| `required`, `multiple` | bool | Replace the draft `count`; `count` or `mounts` is rejected naming the replacement (AC-1.3) |
| `scope` | `global` \| `per-project` | A component may narrow it, never widen it |
| `self-contained` | bool | `true` for `knowledge-storage`: fillers cite no other component (DR-404) |
| `locations[]` | Location | At least one |

**Location**: `name` (id), `mount` (path relative to the home; `{component}` allowed for per-project slots), `required` (bool, default true), `shared` (bool: linked entry by entry, DR-416), `index` (`provided` \| `generated` \| absent).

Invariants: mounts are unique across all slots' locations; no mount is a prefix of another except where the longer one belongs to a different slot (citation classification picks the longest, AC-5.10); `index.md` sits at the root of the `content` location.

### Component (`component/v1`, `component.yaml` at a component's root)

| Field | Type | Rule |
|---|---|---|
| `name` | id `^[a-z0-9][a-z0-9-]{0,63}$` | Unique across both lists (M-03) |
| `version` | semver | The component's own version; `CHANGELOG.md` records it |
| `slot` | slot name | One slot from `slots/v1`; unknown → only this component skipped (AC-5.8) |
| `repository` | GitHub URL | Required when `provides.exports` is not empty (AC-9.7, A-23); no user-info part (M-07) |
| `scope` | `global` \| `per-project` | Narrows the slot's scope |
| `contracts.pin` | major | The motherboard contracts major this file is written against |
| `locations` | map location name → relative folder | Covers every required location of its slot (settles A-4); relative, no `..`, drive letter, `\` or NUL (M-03) |
| `provides.contracts` | list of `name/vN` | N and N-1 may both appear during a migration |
| `provides.index` | relative path | Entry point inside the content (or only) location |
| `provides.exports` | list of location paths | Citable docs; removing or renaming one is a major version (AC-13.2) |
| `provides.skills`, `provides.agents` | relative folders | `skill-source/v1`, `agent-source/v1` sources |
| `provides.services` | list | Optional, for example an MCP server (AC-12.7); privileged (M-01) |
| `depends.slots[]` | SlotDependency | `slot`, `contract`, `required`, `suggest` (shown only, never fetched, AC-4.5), `docs` (**generated** by `build cite --write`; a hand edit that differs fails, FR-017) |
| `depends.runtime` | map | For example `node: ">=18"`, checked before apply (AC-5.9); the installer adds `git: ">=2.50.1"` for `git` sources (M-05) |
| `routes[]` | Route | `routes/v1` entries; privileged |
| `hooks[]` | HookEntry | `hooks/v1` entries; privileged |
| `variables[]` | VariableDeclaration | `variables/v1` declarations; public values only (M-08) |
| `idle-cost` | map agent id → characters | Ceiling of always-loaded text per agent (G10) |

Unknown keys warn (tolerant reader, CON-10). A component needs nothing but a folder with a valid manifest (FR-021).

### ListEntry (`components-list/v1`: `components.yaml` and `{{AGENT_HOME}}/components.local.yaml`)

`name` + `source` only; the slot comes from the component's own manifest. The local list has `local: true`, is never tracked (AC-3.8), is written only by V, `add` or `use`, and wins by name over the public list (FR-019).

**Source** (tagged union by `type`):

| `type` | Fields | Lock records | Notes |
|---|---|---|---|
| `git` | `url` (`https` or `ssh`), `ref` (branch or tag) | `commit` (40 hex), and `tag` when `ref` is a tag | Managed clone in `components/<name>/` (cache); `install` stays on the locked commit; `install --update` advances (M-02) |
| `path` | `path` | `live: true`, the absolute path | Linked live, no copy, no rollback; `doctor` warns "not version-controlled" |
| `archive` | `url`, `sha256` | `sha256` | Recognised and refused in this release (AC-3.7) |

### VariableDeclaration and VariableValue (`variables/v1`)

Declaration (in the declaring component's manifest): `name` (upper snake case), `description`, `required`, optional `detect` (declarative only: `env` name or `dir-exists` candidates inside the home or the user's folders; never a command, M-18). Values live in `{{AGENT_HOME}}/variables.local.yaml` (`variables-local/v1`), written by `set` after a backup (A-D3). Invariants: one declaration per name across enabled components (two with different descriptions fail install); names and values that look like secrets are refused (M-08); `AGENT_HOME` is computed by the installer, never stored.

### Route, HookEntry, Service

| Entity | Fields | Delivered as |
|---|---|---|
| Route | `id`, `when` (prose), `read` (location path), optional `before-writing` | One line per route in the generated routes outputs (Copilot routes file, Claude import, Codex `AGENTS.md`) |
| HookEntry | `id`, `event` (neutral: `session-start`, `pre-tool`, `prompt-submit`, `stop`), `agents[]`, `command` (with `{{AGENT_HOME}}`, rendered to the real path and quoted per shell, M-15), `matcher` | A merged entry in each agent's hook file, recorded in install state by hash (DR-413) |
| Service | `kind` (`mcp`), `name`, `command`, `args[]` | Registered per agent at install, removed by `uninstall` |

All three are **privileged**: a new or changed one stops `install` with a consent need (M-01).

### Citation and Export

A **Citation** is a Markdown link in a component's file. Source form: link text `{{AGENT_HOME}}/<location path>`, target the GitHub address generated from the provider's `repository` (`<repository>/blob/<default branch>/<folder>/<path>`). Classification: the longest slot mount that prefixes the location path names the provider's slot; no match fails; a bare relative path is the component's own file (AC-5.10). Rendered form: text = the real absolute path with the system's separators; target = the relative path from the copy's `generated/` folder to the cited file's mount path, `/` separators, spaces encoded (A-20, DR-307). A placeholder path such as `companies/<co>/` is not a citation (A-24).

An **Export** is a location path in `provides.exports`. Invariant: every cross-component citation cites an export of the provider filling that slot (FF-3); the knowledge-storage filler has no cross-component citations at all (self-contained).

## 3. Machine-owned entities (written by the installer only)

### LockEntry (`components-lock/v1`, `{{AGENT_HOME}}/components.lock`, JSON)

Per component name: `source` (as resolved from the lists), `resolved` (`{commit, tag?}` \| `{live: true, path}` \| `{sha256}`), `manifest` (`version`, `slot`, `contracts`), `build` (`null` or `{source_sha, build: <major>, adapters: {claude: <major>, agents: <major>}}`), `store_id` (the `<id>` of its current store tree). The lock lives in the home, never in a repo (DR-403). A locked tag that now resolves to another commit fails (P-4).

### StoreTree

`{{AGENT_HOME}}/store/<name>@<id>/`, `<id>` = first 12 hex characters of a hash over (source revision, home path, renderer version, adapter version). Immutable after creation; read-only when rendered or built. Exactly two levels below the home (DR-202, DR-307). Kept: the current and the previous per component; older trees pruned.

### InstallStateEntry (`install-state/v1`, `{{AGENT_HOME}}/install-state.json`, JSON)

| Field | Meaning |
|---|---|
| `path` | Absolute path the installer placed (a link, a file, or an entry inside a shared file) |
| `class` | `linked` \| `rendered` \| `generated` \| `compat` (FR-015, DR-204) |
| `kind` | `symlink` \| `junction` \| `copy` \| `file` \| `merged-entry` (the Windows ladder reports `degraded` for anything below a symbolic link) |
| `target` | For links: the target path. For files: none |
| `hash` | SHA-256 of the content written (files, copies, merged entries) |
| `component` | Owning component name |
| `privileged` | Whether the entry is in the privileged set (M-01) |
| `retires` | For `compat`: the release that retires it |
| `read_only` | For `rendered`: expected `true` |

Run-level fields: `installer` (version, commit), `home` (the confirmed home path), `approved_privileged_hash`, `last_run` (time, command, exit code), `components` (name → commit or `live`). Invariants: every path the installer placed has exactly one entry; `uninstall` removes only entries whose current content still matches `hash` (FR-030); a newer `install-state` major is refused, never rewritten (DR-205).

### Plan and Operation (in memory; DR-306)

`Plan` = `{ home, needs[], operations[], privileged_changes[], summary }`. **Operation**: `op` (`backup` \| `link` \| `write` \| `chmod` \| `remove` \| `merge-entry`), `path`, `target` or `content_hash`, `class`, `component`, `privileged`, `reason`. Invariants: the plan is computed without any write; applying it and diffing the file system gives exactly its operations (TR-4); a plan with any need is never applied.

**Journal** (`{{AGENT_HOME}}/install-state.pending.json`): the plan's link and write operations with each path's old target or old hash, written before the switch and deleted at the commit point (DR-202 steps 7 to 9).

### Need (the NEEDS report, exit 10)

`{ kind: home | components | variables | privileged, item, detail, satisfy }`. Ordering: home confirmation first, then components (sources), then variables, then privileged changes (FR-018, AC-4.2; M-01). `satisfy` is the exact command for installer-made needs; for text that comes from a component (a `suggest` source) it is shown as "suggested by `<component>`, unverified" and never as a ready-to-run command (M-11).

### Finding (`doctor`)

`{ severity: fail | warn, check, item, detail, fix }`. `fix` names the source file to edit for rendered-copy drift (AC-16.6). Faults (exit 1) and warnings (exit 0) are those of AC-7.5 plus the amendments S-6, S-7, S-9 and D-5.

### Backup and BackupManifest

`~/.agent-config-backups/<yyyyMMddHHmmss>/`, created on the first backup of a run, owner-only (M-10), never deleted by a command. `backup-manifest.json`: per item `original`, `backup`, `kind` (`file` \| `folder` \| `link`), `hash`. `uninstall --restore` returns the newest manifest's items (A-D1).

### InstallLogEntry

`{{AGENT_HOME}}/install-log.jsonl`, one line per run: `time`, `command`, `exit`, and per changed component `name`, `source` (redacted), `commit_before`, `commit_after`, plus `approved_privileged` ids. Rotated at 1 MB keeping one previous file. No variable values (C-4, M-16).

### BaselineRecord (phase 0, AC-1.7)

Per agent (`claude-code`, `copilot-cli`, `codex`): `characters` (rendered, Unicode code points), `tokens_estimate` (marked estimate), `agent_home_lines` (count in the files that agent loads), `method`, `tool_version`, `node_version`, `date`, `commit`; for Claude Code also the skill-list figure and its `sdlc-*` share. Produced by `build budget --baseline` (DR-304) with the same render rules as the phase-5 renderer (A-28).

## 4. State transitions

### One `install` run

```
start ──▶ take install.lock ──(held)──▶ wait or exit 1
  │
  ▼
read (lists, manifests, slots, lock, values, state) ──(home unconfirmed)──▶ Need(home) ──▶ exit 10, nothing written
  │
  ▼
resolve (pure) ──(needs)──▶ NEEDS report ──▶ exit 10, nothing written
  │
  ▼
plan (pure) ──(privileged changes not approved)──▶ Need(privileged) ──▶ exit 10, nothing written
  │
  ▼
acquire into cache and new store trees ──▶ validate staged trees ──(any check fails)──▶ fixed-point fallback (DR-418)
  │                                                                     └─(still failing)──▶ delete new trees, exit 1
  ▼
backup ──▶ write journal ──▶ switch links ──▶ commit (lock + install-state) ──▶ prune ──▶ report, exit 0
  ▲                              │
  └──── next install or doctor ◀─┘ (crash: journal found → restore old targets, then continue)
```

### Compatibility link (DR-204, DR-417)

`absent` → (phase 2 install) `present, class compat, retires: vX` → (release vX lists it under `retired:`, the link is still the installer's own, no merged hook command uses it, the DR-204 search found nothing) `removed`. A real file at that path is left and reported (AC-8.3).

### Rendered copy (DR-406)

`absent` → (install renders) `current, read-only` → (source changes) `stale` → (session-start hook or install re-renders) `current`. `current` → (V lifts read-only and edits) `edited` → `doctor` fails naming the source → (install) `current`. A failed re-render keeps the previous `current` copy and leaves `doctor` failing (AC-16.9).

### Privileged set (M-01)

`approved(hash H)` → (a manifest change adds or alters an entry) `pending` → `install` exits 10 → (V approves at an interactive terminal) `approved(hash H')`. The session-start and post-merge hooks never move `pending` to `approved`.

## 5. Ownership (single writer per data set, DS-9)

| Data | Single writer |
|---|---|
| `slots.yaml`, `components.yaml`, contracts, core's `component.yaml` | agent-config (pull requests) |
| Each other `component.yaml` and its content | that component's repo |
| `components.local.yaml`, `variables.local.yaml` | V, `add`, `use`, `set` |
| Lock, install state, journal, log, `store/`, `generated/`, compatibility links | the installer on that machine |
| `~/.claude/settings.json`, Codex and Copilot hook files | V; the installer owns only the entries the install state records |
| Backups | the installer creates, V deletes |
