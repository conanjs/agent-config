# `adapter-fields/v1`

What one platform's adapter knows: where it puts files, which fields it accepts and how it names hook events. A new platform is one new folder `adapters/<name>/fields.yaml` and nothing else (G3, AC-11.7). Record DR-410; spec AC-11.1, AC-11.2, AC-11.7.

| Field            | Value                                                                                                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner            | agent-config, `adapters/<name>/fields.yaml`                                                                                                                                |
| Consumers        | `build`, `doctor`                                                                                                                                                          |
| Versioning rule  | The contract major is pinned by components (FR-006). The adapter `version` is a separate major: removing a field bumps it, and it is stamped into the output.              |
| Missing or stale | A `verified` date that is old warns. Built output whose stamp names an adapter major that no longer matches fails `doctor` (AC-11.2) and the previous output stays linked. |

## Keys

| Key       | Meaning                                                                                                                                                    |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema`  | `adapter-fields/v1`                                                                                                                                        |
| `adapter` | an id, such as `copilot`                                                                                                                                   |
| `version` | the adapter major, a whole number of 1 or more                                                                                                             |
| `targets` | `agents` and `skills`: `folder` (starts with `~/`), `file` (a name pattern) and `link` (`per-entry` or `whole`)                                            |
| `fields`  | each with `name`, `applies-to` (`agent` or `skill`), `from` (the neutral values it maps from), `source`, `verified` (`YYYY-MM-DD`) and optional `enforced` |
| `events`  | optional: neutral hook event (`session-start`, `pre-tool`, `prompt-submit`, `stop`) to the platform's event name (DR-413)                                  |

A field's `source` is an official documentation address, https and without credentials (M-07), never a path in the knowledge base, so adapters keep no edge into agent-knowledge.

## Worked example

```yaml
schema: adapter-fields/v1
adapter: copilot
version: 1
targets:
  agents: { folder: ~/.copilot/agents, file: '{name}.agent.md', link: per-entry }
fields:
  - name: infer
    applies-to: agent
    from: { auto-delegate: false }
    source: https://docs.github.com/en/copilot/reference/custom-agents-configuration
    verified: 2026-11-10
    enforced: true
events: { session-start: sessionStart }
```
