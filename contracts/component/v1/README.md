# `component/v1`: the manifest every component publishes

**File:** `component.yaml` at a component's root · **Schema:** [`schema.json`](schema.json) (JSON Schema 2020-12) · **Examples:** [`examples/valid/`](examples/valid/), [`examples/invalid/`](examples/invalid/)

| Field            | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner            | agent-config                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Consumers        | installer, build, atlas, doctor, renderer, `build cite`                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Versioning rule  | Readers accept the current major and the previous one (FR-006). A new optional key is not a new major; renaming or removing a key, or making an optional key required, is. A major bump follows DR-418: the reader first, providers before consumers, and the previous major is dropped when `doctor` shows no user. Compatibility is diffed against the last `contracts/v...` tag on every commit (FF-6). A component pins the major of the contracts it is written against in `contracts.pin` (FR-006). |
| Missing or stale | Manifest missing or invalid: the component is skipped, `doctor` fails, core still works. An unsupported slot or contract major skips only that component (FR-005).                                                                                                                                                                                                                                                                                                                                        |
| Records          | DR-402 (security M-03, M-07, M-08, M-18); FR-004, FR-005, FR-017, FR-021 to FR-025, AC-1.2, AC-4.5, AC-5.9, AC-9.7, AC-12.7                                                                                                                                                                                                                                                                                                                                                                               |

## Keys

| Key               | Required                             | Meaning                                                                                      |
| ----------------- | ------------------------------------ | -------------------------------------------------------------------------------------------- |
| `schema`          | yes                                  | `component/v1`                                                                               |
| `name`            | yes                                  | Component id, `^[a-z0-9][a-z0-9-]{0,63}$`, unique across both component lists (M-03)         |
| `version`         | yes                                  | The component's own semver, such as `1.4.0`                                                  |
| `slot`            | yes                                  | The slot it fills, from `slots/v1`                                                           |
| `repository`      | when `provides.exports` is not empty | `https://github.com/<owner>/<repository>`, GitHub only, no user-info (CM-4, A-23, M-07)      |
| `scope`           | no                                   | `global` or `per-project`; may narrow the slot's scope, never widen it                       |
| `contracts.pin`   | yes                                  | Major of the motherboard contracts this file is written against, a whole number of 1 or more |
| `locations`       | yes                                  | Location name to a folder relative to this file (M-03)                                       |
| `provides`        | no                                   | `contracts`, `index`, `exports`, `skills`, `agents`, `services`                              |
| `depends`         | no                                   | `slots` (slot, contract, `required`, generated `docs`, display-only `suggest`) and `runtime` |
| `routes`, `hooks` | no                                   | `routes/v1` and `hooks/v1` entries; privileged                                               |
| `variables`       | no                                   | `variables/v1` declarations: public values loaded by agents, never secrets (M-08)            |
| `idle-cost`       | no                                   | Per agent, the ceiling in characters of always-loaded text                                   |

## Worked examples

- [`examples/valid/component.yaml`](examples/valid/component.yaml): agentic-sdlc, with every optional section, including a `detect` of each kind.
- [`examples/valid/core-component.yaml`](examples/valid/core-component.yaml): agent-config's own manifest, `slot: core`, with `exports` (so `repository` is required), a `services` entry and a hook. The real export list comes from `build cite`, not by hand.

A `variables[].detect` is declarative: `{ kind: env, name }` or `{ kind: dir-exists, candidates: [~/...] }`. No command form exists (M-18), so a manifest cannot make the installer run anything to find a value.

## Rules

| Id   | Rule                                                                                                                                                       |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CM-1 | Unknown keys warn and are ignored (CON-10); an unsupported slot or contract major skips only this component (FR-005)                                       |
| CM-2 | `name`, and every skill, agent, route and hook id, match `^[a-z0-9][a-z0-9-]{0,63}$` (M-03)                                                                |
| CM-3 | Every path field is relative and has no `..` segment, drive letter, `:`, `\` or NUL; at use, its real path must stay under the component root (M-03, M-04) |
| CM-4 | `repository` is required when `provides.exports` is not empty; a GitHub URL with no user-info part (AC-9.7, A-23, M-07)                                    |
| CM-5 | `depends.slots[].docs` equals what `build cite` generates from the component's citations (FR-017)                                                          |
| CM-6 | `depends` names slots and contracts, never a repo; `suggest` is display-only and a component no list names is never fetched (AC-4.5)                       |
| CM-7 | `variables[].detect` is declarative; no command form exists (M-18)                                                                                         |
| CM-8 | `routes`, `hooks`, `provides.services`, and skill and agent text are privileged: a new or changed one needs consent at install (M-01)                      |
| CM-9 | A component may contribute no settings key outside its hook entries (M-09)                                                                                 |

`schema.json` and the reader check the shape and CM-2, CM-3, CM-4, CM-7. CM-5 (needs the citations), the real-path check of CM-3, slot-scope narrowing and "every required location is supplied" need other files and belong to `build cite`, the installer and `doctor`.

## Parity

`contracts/lib/parity.test.ts` runs every file in `examples/` through `schema.json` (ajv) and through the reader: `valid/` must pass both, `invalid/` must fail both. The repository and source URL patterns approximate the reader's strict URL check (the string must equal what a URL parser writes back); the reader is the authority for unusual spellings.
