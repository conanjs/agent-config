---
status: applied (2026-10-04)
last-updated: 2026-10-04
target: "{{AGENT_HOME}}/frameworks/company-kb/ (additions)"
---

# Company KB changes: the `system/` folder (replaces the system repo)

> **Applied 2026-10-04.** The live schemas are `{{AGENT_HOME}}/frameworks/company-kb/schemas/{system-architecture,service-catalog,cross-repo-feature}.schema.md`. This file keeps the design rationale. The agentic-sdlc side (P0 reading the catalog, cross-repo flow, repo §2 `system.kb`) is still a v2 proposal.

> **Plain English:** v1 needed a separate "system repo" just to hold the map of how services connect. The Company KB already holds most of that: a repo table, cross-repo flows and domains. So v2 adds one optional folder, `companies/<co>/system/`, and drops the extra repo.
> **Analogy:** before, the city map lived in its own building. Now it's a chapter in the city guide we already keep.

## 1. What moves where

| v1 system repo item | v2 home | Why |
|---|---|---|
| `docs/system-architecture.md` | `companies/<co>/system/architecture.md` (`system-architecture` schema) | Topology between repos is a company fact (store C) |
| `docs/service-catalog.yaml` | `companies/<co>/system/service-catalog.yaml` (`service-catalog` schema) | Same |
| `specs/<feature>/` (cross-repo features run through Spec Kit) | `companies/<co>/system/features/<NNN-slug>.md` (`cross-repo-feature` schema). Each slice is a normal Spec Kit feature in its own repo | One doc per cross-repo feature; Spec Kit stays per repo |
| `contracts/` | **Provider repo** `contracts/` (unchanged location rules per repo); the catalog points to them | Contracts are code: they must be versioned and reviewed with the product, not in a personal/team config repo |
| `.specify/memory/constitution.md` (system) | `system/architecture.md` §5 *System principles* | One section, no Spec Kit needed |
| `workspace_layout`, `repos_root_var` | Company `index.md` (already declares structure and `{{<CO>_REPOS_ROOT}}`) | Already there |

**Monorepo:** no `system/` folder needed. The services are components in the repo's own `docs/architecture.md`, and contracts live in the repo.

## 2. Instance layout

```
{{AGENT_HOME}}/companies/<co>/
├── index.md                     + "System" row → system/architecture.md
├── repos/ flows/ domain/ infra/ (unchanged)
└── system/                      OPTIONAL: only when cross-repo missions are run with agentic-sdlc
    ├── architecture.md          system-architecture schema
    ├── service-catalog.yaml     service-catalog schema
    └── features/
        └── 004-hr-sync.md       cross-repo-feature schema
```

**Example: what OTS would gain.**

```
companies/ots/system/architecture.md      context map: FE → gateway → {import-shipment-api, shipment-api} → Apigee
companies/ots/system/service-catalog.yaml 4 services; ne-import-shipment-api owns CargoRelease
```

## 3. How the pieces link

| From → To | Mechanism | Example |
|---|---|---|
| D → C | Repo `docs/architecture.md` §2 `system.kb` + `system.ref` | `kb: {{AGENT_HOME}}/companies/ots/system/`, `ref: 12` |
| C → D | Catalog `repo` and `provides` paths | `ne-shipment-api: provides contracts/shipment.proto@3` |
| C → C | Catalog `owns` → `domain/*.md`; context-map edges → `flows/*.md` | `CargoRelease` → `domain/cargo-release.md` |
| A → C | **Content: never.** The agentic-sdlc framework only uses C's *schemas* and finds C through D's pointer | — |

**Source of truth:**
- D (`docs/architecture.md`) owns a repo's *internals*.
- C (`system/`) owns what is *between* repos.
- Neither restates the other: D's §2 copies only the direct neighbours, pinned by `ref`.

## 4. Cross-repo flow (agentic-sdlc P0–P7)

| Step | Where | Gate |
|---|---|---|
| P0 | The Orchestrator reads `system/service-catalog.yaml` via D's `system.kb`. More than one service touched → cross-repo path | — |
| P1 | Writes `system/features/<id>.md` §2 Blueprint | G0 |
| P3 | §3 Behaviour (system-level stories and acceptance criteria) | G2 |
| P4 | §4 Contract changes and §5 Decisions (system-architecture `decide`) | G3 |
| P5 | §6 Slices: one row per repo; slice 0 is always the provider's contract change | G4 |
| per slice | P3–P7 run **in that repo** as a normal Spec Kit feature; its `spec.md` names the parent doc | per repo |
| P7 (system) | system-architecture updates `architecture.md` and the catalog, bumps `system-ref`, sets the feature to `done`, and adds refresh slices for repos whose §2 is now stale | G5 |

**Contract-first, without a system repo:**
1. Slice 0 merges the contract change in the **provider** repo (contract-only PR, version bump).
2. Provider and consumer slices start only after slice 0 merges.
3. Consumers never edit a contract copy. They pin `<provider>:contracts/<file>@<major>`.

## 5. Trade-offs (decision D8)

| | Separate system repo (v1) | Company KB `system/` (v2) |
|---|---|---|
| Extra repo to create and clone | yes | no |
| Agents find it | clone, then a sibling path | already under `{{AGENT_HOME}}` |
| Reuses repo table, flows, domains | no (duplicates them) | yes |
| Visible to teammates who don't use agent-config | yes | **no**: mitigated by keeping contracts in provider repos and linking each slice's `spec.md` back |
| Review history of topology changes | system repo PRs | agent-config PRs |

## 6. Changes to company-kb framework files

| File | Change |
|---|---|
| `schemas/_system.md` | Valid schema names += `system-architecture`, `service-catalog`, `cross-repo-feature`; registry rows below; `system/` is optional |
| `conventions.md` | Document-type table += the three types; update trigger: "system-level P7 updates `system/`" |
| `index.md` | Mention the optional `system/` folder |
| Instance `index.md` | Optional "System" row |

| Schema | File | Applies to |
|---|---|---|
| `system-architecture` | `schemas/system-architecture.schema.md` | `system/architecture.md` |
| `service-catalog` | `schemas/service-catalog.schema.md` | `system/service-catalog.yaml` |
| `cross-repo-feature` | `schemas/cross-repo-feature.schema.md` | `system/features/*.md` |

Company-KB schema names are unversioned (that framework's convention), so these are too.

## References

- `{{AGENT_HOME}}/frameworks/company-kb/schemas/_system.md`: the host schema system, layout options and path convention
- `{{AGENT_HOME}}/companies/ots/index.md`: the current instance
- `../../agentic-sdlc-architecture.md` §4.3: the v1 system-repo design this replaces
- [OpenAPI](https://www.openapis.org/), [AsyncAPI](https://www.asyncapi.com/): contract formats kept in provider repos
- [Martin Fowler: Consumer-Driven Contracts](https://martinfowler.com/articles/consumerDrivenContracts.html): why consumers pin provider contract versions

## Related

- `schemas/*.schema.md` in this folder
- `../README.md` §4, §7, §15 (D8)
- `../schemas/repo-architecture.schema.md` §2 System context
