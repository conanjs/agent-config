---
schema: schema/v1
last-updated: 2026-10-04
---

# Schema: Stack Profile Index (`stack/v2`)

**Applies to:** `stacks/<id>/index.md` · **Store:** A · **Written by:** framework maintainer (tech-stack proposes) · **Read by:** every role working on a component with `stack: <id>`; script workers (`cmd.*`) · **Loaded as:** ②

The entry file of a stack profile. It holds three things:
- the **slot table**, which is the only place commands and tool names live;
- the **links** to the stack's other files;
- the **Reference topics** table, which lists the knowledge docs a planner may attach to a task.

Roles and scripts refer to slot names, never to tool names. Swapping the stack swaps every command.

## Stack folder layout

```
stacks/<id>/
├── index.md               this schema
├── idioms.md              stack-idioms.schema.md
├── frameworks/<fw>.md     stack-framework.schema.md   (0..n)
└── paradigms/<pdm>.md     stack-paradigm.schema.md    (one per supported paradigm)
```

## Front-matter

| Key | Required | Meaning |
|---|---|---|
| `id` | yes | Folder name, e.g. `typescript-node` |
| `detect-by` | yes | Manifest files that identify the stack, e.g. `[package.json, tsconfig.json]` |
| `frameworks` | yes | Ids under `frameworks/` (may be `[]`) |
| `paradigms` | yes | Ids under `paradigms/` (which paradigms this stack supports) |

## Required structure

````markdown
# Stack: <display name> (`<id>`)

**Applies to:** <kind of component>

## Slots
| Slot | Value |
|---|---|
| `language_version` | … |
| `package_manager` | … |
| `project_layout` | … |
| `style_guide` | <URL of the official/adopted language style guide> |
| `cmd.install` | `…` |
| `cmd.format` | `…` |
| `cmd.lint` | `…` |
| `cmd.typecheck` | `…` |
| `cmd.test_unit` | `…` |
| `cmd.test_integration` | `…` |
| `cmd.build` | `…` |
| `cmd.audit` | `…` |
| `idiom.errors` | <one line; detail in idioms.md> |
| `idiom.concurrency` | … |
| `idiom.di` | … |
| `idiom.config` | … |
| `idiom.logging` | … |
| `tools` | <comma-separated distinctive tool names used above> |

## Foundation mapping
| Foundation rule | How it's expressed in this stack |
|---|---|

## Reference topics
| Topic | Attach when | Path |
|---|---|---|
| <topic> | <observable task condition> | {{AGENT_HOME}}/knowledge/<topic>/<doc>.md |

## CI template
```yaml
<CI job using only cmd.* slots>
```

## Toolchain defaults rationale
- <tool>: <why it's the default (TC tree)>

## References
## Related
````

## Rules

- Every slot row is present. A slot that doesn't apply says `n/a: <reason>`.
- `cmd.*` values are complete, non-interactive commands run from the repo root, and they exit non-zero on failure.
- `tools` lists every distinctive tool name used here. V6 fails any file outside `stacks/` that mentions one.
- **Reference topics:** the planner reads this table at P5 and writes matching paths into a task's `refs:` (`task-line.schema.md`). "Attach when" must be a condition the planner can check from the spec, plan or task text: "task handles a hot path (plan marks it)", not "when it seems useful". Paths are `{{AGENT_HOME}}/knowledge/…` and must comply with `knowledge-doc/v1`.
- `frameworks` and `paradigms` in front-matter match the files on disk.

## Example

```markdown
## Reference topics
| Topic | Attach when | Path |
|---|---|---|
| V8 hidden classes & inline caches | plan marks the task `hot-path`, or a performance review | {{AGENT_HOME}}/knowledge/js-runtime/v8-hidden-classes.md |
| Event-loop blocking | task adds CPU-heavy work inside a request path | {{AGENT_HOME}}/knowledge/nodejs/event-loop.md |
```

## Checks

| Check | Tool |
|---|---|
| All slots present; `cmd.*` non-empty | `validate.mjs` |
| `frameworks` and `paradigms` match the files on disk | `validate.mjs` |
| Every Reference-topics path exists and has `schema: knowledge-doc/v1` | `validate.mjs` |
| V6 tool-name containment | `validate.mjs` |

## Changes from v1

- Renamed from `binding.schema.md` (`principles/bindings/<id>/index.md` → `stacks/<id>/index.md`).
- New: front-matter keys, `style_guide` slot, `## Reference topics`.
- "Principle mapping" is renamed "Foundation mapping".
