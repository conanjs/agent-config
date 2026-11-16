# `agent-source/v1`

The source of one agent: `agents/<name>/agent.yaml` and `body.md`. The build writes one file per platform from intent fields, so there are no hand-written per-platform copies. Record DR-409; spec AC-11.1, AC-11.3, AC-11.4.

| Field            | Value                                                                                                                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner            | agent-config (providers: agentic-sdlc for `sdlc-*`, agent-config for `foundry-*` and `windows-software`)                                                                                             |
| Consumers        | `build`                                                                                                                                                                                              |
| Versioning rule  | Pinned by major only (FR-006); readers read the current and previous major. Removing or renaming a key is a new major; a new optional key is not. Unknown keys warn (CON-10).                        |
| Missing or stale | Codex cannot restrict tools, so the build warns; Claude Code warns above 15,000 tokens of descriptions. Built output whose stamp no longer matches fails `doctor`; the previous output stays linked. |

## Keys

| Key                          | Meaning                                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| `schema`                     | `agent-source/v1`                                                                                        |
| `name`                       | an id (M-03)                                                                                             |
| `description`                | the text an agent sees to decide whether to delegate                                                     |
| `model-tier`                 | an id naming the tier, for example `top`; each adapter maps it to a model                                |
| `auto-delegate`              | true or false; false becomes Copilot CLI `infer: false` and VS Code `disable-model-invocation` (AC-11.3) |
| `needs-project-instructions` | optional; becomes `include-custom-instructions: true`                                                    |
| `preload`                    | optional ids of skills; Claude `skills:`, an include in the Codex body                                   |
| `tools.intent`               | optional list of `read`, `search`, `edit`, `shell`                                                       |
| `targets`                    | one or more of `claude`, `copilot`, `codex`                                                              |
| `platforms`                  | optional overlays by target                                                                              |

Linked entry by entry into `~/.claude/agents`, `~/.codex/agents` and `~/.copilot/agents` (Copilot's own folder, AC-8.2).

## Worked example

```yaml
schema: agent-source/v1
name: sdlc-system-architecture
description: 'Agentic SDLC System Architecture role.'
model-tier: top
auto-delegate: false
needs-project-instructions: true
preload: [sdlc-system-architecture-preset]
tools: { intent: [read, search, edit, shell] }
targets: [claude, copilot, codex]
```
