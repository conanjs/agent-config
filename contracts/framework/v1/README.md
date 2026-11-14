# framework/v1

A framework is a component that adds skills and agents only to the projects where V turns it on (agentic-sdlc is the first one). This contract says what such a component must hold so `enable` and `disable` can work.

|           |                                                                                              |
| --------- | -------------------------------------------------------------------------------------------- |
| Owner     | agent-config                                                                                 |
| Provider  | agentic-sdlc (later agent-foundry)                                                           |
| Consumers | installer (`enable`, `disable`), doctor                                                      |
| Record    | DR-415 (pending Q8); spec AC-1.4, AC-14.1 to AC-14.4, FR-041                                 |
| File      | `framework.yaml` at the root of the component's `framework` location, `schema: framework/v1` |

The sketch (build-v1.md) lists rules FW-1 to FW-4 and no file. `framework.yaml` is an addition to it, and DR-415 is still pending Q8, so the file may change.

Everything the framework's `component.yaml` already says is read from there and not repeated: the index file is `provides.index` (FW-1), the exposed skills and agents are `provides.skills` and `provides.agents`, and its routes are its `routes`. `framework.yaml` holds only what is new.

## Fields

| Key             | Required | Rule                                                                                         |
| --------------- | -------- | -------------------------------------------------------------------------------------------- |
| `project-links` | no       | Which project folders get links: `.claude`, `.agents`; absent means both                     |
| `validators[]`  | no       | `id`, `command`, and `arguments`: the names of the outside inputs the validator takes (FW-4) |

A file with only `schema: framework/v1` is valid.

## Rules

| Id   | Rule                                                                                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FW-1 | `index.md` at the root of the `framework` location                                                                                                           |
| FW-2 | Skills, agents and routes are exposed only in projects where `enable` ran; the files stay readable in the home                                               |
| FW-3 | `enable <project>` adds links under the project's `.claude/` and `.agents/` and lists them in `.git/info/exclude`; `disable` removes exactly those (AC-14.3) |
| FW-4 | Validators take every outside input (for example the knowledge area) as an argument and hard-code no folder of another repo (AC-14.4)                        |

The schema checks the file's shape. FW-2 to FW-4 are behaviour of the installer and of the framework's own tests.

## Worked example

```yaml
schema: framework/v1
project-links: [.claude, .agents]
validators:
  - id: validate-sdlc
    command: node tools/validate-sdlc/cli.mjs
    arguments: [knowledge-area]
```

Running `enable ~/work/shop` links the folders named by `provides.skills` and `provides.agents` of `component.yaml` into `~/work/shop/.claude/` and `~/work/shop/.agents/` and adds those link names to `~/work/shop/.git/info/exclude`. `disable` removes those links and the exclude lines, and nothing else.

Rollout: schema in phase 0; `enable` and `disable` are installer subcommands added in phase 7, with their own spec amendment.

## Versioning rule

A component pins the major only (FR-006, "functional requirement 6"). A reader accepts the current major and the previous one (`v1` and `v0` when `v2` ships). Adding an optional key is not a new major; removing a key, renaming one or tightening a rule is. A major bump goes in this order: the reader first, then providers, then consumers, and the old major is dropped when `doctor` shows nobody still uses it (DR-418). Unknown keys never fail a file: the reader warns and ignores them (CON-10).

## When it is missing or stale

A framework not enabled in a project: no skills or agents of it appear there. A framework file that fails this contract: `doctor` fails and `enable` refuses, naming the field.

## Examples

`examples/valid/` and `examples/invalid/` are shared with the parity test.
