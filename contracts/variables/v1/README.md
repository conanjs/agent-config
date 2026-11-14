# variables/v1

A variable is a named, public value (a folder, a language) that documents refer to as `{{NAME}}`. The component whose docs use it declares it; V supplies the value once.

|             |                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| Owner       | agent-config                                                                                            |
| Declared by | the component whose docs use the variable                                                               |
| Consumers   | installer; agents read the rendered `generated/global-variables.md`                                     |
| Record      | DR-414, with security M-08, M-18; spec FR-025, AC-6.1 to AC-6.6, AC-8.1                                 |
| Files       | the `variables:` list of a `component.yaml`, or the same list as a document with `schema: variables/v1` |

## Fields

| Key           | Required | Rule                                                                                                                                                                                                                                             |
| ------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`        | yes      | Upper snake case: `^[A-Z][A-Z0-9_]*$`                                                                                                                                                                                                            |
| `description` | yes      | One line; shown in the rendered table                                                                                                                                                                                                            |
| `required`    | no       | `true`: install needs a value (see VR-6)                                                                                                                                                                                                         |
| `detect`      | no       | A proposal, never a command (M-18): `{kind: env, name: <variable>}` or `{kind: dir-exists, candidates: [~/..., ...]}`. Each candidate starts with `~/` and passes the path rules (M-03). A detected value is used only after V runs `set` (A-10) |

## Rules

| Id   | Rule                                                                                                                                                                                                                                                                                                                                            |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VR-1 | `generated/global-variables.md` has one table `\| Variable \| Value \| Description \| Declared by \|`, `AGENT_HOME` first, one row per variable of each enabled component (AC-6.2); `{{AGENT_HOME}}/global-variables.md` links to it                                                                                                            |
| VR-2 | Two enabled components declaring one name with different descriptions: install fails naming both                                                                                                                                                                                                                                                |
| VR-3 | `set NAME=value` for an undeclared name exits 1 and names the closest declared names (AC-6.3)                                                                                                                                                                                                                                                   |
| VR-4 | Variables are public values that agents load. `set` refuses names containing `TOKEN`, `SECRET`, `PASSWORD`, `APIKEY` or `API_KEY`, and values starting `ghp_`, `github_pat_`, `sk-`, `AKIA` or `xox`; `doctor` re-checks the rendered file (M-08). The schema does not repeat this check: it needs the value, which a declaration does not hold |
| VR-5 | First phase 2 install: values found in the old `~/.copilot/global-variables.md` are offered as proposals in the needs report, the old file is backed up, V confirms with `set` (DR-414)                                                                                                                                                         |
| VR-6 | A required value that is missing exits 10 with a "variables" need after any "components" need, and nothing changes (AC-4.2)                                                                                                                                                                                                                     |

V's values live in `{{AGENT_HOME}}/variables.local.yaml` (`schema: variables-local/v1`, a `values:` map, written by `set` after a backup, never tracked). That file is the installer's own state, not one of the fifteen contracts, so this folder has no schema for it.

## Worked example

```yaml
schema: variables/v1
variables:
  - name: OTS_REPOS_ROOT
    description: Folder that holds the OTS repos
    required: true
    detect: { kind: dir-exists, candidates: ['~/workspace/ots'] }
```

If `~/workspace/ots` exists, the needs report shows "OTS_REPOS_ROOT: found ~/workspace/ots, run set OTS_REPOS_ROOT=~/workspace/ots". Nothing is stored until V runs that command.

## Versioning rule

A component pins the major only (FR-006, "functional requirement 6"). A reader accepts the current major and the previous one (`v1` and `v0` when `v2` ships). Adding an optional key is not a new major; removing a key, renaming one or tightening a rule is. A major bump goes in this order: the reader first, then providers, then consumers, and the old major is dropped when `doctor` shows nobody still uses it (DR-418). Unknown keys never fail a file: the reader warns and ignores them (CON-10).

## When it is missing or stale

A required value that is missing exits 10 and nothing changes (VR-6). A value that changed only re-renders `generated/global-variables.md`; linked sources are untouched (AC-6.6).

## Examples

`examples/valid/` and `examples/invalid/` are shared with the parity test.
