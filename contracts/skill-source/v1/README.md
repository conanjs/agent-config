# `skill-source/v1`

The source of one skill: `skills/<name>/skill.yaml`, `body.md` and `references/`. The build turns it into one `SKILL.md` per discovery folder. Record DR-408; spec FR-038, FR-047, AC-11.1, AC-11.5, AC-11.8, AC-12.4.

| Field            | Value                                                                                                                                                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner            | agent-config (providers: agent-config, agentic-sdlc)                                                                                                                                                                                                       |
| Consumers        | `build`                                                                                                                                                                                                                                                    |
| Versioning rule  | Pinned by major only (FR-006); readers read the current and previous major. Removing or renaming a key is a new major; a new optional key is not. Unknown keys warn (CON-10).                                                                              |
| Missing or stale | The same skill name from two components: the second fails, naming both (AC-11.8). A `{{include:<path>}}` whose file is missing fails with its path (AC-11.5). Built output whose stamp no longer matches fails `doctor`; the previous output stays linked. |

## Keys

| Key           | Meaning                                                                              |
| ------------- | ------------------------------------------------------------------------------------ |
| `schema`      | `skill-source/v1`                                                                    |
| `name`        | an id: `^[a-z0-9][a-z0-9-]{0,63}$` (M-03)                                            |
| `description` | the text an agent sees to decide whether to load the skill                           |
| `targets`     | one or more of `claude` (`~/.claude/skills`) and `agents` (`~/.agents/skills`)       |
| `metadata`    | optional custom data, emitted only where an adapter maps it                          |
| `fields`      | optional common standard fields (text, true or false, whole number or list of texts) |
| `platforms`   | optional overlays by target; cascade: common < adapter defaults < overlay            |
| `includes`    | optional; true when `body.md` uses `{{include:<relative path>}}`, contained (M-03)   |

Built at install into `store/`, rendered, then linked entry by entry into the two skill folders (skills synced from elsewhere are left alone). Skill text is privileged (M-01, from phase 4).

## Worked example

```yaml
schema: skill-source/v1
name: review-docs
description: 'Review knowledge docs and procedures before committing.'
targets: [claude, agents]
metadata: { owner: agent-config }
platforms:
  claude: { allowed-tools: [Read, Grep, Bash] }
includes: true
```
