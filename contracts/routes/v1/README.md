# routes/v1

A route tells an agent "when X is true, read file Y first". A component lists its routes; the renderer turns every enabled component's routes into one generated file each agent loads at session start.

|           |                                                                                                                                                                              |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner     | agent-config renderer                                                                                                                                                        |
| Consumers | Claude Code, Copilot CLI and VS Code, Codex (through the generated routes file)                                                                                              |
| Record    | DR-407; spec AC-10.3, AC-12.1, AC-12.2, AC-12.5, FR-039                                                                                                                      |
| Files     | the `routes:` list of a `component.yaml` (checked there by `component/v1`), or the same list as a document of its own with `schema: routes/v1` (this folder's `schema.json`) |

## Fields

| Key              | Required | Rule                                                                                                                                                                           |
| ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`             | yes      | `^[a-z0-9][a-z0-9-]{0,63}$` (M-03, the id allow-list)                                                                                                                          |
| `when`           | yes      | One sentence the agent matches against its task                                                                                                                                |
| `read`           | yes      | Path of a location file inside the component; no `..`, no drive letter, no `:`, no `\`, not absolute (M-03). Rendered as the real path of the copy under `generated/` (DR-307) |
| `before-writing` | no       | Same path rule: a file to read before writing in that area                                                                                                                     |

The document needs at least one route. Two routes with one id inside one component are refused by the installer, which sees the whole list; the schema cannot express it.

## Where the routes end up

| Agent       | Output (generated class, never committed)                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| Copilot     | `~/.copilot/instructions/routes.instructions.md`, front matter `applyTo: "**"`                        |
| Claude Code | one `@<home>/generated/routes.md` import line in `~/.claude/CLAUDE.md`                                |
| Codex       | `~/.codex/AGENTS.md` = core + routes, under 32 KiB, else install exits 1 and names the size (AC-12.2) |

## Worked example

```yaml
schema: routes/v1
routes:
  - id: company-kb
    when: Working on a repo listed in a company KB, or the company is named
    read: companies/index.md
    before-writing: frameworks/company-kb/index.md
```

Rendered for Copilot, that becomes one bullet: "When working on a repo listed in a company KB, or the company is named, read `<home>/generated/.../companies/index.md` first; read `frameworks/company-kb/index.md` before writing there."

## Versioning rule

A component pins the major only (FR-006, "functional requirement 6"). A reader accepts the current major and the previous one (`v1` and `v0` when `v2` ships). Adding an optional key is not a new major; removing a key, renaming one or tightening a rule is. A major bump goes in this order: the reader first, then providers, then consumers, and the old major is dropped when `doctor` shows nobody still uses it (DR-418). Unknown keys never fail a file: the reader warns and ignores them (CON-10).

## When it is missing or stale

- A route is privileged: a new or changed route needs V's consent at install (M-01, from phase 3).
- A machine whose generated routes file no longer matches the sources: `doctor` fails on the hash check (AC-12.5); the post-merge and session-start hooks re-render it. They never change the set of routes, only its text.
- A component with no `routes` simply adds none.

## Examples

`examples/valid/` and `examples/invalid/` are run through `schema.json` and through the reader by the parity test; both must agree.
