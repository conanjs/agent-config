# `components-lock/v1`: what the installer resolved

**File:** `{{AGENT_HOME}}/components.lock`, written by the installer only, JSON on disk with sorted keys · **Schema:** [`schema.json`](schema.json) (JSON Schema 2020-12) · **Examples:** [`examples/valid/`](examples/valid/), [`examples/invalid/`](examples/invalid/)

| Field            | Value                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner            | agent-config                                                                                                                                                                                                                                                                                                                                                                                               |
| Consumers        | installer, doctor, `add`, `use`, `plan`                                                                                                                                                                                                                                                                                                                                                                    |
| Versioning rule  | Readers accept the current major and the previous one (FR-006). A new optional key is not a new major; renaming or removing a key, or making an optional key required, is. A major bump follows DR-418: the reader first, providers before consumers, and the previous major is dropped when `doctor` shows no user. Compatibility is diffed against the last `contracts/v...` tag on every commit (FF-6). |
| Missing or stale | Acquire or validation fails: the previous version stays linked (AC-3.4, AC-7.2). No lock means nothing is installed yet; `install` creates it.                                                                                                                                                                                                                                                             |
| Records          | DR-403 (security M-02, M-07); FR-014, FR-020, AC-3.1 to AC-3.4                                                                                                                                                                                                                                                                                                                                             |

## Shape

`components` maps each component name to an entry:

| Key        | Required | Meaning                                                                                                                                                                             |
| ---------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source`   | yes      | The source from the list, as locked (same shapes as `components-list/v1`)                                                                                                           |
| `resolved` | yes      | What was fetched: `{ commit }` (40 lowercase hex, optionally `tag`) for git; `{ live: true, path }` for a path source; `{ sha256 }` for an archive. `live: false` is not a location |
| `manifest` | no       | `version`, `slot`, `contracts` read from the component's `component.yaml`                                                                                                           |
| `build`    | no       | `null`, or `{ source_sha, build, adapters }` with whole numbers of 1 or more                                                                                                        |
| `store_id` | no       | 12 lowercase hex characters: the current tree under `store/`                                                                                                                        |

## Worked examples

- [`examples/valid/components.lock`](examples/valid/components.lock): a git component on a branch with a manifest and `build: null`, and one on the tag `v1.0.0`.
- [`examples/valid/path-and-archive.lock`](examples/valid/path-and-archive.lock): a live path source with a build stamp, and an archive source.

## Rules

| Id   | Rule                                                                                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| LK-1 | The lock lives in the home, never in a repo (it holds local paths and the user name)                                                                         |
| LK-2 | `install` checks out `resolved.commit`; only `install --update [<name>]` advances a `git` source, printing the commit range and any privileged change (M-02) |
| LK-3 | A locked tag that now resolves to another commit exits 1, "tag moved", naming the component (P-4, T-16)                                                      |
| LK-4 | The lock is written at the commit point of an install, by temporary file and rename (DR-202, DR-104)                                                         |

`schema.json` and the reader check the shape only. LK-1 to LK-4 are the installer's behaviour; the contract is what it writes. Unknown keys are tolerated, so a newer installer's extra key does not break an older reader (CON-10).

## Parity

`contracts/lib/parity.test.ts` runs every file in `examples/` through `schema.json` (ajv) and through the reader: `valid/` must pass both, `invalid/` must fail both. A `.lock` file is parsed as JSON on both sides.
