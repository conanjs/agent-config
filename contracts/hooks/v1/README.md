# hooks/v1

A hook is a command an agent runs on an event, such as "before every tool call". A component declares its hooks with neutral event names; the installer merges them into each agent's own hook file.

|           |                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------- |
| Owner     | agent-config renderer                                                                           |
| Consumers | `~/.claude/settings.json`, `~/.copilot/hooks/agent-config.json`, `~/.codex/hooks.json`          |
| Record    | DR-413, with security M-01, M-09, M-14, M-15; spec AC-12.1, AC-12.3, FR-039                     |
| Files     | the `hooks:` list of a `component.yaml`, or the same list as a document with `schema: hooks/v1` |

## Fields

| Key       | Required | Rule                                                                                                                                    |
| --------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `id`      | yes      | Id allow-list (M-03)                                                                                                                    |
| `event`   | yes      | `session-start`, `pre-tool`, `prompt-submit` or `stop`; mapped to each platform's name in `adapters/<name>/fields.yaml`                 |
| `agents`  | no       | Any of `claude-code`, `copilot-cli`, `codex`; absent means all three                                                                    |
| `command` | yes      | May start with `{{AGENT_HOME}}`; at merge it becomes the real home path, never a compatibility path (M-14), quoted for the shell (M-15) |
| `matcher` | no       | Text or `null`; which tool the event applies to                                                                                         |

## Rules

| Id   | Rule                                                                                                                                                                                                                                                             |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HK-1 | Each merged entry is recorded in `install-state.json` by hash; the agent file gets no marker key (an unknown key may invalidate `settings.json`, unconfirmed)                                                                                                    |
| HK-2 | The merge touches only installer-owned entries under `hooks` (and core's `statusLine`); a file that does not parse exits 1 and nothing is written; the hash is checked again before the temporary file replaces the real one; a backup comes first (M-09)        |
| HK-3 | `doctor` fails on a merged hook whose command path does not resolve; it only warns for agents absent from the machine (M-14)                                                                                                                                     |
| HK-4 | `retired:` refuses to remove a compatibility link that a merged hook command still uses (M-14)                                                                                                                                                                   |
| HK-5 | Every installer hook command ends with one machine-readable result line, exits 0 and has a short timeout; a guard hook keeps its own deny meaning (TR-8, DS-2). The session-start re-render hook does no network work and stops under its own time budget (M-13) |
| HK-6 | A hook for an agent that is not installed is skipped                                                                                                                                                                                                             |

The schema checks the shape of each entry. Rules HK-1 to HK-6 are enforced by the installer and `doctor`.

## Worked example

```yaml
schema: hooks/v1
hooks:
  - id: workflow-graph-guard
    event: pre-tool
    agents: [claude-code, copilot-cli, codex]
    command: node {{AGENT_HOME}}/frameworks/agentic-sdlc/tools/workflow-graph/cli.mjs guard
    matcher: null
```

On a Mac with the home at `/Users/v/.agent-config`, the Claude Code entry runs `node /Users/v/.agent-config/frameworks/...`; on Windows the path is `C:\Users\v\.agent-config\...`, quoted for PowerShell.

Today's `$HOME/.copilot/...` hook commands are an unversioned v0 that changes incompatibly; compatibility links keep them resolving until every machine has had the phase 5 merge and `doctor` finds no command under an old path (DR-417).

## Versioning rule

A component pins the major only (FR-006, "functional requirement 6"). A reader accepts the current major and the previous one (`v1` and `v0` when `v2` ships). Adding an optional key is not a new major; removing a key, renaming one or tightening a rule is. A major bump goes in this order: the reader first, then providers, then consumers, and the old major is dropped when `doctor` shows nobody still uses it (DR-418). Unknown keys never fail a file: the reader warns and ignores them (CON-10).

## When it is missing or stale

- A new or changed hook needs V's consent before it is merged (M-01): `install` exits 10 with a "privileged changes" need and writes nothing. The session-start and post-merge hooks never change the privileged set.
- An unresolvable merged hook command makes `doctor` fail (M-14). Claude Code treats any exit code except 2 as non-blocking, so a missing guard script would otherwise turn the guard off silently.

## Examples

`examples/valid/` and `examples/invalid/` are shared with the parity test.
