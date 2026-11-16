# `components-list/v1`: the public and the local component list

**Files:** `components.yaml` (agent-config root, public) and `{{AGENT_HOME}}/components.local.yaml` (never tracked) · **Schema:** [`schema.json`](schema.json) (JSON Schema 2020-12) · **Examples:** [`examples/valid/`](examples/valid/), [`examples/invalid/`](examples/invalid/)

| Field            | Value                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner            | agent-config                                                                                                                                                                                                                                                                                                                                                                                               |
| Consumers        | installer, doctor, `add`, `use`, `plan`                                                                                                                                                                                                                                                                                                                                                                    |
| Versioning rule  | Readers accept the current major and the previous one (FR-006). A new optional key is not a new major; renaming or removing a key, or making an optional key required, is. A major bump follows DR-418: the reader first, providers before consumers, and the previous major is dropped when `doctor` shows no user. Compatibility is diffed against the last `contracts/v...` tag on every commit (FF-6). |
| Missing or stale | Acquire or validation fails: the previous version stays linked (AC-3.4, AC-7.2). A missing `path` source fails `install` (exit 1) and `doctor`, leaving earlier links alone (AC-3.3).                                                                                                                                                                                                                      |
| Records          | DR-403 (security M-02, M-07); FR-014, FR-019, FR-020, FR-028, AC-3.1 to AC-3.8                                                                                                                                                                                                                                                                                                                             |

## Shape

Both files use one schema; `local: false` marks the public list and `local: true` the local one. `components` holds entries of `name` and `source` only: the slot comes from each component's own `component.yaml`.

| `source.type` | Keys                        | Notes                                                           |
| ------------- | --------------------------- | --------------------------------------------------------------- |
| `git`         | `url` (https or ssh), `ref` | `ref` is a branch or a tag and never starts with `-` (M-05)     |
| `path`        | `path`                      | A live link to a folder on V's machine; the lock records `live` |
| `archive`     | `url` (https), `sha256`     | Recognised and refused in this release (AC-3.7)                 |

## Worked examples

- [`examples/valid/components.yaml`](examples/valid/components.yaml): three git components, one pinned to the tag `v1.0.0` (A-5).
- [`examples/valid/components.local.yaml`](examples/valid/components.local.yaml): `agent-knowledge` is a known name, so its source is overridden by a live `path`; `my-notes` is a new name, so it adds a component; `my-archive` shows the recognised-but-refused archive source.
- [`examples/valid/empty.yaml`](examples/valid/empty.yaml): a list with no entries is valid.

## Rules

| Id   | Rule                                                                                                                                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- |
| CL-1 | Local entries merge by name and win over public ones; `plan` shows the override (FR-019)                                              |
| CL-2 | `components.local.yaml` and `variables.local.yaml` never lie inside a tracked path; the repo check fails naming the file (AC-3.8)     |
| CL-3 | `source.type` is `git` (`url` with scheme `https` or `ssh`, `ref`), `path` (`path`) or `archive` (`url`, `sha256`; refused for now)   |
| CL-4 | A source URL with a user-info part (`user:pass@`) fails validation, naming the component only (M-07); `ssh://git@host/...` is allowed |
| CL-5 | A component no list names is never fetched, even if a manifest suggests it (AC-4.5)                                                   |
| CL-6 | A slot's default provider is the `components.yaml` entry whose manifest names that slot (DR-403)                                      |

`schema.json` and the reader check the shape and CL-3, CL-4 (a URL has no query, fragment, percent escape or whitespace). CL-1, CL-2, CL-5 and CL-6 need both lists or the repository and belong to the installer and the repo check.

## Parity

`contracts/lib/parity.test.ts` runs every file in `examples/` through `schema.json` (ajv) and through the reader: `valid/` must pass both, `invalid/` must fail both. The URL patterns approximate the reader's strict URL check; the reader is the authority for unusual spellings.
