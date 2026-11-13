# Installer interface (in-repo): commands, exit codes, `--json` report, `install-state/v1`

Not a cross-repo contract: these are agent-config's own interfaces, listed in its `INTERFACES.md` and `catalog-info.yaml` with a usage spec (`installers/core/interfaces/agent-config.usage.kdl`) and JSON Schemas for the report and the state file, checked against the code (CON-15, CON-16). Owner: `architecture` for shape, `engineering` for the code. Records: DR-303, DR-305, DR-306, DR-202, DR-205; security M-01, M-02, M-07, M-11.

## Entry points

`installers/install.sh` and `installers/install.ps1` find Node ≥ 18 (`NODE` override first, then `PATH`) and run `node installers/core/main.mjs <command> [args]`, returning its exit code. No Node: a one-line need and exit 10, nothing changed, no JSON (DR-107, P-7). `--legacy` (`-Legacy`) runs the old installer in `installers/legacy/` through phase 5 plus one tag (A-D2).

## Commands

| Command | Does | Writes |
|---|---|---|
| `install [--update [<name>]] [--json]` | read → resolve → plan → apply → report. Without `--update`, stays on the lock (M-02) | home, agent folders, backups |
| `plan [--json]` | The same up to the plan; prints every link and generated file that would change and the privileged changes | nothing (AC-7.4) |
| `doctor [--json]` | Faults (exit 1) and warnings (exit 0) of AC-7.5 and amendments S-6, S-7, S-9, D-5; restores from a journal if one is found | only a journal restore |
| `set NAME=value` | Stores a value in `variables.local.yaml` after a backup; refuses secret-like names and values (M-08) | `variables.local.yaml`, backup |
| `add <name> <source>` | Appends a component to the local list | `components.local.yaml`, backup |
| `use <name> <source>` | Overrides the source of a known name in the local list | `components.local.yaml`, backup |
| `init-component <path>` | Writes a starter `component.yaml` that passes the schema check; refuses if one exists (AC-3.6) | `<path>/component.yaml` |
| `uninstall [--restore]` | Removes every recorded entry whose content still matches its hash; never follows links (M-03); `--restore` returns the newest backup manifest's items (A-D1) | home, agent folders |
| `rerender` (hook only) | Session-start and post-merge re-render of changed components; never changes the privileged set; ≤ 5 s; exit 0 always (M-01, M-13) | `generated/`, `store/` |

Phase 7 adds `enable <project>` and `disable <project>` (`framework/v1`).

**Consent** (M-11): the first-run home confirmation, a home move and privileged-change approval are asked only at an interactive terminal; without one the run exits 10 with the need. A NEEDS item from component text is labelled "suggested by `<component>`, unverified" and never printed as a ready-to-run command.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Done (also "no changes"); `doctor` with warnings only |
| 10 | Needs input: home confirmation, components, variables or privileged changes, in that order; nothing changed |
| 1 | A check failed; the previous state stays linked |
| 2 | Unknown command or flag; one usage line (A-8) |

## `--json` report (one document on standard output; standard error carries no JSON, AC-4.3)

```yaml
schema: install-report/v1
command: install
status: needs-input                  # done | no-changes | needs-input | failed | usage-error
exit: 10
home: { path: /Users/v/.agent-config, confirmed: false, source: default }   # default | AGENT_CONFIG_HOME | recorded
needs:                               # ordered: home, components, variables, privileged
  - { kind: home, item: /Users/v/.agent-config, detail: "confirm the agent home", satisfy: "install (interactive) and answer yes" }
  - { kind: components, item: "slot knowledge-storage", detail: "contract knowledge-provider/v1, no provider",
      satisfy: "add <name> <source>", suggested: { by: agentic-sdlc, verified: false, source: "https://github.com/…" } }
  - { kind: variables, item: OTS_REPOS_ROOT, detail: "Folder that holds the OTS repos (declared by agent-companies)",
      proposal: ~/workspace/ots, satisfy: "set OTS_REPOS_ROOT=<value>" }
  - { kind: privileged, item: "hook workflow-graph-guard (claude-code, pre-tool)", detail: "<command in full>",
      component: agentic-sdlc, commit: 9c1d…, satisfy: "install (interactive) and approve" }
changes: []                          # plan operations: { op, path, target|hash, class, component, privileged }
findings: []                         # doctor: { severity, check, item, detail, fix }
backup: null                         # the backup folder of this run, when one was made
```

Every string passes through one redaction step (user-info and token query parts, M-07) and one message catalog (TR-5) before it is printed, in text or JSON.

## `install-state/v1` (`{{AGENT_HOME}}/install-state.json`, internal state)

```yaml
schema: install-state/v1
installer: { version: 0.2.0, commit: 825ea82… }
home: /Users/v/.agent-config
approved_privileged_hash: 5be1…
last_run: { time: 2026-11-20T09:14:03+07:00, command: install, exit: 0 }
components: { agent-knowledge: 3f2a…, agentic-sdlc: 9c1d…, core: live }
entries:
  - { path: /Users/v/.agent-config/knowledge, class: linked, kind: symlink, target: /Users/v/.agent-config/store/agent-knowledge@9a41c0d2e7f1, component: agent-knowledge, privileged: false }
  - { path: /Users/v/.agent-config/generated/agentic-sdlc, class: rendered, kind: symlink, target: ../store/agentic-sdlc@1c0b77e2a9d3, component: agentic-sdlc, privileged: false, read_only: true }
  - { path: /Users/v/.claude/settings.json#hooks.PreToolUse[workflow-graph-guard], class: generated, kind: merged-entry, hash: 77d0…, component: agentic-sdlc, privileged: true }
  - { path: /Users/v/.copilot/knowledge, class: compat, kind: symlink, target: /Users/v/.agent-config/knowledge, component: core, privileged: false, retires: v1.0.0 }
```

Written as JSON with sorted keys at the commit point of a run (DR-104, DR-202). A newer major is refused with exit 1, never rewritten (DR-205). The journal `install-state.pending.json` has the same entry shape plus `old_target` or `old_hash`.
