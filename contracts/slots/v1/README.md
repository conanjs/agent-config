# `slots/v1`: the sockets components fill

**Instance:** `contracts/slots.yaml` in agent-config · **Schema:** [`schema.json`](schema.json) (JSON Schema 2020-12) · **Examples:** [`examples/valid/`](examples/valid/), [`examples/invalid/`](examples/invalid/)

| Field            | Value                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner            | agent-config                                                                                                                                                                                                                                                                                                                                                                                               |
| Consumers        | installer (resolve), doctor, `build cite` (location prefixes), renderer                                                                                                                                                                                                                                                                                                                                    |
| Versioning rule  | Readers accept the current major and the previous one (FR-006). A new optional key is not a new major; renaming or removing a key, or making an optional key required, is. A major bump follows DR-418: the reader first, providers before consumers, and the previous major is dropped when `doctor` shows no user. Compatibility is diffed against the last `contracts/v...` tag on every commit (FF-6). |
| Missing or stale | A component naming a slot absent from `slots.yaml` is skipped with a warning; the others install (AC-5.8). A `slots.yaml` that fails validation stops the install before anything changes.                                                                                                                                                                                                                 |
| Records          | DR-401, DR-404, DR-416; FR-003, AC-1.3, AC-1.4, AC-5.7, AC-5.8, AC-5.10                                                                                                                                                                                                                                                                                                                                    |

## What it is

A slot is a named socket in the home that one or more components fill (analogy: a wall socket that takes a plug of one shape). `knowledge-storage` is a socket for a knowledge base; `agent-knowledge` is the plug that fills it today. A `location` is a named folder inside a slot (the socket's pins): it has a `mount`, the folder's path below `{{AGENT_HOME}}`, so `knowledge` means `{{AGENT_HOME}}/knowledge`.

## Keys of a slot

| Key                    | Meaning                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `name`                 | Slot id, `^[a-z0-9][a-z0-9-]{0,63}$`                                                                                          |
| `reserved`             | `true`: only agent-config's own `component.yaml` fills it; a list entry naming it is an error (SL-5)                          |
| `contract`             | One contract id or a list; a list means the filler offers every listed contract (SL-2)                                        |
| `required`, `multiple` | Whether a filler must exist, and whether several may (replace the old `count`)                                                |
| `scope`                | `global` (once for the home) or `per-project` (files in the home; skills, agents and routes appear only where enabled)        |
| `self-contained`       | Optional; fillers cite no other component (DR-404)                                                                            |
| `locations`            | At least one: `name`, `mount` (relative path, M-03 rules), optional `required`, `shared`, `index` (`provided` or `generated`) |

## Worked example

[`examples/valid/slots.yaml`](examples/valid/slots.yaml) is the shipped instance (the same content as `contracts/slots.yaml`). It holds the reserved `core` slot and the three starting slots:

| Slot                        | required | multiple | scope       | contract                                 |
| --------------------------- | -------- | -------- | ----------- | ---------------------------------------- |
| `knowledge-storage`         | false    | false    | global      | `knowledge-provider/v1`                  |
| `company-knowledge-storage` | false    | true     | global      | `[company-kb/v1, knowledge-provider/v1]` |
| `framework`                 | false    | true     | per-project | `framework/v1`                           |

A path is classified by the longest mount that prefixes it: `{{AGENT_HOME}}/frameworks/knowledge/index.md` falls under `knowledge-storage` (mount `frameworks/knowledge`, 2 segments), not under `framework` (mount `frameworks/{component}`, also 2 segments) because on a tie the literal mount wins (SL-4). The generated `global-variables.md` is not a slot location: the installer links it at `{{AGENT_HOME}}/global-variables.md` and `build cite` classifies it as a core export (DR-414).

## Rules

| Id   | Rule                                                                                                                                           | Message on failure                                                                                                         |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| SL-1 | `count` or `mounts` present                                                                                                                    | Error naming the key and its replacement: "`count` is now `required` + `multiple`", "`mounts` is now `locations`" (AC-1.3) |
| SL-2 | A `contract` list means the filler offers every listed contract                                                                                | none                                                                                                                       |
| SL-3 | Mounts are unique across slots; two installed components supplying the same mount entry fail install naming both (DR-416, FF-13)               | Names both components and the mount                                                                                        |
| SL-4 | A citation's location path is classified by the longest mount that prefixes it; no match fails (AC-5.10)                                       | Names the citing file and the path                                                                                         |
| SL-5 | `reserved: true` slots cannot be named by a list entry                                                                                         | Names the entry                                                                                                            |
| SL-6 | A `multiple: false` slot with two fillers fails, naming both and the `use` command that picks one (AC-5.7)                                     | Names both fillers                                                                                                         |
| SL-7 | A `shared: true` location is linked entry by entry, never as a whole folder (FR-027); its root `index.md` is generated when `index: generated` | none                                                                                                                       |

`schema.json` and the reader check the shape (SL-1, SL-2, key types, M-03 mounts). SL-3 to SL-7 need the installed set and belong to the installer and `build cite`.

## Open point (AC-1.4)

The spec text gives `company-knowledge-storage` the contract `company-kb/v1` alone; the sketch and this instance give the list `[company-kb/v1, knowledge-provider/v1]`. The instance follows the sketch; the acceptance scenario accepts either, because it checks only that the slot offers `company-kb/v1`.

## Parity

`contracts/lib/parity.test.ts` runs every file in `examples/` through `schema.json` (ajv) and through the reader: `valid/` must pass both, `invalid/` must fail both.
