# Schema: service-catalog

_Applies to: `system/service-catalog.yaml` (optional; created together with `system/architecture.md`)_

A machine-readable list of every repo in the system. Agents read it to decide whether a task touches more than one service, and which repo owns an entity or a contract.

---

## Required Structure

```yaml
schema: service-catalog
last-updated: YYYY-MM-DD
system: <id>
services:
  - id: <service id>
    repo: <clone folder name>            # local path = the company's repos-root variable + repo (layout per company index.md)
    url: <git url>
    owner: <team>
    stack: <primary language/runtime, e.g. typescript-node>
    owns: [<Entity>]                     # each entity owned by exactly one service
    provides: [contracts/<file>@<major>] # path inside THIS service's repo
    consumes: [<service id>:contracts/<file>@<major>]
    external: [<third-party id>]         # e.g. apigee-hr; details in that repo's docs/integrations/
    kb: repos/<repo>/overview.md         # this KB's overview doc for the repo
```

---

## Field Rules

- `id`: unique, kebab-case.
- `repo`: matches a row in the company `index.md` Repos table.
- `owns`: each entity appears in exactly one service's list. Link the entity to `domain/<concept>.md` when that doc exists.
- `consumes`: each entry matches a `provides` entry of the named service, with the same major version.
- `kb`: path relative to the company folder, and the file exists.
- Empty lists are written as `[]`, never omitted.

---

## Example

```yaml
schema: service-catalog
last-updated: 2026-10-04
system: ots-shipment
services:
  - id: import-shipment
    repo: ne-import-shipment-api
    url: <git url>
    owner: <team>
    stack: typescript-node
    owns: [CargoRelease]
    provides: [contracts/import.proto@2]
    consumes: []
    external: []
    kb: repos/ne-import-shipment-api/overview.md
```
