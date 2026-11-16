# Installer interface (in-repo): commands, exit codes, `--json` report, `install-state/v1`

Not a cross-repo contract: these are agent-config's own interfaces, listed in its `INTERFACES.md` and `catalog-info.yaml` with a usage spec (`installers/core/interfaces/agent-config.usage.kdl`) and JSON Schemas for the report and the state file, checked against the code (CON-15, CON-16). Owner: `architecture` for shape, `engineering` for the code. Records: DR-303, DR-305, DR-306, DR-202, DR-205; security M-01, M-02, M-07, M-11.

## Entry points

`installers/install.sh` and `installers/install.ps1` find Node 24.12 or later (`NODE` override first, then `PATH`) and run `node installers/core/main.ts <command> [args]`, returning its exit code. Node runs the TypeScript file directly by type stripping: no build step. No Node: a one-line need and exit 10, nothing changed, no JSON (DR-107, P-7). `--legacy` (`-Legacy`) runs the old installer in `installers/legacy/` through phase 5 plus one tag (A-D2).

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

## Messages (the one catalogue, TR-5)

Every text the installer prints is in this table and nowhere else; the scenario files of phase 2 quote it by id and the code keeps it in the message catalog of `shared`. Strings pass through the redaction step first (M-07). Placeholders are in angle brackets; a path is printed as the system writes it (Windows with `\`).

**Grammar.** Text mode prints on standard output (a usage error on standard error), in this order: the home line, the status line, then the body. `install`, `plan`, `doctor`, `set`, `add`, `use` and `uninstall` print the home line and the status line; `init-component` (no home needed), a usage error and the entry scripts do not. Every line starts in lower case. A body line has one of five prefixes, and the prefix says the kind:

| Kind | Prefix | Example |
|---|---|---|
| need (exit 10) | `<n>. <kind>: <item>` block, in the order home, components, variables, privileged | `1. components: slot knowledge-storage` |
| failure | `error: ` (exit 1) | `error: tag moved: …` |
| warning | `warning: ` (the exit code is not changed) | `warning: component odd is skipped: …` |
| progress or result | a plain lead word and a colon or a verb: `component`, `updated`, `wrote`, `stored`, `backup:`, `retired:`, `left:`, `kept:`, `override:` | `updated kb: 3f2a…..9c1d…` |
| doctor finding | `error: <check>: <item>: <detail>` (exit 1) or `warning: <check>: <item>: <detail>` | `error: link-target-gone: <link>: the link target is gone` |

A need block is `<n>. <kind>: <item>`, then indented by three spaces: the detail, `satisfy: <command>`, and where they apply `proposal: <text>`, `suggested by <component>, unverified: <source>`, `component: <name>, commit: <sha or live>`, and the terminal line MG-10. `--json` carries the same fields; the table names the field.

| Id | Text | Exit | JSON field |
|---|---|---|---|
| MG-01 | `agent home: <home> (<source>, <confirmed or not confirmed>)`; a move: `agent home: <new> (<source>, not confirmed; recorded home: <old>)`. `<source>` is `default`, `AGENT_CONFIG_HOME` or `recorded`. First line of every run | - | `home.path`, `home.source`, `home.confirmed`, `home.recorded` (move only) |
| MG-02 | `status: <done, no-changes, needs-input or failed>`. Second line of every run | with the status | `status`, `exit` |
| MG-03 | The need block above; the header of the list is the status line, there is no other heading | 10 | `needs[]` of `{kind, item, detail, satisfy, ...}` |
| MG-04 | `1. home: <home>` / `   confirm the agent home` / `   satisfy: install (interactive) and answer yes`. Only this need is reported while the home is unconfirmed | 10 | need `kind: home` |
| MG-05 | A move: item `<new>`, detail `confirm moving the agent home from <old> to <new>`, same satisfy line | 10 | need `kind: home` |
| MG-06 | `<n>. components: slot <slot>` / `   contract <contract>, no provider` / `   satisfy: add <name> <source>` | 10 | need `kind: components` |
| MG-07 | `   suggested by <component>, unverified: <source url>` under the MG-06 block; the source is never part of a `satisfy` line or an `add` command (M-11) | 10 | need `suggested: {by, verified: false, source}` |
| MG-08 | `<n>. variables: <NAME>` / `   <description> (declared by <component>)` / `   satisfy: set <NAME>=<value>` / optional `   proposal: <text>` (a `detect` result or a value of the old `~/.copilot/global-variables.md`) | 10 | need `kind: variables`, `proposal` |
| MG-09 | `<n>. privileged: <item>` / `   <detail>` / `   component: <name>, commit: <sha or live>` / `   satisfy: install (interactive) and approve`. Items: `hook <id> (<agents>, <event>)` with the command in full as detail; `route <id>` with `when: <when>; read: <read>`; `service <name> (<kind>)` with `<command> <args>` | 10 | need `kind: privileged`, `component`, `commit` |
| MG-10 | `   an interactive terminal is needed; an answer from a pipe, a file or an environment variable is never accepted`. Printed under a home or privileged need only when the run has no interactive terminal (AC-4.7, M-11) | 10 | need `terminal: needed` |
| MG-11 | Questions at an interactive terminal; only the answer `yes` (trimmed, any case) counts, any other answer reports the need without MG-10: `use <home> as the agent home? (yes/no)`; `move the agent home from <old> to <new>? (yes/no)`; `approve these privileged changes? (yes/no)` | 10 on no | - |
| MG-12 | `usage: agent-config <command> [options]; commands: install, plan, doctor, set, add, use, init-component, uninstall`. On standard error; standard output is empty | 2 | `status: usage-error` |
| MG-13 | Entry script, no usable Node, one line on standard error, no JSON: `needs: Node 24.12 or later (none found). Install Node 24 from https://nodejs.org/ or set NODE to its path, then run install again.` or `... (found <version>). ...` | 10 | - |
| MG-14 | `component <name>: git <url> <ref> at <first 12 hex of the commit>`; `component <name>: path <path as listed> (live)` | 0 | `changes[]`, lock |
| MG-15 | `updated <name>: <old 12 hex>..<new 12 hex>` (`install --update`) | 0 | - |
| MG-16 | `wrote <folder>/component.yaml` (`init-component`) | 0 | - |
| MG-17 | `stored <NAME> in <path of variables.local.yaml>` (`set`; never the value). `set` rewrites the whole file, sorted by name, and drops comments written by hand | 0 | - |
| MG-18 | `backup: <absolute path of the backup folder>`, when the run made a backup | 0 | `backup` |
| MG-19 | Compatibility links: `retired: <path>` (the installer's own link was removed); `left: <path>: not the installer's own link`; `kept: <path>: used by a hook command`; uninstall: `left: <path>: edited since install` | 0 | `changes[]` |
| MG-20 | `override: <name>: local source <path> replaces public source <path>` (a line of `plan` and `install`) | 0 | `changes[]` |
| MG-21 | `warning: component <name> is skipped: <reason>`; reasons: `source type archive not supported in this release`, `no component.yaml in <folder>`, `slot <slot> is not in slots/v1`, `component.yaml is invalid: <reader sentence>`, `symlink <path> leaves the component root`. The run goes on | 0 | `findings[]` |
| MG-22 | `warning: component <name> has submodules; they are ignored` (M-05) | 0 | `findings[]` |
| MG-23 | `error: <path of the list> is invalid: <reader sentence>` (a whole list or the schema line of a file) | 1 | - |
| MG-24 | `error: dependency cycle: <a> -> <b> -> <a>` (starts at the smallest name) | 1 | - |
| MG-25 | `error: <consumer> needs <contract> from slot <slot>, but <provider> offers <contract>[, <contract>]` | 1 | - |
| MG-26 | `error: <consumer>: <file> cites <path>, which <provider> does not export` | 1 | - |
| MG-27 | `error: slot <slot> allows one provider but <p1> and <p2> both fill it; pick one with: use <name> <source>` | 1 | - |
| MG-28 | `error: component <name> needs node <range>, found <version without v>` | 1 | - |
| MG-29 | `error: tag moved: component <name>, tag <tag>, locked <40 hex>, now <40 hex>` | 1 | - |
| MG-30 | `error: another run holds the lock <path of install.lock> (<command>, started <ISO instant>)`. `install` and `uninstall` poll for at most 2 seconds, then print this and exit 1; `rerender` does not wait, prints nothing and exits 0. The lock file is one JSON line `{"command": "<name>", "pid": <number>, "started": "<ISO instant>"}`; it is stale after 10 minutes against the clock (the pid is informative only) and taken over; it is removed at the end of every run, also a failing one | 1 | - |
| MG-31 | `error: component <name>: path source folder <folder> does not exist` | 1 | - |
| MG-31.refused | `error: component <name>: path source folder <folder> is refused: <reason> (M-03)`: a path source that is a file system root, the user's home folder or a folder that holds it | 1 | - |
| MG-32 | `error: component <name>: cannot fetch git source <url> (ref <ref>)` then `   cause: <error text of the fetch>`; the previous link stays | 1 | - |
| MG-33 | `error: <folder>/component.yaml already exists; init-component never overwrites a manifest` | 1 | - |
| MG-34 | `error: component <name> has a source URL with credentials; keep credentials in git's credential helper or ssh-agent (M-07)`; for `add`: `error: refused to add <name>: the source URL has credentials; keep credentials in git's credential helper or ssh-agent (M-07)`. No part of the URL is printed | 1 | - |
| MG-35 | `add` refusals: `error: refused to add <name>: a source cannot start with a dash (M-05)`; `error: refused to add <name>: the source must be an https or ssh git address or an absolute folder (M-05)`; `error: component name <name> is not valid: use lowercase letters, digits and hyphens, at most 64 (M-03)` | 1 | - |
| MG-36 | `set` refusals, the secret check first and the value never printed: `error: refused to store <NAME>: the name contains <TOKEN, SECRET, PASSWORD, APIKEY or API_KEY>; variables are public values that every agent reads (M-08)`; `error: refused to store <NAME>: the value starts with <prefix>; variables are public values that every agent reads (M-08)`; `error: <NAME> is not declared by any enabled component` then `closest declared names: <n1>, <n2>, <n3>` (Levenshtein distance 3 or less, nearest first, at most 3, ties alphabetical) | 1 | - |
| MG-37 | A check of the staged trees fails: `error: check failed: <check>: <item>: <detail>`; `schema: <component>: component.yaml is not a valid component/v1 manifest`; `exports: <component>: exported path <path> does not exist`; `variables: <NAME>: <component a> says "<description a>", <component b> says "<description b>"` (components in name order) | 1 | - |
| MG-38 | `error: install failed: <what>` then `   cause: <error text>`, for a failure no check names, for example `error: install failed: cannot create links` | 1 | - |
| MG-39 | Doctor findings, one line each, `error:` ones make the run exit 1: `link-target-gone: <link>: the link target is gone`; `hash-differs: <file>: differs from install-state.json`; `lock-no-source: <component>: components.lock lists it but no list does`; `manifest-invalid: <component>: component.yaml is not a valid component/v1 manifest`; `manifest-missing: <component>: no component.yaml in <folder>`; `variable-missing: <name>: required by <component> and has no value`; `path-source-missing: <component>: path source folder <folder> does not exist`; `symlink-escape: <link>: leaves the component root`; `interrupted-install: <journal path>: restored to the previous state`. Warnings: `not-version-controlled: <component>: <path> is not in a git repository (not version-controlled)`; `compat-link: <link>: compatibility link still present`; `permissions: <path>: readable by others`; `old-agent-home-path: <file>: names ~/.copilot/knowledge`; `backups: 1 backup, <size>` for one backup and `backups: <n> backups, <size>` for any other number (two rows of the catalogue, no "(s)"). Written as `<severity>: <check>: <item>: <detail>` (MG grammar above) | 1 or 0 | `findings[]` of `{severity, check, item, detail, fix}` |
| MG-40 | Script outputs, not the installer: `scripts/check-local-files.ts` prints `error: <path> is tracked by git` or `error: <path> is staged for commit` (exit 1) or `ok: no local file is tracked or staged`; `scripts/check-copilot-paths.ts` prints `copilot paths: <n> lines in <f> files (agent-home <a>, copilot-own <o>), baseline agent-home <b>` and `new agent-home line: <file>:<line>: <text>` | 1 or 0 | - |
| MG-41 | `error: agent home <path> is refused: <reason>`: `AGENT_CONFIG_HOME`, the recorded home or the default home is a file system root, the user's home folder or a folder that holds it (by path or by file identity), not absolute, or has a control character (M-03) | 1 | - |
| MG-42 | `error: the value of <NAME> is refused: <reason>`: `set` of a value that is empty, over 1024 characters, has a control, bidi or invisible character, credential-like text or a credential shape (M-08); the value is never printed | 1 | - |
| MG-43 | `warning: component <name>: <file>: <sentence>`: an unknown key the reader ignores (CM-1, CON-10) | 0 | - |
| MG-44 | `error: component <name> needs <tool> <range>, found <version>`: a declared runtime other than node that is not met (git, AC-5.9); node keeps MG-28 | 1 | - |
| MG-45 | `error: component <name>: suggested source refused: it contains credential-like text`: a `suggest` source that redaction would change is never shown (M-07, M-11) | 1 | - |

Install state files named here: `install.lock` (MG-30), `install-log.jsonl` (one line per run with `time`, `command`, `exit`, `components`, `approved_privileged`; rotated at 1 MiB to `install-log.jsonl.1`, M-16).
