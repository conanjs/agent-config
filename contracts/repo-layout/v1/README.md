# repo-layout/v1

What every repository of the split must hold at its root, and what it must not track. One checker, `build layout`, reads this contract in the CI (continuous integration) of all four repos.

|           |                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------- |
| Owner     | agent-config                                                                                                        |
| Consumers | CI of all four repos (`build layout`)                                                                               |
| Record    | DR-412; spec FR-012, AC-1.1, AC-16.10                                                                               |
| File      | `rules.yaml` in this folder is the canonical rule set (`schema: repo-layout/v1`); `schema.json` describes its shape |

The sketch wrote `contract: repo-layout/v1`. The reader reads the `schema:` key of every contract file, so the file uses `schema:`; `contract:` is refused (see `examples/invalid/old-contract-key.yaml`).

## Fields

| Key                   | Required | Rule                                                                                                                                                                                                                |
| --------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `required`            | yes      | Entries that must exist at the root; a trailing `/` means a folder. At least one                                                                                                                                    |
| `required-if-content` | no       | Entries needed only when the repo holds content documents (`index.md`); assumption: the repo's `component.yaml` sets `provides.index` or `provides.exports`                                                         |
| `missing-message`     | yes      | Text of the finding for a missing entry, `{path}` replaced by the entry                                                                                                                                             |
| `forbidden`           | yes      | Rules by `rule`: `generated-from-line` (a tracked file whose first line is the generated-from line, AC-16.10) and `build-output-folder` (a tracked file below one of `folders`). Each has a `message` with `{path}` |
| `exceptions`          | no       | Per repo name (an id): `entry` that may be absent when `stand-in` exists                                                                                                                                            |

The generated-from line is the one the renderer writes (render-rules.ts, AC-16.4): ``Generated from `<source path>`; edit that file, not this copy.`` Only tracked files count: the same file left untracked is not a finding.

## Output of the checker

One line per finding, then a summary line (messages are fixed by tests/repo-layout/layout.feature):

```
finding: missing required entry CHANGELOG.md
finding: tracked file starts with the generated-from line: docs/copy.md
repo-layout: no findings
repo-layout: 2 findings (report mode)
```

`build layout --report` lists findings and exits 0; without `--report` any finding exits 1. `--repo <name>` selects that repo's exceptions.

## Worked example

In `agent-config`, `scripts/check.sh` is absent but `scripts/check-docs.sh` exists: the exception for `agent-config` accepts it, so there is no finding. In `other-repo` the same tree gives `finding: missing required entry scripts/check.sh`.

## Versioning rule

A component pins the major only (FR-006, "functional requirement 6"). A reader accepts the current major and the previous one (`v1` and `v0` when `v2` ships). Adding an optional key is not a new major; removing a key, renaming one or tightening a rule is. A major bump goes in this order: the reader first, then providers, then consumers, and the old major is dropped when `doctor` shows nobody still uses it (DR-418). Unknown keys never fail a file: the reader warns and ignores them (CON-10).

## When it is missing or stale

Blocking in each new repo from its first commit; report mode in agent-config until phase 8, when its content has moved (DR-412). A repo's CI that cannot read this contract fails. Each repo's `INTERFACES.md` lists its `component.yaml` as a provided file interface that links to the `component/v1` schema.

## Examples

`examples/valid/` and `examples/invalid/` are shared with the parity test.
