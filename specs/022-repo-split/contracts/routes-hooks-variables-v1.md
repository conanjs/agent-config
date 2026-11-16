# `routes/v1`, `hooks/v1`, `variables/v1`

All three are entries inside a `component.yaml`; the installer renders them into **generated**-class files (protected by `doctor`'s hash check, A-25). Routes and hooks are privileged (M-01).

## `routes/v1`

**Owner:** agent-config renderer · **Consumers:** Claude Code, Copilot CLI and VS Code, Codex · **Record:** DR-407 · **Spec:** AC-10.3, AC-12.1, AC-12.2, AC-12.5, FR-039

```yaml
routes:
  - id: company-kb                       # ^[a-z0-9][a-z0-9-]{0,63}$ (M-03)
    when: "Working on a repo listed in a company KB, or the company is named"
    read: companies/index.md             # a location path; rendered as the real path of the generated/ copy (DR-307)
    before-writing: frameworks/company-kb/index.md   # optional
outputs:                                 # generated class, never committed
  copilot: ~/.copilot/instructions/routes.instructions.md      # front matter applyTo: "**"
  claude-code: "one @<home>/generated/routes.md import line in ~/.claude/CLAUDE.md"
  codex: ~/.codex/AGENTS.md = core + routes, < 32 KiB, else install exits 1 naming the size (AC-12.2)
```

Rollout: a minimal renderer in phase 3 (pointing at source paths); from phase 5 routes point at rendered copies. A route is new or changed → consent (M-01, from phase 3). Stale on a machine: `doctor` compares a hash; the post-merge and session-start hooks re-render.

## `hooks/v1`

**Owner:** agent-config renderer · **Consumers:** `~/.claude/settings.json`, `~/.copilot/hooks/agent-config.json`, `~/.codex/hooks.json` · **Record:** DR-413 (with security M-01, M-09, M-14, M-15) · **Spec:** AC-12.1, AC-12.3, FR-039

```yaml
hooks:
  - id: workflow-graph-guard
    event: pre-tool                      # neutral: session-start | pre-tool | prompt-submit | stop; mapped in adapters/<name>/fields.yaml
    agents: [claude-code, copilot-cli, codex]
    command: "node {{AGENT_HOME}}/frameworks/agentic-sdlc/tools/workflow-graph/cli.mjs guard"
             # rendered at merge to the REAL home path (never a compatibility path, M-14), quoted per shell (M-15)
    matcher: null
```

| Id | Rule |
|---|---|
| HK-1 | Each merged entry is recorded in `install-state.json` by hash; the file gets no marker key (unknown keys may invalidate `settings.json`, unconfirmed) |
| HK-2 | The merge touches only installer-owned entries under `hooks` (and core's `statusLine`); unparsable file → exit 1, nothing written; hash re-checked before a temp-file rename; backup first (M-09) |
| HK-3 | `doctor` fails on a merged hook whose command path does not resolve; it warns only for agents absent from the machine (M-14) |
| HK-4 | `retired:` refuses to remove a compatibility link any merged hook command uses (M-14) |
| HK-5 | Every installer hook command ends with one machine-readable result line, exits 0 and has a short timeout; a guard hook keeps its own deny semantics (TR-8, DS-2) |
| HK-6 | A hook for an agent not installed is skipped |

Today's `$HOME/.copilot/…` hook commands are an unversioned v0 that changes incompatibly; compatibility links keep them resolving until every machine had the phase-5 merge and `doctor` finds no command under an old path (DR-417).

## `variables/v1`

**Owner:** agent-config · **Declared by:** the component whose docs use the variable · **Consumers:** installer, agents (read the rendered file) · **Record:** DR-414 (with security M-08, M-18) · **Spec:** FR-025, AC-6.1 to AC-6.6, AC-8.1

```yaml
# in a component.yaml
variables:
  - name: OTS_REPOS_ROOT
    description: Folder that holds the OTS repos
    required: true
    detect: { kind: dir-exists, candidates: ["~/workspace/ots"] }   # declarative only (M-18); a proposal, applied only after `set` (A-10)
---
# {{AGENT_HOME}}/variables.local.yaml (V's values; written by `set` after a backup; never tracked)
schema: variables-local/v1
values:
  LANGUAGE: English
  OTS_REPOS_ROOT: ~/workspace/ots
```

| Id | Rule |
|---|---|
| VR-1 | Output `generated/global-variables.md`: one table `| Variable | Value | Description | Declared by |`, `AGENT_HOME` first, exactly one row per variable of each enabled component (AC-6.2); `{{AGENT_HOME}}/global-variables.md` links to it |
| VR-2 | Two enabled components declaring one name with different descriptions: install fails naming both |
| VR-3 | `set NAME=value` for an undeclared name exits 1 naming the closest declared names (AC-6.3) |
| VR-4 | Variables are public values loaded by agents: `set` refuses names containing `TOKEN`, `SECRET`, `PASSWORD`, `APIKEY`, `API_KEY`, and values starting `ghp_`, `github_pat_`, `sk-`, `AKIA`, `xox`; `doctor` re-checks the rendered file (M-08) |
| VR-5 | First phase-2 install: values found in the old `~/.copilot/global-variables.md` are offered as proposals in NEEDS, the old file is backed up, V confirms with `set` (DR-414) |
| VR-6 | Missing required value: exit 10 with a "variables" need after any "components" need; nothing changed (AC-4.2) |
