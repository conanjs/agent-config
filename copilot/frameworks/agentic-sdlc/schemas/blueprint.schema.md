---
schema: schema/v1
last-updated: 2026-10-04
---

# Schema: Blueprint (`blueprint/v2`)

**Applies to:** `specs/<feature>/blueprint.md` · **Store:** D · **Written by:** the Orchestrator, from P1 `propose` replies · **Read by:** the human at G0; roles at P3/P4 as ③ · **Loaded as:** ③

The P1 preview of what one mission *intends* to do. It is written once and never updated. P3/P4 make the binding decisions. Contrast with `repo-architecture` (the living state of the repo).

## Front-matter

| Key | Required | Meaning |
|---|---|---|
| `mission_type` | yes | `new-project` · `new-feature` · `fix-behaviour` · `slice` (one repo's part of a cross-repo feature) |
| `affected` | yes | Repo or service ids |
| `based_on` | yes | `docs/architecture.md@<commit>` |
| `approved_at` | yes | `G0 <YYYY-MM-DD>` |

For a whole cross-repo mission there is no `blueprint.md` file. The same Proposals table, Assumptions and Open questions go into the **Blueprint** section of the Company KB `cross-repo-feature` doc (`{{AGENT_HOME}}/frameworks/company-kb/schemas/cross-repo-feature.schema.md`).

## Required structure

````markdown
# Blueprint: <mission title>

## Mission
<the mission as given, one paragraph>

## Proposals
| Area | Proposal | Confidence | Tree path | Role |
|---|---|---|---|---|
| Scope | … | … | SCOPE-… | product-spec |
| Stack | … | … | TS-… | tech-stack |
| Toolchain | … | … | TC-… | tech-stack |
| Architecture | … | … | AP-… | architecture |
| Paradigm | <component: id@major> | … | PDM-… | engineering |
| Integrations | <new external deps → integration docs to write> | … | — | architecture |
| Test depth | … | … | TD-… | qa |
| Security tier | … | … | RT-… | security |
| Deploy impact | … | … | DT-… | devops |

## System impact      <!-- required when mission_type = slice: parent doc path + slice number; otherwise "> _Single repo._" -->

## Assumptions
- <every default taken because evidence was missing>

## Open questions
1. <max 3, ranked by impact>
````

## Rules

- Every proposal row cites a tree path, or `—` with the reason in Assumptions.
- Rows for roles not consulted on this mission type are left out (not left blank).

## Checks

| Check | Tool |
|---|---|
| Front-matter; sections present; at most 3 open questions | `validate-project.mjs` |

## Changes from v1

- New rows: Paradigm, Integrations. An empty System impact section says `> _Single repo._`
